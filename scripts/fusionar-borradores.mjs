// Fusiona los borradores de investigación (data/borradores/*.json) en los archivos definitivos:
// estimulos.json, tratamientos.json, depresion.json y referencias.json. Ordena y elimina duplicados.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'data', 'borradores');
const leer = (p) => JSON.parse(readFileSync(p, 'utf8'));

const ORDEN_ESTIMULOS = ['azucar', 'chocolate', 'cocaina', 'alcohol', 'nicotina', 'cannabis', 'musica', 'sexo', 'enamoramiento', 'afecto_social', 'ejercicio', 'paracaidismo', 'duelo', 'rechazo_romantico', 'fracaso', 'estres_social'];
const ORDEN_TRATAMIENTOS = ['isrs', 'ketamina', 'psicoterapia', 'emtr', 'tec', 'ejercicio', 'mindfulness', 'dieta', 'escritura_expresiva', 'sobriedad', 'psilocibina'];
const CATEGORIAS = [{ id: 'sustancias', nombre: 'Sustancias' }, { id: 'experiencias', nombre: 'Recompensas y experiencias' }, { id: 'adversos', nombre: 'Eventos adversos' }];

const estimulos = new Map();
const tratamientos = new Map();
const referencias = new Map();
let depresion = null;
const avisos = [];

function agregarRefs(lista, origen) {
  for (const r of lista ?? []) {
    if (!r?.key) { avisos.push(`${origen}: referencia sin key`); continue; }
    const previa = referencias.get(r.key);
    if (previa && previa.doi.toLowerCase() !== r.doi.toLowerCase()) avisos.push(`${origen}: la key ${r.key} ya existe con otro DOI (${previa.doi} vs ${r.doi})`);
    if (!previa || (!previa.pmid && r.pmid)) referencias.set(r.key, { ...previa, ...r });
  }
}

for (const archivo of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
  const datos = leer(join(DIR, archivo));
  const origen = `borradores/${archivo}`;
  agregarRefs(datos.referencias, origen);
  if (archivo.startsWith('depresion')) {
    const { referencias: _r, ...resto } = datos;
    depresion = resto;
    continue;
  }
  for (const e of datos.entradas ?? []) {
    const esTratamiento = 'curva' in e;
    const mapa = esTratamiento ? tratamientos : estimulos;
    if (mapa.has(e.id)) avisos.push(`${origen}: ${e.id} duplicado, se conserva el primero`);
    else mapa.set(e.id, e);
  }
}

const ordenar = (mapa, orden) => [...mapa.values()].sort((a, b) => {
  const ia = orden.indexOf(a.id), ib = orden.indexOf(b.id);
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
});

if (estimulos.size) writeFileSync(join(RAIZ, 'data', 'estimulos.json'), JSON.stringify({ categorias: CATEGORIAS, estimulos: ordenar(estimulos, ORDEN_ESTIMULOS) }, null, 2) + '\n');
if (tratamientos.size) writeFileSync(join(RAIZ, 'data', 'tratamientos.json'), JSON.stringify({ tratamientos: ordenar(tratamientos, ORDEN_TRATAMIENTOS) }, null, 2) + '\n');
if (depresion) writeFileSync(join(RAIZ, 'data', 'depresion.json'), JSON.stringify(depresion, null, 2) + '\n');
// conservar referencias ya existentes que sigan citadas
if (existsSync(join(RAIZ, 'data', 'referencias.json'))) agregarRefs(leer(join(RAIZ, 'data', 'referencias.json')), 'referencias.json (previas)');
const refsOrdenadas = [...referencias.values()].sort((a, b) => a.key.localeCompare(b.key));
writeFileSync(join(RAIZ, 'data', 'referencias.json'), JSON.stringify(refsOrdenadas, null, 2) + '\n');

for (const a of avisos) console.warn('aviso:', a);
console.log(`Fusionado: ${estimulos.size} estímulos, ${tratamientos.size} tratamientos, ${depresion ? 'modelo basal' : 'sin modelo basal'}, ${refsOrdenadas.length} referencias.`);
