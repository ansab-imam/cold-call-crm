"use client";

import * as React from "react";
import type { Lead } from "@/lib/pipeline/schema";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FIELD_GROUPS_ORDER,
  FIELD_CATALOG,
  type FieldDef,
} from "@/lib/pipeline/field-catalog";
import {
  STAGES,
  SENIORITIES,
  FIT_LABELS,
  PRIORITIES,
  PHONE_STATUSES,
  EMAIL_STATUSES,
  EMAIL_TYPES,
  EMPLOYEE_BANDS,
} from "@/lib/pipeline/schema";
import { PhoneCall, MessageSquare, UserRound, Ban, RotateCcw, Loader2, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogCallDialog } from "./log-call-dialog";
import { MarkInvalidDialog } from "./mark-invalid-dialog";
import { EditCallLogDialog } from "./edit-call-log-dialog";
import { AssignedToSelect } from "./assigned-to-select";
import { restoreLead, deleteLeads, fetchCustomFields } from "@/lib/pipeline/api-client";
import { fetchCallLog } from "@/lib/pipeline/api-client";
import type { CustomFieldDef } from "@/lib/pipeline/custom-fields-store";
import type { CallLogEntry } from "@/lib/pipeline/call-log-schema";
import { formatDateOnly } from "@/lib/pipeline/dates";
import { ordinal as ordinalAttempt } from "@/lib/utils";
import type { StatusSettings } from "@/lib/pipeline/status-settings-store";

// Shown as dedicated cards up top; these fields stay out of the generic
// grouped grid below so they aren't duplicated.
const CUSTOM_CARD_FIELD_KEYS = new Set([
  "assignedTo",
  "assignedAt",
  "callStatus",
  "callOutcome",
  "callNotes",
]);

// Not shown anywhere in this panel at all — tracked via Call Outcome
// instead (an admin-managed status the rep sets explicitly), not this
// toggle.
const HIDDEN_FIELD_KEYS = new Set(["doNotCall"]);

// Per-key option lists for the fields whose "kind" is "enum".
const ENUM_OPTIONS: Partial<Record<string, readonly string[]>> = {
  stage: STAGES,
  seniority: SENIORITIES,
  fitLabel: FIT_LABELS,
  priority: PRIORITIES,
  phoneStatus: PHONE_STATUSES,
  emailStatus: EMAIL_STATUSES,
  emailType: EMAIL_TYPES,
  employeeBand: EMPLOYEE_BANDS,
};

function initials(name: string | null) {
  if (!name) return "—";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

// Any column from an imported file that wasn't mapped to a known field
// (e.g. "Monthly Website Visits") still gets captured — into rawData, keyed
// by the exact column header — instead of being thrown away. This is what
// surfaces that here.
function rawDataEntries(rawData: Record<string, unknown>): [string, string][] {
  return Object.entries(rawData)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]): [string, string] => [
      k,
      Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v),
    ]);
}

function EditableField({
  field,
  value,
  onCommit,
}: {
  field: FieldDef;
  value: unknown;
  onCommit: (value: unknown) => void;
}) {
  // Seeded once from the current value; the caller resets this by keying the
  // component on the lead+field (switching leads remounts it fresh) rather
  // than syncing via an effect, which would fight the user's own typing.
  const [local, setLocal] = React.useState(() => String(value ?? ""));

  if (field.kind === "boolean") {
    return (
      <Switch checked={!!value} onCheckedChange={(v) => onCommit(v)} />
    );
  }

  if (field.kind === "date") {
    return (
      <input
        type="date"
        value={typeof value === "string" ? value.slice(0, 10) : ""}
        onChange={(e) =>
          onCommit(e.target.value ? new Date(e.target.value).toISOString() : null)
        }
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
    );
  }

  if (field.kind === "enum" && ENUM_OPTIONS[field.key]) {
    const options = ENUM_OPTIONS[field.key]!;
    return (
      <Select value={(value as string) ?? ""} onValueChange={(v) => onCommit(v)}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.kind === "longtext") {
    return (
      <Textarea
        value={local}
        rows={3}
        placeholder={`Add ${field.label.toLowerCase()}…`}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onCommit(local || null)}
      />
    );
  }

  if (field.kind === "tags") {
    return (
      <Input
        value={local}
        placeholder="Comma-separated"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() =>
          onCommit(
            local.split(",").map((t) => t.trim()).filter(Boolean)
          )
        }
      />
    );
  }

  if (field.kind === "number") {
    return (
      <Input
        type="number"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onCommit(local.trim() === "" ? null : Number(local))}
      />
    );
  }

  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local.trim() === "" ? null : local.trim())}
    />
  );
}

function CallHistoryTab({
  leadId,
  onLogCall,
  isAdmin,
  statusOptions,
  onLeadUpdated,
}: {
  leadId: string;
  onLogCall: () => void;
  isAdmin: boolean;
  statusOptions: StatusSettings;
  // Editing the lead's *latest* call can re-sync its current status/outcome
  // — this is how that change reaches the Details tab without a refetch.
  onLeadUpdated: (lead: Lead) => void;
}) {
  // Remounted by the caller (keyed on leadId + a refresh counter) whenever
  // the lead changes or a call is freshly logged, so this always starts
  // from a clean `null` and fetches once rather than resetting state itself.
  const [entries, setEntries] = React.useState<CallLogEntry[] | null>(null);
  const [editingEntry, setEditingEntry] = React.useState<CallLogEntry | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchCallLog(leadId).then((data) => {
      if (!cancelled) setEntries(data);
    });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (entries === null) {
    return (
      <div className="flex h-[calc(100vh-11rem)] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-[calc(100vh-11rem)] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <PhoneCall className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">No call history yet</p>
        <p className="text-xs text-muted-foreground">
          Every call you log against this lead is saved here permanently.
        </p>
        <Button size="sm" className="gap-2" onClick={onLogCall}>
          <PhoneCall className="size-4" />
          Log a call
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-11rem)] px-4">
      <div className="flex flex-col gap-3 py-4">
        {entries.map((e) => (
          <div key={e.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {e.callStatus && <Badge variant="secondary">{e.callStatus}</Badge>}
                {e.callOutcome && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {e.callOutcome}
                  </Badge>
                )}
                {!e.callStatus && !e.callOutcome && (
                  <span className="text-xs text-muted-foreground">No status set</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {new Date(e.loggedAt).toLocaleString()}
                  {e.editedAt && " (edited)"}
                </span>
                {isAdmin && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6"
                    title="Edit this call log entry"
                    onClick={() => setEditingEntry(e)}
                  >
                    <Pencil className="size-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {ordinalAttempt(e.attemptNumber)} attempt · Logged by {e.loggedBy}
            </div>
            {e.notes && <p className="mt-2 text-sm">{e.notes}</p>}
            {e.nextActionDate && (
              <div className="mt-2 text-xs text-muted-foreground">
                Next follow-up: {formatDateOnly(e.nextActionDate)}
              </div>
            )}
          </div>
        ))}
      </div>

      <EditCallLogDialog
        entry={editingEntry}
        statusOptions={statusOptions}
        open={!!editingEntry}
        onOpenChange={(o) => !o && setEditingEntry(null)}
        onSaved={({ entry: saved, lead: savedLead }) => {
          setEntries((prev) => (prev ? prev.map((x) => (x.id === saved.id ? saved : x)) : prev));
          if (savedLead) onLeadUpdated(savedLead);
        }}
      />
    </ScrollArea>
  );
}

export function LeadDetailSheet({
  lead,
  onOpenChange,
  onUpdate,
  onCallLogged,
  onDeleted,
  assignableUsers,
  statusOptions,
  isAdmin = false,
  currentUser = "",
}: {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
  onCallLogged?: (results: { entry: CallLogEntry; lead: Lead }[]) => void;
  // Called after the lead is actually deleted server-side, so the caller
  // can drop it from whatever list it's rendering. Admin-only action.
  onDeleted?: (id: string) => void;
  assignableUsers: string[];
  statusOptions: StatusSettings;
  // Both default to the rep-safe case — falls back to "reassign needs a
  // reason" for any caller that hasn't been updated to pass these yet,
  // rather than silently over-granting.
  isAdmin?: boolean;
  currentUser?: string;
}) {
  const [logCallOpen, setLogCallOpen] = React.useState(false);
  const [invalidOpen, setInvalidOpen] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [customFieldDefs, setCustomFieldDefs] = React.useState<CustomFieldDef[]>([]);

  React.useEffect(() => {
    fetchCustomFields().then(setCustomFieldDefs).catch(() => {});
  }, []);
  const [historyRefreshKey, setHistoryRefreshKey] = React.useState(0);
  const [callNotesDraft, setCallNotesDraft] = React.useState(lead?.callNotes ?? "");

  async function handleRestore() {
    if (!lead) return;
    setRestoring(true);
    try {
      const saved = await restoreLead(lead.id);
      onUpdate(lead.id, saved);
    } finally {
      setRestoring(false);
    }
  }

  async function handleDelete() {
    if (!lead) return;
    const confirmed = window.confirm(
      `Delete ${lead.fullName ?? lead.companyName ?? "this lead"}? This can't be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteLeads([lead.id]);
      onDeleted?.(lead.id);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  }

  // Reset the draft whenever a different lead is opened, so last lead's
  // unsaved text can't leak into this one.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCallNotesDraft(lead?.callNotes ?? "");
  }, [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet open={!!lead} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        {lead && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-3">
                <Avatar className="size-11 shrink-0">
                  <AvatarFallback className="bg-secondary">
                    {initials(lead.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{lead.fullName ?? "Unnamed lead"}</SheetTitle>
                  <SheetDescription className="truncate">
                    {lead.jobTitle ?? "—"}
                    {lead.companyName ? ` at ${lead.companyName}` : ""}
                  </SheetDescription>
                </div>
              </div>
              <div className="mt-3 mr-8 flex flex-wrap gap-1.5">
                {lead.isInvalid ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={restoring}
                    onClick={handleRestore}
                  >
                    {restoring ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Restore
                  </Button>
                ) : null}
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Delete
                  </Button>
                )}
                {!lead.isInvalid && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => setInvalidOpen(true)}
                    >
                      <Ban className="size-3.5" />
                      Mark invalid
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => setLogCallOpen(true)}>
                      <PhoneCall className="size-3.5" />
                      Log a call
                    </Button>
                  </>
                )}
              </div>
              {lead.isInvalid && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <div className="font-medium text-destructive">Marked invalid</div>
                  <p className="mt-1 text-muted-foreground">{lead.invalidReason}</p>
                  {lead.invalidBy && lead.invalidAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      By {lead.invalidBy} on {new Date(lead.invalidAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </SheetHeader>

            <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-4 mt-3 w-fit">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="calls">Call History</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="min-h-0 flex-1">
                <ScrollArea className="h-[calc(100vh-11rem)] px-4">
                  <div className="flex flex-col gap-4 py-4">
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <UserRound className="size-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Assigned To</div>
                        <AssignedToSelect
                          value={lead.assignedTo}
                          assignableUsers={assignableUsers}
                          isAdmin={isAdmin}
                          triggerClassName="border-none px-0 shadow-none"
                          onChange={(next, reason) =>
                            onUpdate(lead.id, {
                              assignedTo: next,
                              assignedAt: next ? new Date().toISOString() : null,
                              ...(reason
                                ? {
                                    reassignReason: reason,
                                    reassignedBy: currentUser,
                                    reassignedAt: new Date().toISOString(),
                                  }
                                : {}),
                            })
                          }
                        />
                        {lead.reassignReason && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Last reassigned by {lead.reassignedBy ?? "—"}: &quot;{lead.reassignReason}&quot;
                          </p>
                        )}
                      </div>
                      {lead.assignedTo && lead.assignedAt && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          since {new Date(lead.assignedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="mb-1 text-xs text-muted-foreground">
                            Call Status
                          </div>
                          {lead.callStatus ? (
                            <Badge variant="secondary" className="font-normal">
                              {lead.callStatus}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">— Not set —</span>
                          )}
                        </div>
                        <div>
                          <div className="mb-1 text-xs text-muted-foreground">
                            Call Outcome
                          </div>
                          {lead.callOutcome ? (
                            <Badge variant="secondary" className="font-normal">
                              {lead.callOutcome}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              — Not decided yet —
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="mb-1 text-xs text-muted-foreground">
                          Next Follow-up
                        </div>
                        {lead.nextActionDate ? (
                          <Badge variant="secondary" className="font-normal">
                            {formatDateOnly(lead.nextActionDate)}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            — No date set, resolved —
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        All three are set from <strong>Log a call</strong> above — every
                        status change is saved permanently to Call History that way.
                      </p>
                      <div className="mt-3">
                        <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MessageSquare className="size-3" />
                          Comments{" "}
                          <span className="text-muted-foreground/60">(optional)</span>
                        </div>
                        <Textarea
                          key={lead.id}
                          value={callNotesDraft}
                          placeholder="Add your own notes about this lead… carried into Log a call automatically"
                          rows={3}
                          onChange={(e) => setCallNotesDraft(e.target.value)}
                          onBlur={(e) =>
                            onUpdate(lead.id, { callNotes: e.target.value || null })
                          }
                        />
                      </div>
                    </div>

                    {lead.dataFlags.length > 0 && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                        <div className="mb-1 font-medium">Flagged during import</div>
                        <ul className="list-inside list-disc space-y-0.5">
                          {lead.dataFlags.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {FIELD_GROUPS_ORDER.map((group) => {
                      const fields = FIELD_CATALOG.filter(
                        (f) =>
                          f.group === group &&
                          !CUSTOM_CARD_FIELD_KEYS.has(f.key) &&
                          !HIDDEN_FIELD_KEYS.has(f.key)
                      );
                      return (
                        <div key={group}>
                          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {group}
                          </h3>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-lg border p-3">
                            {fields.map((f) => (
                              <div key={f.key} className="min-w-0">
                                <div className="mb-1 text-xs text-muted-foreground">
                                  {f.label}
                                </div>
                                <EditableField
                                  key={`${lead.id}:${f.key}`}
                                  field={f}
                                  value={(lead as unknown as Record<string, unknown>)[f.key]}
                                  onCommit={(v) =>
                                    onUpdate(lead.id, { [f.key]: v } as Partial<Lead>)
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {customFieldDefs.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Custom Fields
                        </h3>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-lg border p-3">
                          {customFieldDefs.map((f) => (
                            <div key={f.key} className="min-w-0">
                              <div className="mb-1 text-xs text-muted-foreground">{f.label}</div>
                              <Input
                                key={`${lead.id}:${f.key}`}
                                defaultValue={lead.customFields?.[f.key] ?? ""}
                                onBlur={(e) =>
                                  onUpdate(lead.id, {
                                    customFields: { ...lead.customFields, [f.key]: e.target.value || null },
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {rawDataEntries(lead.rawData).length > 0 && (
                      <div>
                        <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Additional Data From Import
                        </h3>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-lg border p-3">
                          {rawDataEntries(lead.rawData).map(([key, value]) => (
                            <div key={key} className="min-w-0">
                              <div className="mb-1 text-xs text-muted-foreground">{key}</div>
                              <div className="truncate text-sm" title={value}>
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="calls" className="min-h-0 flex-1">
                <CallHistoryTab
                  key={`${lead.id}:${historyRefreshKey}`}
                  leadId={lead.id}
                  onLogCall={() => setLogCallOpen(true)}
                  isAdmin={isAdmin}
                  statusOptions={statusOptions}
                  onLeadUpdated={(saved) => onUpdate(lead.id, saved)}
                />
              </TabsContent>
            </Tabs>

            <LogCallDialog
              leadIds={[lead.id]}
              statusOptions={statusOptions}
              open={logCallOpen}
              onOpenChange={setLogCallOpen}
              initialNotes={callNotesDraft}
              initialAttemptNumber={lead.attemptCount + 1}
              onLogged={(results) => {
                setHistoryRefreshKey((k) => k + 1);
                // The comment just became a permanent Call History entry —
                // clear the live draft so it doesn't look like it's still
                // sitting there unsaved.
                setCallNotesDraft("");
                onUpdate(lead.id, { callNotes: null });
                onCallLogged?.(results);
              }}
            />

            <MarkInvalidDialog
              leadIds={[lead.id]}
              open={invalidOpen}
              onOpenChange={setInvalidOpen}
              onMarked={([saved]) => onUpdate(lead.id, saved)}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
