import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Trash2 } from "lucide-react";

import ActivityHeatmap from "@/components/ActivityHeatmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ERROR_TYPES } from "@/lib/classify";
import { useLang } from "@/lib/language-context";
import { LANGUAGES } from "@/lib/languages";
import { computeActivity, computeStats, resetAll } from "@/lib/storage";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function StatsPage() {
  const { lang } = useLang();
  const [version, setVersion] = useState(0);

  // `version` fuerza el recálculo tras borrar los datos
  const stats = useMemo(() => computeStats(lang), [lang, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const activity = useMemo(() => computeActivity(), [version]);

  function handleReset() {
    if (window.confirm("¿Borrar todos tus textos, errores y progreso (de todos los idiomas)? Esta acción no se puede deshacer.")) {
      resetAll();
      setVersion((v) => v + 1);
    }
  }

  const maxType = Math.max(...stats.byType.map((t) => t.count), 1);
  const maxDay = Math.max(...stats.daily.map((d) => d.errors), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Estadísticas</h1>
          <p className="text-muted-foreground text-sm">Todo se guarda solo en este navegador.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <Trash2 />
          Borrar datos
        </Button>
      </div>

      {/* Actividad: rachas + heatmap (todos los idiomas juntos) */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="gap-1 py-4">
          <CardContent>
            <div className="flex items-center gap-1.5 text-2xl font-semibold">
              <Flame className={activity.currentStreak > 0 ? "size-6 text-orange-500" : "text-muted-foreground size-6"} />
              {activity.currentStreak}
            </div>
            <div className="text-muted-foreground text-xs">
              {activity.currentStreak === 1 ? "día de racha" : "días de racha"}
            </div>
          </CardContent>
        </Card>
        <Kpi label={activity.longestStreak === 1 ? "día: mejor racha" : "días: mejor racha"} value={activity.longestStreak} />
        <Kpi label="Días con actividad" value={activity.activeDays} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividad</CardTitle>
          <CardDescription>
            Cada cuadro es un día en el que has escrito un texto o practicado (todos los idiomas). Pasa el ratón por
            encima para ver el detalle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap days={activity.days} />
        </CardContent>
      </Card>

      <h2 className="pt-2 text-lg font-semibold">{LANGUAGES[lang].label}</h2>

      {stats.texts === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay textos en este idioma.{" "}
          <Link to="/" className="underline">
            Escribe y corrige uno
          </Link>{" "}
          para empezar.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Textos" value={stats.texts} />
            <Kpi label="Palabras" value={stats.words} />
            <Kpi label="Errores" value={stats.errors} />
            <Kpi label="Errores / 100 palabras" value={stats.errorRate.toFixed(1)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tipos de error</CardTitle>
              <CardDescription>Dónde fallas más.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.byType.length === 0 && (
                <p className="text-muted-foreground text-sm">Sin errores registrados.</p>
              )}
              {stats.byType.map(({ type, count }) => (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{ERROR_TYPES[type].label}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="bg-secondary h-2 rounded-full">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${(count / maxType) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Palabras que más fallas</CardTitle>
              <CardDescription>
                {stats.mastered} dominadas · {stats.pending} pendientes de practicar.{" "}
                <Link to="/practicar" className="underline">
                  Practicar ahora
                </Link>{" "}
                ·{" "}
                <Link to="/historial" className="underline">
                  Ver historial completo
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {stats.topWords.map((w) => (
                  <li key={w.wrong} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="text-destructive">{w.wrong}</span>
                      {w.right && (
                        <>
                          {" → "}
                          <span className="font-medium">{w.right}</span>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{ERROR_TYPES[w.type].label}</Badge>
                      <span className="text-muted-foreground w-8 text-right">×{w.count}</span>
                      {w.mastered && <Badge variant="secondary">Dominada</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolución</CardTitle>
              <CardDescription>Errores por día (últimos 14 días con actividad).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-end gap-2">
                {stats.daily.map((d) => (
                  <div
                    key={d.day}
                    className="flex flex-1 flex-col items-center gap-1"
                    title={`${d.day}: ${plural(d.errors, "error", "errores")} en ${plural(d.words, "palabra", "palabras")}`}
                  >
                    <span className="text-muted-foreground text-xs">{d.errors}</span>
                    <div
                      className="bg-primary w-full rounded-t"
                      style={{ height: `${Math.max((d.errors / maxDay) * 80, d.errors ? 4 : 1)}px` }}
                    />
                    <span className="text-muted-foreground text-[10px]">{d.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-muted-foreground text-xs">{label}</div>
      </CardContent>
    </Card>
  );
}
