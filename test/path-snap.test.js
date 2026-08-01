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

  await browser.close();
  console.log(failures ? `\n${failures}건 실패` : '\n전부 통과');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
