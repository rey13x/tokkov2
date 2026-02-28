import { NextResponse } from "next/server";
import { z } from "zod";
import { getInformationById, voteInformationPoll } from "@/server/store-data";

const voteSchema = z.object({
  option: z.string().min(1).max(80),
});

type Params = Promise<{ id: string }>;

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Params }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload = voteSchema.parse(body);
    const option = payload.option.trim();

    const info = await getInformationById(id);
    if (!info) {
      return NextResponse.json({ message: "Polling tidak ditemukan." }, { status: 404 });
    }

    if (info.type !== "poll") {
      return NextResponse.json(
        { message: "Informasi ini bukan polling." },
        { status: 400 },
      );
    }

    if (!info.pollOptions.includes(option)) {
      return NextResponse.json(
        { message: "Opsi polling tidak valid." },
        { status: 400 },
      );
    }

    const updated = await voteInformationPoll(id, option);
    if (!updated) {
      return NextResponse.json({ message: "Gagal menyimpan vote." }, { status: 500 });
    }

    return NextResponse.json({
      message: "Vote berhasil disimpan.",
      information: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Input tidak valid." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Gagal menyimpan vote." },
      { status: 500 },
    );
  }
}
