import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  Repeat,
  Scale,
  BarChart3,
  Tag,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo-mambaia.svg";
import { cn } from "@/lib/utils";

type NavItem = {
  to: "/" | "/nova" | "/transacoes" | "/acertos" | "/fixos" | "/relatorios" | "/categorias";
  label: string;
  icon: typeof LayoutDashboard;
  accent?: boolean;
};

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/nova", label: "Nova", icon: PlusCircle, accent: true },
  { to: "/transacoes", label: "Transações", icon: Receipt },
  { to: "/acertos", label: "Acertos", icon: Scale },
  { to: "/fixos", label: "Gastos Fixos", icon: Repeat },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/categorias", label: "Categorias", icon: Tag },
];

export function AppShell() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-6 flex items-center gap-3 border-b border-sidebar-border">
          <img src={logo} alt="Mambaia" className="w-10 h-10 rounded-lg" />
          <div>
            <div className="font-semibold tracking-tight">Mambaia</div>
            <div className="text-xs text-sidebar-foreground/60">Financeiro</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  item.accent && !active && "text-[color:var(--brand-lime)]",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 text-xs text-sidebar-foreground/50">
          Conecta. Cultiva. Transforma.
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <img src={logo} alt="Mambaia" className="w-8 h-8 rounded-md" />
            <span className="font-semibold">Mambaia</span>
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-2 -mr-2"
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-sidebar-border p-3 space-y-1">
            {nav.map((item) => {
              const active = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>

      <main className="flex-1 md:ml-0 pt-14 md:pt-0 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border">
        <div className="grid grid-cols-5">
          {nav.slice(0, 5).map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium",
                  active ? "text-[color:var(--brand-lime)]" : "text-sidebar-foreground/70",
                )}
              >
                <Icon className={cn("w-5 h-5", item.accent && "text-[color:var(--brand-lime)]")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}