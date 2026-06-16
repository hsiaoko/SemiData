import type { ChipField } from '../csv/aliases';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'FAIL';

export const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D', 'FAIL'];

export const GRADE_LABELS: Record<Grade, string> = {
  S: '特级',
  A: '一级',
  B: '二级',
  C: '三级',
  D: '次品',
  FAIL: '失效',
};

// 字段名可以是任意 string — 通用以适配 CUSTOM dataset
export type FieldRule = {
  field: string;
  // either range-based or ideal-tolerance-based
  min?: number;
  max?: number;
  ideal?: number; // 期望值（评分越靠近越高）
  tolerance?: number; // 容差
  weight: number; // 0..1
};

export type HardRejectRule = {
  field: string;
  // 命中则直接 FAIL（任一非空生效）
  greaterThan?: number;
  lessThan?: number;
  equals?: number | string;
  notEquals?: number | string;
};

export type RuleSpec = {
  fields: FieldRule[];
  hardReject?: HardRejectRule[];
  percentileField?: string;
  percentileWeight?: number; // 默认 0.3
  priceTable: Record<Grade, number>;
};

export type AssessmentResult = {
  grade: Grade;
  score: number; // 0..100
  ruleScore: number;
  percentileScore: number;
  recommendedPriceCny: number;
  rationale: string;
};
