import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { UploadFlow } from './UploadFlow';
import { BUILTIN_CHIP_SLUG } from '@/lib/datasets/builtin';

export const dynamic = 'force-dynamic';

export default async function UploadPage({ searchParams }: { searchParams?: { dataset?: string } }) {
  const session = await auth();
  const user = session!.user as any;
  // 仅 admin 能上传（USER 默认无权限）
  if (user.role !== 'ADMIN') {
    return (
      <div className="p-10 max-w-2xl mx-auto text-center">
        <div className="eyebrow mb-3">UPLOAD · 01</div>
        <h1 className="display-zh text-3xl mb-3">仅管理员可上传数据</h1>
        <p className="text-sm text-ink-3 mb-6">
          如需把数据导入特定数据集，请联系管理员（admin@semidata.local）。
        </p>
      </div>
    );
  }

  const datasets = await prisma.dataset.findMany({
    orderBy: [{ kind: 'asc' }, { createdAt: 'desc' }],
    select: { id: true, name: true, slug: true, kind: true, schema: true, description: true },
  });

  const initialDatasetId =
    searchParams?.dataset ??
    datasets.find((d) => d.slug === BUILTIN_CHIP_SLUG)?.id ??
    datasets[0]?.id;

  return (
    <div className="p-10 max-w-[1280px]">
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <div className="eyebrow mb-2">UPLOAD · 01</div>
          <h1 className="display-zh text-5xl text-ink">数据录入</h1>
          <p className="mt-3 text-sm text-ink-3">先选择目标数据集 → 拖拽 CSV → 字段映射 → 确认入库</p>
        </div>
        <a href="/sample-data/sample-200.csv" download className="serial hover:text-cobalt underline underline-offset-4">
          下载示例 CSV（200 行 · 芯片）↓
        </a>
      </div>
      <UploadFlow
        datasets={datasets.map((d) => ({
          id: d.id,
          name: d.name,
          slug: d.slug,
          kind: d.kind,
          description: d.description,
          schema: JSON.parse(d.schema),
        }))}
        initialDatasetId={initialDatasetId}
      />
    </div>
  );
}
