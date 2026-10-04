"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveStatusSettings } from "@/lib/pipeline/api-client";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";
import { Phone, Target, X } from "lucide-react";

function OptionListCard({
  title,
  description,
  icon: Icon,
  items,
  onChange,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");

  function addItem() {
    const value = draft.trim();
    if (!value || items.includes(value)) return;
    onChange([...items, value]);
    setDraft("");
  }

  function removeItem(item: string) {
    onChange(items.filter((i) => i !== item));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {items.length === 0 && (
            <span className="text-sm text-muted-foreground">No options yet.</span>
          )}
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1.5 pr-1 font-normal">
              {item}
              <button
                type="button"
                onClick={() => removeItem(item)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${item}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="Add an option…"
          />
          <Button size="sm" variant="outline" onClick={addItem} disabled={!draft.trim()}>
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusSettingsForm({ initial }: { initial: StatusSettings }) {
  const [settings, setSettings] = React.useState(initial);

  async function updateStatuses(callStatuses: string[]) {
    const saved = await saveStatusSettings({ callStatuses });
    setSettings(saved);
  }

  async function updateOutcomes(callOutcomes: string[]) {
    const saved = await saveStatusSettings({ callOutcomes });
    setSettings(saved);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <OptionListCard
        title="Call Status options"
        description="What actually happened when the call was placed — shown as one dropdown in Log a Call."
        icon={Phone}
        items={settings.callStatuses}
        onChange={updateStatuses}
      />
      <OptionListCard
        title="Call Outcome options"
        description="What the conversation resulted in — shown as the second dropdown in Log a Call. Setting one of these is what moves a lead out of My Calls."
        icon={Target}
        items={settings.callOutcomes}
        onChange={updateOutcomes}
      />
    </div>
  );
}
