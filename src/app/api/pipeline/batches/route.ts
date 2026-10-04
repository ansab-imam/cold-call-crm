import { NextResponse } from "next/server";
import { listBatches } from "@/lib/pipeline/store";

export async function GET() {
  const batches = await listBatches();
  return NextResponse.json({ batches });
}
