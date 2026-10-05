import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getAdminIdentity } from "@/server/admin";
import { getOrderById } from "@/server/store-data";
import { compressImageToWebp } from "@/server/image-compression";

type Params = Promise<{ id: string }>;

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Params }) {
  try {
    const params = await context.params;
    const orderId = params.id;

    const session = await getServerAuthSession();
    const admin = await getAdminIdentity();

    if (!session?.user?.id && !admin) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
    }

    const isAdmin = Boolean(admin) || session?.user?.role === "admin";
    const ownEmail = (session?.user?.email ?? "").toLowerCase();
    if (!isAdmin && ownEmail !== order.userEmail.toLowerCase()) {
      return NextResponse.json(
        { message: "Akses ditolak. Order bukan milik Anda." },
        { status: 403 },
      );
    }

    // Parse form data
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ message: "Gambar struk tidak ditemukan." }, { status: 400 });
    }

    // Validate file type
    if (!imageFile.type.startsWith("image/")) {
      return NextResponse.json({ message: "File harus berupa gambar." }, { status: 400 });
    }

    if (imageFile.size > 8 * 1024 * 1024) {
      return NextResponse.json({ message: "Ukuran gambar terlalu besar. Maksimal 8MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const compressed = await compressImageToWebp(buffer);
    if (!compressed) {
      return NextResponse.json({ message: "Gambar struk gagal dikompres. Coba gambar lain." }, { status: 400 });
    }
    return NextResponse.json({
      imageUrl: `data:image/webp;base64,${compressed.toString("base64")}`,
    });
  } catch (error) {
    console.error("POST /api/orders/[id]/upload-receipt-image failed:", error);
    return NextResponse.json({ message: "Gagal mengunggah struk." }, { status: 500 });
  }
}
