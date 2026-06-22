import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth/next";
import { getFirebaseFirestore } from "@/server/firebase-admin";
import type { UserCourseAccess } from "@/types/store";
import { listProducts } from "@/server/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();

    // User must be signed in
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { productId, accessKey } = body;

    if (!productId || !accessKey) {
      return NextResponse.json(
        { error: "productId and accessKey are required" },
        { status: 400 }
      );
    }

    // Get product details
    const products = await listProducts();
    const product = products.find((p) => p.id === productId);

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    if (product.productType !== "lms") {
      return NextResponse.json(
        { error: "This product is not an LMS course" },
        { status: 400 }
      );
    }

    // Verify access key (case-sensitive)
    if (product.accessKey !== accessKey) {
      return NextResponse.json(
        { error: "Kunci akses tidak valid!" }, // Invalid access key
        { status: 403 }
      );
    }

    const db = getFirebaseFirestore();
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    // Create or update user course access record
    const accessId = randomUUID();
    const courseAccess: UserCourseAccess = {
      id: accessId,
      userId: session.user.id || session.user.email,
      productId,
      hasAccessKey: true,
      accessGrantedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Check if access already exists
    const existingAccess = await db
      .collection("userCourseAccess")
      .where("userId", "==", session.user.id || session.user.email)
      .where("productId", "==", productId)
      .limit(1)
      .get();

    if (!existingAccess.empty) {
      // Update existing
      const existingDoc = existingAccess.docs[0];
      await existingDoc.ref.update({
        hasAccessKey: true,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, accessId: existingDoc.id });
    } else {
      // Create new
      await db.collection("userCourseAccess").doc(accessId).set(courseAccess);
    }

    // Initialize course progress for first lesson
    const firstChapter = await db
      .collection("lmsChapters")
      .where("productId", "==", productId)
      .orderBy("sortOrder", "asc")
      .limit(1)
      .get();

    if (!firstChapter.empty) {
      const chapterId = firstChapter.docs[0].id;
      const firstLesson = await db
        .collection("lmsLessons")
        .where("chapterId", "==", chapterId)
        .orderBy("sortOrder", "asc")
        .limit(1)
        .get();

      if (!firstLesson.empty) {
        const lessonId = firstLesson.docs[0].id;

        // Check if progress already exists
        const existingProgress = await db
          .collection("userCourseProgress")
          .where("userId", "==", session.user.id || session.user.email)
          .where("lessonId", "==", lessonId)
          .limit(1)
          .get();

        if (existingProgress.empty) {
          const progressId = randomUUID();
          await db.collection("userCourseProgress").doc(progressId).set({
            id: progressId,
            userId: session.user.id || session.user.email,
            lessonId,
            productId,
            status: "unlocked",
            lastWatchedSecond: 0,
            hasAccessKey: true,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    return NextResponse.json({ success: true, accessId });
  } catch (error) {
    console.error("Failed to verify access key:", error);
    return NextResponse.json(
      { error: "Failed to verify access key" },
      { status: 500 }
    );
  }
}
