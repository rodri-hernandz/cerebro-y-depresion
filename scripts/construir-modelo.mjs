// Convierte las mallas OBJ de "Brain for Blender" (Anderson Winkler, CC BY-SA 3.0)
// en un único GLB decimado y cuantizado, con un nodo nombrado por región.
// Sin Blender: parser OBJ propio + gltf-transform + meshoptimizer.
//
// Uso: node scripts/construir-modelo.mjs [--ratio-corteza=0.22] [--ratio-subcortical=0.40]
//      [--error=0.01] [--sin-cuantizar] [--meshopt]
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weldPrimitive, simplifyPrimitive, quantize, prune, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(RAIZ, 'assets', 'raw');
const SALIDA_GLB = join(RAIZ, 'assets', 'cerebro.glb');
const SALIDA_GEO = join(RAIZ, 'data', 'generado', 'geometria.json');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const RATIO_CORTEZA = Number(args['ratio-corteza'] ?? 0.22);
const RATIO_SUBCORTICAL = Number(args['ratio-subcortical'] ?? 0.40);
const ERROR = Number(args.error ?? 0.01);
const CUANTIZAR = !args['sin-cuantizar'];
const USAR_MESHOPT = Boolean(args.meshopt);

// --- Selección de mallas -------------------------------------------------
const REGIONES_DK = [
  'bankssts', 'caudalanteriorcingulate', 'caudalmiddlefrontal', 'cuneus', 'entorhinal', 'frontalpole',
  'fusiform', 'inferiorparietal', 'inferiortemporal', 'insula', 'isthmuscingulate', 'lateraloccipital',
  'lateralorbitofrontal', 'lingual', 'medialorbitofrontal', 'middletemporal', 'paracentral',
  'parahippocampal', 'parsopercularis', 'parsorbitalis', 'parstriangularis', 'pericalcarine',
  'postcentral', 'posteriorcingulate', 'precentral', 'precuneus', 'rostralanteriorcingulate',
  'rostralmiddlefrontal', 'superiorfrontal', 'superiorparietal', 'superiortemporal', 'supramarginal',
  'temporalpole', 'transversetemporal',
]; // se excluye "unknown" (corteza medial no etiquetada)
const SUBCORTICALES = [
  'Amygdala', 'Hippocampus', 'Accumbens-area', 'Caudate', 'Putamen', 'Pallidum', 'Thalamus-Proper', 'VentralDC',
]; // Left-/Right-; se excluyen cerebelo, ventrículos y cuerpo calloso

const entradas = [];
for (const h of ['lh', 'rh']) {
  for (const r of REGIONES_DK) {
    entradas.push({ nombre: `${h}_pial_DK_${r}`, archivo: join(RAW, 'pial_DK_obj', `${h}.pial.DK.${r}.obj`), grupo: 'corteza', hemisferio: h === 'lh' ? 'izq' : 'der', ratio: RATIO_CORTEZA });
  }
}
for (const lado of ['Left', 'Right']) {
  for (const s of SUBCORTICALES) {
    entradas.push({ nombre: `${lado}-${s}`, archivo: join(RAW, 'subcortical_obj', `${lado}-${s}.obj`), grupo: 'subcortical', hemisferio: lado === 'Left' ? 'izq' : 'der', ratio: RATIO_SUBCORTICAL });
  }
}
entradas.push({ nombre: 'Brain-Stem', archivo: join(RAW, 'subcortical_obj', 'Brain-Stem.obj'), grupo: 'subcortical', hemisferio: 'medial', ratio: RATIO_SUBCORTICAL });

// --- Parser OBJ (solo v y f; tolera a/b/c y polígonos > 3) ---------------
function parsearObj(ruta) {
  const texto = readFileSync(ruta, 'utf8');
  const pos = [];
  const idx = [];
  for (const linea of texto.split('\n')) {
    if (linea.startsWith('v ')) {
      const p = linea.trim().split(/\s+/);
      pos.push(+p[1], +p[2], +p[3]);
    } else if (linea.startsWith('f ')) {
      const t = linea.trim().split(/\s+/).slice(1).map((s) => parseInt(s.split('/')[0], 10) - 1);
      for (let i = 1; i + 1 < t.length; i++) idx.push(t[0], t[i], t[i + 1]); // abanico
    }
  }
  return { posiciones: new Float32Array(pos), indices: new Uint32Array(idx) };
}

function estadisticas(posiciones) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const suma = [0, 0, 0];
  const n = posiciones.length / 3;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const v = posiciones[i * 3 + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
      suma[k] += v;
    }
  }
  const r = (x) => Math.round(x * 100) / 100;
  return { centroide: suma.map((s) => r(s / n)), bbox: { min: min.map(r), max: max.map(r) } };
}

// --- Construcción del documento glTF -------------------------------------
const doc = new Document();
const buffer = doc.createBuffer('cerebro');
const escena = doc.createScene('cerebro');
const geometria = {};
const primitivas = [];
let trisOrig = 0;

for (const e of entradas) {
  const { posiciones, indices } = parsearObj(e.archivo);
  const est = estadisticas(posiciones);
  trisOrig += indices.length / 3;
  geometria[e.nombre] = { grupo: e.grupo, hemisferio: e.hemisferio, ...est, triangulos: { original: indices.length / 3 } };

  const accPos = doc.createAccessor(`${e.nombre}_pos`).setType('VEC3').setArray(posiciones).setBuffer(buffer);
  const accIdx = doc.createAccessor(`${e.nombre}_idx`).setType('SCALAR').setArray(indices).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', accPos).setIndices(accIdx);
  const malla = doc.createMesh(e.nombre).addPrimitive(prim);
  const nodo = doc.createNode(e.nombre).setMesh(malla).setExtras({ grupo: e.grupo, hemisferio: e.hemisferio, nombre: e.nombre });
  escena.addChild(nodo);
  primitivas.push({ prim, e });
}

// --- Decimación por grupo (lockBorder evita grietas entre regiones vecinas) ---
await MeshoptSimplifier.ready;
let trisFinal = 0;
let vertsFinal = 0;
for (const { prim, e } of primitivas) {
  weldPrimitive(prim);
  simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: e.ratio, error: ERROR, lockBorder: true });
  const idx = prim.getIndices();
  const arr = idx.getArray();
  const nVerts = prim.getAttribute('POSITION').getCount();
  if (nVerts < 65535 && !(arr instanceof Uint16Array)) idx.setArray(new Uint16Array(arr));
  const tris = idx.getCount() / 3;
  trisFinal += tris;
  vertsFinal += nVerts;
  geometria[e.nombre].triangulos.final = tris;
}

const transformaciones = [];
if (CUANTIZAR) transformaciones.push(quantize({ pattern: /^POSITION$/, quantizePosition: 14, quantizationVolume: 'mesh' }));
transformaciones.push(prune(), dedup());
if (USAR_MESHOPT) transformaciones.push(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await doc.transform(...transformaciones);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await io.write(SALIDA_GLB, doc);

// --- Metadatos de geometría (centroides y cajas en coordenadas originales) ---
const global = estadisticas(Float32Array.from(Object.values(geometria).flatMap((g) => [...g.bbox.min, ...g.bbox.max])));
mkdirSync(dirname(SALIDA_GEO), { recursive: true });
writeFileSync(SALIDA_GEO, JSON.stringify({
  fuente: {
    nombre: 'Brain for Blender', autor: 'Anderson M. Winkler', licencia: 'CC BY-SA 3.0',
    url: 'https://brainder.org/research/brain-for-blender/', atlas: 'Desikan-Killiany (corteza pial) + aseg (subcorticales)',
  },
  unidades: 'mm, espacio RAS de FreeSurfer (no MNI)',
  parametros: { ratio_corteza: RATIO_CORTEZA, ratio_subcortical: RATIO_SUBCORTICAL, error: ERROR, cuantizado: CUANTIZAR, meshopt: USAR_MESHOPT },
  bbox_global: global.bbox,
  centro_global: global.centroide,
  mallas: geometria,
}, null, 1));

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const tam = statSync(SALIDA_GLB).size;
console.log(`Mallas: ${entradas.length} | Triángulos: ${trisOrig.toLocaleString()} → ${trisFinal.toLocaleString()} | Vértices finales: ${vertsFinal.toLocaleString()}`);
console.log(`GLB: ${kb(tam)} (base64 ≈ ${kb(Math.ceil(tam * 4 / 3))}) → ${SALIDA_GLB}`);
console.log(`Geometría: ${SALIDA_GEO}`);
