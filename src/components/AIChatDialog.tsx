import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Brain, Mic, MicOff, Check, X, AlertTriangle, Info, CheckCircle2, Pencil } from "lucide-react";
import { chatFinanciero, executeAction, getChatAlerts } from "@/lib/ai.functions";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PendingAction = { name: string; args: Record<string, any>; summary: string; status?: "pending" | "done" | "cancelled" | "error"; error?: string; editing?: boolean };

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "batch"; actions: PendingAction[] };

export function AIChatDialog({
  open, onOpenChange, workspaceId,
}: { open: boolean; onOpenChange: (v: boolean) => void; workspaceId: string | undefined }) {
  const chatFn = useServerFn(chatFinanciero);
  const execFn = useServerFn(executeAction);
  const alertsFn = useServerFn(getChatAlerts);

  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hola 👋 Soy tu centro de control financiero. Pregunta, dictame por voz, o pídeme que cree, edite o elimine algo. Confirmaré antes de ejecutar cualquier acción." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [alerts, setAlerts] = useState<Array<{ kind: string; text: string }>>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<any>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!open || !workspaceId) return;
    alertsFn({ data: { workspace_id: workspaceId } })
      .then((r) => setAlerts(r.alerts ?? []))
      .catch(() => {});
  }, [open, workspaceId, alertsFn]);

  const SpeechRecognition = typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;
  const voiceSupported = !!SpeechRecognition;

  function toggleMic() {
    if (!voiceSupported) { toast.error("Tu navegador no soporta dictado por voz"); return; }
    if (listening) { recogRef.current?.stop(); return; }
    const rec = new SpeechRecognition();
    rec.lang = "es-CO";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const txt = e.results?.[0]?.[0]?.transcript?.trim();
      if (txt) send(txt);
    };
    rec.onerror = (e: any) => { toast.error(`Voz: ${e.error}`); setListening(false); };
    rec.onend = () => setListening(false);
    recogRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function send(textOverride?: string) {
    const msg = (textOverride ?? input).trim();
    if (!msg || !workspaceId || loading) return;
    if (!textOverride) setInput("");
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const m of messages) {
      if (m.role === "user") history.push({ role: "user", content: m.content });
      else if (m.role === "assistant") history.push({ role: "assistant", content: m.content });
      else if (m.role === "batch") {
        const done = m.actions.filter((a) => a.status === "done");
        if (done.length) history.push({ role: "assistant", content: done.map((a) => `✅ Registrado: ${a.summary}`).join("\n") });
      }
    }
    const trimmedHistory = history.slice(-12);
    const next: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await chatFn({ data: { workspace_id: workspaceId, message: msg, history: trimmedHistory } });
      if (res.type === "confirm") {
        const batch: Msg = {
          role: "batch",
          actions: res.actions.map((a) => ({ ...a, status: "pending" as const })),
        };
        setMessages([...next, batch]);
      } else {
        setMessages([...next, { role: "assistant", content: res.reply || "—" }]);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  function updateBatch(msgIdx: number, updater: (actions: PendingAction[]) => PendingAction[]) {
    setMessages((prev) =>
      prev.map((x, i): Msg => (i === msgIdx && x.role === "batch" ? { ...x, actions: updater(x.actions) } : x))
    );
  }

  async function runAction(msgIdx: number, actIdx: number) {
    const m = messages[msgIdx];
    if (m.role !== "batch" || !workspaceId) return;
    const a = m.actions[actIdx];
    if (!a || a.status !== "pending") return;
    setLoading(true);
    try {
      await execFn({ data: { workspace_id: workspaceId, name: a.name, args: a.args } });
      updateBatch(msgIdx, (acts) => acts.map((x, i) => (i === actIdx ? { ...x, status: "done" } : x)));
      alertsFn({ data: { workspace_id: workspaceId } }).then((r) => setAlerts(r.alerts ?? [])).catch(() => {});
    } catch (e: any) {
      updateBatch(msgIdx, (acts) => acts.map((x, i) => (i === actIdx ? { ...x, status: "error", error: e.message } : x)));
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  function cancelAction(msgIdx: number, actIdx: number) {
    updateBatch(msgIdx, (acts) => acts.map((x, i) => (i === actIdx ? { ...x, status: "cancelled" } : x)));
  }

  async function confirmAll(msgIdx: number) {
    const m = messages[msgIdx];
    if (m.role !== "batch") return;
    for (let i = 0; i < m.actions.length; i++) {
      if (m.actions[i].status === "pending") {
        // eslint-disable-next-line no-await-in-loop
        await runAction(msgIdx, i);
      }
    }
  }

  function cancelAll(msgIdx: number) {
    updateBatch(msgIdx, (acts) => acts.map((x) => (x.status === "pending" ? { ...x, status: "cancelled" } : x)));
  }

  function toggleEdit(msgIdx: number, actIdx: number) {
    updateBatch(msgIdx, (acts) => acts.map((x, i) => (i === actIdx ? { ...x, editing: !x.editing } : x)));
  }

  function updateArg(msgIdx: number, actIdx: number, key: string, value: any) {
    updateBatch(msgIdx, (acts) => acts.map((x, i) => {
      if (i !== actIdx) return x;
      const newArgs = { ...x.args, [key]: value };
      return { ...x, args: newArgs, summary: rebuildSummary(x.name, newArgs, x.summary) };
    }));
  }

  function rebuildSummary(name: string, args: any, fallback: string) {
    if (name === "create_transaction") {
      const cat = args.category_code ? ` · cat ${args.category_code}` : "";
      const cli = args.client_name ? ` · ${args.client_name}` : "";
      return `${args.type === "ingreso" ? "Ingreso" : "Egreso"} ${Number(args.amount ?? 0).toLocaleString("es-CO")} ${args.currency ?? "COP"} — ${args.concept ?? ""}${cat}${cli} · ${args.account ?? "bancolombia"} · ${args.date ?? "hoy"}`;
    }
    return fallback;
  }




  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <Brain className="size-5 text-primary" /> Centro de control
          </DialogTitle>
        </DialogHeader>

        {alerts.length > 0 && (
          <div className="px-5 py-2 border-b border-border bg-muted/50 space-y-1">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {a.kind === "warn" ? <AlertTriangle className="size-3 text-destructive" />
                  : a.kind === "ok" ? <CheckCircle2 className="size-3 text-green-600" />
                  : <Info className="size-3 text-primary" />}
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((m, i) => {
            if (m.role === "batch") {
              const pendingCount = m.actions.filter((a) => a.status === "pending").length;
              const isMulti = m.actions.length > 1;
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%] w-full rounded-2xl border border-border bg-card p-3 text-sm space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Confirmar {isMulti ? `${m.actions.length} acciones` : "acción"}
                    </div>
                    <div className="space-y-2">
                      {m.actions.map((a, j) => {
                        const statusLabel =
                          a.status === "done" ? "✅ Confirmada"
                          : a.status === "cancelled" ? "❌ Cancelada"
                          : a.status === "error" ? `⚠️ Error: ${a.error ?? ""}`
                          : null;
                        return (
                          <div key={j} className="rounded-lg border border-border/60 p-2 space-y-1 bg-background/40">
                            {isMulti && <div className="text-[10px] text-muted-foreground">#{j + 1}</div>}
                            <div className="whitespace-pre-wrap text-sm">{a.summary}</div>
                            {statusLabel ? (
                              <div className="text-xs text-muted-foreground">{statusLabel}</div>
                            ) : (
                              <>
                                {a.editing && a.name === "create_transaction" && (
                                  <div className="grid grid-cols-2 gap-2 pt-2 pb-1">
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Tipo</Label>
                                      <Select value={a.args.type ?? "egreso"} onValueChange={(v) => updateArg(i, j, "type", v)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ingreso">Ingreso</SelectItem>
                                          <SelectItem value="egreso">Egreso</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Moneda</Label>
                                      <Select value={a.args.currency ?? "COP"} onValueChange={(v) => updateArg(i, j, "currency", v)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="COP">COP</SelectItem>
                                          <SelectItem value="USD">USD</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Monto</Label>
                                      <Input className="h-8 text-xs" type="number" value={a.args.amount ?? ""} onChange={(e) => updateArg(i, j, "amount", parseFloat(e.target.value) || 0)} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Fecha</Label>
                                      <Input className="h-8 text-xs" type="date" value={a.args.date ?? ""} onChange={(e) => updateArg(i, j, "date", e.target.value)} />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                      <Label className="text-[10px]">Concepto</Label>
                                      <Input className="h-8 text-xs" value={a.args.concept ?? ""} onChange={(e) => updateArg(i, j, "concept", e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Categoría (código)</Label>
                                      <Input className="h-8 text-xs" value={a.args.category_code ?? ""} onChange={(e) => updateArg(i, j, "category_code", e.target.value)} placeholder="00001..00017" />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Cuenta</Label>
                                      <Select value={a.args.account ?? "bancolombia"} onValueChange={(v) => updateArg(i, j, "account", v)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="bancolombia">Bancolombia</SelectItem>
                                          <SelectItem value="stripe">Stripe</SelectItem>
                                          <SelectItem value="chase">Chase</SelectItem>
                                          <SelectItem value="efectivo">Efectivo</SelectItem>
                                          <SelectItem value="otra">Otra</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                      <Label className="text-[10px]">Cliente (opcional)</Label>
                                      <Input className="h-8 text-xs" value={a.args.client_name ?? ""} onChange={(e) => updateArg(i, j, "client_name", e.target.value)} />
                                    </div>
                                  </div>
                                )}
                                <div className="flex gap-2 pt-1 flex-wrap">
                                  <Button size="sm" onClick={() => runAction(i, j)} disabled={loading}>
                                    <Check className="size-3 mr-1" /> Confirmar
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => toggleEdit(i, j)} disabled={loading}>
                                    <Pencil className="size-3 mr-1" /> {a.editing ? "Listo" : "Editar"}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => cancelAction(i, j)} disabled={loading}>
                                    <X className="size-3 mr-1" /> Cancelar
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {isMulti && pendingCount > 0 && (
                      <div className="flex gap-2 pt-1 border-t border-border/60 mt-2">
                        <Button size="sm" onClick={() => confirmAll(i)} disabled={loading}>
                          <Check className="size-3 mr-1" /> Confirmar todas ({pendingCount})
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelAll(i)} disabled={loading}>
                          <X className="size-3 mr-1" /> Cancelar todas
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>{m.content}</div>
              </div>
            );
          })}
          {loading && <div className="text-xs text-muted-foreground">Pensando…</div>}
          {listening && <div className="text-xs text-primary animate-pulse">🎙️ Escuchando…</div>}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <Button
            type="button" onClick={toggleMic} size="icon"
            variant={listening ? "default" : "outline"}
            className={cn(listening && "animate-pulse")}
            title={voiceSupported ? "Dictar por voz" : "Dictado no soportado"}
          >
            {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </Button>
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={listening ? "Escuchando..." : "Escribe o dicta una orden o pregunta..."} disabled={loading} />
          <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon">
            <Send className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
