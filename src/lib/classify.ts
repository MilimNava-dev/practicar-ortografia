import type { LangCode } from "./languages";

export type ErrorType =
  | "tilde"
  | "b-v"
  | "h"
  | "g-j"
  | "ll-y"
  | "c-s-z"
  | "m-n"
  | "r-rr"
  | "ela"
  | "ny"
  | "otro";

export const ERROR_TYPES: Record<ErrorType, { label: string; hint: string }> = {
  tilde: { label: "Tildes / acentos", hint: "Revisa si la palabra lleva tilde (acento) y de qué tipo." },
  "b-v": { label: "B / V", hint: "Confusión entre b y v." },
  h: { label: "H", hint: "Falta o sobra una h." },
  "g-j": { label: "G / J", hint: "Confusión entre g y j." },
  "ll-y": { label: "LL / Y", hint: "Confusión entre ll e y." },
  "c-s-z": { label: "C / S / Z / Ç", hint: "Confusión entre c, s, z (y ç, ss en catalán)." },
  "m-n": { label: "M / N", hint: "Recuerda: antes de b y p se escribe m." },
  "r-rr": { label: "R / RR", hint: "Confusión entre r y rr." },
  ela: { label: "L·L (ela geminada)", hint: "En catalán se escribe l·l (punt volat), no ll." },
  ny: { label: "NY / Ñ", hint: "En catalán se escribe ny, no ñ." },
  otro: { label: "Otros", hint: "Otro tipo de error (errata, letra de más o de menos…)." },
};

/**
 * Quita los acentos (agudo, grave y diéresis), conservando ñ y ç.
 * Sirve tanto para tildes del castellano como para accents del catalán (à è é í ò ó ú ï ü).
 */
export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀́̈]/g, "").normalize("NFC");
}

/** ¿Se obtiene `b` sustituyendo una aparición de `p` por `q` en `a` (o todas a la vez)? */
function oneSubstitution(a: string, b: string, p: string, q: string): boolean {
  // Mismo error repetido en la palabra (p. ej. "bolber" → "volver")
  if (a.includes(p) && a.split(p).join(q) === b) return true;
  let i = a.indexOf(p);
  while (i !== -1) {
    if (a.slice(0, i) + q + a.slice(i + p.length) === b) return true;
    i = a.indexOf(p, i + 1);
  }
  return false;
}

/** ¿Se obtiene `b` insertando exactamente una `h` en `a`? (o al revés) */
function oneHDifference(a: string, b: string): boolean {
  const without = (s: string, t: string) => {
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "h" && s.slice(0, i) + s.slice(i + 1) === t) return true;
    }
    return false;
  };
  return without(b, a) || without(a, b);
}

type Sub = [string, string, ErrorType];

const COMMON: Sub[] = [
  ["b", "v", "b-v"],
  ["v", "b", "b-v"],
  ["g", "j", "g-j"],
  ["j", "g", "g-j"],
  ["c", "s", "c-s-z"],
  ["s", "c", "c-s-z"],
  ["c", "z", "c-s-z"],
  ["z", "c", "c-s-z"],
  ["s", "z", "c-s-z"],
  ["z", "s", "c-s-z"],
  ["m", "n", "m-n"],
  ["n", "m", "m-n"],
  ["r", "rr", "r-rr"],
  ["rr", "r", "r-rr"],
];

const BY_LANG: Record<LangCode, Sub[]> = {
  es: [
    ["ll", "y", "ll-y"],
    ["y", "ll", "ll-y"],
  ],
  ca: [
    ["ll", "l·l", "ela"],
    ["l·l", "ll", "ela"],
    ["ñ", "ny", "ny"],
    ["ny", "ñ", "ny"],
    ["ç", "c", "c-s-z"],
    ["c", "ç", "c-s-z"],
    ["ç", "s", "c-s-z"],
    ["s", "ç", "c-s-z"],
    ["ç", "ss", "c-s-z"],
    ["ss", "ç", "c-s-z"],
    ["ss", "s", "c-s-z"],
    ["s", "ss", "c-s-z"],
  ],
};

/**
 * Clasifica un error comparando la palabra escrita (`wrong`) con la corrección (`right`).
 * Es una heurística sencilla: sirve para agrupar errores en las estadísticas.
 */
export function classifyError(wrong: string, right: string, lang: LangCode = "es"): ErrorType {
  const a = wrong.toLowerCase();
  const b = right.toLowerCase();

  if (a !== b && stripAccents(a) === stripAccents(b)) return "tilde";

  const a0 = stripAccents(a);
  const b0 = stripAccents(b);

  if (oneHDifference(a0, b0)) return "h";

  // Primero las reglas específicas del idioma (p. ej. l·l o ç), luego las comunes
  for (const [p, q, type] of [...BY_LANG[lang], ...COMMON]) {
    if (oneSubstitution(a0, b0, p, q)) return type;
  }

  return "otro";
}
