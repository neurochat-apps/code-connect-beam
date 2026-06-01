import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Trash2, Copy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getMyWorkspaces, listMembers, listInvitations, createInvitation, revokeInvitation,
} from "@/lib/finanzas.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/team")({
  component: TeamPage,
});

function TeamPage() {
  const wsFn = useServerFn(getMyWorkspaces);
  const membersFn = useServerFn(listMembers);
  const invFn = useServerFn(listInvitations);
  const createInvFn = useServerFn(createInvitation);
  const revokeFn = useServerFn(revokeInvitation);
  const qc = useQueryClient();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");

  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces"], queryFn: () => wsFn() });
  const ws = workspaces[0];

  const { data: members = [] } = useQuery({
    queryKey: ["members", ws?.id], enabled: !!ws?.id,
    queryFn: () => membersFn({ data: { workspace_id: ws.id } }),
  });
  const { data: invitations = [] } = useQuery({
    queryKey: ["invitations", ws?.id], enabled: !!ws?.id,
    queryFn: () => invFn({ data: { workspace_id: ws.id } }),
  });

  const invite = useMutation({
    mutationFn: () => createInvFn({ data: { workspace_id: ws.id, email, role } }),
    onSuccess: () => {
      toast.success("Invitación creada — copia el enlace y compártelo");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations"] }),
  });

  function inviteLink(token: string) {
    return `${typeof window !== "undefined" ? window.location.origin : ""}/accept-invite/${token}`;
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="font-serif text-4xl">Equipo</h1>
          <p className="text-sm text-muted-foreground mt-1">Invita personas a tu espacio de trabajo.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="font-serif text-xl">Invitar miembro</h2>
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@neurochat.com" />
            </div>
            <div>
              <Label className="text-xs">Rol</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Miembro</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => invite.mutate()} disabled={!email || invite.isPending}>
              <Mail className="size-4" /> Invitar
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-serif text-xl mb-3">Miembros ({members.length})</h2>
          <ul className="divide-y divide-border">
            {members.map((m: any) => (
              <li key={m.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{m.profile?.full_name ?? m.profile?.email ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                </div>
                <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted">{m.role}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-serif text-xl mb-3">Invitaciones pendientes ({invitations.length})</h2>
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin invitaciones pendientes.</p>
          ) : (
            <ul className="divide-y divide-border">
              {invitations.map((inv: any) => (
                <li key={inv.id} className="py-3 flex items-center gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{inv.email}</div>
                    <div className="text-xs text-muted-foreground truncate font-mono">{inviteLink(inv.token)}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => {
                    navigator.clipboard.writeText(inviteLink(inv.token));
                    toast.success("Enlace copiado");
                  }}>
                    <Copy className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => revoke.mutate(inv.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
