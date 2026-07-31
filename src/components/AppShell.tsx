import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  Repeat,
  Scale,
  BarChart3,
  Tag,
  Lightbulb,
  Menu,
  X,
  LogOut,
  User,
  Sparkles,
  CalendarDays,
  BellRing,
} from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo-mambaia.svg";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type NavItem = {
  to:
    | "/dashboard"
    | "/nova"
    | "/transacoes"
    | "/acertos"
    | "/fixos"
    | "/relatorios"
    | "/categorias"
    | "/quadro"
    | "/criar"
    | "/agenda"
    | "/alertas";
  label: string;
  icon: typeof LayoutDashboard;
  accent?: boolean;
};

const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/nova", label: "Nova", icon: PlusCircle, accent: true },
  { to: "/transacoes", label: "Transações", icon: Receipt },
  { to: "/quadro", label: "Ideias", icon: Lightbulb },
  { to: "/acertos", label: "Acertos", icon: Scale },
  { to: "/fixos", label: "Gastos Fixos", icon: Repeat },
  { to: "/criar", label: "Criar", icon: Sparkles },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/alertas", label: "Alertas", icon: BellRing },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/categorias", label: "Categorias", icon: Tag },
];

export function AppShell() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();

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
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Link
            to="/perfil"
            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent"
          >
            <Avatar className="w-8 h-8">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.display_name} />
              )}
              <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-foreground">
                {(profile?.display_name ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm min-w-0">
              <div className="font-medium truncate">{profile?.display_name ?? "Perfil"}</div>
              <div className="text-[11px] text-sidebar-foreground/60 truncate">Editar perfil</div>
            </div>
          </Link>
          <button
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div
        className="md:hidden fixed top-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-b border-sidebar-border"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 h-14 min-w-0">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 min-w-0"
            onClick={() => setOpen(false)}
          >
            <img src={logo} alt="Mambaia" className="w-8 h-8 rounded-md shrink-0" />
            <span className="font-semibold truncate">Mambaia</span>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <Link to="/perfil" className="p-1.5" onClick={() => setOpen(false)} aria-label="Perfil">
              <Avatar className="w-7 h-7">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={profile.display_name} />
                )}
                <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-foreground">
                  {(profile?.display_name ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <button onClick={() => setOpen((v) => !v)} className="p-2 -mr-2" aria-label="Menu">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-sidebar-border p-3 space-y-1 max-h-[calc(100vh-3.5rem-env(safe-area-inset-top))] overflow-y-auto">
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
            <Link
              to="/perfil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/80"
            >
              <User className="w-4 h-4" /> Meu perfil
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/80"
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </nav>
        )}
      </div>

      <main
        className="flex-1 min-w-0 md:ml-0 md:pt-0 md:pb-0"
        style={{
          paddingTop: "calc(3.5rem + env(safe-area-inset-top))",
          paddingBottom: "calc(5rem + env(safe-area-inset-bottom))",
        }}
      >
        <Outlet />
      </main>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {nav.slice(0, 5).map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium min-w-0 px-1 text-center leading-tight",
                  active ? "text-[color:var(--brand-lime)]" : "text-sidebar-foreground/70",
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0",
                    item.accent && "text-[color:var(--brand-lime)]",
                  )}
                />
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
