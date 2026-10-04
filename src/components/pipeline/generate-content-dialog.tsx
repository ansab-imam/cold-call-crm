"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { generateAiContent } from "@/lib/pipeline/api-client";
import { AlertTriangle, Check, Copy, FileText, Loader2, Mail, RefreshCw } from "lucide-react";

// Does the actual fetching. Mounted fresh each time the dialog opens for a
// given lead+type (via the `key` the caller passes), so it always starts
// from a clean state instead of resetting itself mid-effect.
function GenerateContentBody({
  leadId,
  type,
}: {
  leadId: string;
  type: "script" | "email";
}) {
  const [loading, setLoading] = React.useState(true);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [copyFallback, setCopyFallback] = React.useState(false);

  // Mount fetch: the effect only ever sets state from inside the promise
  // callback, never synchronously in the effect body itself (loading starts
  // `true` from useState already).
  React.useEffect(() => {
    let cancelled = false;
    generateAiContent(leadId, type)
      .then((result) => {
        if (!cancelled) setText(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't generate that.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regenerate button: a plain event handler, free to reset state
  // synchronously before kicking off the request again.
  async function regenerate() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const result = await generateAiContent(leadId, type);
      setText(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate that.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked by the browser — fall back to a
      // manual copy so the user isn't stuck with no way to get the text.
      const range = document.createRange();
      range.selectNodeContents(document.getElementById("generated-text")!);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setCopyFallback(true);
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            Writing it now…
          </div>
        )}
        {!loading && error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Couldn&apos;t generate this</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!loading && !error && text && (
          <pre
            id="generated-text"
            className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-sans text-sm"
          >
            {text}
          </pre>
        )}
        {copyFallback && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your browser blocked automatic copying — the text above is
            selected, so press Ctrl+C (or Cmd+C) to copy it.
          </p>
        )}
      </div>

      <DialogFooter className="shrink-0 border-t px-6 py-4">
        <Button variant="outline" className="gap-2" onClick={regenerate} disabled={loading}>
          <RefreshCw className="size-3.5" />
          Regenerate
        </Button>
        <Button className="gap-2" onClick={handleCopy} disabled={loading || !text}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function GenerateContentDialog({
  leadId,
  leadName,
  type,
  open,
  onOpenChange,
}: {
  leadId: string | null;
  leadName: string | null;
  type: "script" | "email";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const Icon = type === "script" ? FileText : Mail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4" />
            {type === "script" ? "Call script" : "Email"}
            {leadName ? ` — ${leadName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Built from your template in Settings, filled in with this
            lead&apos;s data.
          </DialogDescription>
        </DialogHeader>

        {open && leadId && (
          <GenerateContentBody key={`${leadId}:${type}`} leadId={leadId} type={type} />
        )}
      </DialogContent>
    </Dialog>
  );
}
