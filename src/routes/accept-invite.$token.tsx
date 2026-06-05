import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation } from "@/lib/finanzas.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/accept-invite/$token")({
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const acceptFn = useServerFn(acceptInvitation);
  const [status, setStatus] = useState<"loading" | "need-auth" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setStatus("need-auth"); return; }
      try {
        await acceptFn({ data: { token } });
        setStatus("ok");
        setTimeout(() => navigate({ to: "/dashboard" }), 1500);
      } catch (e: any) {
        setStatus("error"); setMsg(e.message);
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="font-serif text-3xl">Invitación al equipo</h1>
        {status === "loading" && <p className="text-sm text-muted-foreground">Procesando…</p>}
        {status === "need-auth" && (
          <>
            <p className="text-sm">Inicia sesión o crea una cuenta para aceptar esta invitación.</p>
            <div className="flex gap-2 justify-center">
              <Button asChild><Link to="/login" search={{ redirect: `/accept-invite/${token}` }}>Iniciar sesión</Link></Button>
              <Button variant="outline" asChild><Link to="/signup" search={{ invite: token }}>Crear cuenta</Link></Button>
            </div>
          </>
        )}
        {status === "ok" && <p className="text-sm text-primary">¡Listo! Redirigiendo…</p>}
        {status === "error" && <p className="text-sm text-destructive">{msg}</p>}
      </div>
    </div>
  );
}
