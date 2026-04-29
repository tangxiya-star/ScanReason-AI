import { NextResponse } from "next/server";
import { getSafety } from "@/lib/mock";
export async function GET() { return NextResponse.json(getSafety()); }
