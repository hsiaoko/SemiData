import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isAdmin, getVisibleDatasetIds, datasetWhereForUser } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function DatasetsPage() {
  const session = await auth();
  const user = session!.user as any;
  const visible = await getVisibleDatasetIds(user);

  const datasets = await prisma.dataset.findMany({
    where: datasetWhereForUser(user, visible),
    orderBy: [{ kind: 'asc' }, { createdAt: 'desc' }],
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { batches: true, permissions: true, records: true } },
    },
  });

  // 内置 chip 额外算 chip 数（来自 Chip 表）
  const chipDataset = datasets.find((d) => d.kind === 'BUILTIN_CHIP');
  let chipCount = 0;
  if (chipDataset) {
    chipCount = await prisma.chip.count({ where: { batch: { datasetId: chipDataset.id } } });
  }

  return (
    <div className="p-10 max-w-[1280px]">
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <div className="eyebrow mb-2">DATASETS · 02</div>
          <h1 className="display-zh text-5xl text-ink">数据集</h1>
          <p className="mt-3 text-sm text-ink-3">
            共 <span className="num text-cobalt">{datasets.length}</span> 个数据集 ·{' '}
            {isAdmin(user) ? '你是 admin，可见全部' : '仅显示已授权数据集'}
          </p>
        </div>
        {isAdmin(user) && (
          <Link href="/datasets/new" className="btn-primary">+ 新建数据集</Link>
        )}
      </div>

      {datasets.length === 0 ? (
        <div className="text-center py-24 border border-line border-dashed">
          <div className="eyebrow mb-3">EMPTY</div>
          <div className="display-zh text-2xl mb-2">
            {isAdmin(user) ? '尚无数据集' : '尚未被授权访问任何数据集'}
          </div>
          <div className="text-sm text-ink-3 mb-6">
            {isAdmin(user) ? '新建第一个数据集开始使用' : '请联系管理员（admin@semidata.local）申请数据集权限'}
          </div>
          {isAdmin(user) && (
            <Link href="/datasets/new" className="btn-primary">+ 新建数据集</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {datasets.map((d) => {
            const schema = JSON.parse(d.schema);
            const fieldCount = schema?.fields?.length ?? 0;
            const isBuiltin = d.kind === 'BUILTIN_CHIP';
            const rows = isBuiltin ? chipCount : d._count.records;
            return (
              <Link
                key={d.id}
                href={`/datasets/${d.id}`}
                className="card p-6 hover:border-cobalt transition-colors block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isBuiltin && <span className="tag text-cobalt">BUILTIN</span>}
                    {!isBuiltin && <span className="tag text-ink-3">CUSTOM</span>}
                    <span className="serial">{d.slug}</span>
                  </div>
                  <div className="serial">{new Date(d.createdAt).toLocaleDateString('zh-CN')}</div>
                </div>
                <div className="display-zh text-2xl text-ink mb-2">{d.name}</div>
                <div className="text-sm text-ink-3 mb-5 line-clamp-2">{d.description ?? '—'}</div>
                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-line">
                  <Stat label="字段数" value={fieldCount} />
                  <Stat label="批次数" value={d._count.batches} />
                  <Stat label="记录数" value={rows} />
                  <Stat label="授权用户" value={d._count.permissions} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="eyebrow mb-1">{label}</div>
      <div className="num text-lg text-ink">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}
