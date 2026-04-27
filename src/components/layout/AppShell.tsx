import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Home, Table2, Package, Database, Users } from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Home; exact?: boolean };

const NAV: NavItem[] = [
  { to: "/", label: "Clientes", icon: Users, exact: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/explorer", label: "Facturas", icon: Table2 },
  { to: "/catalog", label: "Catálogo", icon: Package },
  { to: "/data", label: "Datos", icon: Database },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState();
  const path = location.pathname;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top banner — corporate header */}
      <header className="bg-card border-b border-border">
        <div className="px-5 sm:px-8 py-4 flex items-center gap-4">
          <img src={logo} alt="Logo" className="h-10 w-10 object-contain" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight">
              Centro de Cobranza
            </h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Cobranza sistematizada
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — desktop */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {NAV.map((item) => {
              const active = item.exact ? path === item.to : path.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to as "/"}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
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
          <div className="px-4 py-3 border-t border-sidebar-border text-[10px] text-sidebar-foreground/50">
            v1.0 · uso interno
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
                to={item.to as "/"}
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

        <main className="flex-1 min-w-0 pb-16 md:pb-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
