import { matchField, type ChipField, NUMERIC_FIELDS, INT_FIELDS } from './aliases';

export type ColumnMap = Record<string, ChipField | '__extras__' | '__skip__'>;

export interface ParsedRow {
  fields: Partial<Record<ChipField, string | number | Date | null>>;
  extras: Record<string, string>;
}

export function buildColumnMap(headers: string[]): ColumnMap {
  const used = new Set<ChipField>();
  const map: ColumnMap = {};
  for (const h of headers) {
    const f = matchField(h);
    if (f && !used.has(f)) {
      map[h] = f;
      used.add(f);
    } else {
      map[h] = '__extras__';
    }
  }
  return map;
}

export function coerceValue(field: ChipField, raw: string): string | number | Date | null {
  if (raw == null || raw === '') return null;
  const v = raw.trim();
  if (v === '') return null;
  if (field === 'testTimestamp') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (NUMERIC_FIELDS.includes(field)) {
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return INT_FIELDS.includes(field) ? Math.round(n) : n;
  }
  return v;
}

export function applyColumnMap(row: Record<string, string>, map: ColumnMap): ParsedRow {
  const fields: ParsedRow['fields'] = {};
  const extras: ParsedRow['extras'] = {};
  for (const [header, target] of Object.entries(map)) {
    const raw = row[header];
    if (target === '__skip__') continue;
    if (target === '__extras__') {
      if (raw != null && raw !== '') extras[header] = String(raw);
      continue;
    }
    const v = coerceValue(target, String(raw ?? ''));
    if (v !== null) fields[target] = v;
  }
  return { fields, extras };
}
