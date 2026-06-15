'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { Dropzone } from '@/components/Dropzone';
import { BUILTIN_CHIP_SLUG, type DatasetSchema, type DatasetField } from '@/lib/datasets/builtin';

type DatasetOption = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  description: string | null;
  schema: DatasetSchema;
};

type ParseState = {
  fileName: string;
  fileSize: number;
  headers: string[];
  rows: Record<string, string>[];
  columnMap: Record<string, string>; // header -> field name | '__extras__' | '__skip__'
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_\-()（）\[\]/]/g, '');
}

function autoMap(headers: string[], fields: DatasetField[]): Record<string, string> {
  const dict = new Map<string, string>();
  for (const f of fields) {
    dict.set(normalize(f.name), f.name);
    if (f.label) dict.set(normalize(f.label), f.name);
  }
  const used = new Set<string>();
  const result: Record<string, string> = {};
  for (const h of headers) {
    const match = dict.get(normalize(h));
    if (match && !used.has(match)) {
      result[h] = match;
      used.add(match);
    } else {
      result[h] = '__extras__';
    }
  }
  return result;
}

export function UploadFlow({ datasets, initialDatasetId }: { datasets: DatasetOption[]; initialDatasetId?: string }) {
  const router = useRouter();
  const [datasetId, setDatasetId] = useState<string>(initialDatasetId ?? datasets[0]?.id ?? '');
  const [parsed, setParsed] = useState<ParseState | null>(null);
  const [batchName, setBatchName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dataset = useMemo(() => datasets.find((d) => d.id === datasetId), [datasets, datasetId]);

  function onFiles(files: File[]) {
    const file = files[0];
    if (!file || !dataset) return;
    setErr(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        const rows = res.data;
        const columnMap = autoMap(headers, dataset.schema.fields);
        setParsed({ fileName: file.name, fileSize: file.size, headers, rows, columnMap });
        setBatchName(file.name.replace(/\.csv$/i, '').slice(0, 80));
      },
      error: (e) => setErr(`解析失败：${e.message}`),
    });
  }

  function updateMap(header: string, target: string) {
    if (!parsed) return;
    setParsed({ ...parsed, columnMap: { ...parsed.columnMap, [header]: target } });
  }

  async function commit() {
    if (!parsed || !dataset) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: dataset.id,
          name: batchName || parsed.fileName,
          description,
          fileName: parsed.fileName,
          fileSize: parsed.fileSize,
          columnMap: parsed.columnMap,
          rows: parsed.rows,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || '入库失败');
      }
      const data = await res.json();
      if (dataset.slug === BUILTIN_CHIP_SLUG) {
        router.push(`/batches/${data.id}`);
      } else {
        router.push(`/datasets/${dataset.id}`);
      }
    } catch (e: any) {
      setErr(e.message ?? '未知错误');
      setSubmitting(false);
    }
  }

  const mappedCount = parsed && dataset
    ? Object.values(parsed.columnMap).filter((v) => v !== '__extras__' && v !== '__skip__').length
    : 0;
  const requiredMissing = parsed && dataset
    ? dataset.schema.fields.filter((f) => f.required).filter((f) => !Object.values(parsed.columnMap).includes(f.name))
    : [];

  return (
    <div className="space-y-8">
      {/* Step 1: 选择 Dataset */}
      <section>
        <div className="eyebrow mb-3">STEP 1 · 目标数据集</div>
        <div className="grid grid-cols-3 gap-3">
          {datasets.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => { setDatasetId(d.id); setParsed(null); }}
              className={`text-left p-4 border transition-colors ${
                datasetId === d.id ? 'border-cobalt bg-cobalt/[0.04]' : 'border-line hover:border-ink-2 bg-surface'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`tag ${d.kind === 'BUILTIN_CHIP' ? 'text-cobalt' : 'text-ink-3'}`}>{d.kind}</span>
                <span className="serial">{d.slug}</span>
              </div>
              <div className="text-sm font-medium mb-1">{d.name}</div>
              <div className="serial line-clamp-2">{d.description ?? '—'}</div>
              <div className="serial mt-2 text-cobalt">{d.schema.fields.length} 字段</div>
            </button>
          ))}
        </div>
      </section>

      {dataset && !parsed && (
        <section>
          <div className="eyebrow mb-3">STEP 2 · 拖入 CSV</div>
          <Dropzone onFiles={onFiles} />
          <p className="serial mt-2">将按 <span className="num text-ink-2">{dataset.name}</span> 的 schema 解析列名</p>
        </section>
      )}

      {err && <div className="border border-bin-c text-bin-c p-4 text-sm">{err}</div>}

      {parsed && dataset && (
        <div className="space-y-8 animate-fade-up">
          <div className="grid grid-cols-4 gap-6 card p-6">
            <div>
              <div className="eyebrow mb-1">DATASET</div>
              <div className="text-sm">{dataset.name}</div>
            </div>
            <div>
              <div className="eyebrow mb-1">FILE</div>
              <div className="text-sm font-mono truncate">{parsed.fileName}</div>
            </div>
            <div>
              <div className="eyebrow mb-1">ROWS</div>
              <div className="num text-sm">{parsed.rows.length.toLocaleString()}</div>
            </div>
            <div>
              <div className="eyebrow mb-1">MAPPED COLUMNS</div>
              <div className="num text-sm">
                <span className="text-cobalt">{mappedCount}</span> / {parsed.headers.length}
              </div>
            </div>
          </div>

          {requiredMissing.length > 0 && (
            <div className="border border-bin-c text-bin-c p-4 text-sm">
              <span className="num">缺少必填字段：</span> {requiredMissing.map((f) => f.label).join('、')}
            </div>
          )}

          <section>
            <div className="eyebrow mb-3">STEP 3 · 列映射</div>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-ink-2">
                    <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">CSV 列名</th>
                    <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">样例</th>
                    <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">→ 字段</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map((h) => {
                    const sample = parsed.rows[0]?.[h] ?? '';
                    const m = parsed.columnMap[h];
                    const auto = m !== '__extras__' && m !== '__skip__';
                    return (
                      <tr key={h} className="border-t border-line">
                        <td className="px-3 py-2 font-mono text-xs">{h}</td>
                        <td className="px-3 py-2 num text-2xs text-ink-3 truncate max-w-[200px]">{sample}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <select
                              className="input py-1.5 text-xs"
                              value={m}
                              onChange={(e) => updateMap(h, e.target.value)}
                            >
                              <option value="__extras__">— 存为附加字段 —</option>
                              <option value="__skip__">— 忽略此列 —</option>
                              {dataset.schema.fields.map((f) => (
                                <option key={f.name} value={f.name}>
                                  {f.label}（{f.name}） {f.required ? ' · 必填' : ''}
                                </option>
                              ))}
                            </select>
                            {auto && <span className="tag text-cobalt">AUTO</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="eyebrow mb-3">PREVIEW · 前 10 行</div>
            <div className="card overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-2 text-ink-2">
                    {parsed.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-line">
                      {parsed.headers.map((h) => (
                        <td key={h} className="px-3 py-1.5 num text-2xs text-ink-2 whitespace-nowrap">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-6">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="label">批次名称</label>
                <input className="input" value={batchName} onChange={(e) => setBatchName(e.target.value)} maxLength={120} />
              </div>
              <div>
                <label className="label">备注（可选）</label>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-ghost" onClick={() => setParsed(null)} disabled={submitting}>
                取消重选
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={commit}
                disabled={submitting || !batchName || requiredMissing.length > 0}
              >
                {submitting ? '入库中…' : `确认入库 · ${parsed.rows.length.toLocaleString()} 行 →`}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
