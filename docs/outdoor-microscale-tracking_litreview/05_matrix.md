# 문헌 매트릭스

**출처 표기**: `SG` = Scholar Gateway(동료심사, DOI 확인) · `WS` = WebSearch 요약(원문 미확인, 수치 재확인 필요)

> **코퍼스 편중 주의**: SG 는 Wiley·Hindawi·IET 계열에 편중되어 IEEE·MDPI·Springer 를 포함하지 않는다.
> WS 는 그쪽을 잡지만 서지정보가 부정확하다. 두 줄기를 상호보완으로 읽을 것.

---

## A. 스마트폰 GNSS 정확도의 한계 (하위질문 ①)

| # | 문헌 | 조건 | 보고 정확도 | 핵심 시사 | 출처 |
|---|---|---|---|---|---|
| **A1** | Osborne, Mossman, Caporn & Coulthard (2025). *Comparing the accuracy and precision of smartphone and specialist handheld GNSS receivers for use in ecological fieldwork.* Ecological Solutions and Evidence. DOI `10.1002/2688-8319.70015` (OA) | 개활지, 스마트폰 내장 GNSS vs 전용 수신기 | **중앙값 0.9–3.4m (개활지)** | 최적 조건 기준선. **반복 측정 간 변동이 오차의 주요 원인**이라고 명시 — 우리가 같은 지점을 재측정해 비교한 방식이 타당함을 뒷받침 | SG |
| **A2** | Gao, H. & Groves, P. D. (2018). *Environmental Context Detection for Adaptive Navigation using GNSS Measurements from a Smartphone.* NAVIGATION 65(1). DOI `10.1002/navi.221` | 환경 유형별 | 개활지 **<3m** / 중간(intermediate) **~30m** / 얕은 실내 수십 m / 깊은 실내 수신 불가 | ★ **GNSS 관측값만으로 환경 맥락을 분류**하는 방법 제시. "신호 열화를 진입 신호로 쓸 수 있나"에 대한 직접적 선행연구 | SG |
| **A3** | Schofield et al. (2026). *A Study of Standalone GNSS Positioning Precision in Covered Agricultural Environments: ETFE Polytunnels Versus Glass Greenhouses.* IET Radar, Sonar & Navigation. DOI `10.1049/rsn2.70130` (OA) | **덮개 구조물 아래** | (구조물 재질별 비교) | ★ **상부 구조물이 덮인 실외** — 우리 볼트러스 아치 터널과 조건이 가장 가까운 실측 | SG |
| **A4** | Li, T., Cao, Y. & McKenzie, G. (2026). *A Multi-Scale Approach to Assessing Positioning Accuracy in High-Density Urban Environments of Hong Kong.* Transactions in GIS. DOI `10.1111/tgis.70195` (OA) | 도심 32개 경로 | 다중기기 측정으로 **7.52% 개선** | 건물 높이 20m 이상·100m 버퍼 내 지형이 오차와 강한 연관. **전통적 GNSS 지표의 예측력은 낮음(R²=0.02)** | SG |
| A5 | Zandbergen & Barbeau (2011), Yoo et al. (2020) DOI `10.1111/tgis.12612` 에서 재인용 | 휴대폰 하이브리드 측위 | <30m (2011) / **시간대·장소 유형에 따라 1km 초과 가능** (2020) | 하이브리드(셀·WiFi 혼합) 측위의 꼬리 위험이 매우 큼 | SG |
| A6 | Inherent Limitations of Smartphone GNSS… Dual-Frequency (Sensors) | 단일 vs 이중주파수 | 2DRMS **5.11m → 2.0m** | 이중주파수 이득은 실재하나 기기 편차가 큼 | WS |

## B. 경로망 제약 · 맵매칭 (하위질문 ②) ★ 최대 지렛대

| # | 문헌 | 조건 | 보고 성능 | 핵심 시사 | 출처 |
|---|---|---|---|---|---|
| **B1** | **Alaoui, F. T., Betaille, D., Renaudin, V. & Fischione, C. (2017). *Pedestrian Dead Reckoning Navigation with the Help of A\*-Based Routing Graphs in Large Unconstrained Spaces.* Wireless Communications and Mobile Computing. DOI `10.1155/2017/7951346` (OA)** | **넓은 개방 공간**, 휴대형 기기, 실내외 연속 | **평균 오차 3–5m**. 비보조 PDR 의 드리프트 **8% → 거의 0** | ★★ **이번 조사 최대 수확.** 라우팅 그래프로 ①자이로 드리프트 보정 ②보폭 모델 교정 ③기기 지향과 보행방향의 어긋남 추정을 동시에 해결. 우리가 걱정한 자기간섭 문제를 **경로망으로 우회** | SG |
| **B2** | Gu, Y., Li, D., Kamiya, Y. & Kamijo, S. (2019). *Integration of positioning and activity context information for lifelog in urban city area.* NAVIGATION 67(1). DOI `10.1002/navi.343` | 도심 실내외 | **실외 3.1m / 실내 평균 2.2m** | 행동 맥락(회전·신호대기·출입구 통과)을 HMM 으로 2D 지도와 정합. **"행동을 지도에 맞춘다"** 는 발상 | SG |
| **B3** | Berjisian, E. & Bigazzi, A. (2022). *Evaluation of map-matching algorithms for smartphone-based active travel data.* IET Intelligent Transport Systems 17(1), 227–242. DOI `10.1049/itr2.12250` (OA) | **보행·자전거** 궤적 63개 | 정확도 **70–90%**, 최우수 PgMapMatch | ⚠ **실패 모드 경고**: 역방향 통행, 네트워크 누락 링크, **같은 길의 평행 시설**. 또 "외부 검증은 개발자 보고보다 항상 나쁘다(과적합)" | SG |
| B4 | Yu, L. et al. (2022). *Map-Matching on Low Sampling Rate Trajectories through Frequent Pattern Mining.* Scientific Programming. DOI `10.1155/2022/3107779` (OA) | 저샘플링 궤적 | — | 샘플이 성기면 최단경로 가정이 깨진다 — 우리처럼 1초 간격이면 해당 없음 | SG |
| B5 | Sidewalk matching (Satellite Navigation, 2025) | 홍콩 도심 협곡 | **>18m → <5m** | 위성 방위각·C/N0 원시 관측 필요 → **브라우저 불가**. 경로망 제약 부분만 차용 가능 | WS |

## C. 센서융합 · 추측항법 (하위질문 ③)

| # | 문헌 | 조건 | 보고 성능 | 핵심 시사 | 출처 |
|---|---|---|---|---|---|
| C1 | Alaoui et al. (2017) — B1 과 동일 | 비보조 PDR | 드리프트 **8%** | 경로망 없이 PDR 만 쓰면 100m 당 8m 씩 벌어진다는 구체 수치 | SG |
| C2 | Step-Detection and Adaptive Step-Length Estimation (Sensors 16(9):1423, 2016) | 보행속도 변화 | 보폭 편차 <1.5%, 수평오차 <1.6m | 단거리 PDR 은 정확 | WS |
| C3 | PDR 일반 | 장거리 | — | 드리프트 누적이 병목. **자력계는 국소 자기간섭에 취약** ← 금속 트러스 | WS |

## D. 지오펜싱 신뢰도 (하위질문 ④) ★ 우리 설계와 직접 충돌

| # | 문헌 | 조건 | 보고 성능 | 핵심 시사 | 출처 |
|---|---|---|---|---|---|
| **D1** | **Wray, T. B., Pérez, A. E., Celio, M. A., Carr, D. J., Adia, A. C. & Monti, P. M. (2019). *Exploring the Use of Smartphone Geofencing to Study Characteristics of Alcohol Drinking Locations…* Alcoholism: Clinical and Experimental Research 43(5), 900–906. DOI `10.1111/acer.13991`** | 도심(Providence·Boston) 술집 지오펜스, 30일 EMA, N=76 | **전체 위치기반 설문 175건 중 40.2% 가 의도한 장소가 아닌 곳에서 발생** | ★ **1라운드에서 "업계 보고"로 잘못 귀속했던 40.2% 의 동료심사 원출처.** 저자 결론: *"측위 정밀도가 개선될 때까지 지오펜스는 신중히 사용해야 한다"* | SG |
| **D2** | Farine, D. R., Penndorf, J., Bolcato, S., Nyaguthii, B. & Aplin, L. M. (2024). *Low-cost animal tracking using Bluetooth low energy beacons on a crowd-sourced network.* Methods in Ecology and Evolution 15(12). DOI `10.1111/2041-210X.14433` (OA) | Find My 네트워크 실측 | 보고 정확도와 실제 오차는 **지수 관계**. 임계 80m → 100m 초과 오차 확률 15%. 도로 인접 비콘은 150m 초과 오차 21–33%, 도로에서 먼 곳은 5–8% | ★ **"보고된 accuracy 로 걸러내면 큰 오차를 줄일 수 있다"** 를 실측으로 보인 문헌 — 우리 정확도 게이트·적응형 반경의 직접적 근거. 단 **표본 수가 줄어드는 트레이드오프**도 명시 | SG |
| **D3** | Lanir, J., Bak, P. & Kuflik, T. (2014). *Visualizing Proximity-Based Spatiotemporal Behavior of Museum Visitors using Tangram Diagrams.* Computer Graphics Forum 33(3), 261–270. DOI `10.1111/cgf.12382` | Hecht 박물관, RF 비콘 45개 | — | ★ 노이즈 제거에 **슬라이딩 윈도우 + 진입 임계 A / 이탈 임계 B (A>B)** 사용 = **우리 히스테리시스와 동일한 구조**를 10년 전 박물관에서 이미 씀. 또한 비콘 근접식의 약점: **비콘 사이 이동 구간을 알 수 없어 궤적이 끊긴다** | SG |
| D4 | Zoest, V., Buul, J., Osei, F. & Stein, A. (2021). *A note on the propagation of positional uncertainty in environmental models.* Transactions in GIS 25(6). DOI `10.1111/tgis.12809` (OA) | 격자 기반 모델 | 자기상관 낮을 때 RMSE 7% vs 높을 때 1% | 위치 불확실성이 **하류 판단으로 전파**된다는 일반 원리 + 확률적 보정법 | SG |
| D5 | Zhao, Z. et al. (2018). *Identifying stops from mobile phone location data by introducing uncertain segments.* Transactions in GIS 22(4). DOI `10.1111/tgis.12332` | 휴대폰 위치 이력 | 정확도·재현율 **15·19% 향상** | 신호 점프가 만드는 **"가짜 이동"** 을 불확실 구간으로 모델링해 걸러냄 — 정지/이동 판별에 참고 | SG |

## E. 문화시설 구현사례 (하위질문 ⑤)

| # | 문헌 | 대상 | 결과 | 핵심 시사 | 출처 |
|---|---|---|---|---|---|
| **E1** | **Othman, M. K., Idris, K. I., Aman, S., Talwar, P. & Bellotti, F. (2018). *An Empirical Study of Visitors' Experience at Kuching Orchid Garden with Mobile Guide Application.* Advances in Human-Computer Interaction. DOI `10.1155/2018/5740520` (OA)** | **야외 난 정원**, N=114, 3집단 비교 | 모바일 가이드가 지식·학습에 효과. 그러나 **"물리 환경과 디지털 환경의 매핑 부정확 때문에 정보를 적시에 매끄럽게 제공하는 데 한계"** | ★ **야외 문화시설에서 위치 정확도가 곧 한계**임을 실증. 저자는 BLE 비콘을 대안으로 제안 | SG |
| **E2** | Farnham, T. (2015). *Performance optimisation for visitor information systems using smart sensors and analysis of trial data.* IET Networks 4(6), 329–337. DOI `10.1049/iet-net.2015.0007` | 관광시설 2곳 실증 | — | ★ **실용 기법**: 가속도계로 **기기 자세(평평/수직)를 판별해 raw GPS 를 필터링**하면 측위 정밀도가 개선됨. GPS 취약 지점만 iBeacon 으로 보완하고 임계값으로 전환 | SG |
| E3 | Marques, D. & Costello, R. (2018). *Concerns and Challenges Developing Mobile AR Experiences for Museum Exhibitions.* Curator 61(4). DOI `10.1111/cura.12279` | 스미소니언 자연사박물관 | — | 기술 도입 우려(주의분산·과시성)는 상당수 근거 없음. 다만 **소형 화면 인지부하**는 실재 | SG |
| E4 | Wayfinding and visitor tracking in museums (V&A London) | 박물관 | 하이브리드 측위가 **길찾기·동선추적에 부적합** | 부정적 선례 | WS |
| E5 | 전시물 관람률·관람시간 분석(국립과천과학관, KCI) / 국립민속박물관 공간구문분석 | 국내 | 관찰·공간구문 기반 | 국내 동선 연구는 측위 기술 기반이 아님 | WS |

## 배제 사례

| 문헌군 | 사유 |
|---|---|
| UWB/BLE 앵커 설치 전제 (arXiv GNSS/UWB/IMU 융합 등) | 인프라 범위 밖 (정확도 대조용 인용만 허용) |
| Amira & Lazhar (2025) 차량 네트워크 측위 `10.1002/dac.6139` | 차량 전용 |
| Arora & Deswal (2024) UAV 지오펜스 `10.1002/dac.6035` | 무인기 전용, 보행자 무관 |
| Basalamah (2016) BLE 크라우드센싱 `10.1049/joe.2016.0062` | 지오펜스는 트리거 용도로만 언급, 정확도 미보고 |
| Sutton (2018) 대학 마케팅 지오펜싱 `10.1002/emt.30402` | 광고 타겟팅, 정확도와 무관 |
| Teasdale & Garibay (2025), Asquith et al. (2020) | 주제 불일치(검색 노이즈) |
