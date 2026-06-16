import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isAdmin, canViewDataset } from '@/lib/permissions';
import { StatNumber } from '@/components/StatNumber';
import { PermissionsPanel } from './PermissionsPanel';
import { RuleSetsPanel } from './RuleSetsPanel';
import { CustomRecordsTable } from './CustomRecordsTable';
import { DeleteDatasetButton } from './DeleteDatasetButton';

export const dynamic = 'force-dynamic';

export default async function DatasetDetail({ params }: { params: { id: string } }) {
  const session = await auth();
  const user = session!.user as any;

  const dataset = await prisma.dataset.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { batches: true, records: true, permissions: true } },
    },
  });
  if (!dataset) notFound();

  if (!isAdmin(user) && !(await canViewDataset(user, dataset.id))) {
    return (
      <div className="p-10 text-center">
        <div className="eyebrow mb-3">FORBIDDEN</div>
        <div className="display-zh text-2xl text-bin-c">你没有访问此数据集的权限</div>
        <Link href="/datasets" className="text-sm text-cobalt hover:underline mt-4 inline-block">← 返回数据集列表</Link>
      </div>
    );
  }

  const schema = JSON.parse(dataset.schema);
  const isBuiltin = dataset.kind === 'BUILTIN_CHIP';

  const recentBatches = await prisma.batch.findMany({
    where: { datasetId: dataset.id },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: {
      uploadedBy: { select: { name: true } },
      _count: { select: { chips: true, records: true, reports: true } },
    },
  });

  // 仅 admin 看授权面板
  let allUsers: any[] = [];
  let permissions: any[] = [];
  if (isAdmin(user)) {
    [allUsers, permissions] = await Promise.all([
      prisma.user.findMany({ where: { role: 'USER' }, select: { id: true, name: true, email: true } }),
      prisma.datasetPermission.findMany({ where: { datasetId: dataset.id } }),
    ]);
  }

  // 规则集 — 所有 dataset 都可绑定，仅 admin 可见与编辑
  let allRuleSets: any[] = [];
  let boundRuleSetIds: string[] = [];
  if (isAdmin(user)) {
    const bindings = await prisma.datasetRuleSet.findMany({
      where: { datasetId: dataset.id },
      select: { ruleSetId: true },
    });
    boundRuleSetIds = bindings.map((b) => b.ruleSetId);
    allRuleSets = await prisma.ruleSet.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, description: true, isDefault: true },
    });
  }

  // 该 dataset 是否绑定了至少一条规则（决定导出是否含 Y 列）— user 也需要知道
  const hasBoundRule = await prisma.datasetRuleSet.count({ where: { datasetId: dataset.id } });

  let recordCount = dataset._count.records;
  if (isBuiltin) {
    recordCount = await prisma.chip.count({ where: { batch: { datasetId: dataset.id } } });
  }

  return (
    <div className="p-10 max-w-[1280px]">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-3">
            <span>DATASET · {dataset.slug}</span>
            <span className={`tag ${isBuiltin ? 'text-cobalt' : 'text-ink-3'}`}>{dataset.kind}</span>
          </div>
          <h1 className="display-zh text-4xl text-ink">{dataset.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin(user) && !isBuiltin && (
            <DeleteDatasetButton
              datasetId={dataset.id}
              datasetName={dataset.name}
              batchCount={dataset._count.batches}
              recordCount={recordCount}
            />
          )}
          <Link href="/datasets" className="serial hover:text-ink">← 数据集列表</Link>
        </div>
      </div>
      <div className="text-sm text-ink-3 mb-8 flex flex-wrap gap-x-5 gap-y-1">
        <span>{dataset.description ?? '无备注'}</span>
        <span>·</span>
        <span>创建人：{dataset.createdBy.name}</span>
        <span>·</span>
        <span>{new Date(dataset.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
      </div>

      <section className="grid grid-cols-4 gap-6 mb-10 border-t border-b border-line py-8">
        <StatNumber label="字段数" value={schema.fields.length} size="md" />
        <StatNumber label="批次数" value={dataset._count.batches.toLocaleString()} size="md" />
        <StatNumber label="记录数" value={recordCount.toLocaleString()} size="md" />
        <StatNumber label="授权用户" value={dataset._count.permissions} size="md" hint={isAdmin(user) ? '不含 admin' : undefined} />
      </section>

      {/* Schema */}
      <section className="mb-10">
        <div className="eyebrow mb-3">SCHEMA · 字段</div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-ink-2">
                <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">name</th>
                <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">中文标签</th>
                <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">类型</th>
                <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">单位</th>
                <th className="px-3 py-2 text-center font-mono text-2xs tracking-eyebrow uppercase">必填</th>
              </tr>
            </thead>
            <tbody>
              {schema.fields.map((f: any) => (
                <tr key={f.name} className="border-t border-line">
                  <td className="px-3 py-2 num text-xs">{f.name}</td>
                  <td className="px-3 py-2">{f.label}</td>
                  <td className="px-3 py-2 num text-xs text-ink-3">{f.type}</td>
                  <td className="px-3 py-2 num text-xs text-ink-3">{f.unit ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{f.required ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 操作区：导出（所有 VIEW 用户）+ 上传（admin） */}
      <section className="mb-10 card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="eyebrow">ACTIONS · 数据操作</div>
            <p className="text-sm text-ink-3 mt-1">
              一键导出全部记录{hasBoundRule > 0 ? '，含规则分析的等级 / 推荐价 / 评级理由 Y 列' : '（该数据集尚未配置分析规则，仅导出原始列）'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a href={`/api/datasets/${dataset.id}/export?format=csv`} className="btn-ghost text-xs" download>
              导出全部 CSV {hasBoundRule > 0 ? '+ Y 列' : ''} ↓
            </a>
            <a href={`/api/datasets/${dataset.id}/export?format=xlsx`} className="btn-primary text-xs" download>
              导出全部 Excel {hasBoundRule > 0 ? '+ Y 列' : ''} ↓
            </a>
            {isAdmin(user) && (
              <Link href={`/upload?dataset=${dataset.id}`} className="btn-ghost">+ 上传 CSV</Link>
            )}
          </div>
        </div>
      </section>

      {/* 批次 / 记录 */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow">BATCHES · 最近上传</div>
          {isBuiltin && <Link href="/batches" className="text-xs text-cobalt hover:underline">查看全部批次 →</Link>}
        </div>
        {recentBatches.length === 0 ? (
          <div className="card p-10 text-center text-ink-3 text-sm">尚无任何批次</div>
        ) : (
          <div className="card">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-ink-2">
                  <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">批次</th>
                  <th className="px-3 py-2 text-left font-mono text-2xs tracking-eyebrow uppercase">上传人</th>
                  <th className="px-3 py-2 text-right font-mono text-2xs tracking-eyebrow uppercase">行数</th>
                  <th className="px-3 py-2 text-right font-mono text-2xs tracking-eyebrow uppercase">时间</th>
                  <th className="px-3 py-2 text-right font-mono text-2xs tracking-eyebrow uppercase">操作</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map((b) => {
                  const count = isBuiltin ? b._count.chips : b._count.records;
                  return (
                    <tr key={b.id} className="border-t border-line hover:bg-surface-2/60">
                      <td className="px-3 py-2">
                        <div className="font-medium">{b.name}</div>
                        <div className="serial">{b.id.slice(-10).toUpperCase()}</div>
                      </td>
                      <td className="px-3 py-2 text-ink-2">{b.uploadedBy.name}</td>
                      <td className="px-3 py-2 num text-right">{count.toLocaleString()}</td>
                      <td className="px-3 py-2 num text-2xs text-ink-3 text-right">
                        {new Date(b.createdAt).toLocaleString('zh-CN', { hour12: false }).slice(0, 16)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/batches/${b.id}`} className="text-xs text-cobalt hover:underline">查看</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 自定义 dataset 的全部 records 表 */}
      {!isBuiltin && (
        <section className="mb-10">
          <div className="eyebrow mb-3">RECORDS · 全部数据</div>
          <CustomRecordsTable datasetId={dataset.id} schema={schema} />
        </section>
      )}

      {/* 规则集绑定 — 仅 admin 可见 */}
      {isAdmin(user) && (
        <section className="mb-10">
          <div className="eyebrow mb-3">RULE SETS · 可用规则集（ADMIN 决定）</div>
          <RuleSetsPanel
            datasetId={dataset.id}
            allRuleSets={allRuleSets}
            initialBoundIds={boundRuleSetIds}
            canEdit={true}
          />
        </section>
      )}

      {/* 权限面板（admin 仅） */}
      {isAdmin(user) && (
        <section>
          <div className="eyebrow mb-3">PERMISSIONS · 用户授权</div>
          <PermissionsPanel
            datasetId={dataset.id}
            users={allUsers}
            initialGranted={permissions.map((p) => p.userId)}
          />
        </section>
      )}
    </div>
  );
}
