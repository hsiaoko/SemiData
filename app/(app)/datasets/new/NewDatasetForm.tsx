'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Field = {
  name: string;
  label: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'datetime';
  required: boolean;
  unit?: string;
};

const TYPES: Field['type'][] = ['string', 'number', 'integer', 'boolean', 'datetime'];

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function NewDatasetForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<Field[]>([
    { name: 'sample_id', label: '试样编号', type: 'string', required: true },
  ]);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addField() {
    setFields([...fields, { name: '', label: '', type: 'string', required: false }]);
  }
  function updateField(idx: number, patch: Partial<Field>) {
    setFields(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }
  function removeField(idx: number) {
    setFields(fields.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!name.trim()) return setErr('名称必填');
    if (fields.length === 0) return setErr('至少 1 个字段');
    for (const f of fields) {
      if (!f.name || !f.label) return setErr(`字段 ${f.name || '?'} 缺少 name 或 label`);
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(f.name)) {
        return setErr(`字段名 ${f.name} 必须以字母开头，只含字母/数字/下划线`);
      }
    }
    const finalSlug = slug.trim() || slugify(name);
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: finalSlug,
          description,
          schema: { fields },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? '创建失败');
      const data = await res.json();
      router.push(`/datasets/${data.id}`);
    } catch (e: any) {
      setErr(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="card p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="label">数据集名称</label>
            <input
              className="input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
              placeholder="如：可靠性老化试验"
              maxLength={80}
            />
          </div>
          <div>
            <label className="label">Slug（URL 标识，仅小写字母数字与连字符）</label>
            <input
              className="input num"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="reliability-trial"
              maxLength={50}
            />
          </div>
          <div className="col-span-2">
            <label className="label">备注（可选）</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="该数据集的用途说明"
              maxLength={300}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow">SCHEMA · 字段定义</div>
          <button type="button" className="text-xs text-cobalt hover:underline" onClick={addField}>+ 添加字段</button>
        </div>
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-ink-2">
                <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase w-[24%]">字段名 (name)</th>
                <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase w-[28%]">中文标签 (label)</th>
                <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase w-[16%]">类型</th>
                <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase w-[14%]">单位（可选）</th>
                <th className="px-3 py-2 text-center font-mono text-2xs tracking-eyebrow uppercase w-[10%]">必填</th>
                <th className="px-3 py-2 text-center font-mono text-2xs tracking-eyebrow uppercase w-[8%]"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-2">
                    <input
                      className="input py-1.5 num text-xs"
                      value={f.name}
                      onChange={(e) => updateField(i, { name: e.target.value })}
                      placeholder="snake_case"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="input py-1.5 text-xs"
                      value={f.label}
                      onChange={(e) => updateField(i, { label: e.target.value })}
                      placeholder="中文标签"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="input py-1.5 text-xs"
                      value={f.type}
                      onChange={(e) => updateField(i, { type: e.target.value as Field['type'] })}
                    >
                      {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="input py-1.5 text-xs"
                      value={f.unit ?? ''}
                      onChange={(e) => updateField(i, { unit: e.target.value })}
                      placeholder="MHz / nA / °C"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => updateField(i, { required: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button type="button" className="text-xs text-bin-c hover:underline" onClick={() => removeField(i)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="serial mt-2">CSV 列名将自动匹配到字段 <span className="num">name</span>（不区分大小写、忽略下划线/破折号）。</p>
      </section>

      {err && <div className="text-bin-c text-sm">{err}</div>}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-ghost" onClick={() => history.back()}>取消</button>
        <button type="button" className="btn-primary" onClick={submit} disabled={saving}>
          {saving ? '创建中…' : '创建数据集 →'}
        </button>
      </div>
    </div>
  );
}
