import { useEffect, useMemo, useRef } from "react";

import { addDays, dayKey } from "@/lib/dates";
import type { DayActivity } from "@/lib/storage";
import { cn } from "@/lib/utils";

const WEEKS = 53;
const CELL = 11; // px
const GAP = 3; // px

const LEVEL_CLASSES = [
  "bg-secondary",
  "bg-emerald-500/25",
  "bg-emerald-500/50",
  "bg-emerald-500/75",
  "bg-emerald-500",
];

/** Un texto pesa el doble que un ejercicio de práctica. */
function level(a?: DayActivity): number {
  const score = a ? a.texts * 2 + a.practice : 0;
  if (score === 0) return 0;
  if (score <= 2) return 1;
  if (score <= 5) return 2;
  if (score <= 9) return 3;
  return 4;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const DAY_LABELS = ["L", "", "X", "", "V", "", "D"]; // lunes a domingo

export default function ActivityHeatmap({ days }: { days: Record<string, DayActivity> }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7; // lunes = 0
    const start = addDays(today, -(7 * (WEEKS - 1) + dow));
    return Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDays(start, w * 7 + d);
        return date.getTime() > today.getTime() ? null : date;
      }),
    );
  }, []);

  // Empezar viendo lo más reciente (extremo derecho)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const monthLabels = columns.map((col, w) => {
    const first = col[0]; // el lunes de esa semana (siempre existe salvo en el futuro)
    if (!first) return "";
    const prevFirst = w > 0 ? columns[w - 1][0] : null;
    if (prevFirst && prevFirst.getMonth() === first.getMonth()) return "";
    return first.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  });

  return (
    <div className="space-y-2">
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div className="flex w-max gap-2">
          {/* Etiquetas de los días */}
          <div className="flex flex-col" style={{ gap: GAP, paddingTop: CELL + GAP + 2 }}>
            {DAY_LABELS.map((l, i) => (
              <div
                key={i}
                className="text-muted-foreground text-[10px]"
                style={{ height: CELL, lineHeight: `${CELL}px` }}
              >
                {l}
              </div>
            ))}
          </div>

          <div>
            {/* Etiquetas de los meses */}
            <div className="flex" style={{ gap: GAP, height: CELL + 2, marginBottom: GAP }}>
              {monthLabels.map((label, w) => (
                <div
                  key={w}
                  className="text-muted-foreground text-[10px] whitespace-nowrap"
                  style={{ width: CELL }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Celdas */}
            <div className="flex" style={{ gap: GAP }}>
              {columns.map((col, w) => (
                <div key={w} className="flex flex-col" style={{ gap: GAP }}>
                  {col.map((date, d) => {
                    if (!date) return <div key={d} style={{ width: CELL, height: CELL }} />;
                    const key = dayKey(date);
                    const a = days[key];
                    const dateLabel = date.toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                    const detail =
                      a && a.texts + a.practice > 0
                        ? `${plural(a.texts, "texto", "textos")} · ${plural(a.practice, "ejercicio", "ejercicios")}`
                        : "sin actividad";
                    return (
                      <div
                        key={d}
                        title={`${dateLabel}: ${detail}`}
                        className={cn("rounded-[2px]", LEVEL_CLASSES[level(a)])}
                        style={{ width: CELL, height: CELL }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-muted-foreground flex items-center justify-end gap-1.5 text-[11px]">
        Menos
        {LEVEL_CLASSES.map((c) => (
          <div key={c} className={cn("rounded-[2px]", c)} style={{ width: CELL, height: CELL }} />
        ))}
        Más
      </div>
    </div>
  );
}
