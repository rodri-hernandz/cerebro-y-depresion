// Genera dist/cerebro-y-depresion.html (entregable único).
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ensamblar, RAIZ } from './ensamblar.mjs';

const salida = join(RAIZ, 'dist', 'cerebro-y-depresion.html');
const salidaPages = join(RAIZ, 'docs', 'index.html');
mkdirSync(join(RAIZ, 'dist'), { recursive: true });
mkdirSync(join(RAIZ, 'docs'), { recursive: true });
const html = await ensamblar({ minify: true });
writeFileSync(salida, html);
writeFileSync(salidaPages, html); // copia servida por GitHub Pages (docs/)
const mb = statSync(salida).size / 1024 / 1024;
console.log(`Listo: ${salida} (${mb.toFixed(2)} MB)`);
console.log(`Copiado a ${salidaPages} para GitHub Pages.`);
if (mb > 8) { console.error('El archivo supera los 8 MB del presupuesto.'); process.exit(1); }
