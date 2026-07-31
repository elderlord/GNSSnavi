# 실내 약도 이미지

건물별 상세 약도를 이 폴더에 넣고 `index.html`의 `VENUES` 항목에 연결합니다.

## 층 구분 (중요)

실내에는 GPS·WiFi 측위가 없어 **현재 층을 자동으로 알 수 없습니다.**
따라서 관람객이 직접 고르는 **층 선택 탭** 방식으로 처리합니다.

- 층별 이미지 파일명 규칙(권장): `hall-<id>-<층>.png`
  예) `hall-astro-1f.png`, `hall-astro-2f.png`
- `VENUES` 항목에 `floors` 배열을 넣으면 약도 상단에 층 탭이 뜹니다:

  ```js
  floors:[
    { label:"1F 천체투영관", img:"maps/hall-astro-1f.png" },
    { label:"2F 전시·관측",  img:"maps/hall-astro-2f.png" },
  ]
  ```
- 층이 하나뿐이면 `mapImage:"maps/hall-xx.png"` (단일)만 지정해도 됩니다.
- 이미지가 아직 없으면 그 자리에 "약도 준비 중"이 표시됩니다(탭은 정상 동작).
- `floors`/`mapImage` 둘 다 없으면 자체 부지 도식에서 해당 관을 하이라이트합니다.

## 현재 연결된 파일

`main`에 올려주신 한글 파일명 이미지를 이 폴더로 영문명 정리해 연결했습니다.

| 관 | 파일 |
|---|---|
| 자연사관 | `hall-nature-1f.png`, `hall-nature-2f.png` |
| 과학기술관 | `hall-tech-b1f.png`, `hall-tech-1f.png`, `hall-tech-1mf.png`(중층), `hall-tech-2f.png` |
| 미래기술관 | `hall-future-1f.png`, `hall-future-2f.png` |
| 창의나래관 | `hall-nari-1f.png`, `hall-nari-2f.png`, `hall-nari-3f.png` |
| 어린이과학관 | `hall-children-1f.png`, `hall-children-2f.png` |
| 천체관 | `hall-astro.png` (단일) |
| 생물탐구관 | (없음 → 자체 도식) |

새 이미지를 추가/교체할 때는 위 파일명 규칙(`hall-<id>-<층>.png`)만 맞추면
코드 수정 없이 자동 연결됩니다. `main` 루트에 남아있는 한글 원본 파일은 중복이므로
정리(삭제)해도 됩니다.

## 배경 약도(선택)

레이더 밑에 부지 약도를 반투명으로 깔려면 `index.html`의 `SITE_MAP`에
이미지 경로 + 대각 기준점 2개(실좌표+픽셀좌표)를 기록해야 위경도↔픽셀 변환이 됩니다. (인수인계서 §7)
