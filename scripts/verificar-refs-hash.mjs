import { createHash } from 'node:crypto';
export function hashRef(r) {
  return createHash('sha1').update(JSON.stringify({ doi: r.doi, titulo: r.titulo, anio: r.anio, autor: r.autores?.[0], pmid: r.pmid ?? null })).digest('hex');
}
