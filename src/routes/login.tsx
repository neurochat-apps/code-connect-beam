import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; next?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const redirect = search.next ? oauthReturnPath(search.next) : search.redirect ? oauthReturnPath(search.redirect) : "/dashboard";
  const navigate = useNavigate();
  const goTo = (p: string, replace = false) => {
    if (p.startsWith("/.lovable/")) { window.location.assign(p); return; }
    navigate({ to: p as any, replace });
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive && data.user) goTo(redirect, true);
    });
    return () => { alive = false; };
  }, [navigate, redirect]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Bienvenido");
    goTo(redirect);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl text-foreground">Neuro Finanzas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inicia sesión para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-2xl bg-card border border-border p-6 shadow-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <div className="flex justify-between text-xs text-muted-foreground pt-2">
            <Link to="/signup" className="hover:text-primary">Crear cuenta</Link>
            <Link to="/forgot-password" className="hover:text-primary">¿Olvidaste tu contraseña?</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
