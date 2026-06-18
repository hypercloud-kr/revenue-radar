# Revenue Radar — Backend

공공 공고를 수집해 DB에 저장하고, 공고 1건을 Claude가 판단(Go/Watch/No-go)·제안서 초안·Slack/이메일 공유문으로 바꾸는 서비스의 백엔드.

- **스택**: Node 20 + Express / PostgreSQL 16 / Docker / 배포 EC2(Caddy https)
- **AI**: Claude API(`ANTHROPIC_API_KEY` 있으면 라이브, 없으면 결정적 mock)
- **수집 소스 우선순위**: ① alio(무인증) → ② g2b·kstartup(`DATA_GO_KR_API_KEY`) → ③ kocca(`KOCCA_API_KEY`)

## 빠른 시작 (로컬)

```bash
cp .env.example .env       # 키 없어도 동작(seed/mock + alio 무인증)
docker compose up -d --build
curl localhost:8080/health            # {"status":"ok","db":"up"}
curl localhost:8080/api/opportunities # seed 3건
curl -X POST localhost:8080/api/collect   # alio 실수집
curl localhost:8080/api/stats
```

> 로컬에 다른 Postgres/8080 점유 서비스가 있으면 `docker-compose.yml`의 호스트 포트를 조정.

## API

| 메서드 | 경로 | 역할 |
|---|---|---|
| GET | `/health` | 헬스체크 `{status, db}` |
| GET | `/api/opportunities` | 목록(적합도순). `?decision=Go\|Watch\|No-go` 필터 |
| GET | `/api/opportunities/:id` | 상세 |
| POST | `/api/opportunities/:id/proposal` | Proposal Pack 생성·저장 |
| POST | `/api/collect` | 실제 공고 수집(alio 무인증 포함) |
| GET | `/api/stats` | 퍼널 지표 `{total, byDecision, bySource, closingSoon}` |

## 환경변수

`.env.example` 참고. 키는 백엔드 환경변수로만 주입.

| 키 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | Claude 풀팩 생성(없으면 mock) |
| `DATA_GO_KR_API_KEY` | g2b·kstartup 수집(Decoding Key 원본) |
| `KOCCA_API_KEY` | kocca 수집(선택) |
| `CORS_ORIGIN` | FE 출처 허용(준비 중 `*` → 확정 후 좁히기) |
| `SITE_ADDRESS` | 운영 https 도메인(`<ip-dash>.nip.io`) |

## 배포 (EC2 + GitHub Actions)

- 운영 compose: `docker-compose.prod.yml` (backend + db + Caddy https)
- CI/CD: `.github/workflows/deploy.yml` — main push → EC2에 .env 주입 + rsync + `compose up` + `/health` 스모크
- 필요한 GitHub Secrets: `DATA_GO_KR_API_KEY`, `ANTHROPIC_API_KEY`, `KOCCA_API_KEY`, `POSTGRES_PASSWORD`, `CORS_ORIGIN`, `PROPOSAL_MODEL`, `SITE_ADDRESS`, `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`

## 구조

```
backend/
  src/
    index.js            # Express 앱 + 라우트
    db.js               # pg 풀(DATE→'YYYY-MM-DD' 파서)
    collectors/         # alio·g2b·kstartup + 오케스트레이터
    services/           # scoring(XR 휴리스틱) · generate(Claude/mock)
    util/               # mappers · dates · filters
db/init/                # 01_schema.sql · 02_seed.sql (Postgres 초기화 시 자동 실행)
docker-compose.yml      # 로컬
docker-compose.prod.yml # 운영(+ Caddy)
```
