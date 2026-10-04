"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveAiSettings, type AiSettings } from "@/lib/pipeline/api-client";
import { AVAILABLE_TEMPLATE_TOKENS } from "@/lib/pipeline/template-render";
import { Check, FileText, Loader2, Mail, Sparkles, FileCode } from "lucide-react";

function TemplateCard({
  title,
  description,
  icon: Icon,
  value,
  onSave,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  value: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [text, setText] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const dirty = text !== value;

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(text);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
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
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className="font-mono text-xs"
        />
        <Button
          size="sm"
          className="w-fit gap-2"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {saved && <Check className="size-3.5" />}
          {saved ? "Saved" : "Save template"}
        </Button>
      </CardContent>
    </Card>
  );
}

function TokenReference() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Available placeholders</CardTitle>
        <CardDescription>
          Use any of these in either template, written as{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{{token}}"}</code>.
          Add a fallback for when a lead is missing that field:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {"{{firstName|there}}"}
          </code>
          . Nesting one placeholder inside another isn&apos;t supported.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_TEMPLATE_TOKENS.map((t) => (
            <Badge key={t} variant="outline" className="font-mono text-xs font-normal">
              {`{{${t}}}`}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AiSettingsForm({ initial }: { initial: AiSettings }) {
  const [settings, setSettings] = React.useState(initial);
  const aiOn = !!settings.aiEnabled;

  return (
    <div className="flex flex-col gap-4">
      <Card className={aiOn ? "border-primary/30 bg-primary/5" : ""}>
        <CardContent className="flex items-center gap-3 py-4">
          {aiOn ? (
            <Sparkles className="size-5 shrink-0 text-primary" />
          ) : (
            <FileCode className="size-5 shrink-0 text-muted-foreground" />
          )}
          <div className="text-sm">
            <div className="font-medium">
              {aiOn ? "AI generation is ON" : "AI generation is OFF"}
            </div>
            <p className="text-muted-foreground">
              {aiOn
                ? "An OpenAI key is set — the text below is used as instructions for a real AI-written script/email, personalized per lead."
                : "No AI key is set — the text below is used as a literal template, with placeholders swapped for that lead's data. Add OPENAI_API_KEY in Vercel to turn on real AI generation."}
            </p>
          </div>
        </CardContent>
      </Card>

      <TokenReference />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TemplateCard
          title="Script Generation"
          description={
            aiOn
              ? "Instructions for the AI on what to write — it reads this plus the lead's real data. Talk to it like you're briefing a rep, not filling in blanks."
              : "What 'Generate script' fills in and shows you. No AI involved — this text, with the placeholders below swapped for that lead's data, is exactly what you'll see. Edit any time; the next click uses whatever's saved here."
          }
          icon={FileText}
          value={settings.scriptInstructions}
          onSave={async (v) => {
            const saved = await saveAiSettings({ scriptInstructions: v });
            setSettings(saved);
          }}
        />
        <TemplateCard
          title="Email Generation"
          description={
            aiOn
              ? "Instructions for the AI on what to write — it reads this plus the lead's real data. Talk to it like you're briefing a rep, not filling in blanks."
              : "What 'Generate email' fills in and shows you. No AI involved — this text, with the placeholders below swapped for that lead's data, is exactly what you'll see. Edit any time; the next click uses whatever's saved here."
          }
          icon={Mail}
          value={settings.emailInstructions}
          onSave={async (v) => {
            const saved = await saveAiSettings({ emailInstructions: v });
            setSettings(saved);
          }}
        />
      </div>
    </div>
  );
}
