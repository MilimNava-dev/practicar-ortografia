import { BarChart3, Dumbbell, History, PenLine, SpellCheck } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { NativeSelect } from "@/components/ui/native-select";
import { useLang } from "@/lib/language-context";
import { LANGUAGES, type LangCode } from "@/lib/languages";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Escribir", icon: PenLine, end: true },
  { to: "/historial", label: "Historial", icon: History, end: false },
  { to: "/estadisticas", label: "Estadísticas", icon: BarChart3, end: false },
  { to: "/practicar", label: "Practicar", icon: Dumbbell, end: false },
];

export default function Layout() {
  const { lang, setLang } = useLang();

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <SpellCheck className="size-5" />
              Ortografía
            </div>
            <NativeSelect
              aria-label="Idioma"
              value={lang}
              onChange={(e) => setLang(e.target.value as LangCode)}
            >
              {Object.values(LANGUAGES).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <nav className="flex flex-wrap gap-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
