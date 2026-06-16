'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteDatasetButton({
  datasetId,
  datasetName,
  batchCount,
  recordCount,
}: {
  datasetId: string;
  datasetName: string;
  batchCount: number;
  recordCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/datasets/${datasetId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? '删除失败');
      router.push('/datasets');
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-ghost text-xs text-bin-c hover:border-bin-c" onClick={() => setOpen(true)}>
        删除数据集
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/30 flex items-center justify-center p-6" onClick={() => !busy && setOpen(false)}>
          <div className="bg-surface border border-line shadow-card p-7 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow mb-3 text-bin-c">DELETE · 危险操作</div>
            <h3 className="display-zh text-xl text-ink mb-3">
              确认删除「{datasetName}」？
            </h3>
            <div className="text-sm text-ink-2 leading-relaxed mb-4">
              此操作将<strong className="text-bin-c">级联删除</strong>：
            </div>
            <ul className="text-xs text-ink-2 list-disc pl-5 space-y-1 mb-5">
              <li><span className="num text-bin-c">{batchCount}</span> 个批次</li>
              <li><span className="num text-bin-c">{recordCount.toLocaleString()}</span> 条数据记录</li>
              <li>该数据集下的所有报告 + 评级</li>
              <li>所有用户对该数据集的授权</li>
              <li>该数据集与规则集的绑定（规则集本身不会被删）</li>
            </ul>
            <div className="text-xs text-ink-3 mb-2">
              请输入数据集名称 <span className="num text-ink">{datasetName}</span> 确认：
            </div>
            <input
              className="input mb-3"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={datasetName}
              autoFocus
            />
            {err && <div className="text-xs text-bin-c mb-3">{err}</div>}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>取消</button>
              <button
                type="button"
                className="btn-primary"
                style={{ background: confirm === datasetName ? '#C24A4A' : undefined }}
                disabled={busy || confirm !== datasetName}
                onClick={go}
              >
                {busy ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
