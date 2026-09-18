// Comprobación offline (se ejecuta en el build): toda referencia debe estar verificada y sin cambios.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashRef } from './verificar-refs-hash.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const refs = JSON.parse(readFileSync(join(RAIZ, 'data', 'referencias.json'), 'utf8'));
const ruta = join(RAIZ, 'data', 'generado', 'refs-verificadas.json');
if (!existsSync(ruta)) { console.error('No existe data/generado/refs-verificadas.json. Ejecuta: npm run verificar'); process.exit(1); }
const ver = JSON.parse(readFileSync(ruta, 'utf8')).referencias ?? {};
const problemas = [];
for (const r of refs) {
  const v = ver[r.key];
  if (!v) problemas.push(`${r.key}: sin verificar`);
  else if (v.estado !== 'verificada') problemas.push(`${r.key}: verificación fallida (${v.problemas?.join('; ')})`);
  else if (v.hash !== hashRef(r)) problemas.push(`${r.key}: la referencia cambió después de verificarse`);
}
if (problemas.length) { for (const p of problemas) console.error('error:', p); console.error('Ejecuta: npm run verificar'); process.exit(1); }
console.log(`Referencias comprobadas offline: ${refs.length} verificadas.`);
