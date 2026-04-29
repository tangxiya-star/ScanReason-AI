import { NextResponse } from "next/server";
import { getChecklist } from "@/lib/mock";
export async function GET() { return NextResponse.json(getChecklist()); }
