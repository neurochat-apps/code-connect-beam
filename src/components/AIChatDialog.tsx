import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Brain, Mic, MicOff, Check, X, Pencil, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { chatFinanciero, executeAction, getChatAlerts } from "@/lib/ai.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PendingAction = { name: string; args: Record<string, any>; summary: string };

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "pending"; action: PendingAction; resolved?: "done" | "cancelled" | "edited" };

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
    const history = messages
      .filter((m): m is Extract<Msg, { role: "user" | "assistant" }> => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    const next: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await chatFn({ data: { workspace_id: workspaceId, message: msg, history } });
      if (res.type === "confirm") {
        setMessages([...next, { role: "pending", action: res.action as PendingAction & { summary: string }, ...{ } } as any]);
        setMessages((prev) => {
          // Reemplazar el último (que añadimos arriba) con uno bien tipado
          const arr = prev.slice();
          arr[arr.length - 1] = { role: "pending", action: { name: res.action.name, args: res.action.args, summary: res.summary } };
          return arr;
        });
      } else {
        setMessages([...next, { role: "assistant", content: res.reply || "—" }]);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  async function confirmPending(idx: number) {
    const m = messages[idx];
    if (m.role !== "pending" || !workspaceId) return;
    setLoading(true);
    try {
      await execFn({ data: { workspace_id: workspaceId, name: m.action.name, args: m.action.args } });
      setMessages((prev) => prev.map((x, i) => i === idx && x.role === "pending" ? { ...x, resolved: "done" } : x).concat([{ role: "assistant", content: "✅ Hecho." }]));
      // refrescar alertas
      alertsFn({ data: { workspace_id: workspaceId } }).then((r) => setAlerts(r.alerts ?? [])).catch(() => {});
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  function cancelPending(idx: number) {
    setMessages((prev) => prev.map((x, i) => i === idx && x.role === "pending" ? { ...x, resolved: "cancelled" } : x).concat([{ role: "assistant", content: "❌ Acción cancelada." }]));
  }

  function editPending(idx: number) {
    const m = messages[idx];
    if (m.role !== "pending") return;
    setInput(`Ajusta: ${m.action.summary.replace(/\n/g, " · ")}`);
    setMessages((prev) => prev.map((x, i) => i === idx && x.role === "pending" ? { ...x, resolved: "edited" } : x));
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
            if (m.role === "pending") {
              const disabled = !!m.resolved;
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl border border-border bg-card p-3 text-sm space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">Confirmar acción</div>
                    <div className="whitespace-pre-wrap">{m.action.summary}</div>
                    {m.resolved ? (
                      <div className="text-xs text-muted-foreground">
                        {m.resolved === "done" ? "Confirmada" : m.resolved === "cancelled" ? "Cancelada" : "Editada"}
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" onClick={() => confirmPending(i)} disabled={disabled || loading}>
                          <Check className="size-3 mr-1" /> Confirmar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => editPending(i)} disabled={disabled || loading}>
                          <Pencil className="size-3 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelPending(i)} disabled={disabled || loading}>
                          <X className="size-3 mr-1" /> Cancelar
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
