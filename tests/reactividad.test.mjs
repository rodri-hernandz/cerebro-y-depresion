import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progresoCurva, eficacia, multiplicadorRegion, respuestaDepresion, nivelNT, impulso } from '../src/motor/Reactividad.ts';
import { envolvente, instantanea, duracionTotal } from '../src/motor/Secuenciador.ts';

const datos = {
  reactividad_base: { accumbens: 0.55, amigdala: 1.5 },
  neurotransmisores_base: { dopamina: 0.7, cortisol: 1.5 },
  escala_severidad: { leve: 0.5, moderada: 1.0, grave: 1.4 },
};
const sin = (severidad = 'moderada') => ({ severidad, tratamiento: null, dias: 0 });
const cerca = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('severidad escala la desviación respecto a 1', () => {
  cerca(multiplicadorRegion(datos, 'accumbens', sin('moderada')), 0.55);
  cerca(multiplicadorRegion(datos, 'accumbens', sin('leve')), 0.775);
  cerca(multiplicadorRegion(datos, 'accumbens', sin('grave')), 1 - 0.45 * 1.4);
  cerca(multiplicadorRegion(datos, 'desconocida', sin()), 1);
});

test('respuesta: hipo en recompensa, hiper en amenaza, desactivación atenuada si hiperreactiva', () => {
  cerca(respuestaDepresion(datos, 'accumbens', 1.0, sin()), 0.55);
  cerca(respuestaDepresion(datos, 'amigdala', 0.8, sin()), 1.2);
  cerca(respuestaDepresion(datos, 'amigdala', -0.6, sin()), -0.4);
  assert.equal(respuestaDepresion(datos, 'amigdala', 1.5, sin('grave')), 1.5, 'se recorta a 1.5');
});

test('mod_depresion sustituye la base de la región', () => {
  cerca(respuestaDepresion(datos, 'amigdala', 1.0, sin(), 0.5), 0.5);
  cerca(respuestaDepresion(datos, 'amigdala', 1.0, sin('leve'), 0.5), 0.75);
});

test('curva logística: 0 al inicio, ~0.5 en semana_50, →1', () => {
  const c = { tipo: 'logistica', semana_50: 4, pendiente: 1.3, e_max: 0.8 };
  assert.equal(progresoCurva(c, 0), 0);
  const mitad = progresoCurva(c, 28);
  assert.ok(mitad > 0.45 && mitad < 0.55, `mitad=${mitad}`);
  assert.ok(progresoCurva(c, 7 * 20) > 0.99);
});

test('curva ketamina: pico y semivida', () => {
  const c = { tipo: 'ketamina', pico_dias: 1, semivida_dias: 5, e_max: 0.8 };
  cerca(progresoCurva(c, 1), 1);
  cerca(progresoCurva(c, 6), 0.5);
  cerca(progresoCurva(c, 0.5), 0.5);
  const mant = { ...c, intervalo_dias: 3.5 };
  assert.ok(progresoCurva(mant, 30) > progresoCurva(c, 30), 'el mantenimiento sostiene el efecto');
});

test('tratamiento normaliza hacia 1 según eficacia y fracción por región', () => {
  const t = { id: 't', curva: { tipo: 'lineal', dias_max: 10, e_max: 1 }, efecto_global: 0.5, efecto_region: { accumbens: 1 } };
  const estado = { severidad: 'moderada', tratamiento: t, dias: 10 };
  cerca(eficacia(t, 10, 'accumbens', 'region'), 1);
  cerca(eficacia(t, 10, 'amigdala', 'region'), 0.5);
  cerca(multiplicadorRegion(datos, 'accumbens', estado), 1);
  cerca(multiplicadorRegion(datos, 'amigdala', estado), 1.25);
  cerca(multiplicadorRegion(datos, 'accumbens', { ...estado, dias: 5 }), 0.775);
});

test('neurotransmisores: basal reducido, respuesta atenuada, impulso directo', () => {
  const n = nivelNT(datos, 'dopamina', 1.6, sin());
  cerca(n.normal, 1.6);
  cerca(n.basalDepresion, 0.7);
  cerca(n.depresion, 0.7 + 0.6 * 0.7);
  const t = { id: 'x', curva: { tipo: 'lineal', dias_max: 1, e_max: 1 }, efecto_global: 1, impulso_nt: { dopamina: { magnitud: 0.3, rampa_dias: 1 } } };
  const tratado = nivelNT(datos, 'dopamina', 1.6, { severidad: 'moderada', tratamiento: t, dias: 5 });
  cerca(tratado.basalDepresion, 1.3);
  cerca(tratado.depresion, 1.6 + 0.3);
  cerca(impulso(t, 0.5, 'dopamina'), 0.15);
});

test('secuenciador: envolvente y niveles por cerebro', () => {
  const sec = [
    { region: 'accumbens', t_inicio_s: 0, duracion_s: 2, intensidad: 1 },
    { region: 'amigdala', t_inicio_s: 1, duracion_s: 1, intensidad: -0.5 },
  ];
  assert.equal(envolvente(sec[0], -1), 0);
  assert.equal(envolvente(sec[0], 1), 1);
  assert.ok(envolvente(sec[0], 2.45) > 0 && envolvente(sec[0], 2.45) < 1);
  cerca(duracionTotal(sec), 2.9);
  const s = instantanea(sec, 1.5, datos, sin());
  cerca(s.normal.get('accumbens'), 1);
  cerca(s.depresion.get('accumbens'), 0.55);
  cerca(s.normal.get('amigdala'), -0.5);
  cerca(s.depresion.get('amigdala'), -0.5 / 1.5);
  assert.equal(s.terminado, false);
  assert.equal(instantanea(sec, 5, datos, sin()).terminado, true);
});
