# 산책로 경로망 스냅 (Path Network Snapping) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관람객 위치를 등록된 산책로 폴리라인 위로 끌어와 횡방향 오차를 줄이고, 각 관 입구 지선(spur)에 스냅되는지로 인접 전시관을 판별한다.

**Architecture:** 순수 함수 `snapToPaths(fix, acc, paths)` 가 위경도를 로컬 미터 평면으로 변환해 점–선분 최단거리를 구하고, 결합 불확실성 이내일 때만 정확도 기반 가중 보간으로 위치를 이동시킨다. `applyFix` 가 스냅 결과를 `state.pos` 에 저장하고, 렌더링·지오펜스는 `state.pos` 를 사용한다. 좌표 표시(legend)는 원시 `state.fix` 를 유지한다. 경로 데이터는 `path.html` 로 현장에서 걸으며 기록한다.

**Tech Stack:** 바닐라 JS(단일 HTML 파일, 오프라인), Playwright(playwright-core) + Node 스크립트 테스트, Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`

## Global Constraints

- 앱 본체는 **단일 `index.html`** 을 유지한다(오프라인·GitHub Pages 배포). 외부 라이브러리·CDN 금지.
- 모든 주석·UI 문구는 **한국어**로 쓴다(기존 코드 컨벤션).
- 테스트 실행: `CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/<파일>.js`
- 커밋 전 반드시 구문 검사: HTML 의 `<script>` 를 추출해 `node --check` 통과.
- **스냅은 표시·판정에만 적용한다.** `collect.html` 의 좌표 수집과 화면의 좌표 readout 에는 절대 적용하지 않는다(측정값에 보정을 섞으면 실측의 의미가 사라진다).
- `PATHS` 가 비어 있으면 스냅은 완전히 비활성이고 기존 동작이 그대로 유지되어야 한다.
- 파라미터 초안: `PATH_ERR=8`, `K_TOL=1.5`, `SNAP_MAX=25`, `MAX_W=0.8`
- 기존 테스트는 계속 통과해야 한다: `test/collect-gate.test.js`(8항목), `test/geofence-adaptive.test.js`(7항목)

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `index.html` | 앱 본체. `PATHS` 데이터, 스냅 엔진(순수 함수), 위치 파이프라인 통합, 지오펜스 후보 판별, 검증 토글 | 수정 |
| `test/path-snap.test.js` | 스냅 엔진 단위 테스트 + 통합 회귀 | 신규 |
| `path.html` | 경로 기록 도구(독립). 트랙 기록 → 단순화 → `PATHS` 스니펫 | 신규 |
| `README.md` | 경로망 스냅 사용법·파라미터 문서화 | 수정 |

`index.html` 은 774줄로 이미 크지만, 오프라인 단일 파일 제약 때문에 분할하지 않는다. 대신 스냅 엔진을 **입출력만 있는 순수 함수**로 격리하고 테스트 seam 으로 노출해 독립 검증한다.

---

### Task 1: 스냅 엔진 (순수 함수)

**Files:**
- Modify: `index.html` (`GEO` 상수 블록 뒤 ~176행 근처에 `PATHS`·`SNAP` 추가, 지오 유틸 뒤 ~220행 근처에 함수 추가)
- Test: `test/path-snap.test.js` (신규)

**Interfaces:**
- Consumes: 기존 `D2R` 상수
- Produces:
  - `PATHS: Array<{id:string, name:string, venue?:string, pts:Array<[number,number]>}>` — 빈 배열로 시작
  - `SNAP: {PATH_ERR:number, K_TOL:number, SNAP_MAX:number, MAX_W:number}`
  - `toLocalM(p:{lat,lng}, ref:{lat,lng}) → {x:number, y:number}` — 미터
  - `fromLocalM(v:{x,y}, ref:{lat,lng}) → {lat:number, lng:number}`
  - `closestOnSeg(p:{x,y}, a:{x,y}, b:{x,y}) → {x:number, y:number, t:number}`
  - `snapToPaths(fix:{lat,lng}, acc:number, paths?:Array) → {lat,lng,pathId,venue,dist,w} | null`
  - `window.__gnssnavi` 테스트 seam

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`test/path-snap.test.js` 를 새로 만든다:

```javascript
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
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd /home/user/GNSSnavi && CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/path-snap.test.js`

Expected: FAIL — `테스트 seam 이 노출된다` 부터 실패하고 이후 `TypeError: Cannot read properties of undefined` 로 FATAL 종료.

- [ ] **Step 3: `PATHS` 와 `SNAP` 상수를 추가한다**

`index.html` 의 `const GEO = { ... };` 블록 **바로 뒤**에 삽입한다:

```javascript
/* ════════════════════════ 산책로 경로망 ════════════════════════ */
// 관람객이 실제로 다니는 산책로를 폴리라인으로 등록한다. path.html 로 현장에서 걸으며 기록.
// 비어 있으면 스냅은 완전히 비활성이고 기존 동작이 그대로 유지된다.
//   pts   : [[lat,lng], ...] 순서대로 이은 폴리라인 (방향 제약은 걸지 않음 — 산책로는 양방향)
//   venue : 선택. 관 입구로 이어지는 지선에 달아두면, 이 경로에 스냅될 때 해당 관을
//           지오펜스 후보로 우선한다. 20m 간격의 인접 관을 '거리'가 아니라 '위상'으로 구분.
const PATHS = [
  // 예시(실측 후 교체):
  // { id:"main", name:"정문 직선로", pts:[[36.37550,127.37650],[36.37562,127.37668]] },
  // { id:"spur-tech", name:"과학기술관 지선", venue:"hall-tech",
  //   pts:[[36.37655,127.37455],[36.37669,127.37472]] },
];

// 스냅 파라미터 — 근거는 docs/superpowers/specs/2026-08-01-path-network-snapping-design.md
const SNAP = {
  PATH_ERR: 8,   // 기록된 경로망 자체의 가정 오차(m). 경로도 GPS로 땄으므로 0이 아니다
  K_TOL:    1.5, // 결합 불확실성의 몇 배까지 '경로 위'로 인정할지
  SNAP_MAX: 25,  // 절대 상한(m). 아무리 부정확해도 이보다 멀면 스냅하지 않는다
  MAX_W:    0.8, // 완전 스냅(1.0)을 허용하지 않아 오매칭 피해를 제한
};
```

- [ ] **Step 4: 스냅 엔진 함수를 추가한다**

`index.html` 의 `function latlngToSite(lat,lng){ ... }` 블록 **바로 뒤**에 삽입한다:

```javascript
/* ──────────────────────────────────────────────────────────────
   경로망 스냅 (순수 함수)
   위경도를 기준점 기준 로컬 미터 평면으로 옮겨 평면기하로 계산한다.
   수백 m 범위에서는 등장방형 근사로 충분하다.
   ────────────────────────────────────────────────────────────── */
function toLocalM(p, ref){
  return { x:(p.lng-ref.lng)*111320*Math.cos(ref.lat*D2R),
           y:(p.lat-ref.lat)*111132 };
}
function fromLocalM(v, ref){
  return { lat: ref.lat + v.y/111132,
           lng: ref.lng + v.x/(111320*Math.cos(ref.lat*D2R)) };
}
// 점 p 에서 선분 ab 위의 최근접점. 수선의 발이 선분 밖이면 가까운 끝점을 준다.
function closestOnSeg(p, a, b){
  const vx=b.x-a.x, vy=b.y-a.y, L2=vx*vx+vy*vy;
  if(L2===0) return { x:a.x, y:a.y, t:0 };
  let t=((p.x-a.x)*vx + (p.y-a.y)*vy)/L2;
  t=Math.max(0, Math.min(1, t));
  return { x:a.x+t*vx, y:a.y+t*vy, t };
}
// 현재 위치를 등록된 산책로 위로 끌어온다. 조건 미달이면 null(원위치 유지).
function snapToPaths(fix, acc, paths){
  const list = paths || PATHS;
  if(!Array.isArray(list) || !list.length) return null;
  const ref = fix, p = { x:0, y:0 };   // fix 자신이 기준이므로 원점
  let best = null;
  for(const path of list){
    const pts = path.pts;
    if(!Array.isArray(pts) || pts.length < 2) continue;   // 점 2개 미만은 무시
    for(let i=0; i<pts.length-1; i++){
      const a = toLocalM({lat:pts[i][0],   lng:pts[i][1]},   ref);
      const b = toLocalM({lat:pts[i+1][0], lng:pts[i+1][1]}, ref);
      const c = closestOnSeg(p, a, b);
      const d = Math.hypot(c.x, c.y);
      if(!best || d < best.dist) best = { dist:d, pt:c, path };
    }
  }
  if(!best) return null;
  // 허용 거리: 현재 정확도와 경로망 오차의 결합. 경로도 오차를 안고 있으므로
  // 현재 정확도만으로 판단하면 실제로 경로 위에 있는데도 스냅을 놓친다.
  const tol = Math.min(SNAP.K_TOL*Math.hypot(acc, SNAP.PATH_ERR), SNAP.SNAP_MAX);
  if(best.dist > tol) return null;
  // 가중 보간 — 정확도가 나쁠수록 경로를 더 신뢰한다. 완전 스냅은 하지 않는다.
  const w = Math.min(SNAP.MAX_W, acc/(acc + SNAP.PATH_ERR));
  const moved = fromLocalM({ x:best.pt.x*w, y:best.pt.y*w }, ref);
  return { lat:moved.lat, lng:moved.lng, pathId:best.path.id,
           venue:best.path.venue || null, dist:best.dist, w };
}

// 테스트 seam — 순수 함수를 외부에서 검증하기 위해 노출한다. 앱 동작에는 영향이 없다.
window.__gnssnavi = { snapToPaths, closestOnSeg, toLocalM, fromLocalM, SNAP };
```

- [ ] **Step 5: 구문 검사 후 테스트를 돌려 통과를 확인한다**

Run:
```bash
cd /home/user/GNSSnavi
python3 -c "
import re,subprocess
h=open('index.html',encoding='utf-8').read()
open('/tmp/_c.js','w').write('\n'.join(re.findall(r'<script>(.*?)</script>', h, re.S)))
r=subprocess.run(['node','--check','/tmp/_c.js'],capture_output=True,text=True)
print('syntax:', 'OK' if r.returncode==0 else r.stderr)"
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/path-snap.test.js
```
Expected: `syntax: OK` 그리고 11항목 `전부 통과`
(아래 8개 번호 섹션 중 일부가 검사 2개를 내므로 `check()` 호출은 11회다 — 실측 11항목이 정답)

- [ ] **Step 6: 기존 테스트 회귀를 확인한다**

Run:
```bash
cd /home/user/GNSSnavi
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/collect-gate.test.js
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/geofence-adaptive.test.js
```
Expected: 둘 다 `전부 통과` (`PATHS` 가 비어 있어 스냅이 비활성이므로 동작 변화 없음)

- [ ] **Step 7: 커밋**

```bash
cd /home/user/GNSSnavi
git add index.html test/path-snap.test.js
git commit -m "경로망 스냅 엔진 추가 (순수 함수)

위경도를 로컬 미터 평면으로 옮겨 점-선분 최단거리를 구하고, 결합 불확실성
min(K_TOL*hypot(acc,PATH_ERR), SNAP_MAX) 이내일 때만 정확도 기반 가중 보간으로
위치를 이동시킨다. PATHS 가 비면 완전 비활성이라 기존 동작에 영향이 없다.

테스트 11항목: 수직거리·가중치·선분밖 끝점·허용거리 초과·절대상한·지선 venue·
빈 경로·점2개미만"
```

---

### Task 2: 위치 파이프라인 통합 + 검증 토글

**Files:**
- Modify: `index.html` (`state` 객체 ~223행, `applyFix` ~403행, `draw`·`drawSiteMap`·`evalGeofence`·`updateStatus` 의 위치 참조, 컨트롤 바)
- Test: `test/path-snap.test.js` (통합 항목 추가)

**Interfaces:**
- Consumes: Task 1 의 `snapToPaths(fix, acc, paths)`
- Produces:
  - `state.snap: {lat,lng,pathId,venue,dist,w} | null` — 최근 스냅 결과
  - `state.snapOn: boolean` — 스냅 사용 여부(검증 토글)
  - `POS() → {lat, lng, acc}` — **판정·렌더링에 쓸 위치**. 스냅이 있으면 스냅 위치, 없으면 `state.fix`

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`test/path-snap.test.js` 의 `await browser.close();` **바로 앞**에 삽입한다:

```javascript
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
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd /home/user/GNSSnavi && CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/path-snap.test.js`

Expected: FAIL — `G.setPaths is not a function` 로 FATAL 종료.

- [ ] **Step 3: `state` 에 스냅 필드를 추가한다**

`index.html` 의 `const state = {` 안, `bgOn:false,` 줄 **바로 뒤**에 삽입한다:

```javascript
  snap:null,           // 최근 스냅 결과 {lat,lng,pathId,venue,dist,w} | null
  snapOn:true,         // 경로망 스냅 사용 여부(검증 토글)
```

- [ ] **Step 4: `POS()` 헬퍼를 추가하고 `applyFix` 에서 스냅을 계산한다**

`index.html` 의 `function applyFix(lat,lng,acc,speed=null,crs=null){` **바로 앞**에 삽입한다:

```javascript
// 판정·렌더링에 쓸 위치. 스냅이 유효하면 스냅 위치, 아니면 평활화된 원시 위치.
// 좌표 readout(legend)은 이 함수를 쓰지 않는다 — 측정값에 보정을 섞지 않기 위함.
function POS(){
  if(state.snapOn && state.snap) return { lat:state.snap.lat, lng:state.snap.lng, acc:state.fix.acc };
  return state.fix;
}
```

그리고 `applyFix` 안에서 `state.fix.acc = acc;` 로 끝나는 `else` 블록 **바로 뒤**(주석 `// GPS 진행방향...` 앞)에 삽입한다:

```javascript
  // 산책로 경로망 스냅 — 조건 미달이면 null 이라 원위치가 유지된다
  state.snap = state.snapOn ? snapToPaths(state.fix, state.fix.acc) : null;
```

- [ ] **Step 5: 위치 소비자를 `POS()` 로 바꾼다**

`index.html` 에서 아래 위치의 `state.fix` 를 `POS()` 로 교체한다. **`state.fix.acc`(정확도 읽기)와 legend 좌표 표시는 바꾸지 않는다.**

1. `draw()` 안 마커 계산: `const d = haversine(state.fix, v);` → `const d = haversine(POS(), v);`
2. `draw()` 안: `const brg = bearing(state.fix, v);` → `const brg = bearing(POS(), v);`
3. `drawSiteMap()` 안: `const su=latlngToSite(state.fix.lat, state.fix.lng);` → `const P=POS(); const su=latlngToSite(P.lat, P.lng);` 이어서 같은 함수 안의 `state.fix.lat` → `P.lat` 로 교체
4. `evalGeofence()` 안: `const d = haversine(state.fix, v);` → `const d = haversine(POS(), v);`
5. `updateStatus()` 안 최근접 계산: `haversine(state.fix,v)` → `haversine(POS(),v)`

- [ ] **Step 6: 검증 토글 버튼을 추가한다**

`index.html` 의 컨트롤 바에서 `<button id="bgBtn">🗺 배경약도</button>` **바로 뒤**에 삽입한다:

```html
      <button id="snapBtn" class="on">🛤 경로스냅</button>
```

그리고 배경약도 토글 핸들러(`document.getElementById("bgBtn").onclick=...`) **바로 뒤**에 삽입한다:

```javascript
/* ════════════════════════ 경로망 스냅 토글(검증용) ════════════════════════ */
// 스냅 전/후를 눈으로 비교할 수 있어야 현장에서 오매칭을 잡아낼 수 있다.
document.getElementById("snapBtn").onclick=()=>{
  state.snapOn=!state.snapOn;
  document.getElementById("snapBtn").classList.toggle("on", state.snapOn);
  if(!state.snapOn) state.snap=null;
  else if(state.fix) state.snap=snapToPaths(state.fix, state.fix.acc);
  toast(state.snapOn ? "경로 스냅 ON" : "경로 스냅 OFF — 원시 위치 표시");
  updateStatus();
};
```

- [ ] **Step 7: 테스트 seam 을 확장한다**

`index.html` 의 `window.__gnssnavi = { ... };` 줄을 아래로 교체한다:

```javascript
// 테스트 seam — 순수 함수와 상태를 외부에서 검증하기 위해 노출한다. 앱 동작에는 영향이 없다.
window.__gnssnavi = {
  snapToPaths, closestOnSeg, toLocalM, fromLocalM, SNAP,
  getState: () => state,
  POS: () => POS(),
  setPaths: (arr) => { PATHS.length = 0; PATHS.push(...arr); },
};
```

`PATHS` 는 `const` 지만 배열 내용은 바꿀 수 있으므로 `length=0` 후 `push` 로 교체한다.

- [ ] **Step 8: 구문 검사 후 테스트를 돌려 통과를 확인한다**

Run:
```bash
cd /home/user/GNSSnavi
python3 -c "
import re,subprocess
h=open('index.html',encoding='utf-8').read()
open('/tmp/_c.js','w').write('\n'.join(re.findall(r'<script>(.*?)</script>', h, re.S)))
r=subprocess.run(['node','--check','/tmp/_c.js'],capture_output=True,text=True)
print('syntax:', 'OK' if r.returncode==0 else r.stderr)"
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/path-snap.test.js
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/geofence-adaptive.test.js
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/collect-gate.test.js
```
Expected: 전부 통과 (`path-snap` 13항목, `geofence-adaptive` 7항목, `collect-gate` 8항목)

- [ ] **Step 9: 커밋**

```bash
cd /home/user/GNSSnavi
git add index.html test/path-snap.test.js
git commit -m "경로망 스냅을 위치 파이프라인에 통합 + 검증 토글

applyFix 가 스냅을 계산해 state.snap 에 저장하고, POS() 가 판정·렌더링용
위치를 준다. 좌표 readout(legend)은 원시 state.fix 를 유지 — 측정값에
보정을 섞지 않기 위함.

'🛤 경로스냅' 토글로 스냅 전/후를 현장에서 눈으로 비교할 수 있다
(Berjisian 2022 가 경고한 오매칭을 잡기 위한 장치)."
```

---

### Task 3: 지오펜스 후보 판별 (배열 순서 결함 제거)

**Files:**
- Modify: `index.html` (`evalGeofence` ~433행)
- Test: `test/path-snap.test.js` (판별 항목 추가)

**Interfaces:**
- Consumes: Task 2 의 `POS()`, `state.snap`, 기존 `state.courseHeading`, `bearing()`
- Produces: `pickCandidate(cands:Array<{v:object,d:number}>) → {v,d} | null`

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`test/path-snap.test.js` 의 `await browser.close();` **바로 앞**에 삽입한다:

```javascript
  // ── 10) 인접 두 관 중 스냅된 지선의 관이 선택된다 ──
  {
    const ctx3 = await browser.newContext({
      geolocation: { latitude: 36.376690, longitude: 127.374720, accuracy: 8 },
      permissions: ['geolocation'],
    });
    const p3 = await ctx3.newPage();
    await p3.goto('file://' + ROOT + '/index.html');
    // 과학기술관 좌표에 서 있지만, 자연사관으로 이어지는 지선에 스냅되도록 경로를 준다
    await p3.evaluate(() => {
      window.__gnssnavi.setPaths([{
        id: 'spur-nature', name: '자연사관 지선', venue: 'hall-nature',
        pts: [[36.376690, 127.374725], [36.376700, 127.374730]],
      }]);
    });
    await p3.click('#startBtn');
    await p3.waitForTimeout(4200);   // dwell 3초 + 여유
    const opened = (await p3.textContent('#indoorName')).trim();
    const shown = await p3.evaluate(() =>
      document.getElementById('indoor').classList.contains('show'));
    check('지선 스냅이 관 판별을 결정한다', shown && opened === '자연사관',
      `shown=${shown} venue=${opened}`);
    await ctx3.close();
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
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd /home/user/GNSSnavi && CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/path-snap.test.js`

Expected: FAIL — `지선 스냅이 관 판별을 결정한다` 실패(현재는 배열 순서로 결정됨), 그리고 `G.pickCandidate is not a function` 로 FATAL.

- [ ] **Step 3: `pickCandidate` 를 추가한다**

`index.html` 의 `function evalGeofence(){` **바로 앞**에 삽입한다:

```javascript
// 반경 조건을 만족한 관이 여럿일 때 하나를 고른다.
// 입구가 20m 간격으로 붙어 있으면 반경 판정만으로는 구분이 안 되므로
// ① 스냅된 지선의 관 → ② 진행방향과 가장 잘 맞는 관 → ③ 최근접 순으로 좁힌다.
// (이 함수가 없으면 VENUES 배열 순서로 결정되어 사실상 임의값이 된다)
function pickCandidate(cands){
  if(!cands || !cands.length) return null;
  if(cands.length === 1) return cands[0];
  // ① 지선 스냅
  const sv = state.snap && state.snap.venue;
  if(sv){ const hit = cands.find(c => c.v.id === sv); if(hit) return hit; }
  // ② 진행방향 정합 — 마주보는 문은 180° 차이라 판정 여유가 크다
  const hd = state.courseHeading;
  if(hd != null){
    let best = null;
    for(const c of cands){
      const align = Math.cos((bearing(POS(), c.v) - hd)*D2R);   // 1=정확히 그쪽
      if(!best || align > best.align) best = { c, align };
    }
    if(best) return best.c;
  }
  // ③ 최근접
  return cands.slice().sort((a,b) => a.d - b.d)[0];
}
```

- [ ] **Step 4: `evalGeofence` 가 후보를 모아 하나만 진입시키도록 고친다**

`index.html` 의 `evalGeofence` 안에서 `if(!st.inside){` 블록을 아래로 교체한다.
기존:
```javascript
    if(!st.inside){
      if(reliable && d < rInEff){
        st.sinceIn = st.sinceIn ?? now; st.sinceOut = null;
        if(now - st.sinceIn >= GEO.DWELL_MS){ st.inside = true; st.sinceIn = null; enterIndoor(v); }
      } else {
```
교체 후:
```javascript
    if(!st.inside){
      if(reliable && d < rInEff){
        st.sinceIn = st.sinceIn ?? now; st.sinceOut = null;
        // 진입 조건을 만족한 관은 후보로만 모으고, 실제 진입은 루프 뒤에서 하나만 시킨다
        if(now - st.sinceIn >= GEO.DWELL_MS) ready.push({ v, d, st });
      } else {
```

그리고 `evalGeofence` 시작부의 `let suggest = null;` 줄 **바로 뒤**에 삽입한다:

```javascript
  const ready = [];     // dwell 을 채운 진입 후보들
```

마지막으로 `updateNearSuggest(state.indoor ? null : suggest);` 줄 **바로 앞**에 삽입한다:

```javascript
  // 진입 후보가 여럿이면 하나만 고른다(배열 순서로 결정되지 않게)
  if(ready.length){
    const cands = ready.slice();
    // 이미 들어와 있는 관이 아직 이탈 전이면 후보로 함께 넣는다.
    // 넣지 않으면 패자가 dwell 을 다시 채워 단독으로 ready 에 올라
    // 우선순위 비교 없이 판정을 뒤집는다(아래 ⚠ 참조).
    if(state.indoor){
      const cur = VENUES.find(v => v.id === state.indoor.id);
      const curSt = cur && geoTimers.get(cur.id);
      if(cur && curSt && curSt.inside && !cands.some(c => c.v.id === cur.id)){
        const dCur = haversine(POS(), cur);
        if(dCur <= cur.radiusIn + GEO.OUT_MARGIN + GEO.ACC_K*acc) cands.push({ v:cur, d:dCur, st:curSt });
      }
    }
    const win = pickCandidate(cands);
    if(win){
      win.st.inside = true; win.st.sinceIn = null;
      // 이미 보여주고 있는 관이 이기면 다시 그리지 않는다(선택한 층이 초기화되지 않게)
      if(!state.indoor || state.indoor.id !== win.v.id) enterIndoor(win.v);
    }
    // 나머지 후보는 dwell 타이머만 되돌려 다음 기회를 기다린다
    for(const c of cands) if(c !== win) c.st.sinceIn = null;
  }
```

> ⚠ **이 블록은 최초 계획서에서 한 번 수정되었다.** 원안은 `pickCandidate(ready)` 로 승자를 정하고
> 패자의 `sinceIn` 만 `null` 로 되돌렸다. 그러면 반경이 영구히 겹치는 두 관(실측상
> `hall-tech` ↔ `hall-future`, 14.1m)에서 패자가 dwell 을 다시 채우는데, 승자는
> `st.inside=true` 라 `!st.inside` 분기에서 빠져 있으므로 `DWELL_MS` 후 **패자가 ready 에 단독으로**
> 올라간다. 그러면 `pickCandidate` 의 `cands.length===1` 조기 반환에 걸려 스냅·진행방향
> 우선순위를 **건너뛰고** 진입해, 정지해 있는 사용자의 화면이 엉뚱한 관으로 바뀐다.
> 실증(수정 전, 정지 상태): `t≈4.2s 미래기술관 → t≈7.2s 과학기술관`.
> 회귀 테스트는 `test/path-snap.test.js` 의 10b.

- [ ] **Step 5: 테스트 seam 에 `pickCandidate` 를 노출한다**

`index.html` 의 `window.__gnssnavi = {` 객체에 `POS: () => POS(),` 줄 **바로 뒤**로 삽입한다:

```javascript
  pickCandidate: (c) => pickCandidate(c),
```

- [ ] **Step 6: 구문 검사 후 전체 테스트를 돌린다**

Run:
```bash
cd /home/user/GNSSnavi
python3 -c "
import re,subprocess
h=open('index.html',encoding='utf-8').read()
open('/tmp/_c.js','w').write('\n'.join(re.findall(r'<script>(.*?)</script>', h, re.S)))
r=subprocess.run(['node','--check','/tmp/_c.js'],capture_output=True,text=True)
print('syntax:', 'OK' if r.returncode==0 else r.stderr)"
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/path-snap.test.js
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/geofence-adaptive.test.js
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/collect-gate.test.js
```
Expected: 전부 통과 (`path-snap` 16항목 포함 — Task 2 에서 5항목이 추가되어 11→16)

- [ ] **Step 7: 커밋**

```bash
cd /home/user/GNSSnavi
git add index.html test/path-snap.test.js
git commit -m "지오펜스 후보 판별 — 배열 순서로 결정되던 결함 제거

입구가 20m 간격으로 붙어 있으면 반경이 겹쳐 여러 관이 동시에 조건을 만족하는데,
기존 코드는 VENUES 배열 순서상 뒤의 관이 이겨 사실상 임의값이었다.

pickCandidate 로 ①스냅된 지선의 관 ②진행방향 정합 ③최근접 순으로 좁힌다.
진입 조건을 만족한 관을 후보로 모은 뒤 하나만 진입시킨다."
```

---

### Task 4: `path.html` 경로 기록 도구 + 문서

**Files:**
- Create: `path.html`
- Modify: `README.md`

**Interfaces:**
- Consumes: 없음 (독립 도구)
- Produces: 사용자가 붙여넣을 `PATHS` 스니펫 텍스트

- [ ] **Step 1: `path.html` 을 만든다**

`collect.html` 의 품질 게이트와 같은 기준(위성 락)을 적용한다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="color-scheme" content="dark">
<title>산책로 기록 — GNSS 레이더</title>
<style>
  :root{--bg:#0d1117;--fg:#dfe6ff;--acc:#7aa2ff;--ok:#33e1a1;--warn:#ffb454;--err:#ff5d6c;--dim:#7d87a8;}
  *{box-sizing:border-box;}
  html,body{margin:0;background:var(--bg);color:var(--fg);
    font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%;}
  body{padding:14px;max-width:640px;margin:0 auto;}
  h1{font-size:17px;margin:0 0 4px;color:var(--acc);}
  p.sub{margin:0 0 14px;color:var(--dim);font-size:12.5px;}
  .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
    border-radius:12px;padding:12px;margin-bottom:12px;}
  label{display:block;font-size:12px;color:var(--dim);margin-bottom:5px;}
  input,select{width:100%;background:#0b1120;border:1px solid #2b3550;color:var(--fg);
    border-radius:8px;padding:10px;font-size:16px;}
  button{appearance:none;border:0;border-radius:10px;padding:12px 16px;font-size:15px;
    font-weight:600;background:var(--acc);color:#08101f;cursor:pointer;touch-action:manipulation;}
  button.ghost{background:transparent;color:var(--fg);border:1px solid #2b3550;}
  button:disabled{opacity:.4;}
  .row{display:flex;gap:8px;flex-wrap:wrap;}.row>*{flex:1 1 auto;}
  .stat{display:flex;justify-content:space-between;padding:3px 0;
    border-bottom:1px dashed rgba(255,255,255,.08);font-size:13px;}
  .stat span:first-child{color:var(--dim);}
  pre{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;line-height:1.5;
    background:#080b14;border:1px solid #202a42;border-radius:8px;padding:10px;
    overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin:0;max-height:300px;}
  .note{font-size:11.5px;color:var(--dim);margin-top:8px;}
  .bad{color:var(--err);} .good{color:var(--ok);}
</style>
</head>
<body>
  <h1>산책로 기록</h1>
  <p class="sub">산책로를 <b>끝에서 끝까지 걸으며</b> 트랙을 기록합니다.
     기록된 폴리라인을 <b>PATHS</b> 에 붙여넣으면 위치가 경로 위로 보정됩니다.<br>
     정확도 <b>±12m 이하</b> 샘플만 채택합니다(좌표 수집과 같은 기준).</p>

  <div class="card">
    <label>경로 종류</label>
    <select id="kind">
      <option value="main">주요 산책로 (venue 없음)</option>
      <option value="hall-nature">지선 → 자연사관</option>
      <option value="hall-tech">지선 → 과학기술관</option>
      <option value="hall-future">지선 → 미래기술관</option>
      <option value="hall-nari">지선 → 창의나래관</option>
      <option value="hall-children">지선 → 어린이과학관</option>
      <option value="hall-bio">지선 → 생물탐구관</option>
      <option value="hall-astro">지선 → 천체관</option>
    </select>
    <label style="margin-top:10px">경로 이름</label>
    <input type="text" id="pname" placeholder="예: 정문 직선로">
  </div>

  <div class="card">
    <div class="row">
      <button id="startBtn">기록 시작</button>
      <button id="stopBtn" class="ghost" disabled>기록 종료</button>
    </div>
    <div class="note" id="phase">대기 중 — 경로 한쪽 끝에 서서 시작하세요.</div>
  </div>

  <div class="card">
    <div class="stat"><span>채택 점 / 전체</span><b id="nPts">—</b></div>
    <div class="stat"><span>현재 정확도</span><b id="acc">—</b></div>
    <div class="stat"><span>기록 길이</span><b id="len">—</b></div>
    <div class="stat"><span>단순화 후 점</span><b id="simp">—</b></div>
  </div>

  <div class="card">
    <label>결과 (index.html 의 PATHS 에 붙여넣기)</label>
    <pre id="out">아직 기록 전입니다.</pre>
    <div class="row" style="margin-top:10px">
      <button id="copyBtn" class="ghost" disabled>복사</button>
      <button id="resetBtn" class="ghost" disabled>초기화</button>
    </div>
    <div class="note">같은 경로를 2~3회 기록해 비교하면 노이즈를 걸러낼 수 있습니다.</div>
  </div>

<script>
(() => {
"use strict";
const LOCK_MAX = 12;      // 채택 정확도 상한(m) — collect.html 과 동일 기준
const EPS_M    = 3;       // Douglas-Peucker 단순화 허용 오차(m)
const $ = id => document.getElementById(id);
let watchId = null, pts = [], total = 0;

const D2R = Math.PI/180;
function distM(a, b){
  const R=6371000;
  const dla=(b.lat-a.lat)*D2R, dlo=(b.lng-a.lng)*D2R;
  const h=Math.sin(dla/2)**2+Math.cos(a.lat*D2R)*Math.cos(b.lat*D2R)*Math.sin(dlo/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
// 점–선분 거리(로컬 미터 근사) — 단순화에 사용
function perpM(p, a, b){
  const ref=a;
  const X=q=>[(q.lng-ref.lng)*111320*Math.cos(ref.lat*D2R), (q.lat-ref.lat)*111132];
  const [px,py]=X(p), [ax,ay]=X(a), [bx,by]=X(b);
  const vx=bx-ax, vy=by-ay, L2=vx*vx+vy*vy;
  if(L2===0) return Math.hypot(px-ax, py-ay);
  let t=((px-ax)*vx+(py-ay)*vy)/L2; t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(ax+t*vx), py-(ay+t*vy));
}
// Douglas-Peucker: 형태를 유지하면서 점 수를 줄인다
function simplify(list, eps){
  if(list.length < 3) return list.slice();
  let maxD=0, idx=0;
  for(let i=1;i<list.length-1;i++){
    const d=perpM(list[i], list[0], list[list.length-1]);
    if(d>maxD){ maxD=d; idx=i; }
  }
  if(maxD <= eps) return [list[0], list[list.length-1]];
  const left=simplify(list.slice(0, idx+1), eps);
  const right=simplify(list.slice(idx), eps);
  return left.slice(0,-1).concat(right);
}

function render(){
  $("nPts").textContent = `${pts.length} / ${total}`;
  if(!pts.length) return;
  $("acc").innerHTML = `<span class="${pts[pts.length-1].acc<=LOCK_MAX?'good':'bad'}">`
    + `±${pts[pts.length-1].acc.toFixed(0)}m</span>`;
  let L=0; for(let i=1;i<pts.length;i++) L+=distM(pts[i-1], pts[i]);
  $("len").textContent = `${L.toFixed(0)} m`;

  const s = simplify(pts, EPS_M);
  $("simp").textContent = `${s.length}개`;

  const venue = $("kind").value;
  const name = ($("pname").value || "이름없음").trim();
  const id = venue === "main" ? "main-" + Date.now().toString(36).slice(-4) : "spur-" + venue.replace("hall-","");
  const body = s.map(p => `[${p.lat.toFixed(6)},${p.lng.toFixed(6)}]`).join(",\n         ");
  $("out").textContent =
`{ id:"${id}", name:"${name}",${venue==="main" ? "" : ` venue:"${venue}",`}
  pts:[ ${body} ] },
// 채택 ${pts.length}/${total}점 · 길이 ${L.toFixed(0)}m · 단순화 ${s.length}점 · ${new Date().toISOString()}`;
}

function finish(msg){
  if(watchId!=null){ navigator.geolocation.clearWatch(watchId); watchId=null; }
  $("startBtn").disabled=false; $("stopBtn").disabled=true;
  $("copyBtn").disabled = $("resetBtn").disabled = pts.length < 2;
  $("phase").textContent = msg;
}

$("startBtn").onclick=()=>{
  if(!("geolocation" in navigator)){ $("phase").textContent="Geolocation 미지원"; return; }
  pts=[]; total=0;
  $("startBtn").disabled=true; $("stopBtn").disabled=false;
  $("copyBtn").disabled=$("resetBtn").disabled=true;
  $("phase").textContent="기록 중 — 경로를 따라 일정한 속도로 걸으세요.";
  watchId=navigator.geolocation.watchPosition(
    p=>{
      total++;
      const acc=p.coords.accuracy;
      if(acc > LOCK_MAX) return;                  // 기준 미달 샘플은 버린다
      const q={lat:p.coords.latitude, lng:p.coords.longitude, acc};
      // 1m 미만 이동은 노이즈로 보고 건너뛴다
      if(pts.length && distM(pts[pts.length-1], q) < 1) return;
      pts.push(q); render();
    },
    e=>finish("오류: "+e.message+" (위치 권한 확인)"),
    { enableHighAccuracy:true, maximumAge:0, timeout:20000 }
  );
};
$("stopBtn").onclick=()=>finish(pts.length>=2
  ? `기록 완료 — ${pts.length}점. 아래 스니펫을 복사하세요.`
  : `점이 부족합니다(${pts.length}점). 더 걸으며 다시 기록하세요.`);
$("resetBtn").onclick=()=>{
  pts=[]; total=0;
  ["nPts","acc","len","simp"].forEach(i=>$(i).textContent="—");
  $("out").textContent="아직 기록 전입니다.";
  $("copyBtn").disabled=$("resetBtn").disabled=true;
  $("phase").textContent="초기화됨.";
};
$("kind").onchange = $("pname").oninput = render;
$("copyBtn").onclick=async()=>{
  try{ await navigator.clipboard.writeText($("out").textContent);
    $("copyBtn").textContent="복사됨 ✓"; setTimeout(()=>$("copyBtn").textContent="복사",1500); }
  catch{ const r=document.createRange(); r.selectNode($("out"));
    getSelection().removeAllRanges(); getSelection().addRange(r); }
};
})();
</script>
</body>
</html>
```

- [ ] **Step 2: 구문 검사와 동작 확인**

Run:
```bash
cd /home/user/GNSSnavi
python3 -c "
import re,subprocess
h=open('path.html',encoding='utf-8').read()
open('/tmp/_c.js','w').write('\n'.join(re.findall(r'<script>(.*?)</script>', h, re.S)))
r=subprocess.run(['node','--check','/tmp/_c.js'],capture_output=True,text=True)
print('syntax:', 'OK' if r.returncode==0 else r.stderr)"
```
Expected: `syntax: OK`

주입 시퀀스로 기록 동작을 확인한다:
```bash
cd /home/user/GNSSnavi
cat > /tmp/_pt.js <<'JS'
const { chromium } = require('playwright-core');
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME,args:['--no-sandbox']});
  const ctx=await b.newContext(); const p=await ctx.newPage();
  // 북쪽으로 곧게 걷는 40개 샘플(정확도 8m) + 기준 미달 5개를 섞는다
  const seq=[];
  for(let i=0;i<40;i++) seq.push({lat:36.3755+i*2/111132, lng:127.3767, acc:8});
  for(let i=0;i<5;i++)  seq.push({lat:36.3760, lng:127.3760, acc:30});
  await p.addInitScript(seq=>{
    const stub={ watchPosition(cb){ let i=0;
      const t=setInterval(()=>{ if(i>=seq.length){clearInterval(t);return;} const s=seq[i++];
        cb({coords:{latitude:s.lat,longitude:s.lng,accuracy:s.acc,altitude:null,
            altitudeAccuracy:null,speed:null,heading:null},timestamp:Date.now()}); },25); return 1; },
      clearWatch(){}, getCurrentPosition(){} };
    Object.defineProperty(navigator,'geolocation',{value:stub,configurable:true,writable:true});
  },seq);
  await p.goto('file://'+process.cwd()+'/path.html');
  await p.click('#startBtn'); await p.waitForTimeout(25*seq.length+600);
  await p.click('#stopBtn'); await p.waitForTimeout(200);
  console.log('채택/전체 :',(await p.textContent('#nPts')).trim());
  console.log('길이      :',(await p.textContent('#len')).trim());
  console.log('단순화    :',(await p.textContent('#simp')).trim());
  console.log('스니펫 1행:',(await p.textContent('#out')).trim().split('\n')[0]);
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
JS
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node /tmp/_pt.js
```
Expected: 채택 40/45(±30m 샘플 5개는 버려짐), 길이 약 78m, 단순화 2점(직선이므로), 스니펫 첫 줄에 `id:"main-..."`

- [ ] **Step 3: README 를 갱신한다**

`README.md` 의 파일 표에서 `| \`diag.html\` |` 줄 **바로 뒤**에 삽입한다:

```markdown
| `path.html` | 산책로 기록 도구 (걸으며 트랙 기록 → 단순화 → `PATHS` 스니펫) |
```

그리고 구현 단계 체크리스트의 **마지막 항목 바로 뒤**에 삽입한다
(원안은 "마지막 `- [ ]` 항목"이라 적었으나 README 의 체크리스트는 전부 `- [x]` 다 —
현재 마지막 항목은 `- [x] 배경 약도 …` 줄):

```markdown
- [x] 산책로 경로망 스냅 — 위치를 등록된 경로 위로 끌어와 횡방향 오차 감소

> **경로망 스냅 (`PATHS`)**
> 관람객이 실제로 다니는 산책로를 폴리라인으로 등록하면, 위치가 경로 위로 보정되어
> **횡방향 오차가 산책로 폭으로 제한**됩니다. 관 입구로 이어지는 **지선(spur)** 에
> `venue` 를 달아두면, 어느 지선에 스냅되는지가 곧 어느 관인지가 되어
> **20m 간격으로 붙어 있는 인접 관도 구분**됩니다.
>
> - 기록: `path.html` 로 산책로를 걸으며 기록 → 스니펫을 `index.html` 의 `PATHS` 에 붙여넣기
> - 검증: 앱의 `🛤 경로스냅` 토글로 스냅 전/후를 눈으로 비교
> - 파라미터: `SNAP.PATH_ERR`(경로망 자체 오차) `K_TOL`(허용 배수) `SNAP_MAX`(절대 상한) `MAX_W`(최대 스냅 강도)
> - `PATHS` 가 비어 있으면 스냅은 비활성이고 기존 동작이 그대로 유지됩니다
> - **주의**: 스냅은 표시·판정에만 쓰고 좌표 수집(`collect.html`)과 화면의 좌표 readout 에는
>   적용하지 않습니다. 측정값에 보정을 섞으면 실측의 의미가 사라집니다
> - 근거·한계: `docs/outdoor-microscale-tracking_litreview/08_implications.md`
>   (문헌 성능은 도시 교통망 기준이고 과학관 산책로 규모의 선행연구는 없습니다 — 현장 검증 필수)
> - 검증 테스트: `node test/path-snap.test.js`
```

- [ ] **Step 4: 전체 테스트 회귀 확인**

Run:
```bash
cd /home/user/GNSSnavi
for t in path-snap geofence-adaptive collect-gate; do
  echo "=== $t ==="
  CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" node test/$t.test.js | tail -2
done
```
Expected: 세 개 모두 `전부 통과`

- [ ] **Step 5: 커밋**

```bash
cd /home/user/GNSSnavi
rm -f /tmp/_pt.js
git add path.html README.md
git commit -m "path.html 경로 기록 도구 + 문서

산책로를 걸으며 트랙을 기록해 PATHS 스니펫을 만든다.
정확도 ±12m 초과 샘플은 버리고(collect.html 과 같은 기준),
1m 미만 이동은 노이즈로 건너뛰며, Douglas-Peucker(허용오차 3m)로 단순화한다.
지선은 venue 를 달아 관 판별에 쓰이도록 출력한다."
```

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 절 | 구현 태스크 |
|---|---|
| 3. 데이터 획득(걸어서 기록) | Task 4 (`path.html`) |
| 4. 데이터 구조(`PATHS`) | Task 1 Step 3 |
| 5. 스냅 엔진(순수 함수·파라미터) | Task 1 Step 4 |
| 6. 지오펜스 통합(후보 좁히기) | Task 3 |
| 7. 실패 모드 방어 | `SNAP_MAX` 상한(Task 1), 방향 제약 없음(설계상 폴리라인 방향 미사용), 검증 토글(Task 2 Step 6), 주요 동선만 등록(Task 4 README 안내) |
| 8. 오류 처리 | 빈 `PATHS` 비활성(Task 1 테스트 7), 점 2개 미만 무시(테스트 8), 수집 미적용(Task 2 Step 4 주석 + 통합 테스트) |
| 9. 테스트 | Task 1(단위 8) + Task 2(통합 4) + Task 3(판별 2) + 회귀 |
| 10. 산출물 | 4개 파일 모두 다룸 |

**2. Placeholder 스캔** — "TBD/TODO/적절히" 없음. 모든 코드 단계에 실제 코드 있음. ✓

**3. 타입 일관성**
- `snapToPaths` 반환 `{lat,lng,pathId,venue,dist,w}` — Task 2 `POS()` 가 `.lat/.lng`, Task 3 `pickCandidate` 가 `.venue` 사용 ✓
- `pickCandidate(cands)` 입력 `{v,d}` — Task 3 Step 4 에서 `{v,d,st}` 로 넘기지만 `.v/.d` 만 읽으므로 호환. 테스트 11도 `{v,d}` 로 호출 ✓
- 테스트 seam 키(`snapToPaths/closestOnSeg/toLocalM/fromLocalM/SNAP/getState/POS/setPaths/pickCandidate`) 가 테스트 호출과 일치 ✓
