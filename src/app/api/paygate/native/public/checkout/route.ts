import { NextResponse, type NextRequest } from "next/server";
import { createPayGateTransaction, getPayGateStoreBySlug, listPayGateProducts } from "@/server/paygate/native";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = await getPayGateStoreBySlug(String(body.slug || ""));
    if (!store) return NextResponse.json({ ok: false, error: "Toko tidak ditemukan." }, { status: 404 });

    let amount = Number(body.amount);
    const productId = body.productId ? String(body.productId) : null;
    if (productId) {
      const product = (await listPayGateProducts(store.id)).find((item) => item.id === productId);
      if (!product) return NextResponse.json({ ok: false, error: "Produk tidak ditemukan." }, { status: 404 });
      amount = product.price;
    }

    const trx = await createPayGateTransaction({
      store,
      amount,
      productId,
      customerName: body.customerName || "",
      customerEmail: body.customerEmail || "",
      customerPhone: body.customerPhone || "",
    });

    return NextResponse.json({
      ok: true,
      transaction: {
        id: trx.id,
        amount: trx.amount,
        totalAmount: trx.totalAmount,
        uniqueCode: trx.uniqueCode,
        status: trx.status,
        qrString: trx.qrString,
        expiredAt: trx.expiredAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Checkout gagal dibuat." },
      { status: 400 },
    );
  }
}
