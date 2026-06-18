// kocca(한국콘텐츠진흥원) — KOCCA_API_KEY(별도, '='로 끝나는 형태).
// www.kocca.kr/api/pims/List.do  params: serviceKey, pageNo, numOfRows
// 응답: { INFO: { resultCode, list:[...] } }
// 매핑: title→title, intcNoSeq→id키, endDt(yyyymmdd)→deadline,
//       link(www.kocca.kr/... → https:// 보정)→sourceUrl, content→summary, institution=한국콘텐츠진흥원
// 함정 §4-15: ERROR-* 코드만 throw, INFO-200(검색결과 없음)·빈 list는 break(수집분 유지).
import { normalizeDate } from '../util/dates.js';

const BASE = 'https://www.kocca.kr/api/pims/List.do';

function fixUrl(link) {
  if (!link) return 'https://www.kocca.kr/';
  if (/^https?:\/\//i.test(link)) return link;
  return `https://${link.replace(/^\/+/, '')}`;
}

export async function collectKocca({ pages = 3, numOfRows = 50 } = {}) {
  const key = process.env.KOCCA_API_KEY;
  if (!key) return [];

  const out = [];
  for (let pageNo = 1; pageNo <= pages; pageNo++) {
    // serviceKey는 URLSearchParams로 정확히 1회 인코딩(§5)
    const params = new URLSearchParams({
      serviceKey: key,
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
    });

    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`kocca HTTP ${res.status}`);
    const json = await res.json();

    const info = json?.INFO ?? {};
    const code = info.resultCode;

    // §4-15: ERROR-* 만 throw. INFO-200(검색결과 없음)·빈 list는 종료 신호(수집분 유지).
    if (code && /^ERROR/i.test(code)) {
      throw new Error(`kocca ${code}: ${info.resultMgs || info.resultMsg || ''}`);
    }

    const list = Array.isArray(info.list) ? info.list : [];
    if (code === 'INFO-200' || list.length === 0) break;

    for (const r of list) {
      const seq = r.intcNoSeq;
      const title = r.title;
      if (!seq || !title) continue;
      out.push({
        id: `kocca:${seq}`,
        title: String(title).trim(),
        institution: '한국콘텐츠진흥원',
        sourceCode: 'kocca',
        sourceName: 'KOCCA(콘진원)',
        sourceUrl: fixUrl(r.link),
        deadline: normalizeDate(r.endDt),
        budget: null,
        region: null,
        summary: r.content ?? r.title ?? null,
      });
    }
  }
  return out;
}
