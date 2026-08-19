import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkDepositStatus } from '@/server/integrations/ramashop';
import { getServerAuthSession } from '@/server/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ depositId: string }> }) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const { depositId } = await params;
    if (!depositId) {
      return NextResponse.json({ ok: false, error: 'depositId wajib diisi.' }, { status: 400 });
    }

    const result = await checkDepositStatus(session.user.id, depositId);
    return NextResponse.json({ ok: true, data: result.data?.data ?? null, result }, { status: 200 });
  } catch (error: unknown) {
    console.warn('Failed to check PayGate deposit status:', error);
    return NextResponse.json(
      { ok: false, error: 'Ups, layanan pembayaran sedang mengalami gangguan server. Coba lagi sebentar.' },
      { status: 503 },
    );
  }
}
