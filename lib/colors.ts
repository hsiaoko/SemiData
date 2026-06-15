// 等级 / BIN → 颜色映射 — 同时供 Server / Client / PDF 使用
export const GRADE_COLORS: Record<string, string> = {
  S: '#1B4FE3', A: '#3FAE6B', B: '#E8A53C', C: '#C24A4A', D: '#8E5BAB', FAIL: '#5A5A60',
  BIN1: '#1B4FE3', BIN2: '#3FAE6B', BIN3: '#E8A53C', BIN4: '#C24A4A', BIN5: '#5A5A60',
};

export function gradeColor(grade: string | null | undefined): string {
  if (!grade) return '#C9C5BB';
  return GRADE_COLORS[grade] ?? '#C9C5BB';
}
