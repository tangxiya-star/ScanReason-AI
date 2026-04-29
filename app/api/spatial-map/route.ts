import { NextResponse } from "next/server";
import { getSpatial } from "@/lib/mock";
export async function GET() { return NextResponse.json(getSpatial()); }
