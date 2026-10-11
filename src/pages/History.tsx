import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ERROR_TYPES } from "@/lib/classify";
import { useLang } from "@/lib/language-context";
import { LANGUAGES } from "@/lib/languages";
import { deleteWord, getHistory } from "@/lib/storage";

const formatDate = (ts: number) =>
  ts ? new Date(ts).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function HistoryPage() {
  const { lang } = useLang();
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");

  // `version` fuerza el recálculo tras eliminar una palabra
  const items = useMemo(() => getHistory(lang), [lang, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = query.trim().toLowerCase();
  const visible = q
    ? items.filter((i) => i.wrong.toLowerCase().includes(q) || i.right.toLowerCase().includes(q))
    : items;

  function handleDelete(wrong: string) {
    if (
      window.confirm(
        `¿Eliminar «${wrong}» del historial? Dejará de contar en las estadísticas y en la práctica. ` +
          "Si vuelves a fallarla, se registrará de nuevo.",
      )
    ) {
      deleteWord(lang, wrong);
      setVersion((v) => v + 1);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Historial de errores</h1>
        <p className="text-muted-foreground text-sm">
          Todos los errores que has cometido en {LANGUAGES[lang].label.toLowerCase()}. Aquí no desaparecen nunca,
          ni siquiera cuando dominas una palabra: solo se quitan si los eliminas tú. Úsalo para borrar los fallos
          tontos o las erratas puntuales.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay errores en este idioma.{" "}
          <Link to="/" className="underline">
            Escribe y corrige un texto
          </Link>{" "}
          para empezar.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar palabra…"
              className="max-w-xs"
            />
            <span className="text-muted-foreground text-sm">
              {visible.length} {visible.length === 1 ? "palabra" : "palabras"}
            </span>
          </div>

          <Card className="py-0">
            <CardContent className="px-0">
              <ul className="divide-y">
                {visible.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm">
                        <span className="text-destructive">{item.wrong}</span>
                        {item.right && (
                          <>
                            {" → "}
                            <span className="font-medium">{item.right}</span>
                          </>
                        )}
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <Badge variant="outline">{ERROR_TYPES[item.type].label}</Badge>
                        <span>
                          {item.count} {item.count === 1 ? "vez" : "veces"}
                        </span>
                        <span>· última: {formatDate(item.lastSeen)}</span>
                        {item.attempts > 0 && (
                          <span>
                            · práctica: {item.correct}/{item.attempts}
                          </span>
                        )}
                        {item.mastered && <Badge variant="secondary">Dominada</Badge>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Eliminar ${item.wrong}`}
                      title="Eliminar del historial"
                      onClick={() => handleDelete(item.wrong)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
                {visible.length === 0 && (
                  <li className="text-muted-foreground px-4 py-6 text-center text-sm">Sin resultados.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
