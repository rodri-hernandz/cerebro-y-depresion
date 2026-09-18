// Motor de reactividad: cómo se transforma la respuesta de un cerebro sano en la de un cerebro con depresión,
// según severidad y tratamiento en curso. Funciones puras, sin dependencias (se prueban con node --test).

export type Severidad = 'leve' | 'moderada' | 'grave';

export interface DatosDepresion {
  reactividad_base: Record<string, number>;
  neurotransmisores_base: Record<string, number>;
  escala_severidad: Record<Severidad, number>;
}

export type Curva =
  | { tipo: 'logistica'; semana_50: number; pendiente: number; e_max: number }
  | { tipo: 'ketamina'; pico_dias: number; semivida_dias: number; e_max: number; intervalo_dias?: number }
  | { tipo: 'lineal'; dias_max: number; e_max: number };

export interface ImpulsoNT { magnitud: number; inicio_dias?: number; rampa_dias?: number; duracion_dias?: number }

export interface TratamientoModelo {
  id: string;
  curva: Curva;
  efecto_global?: number;
  efecto_region?: Record<string, number>;
  efecto_nt?: Record<string, number>;
  impulso_nt?: Record<string, ImpulsoNT>;
}

export interface Estado {
  severidad: Severidad;
  tratamiento: TratamientoModelo | null;
  dias: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Fracción (0–1) del efecto máximo alcanzada a los `dias` de tratamiento. */
export function progresoCurva(c: Curva, dias: number): number {
  if (dias <= 0) return 0;
  switch (c.tipo) {
    case 'logistica': {
      const f = (d: number) => 1 / (1 + Math.exp(-c.pendiente * (d / 7 - c.semana_50)));
      const f0 = f(0);
      return clamp((f(dias) - f0) / (1 - f0), 0, 1);
    }
    case 'ketamina': {
      const una = (d: number) => {
        if (d < 0) return 0;
        if (d < c.pico_dias) return d / c.pico_dias;
        return Math.exp((-Math.LN2 * (d - c.pico_dias)) / c.semivida_dias);
      };
      if (!c.intervalo_dias) return clamp(una(dias), 0, 1);
      let suma = 0;
      for (let k = 0; k * c.intervalo_dias <= dias; k++) suma += una(dias - k * c.intervalo_dias);
      return clamp(suma, 0, 1);
    }
    case 'lineal':
      return clamp(dias / c.dias_max, 0, 1);
  }
}

/** Eficacia E ∈ [0,1] del tratamiento sobre una región o neurotransmisor concreto. */
export function eficacia(t: TratamientoModelo | null, dias: number, clave: string, tabla: 'region' | 'nt'): number {
  if (!t) return 0;
  const especifico = tabla === 'region' ? t.efecto_region?.[clave] : t.efecto_nt?.[clave];
  const fraccion = especifico ?? t.efecto_global ?? 0.5;
  return clamp(t.curva.e_max * progresoCurva(t.curva, dias) * fraccion, 0, 1);
}

/** Multiplicador de reactividad de una región en depresión (1 = igual que sano), ya con severidad y tratamiento. */
export function multiplicadorRegion(datos: DatosDepresion, region: string, estado: Estado, modDepresion?: number): number {
  const base = modDepresion ?? datos.reactividad_base[region] ?? 1;
  const m = 1 + (base - 1) * datos.escala_severidad[estado.severidad];
  const E = eficacia(estado.tratamiento, estado.dias, region, 'region');
  return 1 + (m - 1) * (1 - E);
}

/** Respuesta del cerebro con depresión dada la intensidad en el cerebro sano. */
export function respuestaDepresion(datos: DatosDepresion, region: string, intensidadNormal: number, estado: Estado, modDepresion?: number): number {
  const R = multiplicadorRegion(datos, region, estado, modDepresion);
  const r = intensidadNormal >= 0 ? intensidadNormal * R : intensidadNormal / R;
  return clamp(r, -1.5, 1.5);
}

/** Aumento directo de un neurotransmisor por el tratamiento (además de la normalización). */
export function impulso(t: TratamientoModelo | null, dias: number, nt: string): number {
  const i = t?.impulso_nt?.[nt];
  if (!i || dias <= 0) return 0;
  const inicio = i.inicio_dias ?? 0;
  const rampa = Math.max(i.rampa_dias ?? 1, 1e-6);
  const subida = clamp((dias - inicio) / rampa, 0, 1);
  const caida = i.duracion_dias ? Math.exp(-Math.max(0, dias - inicio - i.duracion_dias) / i.duracion_dias) : 1;
  return i.magnitud * subida * caida;
}

export interface NivelNT { normal: number; depresion: number; basalDepresion: number }

/**
 * Nivel de un neurotransmisor (multiplicador sobre la línea base sana = 1) en ambos cerebros.
 * `valorNormal` es el nivel evocado por el estímulo en el cerebro sano (1 = sin cambio).
 */
export function nivelNT(datos: DatosDepresion, nt: string, valorNormal: number, estado: Estado, modDepresion?: number): NivelNT {
  const baseNT = datos.neurotransmisores_base[nt] ?? 1;
  const b = 1 + (baseNT - 1) * datos.escala_severidad[estado.severidad];
  const mod0 = modDepresion ?? baseNT;
  const mod = 1 + (mod0 - 1) * datos.escala_severidad[estado.severidad];
  const E = eficacia(estado.tratamiento, estado.dias, nt, 'nt');
  const bTrat = 1 + (b - 1) * (1 - E);
  const modTrat = 1 + (mod - 1) * (1 - E);
  const imp = impulso(estado.tratamiento, estado.dias, nt);
  return {
    normal: valorNormal,
    basalDepresion: Math.max(0, bTrat + imp),
    depresion: Math.max(0, bTrat + (valorNormal - 1) * modTrat + imp),
  };
}
