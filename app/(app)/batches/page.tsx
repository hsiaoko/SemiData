import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { getVisibleDatasetIds, isAdmin, batchWhereForUser } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function BatchesPage() {
  const session = await auth();
  const user = session!.user as any;
  const visible = await getVisibleDatasetIds(user);

  if (!isAdmin(user) && Array.isArray(visible) && visible.length === 0) {
    return (
      <div className="p-10 text-center">
        <div className="eyebrow mb-3">NO ACCESS</div>
        <h1 className="display-zh text-3xl mb-3">你尚未被授权访问任何数据集</h1>
        <p className="text-sm text-ink-3">请联系管理员申请授权。</p>
      </div>
    );
  }

  const batches = await prisma.batch.findMany({
    where: batchWhereForUser(visible),
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { name: true } },
      dataset: { select: { name: true, slug: true, kind: true } },
      _count: { select: { chips: true, records: true, reports: true } },
    },
  });

  return (
    <div className="p-10 max-w-[1280px]">
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <div className="eyebrow mb-2">BATCHES · 03</div>
          <h1 className="display-zh text-5xl text-ink">批次浏览</h1>
          <p className="mt-3 text-sm text-ink-3">共 <span className="num text-cobalt">{batches.length}</span> 个批次</p>
        </div>
        {isAdmin(user) && <Link href="/upload" className="btn-primary">+ 上传新批次</Link>}
      </div>

      {batches.length === 0 ? (
        <div className="text-center py-24 border border-line border-dashed">
          <div className="eyebrow mb-3">EMPTY</div>
          <div className="display-zh text-2xl mb-2">尚无任何批次</div>
          <div className="text-sm text-ink-3 mb-6">
            {isAdmin(user) ? '从上传一份 CSV 开始' : '等待管理员上传数据'}
          </div>
          {isAdmin(user) && <Link href="/upload" className="btn-primary">前往录入 →</Link>}
        </div>
      ) : (
        <div className="border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-ink-2">
                <th className="px-4 py-3 text-left font-mono text-2xs tracking-eyebrow uppercase">批次</th>
                <th className="px-4 py-3 text-left font-mono text-2xs tracking-eyebrow uppercase">数据集</th>
                <th className="px-4 py-3 text-left font-mono text-2xs tracking-eyebrow uppercase">上传人</th>
                <th className="px-4 py-3 text-right font-mono text-2xs tracking-eyebrow uppercase">行数</th>
                <th className="px-4 py-3 text-center font-mono text-2xs tracking-eyebrow uppercase">报告</th>
                <th className="px-4 py-3 text-right font-mono text-2xs tracking-eyebrow uppercase">时间</th>
                <th className="px-4 py-3 text-right font-mono text-2xs tracking-eyebrow uppercase">操作</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const count = b._count.chips || b._count.records;
                const isBuiltin = b.dataset.kind === 'BUILTIN_CHIP';
                const detailHref = isBuiltin ? `/batches/${b.id}` : `/datasets/${b.datasetId}`;
                return (
                  <tr key={b.id} className="border-t border-line hover:bg-surface-2/60 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={detailHref} className="hover:text-cobalt">
                        <div className="font-medium">{b.name}</div>
                        <div className="serial mt-0.5">{b.id.slice(-10).toUpperCase()}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/datasets/${b.datasetId}`} className="text-sm text-ink-2 hover:text-cobalt">
                        {b.dataset.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{b.uploadedBy.name}</td>
                    <td className="px-4 py-3 num text-right">{count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      {b._count.reports > 0 ? (
                        <span className="tag text-cobalt">已生成 · {b._count.reports}</span>
                      ) : (
                        <span className="tag text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 num text-2xs text-ink-3 text-right">
                      {new Date(b.createdAt).toLocaleString('zh-CN', { hour12: false }).slice(0, 16)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={detailHref} className="text-xs text-cobalt hover:underline mr-3">查看</Link>
                      {isBuiltin && b._count.reports > 0 && (
                        <Link href={`/batches/${b.id}/report`} className="text-xs text-irid-pink hover:underline">报告</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
