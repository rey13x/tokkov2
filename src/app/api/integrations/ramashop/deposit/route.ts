import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createDeposit, getRamashopAccountByUserId } from '@/server/integrations/ramashop';
import { getServerAuthSession } from '@/server/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const body = await req.json();
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount < 100) {
      return NextResponse.json({ ok: false, error: 'Nominal deposit minimal Rp 100.' }, { status: 400 });
    }

    const account = await getRamashopAccountByUserId(session.user.id);
    if (!account) {
      return NextResponse.json(
        { ok: false, error: 'Login atau register PayGate dulu sebelum deposit.' },
        { status: 400 },
      );
    }

    const result = await createDeposit(session.user.id, Math.round(amount));
    if (result.status < 200 || result.status >= 300 || !result.data?.data) {
      const providerMessage = String(result.data?.message || '').toLowerCase();
      const unavailable = result.status >= 500 || providerMessage.includes('not available') || providerMessage.includes('server');
      return NextResponse.json(
        { ok: false, error: unavailable ? 'Layanan pembayaran sedang tidak tersedia. Coba lagi beberapa saat.' : result.data?.message || 'Deposit gagal dibuat.' },
        { status: unavailable ? 503 : result.status || 500 },
      );
    }

    return NextResponse.json(
      { ok: true, data: result.data.data, message: result.data.message, result },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'Layanan pembayaran sedang tidak tersedia. Coba lagi beberapa saat.' }, { status: 503 });
  }
}
