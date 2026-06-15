import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { NewDatasetForm } from './NewDatasetForm';

export const dynamic = 'force-dynamic';

export default async function NewDatasetPage() {
  const session = await auth();
  if ((session!.user as any).role !== 'ADMIN') redirect('/datasets');

  return (
    <div className="p-10 max-w-[1000px]">
      <div className="mb-10">
        <div className="eyebrow mb-2">DATASETS · NEW</div>
        <h1 className="display-zh text-5xl text-ink">新建数据集</h1>
        <p className="mt-3 text-sm text-ink-3 max-w-2xl">
          定义一个新的数据集（可视为"自定义表"）。指定字段名、中文标签、数据类型；上传 CSV 时按此 schema 解析。
        </p>
      </div>
      <NewDatasetForm />
    </div>
  );
}
