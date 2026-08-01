# 문헌 매트릭스

**신뢰도 표기**: `원문` = 원문/초록 확인 · `요약` = 검색엔진 요약 기반(원문 미확인, 수치는 재확인 필요)

## A. 스마트폰 GNSS 정확도의 한계 (하위질문 ①)

| # | 문헌 | 유형 | 조건 | 보고 정확도 | 핵심 시사 | 신뢰도 |
|---|---|---|---|---|---|---|
| A1 | Inherent Limitations of Smartphone GNSS Positioning… Dual-Frequency (Sensors, PMC9788430) | 논문 | 스마트폰 단독 | 단일주파수 2DRMS **5.11m** → 이중주파수 **2.0m** | 이중주파수가 실질적 개선을 주지만 여전히 m급 | 요약 |
| A2 | Observation Quality… Dual-Frequency Android Smartphones (PMC8003122) | 논문 | 안드로이드 코드 의사거리 | — | 안드로이드 원시 관측 품질이 전용 수신기보다 **본질적으로 낮음**(안테나·사이클슬립·듀티사이클) | 요약 |
| A3 | Static Autonomous GNSS Positioning… Forest Canopy (PMC8838512) | 논문 | **수관(canopy) 아래** | — | 차폐 환경에서 단일/이중/삼중주파수 비교. **우리 아치 터널과 조건 유사** | 요약 |
| A4 | Comprehensive Analysis of Xiaomi Mi 8 GNSS Antenna (PMC11055102) | 논문 | 기기별 안테나 | — | 기기 간 편차가 커서 **주파수 수만으로 정확도를 일반화할 수 없음** | 요약 |

## B. 맵매칭 — 경로망 제약 (하위질문 ②) ★ 가장 강력한 지렛대

| # | 문헌 | 유형 | 조건 | 보고 정확도 | 핵심 시사 | 신뢰도 |
|---|---|---|---|---|---|---|
| B1 | **Sidewalk matching: a smartphone-based GNSS positioning technique for pedestrians in urban canyons** (Satellite Navigation, 2025) | 논문 | 홍콩 도심 협곡 | **<5m** (기존 >18m) | **단순 보행로 지도 + 스마트폰 센서만**으로 3.6배 개선. 3D 건물모델 불요. 하늘 절반의 위성 가시성으로 도로 어느 쪽인지 판별 + C/N0·방위각 슬라이딩윈도우로 불량 관측 제거 | 요약 |
| B2 | Robust GNSS Shadow Matching for Smartphones in Urban Canyons (2021) | 논문 | 도심 협곡 | — | 위성 차폐 패턴 자체를 위치 단서로 사용 | 요약 |
| B3 | Intelligent Urban Positioning Using Smartphone-Based GNSS and Pedestrian Network | 논문 | 도심 | — | **보행자 경로망**을 제약으로 사용하는 계열 | 요약 |

## C. 센서융합 · 추측항법 (하위질문 ③)

| # | 문헌 | 유형 | 조건 | 보고 정확도 | 핵심 시사 | 신뢰도 |
|---|---|---|---|---|---|---|
| C1 | Step-Detection and Adaptive Step-Length Estimation… (Sensors 16(9):1423, 2016) | 논문 | 보행속도 변화 | 보폭 편차 **<1.5%**, 수평오차 **<1.6m**, 상대오차 **<1.2%** | **단거리에서는 PDR 이 매우 정확** | 요약 |
| C2 | GNSS/PDR 융합 계열 (Remote Sensing 13(8):1567 등) | 논문 | 실외 보행 | 오차 **33.3~71.9% 감소** | 융합의 이득이 실측으로 확인됨 | 요약 |
| C3 | Multi-Phase Fusion… Mass-Market GNSS and MEMS (PMC10099076) | 논문 | 대중형 기기 | 최소 오차 **1.63m** | 소비자 기기로도 m 이하 근접 가능 | 요약 |
| C4 | Context-assisted personalized PDR (2024) | 논문 | 보행 맥락 | 보폭 전략에 따라 오차 **79% 감소**(≈5.01m) | 개인화·보행패턴 적응이 큰 변수 | 요약 |
| C5 | PDR 일반 (다수) | — | 장거리 | — | **드리프트 누적이 병목**. 자력계가 자이로 드리프트를 잡아주지만 **국소 자기간섭에 취약** ← 금속 트러스 조건 | 요약 |

## D. 지오펜싱 신뢰도 (하위질문 ④) ★ 우리 설계에 직접 충돌

| # | 문헌 | 유형 | 조건 | 보고 성능 | 핵심 시사 | 신뢰도 |
|---|---|---|---|---|---|---|
| D1 | **Performance Assessment of Geo-triggering in Small Geo-fences** (Procedia Engineering, 2015) | 논문 | **반경 20~70m 소형 지오펜스**, 실외 | Adaptive 프로파일 신뢰도 100%, **평균 정확도 68.53m** | 소형 지오펜스를 정면으로 다룬 유일한 문헌. **반경 20~70m 에서 위치 정확도가 68m** 라는 건 반경보다 오차가 크다는 뜻 | 요약 |
| D2 | Geofence Index: A Performance Estimator for the Reliability of Proactive LBS (2017) | 논문 | — | — | 지오펜스 신뢰도를 **사전 추정하는 지표** 제안. 설계 단계 검증에 유용 | 요약 |
| D3 | 업계 보고 (Radar.com 등) | 회색 | 도심 | point-and-radius **오탐률 40.2%** | 단순 반경 판정의 실패율이 높음 | 요약 |
| D4 | 업계 가이드 (Android/Esri 등) | 회색 | 일반 | **최소 반경 100m 권장**, dwell 임계 병용 | 업계 관행이 우리보다 훨씬 보수적 | 요약 |

## E. 문화시설 구현사례 (하위질문 ⑤)

| # | 문헌/사례 | 유형 | 대상 | 결과 | 핵심 시사 | 신뢰도 |
|---|---|---|---|---|---|---|
| E1 | **Wayfinding and visitor tracking in museums: accuracy assessments of hybrid positioning services** (V&A London) | 논문 | 박물관 | 하이브리드(WiFi+GPS+셀) 측위가 **길찾기·동선추적에 부적합** 결론 | **부정적 결과**. 측위 정확도를 전제한 설계는 실패했다는 선례 | 요약 |
| E2 | KAIST 한동수 연구팀 — 실내외 통합 GPS 태그 | 사례 | 과학관·박물관·미술관 | 기압+관성으로 **층 탐지**, 위치기반 안내·동선분석 | 국내 사례. 다만 **전용 태그(하드웨어)** 전제 → 우리 범위(인프라 없음) 밖 | 요약 |
| E3 | A Location-Based Mobile Guide for Gamified Exploration… (Springer, 2022) | 논문 | 문화 전시 | — | 위치기반 안내의 **경험 설계** 측면 | 요약 |
| E4 | 전시물 관람률과 관람시간에 따른 과학관 관람 형태 분석 (국립과천과학관, KCI) | 논문 | 국내 과학관 | 영상 관찰 기반 동선 분석 | 국내 동선 연구는 **측위 기술이 아니라 관찰·공간구문** 기반이 주류 | 요약 |
| E5 | 박물관 전시공간구조와 관람객 움직임 예측 / 국립민속박물관 공간구문분석 | 논문 | 국내 박물관 | 위상연계도·공간구문·동선추적 병행 | 위와 동일 — **공간 구조로 동선을 예측**하는 접근 | 요약 |

## 배제 사례 (주요)

| 문헌군 | 배제 사유 |
|---|---|
| Seamless Outdoor-Indoor … GNSS/UWB/IMU Fusion (arXiv 2512.10480) | UWB 앵커 설치 전제 → 인프라 범위 밖 (단 정확도 대조용으로 인용) |
| Loosely Coupled GNSS and UWB with INS | 동일 |
| Blind MuseumTourer, Navigine 실내 내비 사례 | 순수 실내 전용 |
| Low-Cost GNSS Simulators for Indoor Positioning | 실내 시뮬레이터, 주제 불일치 |
| GPS 차량 모니터링·물류 안전 지오펜스 | 차량 전용 |
