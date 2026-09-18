// Verifica cada referencia de data/referencias.json contra CrossRef (y PubMed si hay PMID) y guarda
// data/generado/refs-verificadas.json con un hash por referencia. El build falla si alguna no está verificada.
// Uso: node scripts/verificar-refs.mjs [--solo-faltantes]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { hashRef } from './verificar-refs-hash.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_REFS = join(RAIZ, 'data', 'referencias.json');
const RUTA_SALIDA = join(RAIZ, 'data', 'generado', 'refs-verificadas.json');
const CORREO = 'cerebro-y-depresion@example.org';
const soloFaltantes = process.argv.includes('--solo-faltantes');

const normalizar = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/<[^>]+>/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function bigramas(s) { const b = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); b.set(k, (b.get(k) ?? 0) + 1); } return b; }
export function similitud(a, b) {
  const A = bigramas(normalizar(a)), B = bigramas(normalizar(b));
  let inter = 0; for (const [k, v] of A) inter += Math.min(v, B.get(k) ?? 0);
  const total = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  return total ? (2 * inter) / total : 0;
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function crossref(doi) {
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${CORREO}`, { headers: { 'User-Agent': `cerebro-y-depresion/0.1 (mailto:${CORREO})` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`CrossRef ${res.status}`);
  const m = (await res.json()).message;
  return {
    titulo: m.title?.[0] ?? '', revista: m['container-title']?.[0] ?? '', anio: m.issued?.['date-parts']?.[0]?.[0] ?? m.created?.['date-parts']?.[0]?.[0],
    primerAutor: m.author?.[0]?.family ?? '', tipo: m.type,
  };
}
async function pubmed(pmid) {
  const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json&tool=cerebro-y-depresion&email=${CORREO}`);
  if (!res.ok) throw new Error(`PubMed ${res.status}`);
  const j = await res.json();
  const r = j.result?.[pmid];
  if (!r || r.error) return null;
  return { titulo: r.title, doi: r.articleids?.find((a) => a.idtype === 'doi')?.value ?? '', anio: Number(String(r.pubdate ?? '').slice(0, 4)) };
}

const refs = JSON.parse(readFileSync(RUTA_REFS, 'utf8'));
const previo = existsSync(RUTA_SALIDA) ? JSON.parse(readFileSync(RUTA_SALIDA, 'utf8')) : { referencias: {} };
const salida = { generado: new Date().toISOString(), referencias: {} };
let ok = 0, fallos = 0, reutilizadas = 0;

for (const r of refs) {
  const h = hashRef(r);
  const anterior = previo.referencias?.[r.key];
  if (soloFaltantes && anterior?.hash === h && anterior.estado === 'verificada') { salida.referencias[r.key] = anterior; reutilizadas++; ok++; continue; }
  const problemas = [];
  let cr = null, pm = null;
  try { cr = await crossref(r.doi); } catch (e) { problemas.push(`CrossRef: ${e.message}`); }
  if (cr === null && !problemas.length) problemas.push('DOI no existe en CrossRef');
  if (cr) {
    // CrossRef a veces guarda solo el título principal (sin subtítulo tras ':'), o viceversa
    const nuestro = normalizar(r.titulo), suyo = normalizar(cr.titulo);
    const sim = Math.max(
      similitud(r.titulo, cr.titulo),
      similitud(r.titulo.split(':')[0], cr.titulo.split(':')[0]),
      suyo.length > 12 && (nuestro.startsWith(suyo) || suyo.startsWith(nuestro)) ? 1 : 0,
    );
    if (sim < 0.85) problemas.push(`título distinto (similitud ${sim.toFixed(2)}): "${cr.titulo}"`);
    if (cr.anio && Math.abs(Number(cr.anio) - Number(r.anio)) > 1) problemas.push(`año distinto (CrossRef ${cr.anio})`);
    const apellido = normalizar(r.autores?.[0]?.split(' ')[0] ?? '');
    if (cr.primerAutor && apellido && !normalizar(cr.primerAutor).includes(apellido) && !apellido.includes(normalizar(cr.primerAutor))) problemas.push(`primer autor distinto (CrossRef ${cr.primerAutor})`);
  }
  if (r.pmid) {
    await dormir(350);
    try { pm = await pubmed(r.pmid); } catch (e) { problemas.push(`PubMed: ${e.message}`); }
    if (pm === null && !problemas.some((p) => p.startsWith('PubMed'))) problemas.push('PMID no existe');
    if (pm && pm.doi && pm.doi.toLowerCase() !== r.doi.toLowerCase()) problemas.push(`el PMID apunta a otro DOI (${pm.doi})`);
  }
  const estado = problemas.length ? 'fallida' : 'verificada';
  salida.referencias[r.key] = { hash: h, estado, problemas, crossref: cr ? { titulo: cr.titulo, revista: cr.revista, anio: cr.anio } : null, pubmed: pm ? { titulo: pm.titulo } : null, fecha: new Date().toISOString() };
  if (estado === 'verificada') ok++; else { fallos++; console.error(`✗ ${r.key} (${r.doi}): ${problemas.join('; ')}`); }
  await dormir(120);
}
mkdirSync(dirname(RUTA_SALIDA), { recursive: true });
writeFileSync(RUTA_SALIDA, JSON.stringify(salida, null, 1));
console.log(`Referencias: ${refs.length} | verificadas: ${ok}${reutilizadas ? ` (${reutilizadas} reutilizadas)` : ''} | fallidas: ${fallos}`);
process.exit(fallos ? 1 : 0);
