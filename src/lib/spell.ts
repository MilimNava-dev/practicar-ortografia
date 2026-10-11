
import type { ErrorType } from "./classify";
import { type LangCode } from "./languages";
import { getPersonalWords } from "./storage";

export interface SpellIssue {
  /** Palabra tal y como la escribió la persona */
  word: string;
  start: number;
  end: number;
  /** Sugerencias ordenadas (la primera es la mejor) */
  suggestions: string[];
  type: ErrorType;
  /** Fragmento de frase antes y después de la palabra */
  before: string;
  after: string;
}

export interface CheckResult {
  issues: SpellIssue[];
  wordCount: number;
}

type WorkerRequest = {
  type: "load" | "check" | "add";
  lang: LangCode;
  text?: string;
  words?: string[];
  word?: string;
};

type WorkerResponse = {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

let worker: Worker | null = null;
let nextId = 0;

const pending = new Map<number, PendingRequest>();
const spellers = new Map<LangCode, Promise<void>>();

function getWorker(): Worker {
  if (worker) return worker;

  const instance = new Worker(
    new URL("./spell.worker.ts", import.meta.url),
    { type: "module" },
  );

  instance.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const request = pending.get(message.id);

    if (!request) return;

    pending.delete(message.id);

    if (message.ok) {
      request.resolve(message.result);
    } else {
      request.reject(
        new Error(message.error ?? "Error desconocido del corrector."),
      );
    }
  };

  instance.onerror = (event) => {
    const error = new Error(
      event.message || "Se ha producido un error en el corrector.",
    );

    for (const request of pending.values()) {
      request.reject(error);
    }

    pending.clear();
    spellers.clear();

    instance.terminate();

    if (worker === instance) {
      worker = null;
    }
  };

  worker = instance;
  return instance;
}

function request<T>(
  message: WorkerRequest,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = ++nextId;

    pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
    });

    try {
      getWorker().postMessage({ ...message, id });
    } catch (error) {
      pending.delete(id);

      reject(
        error instanceof Error
          ? error
          : new Error(String(error)),
      );
    }
  });
}

/**
 * Carga el diccionario en el Worker.
 * Las cargas simultáneas del mismo idioma comparten una promesa.
 */
export function loadSpeller(lang: LangCode): Promise<void> {
  let promise = spellers.get(lang);

  if (!promise) {
    promise = request<void>({
      type: "load",
      lang,
      words: getPersonalWords(lang),
    });

    spellers.set(lang, promise);

    // Si falla, permitir que la siguiente llamada reintente.
    promise.catch(() => {
      if (spellers.get(lang) === promise) {
        spellers.delete(lang);
      }
    });
  }

  return promise;
}

/** Añade una palabra al diccionario en memoria. */
export async function addToSpeller(
  lang: LangCode,
  word: string,
): Promise<void> {
  await loadSpeller(lang);

  await request<void>({
    type: "add",
    lang,
    word,
  });
}

/** Corrige un texto utilizando el Worker. */
export async function checkText(
  text: string,
  lang: LangCode,
): Promise<CheckResult> {
  await loadSpeller(lang);

  return request<CheckResult>({
    type: "check",
    lang,
    text,
  });
}
