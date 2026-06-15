import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { RulesEditor } from './RulesEditor';
import { RulesHelp } from './RulesHelp';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const session = await auth();
  const role = (session!.user as any).role as string;
  if (role !== 'ADMIN') redirect('/');

  const ruleSets = await prisma.ruleSet.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    include: { createdBy: { select: { name: true } } },
  });

  return (
    <div className="p-10 max-w-[1280px]">
      <div className="mb-10">
        <div className="eyebrow mb-2">RULES · 03</div>
        <h1 className="display-zh text-5xl text-ink">规则配置</h1>
        <p className="mt-3 text-sm text-ink-3 max-w-2xl">
          每个规则集定义了分级算法所使用的字段、权重和价格表。报告生成时会使用「默认」规则集，除非显式指定其它规则集。规则仅作用于内置「芯片封测」数据集。
        </p>
      </div>

      <RulesHelp />

      <RulesEditor
        ruleSets={ruleSets.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          rules: r.rules,
          isDefault: r.isDefault,
          createdByName: r.createdBy.name,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
