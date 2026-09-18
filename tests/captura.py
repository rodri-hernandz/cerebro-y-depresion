"""Prueba de humo del HTML autocontenido desde file://: carga, interacciones principales, errores de consola y capturas.
Uso: .venv/bin/python tests/captura.py [ruta.html] [--acciones]"""
import sys, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith('--')]
html = Path(args[0]) if args else RAIZ / 'dist' / 'cerebro-y-depresion.html'
acciones = '--acciones' in sys.argv
salida = RAIZ / 'tests' / 'capturas'
salida.mkdir(exist_ok=True)
errores, avisos = [], []

def foto(page, nombre):
    page.screenshot(path=str(salida / f'{nombre}.png'))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    page = browser.new_page(viewport={'width': 1600, 'height': 900}, device_scale_factor=1)
    page.on('console', lambda m: (errores if m.type == 'error' else avisos if m.type == 'warning' else []).append(m.text))
    page.on('pageerror', lambda e: errores.append(f'pageerror: {e}'))
    t0 = time.time()
    page.goto(html.as_uri())
    try:
        page.wait_for_selector('#cargando.oculta', state='attached', timeout=60000)
        print(f'Modelo cargado en {time.time()-t0:.1f}s')
    except Exception as e:
        print('El indicador de carga no desapareció:', e); print('Texto:', page.inner_text('#cargando'))
    page.wait_for_timeout(1200)
    foto(page, '00-aviso')
    if page.is_visible('.capa-modal'):
        page.click('.capa-modal [data-cerrar]'); page.wait_for_timeout(400)
    foto(page, '01-inicio')
    info = page.evaluate("""() => ({ chips: document.querySelectorAll('#chips-estimulos .chip').length, trat: document.querySelectorAll('#chips-tratamientos .chip').length,
        regiones: document.querySelectorAll('.fila-region').length, pie: document.querySelector('#pie')?.textContent?.slice(0,60) })""")
    print('Estado:', json.dumps(info, ensure_ascii=False))
    if acciones:
        page.click('#chips-estimulos .chip'); page.wait_for_timeout(3200); foto(page, '02-estimulo')
        print('Explicación estímulo visible:', page.is_visible('#exp-estimulo'), '|', page.inner_text('#exp-estimulo h3'))
        niveles = page.evaluate("() => ({ A: window.visor.cerebroA.nivel('accumbens').toFixed(2), B: window.visor.cerebroB.nivel('accumbens').toFixed(2), t: window.estado.t.toFixed(1) })")
        print('Accumbens durante el estímulo:', niveles)
        page.click('#modo button[data-modo="clinico"]'); page.wait_for_timeout(500); foto(page, '03-clinico')
        print('Citas en modo clínico:', page.evaluate("() => document.querySelectorAll('#exp-estimulo .cita').length"))
        page.hover('#exp-estimulo .cita'); page.wait_for_timeout(300); print('Popover visible:', page.is_visible('.popover:not(.oculta)'))
        page.click('.pestanas button[data-pestana="tratamientos"]'); page.wait_for_timeout(200)
        page.click('#chips-tratamientos .chip:not(.chip-ninguno)'); page.wait_for_timeout(400)
        page.locator('#dias').fill('56'); page.locator('#dias').dispatch_event('input'); page.wait_for_timeout(1500)
        print('Línea de tiempo:', page.inner_text('.lt-semana'))
        print('Accumbens con tratamiento (día 56):', page.evaluate("() => ({ A: window.visor.cerebroA.nivel('accumbens').toFixed(2), B: window.visor.cerebroB.nivel('accumbens').toFixed(2) })"))
        foto(page, '04-tratamiento')
        page.click('#exp-estimulo #btn-stop', timeout=3000) if page.is_visible('#exp-estimulo #btn-stop') else None
        page.wait_for_timeout(800); foto(page, '05-basal-tratado')
        page.click('.pestanas button[data-pestana="anatomia"]'); page.wait_for_timeout(200)
        page.hover('.fila-region:nth-of-type(3)'); page.wait_for_timeout(600); foto(page, '06-anatomia')
        page.click('#btn-biblio'); page.wait_for_timeout(500); foto(page, '07-bibliografia')
        print('Bibliografía items:', page.evaluate("() => document.querySelectorAll('.bibliografia li').length"))
        page.keyboard.press('Escape'); page.wait_for_timeout(200)
        print('Modal cerrado con Esc:', not page.is_visible('.capa-modal'))
    browser.close()

print(f'Errores de consola: {len(errores)}')
for e in errores[:10]: print('  ✗', e[:300])
print(f'Avisos: {len(avisos)}')
for a in [x for x in avisos if 'GL Driver' not in x][:5]: print('  !', a[:200])
sys.exit(1 if errores else 0)
