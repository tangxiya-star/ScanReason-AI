import { NextResponse } from "next/server";
import { getReasoning, getFollowUp } from "@/lib/mock";
export async function GET() { return NextResponse.json(getReasoning()); }
export async function POST(req: Request) {
  const { question } = await req.json();
  return NextResponse.json(getFollowUp(question || ""));
}
