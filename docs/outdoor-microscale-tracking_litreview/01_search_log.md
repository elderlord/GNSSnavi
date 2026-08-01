# 검색 로그

- **검색일**: 2026-08-01
- **경로**: `WebSearch` 단일 경로.
  직접 API(OpenAlex·Crossref·Semantic Scholar)와 이들에 대한 `WebFetch` 는 모두 프록시에서 403 차단됨.
- **한계**: DB별 불리언·필드 제한 질의를 통제할 수 없음. 아래 건수는 "검색엔진이 반환한 후보" 기준이며
  DB 전수 검색과 동일하지 않다. 대부분 **초록/검색요약 기반 판단**이므로, 채택 문헌은 원문 확인이 필요하다.

## 질의 목록

| # | 질의문 | 대상 하위질문 | 반환 후보 | 관련 후보 |
|---|---|---|---|---|
| Q1 | smartphone GNSS positioning accuracy limits pedestrian outdoor dual-frequency L5 real-world evaluation | ①한계 | 8 | 5 |
| Q2 | geofence accuracy evaluation radius dwell time false trigger mobile application study | ④지오펜싱 | 9 | 5 |
| Q3 | sidewalk map matching pedestrian smartphone GNSS accuracy improvement path network snapping | ②맵매칭 | 8 | 4 |
| Q4 | pedestrian dead reckoning smartphone step length heading drift accuracy evaluation short distance | ③센서융합 | 10 | 6 |
| Q5 | outdoor museum park visitor mobile guide GPS location-based wayfinding case study evaluation | ⑤구현사례 | 5 | 3 |
| Q6 | 야외 박물관 과학관 관람객 위치기반 모바일 안내 GPS 정확도 지오펜싱 연구 (국문) | ⑤구현사례 | 7 | 2 |
| Q7 | "Performance Assessment of Geo-triggering in Small Geo-fences" … | ④지오펜싱 | 9 | 3 |
| Q8 | GNSS PDR sensor fusion smartphone outdoor pedestrian accuracy improvement evaluation meters open sky | ③센서융합 | 8 | 5 |
| Q9 | 과학관 박물관 관람객 동선 분석 추적 연구 위치 데이터 (국문) | ⑤구현사례 | 7 | 3 |

## PRISMA 흐름 (검색엔진 후보 기준)

```
검색 반환 후보 (중복 포함)          71
  ↓ 중복 제거                       58
  ↓ 제목·요약 스크리닝              →  배제 34 (사유: 순수 실내 전용 18, 인프라 전제 9,
                                          차량 전용 3, 정확도 수치 없음 4)
최종 포함                           24
  ↓ 그 중 핵심(매트릭스 수록)       13
```

## 포화 판단

Q1–Q9 후반부에서 이미 등장한 문헌(sidewalk matching, PDR 계열, geo-trigger 계열)이 반복 출현.
신규 관련 문헌 유입이 10% 미만으로 떨어져 **1라운드 시점에서 실질적 포화**로 판단.
단, 국내 문헌(RISS·KCI·DBpia)은 WebSearch 로 표면만 훑은 수준이므로 **국내 커버리지는 불완전**하다.
