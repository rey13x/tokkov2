import { NextResponse } from "next/server";
import { listInformations, listProducts } from "@/server/db";

export async function GET() {
  const [products, informations] = await Promise.all([
    listProducts(),
    listInformations(),
  ]);

  return NextResponse.json({ products, informations });
}

