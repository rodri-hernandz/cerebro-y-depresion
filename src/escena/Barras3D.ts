// Barras 3D comparativas (nivel de neurotransmisores) ancladas a la cámara de cada vista,
// de modo que siempre quedan visibles al pie del cerebro sin dejar de ser objetos 3D iluminados.
import * as THREE from 'three';
import { Etiqueta } from './Etiquetas.ts';
import { NEUROTRANSMISORES } from './Particulas.ts';

interface Barra { nt: string; malla: THREE.Mesh; valor: Etiqueta; nombre: Etiqueta; nivel: number; objetivo: number }

export class Barras3D {
  readonly grupo = new THREE.Group();
  private barras = new Map<string, Barra>();
  private orden: string[] = [];
  private base: THREE.Mesh;
  private distancia: number;

  constructor(private camara: THREE.PerspectiveCamera) {
    this.distancia = 100;
    this.base = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }));
    this.grupo.add(this.base);
    camara.add(this.grupo);
    this.grupo.position.set(0, 0, -this.distancia);
  }

  /** Define qué neurotransmisores se muestran y en qué orden. */
  setNeurotransmisores(nts: string[]) {
    this.orden = nts.filter((n) => NEUROTRANSMISORES[n]);
    for (const nt of this.orden) {
      if (this.barras.has(nt)) continue;
      const info = NEUROTRANSMISORES[nt];
      const color = new THREE.Color(info.color);
      const malla = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.1 }),
      );
      malla.geometry.translate(0, 0.5, 0); // crece desde la base
      const valor = new Etiqueta('×1.0', { color: '#ffffff', tamano: 26, peso: 700 });
      const nombre = new Etiqueta(info.corto, { color: info.color, tamano: 22, peso: 700 });
      this.grupo.add(malla, valor.sprite, nombre.sprite);
      this.barras.set(nt, { nt, malla, valor, nombre, nivel: 1, objetivo: 1 });
    }
    for (const [nt, b] of this.barras) {
      const visible = this.orden.includes(nt);
      b.malla.visible = visible; b.valor.sprite.visible = visible; b.nombre.sprite.visible = visible;
    }
    this.distribuir();
  }

  setNivel(nt: string, nivel: number) {
    const b = this.barras.get(nt);
    if (b) b.objetivo = Math.max(0, nivel);
  }

  /** Recoloca el conjunto según la distancia y el aspecto de la cámara (llamar tras redimensionar). */
  distribuir() {
    const cam = this.camara;
    const d = this.distancia;
    const mediaAltura = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * d;
    const mediaAnchura = mediaAltura * cam.aspect;
    const n = this.orden.length;
    const ancho = Math.min(mediaAnchura * 0.11, (mediaAnchura * 1.7) / Math.max(1, n) * 0.55);
    const paso = ancho * 1.85;
    const x0 = -((n - 1) * paso) / 2;
    const y0 = -mediaAltura * 0.74;
    this.escalaAltura = mediaAltura * 0.14;
    this.base.position.set(0, y0 + this.escalaAltura, 0);
    this.base.scale.set(Math.max(paso * n, ancho * 2) + ancho, 0.12, ancho * 0.5);
    this.base.visible = n > 0;
    this.orden.forEach((nt, i) => {
      const b = this.barras.get(nt)!;
      const x = x0 + i * paso;
      b.malla.position.set(x, y0, 0);
      b.malla.scale.set(ancho, Math.max(0.01, b.nivel * this.escalaAltura), ancho * 0.6);
      b.nombre.sprite.position.set(x, y0 - ancho * 0.6, 0);
      const escalaEtiqueta = ancho * 0.62;
      b.nombre.setAltura(escalaEtiqueta);
      b.valor.setAltura(escalaEtiqueta * 0.9);
      b.valor.sprite.position.set(x, y0 + b.nivel * this.escalaAltura + ancho * 0.55, 0);
    });
  }
  private escalaAltura = 1;

  /** Anima suavemente hacia el objetivo; devuelve true si algo cambió. */
  actualizar(dt: number): boolean {
    let cambio = false;
    for (const nt of this.orden) {
      const b = this.barras.get(nt)!;
      const delta = b.objetivo - b.nivel;
      if (Math.abs(delta) < 0.002) continue;
      b.nivel += delta * Math.min(1, dt * 6);
      cambio = true;
      b.malla.scale.y = Math.max(0.01, b.nivel * this.escalaAltura);
      b.valor.sprite.position.y = b.malla.position.y + b.nivel * this.escalaAltura + b.malla.scale.x * 0.55;
      b.valor.setTexto(`×${b.nivel.toFixed(1)}`);
      (b.malla.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + 0.35 * Math.min(1, Math.abs(b.nivel - 1));
    }
    return cambio;
  }
}
