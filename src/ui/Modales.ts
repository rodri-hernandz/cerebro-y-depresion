// Modales: aviso inicial, bibliografía completa y créditos.
import { REFERENCIAS, ESTIMULOS, TRATAMIENTOS, DEPRESION, type Modo } from '../datos.ts';
import { formatearRef, TIPOS_EVIDENCIA, clavesEn } from './Texto.ts';

let capa: HTMLElement | null = null;

export function abrirModal(titulo: string, contenidoHTML: string, opciones: { botonCierre?: string; ancho?: number } = {}) {
  cerrarModal();
  capa = document.createElement('div');
  capa.className = 'capa-modal';
  capa.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="max-width:${opciones.ancho ?? 720}px">
      <header><h2>${titulo}</h2><button class="cerrar" aria-label="Cerrar">×</button></header>
      <div class="modal-cuerpo">${contenidoHTML}</div>
      <footer><button class="btn primario" data-cerrar>${opciones.botonCierre ?? 'Cerrar'}</button></footer>
    </div>`;
  capa.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === capa || t.closest('.cerrar') || t.closest('[data-cerrar]')) cerrarModal();
  });
  document.addEventListener('keydown', escCerrar);
  document.body.appendChild(capa);
  (capa.querySelector('[data-cerrar]') as HTMLElement)?.focus();
}
function escCerrar(e: KeyboardEvent) { if (e.key === 'Escape') cerrarModal(); }
export function cerrarModal() { capa?.remove(); capa = null; document.removeEventListener('keydown', escCerrar); }

export function abrirAviso() {
  abrirModal('Antes de empezar', `
    <p><strong>Cerebro y Depresión</strong> es una herramienta <strong>educativa y demostrativa</strong> para acompañar la explicación de un profesional de la salud mental. No diagnostica, no sustituye una evaluación clínica ni indica tratamientos.</p>
    <ul>
      <li>Las dos vistas comparan un cerebro <em>sin depresión</em> con uno con <em>trastorno depresivo mayor</em>. Los colores, tamaños y velocidades son <strong>ilustrativos, no a escala</strong>: resumen la dirección de los hallazgos publicados, no miden a ninguna persona.</li>
      <li>Cada estímulo y tratamiento muestra una insignia de <strong>evidencia directa</strong>, <strong>inferida</strong> o <strong>indirecta</strong> según lo que se ha estudiado en personas con depresión. En el modo <em>Para el clínico</em>, cada afirmación lleva su referencia con DOI verificado.</li>
      <li>La depresión es distinta en cada persona. Lo que aquí se muestra son tendencias de grupo.</li>
    </ul>
    <p class="nota-modal">Modelo anatómico: <a href="https://brainder.org/research/brain-for-blender/" target="_blank" rel="noopener">Brain for Blender</a> (Anderson M. Winkler, CC BY-SA 3.0). Código: MIT. Ver <em>Créditos</em>.</p>
  `, { botonCierre: 'Entendido', ancho: 640 });
}

export function abrirCreditos() {
  abrirModal('Créditos y licencias', `
    <h3>Modelo anatómico</h3>
    <p><a href="https://brainder.org/research/brain-for-blender/" target="_blank" rel="noopener">Brain for Blender</a>, de Anderson M. Winkler. Superficie pial del atlas Desikan-Killiany y estructuras subcorticales de FreeSurfer. Licencia <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>. El modelo simplificado incluido en este archivo es una obra derivada y se comparte bajo la misma licencia.</p>
    <p>El área tegmental ventral, los núcleos del rafe, el locus coeruleus, la cingulada subgenual y el hipotálamo no existen como piezas en el atlas: se representan con marcadores en posiciones aproximadas (el hipotálamo se aproxima con la segmentación del diencéfalo ventral).</p>
    <h3>Software</h3>
    <p><a href="https://threejs.org" target="_blank" rel="noopener">Three.js</a> (MIT), <a href="https://esbuild.github.io" target="_blank" rel="noopener">esbuild</a> (MIT), <a href="https://gltf-transform.dev" target="_blank" rel="noopener">glTF Transform</a> y <a href="https://github.com/zeux/meshoptimizer" target="_blank" rel="noopener">meshoptimizer</a> (MIT). Referencias verificadas con las API públicas de CrossRef y PubMed.</p>
    <h3>Aviso</h3>
    <p>Herramienta educativa. No es un dispositivo médico ni sustituye la evaluación de un profesional. Las magnitudes visuales son ilustrativas.</p>
  `);
}

export function abrirBibliografia(modo: Modo) {
  // dónde se cita cada referencia
  const usos = new Map<string, string[]>();
  const anotar = (k: string, donde: string) => { const l = usos.get(k) ?? []; if (!l.includes(donde)) l.push(donde); usos.set(k, l); };
  for (const e of ESTIMULOS) {
    const claves = new Set([...e.refs, ...clavesEn(e.textos.clinico), ...(e.diferencias ?? []).flatMap((d) => [...(d.refs ?? []), ...clavesEn(d.clinico)])]);
    for (const k of claves) anotar(k, e.nombre_corto);
  }
  for (const t of TRATAMIENTOS) {
    const claves = new Set([...t.refs, ...clavesEn(t.textos.clinico), ...(t.hitos ?? []).flatMap((h) => clavesEn(h.clinico))]);
    for (const k of claves) anotar(k, t.nombre_corto);
  }
  for (const k of [...(DEPRESION.refs ?? []), ...Object.values(DEPRESION.justificacion ?? {}).flatMap((j) => clavesEn(j.clinico))]) anotar(k, 'Modelo basal de la depresión');

  const ordenadas = [...REFERENCIAS].sort((a, b) => a.autores[0].localeCompare(b.autores[0]) || a.anio - b.anio);
  const items = ordenadas.map((r) => `
    <li>
      <div class="bib-ref">${formatearRef(r)} <a href="${r.url ?? `https://doi.org/${r.doi}`}" target="_blank" rel="noopener">doi:${r.doi}</a>${r.pmid ? ` · <a href="https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/" target="_blank" rel="noopener">PubMed</a>` : ''}</div>
      <div class="bib-meta"><span class="tipo-ev">${TIPOS_EVIDENCIA[r.tipo_evidencia] ?? r.tipo_evidencia}</span>${usos.get(r.key)?.length ? ` · Citada en: ${usos.get(r.key)!.join(', ')}` : ''}${modo === 'clinico' && r.nota ? `<div class="bib-nota">${r.nota}</div>` : ''}</div>
    </li>`).join('');
  abrirModal(`Bibliografía (${REFERENCIAS.length} referencias verificadas)`, `
    <p class="nota-modal">Cada DOI se comprobó contra la API de CrossRef durante la construcción de este archivo. Los enlaces abren la publicación original.</p>
    <ol class="bibliografia">${items}</ol>`, { ancho: 860 });
}
