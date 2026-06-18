// §4-9: 결과성/비액션 공고 필터.
// 입찰/모집 목록에 "선정결과·낙찰·당선·계약체결·수상자·결과발표" 류가 섞임 → 액션 불가.
const NON_ACTIONABLE = [
  '선정결과', '선정 결과', '낙찰', '유찰', '당선', '계약체결', '계약 체결',
  '수상자', '결과발표', '결과 발표', '선정공고', '심사결과', '심사 결과',
  '최종선정', '평가결과', '협상적격자', '우선협상', '개찰결과', '입찰결과',
];

export function isActionableTitle(title) {
  if (!title) return false;
  const t = String(title);
  return !NON_ACTIONABLE.some((kw) => t.includes(kw));
}
