import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';

const fieldSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(80),
  type: z.enum(['string', 'number', 'integer', 'boolean', 'datetime']),
  required: z.boolean().optional(),
  unit: z.string().max(20).optional(),
});

const body = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'slug 仅允许小写字母数字与 - '),
  description: z.string().max(300).optional(),
  schema: z.object({ fields: z.array(fieldSchema).min(1) }),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: '仅管理员可创建数据集' }, { status: 403 });
  }
  const raw = await req.json().catch(() => null);
  const parsed = body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const { name, slug, description, schema } = parsed.data;
  const exists = await prisma.dataset.findUnique({ where: { slug } });
  if (exists) return NextResponse.json({ error: 'slug 已存在' }, { status: 400 });

  const ds = await prisma.dataset.create({
    data: {
      name,
      slug,
      description,
      kind: 'CUSTOM',
      schema: JSON.stringify(schema),
      createdById: (session.user as any).id,
    },
  });
  return NextResponse.json({ id: ds.id });
}
