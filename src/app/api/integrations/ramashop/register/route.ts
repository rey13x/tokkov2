import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/server/auth';
import { provisionPayGateForUser } from '@/server/paygate';
import { getRamashopAccountByUserId } from '@/server/integrations/ramashop';

function getPublicErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/too many|terlalu banyak|rate.?limit|coba lagi dalam 1 jam/i.test(message)) {
    return 'Ramashop membatasi registrasi sementara. Jika akun sudah pernah dibuat, gunakan Login dengan email dan password yang sama.';
  }
  if (
    message.includes("Executable doesn't exist") ||
    message.includes('browserType.launch') ||
    message.includes('Playwright')
  ) {
    return 'Sistem PayGate belum siap memproses akun. Coba lagi sebentar lagi.';
  }
  if (message.trim()) return message;
  return 'PayGate belum bisa diproses. Coba lagi sebentar lagi.';
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const authMode = body?.mode === 'login' ? 'login' : 'register';
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (authMode === 'register' && !username) {
      return NextResponse.json({ ok: false, error: 'Username PayGate wajib diisi.' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email PayGate wajib diisi.' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ ok: false, error: 'Password PayGate wajib diisi.' }, { status: 400 });
    }

    await provisionPayGateForUser(session.user.id, {
      username: username || email.split('@')[0],
      name: username || email.split('@')[0],
      email,
      password,
      authMode,
    });

    const account = await getRamashopAccountByUserId(session.user.id);
    if (!account) {
      return NextResponse.json(
        { ok: false, error: 'PayGate belum bisa aktif. Akun belum berhasil tersimpan, silakan coba lagi.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, accountId: account.id }, { status: 200 });
  } catch (error: unknown) {
    console.error('Failed to setup PayGate account:', error);
    const publicError = getPublicErrorMessage(error);
    const isRateLimited = /membatasi registrasi sementara/i.test(publicError);
    return NextResponse.json({ ok: false, error: publicError }, { status: isRateLimited ? 429 : 500 });
  }
}
