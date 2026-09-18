// Un cerebro completo (corteza translúcida por región + subcorticales + marcadores) con materiales propios,
// de modo que dos instancias compartan geometría pero se iluminen de forma independiente.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { REGIONES, REGION_POR_ID, MALLA_A_REGION, COLORES, type Lado } from '../datos.ts';
import { posicionAnclaje, type ModeloCerebro } from '../modelo/CargarModelo.ts';
import { crearHalo } from './Halos.ts';

const ESFERA = new THREE.SphereGeometry(2.6, 20, 16);
const OPACIDAD_CORTEZA = 0.3;

interface Halo { sprite: THREE.Sprite; escala: number }

export class CerebroVista {
  readonly grupo = new THREE.Group();
  /** Mallas sobre las que se hace raycast (clic). */
  readonly mallasClic: THREE.Mesh[] = [];
  private materiales = new Map<string, THREE.MeshStandardMaterial>();
  private basesColor = new Map<string, THREE.Color>();
  private halos = new Map<string, Halo[]>();
  private niveles = new Map<string, number>();
  private corticales: THREE.Mesh[] = [];
  private colorActivacion = new THREE.Color(COLORES.activacion);
  private colorDesactivacion = new THREE.Color(COLORES.desactivacion);
  private corteza = new THREE.Color(COLORES.corteza_base);

  constructor(private modelo: ModeloCerebro, readonly lado: Lado) {
    this.construirCorteza();
    this.construirSubcorticales();
    this.construirMarcadores();
  }

  private material(regionId: string | undefined, tipo: 'cortical' | 'subcortical' | 'marcador'): THREE.MeshStandardMaterial {
    const clave = regionId ?? '__corteza__';
    let m = this.materiales.get(clave);
    if (m) return m;
    const region = regionId ? REGION_POR_ID.get(regionId) : undefined;
    if (tipo === 'cortical') {
      m = new THREE.MeshStandardMaterial({
        color: this.corteza, transparent: true, opacity: OPACIDAD_CORTEZA, roughness: 0.62, metalness: 0.05,
        depthWrite: false, side: THREE.FrontSide,
      });
      this.basesColor.set(clave, this.corteza.clone());
    } else {
      const c = new THREE.Color(region?.color ?? '#999');
      m = new THREE.MeshStandardMaterial({
        color: c, roughness: 0.5, metalness: 0.08, emissive: c, emissiveIntensity: tipo === 'marcador' ? 0.6 : 0.12,
      });
      this.basesColor.set(clave, c);
    }
    this.materiales.set(clave, m);
    return m;
  }

  private agregarHalo(regionId: string | undefined, posicion: THREE.Vector3, escala: number) {
    if (!regionId) return;
    const region = REGION_POR_ID.get(regionId)!;
    const sprite = crearHalo(region.color);
    sprite.position.copy(posicion);
    this.grupo.add(sprite);
    const lista = this.halos.get(regionId) ?? [];
    lista.push({ sprite, escala });
    this.halos.set(regionId, lista);
  }

  private construirCorteza() {
    for (const hemi of ['lh', 'rh']) {
      const nombres = [...this.modelo.geometrias.keys()].filter((n) => n.startsWith(`${hemi}_pial_`));
      const geoms = nombres.map((n) => this.modelo.geometrias.get(n)!);
      const fusion = mergeGeometries(geoms, true);
      if (!fusion) throw new Error(`No se pudo fusionar la corteza ${hemi}`);
      const materiales = nombres.map((n) => this.material(MALLA_A_REGION.get(n), 'cortical'));
      const mesh = new THREE.Mesh(fusion, materiales);
      mesh.userData = { regiones: nombres.map((n) => MALLA_A_REGION.get(n) ?? null) };
      mesh.renderOrder = 10;
      this.grupo.add(mesh);
      this.mallasClic.push(mesh);
      this.corticales.push(mesh);
      for (const n of nombres) {
        const caja = this.modelo.cajas.get(n)!;
        const diag = caja.getSize(new THREE.Vector3()).length();
        this.agregarHalo(MALLA_A_REGION.get(n), this.modelo.centroides.get(n)!, diag * 0.7);
      }
    }
  }

  private construirSubcorticales() {
    for (const r of REGIONES) {
      if (r.tipo !== 'subcortical') continue;
      for (const n of r.mallas ?? []) {
        const g = this.modelo.geometrias.get(n);
        if (!g) continue;
        const mesh = new THREE.Mesh(g, this.material(r.id, 'subcortical'));
        mesh.userData = { region: r.id };
        this.grupo.add(mesh);
        this.mallasClic.push(mesh);
        const diag = this.modelo.cajas.get(n)!.getSize(new THREE.Vector3()).length();
        this.agregarHalo(r.id, this.modelo.centroides.get(n)!, Math.max(diag * 1.1, 18));
      }
    }
  }

  private construirMarcadores() {
    for (const r of REGIONES) {
      if (r.tipo !== 'marcador') continue;
      for (const a of r.anclajes ?? []) {
        const p = posicionAnclaje(a);
        const mesh = new THREE.Mesh(ESFERA, this.material(r.id, 'marcador'));
        mesh.position.copy(p);
        mesh.userData = { region: r.id };
        this.grupo.add(mesh);
        this.mallasClic.push(mesh);
        this.agregarHalo(r.id, p, 16);
      }
    }
  }

  /** Id de región a partir de una intersección de raycast. */
  regionDe(hit: THREE.Intersection): string | null {
    const ud = hit.object.userData as { region?: string; regiones?: (string | null)[] };
    if (ud.region) return ud.region;
    if (ud.regiones && hit.face) return ud.regiones[hit.face.materialIndex] ?? null;
    return null;
  }

  nivel(regionId: string): number { return this.niveles.get(regionId) ?? 0; }

  /** Nivel de activación: 0 = basal, 1 = activación plena, negativo = desactivación. */
  setNivel(regionId: string, nivel: number) {
    const region = REGION_POR_ID.get(regionId);
    const m = this.materiales.get(regionId);
    if (!region || !m) return;
    this.niveles.set(regionId, nivel);
    const a = Math.min(Math.abs(nivel), 1.5);
    const col = nivel >= 0 ? this.colorActivacion : this.colorDesactivacion;
    const base = this.basesColor.get(regionId)!;
    if (region.tipo === 'cortical') {
      m.emissive.copy(col);
      m.emissiveIntensity = a * 0.85;
      m.opacity = OPACIDAD_CORTEZA + Math.min(a, 1) * 0.5;
      m.color.copy(base).lerp(col, Math.min(a, 1) * 0.6);
    } else {
      m.emissive.copy(base).lerp(col, Math.min(a, 1));
      m.emissiveIntensity = (region.tipo === 'marcador' ? 0.6 : 0.12) + a * 1.3;
      m.color.copy(base).lerp(col, Math.min(a, 1) * 0.5);
    }
    for (const h of this.halos.get(regionId) ?? []) {
      h.sprite.visible = a > 0.02;
      (h.sprite.material as THREE.SpriteMaterial).opacity = Math.min(a, 1.5) * 0.7;
      (h.sprite.material as THREE.SpriteMaterial).color.copy(col);
      h.sprite.scale.setScalar(h.escala * (0.8 + 0.5 * Math.min(a, 1.5)));
    }
  }

  reiniciar() { for (const id of [...this.niveles.keys()]) this.setNivel(id, 0); }

  /** Pulso suave de los halos activos; t en segundos. */
  actualizar(t: number) {
    const pulso = 1 + 0.07 * Math.sin(t * 2 * Math.PI * 0.8);
    for (const [id, lista] of this.halos) {
      const a = Math.min(Math.abs(this.niveles.get(id) ?? 0), 1.5);
      if (a <= 0.02) continue;
      for (const h of lista) h.sprite.scale.setScalar(h.escala * (0.8 + 0.5 * a) * pulso);
    }
  }

  setCortezaVisible(visible: boolean) { for (const m of this.corticales) m.visible = visible; }
  get hayActivos(): boolean { for (const v of this.niveles.values()) if (Math.abs(v) > 0.02) return true; return false; }
}
