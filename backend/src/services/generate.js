// Generate 프로바이더 분기: ANTHROPIC_API_KEY 있으면 Claude Messages API(tool_use로 §2 형식 강제),
// 없으면 결정적 mock. 라이브 함정(§2 2단계 모델 전략) 반영:
//  - 모델 claude-sonnet-4-6, max_tokens ≥8192, maxRetries:0, 타임아웃 90초+
//  - tool_use도 max_tokens에 잘림 → stop_reason 'max_tokens'거나 필수 필드 비면 fallback
//  - JSON 파싱 견고화(tool_use면 대부분 예방되나 방어)
import Anthropic from '@anthropic-ai/sdk';
import { generateMock } from './mock.js';

const PROPOSAL_MODEL = process.env.PROPOSAL_MODEL || 'claude-sonnet-4-6';

const COMPANY_CONTEXT = `회사 컨텍스트(공개 가능): HyperCloud.
- 강점: XR/AR/WebXR · 인터랙티브 웹 · 3D 몰입형 · 빠른 프로토타입.
- 주의: 소규모팀 · 하드웨어 중심 회피 · XR 가치 불분명한 장기 SI는 신중.`;

// §2 ProposalPack 형식을 강제하는 tool 스키마(structured output).
const PROPOSAL_TOOL = {
  name: 'emit_proposal_pack',
  description: '공고 판단 결과를 Revenue Radar ProposalPack 형식으로 출력한다.',
  input_schema: {
    type: 'object',
    properties: {
      decision: { type: 'string', enum: ['Go', 'Watch', 'No-go'] },
      confidence: { type: 'integer', minimum: 0, maximum: 100 },
      brief: {
        type: 'object',
        properties: {
          fitRationale: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
          nextAction: { type: 'string' },
        },
        required: ['fitRationale', 'risks', 'nextAction'],
      },
      proposalMarkdown: { type: 'string' },
      slackMessage: { type: 'string' },
      email: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['subject', 'body'],
      },
    },
    required: ['decision', 'confidence', 'brief', 'proposalMarkdown', 'slackMessage', 'email'],
  },
};

function buildPrompt(o) {
  return `다음 공공 공고를 HyperCloud 관점에서 판단하고 ProposalPack을 작성하라.

${COMPANY_CONTEXT}

[공고]
- 제목: ${o.title}
- 발주기관: ${o.institution || '미상'}
- 마감: ${o.deadline || '미정'}
- 예산: ${o.budget || '미상'}
- 지역: ${o.region || '미상'}
- 요약: ${o.summary || o.title}
- 자동 판단(seed): ${o.decisionSeed} / fit ${o.fitScore} / urgency ${o.urgencyScore} / risk ${o.riskScore}
- evidence: ${JSON.stringify(o.evidence || [])}
- requirements: ${JSON.stringify(o.requirements || [])}
- risks: ${JSON.stringify(o.risks || [])}
- missingInfo: ${JSON.stringify(o.missingInfo || [])}

[규칙]
- 모든 판단은 공고 evidence/requirements/risks를 인용한다.
- No-go여도 비우지 말 것: 왜 미추진인지·뭘 지켜볼지·부족 근거를 적는다.
- nextAction = 이번 주 실행 가능한 BD 액션 1개.
- proposalMarkdown 섹션: 0.BD판단 / 1.사업이해 / 2.수행범위 / 3.수행적합성 / 4.리스크·확인필요 / 5.다음단계. (Watch면 "발주처 질의 초안" 추가)
- slackMessage = 5줄 내외. confidence는 0~100 정수.
- 반드시 emit_proposal_pack 도구를 호출해 결과를 출력한다.`;
}

function isComplete(pack) {
  return (
    pack &&
    pack.decision &&
    pack.proposalMarkdown && pack.proposalMarkdown.length > 30 &&
    pack.slackMessage && pack.slackMessage.length > 10 &&
    pack.email && pack.email.subject && pack.email.body &&
    pack.brief && Array.isArray(pack.brief.fitRationale)
  );
}

function deterministicFallback(o) {
  const m = generateMock(o);
  return { ...m, modelUsed: 'deterministic-fallback', fallbackUsed: true };
}

export async function generateProposal(o) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return generateMock(o); // 키 없음 → mock (modelUsed:"mock")
  }

  const client = new Anthropic({
    apiKey,
    maxRetries: 0, // 재시도는 시간만 잡아먹음 — 복구는 fallback이 담당(§2)
    timeout: 120000, // 90초+ (풀팩 실측 40~60초)
  });

  try {
    const resp = await client.messages.create({
      model: PROPOSAL_MODEL,
      max_tokens: 8192, // tool_use도 max_tokens에 잘림 → 넉넉히(§2)
      tools: [PROPOSAL_TOOL],
      tool_choice: { type: 'tool', name: 'emit_proposal_pack' },
      messages: [{ role: 'user', content: buildPrompt(o) }],
    });

    // max_tokens로 잘렸으면 tool input이 중간에 끊겼을 수 있음 → fallback
    if (resp.stop_reason === 'max_tokens') {
      console.warn('[generate] stop_reason=max_tokens → fallback');
      return deterministicFallback(o);
    }

    const toolUse = resp.content.find((c) => c.type === 'tool_use');
    let pack = toolUse?.input;

    // 방어: tool_use가 아닌 text로 왔다면 첫 { ~ 마지막 } 추출 후 파싱
    if (!pack) {
      const text = resp.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
      pack = extractJson(text);
      if (!pack) {
        console.warn('[generate] tool_use/JSON 없음. head:', text.slice(0, 200));
        return deterministicFallback(o);
      }
    }

    if (!isComplete(pack)) {
      console.warn('[generate] 필수 필드 누락 → fallback');
      return deterministicFallback(o);
    }

    return {
      decision: pack.decision,
      confidence: clampInt(pack.confidence),
      modelUsed: PROPOSAL_MODEL,
      fallbackUsed: false,
      brief: pack.brief,
      proposalMarkdown: pack.proposalMarkdown,
      slackMessage: pack.slackMessage,
      email: pack.email,
    };
  } catch (e) {
    // fallbackUsed가 계속 나오면 1순위로 타임아웃 의심(§2)
    console.error('[generate] Claude 호출 실패 → fallback:', e.message);
    return deterministicFallback(o);
  }
}

function clampInt(n) {
  const v = Math.round(Number(n));
  if (Number.isNaN(v)) return 50;
  return Math.max(0, Math.min(100, v));
}

function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
