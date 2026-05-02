import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { recordJobApplication, updateUserLastActive } from "@/server/db";
import { getProductById } from "@/server/db";

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session || !session.user?.id) {
    return NextResponse.json(
      { message: "Anda harus login untuk melamar pekerjaan." },
      { status: 401 },
    );
  }

  try {
    const { productId } = await request.json();
    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { message: "Product ID harus disediakan." },
        { status: 400 },
      );
    }

    const product = await getProductById(productId);
    if (!product) {
      return NextResponse.json(
        { message: "Produk tidak ditemukan." },
        { status: 404 },
      );
    }

    if (product.productType !== "pekerjaan") {
      return NextResponse.json(
        { message: "Produk ini bukan pekerjaan." },
        { status: 400 },
      );
    }

    await recordJobApplication(session.user.id, productId, product.name);
    await updateUserLastActive(session.user.id).catch(() => {});

    return NextResponse.json({
      message: "Lamaran berhasil dicatat.",
      applicationLink: product.jobApplicationLink,
    });
  } catch (error) {
    console.error("POST /api/job-applications failed:", error);
    const detail =
      error instanceof Error && error.message.trim() ? ` (${error.message.trim()})` : "";

    return NextResponse.json(
      { message: `Gagal mencatat lamaran.${detail}` },
      { status: 500 },
    );
  }
}

