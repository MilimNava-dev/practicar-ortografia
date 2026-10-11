import { classifyError, type ErrorType } from "./classify";
import { addDays, dayKey, parseKey } from "./dates";
import type { LangCode } from "./languages";

const STORAGE_KEY = "ortografia:v1";
export const MASTERED_STREAK = 3;

export interface TextEntry {
  id: string;
  lang: LangCode;
  createdAt: number;
  wordCount: number;
  errorCount: number;
}

export interface ErrorRecord {
  id: string;
  textId: string;
  lang: LangCode;
  wrong: string;
  right: string;
  type: ErrorType;
  before: string;
  after: string;
  createdAt: number;
}

/** Progreso de práctica por palabra (clave: idioma + palabra incorrecta en minúsculas) */
export interface WordProgress {
  key: string;
  lang: LangCode;
  wrong: string;
  right: string;
  type: ErrorType;
  attempts: number;
  correct: number;
  streak: number;
  mastered: boolean;
  lastPracticed?: number;
}

interface DB {
  texts: TextEntry[];
  errors: ErrorRecord[];
  progress: Record<string, WordProgress>;
  personal: Partial<Record<LangCode, string[]>>;
  /** Ejercicios de práctica respondidos por día (YYYY-MM-DD), de todos los idiomas */
  practiceByDay: Record<string, number>;
}

const emptyDB = (): DB => ({ texts: [], errors: [], progress: {}, personal: {}, practiceByDay: {} });

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDB();
    return { ...emptyDB(), ...(JSON.parse(raw) as Partial<DB>) };
  } catch {
    return emptyDB();
  }
}

function save(db: DB) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

const uid = () => crypto.randomUUID();
const progressKey = (lang: LangCode, wrong: string) => `${lang}:${wrong.toLowerCase()}`;

// ---------- Lectura ----------

export function getDB(): DB {
  return load();
}

export function getPersonalWords(lang: LangCode): string[] {
  return load().personal[lang] ?? [];
}

// ---------- Escritura ----------

export interface NewIssue {
  wrong: string;
  right: string;
  type: ErrorType;
  before: string;
  after: string;
}

/** Guarda un texto corregido y sus errores. Devuelve el id del texto y de cada error (mismo orden). */
export function saveCorrection(
  lang: LangCode,
  wordCount: number,
  issues: NewIssue[],
): { textId: string; errorIds: string[] } {
  const db = load();
  const now = Date.now();
  const textId = uid();

  db.texts.push({ id: textId, lang, createdAt: now, wordCount, errorCount: issues.length });

  const errorIds = issues.map((issue) => {
    const id = uid();
    db.errors.push({ id, textId, lang, createdAt: now, ...issue });

    const key = progressKey(lang, issue.wrong);
    const existing = db.progress[key];
    db.progress[key] = existing
      ? { ...existing, right: issue.right, type: issue.type, streak: 0, mastered: false }
      : {
          key,
          lang,
          wrong: issue.wrong.toLowerCase(),
          right: issue.right.toLowerCase(),
          type: issue.type,
          attempts: 0,
          correct: 0,
          streak: 0,
          mastered: false,
        };
    return id;
  });

  save(db);
  return { textId, errorIds };
}

/** La persona eligió otra corrección distinta de la sugerida por defecto. */
export function updateErrorCorrection(errorId: string, right: string) {
  const db = load();
  const err = db.errors.find((e) => e.id === errorId);
  if (!err) return;
  err.right = right;
  err.type = classifyError(err.wrong, right, err.lang);
  const p = db.progress[progressKey(err.lang, err.wrong)];
  if (p) {
    p.right = right.toLowerCase();
    p.type = err.type;
  }
  save(db);
}

/** Borra todos los registros de una palabra (errores, progreso) y ajusta los contadores de los textos. */
function removeWord(db: DB, lang: LangCode, word: string) {
  const lower = word.toLowerCase();
  const matches = (e: ErrorRecord) => e.lang === lang && e.wrong.toLowerCase() === lower;

  const removed = db.errors.filter(matches);
  db.errors = db.errors.filter((e) => !matches(e));
  delete db.progress[progressKey(lang, word)];

  for (const r of removed) {
    const t = db.texts.find((x) => x.id === r.textId);
    if (t && t.errorCount > 0) t.errorCount--;
  }
}

/** "No es un error": añade la palabra al diccionario personal y borra sus registros. */
export function ignoreWord(lang: LangCode, word: string) {
  const db = load();
  const list = new Set(db.personal[lang] ?? []);
  list.add(word.toLowerCase());
  db.personal[lang] = [...list];
  removeWord(db, lang, word);
  save(db);
}

/**
 * Eliminación manual desde el historial: la palabra deja de contar en estadísticas y práctica.
 * No se añade al diccionario, así que si vuelves a fallarla se registrará de nuevo.
 */
export function deleteWord(lang: LangCode, word: string) {
  const db = load();
  removeWord(db, lang, word);
  save(db);
}

export function recordPractice(key: string, wasCorrect: boolean) {
  const db = load();
  const p = db.progress[key];
  if (!p) return;
  p.attempts++;
  p.lastPracticed = Date.now();
  if (wasCorrect) {
    p.correct++;
    p.streak++;
    p.mastered = p.streak >= MASTERED_STREAK;
  } else {
    p.streak = 0;
    p.mastered = false;
  }
  const today = dayKey();
  db.practiceByDay[today] = (db.practiceByDay[today] ?? 0) + 1;
  save(db);
}

export function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------- Práctica ----------

export interface PracticeItem {
  progress: WordProgress;
  before: string;
  after: string;
}

/** Palabras pendientes de practicar, las más falladas primero. */
export function getPracticeItems(lang: LangCode): PracticeItem[] {
  const db = load();
  const counts = new Map<string, number>();
  const latest = new Map<string, ErrorRecord>();
  for (const e of db.errors) {
    if (e.lang !== lang) continue;
    const key = progressKey(lang, e.wrong);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const prev = latest.get(key);
    if (!prev || prev.createdAt < e.createdAt) latest.set(key, e);
  }

  return Object.values(db.progress)
    .filter((p) => p.lang === lang && !p.mastered)
    .sort((a, b) => (counts.get(b.key) ?? 0) - (counts.get(a.key) ?? 0))
    .map((progress) => {
      const ctx = latest.get(progress.key);
      return { progress, before: ctx?.before ?? "", after: ctx?.after ?? "" };
    });
}

// ---------- Historial ----------

export interface HistoryItem {
  key: string;
  wrong: string;
  right: string;
  type: ErrorType;
  /** Veces que se ha cometido este error */
  count: number;
  firstSeen: number;
  lastSeen: number;
  mastered: boolean;
  attempts: number;
  correct: number;
}

/** Todos los errores cometidos en un idioma (agrupados por palabra), del más reciente al más antiguo. */
export function getHistory(lang: LangCode): HistoryItem[] {
  const db = load();
  const agg = new Map<string, { count: number; first: number; last: number }>();
  for (const e of db.errors) {
    if (e.lang !== lang) continue;
    const key = progressKey(lang, e.wrong);
    const a = agg.get(key);
    if (!a) {
      agg.set(key, { count: 1, first: e.createdAt, last: e.createdAt });
    } else {
      a.count++;
      a.first = Math.min(a.first, e.createdAt);
      a.last = Math.max(a.last, e.createdAt);
    }
  }

  return Object.values(db.progress)
    .filter((p) => p.lang === lang)
    .map((p) => {
      const a = agg.get(p.key);
      return {
        key: p.key,
        wrong: p.wrong,
        right: p.right,
        type: p.type,
        count: a?.count ?? 0,
        firstSeen: a?.first ?? 0,
        lastSeen: a?.last ?? 0,
        mastered: p.mastered,
        attempts: p.attempts,
        correct: p.correct,
      };
    })
    .sort((x, y) => y.lastSeen - x.lastSeen);
}

// ---------- Estadísticas ----------

export interface Stats {
  texts: number;
  words: number;
  errors: number;
  errorRate: number; // errores por cada 100 palabras
  mastered: number;
  pending: number;
  byType: Array<{ type: ErrorType; count: number }>;
  topWords: Array<{ wrong: string; right: string; type: ErrorType; count: number; mastered: boolean }>;
  daily: Array<{ day: string; errors: number; words: number }>;
}

export function computeStats(lang: LangCode): Stats {
  const db = load();
  const texts = db.texts.filter((t) => t.lang === lang);
  const errors = db.errors.filter((e) => e.lang === lang);
  const progress = Object.values(db.progress).filter((p) => p.lang === lang);

  const words = texts.reduce((n, t) => n + t.wordCount, 0);

  const typeCounts = new Map<ErrorType, number>();
  for (const e of errors) typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1);

  const wordCounts = new Map<string, number>();
  for (const e of errors) {
    const key = progressKey(lang, e.wrong);
    wordCounts.set(key, (wordCounts.get(key) ?? 0) + 1);
  }

  const days = new Map<string, { errors: number; words: number }>();
  for (const t of texts) {
    const k = dayKey(t.createdAt);
    const d = days.get(k) ?? { errors: 0, words: 0 };
    d.errors += t.errorCount;
    d.words += t.wordCount;
    days.set(k, d);
  }

  return {
    texts: texts.length,
    words,
    errors: errors.length,
    errorRate: words ? (errors.length / words) * 100 : 0,
    mastered: progress.filter((p) => p.mastered).length,
    pending: progress.filter((p) => !p.mastered && p.right).length,
    byType: [...typeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    topWords: progress
      .map((p) => ({
        wrong: p.wrong,
        right: p.right,
        type: p.type,
        count: wordCounts.get(p.key) ?? 0,
        mastered: p.mastered,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    daily: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([day, v]) => ({ day, ...v })),
  };
}

// ---------- Actividad, rachas y heatmap (todos los idiomas juntos) ----------

export interface DayActivity {
  texts: number;
  practice: number;
}

export interface Activity {
  days: Record<string, DayActivity>;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
}

export function computeActivity(): Activity {
  const db = load();
  const days: Record<string, DayActivity> = {};
  const ensure = (key: string) => (days[key] ??= { texts: 0, practice: 0 });

  for (const t of db.texts) ensure(dayKey(t.createdAt)).texts++;
  for (const [key, n] of Object.entries(db.practiceByDay)) ensure(key).practice += n;

  const active = Object.keys(days)
    .filter((k) => days[k].texts + days[k].practice > 0)
    .sort();
  const activeSet = new Set(active);

  // Racha actual: días consecutivos hasta hoy; si hoy aún no has hecho nada, cuenta desde ayer
  let cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (!activeSet.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let currentStreak = 0;
  while (activeSet.has(dayKey(cursor))) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  // Mejor racha histórica
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of active) {
    const consecutive =
      prev !== null && Math.round((parseKey(key).getTime() - parseKey(prev).getTime()) / 86_400_000) === 1;
    run = consecutive ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = key;
  }

  return { days, currentStreak, longestStreak, activeDays: active.length };
}
