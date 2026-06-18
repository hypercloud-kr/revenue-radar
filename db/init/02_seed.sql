-- Revenue Radar — demo seed (1단계 ✅ 확인용)
-- ⚠️ source_url에 example.com 같은 가짜 링크 금지(원문 안 열리면 '가짜' 티 남).
--    실수집(POST /api/collect)이 동작하면 데모 전 아래로 제거 권장:
--      DELETE FROM opportunities WHERE source_code = 'demo';

INSERT INTO opportunities
  (id, title, institution, source_code, source_name, source_url, deadline, budget, region,
   decision_seed, fit_score, urgency_score, risk_score, summary,
   requirements, evidence, risks, missing_info)
VALUES
  (
    'demo-go-001',
    'XR 기반 실감형 전시 콘텐츠 구축 용역',
    '한국콘텐츠진흥원',
    'demo', '데모(콘진원)', 'https://www.kocca.kr/',
    '2026-07-10', 'KRW 180,000,000', '서울',
    'Go', 86, 72, 28,
    'XR/WebXR 기반 실감형 전시 콘텐츠를 구축하는 용역. 인터랙티브 3D 몰입형 경험과 빠른 프로토타입이 핵심.',
    '["WebXR 기반 인터랙티브 전시", "3D 몰입형 콘텐츠 제작", "전시관 현장 시연"]'::jsonb,
    '["직접 키워드 매칭: XR, 실감형, 몰입형", "인접 키워드 매칭: 전시콘텐츠, 인터랙티브, 3D"]'::jsonb,
    '["마감까지 3주로 다소 촉박"]'::jsonb,
    '["전시 공간 규모/도면 미공개", "하드웨어(키오스크) 납품 포함 여부 불명"]'::jsonb
  ),
  (
    'demo-watch-001',
    '디지털 트윈 기반 스마트시티 시뮬레이션 플랫폼 구축',
    '국토교통부',
    'demo', '데모(국토부)', 'https://www.molit.go.kr/',
    '2026-08-05', 'KRW 450,000,000', '세종',
    'Watch', 58, 50, 46,
    '디지털 트윈/3D 시뮬레이션 플랫폼 구축. XR 가치는 있으나 장기 SI 성격과 데이터 연계 범위가 불명확.',
    '["디지털 트윈 모델링", "3D 시뮬레이션 엔진 연계", "GIS 데이터 통합"]'::jsonb,
    '["직접 키워드 매칭: 디지털트윈", "인접 키워드 매칭: 3D, 시뮬레이션"]'::jsonb,
    '["장기 SI 성격으로 XR 가치 불분명", "데이터 연계 범위 광범위"]'::jsonb,
    '["요구 데이터 소스 목록 미상", "운영/유지보수 기간 미상"]'::jsonb
  ),
  (
    'demo-nogo-001',
    'CCTV 통합관제센터 영상장비 구매 및 설치',
    '○○시청',
    'demo', '데모(지자체)', 'https://www.g2b.go.kr/',
    '2026-07-01', 'KRW 320,000,000', '부산',
    'No-go', 12, 60, 82,
    '영상장비 구매·설치·유지보수 중심의 하드웨어 사업. XR/콘텐츠 적합도 낮음.',
    '["영상장비 납품", "관제센터 시설 설치", "3년 유지보수"]'::jsonb,
    '["인접 키워드 약매칭 없음 — 하드웨어 중심"]'::jsonb,
    '["장비 구매/설치/유지보수 중심(하드웨어 리스크)", "적합도 매우 낮음"]'::jsonb,
    '["XR/콘텐츠 연계 요소 없음"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
