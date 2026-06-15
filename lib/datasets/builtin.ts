import { FIELD_LABELS, type ChipField } from '@/lib/csv/aliases';

export const BUILTIN_CHIP_SLUG = 'chip-test';

export type FieldType = 'string' | 'number' | 'integer' | 'boolean' | 'datetime' | 'enum';

export type DatasetField = {
  name: string;       // 内部字段名（snake_case 或 camelCase）
  label: string;      // 中文标签
  type: FieldType;
  required?: boolean;
  unit?: string;
  enumValues?: string[];
};

export type DatasetSchema = {
  fields: DatasetField[];
};

// 内置 chip dataset 的 schema — 用于在 UI 中展示字段，但实际存储走 Chip 表
export const BUILTIN_CHIP_SCHEMA: DatasetSchema = {
  fields: (Object.keys(FIELD_LABELS) as ChipField[]).map((name) => {
    let type: FieldType = 'string';
    if (['dieX', 'dieY', 'passCount', 'failCount'].includes(name)) type = 'integer';
    else if (
      ['testTempC', 'testVoltageV', 'vthV', 'iddUa', 'leakageNa', 'frequencyMhz', 'powerMw', 'testDurationS'].includes(name)
    ) type = 'number';
    else if (name === 'testTimestamp') type = 'datetime';
    return {
      name,
      label: FIELD_LABELS[name],
      type,
      required: name === 'chipId',
    };
  }),
};
