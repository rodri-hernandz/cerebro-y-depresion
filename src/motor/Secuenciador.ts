// Reproduce la secuencia temporal de un estímulo: para cada instante devuelve el nivel de cada región
// en el cerebro sano y en el cerebro con depresión, más la envolvente global (para neurotransmisores).
import { respuestaDepresion, type DatosDepresion, type Estado } from './Reactividad.ts';

export interface Paso { region: string; t_inicio_s: number; duracion_s: number; intensidad: number; mod_depresion?: number; nota?: string }

export const ATAQUE_S = 0.45;
export const CAIDA_S = 0.9;

const suave = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** Envolvente 0–1 de un paso en el instante t (segundos desde el inicio del estímulo). */
export function envolvente(p: { t_inicio_s: number; duracion_s: number }, t: number): number {
  const local = t - p.t_inicio_s;
  if (local <= 0) return 0;
  if (local < ATAQUE_S) return suave(local / ATAQUE_S);
  if (local <= p.duracion_s) return 1;
  return 1 - suave((local - p.duracion_s) / CAIDA_S);
}

export function duracionTotal(secuencia: Paso[]): number {
  return secuencia.reduce((m, p) => Math.max(m, p.t_inicio_s + p.duracion_s), 0) + CAIDA_S;
}

export interface Instantanea { normal: Map<string, number>; depresion: Map<string, number>; global: number; terminado: boolean }

/** Niveles por región en ambos cerebros en el instante t. Varios pasos sobre la misma región se combinan por máximo absoluto. */
export function instantanea(secuencia: Paso[], t: number, datos: DatosDepresion, estado: Estado): Instantanea {
  const normal = new Map<string, number>();
  const depresion = new Map<string, number>();
  let global = 0;
  for (const p of secuencia) {
    const e = envolvente(p, t);
    global = Math.max(global, e);
    const n = p.intensidad * e;
    const d = respuestaDepresion(datos, p.region, p.intensidad, estado, p.mod_depresion) * e;
    if (Math.abs(n) > Math.abs(normal.get(p.region) ?? 0)) normal.set(p.region, n);
    if (Math.abs(d) > Math.abs(depresion.get(p.region) ?? 0)) depresion.set(p.region, d);
  }
  return { normal, depresion, global, terminado: t >= duracionTotal(secuencia) };
}
