import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { ensurePayGateStore, listPayGateProducts, upsertPayGateProduct } from "@/server/paygate/native";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  const store = await ensurePayGateStore({ id: session.user.id, username: session.user.name, email: session.user.email });
  const products = await listPayGateProducts(store.id, true);
  return NextResponse.json({ ok: true, products });
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  try {
    const store = await ensurePayGateStore({ id: session.user.id, username: session.user.name, email: session.user.email });
    const body = await req.json();
    const product = await upsertPayGateProduct(store.id, {
      id: body.id,
      name: body.name,
      description: body.description,
      price: Number(body.price),
      imageUrl: body.imageUrl,
      isActive: body.isActive !== false,
    });
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Produk gagal disimpan." },
      { status: 400 },
    );
  }
}
