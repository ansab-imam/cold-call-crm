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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FIELD_CATALOG,
  FIELD_GROUPS_ORDER,
} from "@/lib/pipeline/field-catalog";
import { REQUIRED_FIELD_GROUPS, type Lead } from "@/lib/pipeline/schema";
import type { ColumnMapping } from "@/lib/pipeline/mapping";
import type { CustomFieldDef } from "@/lib/pipeline/custom-fields-store";
import {
  commitImport,
  previewImport,
  undoImport,
  fetchCustomFields,
  createCustomField,
  type PreviewResponse,
} from "@/lib/pipeline/api-client";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "select" | "preview" | "done";

const IGNORE_VALUE = "__ignore";
const CREATE_FIELD_VALUE = "__create_field";
const CUSTOM_PREFIX = "custom:";

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  isAdmin: boolean;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [step, setStep] = React.useState<Step>("select");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [mappings, setMappings] = React.useState<ColumnMapping[]>([]);
  const [result, setResult] = React.useState<{
    batchId: string;
    insertedCount: number;
    skippedDuplicateCount: number;
    skippedInvalidCount: number;
  } | null>(null);
  const [undone, setUndone] = React.useState(false);
  const [customFields, setCustomFields] = React.useState<CustomFieldDef[]>([]);
  const [creatingIdx, setCreatingIdx] = React.useState<number | null>(null);
  const [newFieldLabel, setNewFieldLabel] = React.useState("");
  const [creatingField, setCreatingField] = React.useState(false);

  function reset() {
    setStep("select");
    setPreview(null);
    setMappings([]);
    setError(null);
    setResult(null);
    setUndone(false);
    setCreatingIdx(null);
    setNewFieldLabel("");
  }

  React.useEffect(() => {
    if (open) fetchCustomFields().then(setCustomFields).catch(() => {});
  }, [open]);

  async function handleCreateField(idx: number) {
    const label = newFieldLabel.trim();
    if (!label) return;
    setCreatingField(true);
    try {
      const field = await createCustomField(label);
      setCustomFields((prev) => (prev.some((f) => f.key === field.key) ? prev : [...prev, field]));
      setMappings((prev) =>
        prev.map((pm, i) =>
          i === idx
            ? { ...pm, targetField: null, customFieldKey: field.key, confidence: 1, reason: "New custom field" }
            : pm
        )
      );
      setCreatingIdx(null);
      setNewFieldLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that field.");
    } finally {
      setCreatingField(false);
    }
  }

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const res = await previewImport(file);
      setPreview(res);
      setMappings(res.mappings);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong reading that file.");
    } finally {
      setLoading(false);
    }
  }

  function columnSamples(columnIndex: number): string[] {
    if (!preview) return [];
    const values: string[] = [];
    for (const row of preview.rows) {
      const v = (row[columnIndex] ?? "").trim();
      if (v && !values.includes(v)) values.push(v);
      if (values.length >= 2) break;
    }
    return values;
  }

  const requiredCoverage = REQUIRED_FIELD_GROUPS.map((group) => ({
    ...group,
    covered: mappings.some(
      (m) => m.targetField && group.anyOf.includes(m.targetField as keyof Lead)
    ),
  }));
  const missingRequiredGroups = requiredCoverage.filter((g) => !g.covered);

  async function handleCommit() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await commitImport({
        fileName: preview.fileName,
        sheetName: preview.sheetName,
        headers: preview.headers,
        rows: preview.rows,
        mappings,
      });
      setResult(res);
      setStep("done");
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUndo() {
    if (!result) return;
    await undoImport(result.batchId);
    setUndone(true);
    onImported();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            {step === "select" &&
              "Upload a CSV or Excel file. Column names don't need to match — we'll figure out where everything goes."}
            {step === "preview" &&
              "Check how each column will be used before anything is saved."}
            {step === "done" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileSpreadsheet className="size-7" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <Button
              disabled={loading}
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Choose a file
            </Button>
            <p className="text-xs text-muted-foreground">.csv or .xlsx, up to 25MB</p>
            {error && (
              <Alert variant="destructive" className="w-full">
                <AlertTriangle className="size-4" />
                <AlertTitle>Couldn&apos;t import that file</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "preview" && preview && (
          <>
            <div className="flex shrink-0 flex-col gap-3 px-6 py-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant="secondary">{preview.totalRows} rows found</Badge>
                <Badge variant="secondary">
                  {mappings.filter((m) => m.targetField || m.customFieldKey).length}/{mappings.length} columns matched
                </Badge>
                {preview.duplicateCount > 0 && (
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    {preview.duplicateCount} possible duplicates
                  </Badge>
                )}
                {preview.missingRequiredCount > 0 && (
                  <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    {preview.missingRequiredCount} rows missing required info
                  </Badge>
                )}
              </div>

              {missingRequiredGroups.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Map these before you can import</AlertTitle>
                  <AlertDescription>
                    {missingRequiredGroups.map((g) => g.label).join(", ")} — every
                    lead needs this. Choose a column below for it, or the import
                    can&apos;t proceed.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <ScrollArea className="min-h-0 flex-1 px-6">
              <div className="flex flex-col divide-y">
                {mappings.map((m, idx) => (
                  <div
                    key={m.sourceHeader + idx}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.sourceHeader}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {columnSamples(m.columnIndex).join(" · ") || "no sample values"}
                      </div>
                    </div>
                    <ConfidenceBadge mapping={m} />
                    {creatingIdx === idx ? (
                      <div className="flex gap-1.5">
                        <Input
                          autoFocus
                          placeholder="New column name…"
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateField(idx);
                            if (e.key === "Escape") setCreatingIdx(null);
                          }}
                          className="h-8 min-w-0 flex-1"
                        />
                        <Button
                          size="sm"
                          className="h-8 shrink-0 px-2"
                          disabled={!newFieldLabel.trim() || creatingField}
                          onClick={() => handleCreateField(idx)}
                        >
                          {creatingField ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            "Add"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 p-0"
                          onClick={() => setCreatingIdx(null)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={
                          m.customFieldKey
                            ? `${CUSTOM_PREFIX}${m.customFieldKey}`
                            : (m.targetField ?? IGNORE_VALUE)
                        }
                        onValueChange={(v) => {
                          if (!v) return;
                          if (v === CREATE_FIELD_VALUE) {
                            setNewFieldLabel(m.sourceHeader);
                            setCreatingIdx(idx);
                            return;
                          }
                          setMappings((prev) =>
                            prev.map((pm, i) => {
                              if (i !== idx) return pm;
                              if (v === IGNORE_VALUE) {
                                return { ...pm, targetField: null, customFieldKey: null, confidence: 0, reason: "Set manually" };
                              }
                              if (v.startsWith(CUSTOM_PREFIX)) {
                                return {
                                  ...pm,
                                  targetField: null,
                                  customFieldKey: v.slice(CUSTOM_PREFIX.length),
                                  confidence: 1,
                                  reason: "Set manually",
                                };
                              }
                              return {
                                ...pm,
                                targetField: v as keyof Lead,
                                customFieldKey: null,
                                confidence: 1,
                                reason: "Set manually",
                              };
                            })
                          );
                        }}
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue>
                            {(v: unknown) => {
                              if (v === IGNORE_VALUE) return "Don't import (keep in Raw Data)";
                              if (typeof v === "string" && v.startsWith(CUSTOM_PREFIX)) {
                                const key = v.slice(CUSTOM_PREFIX.length);
                                return customFields.find((f) => f.key === key)?.label ?? key;
                              }
                              const f = FIELD_CATALOG.find((f) => f.key === v);
                              return f?.label ?? String(v);
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={IGNORE_VALUE}>
                            Don&apos;t import (keep in Raw Data)
                          </SelectItem>
                          <SelectGroup>
                            <SelectLabel>Custom Fields</SelectLabel>
                            <SelectItem value={CREATE_FIELD_VALUE}>
                              <span className="flex items-center gap-1.5 text-primary">
                                <Plus className="size-3.5" />
                                Create new column…
                              </span>
                            </SelectItem>
                            {customFields.map((f) => (
                              <SelectItem key={f.key} value={`${CUSTOM_PREFIX}${f.key}`}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          {FIELD_GROUPS_ORDER.map((group) => (
                            <SelectGroup key={group}>
                              <SelectLabel>{group}</SelectLabel>
                              {FIELD_CATALOG.filter((f) => f.group === group).map(
                                (f) => (
                                  <SelectItem key={f.key} value={f.key}>
                                    {f.label}
                                  </SelectItem>
                                )
                              )}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t px-6 py-3">
              <p className="text-xs text-muted-foreground">
                Rows that match a lead you already have are skipped — only
                new leads get added. Nothing existing is ever changed or
                removed by importing.
              </p>
            </div>

            {error && (
              <div className="px-6 pb-3">
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}

            <DialogFooter className="border-t px-6 py-4">
              <Button variant="outline" onClick={reset} disabled={loading}>
                Back
              </Button>
              <Button
                onClick={handleCommit}
                disabled={loading || missingRequiredGroups.length > 0}
                className="gap-2"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                Import {preview.totalRows} rows
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "done" && result && (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-7" />
            </div>
            <p className="text-sm">
              Imported <strong>{result.insertedCount}</strong> new leads.
              {result.skippedDuplicateCount > 0 &&
                ` Skipped ${result.skippedDuplicateCount} duplicates.`}
              {result.skippedInvalidCount > 0 &&
                ` Skipped ${result.skippedInvalidCount} rows missing required info.`}
            </p>
            {undone ? (
              <Badge variant="secondary">This import was undone</Badge>
            ) : (
              isAdmin && (
                <Button variant="outline" size="sm" onClick={handleUndo}>
                  Undo this import
                </Button>
              )
            )}
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfidenceBadge({ mapping }: { mapping: ColumnMapping }) {
  if (!mapping.targetField && !mapping.customFieldKey) {
    return (
      <Badge variant="outline" className="justify-self-center text-xs font-normal">
        Unmapped
      </Badge>
    );
  }
  const pct = Math.round(mapping.confidence * 100);
  const tone =
    pct >= 85
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : pct >= 55
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
  return (
    <Badge
      variant="secondary"
      title={mapping.reason}
      className={cn("justify-self-center font-normal", tone)}
    >
      {pct}%
    </Badge>
  );
}
