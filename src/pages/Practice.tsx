import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ERROR_TYPES } from "@/lib/classify";
import { useLang } from "@/lib/language-context";
import type { LangCode } from "@/lib/languages";
import { getPracticeItems, MASTERED_STREAK, recordPractice, type PracticeItem } from "@/lib/storage";

const SESSION_SIZE = 10;

const normalize = (s: string) => s.trim().normalize("NFC").toLowerCase();

function newSession(lang: LangCode): PracticeItem[] {
  return getPracticeItems(lang)
    .filter((i) => i.progress.right)
    .slice(0, SESSION_SIZE);
}

export default function PracticePage() {
  const { lang } = useLang();
  // `key` reinicia la sesión al cambiar de idioma
  return <PracticeSession key={lang} lang={lang} />;
}

function PracticeSession({ lang }: { lang: LangCode }) {
  const [queue, setQueue] = useState<PracticeItem[]>(() => newSession(lang));
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState(0);

  function restart() {
    setQueue(newSession(lang));
    setIndex(0);
    setAnswer("");
    setResult(null);
    setScore(0);
  }

  if (queue.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Practicar</h1>
        <p className="text-muted-foreground text-sm">
          No tienes palabras pendientes. <Link to="/" className="underline">Escribe y corrige un texto</Link> para
          generar ejercicios con tus propios errores.
        </p>
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sesión terminada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Has acertado {score} de {queue.length}.
          </p>
          <div className="flex gap-2">
            <Button onClick={restart}>
              <RotateCcw />
              Otra ronda
            </Button>
            <Button variant="outline" asChild>
              <Link to="/estadisticas">Ver estadísticas</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const item = queue[index];
  const { progress, before, after } = item;
  const hasContext = before.trim() !== "" || after.trim() !== "";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (result || !answer.trim()) return;
    const ok = normalize(answer) === normalize(progress.right);
    recordPractice(progress.key, ok);
    setResult(ok ? "correct" : "wrong");
    if (ok) setScore((s) => s + 1);
  }

  function next() {
    setIndex((i) => i + 1);
    setAnswer("");
    setResult(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Practicar</h1>
          <p className="text-muted-foreground text-sm">
            Escribe la forma correcta. Una palabra se da por dominada tras {MASTERED_STREAK} aciertos seguidos.
          </p>
        </div>
        <span className="text-muted-foreground text-sm">
          {index + 1} / {queue.length}
        </span>
      </div>

      <Card>
        <CardContent className="space-y-5">
          <div className="text-lg leading-8">
            {hasContext ? (
              <>
                {before}
                <span className="border-primary mx-1 inline-block min-w-24 border-b-2 text-center">
                  {result ? progress.right : " "}
                </span>
                {after}
              </>
            ) : (
              <>Escribe correctamente la palabra que antes escribiste como «{progress.wrong}».</>
            )}
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{ERROR_TYPES[progress.type].label}</Badge>
            {hasContext && (
              <span>
                La escribiste así: <span className="text-destructive">{progress.wrong}</span>
              </span>
            )}
          </div>

          <form onSubmit={submit} className="flex gap-2">
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={result !== null}
              placeholder="Tu respuesta"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="max-w-xs"
            />
            {result === null && (
              <Button type="submit" disabled={!answer.trim()}>
                Comprobar
              </Button>
            )}
          </form>

          {result && (
            <div className="space-y-3">
              {result === "correct" ? (
                <p className="flex items-center gap-2 text-emerald-600">
                  <Check className="size-4" /> ¡Correcto!
                </p>
              ) : (
                <p className="text-destructive flex items-center gap-2">
                  <X className="size-4" /> Era «{progress.right}».
                </p>
              )}
              <Button onClick={next} autoFocus>
                {index + 1 === queue.length ? "Terminar" : "Siguiente"}
                <ArrowRight />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
