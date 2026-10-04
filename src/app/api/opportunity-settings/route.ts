import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getOpportunitySettings,
  addOpportunityColumn,
  renameOpportunityColumn,
  removeOpportunityColumn,
  reorderOpportunityColumns,
  updateOpportunitySettings,
} from "@/lib/pipeline/opportunity-settings-store";

export async function GET() {
  const settings = await getOpportunitySettings();
  return NextResponse.json(settings);
}

const bodySchema = z.union([
  z.object({ action: z.literal("addColumn"), name: z.string().min(1) }),
  z.object({ action: z.literal("renameColumn"), id: z.string(), name: z.string().min(1) }),
  z.object({ action: z.literal("removeColumn"), id: z.string() }),
  z.object({ action: z.literal("reorderColumns"), orderedIds: z.array(z.string()) }),
  z.object({ action: z.literal("setTriggerOutcome"), triggerOutcome: z.string() }),
]);

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const data = parsed.data;
  const settings =
    data.action === "addColumn"
      ? await addOpportunityColumn(data.name)
      : data.action === "renameColumn"
        ? await renameOpportunityColumn(data.id, data.name)
        : data.action === "removeColumn"
          ? await removeOpportunityColumn(data.id)
          : data.action === "reorderColumns"
            ? await reorderOpportunityColumns(data.orderedIds)
            : await updateOpportunitySettings({ triggerOutcome: data.triggerOutcome });

  return NextResponse.json(settings);
}
