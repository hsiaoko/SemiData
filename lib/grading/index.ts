import { computeRuleScore } from './rules';
import { buildPercentileLookup } from './percentile';
import type { AssessmentResult, Grade, RuleSpec } from './types';

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

function hardRejected(spec: RuleSpec, chip: Record<string, any>): string | null {
  if (!spec.hardReject) return null;
  for (const r of spec.hardReject) {
    const v = chip[r.field];
    if (v == null) continue;
    if (r.greaterThan != null && Number(v) > r.greaterThan) return `${r.field} > ${r.greaterThan}`;
    if (r.lessThan != null && Number(v) < r.lessThan) return `${r.field} < ${r.lessThan}`;
    if (r.equals != null && v === r.equals) return `${r.field} = ${r.equals}`;
  }
  return null;
}

function priceFor(spec: RuleSpec, grade: Grade, score: number): number {
  const base = spec.priceTable[grade] ?? 0;
  if (grade === 'FAIL' || base === 0) return 0;
  // 同等级内按 score 在 ±10% 区间微调
  const bands: Record<Grade, [number, number]> = {
    S: [90, 100],
    A: [75, 90],
    B: [60, 75],
    C: [45, 60],
    D: [0, 45],
    FAIL: [0, 0],
  };
  const [lo, hi] = bands[grade];
  const t = hi > lo ? Math.min(1, Math.max(0, (score - lo) / (hi - lo))) : 0.5;
  const adj = (t - 0.5) * 0.2; // -0.1..+0.1
  return Math.round(base * (1 + adj) * 100) / 100;
}

export type AssessOptions = { model?: 'rules+percentile' | 'ml-v1' };

export function assessBatch(
  chips: Record<string, any>[],
  spec: RuleSpec = DEFAULT_RULE_SPEC,
  opts: AssessOptions = {}
): AssessmentResult[] {
  // 默认实现：rules + percentile。预留 ML 分支。
  const model = opts.model ?? 'rules+percentile';
  if (model !== 'rules+percentile') {
    throw new Error(`暂未接入模型: ${model}`);
  }

  const percField = spec.percentileField ?? 'frequencyMhz';
  const lookup = buildPercentileLookup(chips.map((c) => (typeof c[percField] === 'number' ? c[percField] : null)));
  const percWeight = spec.percentileWeight ?? 0.3;
  const ruleWeight = 1 - percWeight;

  return chips.map((chip): AssessmentResult => {
    const reject = hardRejected(spec, chip);
    if (reject) {
      return {
        grade: 'FAIL',
        score: 0,
        ruleScore: 0,
        percentileScore: 0,
        recommendedPriceCny: 0,
        rationale: `硬否决：${reject}`,
      };
    }
    const { score: ruleScore, perField } = computeRuleScore(spec.fields, chip);
    const percentileScore = lookup(typeof chip[percField] === 'number' ? chip[percField] : null);
    const score = ruleScore * ruleWeight + percentileScore * percWeight;
    const grade = gradeFromScore(score);
    const price = priceFor(spec, grade, score);

    const topReasons = perField
      .map((p) => ({ ...p, contribution: p.sub * p.rule.weight }))
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2)
      .map((p) => p.reason);

    const rationale = [
      `综合 ${score.toFixed(1)} 分`,
      `规则 ${ruleScore.toFixed(0)} / 批内分位 ${percentileScore.toFixed(0)}`,
      ...topReasons,
    ].join('；');

    return {
      grade,
      score: Math.round(score * 10) / 10,
      ruleScore: Math.round(ruleScore * 10) / 10,
      percentileScore: Math.round(percentileScore * 10) / 10,
      recommendedPriceCny: price,
      rationale,
    };
  });
}

export * from './types';
