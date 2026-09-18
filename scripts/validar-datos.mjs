// Valida la coherencia de los datos JSON antes de compilar: mallas, anclajes, ids de región,
// neurotransmisores y referencias citadas. Falla con código 1 si hay errores.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => JSON.parse(readFileSync(join(RAIZ, 'data', p), 'utf8'));
const errores = [];
const avisos = [];

const geometria = leer('generado/geometria.json');
const regiones = leer('regiones.json').regiones;
const idsRegion = new Set(regiones.map((r) => r.id));

// --- regiones ---
const mallasUsadas = new Set();
for (const r of regiones) {
  if (!r.id || !r.nombre || !r.nombre_paciente || !r.descripcion?.paciente || !r.descripcion?.clinico) errores.push(`Región ${r.id ?? '?'} incompleta`);
  if (r.tipo === 'marcador') {
    if (!r.anclajes?.length) errores.push(`Marcador ${r.id} sin anclajes`);
    for (const a of r.anclajes ?? []) {
      if (!geometria.mallas[a.malla]) errores.push(`Anclaje de ${r.id} a malla inexistente: ${a.malla}`);
      if (!Array.isArray(a.frac) || a.frac.length !== 3 || a.frac.some((f) => f < 0 || f > 1)) errores.push(`Anclaje de ${r.id} con fracciones inválidas`);
    }
  } else {
    if (!r.mallas?.length) errores.push(`Región ${r.id} sin mallas`);
    for (const m of r.mallas ?? []) {
      if (!geometria.mallas[m]) errores.push(`Región ${r.id} referencia malla inexistente: ${m}`);
      if (mallasUsadas.has(m)) errores.push(`Malla ${m} asignada a más de una región`);
      mallasUsadas.add(m);
    }
  }
}
for (const m of Object.keys(geometria.mallas)) if (!mallasUsadas.has(m)) avisos.push(`Malla ${m} no pertenece a ninguna región`);

// --- estímulos, tratamientos, referencias (opcionales hasta la fase de contenido) ---
const NEUROTRANSMISORES = new Set(['dopamina', 'serotonina', 'noradrenalina', 'cortisol', 'glutamato', 'gaba', 'opioides', 'oxitocina', 'endocannabinoides', 'bdnf']);
let referencias = null;
if (existsSync(join(RAIZ, 'data', 'referencias.json'))) {
  referencias = leer('referencias.json');
  const claves = new Set();
  for (const ref of referencias) {
    if (!ref.key || !ref.doi || !ref.titulo || !ref.anio || !ref.autores?.length || !ref.tipo_evidencia) errores.push(`Referencia incompleta: ${ref.key ?? JSON.stringify(ref).slice(0, 60)}`);
    if (claves.has(ref.key)) errores.push(`Referencia duplicada: ${ref.key}`);
    claves.add(ref.key);
  }
  referencias = claves;
}
const marcadoresRef = (texto, origen) => {
  for (const m of String(texto ?? '').matchAll(/\[ref:([^\]]+)\]/g)) {
    for (const k of m[1].split(',').map((s) => s.trim())) if (referencias && !referencias.has(k)) errores.push(`${origen}: cita [ref:${k}] no existe en referencias.json`);
  }
};
function validarEntrada(e, origen) {
  if (!e.id || !e.nombre || !e.textos?.paciente || !e.textos?.clinico) errores.push(`${origen} ${e.id ?? '?'} incompleto`);
  if (!['directa', 'inferida', 'indirecta'].includes(e.nivel_evidencia)) errores.push(`${origen} ${e.id}: nivel_evidencia inválido`);
  for (const k of Object.keys(e.neurotransmisores ?? {})) if (!NEUROTRANSMISORES.has(k)) errores.push(`${origen} ${e.id}: neurotransmisor desconocido ${k}`);
  for (const k of e.refs ?? []) if (referencias && !referencias.has(k)) errores.push(`${origen} ${e.id}: ref ${k} no existe`);
  marcadoresRef(e.textos?.clinico, `${origen} ${e.id}`);
  marcadoresRef(e.textos?.paciente, `${origen} ${e.id}`);
  if (!e.refs?.length) avisos.push(`${origen} ${e.id} sin referencias`);
}
if (existsSync(join(RAIZ, 'data', 'estimulos.json'))) {
  const est = leer('estimulos.json');
  for (const e of est.estimulos ?? est) {
    validarEntrada(e, 'Estímulo');
    for (const paso of e.secuencia ?? []) if (!idsRegion.has(paso.region)) errores.push(`Estímulo ${e.id}: región desconocida ${paso.region}`);
    if (!e.secuencia?.length) errores.push(`Estímulo ${e.id} sin secuencia`);
  }
}
if (existsSync(join(RAIZ, 'data', 'tratamientos.json'))) {
  const tr = leer('tratamientos.json');
  for (const t of tr.tratamientos ?? tr) {
    validarEntrada(t, 'Tratamiento');
    for (const k of Object.keys(t.efecto_region ?? {})) if (!idsRegion.has(k)) errores.push(`Tratamiento ${t.id}: región desconocida ${k}`);
    for (const k of Object.keys(t.efecto_nt ?? {})) if (!NEUROTRANSMISORES.has(k)) errores.push(`Tratamiento ${t.id}: neurotransmisor desconocido ${k}`);
    if (!t.curva?.tipo) errores.push(`Tratamiento ${t.id} sin curva`);
  }
}
if (existsSync(join(RAIZ, 'data', 'depresion.json'))) {
  const d = leer('depresion.json');
  for (const k of Object.keys(d.reactividad_base ?? {})) if (!idsRegion.has(k)) errores.push(`depresion.json: región desconocida ${k}`);
  for (const k of Object.keys(d.neurotransmisores_base ?? {})) if (!NEUROTRANSMISORES.has(k)) errores.push(`depresion.json: neurotransmisor desconocido ${k}`);
  for (const s of ['leve', 'moderada', 'grave']) if (typeof d.escala_severidad?.[s] !== 'number') errores.push(`depresion.json: falta escala_severidad.${s}`);
}

for (const a of avisos) console.warn('aviso:', a);
if (errores.length) { for (const e of errores) console.error('error:', e); console.error(`${errores.length} error(es) en los datos.`); process.exit(1); }
console.log(`Datos válidos: ${regiones.length} regiones, ${mallasUsadas.size} mallas asignadas${referencias ? `, ${referencias.size} referencias` : ''}.`);
