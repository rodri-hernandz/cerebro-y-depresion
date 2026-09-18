// Render de textos con marcadores [ref:clave] → superíndices numerados con popover, y formato de referencias.
import { REFERENCIA_POR_KEY, type Modo, type Referencia } from '../datos.ts';

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MARCADOR = /\[ref:([^\]]+)\]/g;

export function clavesEn(texto: string): string[] {
  return [...String(texto ?? '').matchAll(MARCADOR)].flatMap((m) => m[1].split(',').map((s) => s.trim()));
}

/** Numeración de referencias para un ítem: primero las de `refs`, luego cualquier otra citada en los textos. */
export function numerar(refs: string[], textos: string[]): Map<string, number> {
  const orden: string[] = [];
  for (const k of [...refs, ...textos.flatMap(clavesEn)]) if (REFERENCIA_POR_KEY.has(k) && !orden.includes(k)) orden.push(k);
  return new Map(orden.map((k, i) => [k, i + 1]));
}

export function autoresCortos(r: Referencia): string {
  const apellido = (a: string) => a.split(' ')[0];
  if (r.autores.length === 1) return apellido(r.autores[0]);
  if (r.autores.length === 2) return `${apellido(r.autores[0])} y ${apellido(r.autores[1])}`;
  return `${apellido(r.autores[0])} et al.`;
}

export function formatearRef(r: Referencia): string {
  return `${autoresCortos(r)} (${r.anio}). ${r.titulo}. <i>${escapar(r.revista)}</i>.`;
}

export const TIPOS_EVIDENCIA: Record<string, string> = {
  'meta-analisis': 'Meta-análisis', RCT: 'Ensayo clínico aleatorizado', neuroimagen: 'Neuroimagen', revision: 'Revisión',
  observacional: 'Estudio observacional', modelo_animal: 'Modelo animal',
};

/** Convierte un texto con [ref:…] en HTML. En modo paciente los marcadores se quitan. */
export function renderTexto(texto: string, modo: Modo, numeracion: Map<string, number>): string {
  let html = escapar(String(texto ?? ''));
  html = html.replace(MARCADOR, (_, lista: string) => {
    if (modo === 'paciente') return '';
    const claves = lista.split(',').map((s) => s.trim()).filter((k) => numeracion.has(k));
    if (!claves.length) return '';
    const nums = claves.map((k) => numeracion.get(k)!).sort((a, b) => a - b);
    return `<sup class="cita" data-refs="${claves.join(',')}">${nums.join(',')}</sup>`;
  });
  return html.replace(/\s+([.,;:])/g, '$1');
}

export function listaFuentesHTML(numeracion: Map<string, number>): string {
  const items = [...numeracion.entries()].sort((a, b) => a[1] - b[1]).map(([k, n]) => {
    const r = REFERENCIA_POR_KEY.get(k)!;
    const url = r.url ?? `https://doi.org/${r.doi}`;
    return `<li value="${n}"><span class="tipo-ev">${TIPOS_EVIDENCIA[r.tipo_evidencia] ?? r.tipo_evidencia}</span> ${formatearRef(r)} <a href="${url}" target="_blank" rel="noopener">DOI</a>${r.pmid ? ` · <a href="https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/" target="_blank" rel="noopener">PubMed</a>` : ''}</li>`;
  });
  return items.length ? `<ol class="fuentes-lista">${items.join('')}</ol>` : '<p class="sin-fuentes">Sin referencias asociadas.</p>';
}

/** Popover flotante para citas y para cualquier elemento con data-tip. */
export function instalarPopover(raiz: HTMLElement) {
  const pop = document.createElement('div');
  pop.className = 'popover oculta';
  document.body.appendChild(pop);
  let objetivo: HTMLElement | null = null;
  const mostrar = (el: HTMLElement) => {
    const refs = el.dataset.refs?.split(',').filter((k) => REFERENCIA_POR_KEY.has(k));
    if (refs?.length) {
      pop.innerHTML = refs.map((k) => {
        const r = REFERENCIA_POR_KEY.get(k)!;
        return `<div class="pop-ref"><span class="tipo-ev">${TIPOS_EVIDENCIA[r.tipo_evidencia] ?? r.tipo_evidencia}</span> ${formatearRef(r)}${r.nota ? `<div class="pop-nota">${escapar(r.nota)}</div>` : ''}<div class="pop-doi">doi:${escapar(r.doi)}</div></div>`;
      }).join('');
    } else if (el.dataset.tip) {
      pop.innerHTML = `<div class="pop-tip">${escapar(el.dataset.tip)}</div>`;
    } else return;
    objetivo = el;
    pop.classList.remove('oculta');
    const r = el.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8;
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    pop.style.left = `${x}px`; pop.style.top = `${y}px`;
  };
  const ocultar = () => { pop.classList.add('oculta'); objetivo = null; };
  raiz.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.cita, [data-tip]');
    if (el && el !== objetivo) mostrar(el);
    else if (!el && objetivo) ocultar();
  });
  raiz.addEventListener('mouseleave', ocultar);
  raiz.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.cita');
    if (!el) return;
    const k = el.dataset.refs?.split(',')[0];
    const r = k ? REFERENCIA_POR_KEY.get(k) : null;
    if (r) window.open(r.url ?? `https://doi.org/${r.doi}`, '_blank', 'noopener');
  });
}
