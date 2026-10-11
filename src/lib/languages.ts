// Idiomas soportados. Para añadir otro idioma:
//  1. Instalar su paquete `dictionary-xx` y añadirlo a scripts/copy-dictionaries.mjs
//     (destino public/dictionaries/xx).
//  2. Añadir el código a LangCode y a LANGUAGES.
//  3. Añadir reglas de clasificación propias en classify.ts si hacen falta.

export type LangCode = "es" | "ca";

export interface LanguageConfig {
  code: LangCode;
  label: string;
  /** Ruta pública donde están index.aff e index.dic */
  dictPath: string;
}

export const LANGUAGES: Record<LangCode, LanguageConfig> = {
  es: {
    code: "es",
    label: "Castellano",
    dictPath: "/dictionaries/es",
  },
  ca: {
    code: "ca",
    label: "Catalán",
    dictPath: "/dictionaries/ca",
  },
};

export const DEFAULT_LANG: LangCode = "es";
