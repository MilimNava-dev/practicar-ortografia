import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Loader2, RotateCcw, SpellCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ERROR_TYPES } from "@/lib/classify";
import { dayKey } from "@/lib/dates";
import { useLang } from "@/lib/language-context";
import { addToSpeller, checkText, loadSpeller, type SpellIssue } from "@/lib/spell";
import { ignoreWord, saveCorrection, updateErrorCorrection } from "@/lib/storage";
import { cn } from "@/lib/utils";

type IssueState = SpellIssue & {
  errorId: string;
  status: "pending" | "fixed" | "ignored";
  fixedTo?: string;
};

export default function WritePage() {
  const { lang } = useLang();
  const [text, setText] = useState("");
  const [issues, setIssues] = useState<IssueState[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const prevLang = useRef(lang);

  useEffect(() => {
    // Precarga el diccionario (el catalán es grande y tarda unos segundos)
    loadSpeller(lang).catch(() => {});

    // Si cambias de idioma mientras revisas una corrección, volvemos al editor
    // conservando el texto, para no mezclar errores de dos idiomas.
    if (prevLang.current !== lang) {
      prevLang.current = lang;
      setReviewed(false);
      setIssues([]);
      setActiveIndex(null);
      setError(null);
    }
  }, [lang]);

  async function handleCheck() {
    setError(null);
    setChecking(true);
    try {
      const res = await checkText(text, lang);
      const { errorIds } = saveCorrection(
        lang,
        res.wordCount,
        res.issues.map((i) => ({
          wrong: i.word,
          right: i.suggestions[0] ?? "",
          type: i.type,
          before: i.before,
          after: i.after,
        })),
      );
      setIssues(res.issues.map((i, n) => ({ ...i, errorId: errorIds[n], status: "pending" })));
      setWordCount(res.wordCount);
      setReviewed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }

  function applyCorrection(index: number, replacement: string) {
    const issue = issues[index];
    const r = replacement.trim();
    if (!r || issue.status === "ignored") return;
    const delta = r.length - (issue.end - issue.start);
    setText((t) => t.slice(0, issue.start) + r + t.slice(issue.end));
    setIssues((list) =>
      list.map((it, n) => {
        if (n < index) return it;
        if (n === index) return { ...it, end: it.start + r.length, status: "fixed", fixedTo: r };
        return { ...it, start: it.start + delta, end: it.end + delta };
      }),
    );
    updateErrorCorrection(issue.errorId, r);
  }

  async function ignore(index: number) {
    const word = issues[index].word.toLowerCase();
    ignoreWord(lang, word);
    await addToSpeller(lang, word);
    setIssues((list) =>
      list.map((it) =>
        it.word.toLowerCase() === word && it.status === "pending" ? { ...it, status: "ignored" } : it,
      ),
    );
  }

  function reset() {
    setText("");
    setIssues([]);
    setReviewed(false);
    setActiveIndex(null);
    setError(null);
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `texto-corregido-${dayKey()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const segments = useMemo(() => {
    const out: Array<{ text: string; issueIndex?: number }> = [];
    let pos = 0;
    issues.forEach((it, n) => {
      if (it.start > pos) out.push({ text: text.slice(pos, it.start) });
      out.push({ text: text.slice(it.start, it.end), issueIndex: n });
      pos = it.end;
    });
    if (pos < text.length) out.push({ text: text.slice(pos) });
    return out;
  }, [text, issues]);

  const pending = issues.filter((i) => i.status === "pending").length;

  if (!reviewed) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Escribe lo que quieras</h1>
          <p className="text-muted-foreground text-sm">
            Cuando termines, pulsa «Corregir». Tus errores se guardarán en este navegador para
            ayudarte a practicar.
          </p>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe aquí tu texto…"
          className="min-h-64 text-base"
          spellCheck={false}
          autoFocus
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">
            {text.trim() ? text.trim().split(/\s+/).length : 0} palabras
          </span>
          <Button onClick={handleCheck} disabled={!text.trim() || checking}>
            {checking ? <Loader2 className="animate-spin" /> : <SpellCheck />}
            Corregir
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {issues.length === 0
              ? "Sin errores"
              : `${issues.length} ${issues.length === 1 ? "error" : "errores"} en ${wordCount} palabras`}
          </CardTitle>
          <CardDescription>
            {issues.length === 0
              ? "No se ha encontrado ningún error ortográfico."
              : pending > 0
                ? `Te quedan ${pending} por revisar. Pulsa una sugerencia para aplicarla.`
                : "Has revisado todos los errores."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-4 leading-8 whitespace-pre-wrap">
            {segments.map((seg, i) => {
              if (seg.issueIndex === undefined) return <span key={i}>{seg.text}</span>;
              const it = issues[seg.issueIndex];
              if (it.status === "ignored") return <span key={i}>{seg.text}</span>;
              return (
                <span
                  key={i}
                  onClick={() => {
                    setActiveIndex(seg.issueIndex!);
                    document
                      .getElementById(`issue-${seg.issueIndex}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className={cn(
                    "cursor-pointer rounded px-0.5",
                    it.status === "pending"
                      ? "bg-destructive/15 decoration-destructive underline decoration-wavy underline-offset-4"
                      : "bg-emerald-500/20",
                  )}
                >
                  {seg.text}
                </span>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={download}>
              <Download />
              Descargar texto
            </Button>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copiado" : "Copiar texto"}
            </Button>
            <Button variant="secondary" size="sm" onClick={reset}>
              <RotateCcw />
              Escribir otro texto
            </Button>
          </div>
        </CardContent>
      </Card>

      {issues.some((i) => i.status !== "ignored") && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Errores encontrados</h2>
          {issues.map((it, n) => {
            if (it.status === "ignored") return null;
            return (
              <IssueCard
                key={it.errorId}
                id={`issue-${n}`}
                issue={it}
                active={activeIndex === n}
                onApply={(r) => applyCorrection(n, r)}
                onIgnore={() => ignore(n)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function IssueCard({
  id,
  issue,
  active,
  onApply,
  onIgnore,
}: {
  id: string;
  issue: IssueState;
  active: boolean;
  onApply: (replacement: string) => void;
  onIgnore: () => void;
}) {
  const [custom, setCustom] = useState("");
  const typeInfo = ERROR_TYPES[issue.type];

  return (
    <Card id={id} className={cn("gap-3 py-4", active && "ring-ring ring-2")}>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-medium",
              issue.status === "fixed" ? "text-muted-foreground line-through" : "text-destructive",
            )}
          >
            {issue.word}
          </span>
          <Badge variant="outline">{typeInfo.label}</Badge>
          {issue.status === "fixed" && (
            <Badge variant="secondary" className="gap-1">
              <Check className="size-3" />
              Corregido: {issue.fixedTo}
            </Badge>
          )}
        </div>

        {issue.status === "pending" && (
          <>
            {issue.suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {issue.suggestions.map((s) => (
                  <Button key={s} size="sm" variant="secondary" onClick={() => onApply(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Sin sugerencias para esta palabra.</p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onApply(custom);
                setCustom("");
              }}
            >
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Otra corrección…"
                className="max-w-56"
              />
              <Button type="submit" size="sm" variant="outline" disabled={!custom.trim()}>
                Aplicar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onIgnore}>
                No es un error
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
