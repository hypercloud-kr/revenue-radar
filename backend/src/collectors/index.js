// 수집 오케스트레이터: 여러 소스를 Promise.allSettled로 병렬 호출(한 소스 실패해도 계속),
// §5 점수 규칙으로 decision/fit/urgency/risk 부여 → DB upsert.
import { query } from '../db.js';
import { collectAlio } from './alio.js';
import { collectG2b } from './g2b.js';
import { collectKstartup } from './kstartup.js';
import { collectKocca } from './kocca.js';
import { scoreOpportunity } from '../services/scoring.js';
import { isActionableTitle } from '../util/filters.js';
import { isNotExpired } from '../util/dates.js';

const SOURCES = [
  // alio는 키워드 필터가 없어 최근 공고만 반환 → 페이지를 넓게 잡아 적합 건 포착 확률을 높임.
  { name: 'alio', fn: () => collectAlio({ pages: 8 }) },
  { name: 'g2b', fn: collectG2b },
  { name: 'kstartup', fn: collectKstartup },
  { name: 'kocca', fn: () => collectKocca({ pages: 3 }) },
];

const UPSERT_SQL = `
  INSERT INTO opportunities
    (id, title, institution, source_code, source_name, source_url, deadline, budget, region,
     decision_seed, fit_score, urgency_score, risk_score, summary,
     requirements, evidence, risks, missing_info, collected_at)
  VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb, now())
  ON CONFLICT (id) DO UPDATE SET
    title=EXCLUDED.title, institution=EXCLUDED.institution,
    source_name=EXCLUDED.source_name, source_url=EXCLUDED.source_url,
    deadline=EXCLUDED.deadline, budget=EXCLUDED.budget, region=EXCLUDED.region,
    decision_seed=EXCLUDED.decision_seed, fit_score=EXCLUDED.fit_score,
    urgency_score=EXCLUDED.urgency_score, risk_score=EXCLUDED.risk_score,
    summary=EXCLUDED.summary, requirements=EXCLUDED.requirements,
    evidence=EXCLUDED.evidence, risks=EXCLUDED.risks, missing_info=EXCLUDED.missing_info,
    collected_at=now()
`;

export async function runCollect() {
  const settled = await Promise.allSettled(SOURCES.map((s) => s.fn()));

  const raw = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      raw.push(...r.value);
    } else {
      console.error(`[collect] ${SOURCES[i].name} 실패:`, r.reason?.message || r.reason);
    }
  });

  const received = raw.length;

  // 필터: 결과성 공고 제외(§4-9) + 마감 지난 공고 제외(§4-6)
  const candidates = raw.filter((o) => isActionableTitle(o.title) && isNotExpired(o.deadline));

  let upserted = 0;
  const scored = [];
  for (const o of candidates) {
    const s = scoreOpportunity({ title: o.title, summary: o.summary || '', deadline: o.deadline });
    if (!s.relevant) continue; // 직접·인접 0이면 제외(§5)
    scored.push({ ...o, ...s });
  }

  const relevant = scored.length;

  for (const o of scored) {
    try {
      await query(UPSERT_SQL, [
        o.id,
        o.title,
        o.institution,
        o.sourceCode,
        o.sourceName,
        o.sourceUrl,
        o.deadline,
        o.budget,
        o.region,
        o.decisionSeed,
        o.fitScore,
        o.urgencyScore,
        o.riskScore,
        o.summary,
        JSON.stringify([]), // requirements (triage 단계에선 빈 배열)
        JSON.stringify(o.evidence),
        JSON.stringify(o.risks),
        JSON.stringify([]), // missing_info
      ]);
      upserted += 1;
    } catch (e) {
      console.error(`[collect] upsert 실패 ${o.id}:`, e.message);
    }
  }

  return { received, relevant, upserted };
}
