// 정확도 적응형 지오펜스 테스트
//
// 문제: 진입 반경이 28m 고정인데 실시간 위치 오차가 ±30m를 넘으면
//       한참 떨어진 곳에서도 '진입'으로 오판한다(그리고 실내 화면이 멋대로 뜬다).
// 규칙: 위치가 부정확할수록 진입 반경을 좁히고, 자동 전환이 믿을 수 없는 수준이면
//       아예 전환하지 않고 '약도 보기' 수동 버튼만 제안한다.
//
// 실행: CHROME=<chromium> node test/geofence-adaptive.test.js

const { chromium } = require('playwright-core');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, pass, detail) => {
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) failures++;
};

// 창의나래관(확정 좌표) 기준으로 시나리오를 만든다
const NARI = { lat: 36.375545, lng: 127.376772 };
// 북쪽으로 d미터 떨어진 지점
const north = (p, d) => ({ lat: p.lat + d / 111132, lng: p.lng });

async function scenario(browser, { pos, acc }) {
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 },
    geolocation: { latitude: pos.lat, longitude: pos.lng, accuracy: acc },
    permissions: ['geolocation']
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + ROOT + '/index.html');
  await page.click('#startBtn');
  await page.waitForTimeout(4200);           // dwell 3초 + 여유
  const out = {
    entered: await page.evaluate(() => document.getElementById('indoor').classList.contains('show')),
    venue: (await page.textContent('#indoorName')).trim(),
    suggested: await page.evaluate(() => {
      const b = document.getElementById('nearBtn');
      return !!b && !b.classList.contains('hidden');
    }),
    suggestText: await page.evaluate(() => {
      const b = document.getElementById('nearBtn');
      return b ? b.textContent.trim() : '';
    }),
    errs
  };
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });

  // ① 정확도 양호(±8m) + 관 바로 앞 → 자동 진입해야 한다 (기존 동작 유지)
  const a = await scenario(browser, { pos: NARI, acc: 8 });
  check('정확도 양호 + 관 앞 → 자동 진입', a.entered === true, `venue=${a.venue}`);
  check('  콘솔 에러 없음', a.errs.length === 0, a.errs.join(';'));

  // ② 정확도 불량(±40m) + 관 바로 앞 → 자동 진입하면 안 되고, 수동 제안이 떠야 한다
  //    (±40m면 유효반경 28-20=8m 미만으로 신뢰 불가)
  const b = await scenario(browser, { pos: NARI, acc: 45 });
  check('정확도 불량 + 관 앞 → 자동 진입 안 함', b.entered === false);
  check('정확도 불량 + 관 앞 → 수동 약도 제안 표시', b.suggested === true, b.suggestText);

  // ③ 정확도 불량 + 멀리(250m) → 진입도 제안도 없어야 한다
  const c = await scenario(browser, { pos: north(NARI, 250), acc: 45 });
  check('정확도 불량 + 멀리 → 진입 없음', c.entered === false);
  check('정확도 불량 + 멀리 → 제안도 없음', c.suggested === false, c.suggestText);

  // ④ 정확도 양호 + 반경 밖(60m) → 진입하면 안 된다
  const d = await scenario(browser, { pos: north(NARI, 60), acc: 8 });
  check('정확도 양호 + 반경 밖 → 진입 없음', d.entered === false);

  // ⑤ A→B→A 왕복: 관을 옮겨 다니면 표시도 따라와야 한다 (회귀)
  //
  //   dwell 상태기계의 st.inside 는 '이탈' 분기에서만 꺼졌다. 판별에서 진 관이
  //   이미 inside 였으면 그 플래그가 남아, 그 관은 다시는 ready 후보로 못 들어간다
  //   (ready 는 !st.inside 분기에서만 채워짐). 두 관이 동시에 inside 가 되는 순간
  //   ready 는 영원히 비고, 표시는 세션당 딱 한 번만 바뀐다.
  //   과학기술관(r=30) ↔ 미래기술관(r=28) 은 14.1m 간격이라 이탈반경(±8m 기준 약 47m)
  //   안에서 서로 절대 벗어나지 않으므로, 관람객은 부지를 통째로 떠나야만 복구된다.
  {
    const TECH   = { latitude: 36.376690, longitude: 127.374720, accuracy: 8 };  // 과학기술관
    const FUTURE = { latitude: 36.376770, longitude: 127.374598, accuracy: 8 };  // 미래기술관
    const ctx = await browser.newContext({
      viewport: { width: 414, height: 896 },
      geolocation: TECH, permissions: ['geolocation'],
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + ROOT + '/index.html');
    await page.click('#startBtn');

    // state.fix 는 지수이동평균이라 위치 이벤트 한 번으로는 목적지에 닿지 않는다.
    // 실제 보행처럼 여러 번 갱신해 수렴시킨다(k=0.5 → 8회면 잔차 6cm).
    const walkTo = async (t) => {
      for (let i = 0; i < 8; i++) {
        await ctx.setGeolocation({ ...t, latitude: t.latitude + i * 1e-7 });
        await page.waitForTimeout(120);
      }
    };
    const shown = async () => (await page.textContent('#indoorName')).trim();

    await page.waitForTimeout(4200);                    // dwell 3초 + 여유
    const s1 = await shown();
    await walkTo(FUTURE); await page.waitForTimeout(4200);
    const s2 = await shown();
    await walkTo(TECH);   await page.waitForTimeout(5200);
    const s3 = await shown();
    await ctx.close();

    check('A→B→A ①: 과학기술관 앞에 서면 과학기술관', s1 === '과학기술관', `표시=${s1}`);
    check('A→B→A ②: 미래기술관으로 이동하면 미래기술관', s2 === '미래기술관', `표시=${s2}`);
    check('A→B→A ③: 과학기술관으로 돌아오면 다시 과학기술관', s3 === '과학기술관',
      `${s1} → ${s2} → ${s3}`);
    check('A→B→A: 콘솔 에러 없음', errs.length === 0, errs.join(';'));
  }

  // ⑥ 잘못된 PATHS 점 하나가 POS() 전체를 NaN 으로 오염시키지 않는다 (가드)
  //   PATHS 는 path.html 출력을 손으로 붙여넣어 만든다 — 경도가 빠진 [36.376770] 같은
  //   항목이 현실적으로 들어올 수 있다. 그러면 d 가 NaN 이 되고 `d < best.dist` 비교가
  //   전부 false 라 best 가 NaN 인 채로 굳으며, tol 비교(`>`)도 false 라 걸러지지 않아
  //   POS() 가 {NaN,NaN} 을 내놓는다 — 마커·거리·지오펜스가 조용히 전부 죽는다.
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto('file://' + ROOT + '/index.html');
    const r = await page.evaluate(() => {
      const G = window.__gnssnavi;
      const BASE = { lat: 36.376770, lng: 127.374600 };
      const mLng = 111320 * Math.cos(BASE.lat * Math.PI / 180);
      // (a) 경도가 빠진 점만 있는 경로 → null 이어야 한다 (NaN 좌표 금지)
      const onlyBad = G.snapToPaths(BASE, 8, [
        { id: 'bad', name: '경도 누락', pts: [[BASE.lat], [BASE.lat + 1e-4, BASE.lng]] },
      ]);
      // (b) 망가진 경로가 먼저 와도 뒤의 정상 경로 판정을 오염시키면 안 된다
      const withGood = G.snapToPaths({ lat: BASE.lat, lng: BASE.lng + 10 / mLng }, 8, [
        { id: 'bad', name: '경도 누락', pts: [[BASE.lat], [BASE.lat + 1e-4, BASE.lng]] },
        { id: 'good', name: '남북 직선', pts: [
          [BASE.lat - 50 / 111132, BASE.lng], [BASE.lat + 50 / 111132, BASE.lng]] },
      ]);
      return { onlyBad, withGood };
    });
    check('망가진 경로만 있으면 null (NaN 좌표를 내지 않는다)',
      r.onlyBad === null, `결과=${JSON.stringify(r.onlyBad)}`);
    check('망가진 경로가 정상 경로 판정을 오염시키지 않는다',
      r.withGood && r.withGood.pathId === 'good' && Number.isFinite(r.withGood.dist)
        && Number.isFinite(r.withGood.lat) && Number.isFinite(r.withGood.lng),
      `결과=${JSON.stringify(r.withGood)}`);
  }

  await browser.close();
  console.log(failures ? `\n${failures}건 실패` : '\n전부 통과');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
