import type { FieldRule } from './types';

type ChipRow = Record<string, any>;

// 字段子分：将该字段值映射到 0..100
export function scoreField(rule: FieldRule, value: number | null | undefined): { sub: number; reason: string } | null {
  if (value == null || Number.isNaN(value)) return null;

  // ideal + tolerance 模式：高斯衰减
  if (rule.ideal != null && rule.tolerance != null && rule.tolerance > 0) {
    const dev = Math.abs(value - rule.ideal);
    const ratio = dev / rule.tolerance;
    const sub = Math.max(0, 100 * Math.exp(-ratio * ratio));
    const reason = `${rule.field} 距理想值偏差 ${dev.toFixed(2)}`;
    return { sub, reason };
  }

  // min / max 模式
  const min = rule.min ?? -Infinity;
  const max = rule.max ?? Infinity;
  if (value < min || value > max) {
    return { sub: 0, reason: `${rule.field} 越界 (${value} ∉ [${rule.min ?? '-∞'}, ${rule.max ?? '∞'}])` };
  }
  // 在区间内：靠近中点给高分，靠近边界给低分
  const center = Number.isFinite(min) && Number.isFinite(max) ? (min + max) / 2 : value;
  const half = Number.isFinite(min) && Number.isFinite(max) ? (max - min) / 2 : 1;
  if (half <= 0) return { sub: 100, reason: `${rule.field} 满足规格` };
  const dist = Math.abs(value - center) / half; // 0..1
  const sub = Math.max(0, 100 * (1 - 0.6 * dist)); // 边界 40, 中点 100
  return { sub, reason: `${rule.field} 在规格内` };
}

export function computeRuleScore(rules: FieldRule[], chip: ChipRow): { score: number; perField: { rule: FieldRule; sub: number; reason: string }[] } {
  const perField: { rule: FieldRule; sub: number; reason: string }[] = [];
  let totalWeight = 0;
  let weighted = 0;
  for (const rule of rules) {
    const value = chip[rule.field];
    const s = scoreField(rule, typeof value === 'number' ? value : value != null ? Number(value) : null);
    if (s == null) continue;
    perField.push({ rule, sub: s.sub, reason: s.reason });
    totalWeight += rule.weight;
    weighted += s.sub * rule.weight;
  }
  const score = totalWeight > 0 ? weighted / totalWeight : 0;
  return { score, perField };
}
