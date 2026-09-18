// Ensambla el HTML autocontenido: CSS + JS (esbuild IIFE) + modelo GLB en base64.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

export const OPCIONES_ESBUILD = {
  entryPoints: [join(RAIZ, 'src', 'main.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  outdir: join(RAIZ, 'salida-virtual'),
  loader: { '.json': 'json' },
  legalComments: 'none',
  logLevel: 'warning',
};

const RECARGA = `\n;new EventSource('/esbuild').addEventListener('change',function(){location.reload()});\n`;

export function ensamblarDesde(outputFiles, { recargaEnVivo = false } = {}) {
  const js = outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
  const css = outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
  const glb = readFileSync(join(RAIZ, 'assets', 'cerebro.glb')).toString('base64');
  const plantilla = readFileSync(join(RAIZ, 'plantilla.html'), 'utf8');
  return plantilla
    .replace('/*CSS*/', () => css)
    .replace('/*GLB*/', () => glb)
    .replace('/*JS*/', () => js + (recargaEnVivo ? RECARGA : ''));
}

export async function ensamblar({ minify = true } = {}) {
  const r = await esbuild.build({ ...OPCIONES_ESBUILD, minify });
  return ensamblarDesde(r.outputFiles);
}
