// 산책로 기록 도구 테스트
//
// 경로 기록 도구는 PATHS 스니펫을 만드는 현장 도구다.
// 정확도 게이트(±12m), 노이즈 필터(1m), 단순화(Douglas-Peucker)를 거쳐
// 좌표를 기록하되, 측정값은 보정 없이 원시 GPS만 저장한다(측정 무결성).
//
// 이 테스트는 두 버그를 다룬다:
// Round 1: render() 호출 누락으로 라이브 통계 동결 (40/40 vs 40/45)
// Round 2: Event 객체가 정확도로 통과해 스니펫 갱신 불가
//
// 실행: CHROME=<chromium> node test/path-record.test.js

const { chromium } = require('playwright-core');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, pass, detail) => {
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) failures++;
};

// 북쪽으로 d미터 떨어진 지점 계산
const north = (lat, d) => lat + d / 111132;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 페이지 오류 수집 (Round 2 회귀 검증용)
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  // ① 거부된 샘플이 카운터를 진행시킨다 (Round 1 버그)
  // 40개 양호 + 5개 거부 = 45개 전체, 40개 수용
  // 예상: #nPts = "40 / 45"
  {
    const seq = [];
    const baseLat = 36.3755;
    for (let i = 0; i < 40; i++) seq.push({ lat: north(baseLat, i * 2), lng: 127.3767, acc: 8 });
    for (let i = 0; i < 5; i++) seq.push({ lat: north(baseLat, 80), lng: 127.3767, acc: 30 });

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
                altitude: null, altitudeAccuracy: null, speed: null, heading: null
              },
              timestamp: Date.now()
            });
          }, 25);
          return 1;
        },
        clearWatch() { },
        getCurrentPosition() { }
      };
      Object.defineProperty(navigator, 'geolocation', { value: stub, configurable: true, writable: true });
    }, seq);

    await page.goto('file://' + ROOT + '/path.html');
    await page.click('#startBtn');
    await page.waitForTimeout(25 * seq.length + 600);
    await page.click('#stopBtn');
    await page.waitForTimeout(200);

    const nPts = (await page.textContent('#nPts')).trim();
    check('① 거부된 샘플이 카운터를 진행시킨다', nPts === '40 / 45', `nPts=${nPts}`);

    // ② 라이브 정확도 표시가 현재 샘플을 추적한다 (Round 1 버그)
    // 마지막 샘플이 ±30m 거부이므로 #acc에 ±30m bad 클래스가 있어야 함
    const accSpan = await page.$('#acc span');
    const accClass = await accSpan.getAttribute('class');
    const accText = await page.textContent('#acc');
    const hasAccuracy = accText.includes('±30m');
    check('② 라이브 정확도가 현재 샘플을 추적한다', hasAccuracy && accClass === 'bad',
      `text=${accText.trim()}, class=${accClass}`);

    // ③ 방출된 스니펫의 품질 코멘트가 참이다 (Round 1 버그)
    // 마지막 줄이 "// 채택 40/45점"을 포함해야 함
    const snippet = await page.textContent('#out');
    const lastLine = snippet.trim().split('\n').pop();
    const hasComment = lastLine.includes('채택 40/45점');
    check('③ 스니펫 품질 코멘트가 참이다', hasComment,
      `lastLine=${lastLine}`);

    // ④ 폼 편집이 스니펫을 재구축한다 (Round 2 버그)
    // 이름 입력 전 스니펫을 캡처
    const snippetBefore = await page.textContent('#out');

    // 이름 입력
    await page.fill('#pname', '테스트경로');
    await page.waitForTimeout(100);

    // 이름 입력 후 스니펫이 변경되었나?
    const snippetAfterName = await page.textContent('#out');
    const nameUpdated = snippetAfterName.includes('테스트경로');

    // 종류 변경
    await page.selectOption('#kind', 'hall-tech');
    await page.waitForTimeout(100);

    // 종류 변경 후 스니펫이 변경되었나?
    const snippetAfterKind = await page.textContent('#out');
    const hasVenue = snippetAfterKind.includes('venue:"hall-tech"');
    const isSpur = snippetAfterKind.includes('{ id:"spur-tech"');

    check('④ 이름 입력 후 스니펫이 갱신된다', nameUpdated,
      `snippet=${snippetAfterName.trim().split('\n')[0]}`);
    check('  종류 변경 후 스니펫이 갱신된다', hasVenue && isSpur,
      `snippet=${snippetAfterKind.trim().split('\n')[0]}`);

    // 페이지 오류 확인 (Round 2 버그: Event.toFixed())
    const noErrors = errs.length === 0;
    check('  폼 편집 중 페이지 오류 없음', noErrors,
      noErrors ? '' : `errors=${errs.join(';')}`);
  }

  // ⑤ 측정 무결성: 스니펫 좌표가 원시값과 일치한다
  // (단순화 후 유지된 좌표만 검사, 중간 점은 Douglas-Peucker로 제거될 수 있음)
  {
    // 새로 측정: 40개 샘플(직선), 단순화는 시작/끝만 유지
    const seq = [];
    const baseLat = 36.3755;
    for (let i = 0; i < 40; i++) seq.push({ lat: north(baseLat, i * 2), lng: 127.3767, acc: 8 });

    // 기존 페이지를 버리고 새로 로드
    await page.close();
    const page2 = await ctx.newPage();
    page2.on('pageerror', e => errs.push(e.message));

    await page2.addInitScript(seq => {
      const stub = {
        watchPosition(cb) {
          let i = 0;
          const t = setInterval(() => {
            if (i >= seq.length) { clearInterval(t); return; }
            const s = seq[i++];
            cb({
              coords: {
                latitude: s.lat, longitude: s.lng, accuracy: s.acc,
                altitude: null, altitudeAccuracy: null, speed: null, heading: null
              },
              timestamp: Date.now()
            });
          }, 25);
          return 1;
        },
        clearWatch() { },
        getCurrentPosition() { }
      };
      Object.defineProperty(navigator, 'geolocation', { value: stub, configurable: true, writable: true });
    }, seq);

    await page2.goto('file://' + ROOT + '/path.html');
    await page2.click('#startBtn');
    await page2.waitForTimeout(25 * seq.length + 600);
    await page2.click('#stopBtn');
    await page2.waitForTimeout(200);

    // 스니펫에서 좌표 추출
    const snippet = await page2.textContent('#out');

    // 첫 번째와 마지막 좌표 (직선이면 단순화 후에도 유지됨)
    const firstLat = baseLat.toFixed(6);
    const lastLat = north(baseLat, 39 * 2).toFixed(6);  // 마지막 39번째 이동(0-based)
    const lng = (127.3767).toFixed(6);

    // 좌표가 스냅이 아닌 원시값인지 확인 (정확도 6자리 일치)
    const hasFirstCoord = snippet.includes(`${firstLat},${lng}`);
    const hasLastCoord = snippet.includes(`${lastLat},${lng}`);

    check('⑤ 스니펫 좌표가 원시값과 일치한다 (시작점)', hasFirstCoord,
      `first=${firstLat},${lng}, snippet=${snippet.substring(30, 120)}`);
    check('  좌표 일치 (끝점)', hasLastCoord,
      `last=${lastLat},${lng}`);

    await page2.close();
  }

  await ctx.close();
  await browser.close();
  console.log(failures ? `\n${failures}건 실패` : '\n전부 통과');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
