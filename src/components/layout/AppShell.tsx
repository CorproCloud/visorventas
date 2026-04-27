import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard, Users, Package, Table2, Database, Menu, X,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Users; exact?: boolean };

// Orden estricto solicitado
const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/", label: "Clientes", icon: Users, exact: true },
  { to: "/catalog", label: "Catálogo", icon: Package },
  { to: "/explorer", label: "Facturas", icon: Table2 },
  { to: "/data", label: "Datos", icon: Database },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState();
  const path = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Banner corporativo + navegación superior */}
      <header className="sticky top-0 z-40 bg-card border-b border-border shadow-[var(--shadow-sm)]">
        <div className="px-3 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-3 sm:gap-6">
            {/* Brand */}
            <Link
              to="/"
              className="flex items-center gap-2.5 sm:gap-3 shrink-0 group min-w-0"
            >
              <img
                src={logo}
                alt="Visor de Ventas"
                className="h-9 w-9 object-contain transition-transform group-hover:scale-105 shrink-0"
              />
              <div className="leading-tight min-w-0">
                <div className="text-[14px] sm:text-[15px] font-bold tracking-tight text-foreground truncate">
                  Visor de Ventas
                </div>
                <div className="hidden sm:block text-[11px] text-muted-foreground truncate">
                  Visualizador del Historial de ventas.
                </div>
              </div>
            </Link>

            {/* Separador vertical */}
            <div className="hidden lg:block h-8 w-px bg-border" />

            {/* Nav desktop */}
            <nav className="hidden lg:flex items-center gap-1 flex-1">
              {NAV.map((item) => {
                const active = item.exact ? path === item.to : path.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to as "/"}
                    className={cn(
                      "relative inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="uppercase tracking-wide text-[12px]">{item.label}</span>
                    {active && (
                      <span
                        className="absolute -bottom-[17px] left-2 right-2 h-0.5 rounded-full bg-brand-red"
                        aria-hidden
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Spacer para mobile */}
            <div className="flex-1 lg:hidden" />

            {/* Botón mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Menú"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Nav mobile desplegable */}
          {mobileOpen && (
            <nav className="lg:hidden pb-3 pt-1 grid grid-cols-1 gap-1 border-t border-border">
              {NAV.map((item) => {
                const active = item.exact ? path === item.to : path.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to as "/"}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground border-l-2 border-brand-red"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="uppercase tracking-wide text-[12px]">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {/* Contenido principal — full width, sin sidebar */}
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
