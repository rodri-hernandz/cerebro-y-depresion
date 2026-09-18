// Etiquetas de texto como sprites con textura de canvas (funcionan sin fuentes externas ni CSS2DRenderer).
import * as THREE from 'three';

export interface OpcionesEtiqueta { color?: string; fondo?: string | null; tamano?: number; peso?: number; alturaMundo?: number }

export class Etiqueta {
  readonly sprite: THREE.Sprite;
  private canvas = document.createElement('canvas');
  private textura: THREE.CanvasTexture;
  private texto = '';
  private opciones: Required<OpcionesEtiqueta>;

  constructor(texto: string, opciones: OpcionesEtiqueta = {}) {
    this.opciones = { color: '#e6ebf5', fondo: null, tamano: 28, peso: 600, alturaMundo: 6, ...opciones };
    this.textura = new THREE.CanvasTexture(this.canvas);
    this.textura.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: this.textura, transparent: true, depthTest: false, depthWrite: false });
    this.sprite = new THREE.Sprite(material);
    this.sprite.renderOrder = 30;
    this.setTexto(texto);
  }

  setTexto(texto: string) {
    if (texto === this.texto) return;
    this.texto = texto;
    const { color, fondo, tamano, peso, alturaMundo } = this.opciones;
    const ctx = this.canvas.getContext('2d')!;
    const fuente = `${peso} ${tamano}px ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.font = fuente;
    const ancho = Math.ceil(ctx.measureText(texto).width) + 24;
    const alto = Math.ceil(tamano * 1.5);
    this.canvas.width = Math.max(2, ancho);
    this.canvas.height = alto;
    ctx.clearRect(0, 0, ancho, alto);
    if (fondo) {
      ctx.fillStyle = fondo;
      ctx.beginPath(); ctx.roundRect(0, 0, ancho, alto, alto / 2); ctx.fill();
    }
    ctx.font = fuente;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(texto, ancho / 2, alto / 2);
    this.textura.needsUpdate = true;
    this.sprite.scale.set(alturaMundo * (ancho / alto), alturaMundo, 1);
  }

  /** Altura en unidades de mundo; se conserva al cambiar el texto. */
  setAltura(h: number) { this.opciones.alturaMundo = h; const r = this.sprite.scale.x / this.sprite.scale.y; this.sprite.scale.set(h * r, h, 1); }

  setOpacidad(o: number) { (this.sprite.material as THREE.SpriteMaterial).opacity = o; }
}
