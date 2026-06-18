// §5 XR 관련도 휴리스틱 점수 규칙.
// - 직접/인접/하드웨어 키워드 매칭으로 fit/urgency/risk + decision 산출.
// - 영어 토큰(AR/VR/XR/MR/3D)은 단어 경계 매칭(§4-10, STAR→AR 오탐 방지),
//   한글은 부분 문자열 매칭.
import { daysUntil } from '../util/dates.js';

// 영어 토큰은 \b 경계, 한글 토큰은 includes
const DIRECT_KO = ['메타버스', '실감형', '실감', '가상현실', '증강현실', '혼합현실', '디지털트윈', '디지털 트윈', '홀로그램', '몰입형'];
const DIRECT_EN = ['XR', 'AR', 'VR', 'MR'];

const ADJACENT_KO = ['인터랙티브', '미디어아트', '디지털콘텐츠', '디지털 콘텐츠', '전시콘텐츠', '전시 콘텐츠', '체험관', '시뮬레이션', '가상전시', '가상 전시'];
const ADJACENT_EN = ['3D'];

const HARDWARE_KO = ['장비', '구매', '설치', '납품', '유지보수', '시설공사', '시설 공사'];

function countKoMatches(text, list) {
  const hits = [];
  for (const kw of list) {
    if (text.includes(kw)) hits.push(kw);
  }
  return hits;
}

function countEnMatches(text, list) {
  const hits = [];
  for (const kw of list) {
    // 단어 경계 매칭 — STAR→AR, 3D는 숫자+문자라 lookaround로 경계 처리
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(kw)}(?![A-Za-z0-9])`, 'i');
    if (re.test(text)) hits.push(kw);
  }
  return hits;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/**
 * 공고 텍스트(title + summary 등)로 점수/판단 산출.
 * @returns {{fitScore, urgencyScore, riskScore, decisionSeed, evidence[], risks[]}}
 */
export function scoreOpportunity({ title = '', summary = '', deadline = null }) {
  const text = `${title} ${summary}`;

  const directHits = [...countKoMatches(text, DIRECT_KO), ...countEnMatches(text, DIRECT_EN)];
  const adjacentHits = [...countKoMatches(text, ADJACENT_KO), ...countEnMatches(text, ADJACENT_EN)];
  const hardwareHits = countKoMatches(text, HARDWARE_KO);

  const directCount = directHits.length;
  const adjacentCount = adjacentHits.length;
  const hardwareCount = hardwareHits.length;

  // fitScore = 직접×38 + 인접×20 (상한 100)
  const fitScore = clamp(directCount * 38 + adjacentCount * 20, 0, 100);

  // 마감 임박도
  const dday = daysUntil(deadline);
  const closingSoon = dday != null && dday <= 7;
  let urgencyScore;
  if (dday == null) urgencyScore = 30;
  else if (dday <= 7) urgencyScore = 90;
  else if (dday <= 14) urgencyScore = 72;
  else if (dday <= 30) urgencyScore = 50;
  else urgencyScore = 30;

  // risk: 하드웨어수×18 + 마감임박15 + 저적합20
  const lowFit = fitScore < 30;
  const riskScore = clamp(hardwareCount * 18 + (closingSoon ? 15 : 0) + (lowFit ? 20 : 0), 0, 100);

  // decision: 직접 1+ & risk<50 → Go / fit≥30 → Watch / 그 외 No-go
  let decisionSeed;
  if (directCount >= 1 && riskScore < 50) decisionSeed = 'Go';
  else if (fitScore >= 30) decisionSeed = 'Watch';
  else decisionSeed = 'No-go';

  const evidence = [];
  if (directHits.length) evidence.push(`직접 키워드 매칭: ${directHits.join(', ')}`);
  if (adjacentHits.length) evidence.push(`인접 키워드 매칭: ${adjacentHits.join(', ')}`);

  const risks = [];
  if (hardwareCount > 0) risks.push(`하드웨어 성격 키워드 감지: ${hardwareHits.join(', ')}`);
  if (closingSoon) risks.push('마감 임박(D-7 이내)');
  if (lowFit) risks.push('XR 적합도 낮음(fit<30)');

  return {
    fitScore,
    urgencyScore,
    riskScore,
    decisionSeed,
    evidence,
    risks,
    // 직접·인접 0이면 제외 신호
    relevant: directCount > 0 || adjacentCount > 0,
  };
}
