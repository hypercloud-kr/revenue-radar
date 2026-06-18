// 결정적 mock 생성기 — 키 없을 때도 데모 퀄 유지(§2 mock 규칙).
// 고정 문장 복붙 금지: 공고의 title/score/evidence/missingInfo를 끼워 공고마다 다른 결과.

const COMPANY = 'HyperCloud — XR/AR/WebXR·인터랙티브 웹·3D 몰입형·빠른 프로토타입 강점';

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function decisionLine(decision, o) {
  switch (decision) {
    case 'Go':
      return `착수 가치가 높음 — ${o.title}는 XR/실감형 적합도(${o.fitScore})가 충분. 다만 ${o.missingInfo?.[0] || '범위·예산 세부'} 등 미확인 조건은 착수 전 확인 필요.`;
    case 'Watch':
      return `과업 경계가 모호 — ${o.title}는 적합도(${o.fitScore})는 있으나 ${o.missingInfo?.[0] || 'XR 비중/데이터 연계 범위'}가 불명확. 발주처 질의로 경계를 좁힌 뒤 판단.`;
    default:
      return `추진 보류 — ${o.title}는 적합도(${o.fitScore})·리스크(${o.riskScore}) 기준 우리 강점과 거리가 큼. 시간을 아끼고 유사 후속 공고를 모니터링.`;
  }
}

function buildMarkdown(decision, o, confidence) {
  const ev = (o.evidence || []).map((e) => `- ${e}`).join('\n') || '- (자동 매칭 근거 없음)';
  const rk = (o.risks || []).map((r) => `- ${r}`).join('\n') || '- 특이 리스크 미탐지';
  const mi = (o.missingInfo || []).map((m) => `- ${m}`).join('\n') || '- 추가 확인 필요 항목 없음';

  let md = `# ${o.title}

## 0. BD 판단
${decisionLine(decision, o)} (confidence ${confidence})

## 1. 사업 이해
- 발주: ${o.institution || '미상'} / 마감: ${o.deadline || '미정'} / 예산: ${o.budget || '미상'} / 지역: ${o.region || '미상'}
- 요약: ${o.summary || o.title}

## 2. 수행 범위
- ${COMPANY}
- WebXR/3D 몰입형 콘텐츠 설계 → 빠른 프로토타입 → 현장 검증의 단계적 수행.

## 3. 수행 적합성
${ev}

## 4. 리스크·확인 필요
${rk}

### 확인 필요(missingInfo)
${mi}
`;

  if (decision === 'Watch') {
    md += `
### 발주처 질의 초안
1. ${o.missingInfo?.[0] || 'XR/실감형 콘텐츠의 필수 비중'}은 어느 정도인가요?
2. 하드웨어 납품·설치가 과업에 포함되나요, 콘텐츠 개발 중심인가요?
3. 검수/시연 일정과 산출물 형식 기준이 있나요?
`;
  }

  md += `
## 5. 다음 단계
- ${nextAction(decision, o)}
`;
  return md;
}

function nextAction(decision, o) {
  switch (decision) {
    case 'Go':
      return `이번 주 ${o.institution || '발주처'} 담당자 컨택 + 유사 XR 레퍼런스 1페이지 정리해 제안 의사 타진.`;
    case 'Watch':
      return `이번 주 발주처에 과업 범위 질의 메일 발송(위 질의 초안 활용) 후 회신 기준 재평가.`;
    default:
      return `추진하지 않되, 동일 발주처/유사 키워드 공고를 워치리스트에 등록해 후속 모니터링.`;
  }
}

function buildSlack(decision, o, confidence) {
  const emoji = decision === 'Go' ? '🟢' : decision === 'Watch' ? '🟡' : '⚪';
  return `${emoji} *${decision}* | ${o.title}
• 발주: ${o.institution || '미상'} · 마감: ${o.deadline || '미정'} · 예산: ${o.budget || '미상'}
• 적합도 ${o.fitScore} / 리스크 ${o.riskScore} (confidence ${confidence})
• 근거: ${(o.evidence || [])[0] || '자동 매칭 근거 없음'}
• 다음: ${nextAction(decision, o)}`;
}

export function generateMock(o) {
  const decision = o.decisionSeed || 'No-go';
  const confidence = clamp(o.fitScore * 0.7 + (100 - o.riskScore) * 0.3, 30, 95);

  const fitRationale = (o.evidence && o.evidence.length)
    ? o.evidence.slice()
    : ['자동 키워드 매칭 근거가 약함 — 수동 검토 권장'];

  return {
    decision,
    confidence,
    modelUsed: 'mock',
    fallbackUsed: false,
    brief: {
      fitRationale,
      risks: (o.risks && o.risks.length) ? o.risks.slice() : ['특이 리스크 미탐지'],
      nextAction: nextAction(decision, o),
    },
    proposalMarkdown: buildMarkdown(decision, o, confidence),
    slackMessage: buildSlack(decision, o, confidence),
    email: {
      subject: `[${decision}] ${o.title} — 검토 요약 (confidence ${confidence})`,
      body: `안녕하세요,\n\n${decisionLine(decision, o)}\n\n- 발주: ${o.institution || '미상'}\n- 마감: ${o.deadline || '미정'}\n- 예산: ${o.budget || '미상'}\n- 다음 단계: ${nextAction(decision, o)}\n\n자세한 제안 초안은 첨부 마크다운을 확인 부탁드립니다.\n\n감사합니다.`,
    },
  };
}
