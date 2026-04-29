import { NextResponse } from "next/server";
import { getObservation } from "@/lib/mock";
export async function GET() { return NextResponse.json(getObservation()); }
