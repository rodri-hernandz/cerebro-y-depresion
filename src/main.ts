import './ui/estilos.css';
import { cargarModelo } from './modelo/CargarModelo.ts';
import { Visor } from './escena/Visor.ts';
import { NEUROTRANSMISORES, NT_PRINCIPALES } from './escena/Particulas.ts';
import { Panel, DIAS_MAX, type Pestana } from './ui/Panel.ts';
import { abrirAviso, abrirBibliografia, abrirCreditos } from './ui/Modales.ts';
import { instalarPopover, renderTexto, numerar } from './ui/Texto.ts';
import { REGIONES, REGION_POR_ID, ESTIMULO_POR_ID, TRATAMIENTO_POR_ID, DEPRESION, type Modo, type Lado, type Estimulo, type Tratamiento } from './datos.ts';
import { multiplicadorRegion, nivelNT, type Severidad, type Estado } from './motor/Reactividad.ts';
import { instantanea, duracionTotal } from './motor/Secuenciador.ts';

const estado = {
  modo: 'paciente' as Modo,
  severidad: 'moderada' as Severidad,
  tratamiento: null as Tratamiento | null,
  dias: 0,
  reproduciendoTrat: false,
  estimulo: null as Estimulo | null,
  reproduciendo: true,
  t: 0,
  pestana: 'estimulos' as Pestana,
  regionAnatomia: null as string | null,
};
const PAUSA_BUCLE_S = 1.6;

const app = document.getElementById('app')!;
app.innerHTML = `
<header class="barra">
  <div class="marca"><h1>Cerebro y Depresión</h1><span class="sub">Prototipo educativo</span></div>
  <div class="reproductor oculta" id="reproductor">
    <span class="rep-icono" id="rep-icono"></span><span class="rep-nombre" id="rep-nombre"></span>
    <button class="btn-icono" id="rep-play" title="Pausar">❚❚</button>
    <button class="btn-icono" id="rep-stop" title="Quitar estímulo">■</button>
  </div>
  <div class="acciones">
    <button class="btn" id="btn-efectos" title="Activa o desactiva las partículas de neurotransmisores (útil en equipos lentos)">Efectos: sí</button>
    <button class="btn" id="btn-biblio">Bibliografía</button>
    <button class="btn" id="btn-creditos">Créditos</button>
    <div class="conmutador" id="modo">
      <button data-modo="paciente" class="activa">Para el paciente</button>
      <button data-modo="clinico">Para el clínico</button>
    </div>
    <button class="btn" id="btn-pantalla">Pantalla completa</button>
  </div>
</header>
<main class="escenario" id="escenario">
  <canvas id="lienzo"></canvas>
  <div class="divisor"></div>
  <div class="etiqueta-lado izq"><span class="punto normal"></span>Sin depresión</div>
  <div class="etiqueta-lado der"><span class="punto depresion"></span>Con depresión <span class="sev" id="sev-etiqueta">· moderada</span></div>
  <div class="leyenda"><span><span class="p mas"></span>Más activo / reactivo</span><span><span class="p menos"></span>Menos activo / reactivo</span><span>Arrastra para girar · Clic en una región para saber más</span></div>
  <div id="tarjeta" class="tarjeta oculta"></div>
  <div id="cargando" class="cargando"><div class="anillo"></div><p>Cargando el cerebro en 3D…</p></div>
</main>
<aside class="panel" id="panel"></aside>`;

const $ = <T extends HTMLElement>(sel: string) => app.querySelector(sel) as T;
const TIPOS: Record<string, string> = { cortical: 'Corteza', subcortical: 'Estructura profunda', marcador: 'Núcleo (posición aproximada)' };

async function iniciar() {
  const b64 = document.getElementById('glb')?.textContent ?? '';
  if (!b64.trim()) throw new Error('No se encontró el modelo 3D embebido en el archivo.');
  const modelo = await cargarModelo(b64);
  const visor = new Visor($<HTMLCanvasElement>('#lienzo'), modelo);
  $('#cargando').classList.add('oculta');
  instalarPopover($('#escenario'));

  const estadoModelo = (): Estado => ({ severidad: estado.severidad, tratamiento: estado.tratamiento, dias: estado.dias });

  // ---------- neurotransmisores ----------
  function ntVisibles(): string[] {
    const set = new Set<string>(NT_PRINCIPALES);
    for (const k of Object.keys(estado.estimulo?.neurotransmisores ?? {})) set.add(k);
    for (const k of Object.keys(estado.tratamiento?.impulso_nt ?? {})) set.add(k);
    for (const k of Object.keys(estado.tratamiento?.efecto_nt ?? {})) set.add(k);
    return [...set].filter((k) => NEUROTRANSMISORES[k]).slice(0, 7);
  }
  function configurarNT() {
    const nts = ntVisibles();
    visor.particulasA.setVisibles(nts); visor.particulasB.setVisibles(nts);
    visor.barrasA.setNeurotransmisores(nts); visor.barrasB.setNeurotransmisores(nts);
    visor.barrasA.distribuir(); visor.barrasB.distribuir();
  }
  function aplicarNT(envolvente: number) {
    const em = estadoModelo();
    for (const nt of ntVisibles()) {
      const def = estado.estimulo?.neurotransmisores[nt];
      const evocado = def ? 1 + (def.normal - 1) * envolvente : 1;
      const n = nivelNT(DEPRESION, nt, evocado, em, def?.mod_depresion);
      visor.particulasA.setNivel(nt, n.normal); visor.particulasB.setNivel(nt, n.depresion);
      visor.barrasA.setNivel(nt, n.normal); visor.barrasB.setNivel(nt, n.depresion);
    }
  }

  // ---------- estado basal del cerebro con depresión ----------
  function aplicarBasal() {
    const em = estadoModelo();
    for (const r of REGIONES) {
      visor.cerebroA.setNivel(r.id, 0);
      const m = multiplicadorRegion(DEPRESION, r.id, em);
      visor.cerebroB.setNivel(r.id, Math.abs(m - 1) < 0.02 ? 0 : (m - 1) * 0.6);
    }
    visor.invalidar();
  }
  function refrescar() {
    if (!estado.estimulo) { aplicarBasal(); aplicarNT(0); }
    visor.invalidar();
  }

  // ---------- panel ----------
  const panel = new Panel($('#panel'), {
    onPestana(p) {
      estado.pestana = p;
      if (p !== 'anatomia' && estado.regionAnatomia) { estado.regionAnatomia = null; panel.setRegion(null); ocultarTarjeta(); refrescar(); }
    },
    onSeveridad(s) { estado.severidad = s; $('#sev-etiqueta').textContent = `· ${s}`; refrescar(); },
    onEstimulo(id) { seleccionarEstimulo(id); },
    onReproducir() { alternarReproduccion(); },
    onTratamiento(id) {
      estado.tratamiento = id ? TRATAMIENTO_POR_ID.get(id) ?? null : null;
      estado.dias = 0; estado.reproduciendoTrat = false;
      panel.setTratamiento(id); panel.setDias(0); panel.setReproduciendoTratamiento(false);
      configurarNT(); refrescar();
    },
    onDias(d) { estado.dias = d; estado.reproduciendoTrat = false; panel.setReproduciendoTratamiento(false); panel.setDias(d); refrescar(); },
    onReproducirTratamiento() {
      if (estado.dias >= DIAS_MAX) estado.dias = 0;
      estado.reproduciendoTrat = !estado.reproduciendoTrat;
      panel.setReproduciendoTratamiento(estado.reproduciendoTrat);
    },
    onRegion(id) {
      estado.regionAnatomia = id; panel.setRegion(id);
      if (estado.estimulo) return;
      aplicarBasal();
      if (id) { visor.cerebroA.setNivel(id, 1); visor.cerebroB.setNivel(id, 1); mostrarTarjeta(id, null); } else ocultarTarjeta();
      visor.invalidar();
    },
    onRegionHover(id, activo) {
      if (estado.estimulo || estado.regionAnatomia === id) return;
      if (activo) { visor.cerebroA.setNivel(id, 0.8); visor.cerebroB.setNivel(id, 0.8); }
      else { visor.cerebroA.setNivel(id, 0); visor.cerebroB.setNivel(id, (multiplicadorRegion(DEPRESION, id, estadoModelo()) - 1) * 0.6); }
      visor.invalidar();
    },
  });
  panel.setPie(`${modelo.geometrias.size} estructuras · ${Math.round(modelo.triangulos).toLocaleString('es-MX')} triángulos · Modelo: Brain for Blender (A. Winkler, CC BY-SA 3.0) · Magnitudes ilustrativas, no a escala.`);

  function actualizarReproductor() {
    const rep = $('#reproductor');
    rep.classList.toggle('oculta', !estado.estimulo);
    if (!estado.estimulo) return;
    $('#rep-icono').textContent = estado.estimulo.icono;
    $('#rep-nombre').textContent = estado.estimulo.nombre_corto;
    const b = $('#rep-play'); b.textContent = estado.reproduciendo ? '❚❚' : '▶'; b.title = estado.reproduciendo ? 'Pausar' : 'Reproducir';
  }
  function alternarReproduccion() { estado.reproduciendo = !estado.reproduciendo; panel.setReproduciendo(estado.reproduciendo); actualizarReproductor(); }
  $('#rep-play').addEventListener('click', alternarReproduccion);
  $('#rep-stop').addEventListener('click', () => seleccionarEstimulo(null));
  $('#btn-efectos').addEventListener('click', () => {
    visor.particulasActivas = !visor.particulasActivas;
    visor.particulasA.grupo.visible = visor.particulasActivas; visor.particulasB.grupo.visible = visor.particulasActivas;
    $('#btn-efectos').textContent = `Efectos: ${visor.particulasActivas ? 'sí' : 'no'}`;
    visor.invalidar();
  });

  function actualizarReproductor() {
    const rep = $('#reproductor');
    rep.classList.toggle('oculta', !estado.estimulo);
    if (!estado.estimulo) return;
    $('#rep-icono').textContent = estado.estimulo.icono;
    $('#rep-nombre').textContent = estado.estimulo.nombre_corto;
    const b = $('#rep-play'); b.textContent = estado.reproduciendo ? '❚❚' : '▶'; b.title = estado.reproduciendo ? 'Pausar' : 'Reproducir';
  }
  function alternarReproduccion() { estado.reproduciendo = !estado.reproduciendo; panel.setReproduciendo(estado.reproduciendo); actualizarReproductor(); }
  $('#rep-play').addEventListener('click', alternarReproduccion);
  $('#rep-stop').addEventListener('click', () => seleccionarEstimulo(null));
  $('#btn-efectos').addEventListener('click', () => {
    visor.particulasActivas = !visor.particulasActivas;
    visor.particulasA.grupo.visible = visor.particulasActivas; visor.particulasB.grupo.visible = visor.particulasActivas;
    $('#btn-efectos').textContent = `Efectos: ${visor.particulasActivas ? 'sí' : 'no'}`;
    visor.invalidar();
  });

  function seleccionarEstimulo(id: string | null) {
    estado.estimulo = id ? ESTIMULO_POR_ID.get(id) ?? null : null;
    estado.t = 0; estado.reproduciendo = true;
    panel.setEstimulo(id, true);
    actualizarReproductor();
    actualizarReproductor();
    visor.cerebroA.reiniciar(); visor.cerebroB.reiniciar();
    configurarNT();
    if (!estado.estimulo) refrescar();
    ocultarTarjeta();
  }

  // ---------- bucle de animación ----------
  visor.onFrame = (_t, dt) => {
    let animando = false;
    if (estado.reproduciendoTrat) {
      estado.dias = Math.min(DIAS_MAX, estado.dias + dt * 12);
      panel.setDias(estado.dias);
      if (estado.dias >= DIAS_MAX) { estado.reproduciendoTrat = false; panel.setReproduciendoTratamiento(false); }
      if (!estado.estimulo) { aplicarBasal(); aplicarNT(0); }
      animando = true;
    }
    if (estado.estimulo) {
      const sec = estado.estimulo.secuencia;
      if (estado.reproduciendo) {
        estado.t += dt;
        if (estado.t > duracionTotal(sec) + PAUSA_BUCLE_S) estado.t = 0;
      }
      const inst = instantanea(sec, estado.t, DEPRESION, estadoModelo());
      for (const p of sec) {
        visor.cerebroA.setNivel(p.region, inst.normal.get(p.region) ?? 0);
        visor.cerebroB.setNivel(p.region, inst.depresion.get(p.region) ?? 0);
      }
      aplicarNT(inst.global);
      animando = true;
    }
    return animando;
  };

  // ---------- tarjeta de región ----------
  const tarjeta = $('#tarjeta');
  let tarjetaActual: { id: string; lado: Lado | null; x?: number; y?: number } | null = null;
  function mostrarTarjeta(id: string, lado: Lado | null, x?: number, y?: number) {
    const r = REGION_POR_ID.get(id)!;
    tarjetaActual = { id, lado, x, y };
    const just = DEPRESION.justificacion?.[id];
    const num = just ? numerar([], [just.clinico]) : new Map<string, number>();
    const nivelA = visor.cerebroA.nivel(id), nivelB = visor.cerebroB.nivel(id);
    const niveles = estado.estimulo
      ? `<div class="niveles"><span class="lado normal">Sin depresión: ${nivelA >= 0 ? '+' : ''}${nivelA.toFixed(2)}</span> <span class="lado depresion">Con depresión: ${nivelB >= 0 ? '+' : ''}${nivelB.toFixed(2)}</span></div>` : '';
    tarjeta.innerHTML = `
      <button class="cerrar" aria-label="Cerrar">×</button>
      <div class="tipo">${TIPOS[r.tipo]}</div>
      <h3>${estado.modo === 'paciente' ? r.nombre_paciente : r.nombre}</h3>
      ${estado.modo === 'paciente' ? `<div class="tipo" style="text-transform:none;letter-spacing:0">${r.nombre}</div>` : ''}
      ${lado && !estado.estimulo ? `<span class="lado ${lado}">${lado === 'normal' ? 'Cerebro sin depresión' : 'Cerebro con depresión'}</span>` : ''}
      ${niveles}
      <p>${r.descripcion[estado.modo]}</p>
      ${just ? `<p class="just"><strong>En depresión:</strong> ${renderTexto(just[estado.modo], estado.modo, num)}</p>` : ''}`;
    tarjeta.querySelector('.cerrar')!.addEventListener('click', () => { ocultarTarjeta(); if (estado.regionAnatomia) panel.setRegion(null); });
    tarjeta.classList.remove('oculta');
    const esc = $('#escenario');
    const W = esc.clientWidth, H = esc.clientHeight, w = tarjeta.offsetWidth, h = tarjeta.offsetHeight;
    let px = x === undefined ? 20 : x + 16, py = y === undefined ? H - h - 56 : y + 16;
    if (px + w > W - 12) px = Math.max(12, (x ?? W) - w - 16);
    if (py + h > H - 56) py = Math.max(12, H - h - 56);
    tarjeta.style.left = `${px}px`; tarjeta.style.top = `${py}px`;
  }
  function ocultarTarjeta() { tarjeta.classList.add('oculta'); tarjetaActual = null; }
  visor.onClicRegion = ({ region, lado, x, y }) => mostrarTarjeta(region, lado, x, y);
  visor.onClicVacio = () => { if (!estado.regionAnatomia) ocultarTarjeta(); };

  // ---------- cabecera ----------
  $('#modo').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    estado.modo = b.dataset.modo as Modo;
    app.querySelectorAll('#modo button').forEach((x) => x.classList.toggle('activa', x === b));
    panel.setModo(estado.modo);
    if (tarjetaActual) mostrarTarjeta(tarjetaActual.id, tarjetaActual.lado, tarjetaActual.x, tarjetaActual.y);
  });
  $('#btn-pantalla').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
  });
  $('#btn-biblio').addEventListener('click', () => abrirBibliografia(estado.modo));
  $('#btn-creditos').addEventListener('click', () => abrirCreditos());
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && estado.estimulo && !(e.target as HTMLElement).closest('input,button,textarea')) { e.preventDefault(); alternarReproduccion(); }
  });

  configurarNT();
  refrescar();
  (window as unknown as { visor: Visor; estado: typeof estado }).visor = visor;
  (window as unknown as { visor: Visor; estado: typeof estado }).estado = estado;
  abrirAviso();
}

iniciar().catch((e) => {
  console.error(e);
  $('#cargando').innerHTML = `<p class="error">No se pudo iniciar el visor 3D.<br><small>${String((e as Error)?.message ?? e)}</small></p>`;
});
