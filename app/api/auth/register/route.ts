import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().min(2, '账号至少 2 个字符').max(80).regex(/^[\S]+$/, '账号不允许空格'),
  name: z.string().min(1, '姓名必填').max(80),
  password: z.string().min(6, '密码至少 6 位').max(120),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const { email, name, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: '该账号已存在' }, { status: 400 });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, role: 'USER' },
  });
  return NextResponse.json({ id: user.id });
}
