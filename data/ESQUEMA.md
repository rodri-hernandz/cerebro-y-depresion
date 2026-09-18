# Esquema de datos — "Cerebro y Depresión"

Todos los archivos viven en `data/` y se compilan dentro del HTML. Ids en `snake_case`, textos en español (México).

## Ids válidos

**Regiones** (`regiones.json`): `dlpfc, dmpfc, vmpfc, ofc_lateral, acc_rostral, acc_dorsal, cingulada_posterior, precuneo, insula, vlpfc, auditiva, motora, somatosensorial, parietal, temporal_lateral, temporal_medial, visual, amigdala, hipocampo, accumbens, caudado, putamen, palido, talamo, hipotalamo, tronco, atv, rafe, locus_coeruleus, sgacc`.

**Neurotransmisores / marcadores**: `dopamina, serotonina, noradrenalina, cortisol, glutamato, gaba, opioides, oxitocina, endocannabinoides, bdnf`.

**Nivel de evidencia**: `directa` (estudios en personas con TDM para ese estímulo/tratamiento), `inferida` (estudios en sanos + meta-análisis generales de TDM), `indirecta` (solo conductual/fisiológica o en otra población).

**Tipo de evidencia de una referencia**: `meta-analisis | RCT | neuroimagen | revision | observacional | modelo_animal`.

## Escalas

- `intensidad` de una región: 0 = basal, 1 = activación clara en fMRI/PET, 1.5 = máxima (drogas); negativa = desactivación (p. ej., amígdala −0.4 con música placentera).
- Neurotransmisor `normal`: multiplicador sobre la línea base 1.0 en población sana. Anclas ordinales (microdiálisis animal, Di Chiara & Imperato 1988): comida palatable ≈ 1.5, sexo ≈ 2.0, nicotina ≈ 2.0, alcohol ≈ 1.8, cocaína/anfetamina ≈ 3.0. Cortisol: estrés agudo ≈ 1.8. Valores ilustrativos, no a escala, y así se declaran en la interfaz.
- `mod_depresion` (opcional, en un paso o en un neurotransmisor): sustituye el multiplicador de reactividad por defecto de `depresion.json` para ese estímulo (1 = igual que sano; 0.5 = mitad; 1.5 = exagerado). Úsalo solo cuando haya evidencia específica para ese estímulo en TDM.

## `referencias.json` — arreglo de:
```json
{ "key": "salimpoor2011", "autores": ["Salimpoor VN", "Benovoy M", "Larcher K", "Dagher A", "Zatorre RJ"], "anio": 2011,
  "titulo": "Anatomically distinct dopamine release during anticipation and experience of peak emotion to music",
  "revista": "Nature Neuroscience", "doi": "10.1038/nn.2726", "pmid": "21217764", "tipo_evidencia": "neuroimagen",
  "nota": "PET con racloprida + fMRI; caudado en anticipación, accumbens en el pico" }
```
`key` = apellido del primer autor en minúsculas + año (+ letra si choca). El DOI debe resolver en `https://api.crossref.org/works/{doi}` con el título correcto. Nunca inventar.

## `estimulos.json`
```json
{ "categorias": [ { "id": "sustancias", "nombre": "Sustancias" }, { "id": "experiencias", "nombre": "Recompensas y experiencias" }, { "id": "adversos", "nombre": "Eventos adversos" } ],
  "estimulos": [ {
    "id": "musica", "categoria": "experiencias", "nombre": "Escuchar una canción que te gusta", "nombre_corto": "Música", "icono": "🎵",
    "nivel_evidencia": "directa",
    "resumen_evidencia": "Una frase: por qué ese nivel (qué se estudió en sanos y qué en TDM).",
    "secuencia": [
      { "region": "auditiva", "t_inicio_s": 0.0, "duracion_s": 7, "intensidad": 0.8, "nota": "Procesamiento del sonido" },
      { "region": "caudado", "t_inicio_s": 0.8, "duracion_s": 3, "intensidad": 0.7, "nota": "Anticipación del pasaje favorito" },
      { "region": "atv", "t_inicio_s": 1.5, "duracion_s": 4, "intensidad": 0.8 },
      { "region": "accumbens", "t_inicio_s": 2.5, "duracion_s": 3.5, "intensidad": 1.0, "nota": "Pico de placer (escalofrío)" },
      { "region": "amigdala", "t_inicio_s": 2.5, "duracion_s": 4, "intensidad": -0.4, "mod_depresion": 0.5, "nota": "Se apaga con el placer" }
    ],
    "neurotransmisores": { "dopamina": { "normal": 1.6 }, "opioides": { "normal": 1.3 }, "cortisol": { "normal": 0.85 } },
    "textos": {
      "paciente": "Lenguaje sencillo, metáforas, sin jerga, frases probabilísticas ('tiende a'). 3–5 oraciones. Explica qué pasa en el cerebro sano y qué cambia con depresión.",
      "clinico": "Técnico, nombres anatómicos, cada afirmación con su cita [ref:blood2001] y si es inferencia, decirlo [ref:keren2018]. 4–7 oraciones."
    },
    "diferencias": [
      { "paciente": "El 'centro del gusto' se enciende menos: la canción favorita se disfruta, pero con menos chispa.", "clinico": "Respuesta atenuada del estriado ventral a la recompensa musical, inferida de la hiporreactividad general a recompensa en TDM [ref:keren2018,ng2019].", "refs": ["keren2018", "ng2019"] }
    ],
    "refs": ["blood2001", "salimpoor2011", "lepping2016", "keren2018"]
  } ] }
```
La secuencia dura entre 6 y 12 s en total. Toda región citada debe tener sustento; si una región se incluye por plausibilidad anatómica y no por un estudio, ponerlo en `nota` como "plausible, sin estudio directo".

## `tratamientos.json`
```json
{ "tratamientos": [ {
    "id": "isrs", "categoria": "farmacologico", "nombre": "Antidepresivos ISRS (sertralina, escitalopram, fluoxetina)", "nombre_corto": "ISRS", "icono": "💊",
    "nivel_evidencia": "directa", "resumen_evidencia": "…",
    "curva": { "tipo": "logistica", "semana_50": 4, "pendiente": 1.3, "e_max": 0.75 },
    "efecto_global": 0.5,
    "efecto_region": { "amigdala": 1.0, "sgacc": 0.9, "acc_rostral": 0.8, "insula": 0.7, "dlpfc": 0.4, "hipocampo": 0.6 },
    "efecto_nt": { "serotonina": 1.0, "cortisol": 0.7, "bdnf": 0.6 },
    "impulso_nt": { "serotonina": { "magnitud": 0.35, "inicio_dias": 0, "rampa_dias": 2 } },
    "hitos": [ { "dia": 7, "paciente": "…", "clinico": "… [ref:godlewska2012]" }, { "dia": 28, "paciente": "…", "clinico": "…" } ],
    "textos": { "paciente": "…", "clinico": "… [ref:ma2015]" },
    "refs": ["godlewska2012", "ma2015", "harmer2010", "taylor2006"]
} ] }
```
- `curva.tipo`: `logistica` (semana_50 = semana en que se alcanza la mitad del efecto; pendiente por semana; e_max = fracción de normalización máxima 0–1), `ketamina` (pico_dias, semivida_dias, e_max, `intervalo_dias` opcional para mantenimiento), `lineal` (dias_max, e_max).
- `efecto_region[r]` / `efecto_nt[nt]`: fracción del efecto máximo que se aplica a esa región o neurotransmisor (1 = normalización plena hasta e_max). Regiones no listadas usan `efecto_global`.
- `impulso_nt`: aumento directo sobre el nivel (no solo normalización), p. ej. ketamina → glutamato transitorio.
- `hitos`: 2–4 puntos de la línea de tiempo con lo que se espera ver (con citas en el texto clínico).
- Categorías: `farmacologico | psicoterapia | neuromodulacion | estilo_vida | psicodelico`.

## `depresion.json`
```json
{ "reactividad_base": { "accumbens": 0.55, "amigdala": 1.5, "dlpfc": 0.7, "sgacc": 1.45 },
  "neurotransmisores_base": { "dopamina": 0.7, "serotonina": 0.7, "cortisol": 1.5, "bdnf": 0.6, "glutamato": 1.15 },
  "escala_severidad": { "leve": 0.5, "moderada": 1.0, "grave": 1.4 },
  "justificacion": { "accumbens": { "paciente": "…", "clinico": "… [ref:pizzagalli2009,keren2018]" } },
  "refs": ["keren2018", "ng2019", "hamilton2012", "mayberg1999", "stetler2011", "schmaal2015", "molendijk2013"] }
```
Multiplicadores > 1 = hiperreactivo/elevado; < 1 = hiporreactivo/reducido. Regiones sin entrada = 1.0.

## Cómputo (motor/Reactividad.ts)
```
m(r, sev)   = 1 + (base[r] − 1) · escala[sev]              (base[r] sustituido por mod_depresion si el paso lo define)
E(r)        = e_max · curva(días) · (efecto_region[r] ?? efecto_global)
R(r)        = 1 + (m − 1) · (1 − E)
resp_dep    = intensidad · R          (si intensidad < 0: intensidad / R)
NT_dep      = b_trat + (normal − 1) · mod_trat + impulso,   b_trat = 1 + (b − 1)(1 − E_nt),  mod_trat = 1 + (mod − 1)(1 − E_nt)
```
