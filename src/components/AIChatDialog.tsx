import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Brain } from "lucide-react";
import { chatFinanciero } from "@/lib/ai.functions";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

export function AIChatDialog({
  open, onOpenChange, workspaceId,
}: { open: boolean; onOpenChange: (v: boolean) => void; workspaceId: string | undefined }) {
  const fn = useServerFn(chatFinanciero);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hola 👋 Soy tu asistente financiero. Pregúntame por ingresos, gastos, cartera o punto de equilibrio." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || !workspaceId || loading) return;
    const msg = input.trim();
    setInput("");
    const newMessages: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const { reply } = await fn({ data: {
        workspace_id: workspaceId, message: msg,
        history: messages.slice(-10),
      }});
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-5 py-4 border-b border-border">
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <Brain className="size-5 text-primary" /> Chat financiero
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>{m.content}</div>
            </div>
          ))}
          {loading && <div className="text-xs text-muted-foreground">Pensando…</div>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-border p-3 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Escribe tu pregunta..." disabled={loading} />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon">
            <Send className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
