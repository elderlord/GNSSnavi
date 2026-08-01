// 경로망 스냅 엔진 테스트
//
// 스냅 엔진은 순수 함수라 브라우저 없이도 검증 가능하지만, 단일 HTML 파일 구조상
// IIFE 안에 있으므로 window.__gnssnavi 테스트 seam 을 통해 page.evaluate 로 호출한다.
//
// 실행: CHROME=<chromium> node test/path-snap.test.js

const { chromium } = require('playwright-core');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, pass, detail) => {
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) failures++;
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('file://' + ROOT + '/index.html');

  const seam = await page.evaluate(() => typeof window.__gnssnavi);
  check('테스트 seam 이 노출된다', seam === 'object', `typeof=${seam}`);

  // 기준점: 창의나래관 확정 좌표 부근. 남북으로 뻗은 100m 직선 경로를 만든다.
  const BASE = { lat: 36.375545, lng: 127.376772 };

  // ── 1) 경로에서 수직으로 d미터 떨어진 점 → 스냅 거리가 d 여야 한다 ──
  const r1 = await page.evaluate(({ BASE }) => {
    const G = window.__gnssnavi;
    const paths = [{ id: 'p1', name: '남북 직선', pts: [
      [BASE.lat - 50 / 111132, BASE.lng],
      [BASE.lat + 50 / 111132, BASE.lng],
    ] }];
    // 동쪽으로 10m 떨어진 지점
    const fix = { lat: BASE.lat, lng: BASE.lng + 10 / (111320 * Math.cos(BASE.lat * Math.PI / 180)) };
    return G.snapToPaths(fix, 8, paths);
  }, { BASE });
  check('수직 10m 떨어진 점의 스냅 거리는 10m', r1 && near(r1.dist, 10, 0.5), `dist=${r1 && r1.dist.toFixed(2)}`);
  check('경로 id 를 반환한다', r1 && r1.pathId === 'p1');

  // ── 2) 가중 보간: acc=8, PATH_ERR=8 이면 w=0.5 → 절반만 끌어온다 ──
  check('가중치 w 는 acc/(acc+PATH_ERR)', r1 && near(r1.w, 0.5, 0.01), `w=${r1 && r1.w.toFixed(3)}`);
  const moved1 = await page.evaluate(({ BASE, r1 }) => {
    const G = window.__gnssnavi;
    const fix = { lat: BASE.lat, lng: BASE.lng + 10 / (111320 * Math.cos(BASE.lat * Math.PI / 180)) };
    // 스냅 결과가 원래 위치와 경로 사이 어디쯤인지 (경로까지 남은 거리)
    const v = G.toLocalM({ lat: r1.lat, lng: r1.lng }, { lat: BASE.lat, lng: BASE.lng });
    return Math.abs(v.x);
  }, { BASE, r1 });
  check('w=0.5 이면 경로까지 남은 거리가 5m', near(moved1, 5, 0.5), `남은거리=${moved1.toFixed(2)}m`);

  // ── 3) 선분 밖으로 벗어난 점은 끝점으로 스냅된다 ──
  const r3 = await page.evaluate(({ BASE }) => {
    const G = window.__gnssnavi;
    const paths = [{ id: 'p1', name: '짧은 선분', pts: [
      [BASE.lat, BASE.lng],
      [BASE.lat + 10 / 111132, BASE.lng],
    ] }];
    // 선분 북쪽 끝에서 더 북쪽으로 5m (즉 끝점에서 5m)
    const fix = { lat: BASE.lat + 15 / 111132, lng: BASE.lng };
    return G.snapToPaths(fix, 8, paths);
  }, { BASE });
  check('선분 밖의 점은 끝점 기준 거리(5m)', r3 && near(r3.dist, 5, 0.5), `dist=${r3 && r3.dist.toFixed(2)}`);

  // ── 4) 허용 거리를 넘으면 스냅하지 않는다 ──
  // acc=8 → tol = min(1.5*hypot(8,8), 25) = 16.97m. 30m 떨어지면 null.
  const r4 = await page.evaluate(({ BASE }) => {
    const G = window.__gnssnavi;
    const paths = [{ id: 'p1', name: '남북 직선', pts: [
      [BASE.lat - 50 / 111132, BASE.lng],
      [BASE.lat + 50 / 111132, BASE.lng],
    ] }];
    const fix = { lat: BASE.lat, lng: BASE.lng + 30 / (111320 * Math.cos(BASE.lat * Math.PI / 180)) };
    return G.snapToPaths(fix, 8, paths);
  }, { BASE });
  check('허용 거리(약 17m) 초과 시 null', r4 === null, `r4=${JSON.stringify(r4)}`);

  // ── 5) SNAP_MAX 절대 상한: 정확도가 아무리 나빠도 25m 초과는 스냅 안 함 ──
  const r5 = await page.evaluate(({ BASE }) => {
    const G = window.__gnssnavi;
    const paths = [{ id: 'p1', name: '남북 직선', pts: [
      [BASE.lat - 50 / 111132, BASE.lng],
      [BASE.lat + 50 / 111132, BASE.lng],
    ] }];
    const fix = { lat: BASE.lat, lng: BASE.lng + 28 / (111320 * Math.cos(BASE.lat * Math.PI / 180)) };
    return G.snapToPaths(fix, 60, paths);   // acc=60 이어도
  }, { BASE });
  check('SNAP_MAX(25m) 절대 상한이 적용된다', r5 === null, `r5=${JSON.stringify(r5)}`);

  // ── 6) 지선 두 개 중 가까운 쪽의 venue 를 반환한다 ──
  const r6 = await page.evaluate(({ BASE }) => {
    const G = window.__gnssnavi;
    const mPerLng = 111320 * Math.cos(BASE.lat * Math.PI / 180);
    const paths = [
      { id: 'spur-a', name: 'A 지선', venue: 'hall-a', pts: [
        [BASE.lat, BASE.lng - 20 / mPerLng], [BASE.lat + 10 / 111132, BASE.lng - 20 / mPerLng]] },
      { id: 'spur-b', name: 'B 지선', venue: 'hall-b', pts: [
        [BASE.lat, BASE.lng + 20 / mPerLng], [BASE.lat + 10 / 111132, BASE.lng + 20 / mPerLng]] },
    ];
    // B 지선 쪽으로 치우친 위치 (동쪽 15m)
    const fix = { lat: BASE.lat + 5 / 111132, lng: BASE.lng + 15 / mPerLng };
    return G.snapToPaths(fix, 8, paths);
  }, { BASE });
  check('가까운 지선의 venue 를 반환한다', r6 && r6.venue === 'hall-b', `venue=${r6 && r6.venue}`);

  // ── 7) PATHS 가 비면 항상 null (스냅 비활성) ──
  const r7 = await page.evaluate(({ BASE }) => window.__gnssnavi.snapToPaths(BASE, 8, []), { BASE });
  check('경로가 없으면 null (스냅 비활성)', r7 === null);

  // ── 8) 점이 2개 미만인 경로는 무시한다 ──
  const r8 = await page.evaluate(({ BASE }) =>
    window.__gnssnavi.snapToPaths(BASE, 8, [{ id: 'bad', name: '점하나', pts: [[BASE.lat, BASE.lng]] }]), { BASE });
  check('점 2개 미만 경로는 무시한다', r8 === null);

  // ── 9) 통합: 스냅이 켜지면 POS() 가 이동하고, 좌표 readout 은 원시값을 유지한다 ──
  {
    const ctx2 = await browser.newContext({
      geolocation: { latitude: 36.375545, longitude: 127.376782, accuracy: 8 },
      permissions: ['geolocation'],
    });
    const p2 = await ctx2.newPage();
    await p2.goto('file://' + ROOT + '/index.html');
    // 남북 직선 경로를 주입한 뒤 시작
    await p2.evaluate(() => {
      const G = window.__gnssnavi;
      G.setPaths([{ id: 'p1', name: '남북 직선', pts: [
        [36.375545 - 50 / 111132, 127.376772],
        [36.375545 + 50 / 111132, 127.376772],
      ] }]);
    });
    await p2.click('#startBtn');
    await p2.waitForTimeout(700);

    const st = await p2.evaluate(() => {
      const G = window.__gnssnavi;
      const s = G.getState();
      return { snapped: !!s.snap, pathId: s.snap && s.snap.pathId,
               posLng: G.POS().lng, rawLng: s.fix.lng };
    });
    check('통합: 경로가 있으면 스냅된다', st.snapped === true, `pathId=${st.pathId}`);
    check('통합: POS() 가 경로 쪽으로 이동한다', st.posLng < st.rawLng,
      `pos=${st.posLng} raw=${st.rawLng}`);
    check('통합: 원시 fix 는 보존된다', near(st.rawLng, 127.376782, 0.00002));

    // 좌표 readout(legend)은 스냅되지 않은 원시 좌표여야 한다
    await p2.click('#bgBtn');
    await p2.waitForTimeout(300);
    const legend = (await p2.textContent('#legend')).trim();
    check('통합: 좌표 readout 은 원시값(스냅 미적용)', legend.includes('127.37678'), legend);

    // 검증 토글로 스냅을 끄면 원위치로 돌아온다
    await p2.click('#snapBtn');
    await p2.waitForTimeout(300);
    const off = await p2.evaluate(() => {
      const G = window.__gnssnavi;
      return { snapOn: G.getState().snapOn, posLng: G.POS().lng };
    });
    check('통합: 토글을 끄면 스냅이 해제된다', off.snapOn === false && near(off.posLng, 127.376782, 0.00002),
      `posLng=${off.posLng}`);
    await ctx2.close();
  }

  // ── 10) 인접 두 관 중 스냅된 지선의 관이 선택된다 ──
  // 이 테스트는 '반경이 겹치는 두 관'이 실제로 존재해야 의미가 있다.
  // 현재 VENUES 에서 겹치는 쌍은 hall-tech(과학기술관, r=30) ↔ hall-future(미래기술관, r=28)
  // 뿐이다(거리 14.1m). 두 관의 좌표가 재측정되어 더 이상 겹치지 않게 되면
  // 아래 (b) 가 실패하며, 그때는 겹치는 다른 쌍으로 시나리오를 옮겨야 한다.
  {
    const AT = { latitude: 36.376690, longitude: 127.374720, accuracy: 8 };  // 과학기술관 좌표

    // (a) 경로가 없을 때 무엇이 열리는지 — 판별 이전의 기준선
    const ctxA = await browser.newContext({ geolocation: AT, permissions: ['geolocation'] });
    const pA = await ctxA.newPage();
    await pA.goto('file://' + ROOT + '/index.html');
    await pA.click('#startBtn');
    await pA.waitForTimeout(4200);   // dwell 3초 + 여유
    const baseline = (await pA.textContent('#indoorName')).trim();
    await ctxA.close();

    // 기준선 자체를 단언한다 — 두 관이 정말 겹쳐 있어야 (b) 가 의미를 가진다.
    // 좌표가 재측정되어 겹침이 사라지면 여기서 먼저 요란하게 실패해야,
    // (b) 의 성공이 '지선 덕분'인지 '더 이상 안 겹쳐서'인지 헷갈리지 않는다.
    check('  기준선: 경로가 없으면 과학기술관이 열린다(두 관이 겹쳐 있음)',
      baseline === '과학기술관', `baseline=${baseline}`);

    // (b) 미래기술관 지선을 주면 미래기술관이 열려야 한다
    const ctxB = await browser.newContext({ geolocation: AT, permissions: ['geolocation'] });
    const pB = await ctxB.newPage();
    await pB.goto('file://' + ROOT + '/index.html');
    await pB.evaluate(() => {
      window.__gnssnavi.setPaths([{
        id: 'spur-future', name: '미래기술관 지선', venue: 'hall-future',
        pts: [[36.376770, 127.374600], [36.376780, 127.374610]],
      }]);
    });
    await pB.click('#startBtn');
    await pB.waitForTimeout(4200);
    const withSpur = (await pB.textContent('#indoorName')).trim();
    const shown = await pB.evaluate(() =>
      document.getElementById('indoor').classList.contains('show'));
    await ctxB.close();

    check('지선 스냅이 관 판별을 결정한다', shown && withSpur === '미래기술관',
      `경로없음→${baseline} / 지선있음→${withSpur} (shown=${shown})`);
  }

  // ── 10b) 정지 상태에서 판별 결과가 뒤바뀌지 않는다 (회귀) ──
  // 겹친 구역에서 판별에 진 관이 혼자 dwell 을 다시 채워 단일 후보로 들어오면
  // 스냅·방향 우선순위를 건너뛰고 화면을 덮어쓰던 결함의 회귀 테스트.
  {
    const ctxF = await browser.newContext({
      geolocation: { latitude: 36.376690, longitude: 127.374720, accuracy: 8 },
      permissions: ['geolocation'],
    });
    const pF = await ctxF.newPage();
    await pF.goto('file://' + ROOT + '/index.html');
    await pF.evaluate(() => {
      window.__gnssnavi.setPaths([{
        id: 'spur-future', name: '미래기술관 지선', venue: 'hall-future',
        pts: [[36.376770, 127.374600], [36.376780, 127.374610]],
      }]);
    });
    await pF.click('#startBtn');
    await pF.waitForTimeout(4200);
    const first = (await pF.textContent('#indoorName')).trim();
    // 움직이지 않고 dwell 두 주기를 더 보낸다 — 예전에는 여기서 뒤바뀌었다
    await pF.waitForTimeout(6000);
    const later = (await pF.textContent('#indoorName')).trim();
    check('정지 상태에서 판별 결과가 유지된다',
      first === '미래기술관' && later === '미래기술관',
      `4.2s→${first} / 10.2s→${later}`);
    await ctxF.close();
  }

  // ── 11) pickCandidate: 스냅 venue 없으면 진행방향, 그것도 없으면 최근접 ──
  {
    const p4 = await (await browser.newContext()).newPage();
    await p4.goto('file://' + ROOT + '/index.html');
    const r = await p4.evaluate(() => {
      const G = window.__gnssnavi;
      const s = G.getState();
      s.fix = { lat: 36.3766, lng: 127.3747, acc: 8 };
      s.snap = null;
      s.courseHeading = null;
      const cands = [{ v: { id: 'far' }, d: 50 }, { v: { id: 'near' }, d: 10 }];
      return G.pickCandidate(cands).v.id;
    });
    check('스냅·방향 없으면 최근접을 고른다', r === 'near', `picked=${r}`);
  }

  // ── 12) 시뮬 드래그가 스냅을 다시 계산한다 ──
  // state.fix 를 applyFix 밖에서 고치는 곳(시뮬 드래그·정렬 리셋)이 state.snap 을
  // 갱신하지 않으면, POS() 가 옛 스냅 좌표를 계속 돌려줘 레이더가 통째로 얼거나
  // (스냅이 있었던 경우) 시뮬 내내 스냅이 한 번도 걸리지 않는다(없었던 경우).
  // 시뮬 모드는 GPS 없이 배치를 검증하는 공식 수단이라 두 경우 다 치명적이다.
  {
    const B = { lat: 36.375545, lng: 127.376772 };
    const NS = (lng) => [[B.lat - 50 / 111132, lng], [B.lat + 50 / 111132, lng]];

    // (a) 스냅이 걸린 상태로 시뮬에 들어가 드래그하면 POS() 가 따라 움직여야 한다
    const ctxS = await browser.newContext({
      viewport: { width: 414, height: 896 },
      geolocation: { latitude: B.lat, longitude: B.lng, accuracy: 8 },
      permissions: ['geolocation'],
    });
    const pS = await ctxS.newPage();
    await pS.goto('file://' + ROOT + '/index.html');
    await pS.evaluate(({ NS, B }) => window.__gnssnavi.setPaths(
      [{ id: 'p1', name: '남북 직선', pts: NS }]), { NS: NS(B.lng), B });
    await pS.click('#startBtn');
    await pS.waitForTimeout(700);
    const before = await pS.evaluate(() => {
      const G = window.__gnssnavi;
      return { snapped: !!G.getState().snap, pos: G.POS() };
    });
    check('시뮬 전: 경로 위라 스냅이 걸려 있다', before.snapped === true);

    await pS.click('#simBtn');
    const box = await pS.locator('#radar').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await pS.mouse.move(cx, cy);
    await pS.mouse.down();
    await pS.mouse.move(cx - 6, cy, { steps: 3 });   // 동쪽으로 몇 m 이동
    await pS.mouse.up();
    await pS.waitForTimeout(200);
    const after = await pS.evaluate(() => {
      const G = window.__gnssnavi;
      const s = G.getState();
      return { snapped: !!s.snap, pos: G.POS(), fix: { lat: s.fix.lat, lng: s.fix.lng } };
    });
    const moved = Math.abs(after.pos.lng - before.pos.lng) > 1e-7;
    check('시뮬 드래그 시 POS() 가 따라 움직인다 (레이더가 얼지 않는다)', moved,
      `before=${before.pos.lng} after=${after.pos.lng}`);
    // 스냅은 fix 와 경로 사이에 남아 있어야 한다 (옛 위치 기준으로 굳으면 안 됨)
    const between = after.snapped && after.pos.lng > B.lng && after.pos.lng < after.fix.lng;
    check('스냅이 현재 fix 기준으로 다시 계산된다', between,
      `경로=${B.lng} POS=${after.pos.lng} fix=${after.fix.lng}`);
    await ctxS.close();

    // (b) 스냅이 없던 상태에서 경로 위로 이동하면 시뮬에서도 스냅이 걸려야 한다
    const ctxT = await browser.newContext({
      viewport: { width: 414, height: 896 },
      geolocation: { latitude: B.lat, longitude: B.lng, accuracy: 8 },
      permissions: ['geolocation'],
    });
    const pT = await ctxT.newPage();
    await pT.goto('file://' + ROOT + '/index.html');
    await pT.click('#startBtn');            // PATHS 는 비어 있음(출하 구성) → snap=null
    await pT.waitForTimeout(700);
    const nullFirst = await pT.evaluate(() => window.__gnssnavi.getState().snap === null);
    check('경로 없으면 스냅 없음(출하 구성)', nullFirst === true);
    await pT.click('#simBtn');
    // 현재 fix 를 지나는 경로를 등록 — 다음 드래그에서 스냅이 걸려야 한다
    await pT.evaluate(() => {
      const s = window.__gnssnavi.getState();
      window.__gnssnavi.setPaths([{ id: 'p1', name: '남북 직선', pts: [
        [s.fix.lat - 50 / 111132, s.fix.lng], [s.fix.lat + 50 / 111132, s.fix.lng]] }]);
    });
    const box2 = await pT.locator('#radar').boundingBox();
    const cx2 = box2.x + box2.width / 2, cy2 = box2.y + box2.height / 2;
    await pT.mouse.move(cx2, cy2);
    await pT.mouse.down();
    await pT.mouse.move(cx2 - 3, cy2, { steps: 2 });   // 몇 m 만 이동(허용 거리 안)
    await pT.mouse.up();
    await pT.waitForTimeout(200);
    const snappedNow = await pT.evaluate(() => {
      const s = window.__gnssnavi.getState();
      return { on: !!s.snap, id: s.snap && s.snap.pathId };
    });
    check('시뮬 모드에서도 스냅이 새로 걸린다', snappedNow.on === true, `pathId=${snappedNow.id}`);
    await ctxT.close();
  }

  await browser.close();
  console.log(failures ? `\n${failures}건 실패` : '\n전부 통과');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
