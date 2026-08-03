// 경로망 편집기(plan.html) 테스트
//
// 이 도구의 존재 이유는 GPS 가 담지 못하는 것 — 길이 어떻게 갈라지고 문이 어디인가 —
// 를 사람이 직접 넣는 것이다. 그래서 검증의 핵심은 두 가지다.
//   1) 손으로 그린 것이 실측 VENUES 를 절대 건드리지 않는다 (측정 무결성)
//   2) 문 두 개를 찍었을 때 '복도 따라 / 가로질러' 분해가 맞다
//      — 지선으로 인접 관을 구분할 수 있는지가 이 숫자로 갈린다
//
// 실행: CHROME=<chromium> node test/plan-editor.test.js

const { chromium } = require('playwright-core');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, pass, detail) => {
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) failures++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// 실측 좌표 (index.html VENUES 와 동일)
const TECH   = { lat: 36.375857, lng: 127.375082 };
const NATURE = { lat: 36.375797, lng: 127.375239 };
const GATE   = { lat: 36.375645, lng: 127.376486 };   // 정문 (실측 트랙 시작점)
const TUNNEL = { lat: 36.375768, lng: 127.375602 };   // 터널 입구 (실측 트랙 끝점)

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + ROOT + '/plan.html');
  await page.waitForTimeout(300);

  // ── 1) seam 과 실측 좌표가 index.html 과 일치한다 ──
  const base = await page.evaluate(() => {
    const G = window.__gnssplan;
    return { n: G.VENUES.length, tech: G.VENUES.find(v => v.id === 'hall-tech'),
             nature: G.VENUES.find(v => v.id === 'hall-nature') };
  });
  check('실측 관 7개가 실린다', base.n === 7, `n=${base.n}`);
  check('과학기술관 좌표가 실측값과 같다',
    near(base.tech.lat, TECH.lat, 1e-6) && near(base.tech.lng, TECH.lng, 1e-6),
    `${base.tech.lat}, ${base.tech.lng}`);

  // ── 2) 원시 로그 파서: path.html 출력 형식을 읽는다 ──
  const trk = await page.evaluate(() => window.__gnssplan.parseTrack(
`# 정문 직선로 (main) · 원시 기록 5점 · 길이 12m
#  t(s)      lat        lng       acc  alt
   0.0 36.375645 127.376486    14    45     0.0
   1.0 36.375646 127.376475    14    45     1.0
   2.0 36.375648 127.376464    22    45     1.0
   3.0 36.375650 127.376453    22    45     1.0`));
  check('원시 로그에서 좌표를 읽는다', trk.length === 4, `n=${trk.length}`);
  check('  주석 줄(#)은 건너뛴다', trk[0] && near(trk[0].lat, 36.375645, 1e-6));

  // 기록 초반 튐(보행 1초에 불가능한 점프)은 버려야 한다
  const trk2 = await page.evaluate(() => window.__gnssplan.parseTrack(
`   0.0 36.375645 127.376486    14    45     0.0
   0.1 36.375404 127.376003   241    45    33.6
   1.0 36.375646 127.376475    14    45     1.0`));
  check('보행으로 불가능한 점프 샘플은 버린다', trk2.length === 2,
    `n=${trk2.length} (33m 점프가 남으면 3)`);

  // ── 3) PATHS 파서: 기존 배열을 읽어 편집할 수 있다 ──
  const parsed = await page.evaluate(() => window.__gnssplan.parsePaths(
`const PATHS = [
  { id:"main-gate", name:"정문→터널", pts:[ [36.375645,127.376486],[36.375768,127.375602] ] },
  { id:"spur-nature", name:"자연사관 지선", venue:"hall-nature",
    pts:[ [36.375760,127.375300],[36.375797,127.375239] ] },
];`));
  check('PATHS 배열을 읽는다', parsed.length === 2, `n=${parsed.length}`);
  check('  venue 가 있는 지선을 구분한다',
    parsed[0].venue === null && parsed[1].venue === 'hall-nature',
    `${parsed[0].venue} / ${parsed[1].venue}`);
  check('  좌표 순서가 [lat,lng] 로 유지된다',
    near(parsed[0].pts[0].lat, 36.375645, 1e-6) && near(parsed[0].pts[0].lng, 127.376486, 1e-6));

  // ── 4) 그린 경로가 PATHS 스니펫으로 나온다 ──
  const snip = await page.evaluate(({ GATE, TUNNEL }) => {
    const G = window.__gnssplan;
    G.setMode('draw');
    G.addPointLL(GATE); G.addPointLL(TUNNEL);
    G.endPath();
    return G.snippet();
  }, { GATE, TUNNEL });
  check('그린 경로가 PATHS 스니펫으로 나온다',
    snip.includes('const PATHS') && snip.includes('36.375645,127.376486')
      && snip.includes('36.375768,127.375602'),
    snip.split('\n')[1]);
  check('  venue 없는 경로에는 venue 키가 안 붙는다', !snip.includes('venue:'));

  // ── 5) 측정 무결성: 손으로 무엇을 하든 VENUES 는 그대로다 ──
  //     이 도구는 사람의 의도를 담는 곳이지 실측을 덮어쓰는 곳이 아니다.
  const intact = await page.evaluate(({ TECH, NATURE }) => {
    const G = window.__gnssplan;
    G.setMode('door');
    // 실측 좌표에서 한참 떨어진 곳에 문을 찍어 본다
    G.addDoorAt('hall-tech',   { lat: TECH.lat + 0.0004, lng: TECH.lng + 0.0004 });
    G.addDoorAt('hall-nature', { lat: NATURE.lat - 0.0003, lng: NATURE.lng - 0.0002 });
    const v = G.VENUES.find(x => x.id === 'hall-tech');
    return { lat: v.lat, lng: v.lng, doors: G.getState().doors.length };
  }, { TECH, NATURE });
  check('문을 찍어도 VENUES 실측값은 변하지 않는다',
    near(intact.lat, TECH.lat, 1e-9) && near(intact.lng, TECH.lng, 1e-9),
    `hall-tech=${intact.lat}, ${intact.lng}`);
  check('  문 위치는 별도 층에 쌓인다', intact.doors === 2, `n=${intact.doors}`);

  // 같은 관을 다시 찍으면 교체되지 축적되지 않는다
  const redo = await page.evaluate(({ TECH }) => {
    const G = window.__gnssplan;
    G.addDoorAt('hall-tech', { lat: TECH.lat, lng: TECH.lng });
    const d = G.getState().doors.filter(x => x.venueId === 'hall-tech');
    return { count: d.length, lat: d[0].lat };
  }, { TECH });
  check('같은 관의 문을 다시 찍으면 교체된다', redo.count === 1 && near(redo.lat, TECH.lat, 1e-9),
    `n=${redo.count}`);

  // ── 6) 핵심: 두 문의 '복도 따라 / 가로질러' 분해 ──
  //   지선으로 인접 관을 구분할 수 있는지가 이 숫자로 갈린다.
  //   가로 간격이 GPS 오차보다 작으면 스냅(횡방향 제약)으로는 구분이 안 된다.
  const decomp = await page.evaluate(({ GATE, TUNNEL, TECH, NATURE }) => {
    const G = window.__gnssplan;
    const S = G.getState();
    S.paths.length = 0; S.doors.length = 0;
    // 간선: 정문 → 터널 (복도 방향을 정의한다)
    G.setMode('draw'); G.addPointLL(GATE); G.addPointLL(TUNNEL); G.endPath();
    // 문 두 개를 실측 좌표 그 자리에 찍는다
    G.setMode('door');
    G.addDoorAt('hall-tech', TECH); G.addDoorAt('hall-nature', NATURE);
    return document.getElementById('doorReport').textContent;
  }, { GATE, TUNNEL, TECH, NATURE });

  const sep   = (decomp.match(/문 간격 ([\d.]+)m/) || [])[1];
  const along = (decomp.match(/복도 따라 ([\d.]+)m/) || [])[1];
  const across= (decomp.match(/가로질러 ([\d.]+)m/) || [])[1];
  check('두 문 간격을 계산한다', near(+sep, 15.6, 0.3), `${sep}m (실측 15.6m)`);
  check('복도 방향 기준으로 종/횡 분해한다',
    near(+along, 15.0, 0.6) && near(+across, 4.2, 0.6),
    `따라 ${along}m · 가로 ${across}m (실측 15.0 / 4.2)`);
  check('가로 간격이 좁으면 지선으로는 어렵다고 알린다',
    decomp.includes('지선으로는 구분이 어렵'),
    decomp.slice(-90).replace(/\s+/g, ' '));

  // 가로로 충분히 벌어지면 반대 판정이 나와야 한다 (판정이 늘 같은 말만 하지 않는지)
  const wide = await page.evaluate(({ GATE, TUNNEL, TECH }) => {
    const G = window.__gnssplan;
    const S = G.getState();
    S.paths.length = 0; S.doors.length = 0;
    G.setMode('draw'); G.addPointLL(GATE); G.addPointLL(TUNNEL); G.endPath();
    G.setMode('door');
    G.addDoorAt('hall-tech', TECH);
    // 복도에 거의 수직으로 20m 떨어뜨린다(복도가 서향이므로 남북으로 벌린다)
    G.addDoorAt('hall-nature', { lat: TECH.lat - 20 / 111132, lng: TECH.lng });
    return document.getElementById('doorReport').textContent;
  }, { GATE, TUNNEL, TECH });
  check('가로 간격이 충분하면 구분 가능하다고 알린다',
    wide.includes('지선 스냅으로 구분할 수 있'),
    (wide.match(/가로질러 ([\d.]+)m/) || [])[1] + 'm');

  check('콘솔 에러 없음', errs.length === 0, errs.join(';'));

  await browser.close();
  console.log(failures ? `\n${failures}건 실패` : '\n전부 통과');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
