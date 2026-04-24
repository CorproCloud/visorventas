import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Home, Table2, Package, Database, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Inicio", icon: Home, exact: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/explorer", label: "Explorador", icon: Table2 },
  { to: "/catalog", label: "Catálogo", icon: Package },
  { to: "/data", label: "Datos", icon: Database },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState();
  const path = location.pathname;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-6 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-10 w-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center overflow-hidden">
            <img src={logo} alt="Logo" width={40} height={40} className="h-8 w-8 object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">Pulse BI</div>
            <div className="text-[11px] text-sidebar-foreground/60">Sales Intelligence</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-white shadow-[inset_3px_0_0_0_var(--brand-red)]"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="rounded-lg bg-white/5 p-3 ring-1 ring-white/5">
            <div className="flex items-center gap-2 text-xs text-white">
              <Sparkles className="h-3.5 w-3.5 text-emerald" />
              <span className="font-medium">Datos locales</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/60">
              Tus archivos se procesan en el navegador.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border flex items-center justify-around py-2">
        {NAV.map((item) => {
          const active = item.exact ? path === item.to : path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px]",
                active ? "text-brand-red" : "text-sidebar-foreground/70",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 min-w-0 pb-16 md:pb-0">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <img src={logo} alt="Logo" width={32} height={32} className="h-7 w-7" />
          <div className="text-sm font-semibold">Pulse BI</div>
        </div>
        {children}
      </main>
    </div>
  );
}
