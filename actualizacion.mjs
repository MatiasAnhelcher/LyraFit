/**
 * ¿Qué le pasa a alguien que YA tiene la app cuando publicamos?
 *
 * Es la pregunta que ni los tests ni la revisión visual pueden contestar,
 * porque las dos arrancan de una instalación limpia. Y es la más cara: no hay
 * servidor, así que la base del teléfono es la ÚNICA copia de los datos de esa
 * persona. Si una versión nueva se los borra, no hay de dónde recuperarlos.
 *
 * Se contestan dos cosas, y las dos exigen servir dos versiones distintas
 * desde el MISMO origen —si el origen cambia, cambia la base de IndexedDB y no
 * se está probando nada—:
 *
 * 1. **La migración del esquema.** Se instala la versión publicada, se generan
 *    datos reales, y se sirve la versión nueva encima. Ninguna fila puede
 *    desaparecer ni cambiar, y las pantallas nuevas tienen que saber leer
 *    filas viejas a las que les faltan los campos que se agregaron después.
 *
 * 2. **La actualización en caliente.** El service worker se genera con
 *    `skipWaiting` y `clientsClaim`, así que el worker nuevo toma el control de
 *    una pestaña que sigue corriendo código viejo, y `cleanupOutdatedCaches` le
 *    borra los trozos que ese código todavía va a pedir. Sin la recarga que
 *    hace `main.tsx`, la primera pantalla que se carga por separado revienta
 *    con "Failed to fetch dynamically imported module". Está reproducido: sacar
 *    ese listener hace fallar este guion.
 *
 * Uso: node actualizacion.mjs [ref-publicada]     (por defecto origin/main)
 */

import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, writeFile, rm, cp, mkdtemp } from 'node:fs/promises'
import { readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'

const PUBLICADA = process.argv[2] ?? 'origin/main'
const PUERTO = 4190
const SUBRUTA = '/LyraFit/'
const fallos = []
const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts })

// ─── Los tres builds ──────────────────────────────────────────────────────
// Todos con BASE_PATH, que es como compila el CI: servir desde la raíz oculta
// exactamente los errores de ruta que rompen en Pages.

const taller = await mkdtemp(join(tmpdir(), 'lyrafit-act-'))
const dir = { previa: join(taller, 'previa'), siguiente: join(taller, 'siguiente') }
const dist = { previa: join(dir.previa, 'dist'), actual: 'dist', siguiente: join(dir.siguiente, 'dist') }

/** Marca visible que distingue una versión de la otra desde el navegador. */
const MARCA = 'HISTORIAL DE LA VERSIÓN SIGUIENTE'
const ARCHIVO_MARCA = 'src/pantallas/Progreso.tsx'
const ORIGINAL = '<Rotulo>HISTORIAL</Rotulo>'

async function compilar(donde) {
  sh('npx', ['vite', 'build'], { cwd: donde, env: { ...process.env, BASE_PATH: SUBRUTA } })
}

async function worktree(destino, ref) {
  sh('git', ['worktree', 'add', '--detach', destino, ref])
  // Las dependencias son las mismas: instalarlas de nuevo sería un minuto por gusto.
  sh('ln', ['-s', join(process.cwd(), 'node_modules'), join(destino, 'node_modules')])
}

console.log(`Compilando la versión publicada (${PUBLICADA})…`)
await worktree(dir.previa, PUBLICADA)
await compilar(dir.previa)

console.log('Compilando la versión que se va a publicar…')
await compilar('.')

// La "siguiente" sale de un worktree y no del árbol de trabajo, para no tocar
// ni un archivo de lo que la persona tenga sin commitear.
console.log('Compilando una versión posterior, para probar la actualización…')
await worktree(dir.siguiente, 'HEAD')
{
  const ruta = join(dir.siguiente, ARCHIVO_MARCA)
  const texto = await readFile(ruta, 'utf8')
  if (!texto.includes(ORIGINAL)) {
    console.log(`AVISO: no se encontró "${ORIGINAL}" en ${ARCHIVO_MARCA}; hay que actualizar la marca de este guion.`)
    process.exit(2)
  }
  await writeFile(ruta, texto.replace(ORIGINAL, `<Rotulo>${MARCA}</Rotulo>`))
  await compilar(dir.siguiente)
}

// ─── El servidor, que sirve el directorio que se le diga ──────────────────
let sirviendo = dist.previa
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2',
}
const servidor = createServer((pedido, respuesta) => {
  const ruta = pedido.url.split('?')[0].split('#')[0]
  if (!ruta.startsWith(SUBRUTA)) { respuesta.writeHead(404).end(); return }
  const resto = ruta.slice(SUBRUTA.length) || 'index.html'
  const archivo = join(sirviendo, resto)
  if (!existsSync(archivo)) { respuesta.writeHead(404).end(); return }
  // Sin cache del navegador: lo que se prueba es el cache del service worker.
  respuesta.writeHead(200, {
    'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  respuesta.end(readFileSync(archivo))
})
await new Promise((listo) => servidor.listen(PUERTO, '127.0.0.1', listo))
const BASE = `http://127.0.0.1:${PUERTO}${SUBRUTA.slice(0, -1)}`

// ─── El recorrido que genera datos de verdad ──────────────────────────────

async function alta(p) {
  await p.getByRole('button', { name: 'Empezar', exact: true }).click()
  await p.getByRole('button', { name: 'Sí, tengo barra' }).click()
  for (let i = 0; i < 4; i++) {
    for (let n = 0; n < 6; n++) await p.getByRole('button', { name: 'Sumar' }).click()
    const ver = p.getByRole('button', { name: 'Ver mi plan' })
    if (await ver.isVisible().catch(() => false)) await ver.click()
    else await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await p.waitForTimeout(110)
  }
  await p.getByRole('button', { name: 'Seguir', exact: true }).click()
  await p.waitForTimeout(250)
  await p.getByRole('button', { name: /Cuerpo completo/ }).click()
  await p.waitForTimeout(700)
}

async function unaSesion(p) {
  await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  for (let v = 0; v < 90; v++) {
    // "Voy" solo existe de la versión con predicción en dos pasos en adelante.
    for (const nombre of ['Saltear', 'Voy', 'Anotar serie', 'Siguiente ejercicio']) {
      const b = p.getByRole('button', { name: nombre, exact: true })
      if (await b.isVisible().catch(() => false)) { await b.click(); break }
      if (nombre === 'Siguiente ejercicio') {
        const fin = p.getByRole('button', { name: 'Terminar', exact: true })
        if (await fin.isVisible().catch(() => false)) { await fin.click(); v = 999 }
      }
    }
    await p.waitForTimeout(90)
  }
  await p.waitForTimeout(400)
  const listo = p.getByRole('button', { name: 'Listo', exact: true })
  if (await listo.isVisible().catch(() => false)) await listo.click()
  await p.waitForTimeout(400)
  // Las etiquetas de la tercera pregunta cambiaron entre versiones: se prueban las dos.
  for (const r of ['Exigente', 'Bien', 'Bastante', 'Con energía']) {
    const b = p.getByRole('button', { name: r, exact: true })
    if (await b.isVisible().catch(() => false)) await b.click()
  }
  const cerrar = p.getByRole('button', { name: 'Cerrar la sesión' })
  if (await cerrar.isVisible().catch(() => false)) await cerrar.click()
  await p.waitForTimeout(3500)
}

const leerBase = (p) => p.evaluate(async () => {
  const base = await new Promise((res, rej) => {
    const r = indexedDB.open('lyrafit')
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
  const tablas = [...base.objectStoreNames]
  const filas = {}
  for (const t of tablas) {
    filas[t] = await new Promise((res, rej) => {
      const q = base.transaction(t).objectStore(t).getAll()
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error)
    })
  }
  base.close()
  return { version: base.version, tablas, filas }
})

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})

// ─── 1. La migración del esquema ──────────────────────────────────────────
{
  console.log('\n── Migración del esquema ──')
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR' })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => fallos.push(`migración · JS: ${e.message}`))

  sirviendo = dist.previa
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(900)
  await alta(p)
  await unaSesion(p)

  const antes = await leerBase(p)
  console.log(`  antes:   esquema v${antes.version} · ${antes.tablas.map((t) => `${t}=${antes.filas[t].length}`).join(' ')}`)
  if ((antes.filas.sesiones?.length ?? 0) < 1) fallos.push('La versión publicada no dejó ninguna sesión: la prueba no valdría.')

  const huella = (b) => JSON.stringify(
    ['sesiones', 'avances', 'estados', 'preferencias'].map((t) => b.filas[t] ?? []),
  )
  const antesHuella = huella(antes)

  // El service worker se saca del medio: acá se prueba el esquema, no el cache.
  // Su comportamiento al actualizar tiene su propia sección más abajo.
  sirviendo = dist.actual
  await p.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
    for (const c of await caches.keys()) await caches.delete(c)
  })
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(2000)

  const despues = await leerBase(p)
  console.log(`  después: esquema v${despues.version} · ${despues.tablas.map((t) => `${t}=${despues.filas[t].length}`).join(' ')}`)

  for (const t of ['sesiones', 'avances', 'estados', 'preferencias', 'pendientes']) {
    const a = antes.filas[t]?.length ?? 0
    const d = despues.filas[t]?.length ?? 0
    if (d < a) fallos.push(`PÉRDIDA DE DATOS en ${t}: ${a} → ${d} filas`)
  }
  if (antesHuella !== huella(despues)) {
    fallos.push('El contenido de los datos existentes cambió durante la migración.')
  }

  // Y las pantallas nuevas tienen que leer filas viejas sin los campos nuevos.
  const identidad = await p.locator('.cifra-identidad').first().innerText().catch(() => '?')
  if (identidad === '?' || identidad === '000') {
    fallos.push(`Hoy no leyó el historial migrado: "${identidad}"`)
  }
  await p.goto(`${BASE}/#/progreso`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1300)
  const enHistorial = await p.locator('section:has-text("HISTORIAL") .registro > *').count().catch(() => 0)
  if (enHistorial < 1) fallos.push('El historial nuevo no muestra las sesiones viejas.')
  await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1300)
  const titulo = await p.locator('h1').first().innerText().catch(() => '?')
  if (titulo === '?') fallos.push('Entrenar no arrancó sobre el avance migrado.')
  console.log(`  las pantallas nuevas leen los datos viejos: Hoy=${identidad} · historial=${enHistorial} · entrenar="${titulo}"`)

  await ctx.close()
}

// ─── 2. La actualización en caliente ──────────────────────────────────────
{
  console.log('\n── Actualización con la app abierta ──')
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR' })
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(e.message))
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()) })

  sirviendo = dist.actual
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  await alta(p)
  await unaSesion(p)

  // Esta recarga define QUÉ se está probando. En la primera visita el worker se
  // instala DESPUÉS de que cargó el documento, así que `controller` arranca en
  // null y la recarga automática queda desactivada a propósito: en una primera
  // visita no hay trozos viejos que romper. El caso que importa es el otro —
  // alguien que ya tiene la app y la abre con el worker controlando— y es esto.
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  if (!(await p.evaluate(() => navigator.serviceWorker.controller !== null))) {
    fallos.push('La pestaña no quedó controlada por el service worker: se estaría probando una primera visita.')
  }
  await p.evaluate(() => { window.__sinRecargar = true })

  // Se publica la versión siguiente con la pestaña abierta.
  sirviendo = dist.siguiente
  errores.length = 0
  await p.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.update()
  })
  await p.waitForTimeout(6000)

  const recargo = !(await p.evaluate(() => window.__sinRecargar === true).catch(() => false))
  console.log(`  la pestaña se recargó sola: ${recargo ? 'sí' : 'no'}`)
  if (!recargo) fallos.push('La pestaña no se recargó al entrar la versión nueva: queda código viejo con cache nuevo.')

  await p.goto(`${BASE}/#/progreso`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)
  const rotos = errores.filter((e) => /dynamically imported module|Failed to fetch|ChunkLoadError/i.test(e))
  if (rotos.length) fallos.push(`Una pantalla que se carga por separado se rompió al actualizar: ${rotos[0]}`)

  const titulo = await p.locator('section').filter({ hasText: /HISTORIAL/ }).first().innerText().catch(() => '(no cargó)')
  const linea = titulo.split('\n')[0]
  console.log(`  Progreso después de actualizar: "${linea}"`)
  if (!linea.includes(MARCA)) fallos.push(`La pestaña quedó en la versión vieja después de actualizar: "${linea}"`)

  await ctx.close()
}

// ─── Limpieza ─────────────────────────────────────────────────────────────
await navegador.close()
servidor.close()
for (const d of [dir.previa, dir.siguiente]) {
  try { sh('git', ['worktree', 'remove', '--force', d]) } catch { /* ya no está */ }
}
await rm(taller, { recursive: true, force: true })

if (fallos.length > 0) {
  console.log('\nPROBLEMAS ENCONTRADOS:')
  for (const f of fallos) console.log(' -', f)
  process.exit(1)
}
console.log('\nUna persona que ya tiene la app no pierde datos ni ve una pantalla rota al actualizar.')
