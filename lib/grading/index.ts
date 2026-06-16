import { computeRuleScore } from './rules';
import { buildPercentileLookup } from './percentile';
import type { AssessmentResult, Grade, RuleSpec, FieldRule } from './types';
import { FIELD_LABELS } from '@/lib/csv/aliases';

export const DEFAULT_RULE_SPEC: RuleSpec = {
  fields: [
    { field: 'frequencyMhz', min: 380, ideal: 480, max: 540, weight: 0.4 },
    { field: 'leakageNa', max: 60, weight: 0.25 },
    { field: 'vthV', ideal: 0.70, tolerance: 0.06, weight: 0.2 },
    { field: 'iddUa', max: 120, weight: 0.15 },
  ],
  hardReject: [
    { field: 'failCount', greaterThan: 0 },
  ],
  percentileField: 'frequencyMhz',
  percentileWeight: 0.3,
  priceTable: { S: 18, A: 14, B: 10, C: 6, D: 3, FAIL: 0 },
};

function gradeFromScore(score: number): Grade {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

const GRADE_LABEL: Record<Grade, string> = {
  S: '特级 (S)',
  A: '一级 (A)',
  B: '二级 (B)',
  C: '三级 (C)',
  D: '次品 (D)',
  FAIL: '失效 (FAIL)',
};

function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

function fieldUnit(field: string): string {
  switch (field) {
    case 'frequencyMhz': return ' MHz';
    case 'leakageNa': return ' nA';
    case 'iddUa': return ' μA';
    case 'vthV': return ' V';
    case 'powerMw': return ' mW';
    case 'testTempC': return ' °C';
    case 'testVoltageV': return ' V';
    default: return '';
  }
}

function labelOf(field: string): string {
  return (FIELD_LABELS as any)[field] ?? field;
}

// 把一个字段的评分翻译成中文短句
function explainField(rule: FieldRule, value: number | null | undefined, sub: number): string {
  if (value == null) return `${labelOf(rule.field)} 缺值（不参与评分）`;
  const valStr = fmtNum(value, rule.field === 'vthV' ? 3 : 1) + fieldUnit(rule.field);

  if (rule.ideal != null && rule.tolerance != null && rule.tolerance > 0) {
    const dev = Math.abs(value - rule.ideal);
    if (sub >= 85) return `${labelOf(rule.field)} ${valStr}（贴近理想 ${rule.ideal}${fieldUnit(rule.field)}）`;
    if (sub >= 50) return `${labelOf(rule.field)} ${valStr}（与理想偏差 ${dev.toFixed(3)}${fieldUnit(rule.field)}）`;
    return `${labelOf(rule.field)} ${valStr}（明显偏离理想）`;
  }

  const min = rule.min ?? -Infinity;
  const max = rule.max ?? Infinity;
  if (value < min) return `${labelOf(rule.field)} ${valStr}（低于下限 ${min}${fieldUnit(rule.field)}，越界）`;
  if (value > max) return `${labelOf(rule.field)} ${valStr}（超过上限 ${max}${fieldUnit(rule.field)}，越界）`;
  if (sub >= 80) return `${labelOf(rule.field)} ${valStr}（位于规格中段，表现良好）`;
  return `${labelOf(rule.field)} ${valStr}（在规格内，靠近边界）`;
}

function buildRationale(opts: {
  grade: Grade;
  score: number;
  ruleScore: number;
  percentileScore: number;
  perField: { rule: FieldRule; sub: number; value: number | null | undefined }[];
  percentileField: string;
  recommendedPriceCny: number;
}): string {
  const { grade, score, ruleScore, percentileScore, perField, percentileField, recommendedPriceCny } = opts;

  // 1. 关键字段叙述（最多 3 条，按贡献排序）
  const fieldSentences = [...perField]
    .map((p) => ({ ...p, weighted: p.sub * p.rule.weight }))
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 3)
    .map((p) => explainField(p.rule, p.value, p.sub));

  // 2. 总结句
  const summary = `综合 ${score.toFixed(1)} 分（规则项 ${ruleScore.toFixed(0)}/100，批内 ${labelOf(percentileField)} 分位 ${percentileScore.toFixed(0)}），列为 ${GRADE_LABEL[grade]}`;
  // 3. 价格
  const priceLine = recommendedPriceCny > 0
    ? `建议单价 ¥${recommendedPriceCny.toFixed(2)}`
    : '不建议出货';

  return `${fieldSentences.join('；')}。${summary}，${priceLine}。`;
}

function buildFailRationale(opts: {
  field: string;
  value: any;
  op: string;
  threshold: any;
}): string {
  const human = `${labelOf(opts.field)} = ${opts.value}${fieldUnit(opts.field)}（命中硬否决条件 ${opts.op} ${opts.threshold}${fieldUnit(opts.field)}）`;
  return `${human}。该芯片不参与综合评分，直接判为 ${GRADE_LABEL.FAIL}，不建议出货。`;
}

function hardRejectMatch(spec: RuleSpec, chip: Record<string, any>): { field: string; value: any; op: string; threshold: any } | null {
  if (!spec.hardReject) return null;
  for (const r of spec.hardReject) {
    const v = chip[r.field];
    if (r.notEquals != null) {
      // 缺值也算命中（更严格）
      if (v == null || String(v) !== String(r.notEquals)) {
        return { field: r.field, value: v ?? '(空)', op: '≠', threshold: r.notEquals };
      }
      continue;
    }
    if (v == null) continue;
    if (r.greaterThan != null && Number(v) > r.greaterThan) return { field: r.field, value: v, op: '>', threshold: r.greaterThan };
    if (r.lessThan != null && Number(v) < r.lessThan) return { field: r.field, value: v, op: '<', threshold: r.lessThan };
    if (r.equals != null && String(v) === String(r.equals)) return { field: r.field, value: v, op: '=', threshold: r.equals };
  }
  return null;
}

function priceFor(spec: RuleSpec, grade: Grade, score: number): number {
  const base = spec.priceTable[grade] ?? 0;
  if (grade === 'FAIL' || base === 0) return 0;
  const bands: Record<Grade, [number, number]> = {
    S: [90, 100], A: [75, 90], B: [60, 75], C: [45, 60], D: [0, 45], FAIL: [0, 0],
  };
  const [lo, hi] = bands[grade];
  const t = hi > lo ? Math.min(1, Math.max(0, (score - lo) / (hi - lo))) : 0.5;
  const adj = (t - 0.5) * 0.2;
  return Math.round(base * (1 + adj) * 100) / 100;
}

export type AssessOptions = { model?: 'rules+percentile' | 'ml-v1' };

export function assessBatch(
  chips: Record<string, any>[],
  spec: RuleSpec = DEFAULT_RULE_SPEC,
  opts: AssessOptions = {}
): AssessmentResult[] {
  const model = opts.model ?? 'rules+percentile';
  if (model !== 'rules+percentile') {
    throw new Error(`暂未接入模型: ${model}`);
  }

  const percField = spec.percentileField ?? 'frequencyMhz';
  // 接受 string（自动解析数字前缀）
  const toNum = (v: any): number | null => {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string') {
      const m = v.match(/^[\s]*(-?\d+\.?\d*)/);
      if (m) return parseFloat(m[1]);
    }
    return null;
  };
  const lookup = buildPercentileLookup(chips.map((c) => toNum(c[percField])));
  const percWeight = spec.percentileWeight ?? 0.3;
  const ruleWeight = 1 - percWeight;

  return chips.map((chip): AssessmentResult => {
    const reject = hardRejectMatch(spec, chip);
    if (reject) {
      return {
        grade: 'FAIL',
        score: 0,
        ruleScore: 0,
        percentileScore: 0,
        recommendedPriceCny: 0,
        rationale: buildFailRationale(reject),
      };
    }
    const { score: ruleScore, perField } = computeRuleScore(spec.fields, chip);
    const percentileScore = lookup(toNum(chip[percField]));
    const score = ruleScore * ruleWeight + percentileScore * percWeight;
    const grade = gradeFromScore(score);
    const recommendedPriceCny = priceFor(spec, grade, score);

    const rationale = buildRationale({
      grade,
      score,
      ruleScore,
      percentileScore,
      perField: perField.map((p) => ({
        rule: p.rule,
        sub: p.sub,
        value: toNum(chip[p.rule.field]),
      })),
      percentileField: percField,
      recommendedPriceCny,
    });

    return {
      grade,
      score: Math.round(score * 10) / 10,
      ruleScore: Math.round(ruleScore * 10) / 10,
      percentileScore: Math.round(percentileScore * 10) / 10,
      recommendedPriceCny,
      rationale,
    };
  });
}

export * from './types';
