// Genera dist/cerebro-y-depresion.html (entregable único).
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ensamblar, RAIZ } from './ensamblar.mjs';

const salida = join(RAIZ, 'dist', 'cerebro-y-depresion.html');
mkdirSync(join(RAIZ, 'dist'), { recursive: true });
writeFileSync(salida, await ensamblar({ minify: true }));
const mb = statSync(salida).size / 1024 / 1024;
console.log(`Listo: ${salida} (${mb.toFixed(2)} MB)`);
if (mb > 8) { console.error('El archivo supera los 8 MB del presupuesto.'); process.exit(1); }
