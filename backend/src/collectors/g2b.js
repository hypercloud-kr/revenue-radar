// g2b(나라장터) — DATA_GO_KR_API_KEY 필요(Decoding Key 원본, §4-5).
// 함정 §4-4: 조회기간(inqryBgnDt~inqryEndDt) ≤30일, numOfRows 999.
import { normalizeDate } from '../util/dates.js';

const BASE = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc';

function ymd(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date).replace(/-/g, ''); // YYYYMMDD
}

export async function collectG2b() {
  const key = process.env.DATA_GO_KR_API_KEY;
  if (!key) return []; // 키 없으면 조용히 빈 결과(alio가 안전망)

  const now = new Date();
  const begin = new Date(now.getTime() - 29 * 86400000); // 30일 이내(§4-4)
  const inqryBgnDt = `${ymd(begin)}0000`;
  const inqryEndDt = `${ymd(now)}2359`;

  // §4-5: Decoding Key를 URLSearchParams로 정확히 1회 인코딩.
  const params = new URLSearchParams({
    serviceKey: key,
    type: 'json',
    inqryDiv: '1',
    pageNo: '1',
    numOfRows: '999',
    inqryBgnDt,
    inqryEndDt,
  });

  const res = await fetch(`${BASE}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`g2b HTTP ${res.status}`);
  const json = await res.json();

  const items = json?.response?.body?.items;
  const list = Array.isArray(items) ? items : items ? [items].flat() : [];

  return list
    .filter(Boolean)
    .map((r) => ({
      id: `g2b:${r.bidNtceNo}`,
      title: (r.bidNtceNm || '').trim(),
      institution: r.ntceInsttNm ?? null,
      sourceCode: 'g2b',
      sourceName: 'g2b(나라장터)',
      sourceUrl: r.bidNtceDtlUrl || 'https://www.g2b.go.kr/',
      deadline: normalizeDate((r.bidClseDt || '').slice(0, 10)),
      budget: r.asignBdgtAmt ? `KRW ${r.asignBdgtAmt}` : null,
      region: r.rgnLmtYn === 'Y' ? r.prtcptPsblRgnNm ?? null : null,
      summary: r.bidNtceNm ?? null,
    }))
    .filter((o) => o.id && o.title);
}
