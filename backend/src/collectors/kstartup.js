// kstartup — DATA_GO_KR_API_KEY 필요.
// 함정 §4-12: 진행중 필터는 cond[rcrt_prgs_yn::EQ]=Y (rcpt_prgs_yn 오기 시 조용히 0건).
import { normalizeDate } from '../util/dates.js';

const BASE = 'https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01';

function pbancSnFromUrl(url) {
  if (!url) return null;
  const m = String(url).match(/pbancSn=(\d+)/i);
  return m ? m[1] : null;
}

export async function collectKstartup({ maxPages = 5, perPage = 100 } = {}) {
  const key = process.env.DATA_GO_KR_API_KEY;
  if (!key) return [];

  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      serviceKey: key,
      returnType: 'json',
      page: String(page),
      perPage: String(perPage),
      'cond[rcrt_prgs_yn::EQ]': 'Y', // §4-12 정확한 키
    });

    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`kstartup HTTP ${res.status}`);
    const json = await res.json();

    const list = Array.isArray(json?.data) ? json.data : [];
    if (!list.length) break;

    for (const r of list) {
      const url = r.detl_pg_url ?? null;
      const sn = pbancSnFromUrl(url) ?? r.pbanc_sn ?? null;
      const id = sn ? `kstartup:${sn}` : null;
      if (!id) continue;
      out.push({
        id,
        title: (r.biz_pbanc_nm || '').trim(),
        institution: r.sprv_inst ?? r.pbanc_ntrp_nm ?? null,
        sourceCode: 'kstartup',
        sourceName: 'K-Startup',
        sourceUrl: url || 'https://www.k-startup.go.kr/',
        deadline: normalizeDate(r.pbanc_rcpt_end_dt),
        budget: null,
        region: r.supt_regin ?? null,
        summary: r.pbanc_ctnt ?? r.biz_pbanc_nm ?? null,
      });
    }

    const matchCount = Number(json?.matchCount || json?.totalCount || 0);
    if (page * perPage >= matchCount) break; // 마지막 페이지
  }

  return out.filter((o) => o.id && o.title);
}
