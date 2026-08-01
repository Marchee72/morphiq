// scripts/build-exercises.mjs
// Vendors the hasaneyldrm/exercises-dataset into src/data/exercises/exercises.json,
// stripped to English + Spanish fields per the design spec (media stays on the CDN).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(HERE, '..', 'src', 'data', 'exercises', 'exercises.json');
// The upstream dataset has no Spanish `name` field, so names are translated once and
// checked in here rather than fetched — see src/data/exercises/names.es.json for how it was built.
const NAMES_ES_FILE = path.join(HERE, '..', 'src', 'data', 'exercises', 'names.es.json');

const REQUIRED = ['id', 'name', 'category', 'equipment', 'target', 'muscle_group', 'image', 'gif_url', 'attribution'];

const namesEs = JSON.parse(await readFile(NAMES_ES_FILE, 'utf8'));

const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
const raw = await res.json();
if (!Array.isArray(raw)) throw new Error('Dataset is not a JSON array');

const stripped = raw.map((ex, i) => {
  for (const key of REQUIRED) {
    if (ex[key] === undefined || ex[key] === null) {
      throw new Error(`Record ${i} (${ex.name ?? 'unknown'}) is missing "${key}"`);
    }
  }
  const steps = ex.instruction_steps?.en;
  const stepsEs = ex.instruction_steps?.es;
  const id = String(ex.id);
  return {
    id,
    name: ex.name,
    nameEs: namesEs[id] ?? ex.name,
    category: ex.category,
    equipment: ex.equipment,
    target: ex.target,
    muscleGroup: ex.muscle_group,
    secondaryMuscles: Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles : [],
    instructionSteps: Array.isArray(steps)
      ? steps
      : (typeof ex.instructions?.en === 'string' ? [ex.instructions.en] : []),
    instructionStepsEs: Array.isArray(stepsEs)
      ? stepsEs
      : (typeof ex.instructions?.es === 'string' ? [ex.instructions.es] : []),
    image: ex.image,
    gifUrl: ex.gif_url,
    attribution: ex.attribution,
  };
});

if (stripped.length < 1300) throw new Error(`Sanity check failed: only ${stripped.length} exercises`);

await mkdir(path.dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, JSON.stringify(stripped));
console.log(`Wrote ${stripped.length} exercises (${Math.round(JSON.stringify(stripped).length / 1024)} KB)`);
console.log(`Sample: ${stripped[24].name} — ${stripped[24].category}/${stripped[24].equipment}`);
