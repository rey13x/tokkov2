import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { recordJobApplication, updateUserLastActive, getUserJobApplications, deleteJobApplication } from "@/server/db";
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

    // Check user application limit (max 2 concurrent applications)
    const userApplications = await getUserJobApplications(session.user.id);
    if (userApplications.length >= 2) {
      return NextResponse.json(
        {
          message:
            "Anda sudah melamar 2 pekerjaan. Selesaikan atau batalkan salah satu terlebih dahulu sebelum melamar yang lain.",
          limit_reached: true,
        },
        { status: 400 },
      );
    }

    // Check product max applicants limit
    const maxApplicants = product.maxApplicants ?? 0;
    const currentApplicants = product.applicantCount ?? 0;

    if (maxApplicants > 0 && currentApplicants >= maxApplicants) {
      return NextResponse.json(
        {
          message: "Jumlah pelamar untuk pekerjaan ini sudah penuh. Silakan coba pekerjaan lainnya.",
          max_reached: true,
        },
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

export async function GET(request: Request) {
  const session = await getServerAuthSession();

  if (!session || !session.user?.id) {
    return NextResponse.json(
      { message: "Anda harus login." },
      { status: 401 },
    );
  }

  try {
    const applications = await getUserJobApplications(session.user.id);
    return NextResponse.json({ applications });
  } catch (error) {
    console.error("GET /api/job-applications failed:", error);
    return NextResponse.json(
      { message: "Gagal memuat lamaran." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getServerAuthSession();

  if (!session || !session.user?.id) {
    return NextResponse.json(
      { message: "Anda harus login." },
      { status: 401 },
    );
  }

  try {
    const { applicationId } = await request.json();
    if (!applicationId || typeof applicationId !== "string") {
      return NextResponse.json(
        { message: "Application ID harus disediakan." },
        { status: 400 },
      );
    }

    await deleteJobApplication(applicationId, session.user.id);
    return NextResponse.json({ message: "Lamaran berhasil dibatalkan." });
  } catch (error) {
    console.error("DELETE /api/job-applications failed:", error);
    const detail =
      error instanceof Error && error.message.trim() ? ` (${error.message.trim()})` : "";

    return NextResponse.json(
      { message: `Gagal membatalkan lamaran.${detail}` },
      { status: 500 },
    );
  }
}

