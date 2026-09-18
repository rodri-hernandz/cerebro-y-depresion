// Acceso tipado a los datos JSON compilados dentro del HTML.
import regionesJson from '../data/regiones.json';
import geometriaJson from '../data/generado/geometria.json';
import estimulosJson from '../data/estimulos.json';
import tratamientosJson from '../data/tratamientos.json';
import depresionJson from '../data/depresion.json';
import referenciasJson from '../data/referencias.json';
import type { DatosDepresion, TratamientoModelo } from './motor/Reactividad.ts';
import type { Paso } from './motor/Secuenciador.ts';

export type TipoRegion = 'cortical' | 'subcortical' | 'marcador';
export type Lado = 'normal' | 'depresion';
export type Modo = 'paciente' | 'clinico';
export type NivelEvidencia = 'directa' | 'inferida' | 'indirecta';

export interface Anclaje { malla: string; frac: [number, number, number] }
export interface Region {
  id: string; nombre: string; nombre_paciente: string; tipo: TipoRegion;
  mallas?: string[]; anclajes?: Anclaje[]; redes: string[]; color: string;
  descripcion: { paciente: string; clinico: string };
}
export interface GeometriaMalla {
  grupo: 'corteza' | 'subcortical'; hemisferio: string;
  centroide: [number, number, number];
  bbox: { min: [number, number, number]; max: [number, number, number] };
  triangulos: { original: number; final: number };
}
export interface Referencia {
  key: string; autores: string[]; anio: number; titulo: string; revista: string; doi: string;
  pmid?: string; tipo_evidencia: string; url?: string; nota?: string;
}
export interface Textos { paciente: string; clinico: string }
export interface Diferencia extends Textos { refs?: string[] }
export interface Estimulo {
  id: string; categoria: string; nombre: string; nombre_corto: string; icono: string;
  nivel_evidencia: NivelEvidencia; resumen_evidencia: string;
  secuencia: Paso[];
  neurotransmisores: Record<string, { normal: number; mod_depresion?: number }>;
  textos: Textos; diferencias?: Diferencia[]; refs: string[];
}
export interface Hito extends Textos { dia: number }
export interface Tratamiento extends TratamientoModelo {
  categoria: string; nombre: string; nombre_corto: string; icono: string;
  nivel_evidencia: NivelEvidencia; resumen_evidencia: string;
  hitos?: Hito[]; textos: Textos; refs: string[];
}
export interface Categoria { id: string; nombre: string }

export const REGIONES = regionesJson.regiones as Region[];
export const REGION_POR_ID = new Map(REGIONES.map((r) => [r.id, r]));
export const COLORES = regionesJson.colores as { corteza_base: string; activacion: string; desactivacion: string };
export const GEOMETRIA = geometriaJson as unknown as {
  bbox_global: { min: [number, number, number]; max: [number, number, number] };
  mallas: Record<string, GeometriaMalla>;
};
export const MALLA_A_REGION = new Map<string, string>();
for (const r of REGIONES) for (const m of r.mallas ?? []) MALLA_A_REGION.set(m, r.id);

export const CATEGORIAS_ESTIMULOS = estimulosJson.categorias as Categoria[];
export const ESTIMULOS = estimulosJson.estimulos as unknown as Estimulo[];
export const ESTIMULO_POR_ID = new Map(ESTIMULOS.map((e) => [e.id, e]));
export const TRATAMIENTOS = tratamientosJson.tratamientos as unknown as Tratamiento[];
export const TRATAMIENTO_POR_ID = new Map(TRATAMIENTOS.map((t) => [t.id, t]));
export const DEPRESION = depresionJson as unknown as DatosDepresion & { justificacion: Record<string, Textos>; refs: string[] };
export const REFERENCIAS = referenciasJson as Referencia[];
export const REFERENCIA_POR_KEY = new Map(REFERENCIAS.map((r) => [r.key, r]));

export const CATEGORIAS_TRATAMIENTOS: Record<string, string> = {
  farmacologico: 'Medicamentos', psicoterapia: 'Psicoterapia', neuromodulacion: 'Neuromodulación',
  estilo_vida: 'Estilo de vida y alternativas', psicodelico: 'Psicodélicos (en investigación)',
};

export const NIVELES_EVIDENCIA: Record<NivelEvidencia, { nombre: string; descripcion: string }> = {
  directa: { nombre: 'Evidencia directa', descripcion: 'Hay estudios de neuroimagen o marcadores en personas con depresión para este estímulo o tratamiento.' },
  inferida: { nombre: 'Evidencia inferida', descripcion: 'La respuesta en personas sanas está documentada; la diferencia en depresión se infiere de meta-análisis generales (recompensa atenuada, hiperreactividad a lo negativo) o de otra población.' },
  indirecta: { nombre: 'Evidencia indirecta', descripcion: 'Solo hay datos conductuales o fisiológicos (p. ej., cortisol), sin neuroimagen. La representación es un modelo plausible, no una medición.' },
};
