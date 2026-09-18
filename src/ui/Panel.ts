// Panel lateral: pestañas de Estímulos, Tratamientos y Anatomía; severidad; línea de tiempo; explicaciones con citas.
import {
  CATEGORIAS_ESTIMULOS, ESTIMULOS, ESTIMULO_POR_ID, TRATAMIENTOS, TRATAMIENTO_POR_ID, CATEGORIAS_TRATAMIENTOS,
  REGIONES, REGION_POR_ID, NIVELES_EVIDENCIA, type Modo, type Estimulo, type Tratamiento,
} from '../datos.ts';
import type { Severidad } from '../motor/Reactividad.ts';
import { numerar, renderTexto, listaFuentesHTML, instalarPopover } from './Texto.ts';

export type Pestana = 'estimulos' | 'tratamientos' | 'anatomia';
export const DIAS_MAX = 84;

export interface CallbacksPanel {
  onPestana(p: Pestana): void;
  onSeveridad(s: Severidad): void;
  onEstimulo(id: string | null): void;
  onReproducir(): void;
  onTratamiento(id: string | null): void;
  onDias(d: number): void;
  onReproducirTratamiento(): void;
  onRegion(id: string | null): void;
  onRegionHover(id: string, activo: boolean): void;
}

const TIPOS_REGION: Record<string, string> = { cortical: 'Corteza', subcortical: 'Estructuras profundas', marcador: 'Núcleos del tronco y cíngulo' };

export class Panel {
  private modo: Modo = 'paciente';
  private estimulo: Estimulo | null = null;
  private tratamiento: Tratamiento | null = null;
  private dias = 0;
  private reproduciendo = true;
  private reproduciendoTrat = false;
  private region: string | null = null;
  private $: <T extends HTMLElement>(sel: string) => T;

  constructor(private raiz: HTMLElement, private cb: CallbacksPanel) {
    raiz.innerHTML = `
      <nav class="pestanas">
        <button data-pestana="estimulos" class="activa">Estímulos</button>
        <button data-pestana="tratamientos">Tratamientos</button>
        <button data-pestana="anatomia">Anatomía</button>
      </nav>
      <div class="severidad">
        <span class="sev-etiqueta">Severidad de la depresión</span>
        <div class="conmutador" id="severidad">
          <button data-sev="leve">Leve</button><button data-sev="moderada" class="activa">Moderada</button><button data-sev="grave">Grave</button>
        </div>
      </div>
      <div class="contenido" data-pestana="estimulos">
        <p class="ayuda">Elige un estímulo para ver, en tiempo real, qué regiones se activan en cada cerebro y cómo cambian los neurotransmisores.</p>
        <div id="chips-estimulos"></div>
        <section class="explicacion oculta" id="exp-estimulo"></section>
      </div>
      <div class="contenido oculta" data-pestana="tratamientos">
        <p class="ayuda">Elige un tratamiento y recorre las semanas. El cerebro con depresión se irá acercando al cerebro sin depresión. Puedes combinarlo con un estímulo.</p>
        <div id="chips-tratamientos"></div>
        <section class="linea-tiempo oculta" id="linea-tiempo"></section>
        <section class="explicacion oculta" id="exp-tratamiento"></section>
      </div>
      <div class="contenido oculta" data-pestana="anatomia">
        <p class="ayuda">Pasa el cursor o haz clic para localizar cada región en ambos cerebros.</p>
        <div id="lista-regiones"></div>
      </div>
      <div class="pie" id="pie"></div>`;
    this.$ = (sel) => raiz.querySelector(sel) as never;
    instalarPopover(raiz);

    raiz.querySelector('.pestanas')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-pestana]');
      if (b) this.setPestana(b.dataset.pestana as Pestana, true);
    });
    this.$('#severidad').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-sev]');
      if (!b) return;
      this.raiz.querySelectorAll('#severidad button').forEach((x) => x.classList.toggle('activa', x === b));
      cb.onSeveridad(b.dataset.sev as Severidad);
    });
    this.renderChipsEstimulos();
    this.renderChipsTratamientos();
    this.renderRegiones();
  }

  // ---------- utilidades ----------
  private insignia(nivel: keyof typeof NIVELES_EVIDENCIA, resumen?: string) {
    const n = NIVELES_EVIDENCIA[nivel];
    return `<span class="evidencia ${nivel}" data-tip="${(resumen ? `${n.descripcion} ${resumen}` : n.descripcion).replace(/"/g, '&quot;')}">${n.nombre}</span>`;
  }
  private chip(id: string, icono: string, nombre: string, nivel: keyof typeof NIVELES_EVIDENCIA, resumen: string) {
    return `<button class="chip" data-id="${id}"><span class="chip-icono">${icono}</span><span class="chip-nombre">${nombre}</span><span class="punto-ev ${nivel}" data-tip="${NIVELES_EVIDENCIA[nivel].nombre}. ${resumen.replace(/"/g, '&quot;')}"></span></button>`;
  }

  setModo(modo: Modo) {
    this.modo = modo;
    this.renderExplicacionEstimulo();
    this.renderExplicacionTratamiento();
    this.renderLineaTiempo();
    this.renderRegiones();
  }

  setPestana(p: Pestana, notificar = false) {
    this.raiz.querySelectorAll('.pestanas button').forEach((b) => b.classList.toggle('activa', (b as HTMLElement).dataset.pestana === p));
    this.raiz.querySelectorAll<HTMLElement>('.contenido').forEach((c) => c.classList.toggle('oculta', c.dataset.pestana !== p));
    if (notificar) this.cb.onPestana(p);
  }

  setPie(texto: string) { this.$('#pie').textContent = texto; }

  // ---------- estímulos ----------
  private renderChipsEstimulos() {
    const cont = this.$('#chips-estimulos');
    cont.innerHTML = CATEGORIAS_ESTIMULOS.map((c) => {
      const items = ESTIMULOS.filter((e) => e.categoria === c.id);
      if (!items.length) return '';
      return `<div class="grupo-titulo">${c.nombre}</div><div class="chips">${items.map((e) => this.chip(e.id, e.icono, e.nombre_corto, e.nivel_evidencia, e.resumen_evidencia)).join('')}</div>`;
    }).join('');
    cont.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.chip');
      if (!b) return;
      const id = b.dataset.id!;
      this.cb.onEstimulo(this.estimulo?.id === id ? null : id);
    });
  }

  setEstimulo(id: string | null, reproduciendo = true) {
    this.estimulo = id ? ESTIMULO_POR_ID.get(id) ?? null : null;
    this.reproduciendo = reproduciendo;
    this.raiz.querySelectorAll('#chips-estimulos .chip').forEach((c) => c.classList.toggle('activa', (c as HTMLElement).dataset.id === id));
    this.renderExplicacionEstimulo();
  }

  setReproduciendo(v: boolean) {
    this.reproduciendo = v;
    const b = this.raiz.querySelector<HTMLElement>('#btn-play');
    if (b) { b.textContent = v ? '❚❚' : '▶'; b.title = v ? 'Pausar' : 'Reproducir'; }
  }

  private renderExplicacionEstimulo() {
    const sec = this.$('#exp-estimulo');
    const e = this.estimulo;
    if (!e) { sec.classList.add('oculta'); sec.innerHTML = ''; return; }
    const textos = [e.textos.clinico, ...(e.diferencias ?? []).map((d) => d.clinico)];
    const num = numerar(e.refs, textos);
    sec.innerHTML = `
      <header class="exp-cab">
        <div class="exp-titulo"><span class="chip-icono grande">${e.icono}</span><div><h3>${e.nombre}</h3>${this.insignia(e.nivel_evidencia, e.resumen_evidencia)}</div></div>
        <div class="exp-controles">
          <button class="btn-icono" id="btn-play" title="${this.reproduciendo ? 'Pausar' : 'Reproducir'}">${this.reproduciendo ? '❚❚' : '▶'}</button>
          <button class="btn-icono" id="btn-stop" title="Quitar estímulo">■</button>
        </div>
      </header>
      <p class="exp-texto">${renderTexto(e.textos[this.modo], this.modo, num)}</p>
      ${e.diferencias?.length ? `<h4>Qué cambia con depresión</h4><ul class="diferencias">${e.diferencias.map((d) => `<li>${renderTexto(d[this.modo], this.modo, num)}</li>`).join('')}</ul>` : ''}
      ${this.modo === 'clinico' ? `<p class="resumen-ev"><strong>Nivel de evidencia:</strong> ${e.resumen_evidencia}</p>` : ''}
      <details class="fuentes" ${this.modo === 'clinico' ? 'open' : ''}><summary>Fuentes (${num.size})</summary>${listaFuentesHTML(num)}</details>`;
    sec.classList.remove('oculta');
    sec.querySelector('#btn-play')!.addEventListener('click', () => this.cb.onReproducir());
    sec.querySelector('#btn-stop')!.addEventListener('click', () => this.cb.onEstimulo(null));
  }

  // ---------- tratamientos ----------
  private renderChipsTratamientos() {
    const cont = this.$('#chips-tratamientos');
    const cats = Object.keys(CATEGORIAS_TRATAMIENTOS);
    cont.innerHTML = `<div class="chips"><button class="chip chip-ninguno activa" data-id=""><span class="chip-icono">○</span><span class="chip-nombre">Sin tratamiento</span></button></div>` +
      cats.map((c) => {
        const items = TRATAMIENTOS.filter((t) => t.categoria === c);
        if (!items.length) return '';
        return `<div class="grupo-titulo">${CATEGORIAS_TRATAMIENTOS[c]}</div><div class="chips">${items.map((t) => this.chip(t.id, t.icono, t.nombre_corto, t.nivel_evidencia, t.resumen_evidencia)).join('')}</div>`;
      }).join('');
    cont.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.chip');
      if (!b) return;
      const id = b.dataset.id || null;
      this.cb.onTratamiento(this.tratamiento?.id === id ? null : id);
    });
  }

  setTratamiento(id: string | null) {
    this.tratamiento = id ? TRATAMIENTO_POR_ID.get(id) ?? null : null;
    this.raiz.querySelectorAll('#chips-tratamientos .chip').forEach((c) => c.classList.toggle('activa', ((c as HTMLElement).dataset.id || null) === id));
    this.renderLineaTiempo();
    this.renderExplicacionTratamiento();
  }

  setDias(d: number) {
    this.dias = d;
    const r = this.raiz.querySelector<HTMLInputElement>('#dias');
    if (r && Number(r.value) !== Math.round(d)) r.value = String(Math.round(d));
    this.actualizarTextoDias();
  }

  setReproduciendoTratamiento(v: boolean) {
    this.reproduciendoTrat = v;
    const b = this.raiz.querySelector<HTMLElement>('#btn-play-trat');
    if (b) { b.textContent = v ? '❚❚' : '▶'; b.title = v ? 'Pausar' : 'Recorrer las 12 semanas'; }
  }

  private actualizarTextoDias() {
    const t = this.tratamiento;
    const sem = this.raiz.querySelector<HTMLElement>('.lt-semana');
    if (!sem || !t) return;
    const d = Math.round(this.dias);
    const semana = Math.floor(d / 7);
    sem.textContent = d === 0 ? 'Inicio del tratamiento' : `Semana ${semana}${d % 7 ? ` · día ${d}` : ''}`;
    const hitos = [...(t.hitos ?? [])].sort((a, b) => a.dia - b.dia);
    const alcanzado = hitos.filter((h) => h.dia <= d).pop();
    const caja = this.raiz.querySelector<HTMLElement>('.lt-hito-actual');
    if (caja) {
      const num = numerar(t.refs, [t.textos.clinico, ...hitos.map((h) => h.clinico)]);
      caja.innerHTML = alcanzado
        ? `<span class="lt-hito-dia">Desde el día ${alcanzado.dia}</span>${renderTexto(alcanzado[this.modo], this.modo, num)}`
        : `<span class="lt-hito-dia">Antes de empezar</span>${this.modo === 'paciente' ? 'Así está el cerebro con depresión antes de iniciar el tratamiento.' : 'Estado basal del modelo (multiplicadores de reactividad sin corrección).'}`;
    }
    this.raiz.querySelectorAll<HTMLElement>('.lt-hito').forEach((h) => h.classList.toggle('alcanzado', Number(h.dataset.dia) <= d));
  }

  private renderLineaTiempo() {
    const sec = this.$('#linea-tiempo');
    const t = this.tratamiento;
    if (!t) { sec.classList.add('oculta'); sec.innerHTML = ''; return; }
    const hitos = [...(t.hitos ?? [])].sort((a, b) => a.dia - b.dia);
    sec.innerHTML = `
      <div class="lt-cab"><span class="lt-semana"></span><button class="btn-icono" id="btn-play-trat" title="Recorrer las 12 semanas">${this.reproduciendoTrat ? '❚❚' : '▶'}</button></div>
      <div class="lt-pista">
        <input type="range" id="dias" min="0" max="${DIAS_MAX}" step="1" value="${Math.round(this.dias)}" aria-label="Días de tratamiento">
        <div class="lt-hitos">${hitos.map((h) => `<span class="lt-hito" data-dia="${h.dia}" style="left:${(100 * h.dia) / DIAS_MAX}%" data-tip="Día ${h.dia}"></span>`).join('')}</div>
      </div>
      <div class="lt-marcas">${[0, 2, 4, 6, 8, 10, 12].map((s) => `<span style="left:${(100 * s) / 12}%">${s === 0 ? 'inicio' : `sem ${s}`}</span>`).join('')}</div>
      <div class="lt-hito-actual"></div>`;
    sec.classList.remove('oculta');
    sec.querySelector<HTMLInputElement>('#dias')!.addEventListener('input', (e) => this.cb.onDias(Number((e.target as HTMLInputElement).value)));
    sec.querySelector('#btn-play-trat')!.addEventListener('click', () => this.cb.onReproducirTratamiento());
    this.actualizarTextoDias();
  }

  private renderExplicacionTratamiento() {
    const sec = this.$('#exp-tratamiento');
    const t = this.tratamiento;
    if (!t) { sec.classList.add('oculta'); sec.innerHTML = ''; return; }
    const hitos = [...(t.hitos ?? [])].sort((a, b) => a.dia - b.dia);
    const num = numerar(t.refs, [t.textos.clinico, ...hitos.map((h) => h.clinico)]);
    sec.innerHTML = `
      <header class="exp-cab">
        <div class="exp-titulo"><span class="chip-icono grande">${t.icono}</span><div><h3>${t.nombre}</h3>${this.insignia(t.nivel_evidencia, t.resumen_evidencia)}</div></div>
      </header>
      <p class="exp-texto">${renderTexto(t.textos[this.modo], this.modo, num)}</p>
      ${hitos.length ? `<h4>Qué se espera ver</h4><ul class="hitos">${hitos.map((h) => `<li><span class="hito-dia">Día ${h.dia}</span>${renderTexto(h[this.modo], this.modo, num)}</li>`).join('')}</ul>` : ''}
      ${this.modo === 'clinico' ? `<p class="resumen-ev"><strong>Nivel de evidencia:</strong> ${t.resumen_evidencia}</p>` : ''}
      <details class="fuentes" ${this.modo === 'clinico' ? 'open' : ''}><summary>Fuentes (${num.size})</summary>${listaFuentesHTML(num)}</details>`;
    sec.classList.remove('oculta');
  }

  // ---------- anatomía ----------
  private renderRegiones() {
    const lista = this.$('#lista-regiones');
    lista.innerHTML = (['cortical', 'subcortical', 'marcador'] as const).map((tipo) => `
      <div class="grupo-titulo">${TIPOS_REGION[tipo]}</div>
      ${REGIONES.filter((r) => r.tipo === tipo).map((r) => `<button class="fila-region ${this.region === r.id ? 'activa' : ''}" data-id="${r.id}"><span class="muestra" style="background:${r.color}"></span><span class="nombre">${this.modo === 'paciente' ? r.nombre_paciente : r.nombre}</span></button>`).join('')}`).join('');
    lista.onmouseover = (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('.fila-region'); if (b) this.cb.onRegionHover(b.dataset.id!, true); };
    lista.onmouseout = (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('.fila-region'); if (b) this.cb.onRegionHover(b.dataset.id!, false); };
    lista.onclick = (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('.fila-region'); if (b) this.cb.onRegion(this.region === b.dataset.id ? null : b.dataset.id!); };
  }

  setRegion(id: string | null) {
    this.region = id;
    this.raiz.querySelectorAll('.fila-region').forEach((b) => b.classList.toggle('activa', (b as HTMLElement).dataset.id === id));
  }

  nombreRegion(id: string) { const r = REGION_POR_ID.get(id)!; return this.modo === 'paciente' ? r.nombre_paciente : r.nombre; }
}
