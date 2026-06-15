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

export type FieldRule = {
  field: ChipField;
  // either range-based or ideal-tolerance-based
  min?: number;
  max?: number;
  ideal?: number; // 期望值（评分越靠近越高）
  tolerance?: number; // 容差
  weight: number; // 0..1
};

export type HardRejectRule = {
  field: ChipField;
  // 命中则直接 FAIL
  greaterThan?: number;
  lessThan?: number;
  equals?: number | string;
};

export type RuleSpec = {
  fields: FieldRule[];
  hardReject?: HardRejectRule[];
  // 用于批内分位的字段
  percentileField?: ChipField;
  percentileWeight?: number; // 默认 0.3
  priceTable: Record<Grade, number>; // CNY per chip
};

export type AssessmentResult = {
  grade: Grade;
  score: number; // 0..100
  ruleScore: number;
  percentileScore: number;
  recommendedPriceCny: number;
  rationale: string;
};
