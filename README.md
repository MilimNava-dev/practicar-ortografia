# Ortografía

Web local para practicar ortografía en **castellano y catalán**. Escribes un texto, la web lo corrige, guarda tus errores y te ofrece historial, estadísticas, rachas y ejercicios de práctica con tus propios fallos.

Todo funciona en tu navegador, sin servidores ni cuentas: la corrección usa diccionarios Hunspell (`dictionary-es`, `dictionary-ca` + `nspell`) y los datos se guardan en `localStorage`.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui · React Router

## Puesta en marcha

Requiere Node.js 20 o superior.

```bash
npm install     # instala dependencias y copia los diccionarios a public/dictionaries/{es,ca}
npm run dev     # http://localhost:5173
```

Si al corregir aparece un error al cargar el diccionario, ejecuta `node scripts/copy-dictionaries.mjs`.

## Pantallas

- **Escribir** (`/`): escribes un texto y pulsas «Corregir». Los errores se subrayan, con sugerencias que aplicas con un clic, una corrección manual y el botón «No es un error» (añade la palabra a tu diccionario personal, útil para nombres propios). Al terminar puedes **descargar** el texto corregido (`.txt`) o copiarlo. Las palabras que no hayas corregido se descargan tal y como las escribiste.
- **Historial** (`/historial`): lista de todos los errores que has cometido en el idioma seleccionado, con tipo, número de veces, última fecha y progreso de práctica. **Nunca desaparecen solos**, ni siquiera cuando dominas la palabra; solo los quitas tú con el icono de la papelera. Al eliminar una palabra deja de contar en estadísticas y práctica (si vuelves a fallarla, se registra otra vez).
- **Estadísticas** (`/estadisticas`): racha actual, mejor racha, días con actividad y un **heatmap** estilo GitHub (último año) con los días en que has escrito o practicado; pasa el ratón por un cuadro para ver cuántos textos y ejercicios hiciste ese día. Debajo, por idioma: textos, palabras, errores por cada 100 palabras, tipos de error, palabras más falladas y evolución diaria.
- **Practicar** (`/practicar`): ejercicios con tus propios errores (completa la palabra en la frase donde fallaste). Una palabra se considera dominada tras 3 aciertos seguidos y deja de salir en práctica (pero se mantiene en el historial).

El selector de idioma de la cabecera cambia entre castellano y catalán. Historial, estadísticas por idioma y práctica se filtran por el idioma elegido; las rachas y el heatmap cuentan la actividad de todos los idiomas juntos. Si cambias de idioma mientras revisas una corrección, vuelves al editor conservando el texto.

**Rachas:** un día cuenta si has corregido al menos un texto o hecho al menos un ejercicio. La racha actual sigue viva si todavía no has hecho nada hoy pero sí ayer.

## Estructura

```
src/
  lib/
    languages.ts         idiomas soportados y rutas de sus diccionarios
    language-context.tsx idioma seleccionado (se recuerda en localStorage)
    spell.ts             corrector: carga del diccionario, detección y sugerencias
    classify.ts          clasifica cada error por tipo (reglas comunes + por idioma)
    storage.ts           persistencia, historial, estadísticas, rachas y cola de práctica
    dates.ts             utilidades de fechas locales (YYYY-MM-DD)
  pages/                 Write, History, Stats, Practice
  components/            Layout, ActivityHeatmap y componentes shadcn (components/ui)
scripts/copy-dictionaries.mjs   copia los .aff/.dic al directorio público
```

## Limitaciones conocidas

- El corrector detecta palabras que **no existen** en el diccionario. No detecta errores entre palabras válidas (p. ej. «a ver» / «haber», «sino» / «si no», «tú» / «tu»). Para eso habría que añadir reglas propias o un motor como LanguageTool en local.
- La clasificación de errores es una heurística basada en la primera sugerencia; cuando una palabra tiene varios errores distintos puede caer en «Otros».
- Catalán: los apóstrofos separan palabras (`l'home` se revisa como `l` + `home`) y el punt volat se admite dentro de la palabra (`col·legi`). Con el punto normal (`col.legi`) la palabra se parte en dos. El diccionario catalán es grande: la primera corrección puede tardar unos segundos (se precarga al elegir el idioma).
- Los datos viven en el `localStorage` del navegador: si lo borras o cambias de navegador, se pierden.

## Añadir otro idioma

1. `npm install dictionary-xx` y añadirlo a la lista de `scripts/copy-dictionaries.mjs`.
2. Añadir el código a `LangCode` y a `LANGUAGES` en `src/lib/languages.ts`.
3. Si hace falta, añadir sus reglas de clasificación en `BY_LANG` de `src/lib/classify.ts`.
