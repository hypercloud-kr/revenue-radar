// DB(snake_case) → 응답(camelCase) 변환. §2 Opportunity 형식과 정확히 일치해야 함(FE 의존).

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  // JSONB는 pg가 이미 파싱해서 객체/배열로 줌. 혹시 문자열이면 방어적 파싱.
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function rowToOpportunity(r) {
  return {
    id: r.id,
    title: r.title,
    institution: r.institution,
    sourceCode: r.source_code,
    sourceName: r.source_name,
    sourceUrl: r.source_url,
    deadline: r.deadline, // 이미 'YYYY-MM-DD' 문자열(db.js 파서) 또는 null
    budget: r.budget,
    region: r.region,
    decisionSeed: r.decision_seed,
    fitScore: r.fit_score,
    urgencyScore: r.urgency_score,
    riskScore: r.risk_score,
    summary: r.summary,
    requirements: asArray(r.requirements),
    evidence: asArray(r.evidence),
    risks: asArray(r.risks),
    missingInfo: asArray(r.missing_info),
  };
}

export function rowToProposalPack(r) {
  return {
    decision: r.decision,
    confidence: r.confidence,
    modelUsed: r.model_used,
    fallbackUsed: r.fallback_used,
    brief: r.brief,
    proposalMarkdown: r.proposal_markdown,
    slackMessage: r.slack_message,
    email: r.email,
  };
}
