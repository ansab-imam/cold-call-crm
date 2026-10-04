import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomFields, createCustomField, deleteCustomField } from "@/lib/pipeline/custom-fields-store";
import { requireSession } from "@/lib/auth/require-session";

export async function GET() {
  const fields = await getCustomFields();
  return NextResponse.json({ fields });
}

const createSchema = z.object({ label: z.string().trim().min(1) });

export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a name for the field." }, { status: 400 });
  }
  const field = await createCustomField(parsed.data.label);
  return NextResponse.json({ field });
}

const deleteSchema = z.object({ key: z.string().min(1) });

export async function DELETE(request: Request) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing field key." }, { status: 400 });
  }
  const fields = await deleteCustomField(parsed.data.key);
  return NextResponse.json({ fields });
}
