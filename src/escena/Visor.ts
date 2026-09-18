// Renderiza dos cerebros lado a lado (scissor) con una sola cámara controlada; la segunda cámara la copia.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CerebroVista } from './CerebroVista.ts';
import { Particulas } from './Particulas.ts';
import { Barras3D } from './Barras3D.ts';
import type { ModeloCerebro } from '../modelo/CargarModelo.ts';
import type { Lado } from '../datos.ts';

export interface ClicRegion { region: string; lado: Lado; x: number; y: number }

export class Visor {
  readonly renderer: THREE.WebGLRenderer;
  readonly camA: THREE.PerspectiveCamera;
  readonly camB: THREE.PerspectiveCamera;
  readonly controles: OrbitControls;
  readonly escenaA = new THREE.Scene();
  readonly escenaB = new THREE.Scene();
  readonly cerebroA: CerebroVista;
  readonly cerebroB: CerebroVista;
  readonly particulasA: Particulas;
  readonly particulasB: Particulas;
  readonly barrasA: Barras3D;
  readonly barrasB: Barras3D;
  onClicRegion?: (c: ClicRegion) => void;
  onClicVacio?: () => void;
  /** Se llama cada frame con el tiempo en segundos; devolver true si hay animación en curso. */
  onFrame?: (t: number, dt: number) => boolean;
  private sucio = true;
  /** Si hay flujos de neurotransmisores visibles se anima de forma continua. */
  particulasActivas = true;
  private reloj = new THREE.Timer();
  private ray = new THREE.Raycaster();
  private inicioPuntero: { x: number; y: number } | null = null;

  constructor(readonly canvas: HTMLCanvasElement, modelo: ModeloCerebro) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const d = modelo.radio * 2.35;
    this.camA = new THREE.PerspectiveCamera(36, 1, 1, 4000);
    this.camA.position.set(-d * 0.62, d * 0.42, -d * 0.66);
    this.camB = this.camA.clone();

    this.controles = new OrbitControls(this.camA, canvas);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.08;
    this.controles.enablePan = false;
    this.controles.minDistance = modelo.radio * 1.3;
    this.controles.maxDistance = modelo.radio * 6;
    this.controles.target.set(0, 0, 0);
    this.controles.addEventListener('change', () => { this.sucio = true; });

    this.cerebroA = new CerebroVista(modelo, 'normal');
    this.cerebroB = new CerebroVista(modelo, 'depresion');
    this.particulasA = new Particulas(modelo);
    this.particulasB = new Particulas(modelo);
    this.barrasA = new Barras3D(this.camA);
    this.barrasB = new Barras3D(this.camB);
    this.escenaA.add(this.cerebroA.grupo, this.particulasA.grupo, this.camA, ...crearLuces());
    this.escenaB.add(this.cerebroB.grupo, this.particulasB.grupo, this.camB, ...crearLuces());

    new ResizeObserver(() => this.redimensionar()).observe(canvas.parentElement ?? canvas);
    this.redimensionar();

    canvas.addEventListener('pointerdown', (e) => { this.inicioPuntero = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!this.inicioPuntero) return;
      const dx = e.clientX - this.inicioPuntero.x, dy = e.clientY - this.inicioPuntero.y;
      this.inicioPuntero = null;
      if (dx * dx + dy * dy > 36) return;
      const r = canvas.getBoundingClientRect();
      this.clic(e.clientX - r.left, e.clientY - r.top);
    });

    this.renderer.setAnimationLoop(() => this.frame());
  }

  cerebro(lado: Lado) { return lado === 'normal' ? this.cerebroA : this.cerebroB; }
  invalidar() { this.sucio = true; }

  private redimensionar() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspecto = (w / 2) / h;
    this.camA.aspect = aspecto; this.camA.updateProjectionMatrix();
    this.camB.aspect = aspecto; this.camB.updateProjectionMatrix();
    this.barrasA?.distribuir(); this.barrasB?.distribuir();
    this.sucio = true;
  }

  private frame() {
    this.reloj.update();
    const dt = this.reloj.getDelta();
    const t = this.reloj.getElapsed();
    const cambioControles = this.controles.update();
    let animando = false;
    if (this.onFrame) animando = this.onFrame(t, dt) || animando;
    if (this.cerebroA.hayActivos || this.cerebroB.hayActivos) {
      this.cerebroA.actualizar(t); this.cerebroB.actualizar(t); animando = true;
    }
    if (this.barrasA.actualizar(dt)) animando = true;
    if (this.barrasB.actualizar(dt)) animando = true;
    if (this.particulasActivas) { this.particulasA.actualizar(t); this.particulasB.actualizar(t); animando = true; }
    if (cambioControles || animando || this.sucio) { this.render(); this.sucio = false; }
  }

  private render() {
    const w = this.canvas.clientWidth || this.canvas.width, h = this.canvas.clientHeight || this.canvas.height;
    if (!w || !h) return;
    const mitad = Math.floor(w / 2);
    const r = this.renderer;
    r.setScissorTest(true);
    r.setViewport(0, 0, mitad, h); r.setScissor(0, 0, mitad, h);
    r.render(this.escenaA, this.camA);
    this.camB.position.copy(this.camA.position);
    this.camB.quaternion.copy(this.camA.quaternion);
    this.camB.updateMatrixWorld();
    r.setViewport(mitad, 0, w - mitad, h); r.setScissor(mitad, 0, w - mitad, h);
    r.render(this.escenaB, this.camB);
  }

  private clic(x: number, y: number) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const mitad = Math.floor(w / 2);
    const lado: Lado = x < mitad ? 'normal' : 'depresion';
    const nx = lado === 'normal' ? (x / mitad) * 2 - 1 : ((x - mitad) / (w - mitad)) * 2 - 1;
    const ny = -(y / h) * 2 + 1;
    const cam = lado === 'normal' ? this.camA : this.camB;
    const cerebro = this.cerebro(lado);
    this.ray.setFromCamera(new THREE.Vector2(nx, ny), cam);
    const hits = this.ray.intersectObjects(cerebro.mallasClic.filter((m) => m.visible), false);
    for (const hit of hits) {
      const region = cerebro.regionDe(hit);
      if (region) { this.onClicRegion?.({ region, lado, x, y }); return; }
    }
    this.onClicVacio?.();
  }
}

function crearLuces(): THREE.Light[] {
  const hemi = new THREE.HemisphereLight(0xdfe7ff, 0x1a1f2b, 1.1);
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(180, 320, -240);
  const relleno = new THREE.DirectionalLight(0x9fb8ff, 0.55);
  relleno.position.set(-260, -80, 220);
  return [hemi, sol, relleno];
}
