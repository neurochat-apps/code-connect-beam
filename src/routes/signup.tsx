import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation } from "@/lib/finanzas.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  validateSearch: (s) => ({ invite: (s.invite as string) || "" }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { invite } = Route.useSearch();
  const acceptFn = useServerFn(acceptInvitation);
  const [fullName, setFullName] = useState("");
  const [workspace, setWorkspace] = useState("Neurochat");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isInvited = Boolean(invite);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: isInvited
          ? { full_name: fullName, pending_invite_token: invite }
          : { full_name: fullName, workspace_name: workspace },
      },
    });
    if (error) { setLoading(false); toast.error(error.message); return; }

    // Si el proyecto exige confirmar email, no habrá sesión aún.
    const { data: sess } = await supabase.auth.getSession();
    if (isInvited && sess.session) {
      try {
        await acceptFn({ data: { token: invite } });
        toast.success("Cuenta creada y unida al equipo");
      } catch (e: any) {
        toast.error(`Cuenta creada, pero no pude unir el equipo: ${e.message}`);
      }
    } else {
      toast.success("Cuenta creada");
    }
    setLoading(false);
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground">Neuro Finanzas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isInvited ? "Crea tu cuenta para unirte al equipo" : "Crea tu cuenta y espacio de trabajo"}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-2xl bg-card border border-border p-6 shadow-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tu nombre</Label>
            <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          {!isInvited && (
            <div className="space-y-2">
              <Label htmlFor="ws">Nombre del espacio</Label>
              <Input id="ws" required value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creando..." : "Crear cuenta"}
          </Button>
          <p className="text-xs text-muted-foreground text-center pt-2">
            ¿Ya tienes cuenta?{" "}
            <Link
              to="/login"
              search={isInvited ? { redirect: `/accept-invite/${invite}` } : { redirect: "/dashboard" }}
              className="text-primary hover:underline"
            >
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
