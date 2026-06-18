// alio(공공기관 경영정보) — 무인증 ✅. 1순위 소스(키 없는 환경에서도 실데이터 보장).
// www.alio.go.kr/occasional/findBidList.json  params: pageNo, type=title
// 매핑: rtitle→title, pname→institution, bidInfoEndDt(yyyy.mm.dd)→deadline, seq→id키
import { normalizeDate } from '../util/dates.js';

const BASE = 'https://www.alio.go.kr/occasional/findBidList.json';

function pickList(json) {
  // 실제 응답: { status, data: { result: [...] } }.
  // 환경에 따라 구조가 달라질 수 있어 객체를 재귀 탐색해 '객체 배열' 중 가장 큰 걸 선택.
  let best = [];
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      if (node.length && typeof node[0] === 'object' && node.length > best.length) best = node;
      node.forEach(walk);
      return;
    }
    Object.values(node).forEach(walk);
  };
  walk(json);
  return best;
}

export async function collectAlio({ pages = 2 } = {}) {
  const out = [];
  for (let pageNo = 1; pageNo <= pages; pageNo++) {
    const url = `${BASE}?pageNo=${pageNo}&type=title`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'RevenueRadar/1.0' },
    });
    if (!res.ok) throw new Error(`alio HTTP ${res.status}`);
    const json = await res.json();
    const list = pickList(json);
    if (!list.length) break;

    for (const r of list) {
      const seq = r.seq ?? r.SEQ ?? r.bidSeq;
      const title = r.rtitle ?? r.title ?? r.bidNm;
      if (!seq || !title) continue;
      out.push({
        id: `alio:${seq}`,
        title: String(title).trim(),
        institution: r.pname ?? r.instNm ?? null,
        sourceCode: 'alio',
        sourceName: 'alio(공공기관)',
        sourceUrl: r.url || r.link || 'https://www.alio.go.kr/',
        deadline: normalizeDate(r.bidInfoEndDt ?? r.endDt ?? r.deadline),
        budget: r.budget ?? null,
        region: r.region ?? null,
        summary: r.content ?? r.rtitle ?? null,
      });
    }
  }
  return out;
}
