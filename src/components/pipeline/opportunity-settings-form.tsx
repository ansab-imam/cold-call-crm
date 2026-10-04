"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { opportunitySettingsApi } from "@/lib/pipeline/api-client";
import type { OpportunitySettings } from "@/lib/pipeline/opportunity-settings-store";
import { ArrowDown, ArrowUp, Kanban, Trash2 } from "lucide-react";

export function OpportunitySettingsForm({
  initial,
  callOutcomes,
}: {
  initial: OpportunitySettings;
  callOutcomes: string[];
}) {
  const [settings, setSettings] = React.useState(initial);
  const [draft, setDraft] = React.useState("");

  async function addColumn() {
    const name = draft.trim();
    if (!name) return;
    setSettings(await opportunitySettingsApi.addColumn(name));
    setDraft("");
  }

  async function renameColumn(id: string, name: string) {
    setSettings(await opportunitySettingsApi.renameColumn(id, name));
  }

  async function removeColumn(id: string) {
    setSettings(await opportunitySettingsApi.removeColumn(id));
  }

  async function move(id: string, dir: -1 | 1) {
    const ids = settings.columns.map((c) => c.id);
    const idx = ids.indexOf(id);
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    setSettings(await opportunitySettingsApi.reorderColumns(ids));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Kanban className="size-4" />
          Opportunities board
        </CardTitle>
        <CardDescription>
          The columns leads move through once they&apos;re marked interested,
          in the order they appear left to right.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            Call Outcome that promotes a lead onto the board
          </Label>
          <Select
            value={settings.triggerOutcome}
            onValueChange={async (v) => {
              if (!v) return;
              setSettings(await opportunitySettingsApi.setTriggerOutcome(v));
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue>{(v: unknown) => String(v)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {callOutcomes.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          {settings.columns.map((col, i) => (
            <div key={col.id} className="flex items-center gap-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(col.id, -1)}
                  className="text-muted-foreground disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === settings.columns.length - 1}
                  onClick={() => move(col.id, 1)}
                  className="text-muted-foreground disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              <Input
                defaultValue={col.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== col.name) {
                    renameColumn(col.id, e.target.value.trim());
                  }
                }}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeColumn(col.id)}
                title="Remove column"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addColumn();
              }
            }}
            placeholder="Add a column…"
            className="max-w-xs"
          />
          <Button size="sm" variant="outline" onClick={addColumn} disabled={!draft.trim()}>
            Add column
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
