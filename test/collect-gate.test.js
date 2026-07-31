// collect.html 품질 게이트 테스트
//
// 규칙: 위성 락(정확도 ≤12m)에 실패한 세션은 '붙여넣기용 좌표'를 내주면 안 된다.
// 근거: 관 좌표 오차 ±21m + 실시간 위치 오차 ±12m = 합성 ±24m 로,
//       지오펜스 반경 28m 를 해상하지 못한다(정문 앞 진입 성공률 82%까지 하락).
//       임계값 ±12m 는 '정문 앞 진입 ≥95% & 45m 밖 오진입 ≤5%' 기준에서 도출.
//
// 실행: CHROME=<chromium> node test/collect-gate.test.js

const { chromium } = require('playwright-core');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;

function check(name, pass, detail) {
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) failures++;
}

// 지정한 샘플 시퀀스를 watchPosition 으로 흘려보내고 페이지 상태를 읽는다
async function runSession(browser, seq) {
  const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
  const page = await ctx.newPage();
  await page.addInitScript(seq => {
    const stub = {
      watchPosition(cb) {
        let i = 0;
        const t = setInterval(() => {
          if (i >= seq.length) { clearInterval(t); return; }
          const s = seq[i++];
          cb({
            coords: {
              latitude: s.lat, longitude: s.lng, accuracy: s.acc,
              altitude: s.alt === undefined ? null : s.alt,
              altitudeAccuracy: null, speed: null, heading: null
            }, timestamp: Date.now()
          });
        }, 25);
        return 1;
      },
      clearWatch() {}, getCurrentPosition() {}
    };
    Object.defineProperty(navigator, 'geolocation', { value: stub, configurable: true, writable: true });
  }, seq);
  await page.goto('file://' + ROOT + '/collect.html');
  await page.click('#startBtn');
  await page.waitForTimeout(25 * seq.length + 700);
  await page.click('#stopBtn');   // 세션 종료 — 복사 버튼 상태는 종료 후에 확정된다
  await page.waitForTimeout(200);
  const out = {
    snippet: (await page.textContent('#snippet')).trim(),
    fixType: (await page.textContent('#fixType')).trim().replace(/\s+/g, ' '),
    copyDisabled: await page.$eval('#copyBtn', b => b.disabled)
  };
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });

  // ── 케이스 A: 위성 락 실패 (창의나래관에서 실제로 관측된 패턴) ──
  // 전 구간 ±21m, 좁은 산포, 단일 군집
  const lockFail = Array.from({ length: 35 }, (_, i) => ({
    lat: 36.375447 + Math.sin(i) * 0.000006,
    lng: 127.376865 + Math.cos(i) * 0.000006,
    acc: 21 + Math.abs(Math.sin(i))
  }));
  const a = await runSession(browser, lockFail);
  check('락 실패 세션은 붙여넣기용 lat/lng 를 내주지 않는다',
    !/lat:\s*3\d\.\d/.test(a.snippet),
    a.snippet.split('\n')[0].slice(0, 60));
  check('락 실패 세션은 복사 버튼이 비활성이다', a.copyDisabled === true);
  check('락 실패를 명시적으로 알린다', /재측정|락|실패|부족/.test(a.snippet + a.fixType));

  // ── 케이스 B: 위성 락 성공 (행정동에서 관측된 패턴) ──
  // 워밍업 후 ±6m 로 개선
  const lockOk = Array.from({ length: 34 }, (_, i) => ({
    lat: 36.375250 + Math.sin(i) * 0.000004,
    lng: 127.375976 + Math.cos(i) * 0.000004,
    acc: i < 18 ? 28 - i * 1.2 : 6 + Math.abs(Math.sin(i)),
    alt: 62
  }));
  const b = await runSession(browser, lockOk);
  check('락 성공 세션은 붙여넣기용 lat/lng 를 정상 제공한다',
    /lat:\s*36\.3752/.test(b.snippet),
    b.snippet.split('\n').find(l => l.includes('lat:')) || '(없음)');
  check('락 성공 세션은 복사 버튼이 활성이다', b.copyDisabled === false);

  // ── 케이스 C: 경계값 — 정확히 ±12m 는 통과해야 한다 ──
  const borderline = Array.from({ length: 30 }, (_, i) => ({
    lat: 36.3760 + Math.sin(i) * 0.000004, lng: 127.3750 + Math.cos(i) * 0.000004,
    acc: 12, alt: 60
  }));
  const c = await runSession(browser, borderline);
  check('임계값 ±12m 는 채택된다', /lat:\s*36\.376/.test(c.snippet));

  await browser.close();
  console.log(failures ? `\n${failures}건 실패` : '\n전부 통과');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
