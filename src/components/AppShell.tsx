import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, ListOrdered, Settings, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppShell({ children, onOpenAI }: { children: ReactNode; onOpenAI?: () => void }) {
  const navigate = useNavigate();
  const loc = useLocation();

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/transacciones", label: "Transacciones", icon: ListOrdered },
    { to: "/settings/fixed-costs", label: "Costos fijos", icon: Settings },
    { to: "/settings/team", label: "Equipo", icon: Settings },
    { to: "/settings/general", label: "General", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="font-serif text-2xl text-foreground">Neuro Finanzas</Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => {
              const active = loc.pathname.startsWith(n.to);
              return (
                <Link key={n.to} to={n.to as any}
                  className={cn("px-3 py-1.5 rounded-md text-sm hover:bg-accent",
                    active && "bg-accent text-accent-foreground")}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="size-4" />
          </Button>
        </div>
        <nav className="md:hidden border-t border-border flex">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to as any}
                className={cn("flex-1 py-2 text-center text-xs flex flex-col items-center gap-0.5",
                  active ? "text-primary" : "text-muted-foreground")}>
                <Icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      {onOpenAI && (
        <button onClick={onOpenAI}
          className="fixed bottom-20 md:bottom-6 right-4 size-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
          <Brain className="size-6" />
        </button>
      )}
    </div>
  );
}
