-- Revenue Radar — PostgreSQL schema
-- Auto-run on first Postgres init (mounted to /docker-entrypoint-initdb.d).

CREATE TABLE IF NOT EXISTS opportunities (
  id            TEXT PRIMARY KEY,                       -- "{source}:{원본키}" 또는 demo-*
  title         TEXT NOT NULL,
  institution   TEXT,
  source_code   TEXT,                                   -- g2b·kstartup·kocca·alio·demo
  source_name   TEXT,
  source_url    TEXT,
  deadline      DATE,
  budget        TEXT,
  region        TEXT,
  decision_seed TEXT CHECK (decision_seed IN ('Go', 'Watch', 'No-go')),
  fit_score     INTEGER CHECK (fit_score     BETWEEN 0 AND 100),
  urgency_score INTEGER CHECK (urgency_score BETWEEN 0 AND 100),
  risk_score    INTEGER CHECK (risk_score    BETWEEN 0 AND 100),
  summary       TEXT,
  requirements  JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence      JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks         JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_info  JSONB NOT NULL DEFAULT '[]'::jsonb,
  collected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_deadline      ON opportunities (deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_decision_seed ON opportunities (decision_seed);
CREATE INDEX IF NOT EXISTS idx_opportunities_fit_score     ON opportunities (fit_score DESC);

CREATE TABLE IF NOT EXISTS proposals (
  id                SERIAL PRIMARY KEY,
  opportunity_id    TEXT REFERENCES opportunities(id) ON DELETE CASCADE,
  decision          TEXT,
  confidence        INTEGER,
  model_used        TEXT,                               -- claude-* · mock · deterministic-fallback
  fallback_used     BOOLEAN NOT NULL DEFAULT false,
  brief             JSONB,                              -- { fitRationale, risks, nextAction }
  proposal_markdown TEXT,
  slack_message     TEXT,
  email             JSONB,                              -- { subject, body }
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_opportunity_id ON proposals (opportunity_id);
