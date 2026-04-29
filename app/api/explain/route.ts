import { NextResponse } from "next/server";
import { explainCase } from "@/lib/agents";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const image = body?.image && body.image.data ? body.image : null;
    const data = await explainCase(image);
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("explain error", e);
    return NextResponse.json({ error: e?.message || "Explain failed" }, { status: 500 });
  }
}
