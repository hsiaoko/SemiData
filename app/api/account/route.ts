import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const runtime = 'nodejs';

const profileSchema = z.object({
  name: z.string().min(1, '姓名必填').max(80),
  company: z.string().min(1, '公司名必填').max(120),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, '当前密码必填'),
  newPassword: z.string().min(6, '新密码至少 6 位').max(120),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '请求体非法' }, { status: 400 });
  }

  // 改密码分支
  if ('currentPassword' in body || 'newPassword' in body) {
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const me = await prisma.user.findUnique({ where: { id: userId } });
    if (!me) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    const ok = await bcrypt.compare(parsed.data.currentPassword, me.passwordHash);
    if (!ok) return NextResponse.json({ error: '当前密码不正确' }, { status: 400 });
    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return NextResponse.json({ error: '新密码与当前密码相同' }, { status: 400 });
    }
    const hash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    return NextResponse.json({ ok: true });
  }

  // 资料分支
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name: parsed.data.name.trim(), company: parsed.data.company.trim() },
    select: { id: true, name: true, company: true },
  });
  return NextResponse.json(updated);
}
