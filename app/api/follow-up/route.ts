import { NextResponse } from "next/server";
import { followUp } from "@/lib/agents";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const question = body?.question;
    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }
    const image = body?.image && body.image.data ? body.image : null;
    const data = await followUp(question, image);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("follow-up error", e);
    return NextResponse.json({ error: e?.message || "Follow-up failed" }, { status: 500 });
  }
}
