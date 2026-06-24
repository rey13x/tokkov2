import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/server/auth";
import { getAdminIdentity } from "@/server/admin";
import { getOrderById } from "@/server/store-data";

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

    // Validate file size (max 5MB)
    // Validate file size (max 2MB)
    if (imageFile.size > 2 * 1024 * 1024) {
      return NextResponse.json({ message: "Ukuran gambar terlalu besar (max 2MB)." }, { status: 400 });
    }

    // Read file buffer
    const buffer = await imageFile.arrayBuffer();

    // Try to upload to Firebase Storage
    try {
      const admin = require("firebase-admin");
      const { getStorage } = admin;

      // Initialize Firebase if needed
      let storage = null;
      try {
        storage = getStorage();
      } catch {
        // Firebase not initialized - must fail, don't return base64
        return NextResponse.json(
          { message: "Upload service tidak tersedia. Hubungi administrator." },
          { status: 503 }
        );
      }

      // Create a unique filename
      const timestamp = Date.now();
      const filename = `receipts/${orderId}/confirmation-${timestamp}.png`;

      // Upload to Firebase Storage
      const file = storage.bucket().file(filename);
      await file.save(Buffer.from(buffer), {
        metadata: {
          contentType: imageFile.type,
          cacheControl: "public, max-age=31536000",
        },
      });

      // Generate signed URL (valid for 7 days)
      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      return NextResponse.json({ imageUrl: url });
    } catch (storageError) {
      console.error("Firebase Storage error:", storageError);
      // Don't fallback to base64 - fail properly
      return NextResponse.json(
        { message: "Gagal mengunggah struk. Pastikan file berukuran kurang dari 2MB." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("POST /api/orders/[id]/upload-receipt-image failed:", error);
    return NextResponse.json({ message: "Gagal mengunggah struk." }, { status: 500 });
  }
}
