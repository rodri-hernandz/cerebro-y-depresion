// Partículas que fluyen por las vías de cada neurotransmisor. La densidad y la velocidad dependen del nivel
// (multiplicador sobre la línea base 1.0), distinto en cada cerebro.
import * as THREE from 'three';
import { REGION_POR_ID, GEOMETRIA, type Region } from '../datos.ts';
import { posicionAnclaje, type ModeloCerebro } from '../modelo/CargarModelo.ts';
import { texturaHalo } from './Halos.ts';
import viasJson from '../../data/vias.json';

export interface InfoNT { nombre: string; corto: string; color: string; vias: string[][]; paciente: string }
export const NEUROTRANSMISORES = viasJson.neurotransmisores as Record<string, InfoNT>;
export const NT_PRINCIPALES = viasJson.principales as string[];

const N_POR_CURVA = 56;
type Lado = 'izq' | 'der';

/** Punto representativo de una región en un hemisferio (centroide de su malla o posición de su anclaje). */
function puntoRegion(modelo: ModeloCerebro, region: Region, lado: Lado): THREE.Vector3 | null {
  if (region.tipo === 'marcador') {
    const puntos = (region.anclajes ?? []).map(posicionAnclaje);
    if (!puntos.length) return null;
    if (puntos.length === 1) return puntos[0];
    puntos.sort((a, b) => a.x - b.x);
    return lado === 'izq' ? puntos[0] : puntos[puntos.length - 1];
  }
  const candidatas = (region.mallas ?? []).filter((m) => GEOMETRIA.mallas[m]?.hemisferio === lado);
  const nombres = candidatas.length ? candidatas : (region.mallas ?? []);
  if (!nombres.length) return null;
  const acumulado = new THREE.Vector3();
  for (const n of nombres) acumulado.add(modelo.centroides.get(n)!);
  return acumulado.divideScalar(nombres.length);
}

interface Flujo { puntos: THREE.Points; geometria: THREE.BufferGeometry; curva: THREE.CatmullRomCurve3; fases: Float32Array; nt: string }

export class Particulas {
  readonly grupo = new THREE.Group();
  private flujos = new Map<string, Flujo[]>();
  private niveles = new Map<string, number>();
  private visibles = new Set<string>();

  constructor(modelo: ModeloCerebro) {
    for (const [nt, info] of Object.entries(NEUROTRANSMISORES)) {
      const lista: Flujo[] = [];
      for (const via of info.vias) {
        for (const lado of ['izq', 'der'] as Lado[]) {
          const puntos = via.map((id) => puntoRegion(modelo, REGION_POR_ID.get(id)!, lado)).filter((p): p is THREE.Vector3 => !!p);
          if (puntos.length < 2) continue;
          // pequeño abombamiento hacia afuera para que las dos vías no se superpongan y se aprecie el recorrido
          const curva = new THREE.CatmullRomCurve3(puntos, false, 'centripetal', 0.6);
          const geometria = new THREE.BufferGeometry();
          geometria.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_POR_CURVA * 3), 3));
          const material = new THREE.PointsMaterial({
            size: 3.4, map: texturaHalo(), color: new THREE.Color(info.color), transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: true,
          });
          const points = new THREE.Points(geometria, material);
          points.renderOrder = 25;
          points.visible = false;
          points.frustumCulled = false;
          const fases = new Float32Array(N_POR_CURVA);
          for (let i = 0; i < N_POR_CURVA; i++) fases[i] = Math.random();
          this.grupo.add(points);
          lista.push({ puntos: points, geometria, curva, fases, nt });
        }
      }
      this.flujos.set(nt, lista);
    }
  }

  /** Neurotransmisores que se dibujan (los demás se ocultan). */
  setVisibles(nts: Iterable<string>) {
    this.visibles = new Set(nts);
    for (const [nt, lista] of this.flujos) for (const f of lista) f.puntos.visible = this.visibles.has(nt) && (this.niveles.get(nt) ?? 0) > 0.03;
  }

  /** Nivel (multiplicador, 1 = línea base) de un neurotransmisor en este cerebro. */
  setNivel(nt: string, nivel: number) {
    this.niveles.set(nt, nivel);
    const lista = this.flujos.get(nt);
    if (!lista) return;
    const densidad = THREE.MathUtils.clamp(nivel / 2.2, 0, 1);
    const cuenta = nivel <= 0.03 ? 0 : Math.max(3, Math.round(N_POR_CURVA * densidad));
    for (const f of lista) {
      f.geometria.setDrawRange(0, cuenta);
      f.puntos.visible = this.visibles.has(nt) && cuenta > 0;
      (f.puntos.material as THREE.PointsMaterial).opacity = 0.55 + 0.35 * Math.min(1, nivel / 1.5);
    }
  }

  nivel(nt: string) { return this.niveles.get(nt) ?? 0; }

  actualizar(t: number) {
    const p = new THREE.Vector3();
    for (const [nt, lista] of this.flujos) {
      const nivel = this.niveles.get(nt) ?? 0;
      const velocidad = 0.05 + 0.06 * Math.min(nivel, 2.5);
      for (const f of lista) {
        if (!f.puntos.visible) continue;
        const arr = f.geometria.getAttribute('position') as THREE.BufferAttribute;
        const n = f.geometria.drawRange.count;
        for (let i = 0; i < n; i++) {
          const s = (f.fases[i] + t * velocidad) % 1;
          f.curva.getPointAt(s, p);
          arr.setXYZ(i, p.x, p.y, p.z);
        }
        arr.needsUpdate = true;
      }
    }
  }
}
