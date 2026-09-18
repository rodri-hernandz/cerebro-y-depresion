# Cerebro y Depresión — visualizador 3D interactivo (prototipo)

Herramienta educativa para que psicólogos y psiquiatras muestren a sus pacientes cómo reacciona un cerebro
sin depresión frente a uno con trastorno depresivo mayor ante distintos estímulos, y cómo los tratamientos
lo van modificando semana a semana. Cada afirmación en modo clínico lleva su referencia con DOI verificado.

## Para usarlo (sin instalar nada)

Abre `dist/cerebro-y-depresion.html` con doble clic. Es un solo archivo, funciona sin internet y en cualquier
navegador moderno (Chrome, Edge, Safari, Firefox). Todo se controla con clics:

- **Estímulos**: elige uno y verás la secuencia de activación en ambos cerebros, el flujo de neurotransmisores
  por sus vías y las barras comparativas.
- **Tratamientos**: elige uno y recorre las 12 semanas con el deslizador. Puedes combinarlo con un estímulo.
- **Severidad**: leve / moderada / grave escala las diferencias (aproximación declarada).
- **Para el paciente / Para el clínico**: cambia el lenguaje y muestra u oculta las citas.
- **Anatomía**: localiza cada región. Clic sobre el cerebro para ver su tarjeta.
- **Bibliografía** y **Créditos** en la cabecera. Arrastra para girar; rueda para acercar.

## Insignias de evidencia

- **Directa**: estudios en personas con depresión para ese estímulo o tratamiento.
- **Inferida**: respuesta documentada en sanos; la diferencia en depresión se infiere de meta-análisis generales.
- **Indirecta**: solo datos conductuales o fisiológicos, sin neuroimagen.

Las magnitudes visuales son ilustrativas y no están a escala. No es una herramienta diagnóstica.

## Desarrollo

```bash
npm install                 # dependencias (todas MIT)
npm run mallas              # descarga las mallas OBJ de Brain for Blender
npm run modelo              # OBJ → GLB decimado (assets/cerebro.glb) + data/generado/geometria.json
npm run verificar           # comprueba cada referencia en CrossRef/PubMed (requiere red)
npm test                    # motor de reactividad y secuenciador
npm run dev                 # servidor con recarga en http://127.0.0.1:8765
npm run build               # valida datos, comprueba referencias y genera dist/cerebro-y-depresion.html
.venv/bin/python tests/captura.py --acciones   # prueba de humo con Playwright desde file://
```

El contenido científico vive en `data/*.json` (contrato en `data/ESQUEMA.md`). Los borradores de investigación
se fusionan con `npm run fusionar`. El build falla si una referencia no está verificada.

## Licencias

Código: MIT (`LICENSE`). Modelo anatómico derivado de *Brain for Blender* (Anderson M. Winkler), CC BY-SA 3.0
(`LICENSE-MODELO.md`): el archivo `assets/cerebro.glb` y su copia embebida en el HTML se comparten bajo esa misma licencia.
