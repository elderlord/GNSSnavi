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

## 2라운드: Scholar Gateway (2026-08-01 추가)

사용자가 claude.ai 에서 **Scholar Gateway** 커넥터를 연결해, 서버측 실행 경로로 학술 검색이 가능해졌다.
(로컬 MCP 설치는 백엔드 호스트가 모두 차단되어 불가함을 사전 확인: `papersflow.ai`, `serpapi.com`,
`scholar.google.com`, `api.semanticscholar.org`, `arxiv.org` 전부 CONNECT 실패.)

| # | 질의 (자연어) | 하위질문 | 결과/고유문헌 |
|---|---|---|---|
| S1 | 스마트폰 GNSS 의 실현 가능한 수평 정확도, 개활지 vs 부분차폐(수관·상부 구조물) 비교 | ① | 18 / 6 |
| S2 | 반경 50m 미만 소형 지오펜스의 신뢰도, 측정된 오탐률, 반경·체류시간 설계 지침 | ④ | 8 / 8 |
| S3 | 보행로 네트워크 맵매칭이 공원·캠퍼스·문화유산 부지에서 정확도를 개선하는가 | ② | 6 / 5 |
| S4 | 박물관·과학관·식물원·야외 유적의 스마트폰 위치기반 안내 구현과 정확도 문제 | ⑤ | 6 / 6 |

**성과**: 1라운드(WebSearch)에서 "업계 보고"로만 잡혔던 수치의 **동료심사 원출처를 확보**했고,
경로망 기반 보정에 관한 핵심 문헌(Alaoui 2017, Gu 2019, Berjisian 2022)을 새로 발굴했다.

**Scholar Gateway 코퍼스 한계 (중요)**: 반환된 문헌의 DOI 가 전부 `10.1111/`, `10.1002/`,
`10.1049/`, `10.1155/` — 즉 **Wiley·Hindawi·IET 계열에 편중**되어 있다.
GNSS 공학 문헌의 다수가 실리는 **IEEE·MDPI(Sensors)·Springer 는 이 코퍼스에 없다.**
따라서 1라운드 WebSearch 결과(MDPI·Springer 다수)와 **상호보완적으로 읽어야 하며**,
어느 한쪽도 단독으로 전수 조사가 아니다.

## 포화 판단

Q1–Q9 후반부에서 이미 등장한 문헌(sidewalk matching, PDR 계열, geo-trigger 계열)이 반복 출현.
신규 관련 문헌 유입이 10% 미만으로 떨어져 **1라운드 시점에서 실질적 포화**로 판단.
단, 국내 문헌(RISS·KCI·DBpia)은 WebSearch 로 표면만 훑은 수준이므로 **국내 커버리지는 불완전**하다.
