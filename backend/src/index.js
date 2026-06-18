import express from 'express';
import cors from 'cors';
import { query, ping } from './db.js';
import { rowToOpportunity, rowToProposalPack } from './util/mappers.js';
import { runCollect } from './collectors/index.js';
import { generateProposal } from './services/generate.js';
import { todaySeoul } from './util/dates.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS(§4-7,13): 운영 출처(CORS_ORIGIN)는 정확히 허용 + Replit 미리보기(*.replit.dev) 허용.
const corsOrigin = process.env.CORS_ORIGIN || '*';
if (corsOrigin === '*') {
  app.use(cors({ origin: true }));
} else {
  const allowList = corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);
  // 개발/스테이징 미리보기(*.replit.dev)에서도 실데이터 확인 가능하게 서브도메인 허용.
  const allowHostSuffixes = ['.replit.dev'];
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true); // curl·서버사이드 등 origin 없는 요청 허용
        if (allowList.includes(origin)) return cb(null, true);
        try {
          const host = new URL(origin).hostname;
          if (allowHostSuffixes.some((suf) => host === suf.slice(1) || host.endsWith(suf))) {
            return cb(null, true);
          }
        } catch {
          /* 잘못된 origin은 차단 */
        }
        return cb(null, false);
      },
    })
  );
}

// --- 헬스체크 ---
app.get('/health', async (_req, res) => {
  let db = 'down';
  try {
    if (await ping()) db = 'up';
  } catch {
    db = 'down';
  }
  res.json({ status: 'ok', db });
});

// --- 목록(적합도순). ?decision=Go|Watch|No-go 필터 ---
app.get('/api/opportunities', async (req, res, next) => {
  try {
    const { decision } = req.query;
    const params = [];
    let where = '';
    if (decision && ['Go', 'Watch', 'No-go'].includes(decision)) {
      params.push(decision);
      where = 'WHERE decision_seed = $1';
    }
    const { rows } = await query(
      `SELECT * FROM opportunities ${where} ORDER BY fit_score DESC NULLS LAST, deadline ASC NULLS LAST`,
      params
    );
    const opportunities = rows.map(rowToOpportunity);
    res.json({ count: opportunities.length, opportunities });
  } catch (e) {
    next(e);
  }
});

// --- 상세 ---
app.get('/api/opportunities/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM opportunities WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rowToOpportunity(rows[0]));
  } catch (e) {
    next(e);
  }
});

// --- Proposal Pack 생성(저장) ---
app.post('/api/opportunities/:id/proposal', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM opportunities WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    const opp = rowToOpportunity(rows[0]);

    const pack = await generateProposal(opp);

    await query(
      `INSERT INTO proposals
        (opportunity_id, decision, confidence, model_used, fallback_used,
         brief, proposal_markdown, slack_message, email)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb)`,
      [
        opp.id,
        pack.decision,
        pack.confidence,
        pack.modelUsed,
        pack.fallbackUsed,
        JSON.stringify(pack.brief),
        pack.proposalMarkdown,
        pack.slackMessage,
        JSON.stringify(pack.email),
      ]
    );

    res.json(pack);
  } catch (e) {
    next(e);
  }
});

// --- 실제 공고 수집(alio 무인증 포함) ---
app.post('/api/collect', async (_req, res, next) => {
  try {
    const result = await runCollect();
    res.json(result); // { received, relevant, upserted }
  } catch (e) {
    next(e);
  }
});

// --- 퍼널 지표 ---
app.get('/api/stats', async (_req, res, next) => {
  try {
    const today = todaySeoul();
    const { rows } = await query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE decision_seed = 'Go')::int    AS go,
         COUNT(*) FILTER (WHERE decision_seed = 'Watch')::int AS watch,
         COUNT(*) FILTER (WHERE decision_seed = 'No-go')::int AS nogo,
         COUNT(*) FILTER (WHERE deadline IS NOT NULL
                            AND deadline >= $1::date
                            AND deadline <= ($1::date + INTERVAL '7 day'))::int AS closing_soon
       FROM opportunities`,
      [today]
    );
    const { rows: bySourceRows } = await query(
      `SELECT source_code, COUNT(*)::int AS n FROM opportunities GROUP BY source_code`
    );
    const r = rows[0];
    const bySource = {};
    bySourceRows.forEach((s) => {
      bySource[s.source_code || 'unknown'] = s.n;
    });
    res.json({
      total: r.total,
      byDecision: { Go: r.go, Watch: r.watch, 'No-go': r.nogo },
      bySource,
      closingSoon: r.closing_soon,
    });
  } catch (e) {
    next(e);
  }
});

// 에러 핸들러
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'internal error' });
});

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Revenue Radar backend listening on :${PORT} (CORS=${corsOrigin})`);
});
