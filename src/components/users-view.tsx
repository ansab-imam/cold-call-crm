"use client";

import * as React from "react";
import type { PublicUser } from "@/lib/auth/users-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Trash2, Crown, Pencil } from "lucide-react";

function randomPassword() {
  return Math.random().toString(36).slice(2, 10);
}

// Mirrors accessLevel() in users-store (that module is server-only).
type Level = "rep" | "admin" | "superadmin";
function levelOf(u: Pick<PublicUser, "role" | "superAdmin">): Level {
  if (u.role !== "admin") return "rep";
  return u.superAdmin ? "superadmin" : "admin";
}

const LEVEL_LABEL: Record<Level, string> = { rep: "Rep", admin: "Admin", superadmin: "Super admin" };
const LEVEL_HELP: Record<Level, string> = {
  rep: "Rep — Dashboard, My Calls, Call Log, Opportunities, Reports",
  admin: "Admin — full access, can manage reps",
  superadmin: "Super admin — full access, can also manage admins",
};

export function UsersView({
  initialUsers,
  currentUserId,
}: {
  initialUsers: PublicUser[];
  currentUserId: string;
}) {
  const [users, setUsers] = React.useState(initialUsers);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState(randomPassword());
  const [level, setLevel] = React.useState<Level>("rep");
  const [error, setError] = React.useState<string | null>(null);
  const [listError, setListError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const me = users.find((u) => u.id === currentUserId);
  const iAmSuper = !!me && levelOf(me) === "superadmin";
  const grantable: Level[] = iAmSuper ? ["rep", "admin", "superadmin"] : ["rep"];
  const canManage = (u: PublicUser) => iAmSuper || levelOf(u) === "rep";

  function resetForm() {
    setName("");
    setEmail("");
    setPassword(randomPassword());
    setLevel("rep");
    setError(null);
  }

  async function handleRename(u: PublicUser) {
    const next = window.prompt(`New name for ${u.name}:`, u.name)?.trim();
    if (!next || next === u.name) return;
    const moveRecords = window.confirm(
      `Also move leads assigned to "${u.name}" and calls logged by "${u.name}" over to "${next}"?\n\n` +
        `OK = yes, move them (recommended, keeps their My Calls and stats).\nCancel = no, leave them under the old name.`
    );
    setListError(null);
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next, moveRecords }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setListError(data?.error ?? "Couldn't rename that user.");
      return;
    }
    setUsers((prev) => prev.map((x) => (x.id === u.id ? data.user : x)));
    // The top bar shows your own name — reload so it updates
    if (u.id === currentUserId) window.location.reload();
  }

  async function handleChangeLevel(u: PublicUser, next: Level) {
    if (next === levelOf(u)) return;
    setListError(null);
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: next }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setListError(data?.error ?? "Couldn't change that user's access.");
      return;
    }
    setUsers((prev) => prev.map((x) => (x.id === u.id ? data.user : x)));
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, level }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Couldn't create that user.");
      return;
    }
    const data = await res.json();
    setUsers((prev) => [...prev, data.user]);
    setOpen(false);
    resetForm();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this user? They will no longer be able to log in.")) return;
    setListError(null);
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setListError(data?.error ?? "Couldn't remove that user.");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
          }}
        >
          <DialogTrigger render={<Button className="gap-2"><UserPlus className="size-4" />New user</Button>} />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create a user</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label>Full name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} />
                  <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this with them directly — send it to their email yourself.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Role</Label>
                <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                  <SelectTrigger>
                    <SelectValue>{(v: unknown) => LEVEL_LABEL[v as Level] ?? "Rep"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {grantable.map((l) => (
                      <SelectItem key={l} value={l}>{LEVEL_HELP[l]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!iAmSuper && (
                  <p className="text-xs text-muted-foreground">Only a super admin can create admins.</p>
                )}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={saving || !name || !email || password.length < 6}
              >
                {saving ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {listError && <p className="py-2 text-sm text-destructive">{listError}</p>}
          {users.map((u) => {
            const isMe = u.id === currentUserId;
            const lvl = levelOf(u);
            const manageable = !isMe && canManage(u);
            return (
              <div key={u.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{u.name}</span>
                    {lvl === "superadmin" ? (
                      <Badge className="gap-1 font-normal"><Crown className="size-3" />Super admin</Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">{LEVEL_LABEL[lvl]}</Badge>
                    )}
                    {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {(isMe || canManage(u)) && (
                    <Button variant="ghost" size="icon" onClick={() => handleRename(u)} title="Edit name">
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {iAmSuper && !isMe && (
                    <Select value={lvl} onValueChange={(v) => handleChangeLevel(u, v as Level)}>
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue>{(v: unknown) => LEVEL_LABEL[v as Level]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(["rep", "admin", "superadmin"] as Level[]).map((l) => (
                          <SelectItem key={l} value={l}>{LEVEL_LABEL[l]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!manageable}
                    onClick={() => handleDelete(u.id)}
                    title={
                      isMe
                        ? "You can't delete your own account"
                        : manageable
                          ? "Remove user"
                          : "Only a super admin can remove admins"
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
