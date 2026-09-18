// Inspecciona assets/cerebro.glb: nodos, triángulos, extensiones, y comprueba que
// los vértices de frontera compartidos entre regiones vecinas se conservaron (lockBorder).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(join(RAIZ, 'assets', 'cerebro.glb'));
const root = doc.getRoot();
console.log('Extensiones:', root.listExtensionsUsed().map((e) => e.extensionName).join(', ') || 'ninguna');
console.log('Nodos:', root.listNodes().length, '| Mallas:', root.listMeshes().length);

// Tipos de datos antes de descuantizar
const ejemplo = root.listMeshes()[0].listPrimitives()[0];
console.log('Tipo POSITION:', ejemplo.getAttribute('POSITION').getArray().constructor.name, '| índices:', ejemplo.getIndices().getArray().constructor.name);

await doc.transform(dequantize());

const mallas = new Map();
for (const nodo of root.listNodes()) {
  const prim = nodo.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute('POSITION').getArray();
  // aplicar transformación del nodo (tras dequantize debería ser identidad, pero por si acaso)
  const m = nodo.getWorldMatrix();
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    out[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  mallas.set(nodo.getName(), { pos: out, tris: prim.getIndices().getCount() / 3 });
}
const totalTris = [...mallas.values()].reduce((a, b) => a + b.tris, 0);
console.log('Triángulos totales:', totalTris.toLocaleString());

// --- Comprobación de costuras ---------------------------------------------
const clave = (x, y, z) => `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
function verticesObj(ruta) {
  const s = new Set();
  for (const l of readFileSync(ruta, 'utf8').split('\n')) {
    if (l.startsWith('v ')) { const p = l.trim().split(/\s+/); s.add(clave(+p[1], +p[2], +p[3])); }
  }
  return s;
}
const rawDir = join(RAIZ, 'assets', 'raw', 'pial_DK_obj');
if (existsSync(rawDir)) {
  const corticales = [...mallas.keys()].filter((n) => n.includes('_pial_'));
  const originales = new Map(corticales.map((n) => [n, verticesObj(join(rawDir, `${n.replace(/_/g, '.')}.obj`))]));
  // vértices que aparecen en ≥ 2 regiones del mismo hemisferio = frontera compartida
  const conteo = new Map();
  for (const [n, s] of originales) for (const k of s) conteo.set(k, (conteo.get(k) ?? 0) + 1);
  const frontera = new Set([...conteo].filter(([, c]) => c >= 2).map(([k]) => k));
  const finales = new Set();
  for (const n of corticales) { const p = mallas.get(n).pos; for (let i = 0; i < p.length; i += 3) finales.add(clave(p[i], p[i + 1], p[i + 2])); }
  let conservados = 0;
  for (const k of frontera) if (finales.has(k)) conservados++;
  console.log(`Vértices de frontera compartidos: ${frontera.size.toLocaleString()} | conservados tras decimar: ${conservados.toLocaleString()} (${(100 * conservados / frontera.size).toFixed(1)} %)`);
}
console.log('--- por malla (tris) ---');
for (const [n, m] of [...mallas].sort((a, b) => b[1].tris - a[1].tris).slice(0, 6)) console.log(`  ${n}: ${m.tris.toLocaleString()}`);
console.log('  ...');
for (const [n, m] of [...mallas].sort((a, b) => a[1].tris - b[1].tris).slice(0, 4)) console.log(`  ${n}: ${m.tris.toLocaleString()}`);
