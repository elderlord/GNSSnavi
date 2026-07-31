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

  await browser.close();
  console.log(failures ? `\n${failures}건 실패` : '\n전부 통과');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
