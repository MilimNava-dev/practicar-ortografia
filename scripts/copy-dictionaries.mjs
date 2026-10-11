// Copia los diccionarios Hunspell desde node_modules a /public
// para que el navegador pueda cargarlos con fetch (todo en local).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// [paquete de npm, código de idioma]
const dictionaries = [
  ["dictionary-es", "es"],
  ["dictionary-ca", "ca"],
];

for (const [pkg, code] of dictionaries) {
  const source = join(root, "node_modules", pkg);
  const target = join(root, "public", "dictionaries", code);

  if (!existsSync(join(source, "index.aff")) || !existsSync(join(source, "index.dic"))) {
    console.warn(`[ortografia] No se encontró ${pkg}/index.aff|dic. ¿Has ejecutado npm install?`);
    continue;
  }

  mkdirSync(target, { recursive: true });
  cpSync(join(source, "index.aff"), join(target, "index.aff"));
  cpSync(join(source, "index.dic"), join(target, "index.dic"));
  console.log(`[ortografia] Diccionario "${code}" copiado a public/dictionaries/${code}`);
}
