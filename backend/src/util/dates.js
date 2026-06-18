// 날짜 정규화: 'YYYY-MM-DD' · 'YYYY.MM.DD' · 'YYYYMMDD' 등 혼재 →
// 숫자만 추출해 'YYYY-MM-DD'로 통일(Asia/Seoul 기준). 없으면 null.

export function normalizeDate(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 8) return null;
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  // 유효성 가벼운 검증
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${m}-${d}`;
}

// Asia/Seoul 기준 오늘(YYYY-MM-DD)
export function todaySeoul() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // en-CA → YYYY-MM-DD
}

// D-day(오늘 기준 남은 일수). deadline null이면 null.
export function daysUntil(deadline) {
  if (!deadline) return null;
  const today = todaySeoul();
  const a = Date.parse(`${today}T00:00:00+09:00`);
  const b = Date.parse(`${deadline}T00:00:00+09:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

// "마감일 ≥ 오늘" 필터(§4-6). deadline null은 통과(불명확 → 유지).
export function isNotExpired(deadline) {
  if (!deadline) return true;
  return deadline >= todaySeoul();
}
