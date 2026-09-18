// Servidor de desarrollo: reconstruye dev/index.html por el mismo camino que producción y recarga el navegador.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import esbuild from 'esbuild';
import { OPCIONES_ESBUILD, ensamblarDesde, RAIZ } from './ensamblar.mjs';

const dev = join(RAIZ, 'dev');
mkdirSync(dev, { recursive: true });
const puerto = Number(process.env.PUERTO ?? 8765);

const ctx = await esbuild.context({
  ...OPCIONES_ESBUILD,
  minify: false,
  sourcemap: 'inline',
  plugins: [{
    name: 'ensamblar-html',
    setup(b) {
      b.onEnd((r) => {
        if (r.errors.length) { console.error(`${r.errors.length} error(es) de compilación`); return; }
        writeFileSync(join(dev, 'index.html'), ensamblarDesde(r.outputFiles, { recargaEnVivo: true }));
        console.log(`[${new Date().toLocaleTimeString()}] dev/index.html actualizado`);
      });
    },
  }],
});
await ctx.watch();
await ctx.serve({ servedir: dev, port: puerto, host: '127.0.0.1' });
console.log(`Desarrollo: http://127.0.0.1:${puerto}/`);
