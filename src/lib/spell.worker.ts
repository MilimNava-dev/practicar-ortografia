import NSpell from "nspell";

import { classifyError, stripAccents, type ErrorType } from "./classify";
import { LANGUAGES, type LangCode } from "./languages";

export interface SpellIssue {
  word: string;
  start: number;
  end: number;
  suggestions: string[];
  type: ErrorType;
  before: string;
  after: string;
}

export interface CheckResult {
  issues: SpellIssue[];
  wordCount: number;
}

type Speller = ReturnType<typeof NSpell>;

interface WorkerRequest {
  id: number;
  type: "load" | "check" | "add";
  lang: LangCode;
  text?: string;
  words?: string[];
  word?: string;
}

interface WorkerResponse {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

const spellers = new Map<LangCode, Speller>();

function respond(id: number, result?: unknown) {
  workerScope.postMessage({ id, ok: true, result });
}

function respondError(id: number, error: unknown) {
  workerScope.postMessage({
    id,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

async function loadDictionary(
  lang: LangCode,
  personalWords: string[],
): Promise<void> {
  if (spellers.has(lang)) {
    const existing = spellers.get(lang)!;

    for (const word of personalWords) {
      existing.add(word);
    }

    return;
  }

  const base = LANGUAGES[lang].dictPath;

  const [affResponse, dicResponse] = await Promise.all([
    fetch(`${base}/index.aff`),
    fetch(`${base}/index.dic`),
  ]);

  if (!affResponse.ok || !dicResponse.ok) {
    throw new Error(
      `No se pudo cargar el diccionario de ${LANGUAGES[lang].label}. ` +
        `Comprueba que existen ${base}/index.aff e index.dic.`,
    );
  }

  const [aff, dic] = await Promise.all([
    affResponse.text(),
    dicResponse.text(),
  ]);

  // Esta construcción puede ser costosa, pero ahora ocurre en el Worker.
  const speller = NSpell(aff, dic);

  for (const word of personalWords) {
    speller.add(word);
  }

  spellers.set(lang, speller);
}

const WORD_RE = /\p{L}+(?:·\p{L}+)*/gu;

function matchCase(original: string, suggestion: string): string {
  if (original.length > 1 && original === original.toUpperCase()) {
    return suggestion.toUpperCase();
  }

  if (
    original[0] !== original[0].toLowerCase() &&
    suggestion[0] === suggestion[0].toLowerCase()
  ) {
    return suggestion[0].toUpperCase() + suggestion.slice(1);
  }

  return suggestion;
}

function rankSuggestions(word: string, raw: string[]): string[] {
  const target = stripAccents(word.toLowerCase());
  const sameLetters: string[] = [];
  const others: string[] = [];

  for (const suggestion of raw) {
    if (/\s/.test(suggestion)) continue;

    (
      stripAccents(suggestion.toLowerCase()) === target
        ? sameLetters
        : others
    ).push(matchCase(word, suggestion));
  }

  return [...sameLetters, ...others].slice(0, 5);
}

function sentenceContext(text: string, start: number, end: number) {
  const boundary = /[.!?¡¿\n]/;

  let s = start;
  while (s > 0 && !boundary.test(text[s - 1])) s--;

  let e = end;
  while (e < text.length && !boundary.test(text[e])) e++;

  const clip = (str: string, fromEnd: boolean) =>
    str.length > 120
      ? fromEnd
        ? "…" + str.slice(-120)
        : str.slice(0, 120) + "…"
      : str;

  return {
    before: clip(text.slice(s, start).trimStart(), true),
    after: clip(text.slice(end, e), false),
  };
}

function checkText(text: string, lang: LangCode): CheckResult {
  const speller = spellers.get(lang);

  if (!speller) {
    throw new Error(`El diccionario de ${lang} todavía no está cargado.`);
  }

  const suggestionCache = new Map<string, string[]>();
  const issues: SpellIssue[] = [];
  let wordCount = 0;

  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0];
    const start = match.index ?? 0;
    const end = start + word.length;

    wordCount++;

    // Letras sueltas y siglas cortas en mayúsculas: no se corrigen.
    if (word.length < 2) continue;
    if (word.length <= 5 && word === word.toUpperCase()) continue;

    if (speller.correct(word) || speller.correct(word.toLowerCase())) {
      continue;
    }

    const key = word.toLowerCase();
    let suggestions = suggestionCache.get(key);

    if (!suggestions) {
      suggestions = rankSuggestions(word, speller.suggest(word));
      suggestionCache.set(key, suggestions);
    }

    const type: ErrorType = suggestions[0]
      ? classifyError(word, suggestions[0], lang)
      : "otro";

    issues.push({
      word,
      start,
      end,
      suggestions,
      type,
      ...sentenceContext(text, start, end),
    });
  }

  return { issues, wordCount };
}

workerScope.onmessage = async (event) => {
  const { id, type, lang, text, words, word } = event.data;

  try {
    switch (type) {
      case "load": {
        await loadDictionary(lang, words ?? []);
        respond(id);
        break;
      }

      case "check": {
        respond(id, checkText(text ?? "", lang));
        break;
      }

      case "add": {
        const speller = spellers.get(lang);

        if (!speller) {
          throw new Error("El diccionario todavía no está cargado.");
        }

        speller.add(word ?? "");
        respond(id);
        break;
      }
    }
  } catch (error) {
    respondError(id, error);
  }
};
