/**
 * Los kilos, de la pantalla a la base y de la base al motor.
 *
 * Es el portón de la carga externa, y mide las tres cosas que pueden salir mal
 * y que ninguna captura muestra:
 *
 *   1. **Que los discos no se ofrezcan cuando no hay con qué.** Sin peso
 *      corporal cargado no hay forma de pasar kilos a la escala del motor, así
 *      que la fila no puede existir: un control que guarda un dato que la app
 *      no sabe leer es peor que ningún control.
 *   2. **Que lo que se escribe llegue a la base.** `Serie.kg`, serie por serie.
 *   3. **Que el motor no lea una serie con discos como un fracaso.** Es el
 *      modo de falla que motivó toda la entrega: un objetivo fijado sin lastre
 *      y hecho con veinte kilos daba rendimiento 0,55 y el motor BAJABA el
 *      objetivo el día que la carga subió.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node carga.mjs`.
 */

import { chromium } from 'playwright'

const BASE = 'http://localhost:4173'
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

const fallos = []
const notas = []

async function conLaBase(pagina, tablas, trabajo) {
  return pagina.evaluate(
    async ([tablas, cuerpo]) => {
      const req = indexedDB.open('lyrafit')
      const db = await new Promise((r) => { req.onsuccess = () => r(req.result) })
      const tx = db.transaction(tablas, 'readonly')
      const leer = (t) =>
        new Promise((r) => { const q = tx.objectStore(t).getAll(); q.onsuccess = () => r(q.result) })
      // eslint-disable-next-line no-new-func
      return new Function('leer', `return (${cuerpo})(leer)`)(leer)
    },
    [tablas, trabajo.toString()],
  )
}

async function alta(p) {
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'Empezar', exact: true }).click()
  await p.getByRole('button', { name: 'Sí, tengo barra' }).click()
  await p.getByRole('button', { name: '12', exact: true }).click()
  await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await p.waitForTimeout(150)
  for (let i = 0; i < 3; i++) {
    for (let n = 0; n < 6; n++) await p.getByRole('button', { name: 'Sumar' }).click()
    const ver = p.getByRole('button', { name: 'Ver mi plan' })
    if (await ver.isVisible().catch(() => false)) await ver.click()
    else await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await p.waitForTimeout(120)
  }
  await p.getByRole('button', { name: 'Seguir', exact: true }).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: /Cuerpo completo/ }).click()
  await p.waitForTimeout(600)
}

const navegador = await chromium.launch({ executablePath: CHROMIUM })
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 }, locale: 'es-AR', colorScheme: 'dark',
})
const p = await contexto.newPage()
p.on('pageerror', (e) => fallos.push(`Error de JavaScript: ${e.message}`))
p.on('console', (m) => { if (m.type() === 'error') fallos.push(`Error en consola: ${m.text()}`) })

await alta(p)

// ── 1. Sin peso corporal, los discos no existen ───────────────────────────
await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
await p.waitForTimeout(700)
if (await p.getByRole('button', { name: 'Con discos' }).isVisible().catch(() => false)) {
  fallos.push('Sin peso corporal cargado, la app igual ofrece poner discos: va a guardar kilos que no puede leer')
}

// ── 2. Se carga el peso y la barra en Ajustes ─────────────────────────────
await p.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
await p.waitForTimeout(500)
const subirPeso = p.getByRole('button', { name: 'Subir tu peso' })
if (!(await subirPeso.isVisible().catch(() => false))) {
  fallos.push('No está la fila del peso en Ajustes')
} else {
  // De 35 a 75: cuarenta toques. Es mucho, y queda anotado como medición.
  for (let i = 0; i < 40; i++) await subirPeso.click()
  await p.waitForTimeout(300)
  const subirBarra = p.getByRole('button', { name: 'Subir barra cargable' })
  if (!(await subirBarra.isVisible().catch(() => false))) {
    fallos.push('Cargado el peso, no aparece la fila de la barra')
  } else {
    for (let i = 0; i < 9; i++) await subirBarra.click()
    await p.waitForTimeout(300)
  }
}

const prefs = await conLaBase(p, ['preferencias'], async (leer) => {
  const [pref] = await leer('preferencias')
  return JSON.stringify({ peso: pref?.pesoCorporalKg, barra: pref?.cargaMaximaKg, paso: pref?.pasoDeDiscoKg })
})
notas.push(`Quedó guardado: ${prefs}.`)
const { peso, barra } = JSON.parse(prefs)
if (peso !== 75) fallos.push(`El peso quedó en ${peso} y tenía que quedar en 75`)
if (barra !== 45) fallos.push(`La barra quedó en ${barra} y tenía que quedar en 45`)

// ── 3. Ahora sí, los discos aparecen y se anotan ──────────────────────────
await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
const conDiscos = p.getByRole('button', { name: 'Con discos' })
if (!(await conDiscos.isVisible().catch(() => false))) {
  fallos.push('Con peso y barra cargados, no aparece la forma de poner discos')
} else {
  await conDiscos.click()
  await p.waitForTimeout(200)
  const mas = p.getByRole('button', { name: 'Más peso' })
  for (let i = 0; i < 7; i++) await mas.click()
  await p.waitForTimeout(200)
  const puesto = await p.locator('main span.cifra.w-20').innerText().catch(() => '')
  notas.push(`En la barra: ${puesto}.`)
  if (!puesto.startsWith('20')) fallos.push(`Los discos quedaron en "${puesto}" y tenían que dar 20 kg`)
}

const anotarSerie = async () => {
  const voy = p.getByRole('button', { name: 'Voy', exact: true })
  if (await voy.isVisible().catch(() => false)) { await voy.click(); await p.waitForTimeout(150) }
  await p.getByRole('button', { name: 'Anotar serie', exact: true }).click()
  await p.waitForTimeout(400)
  const saltear = p.getByRole('button', { name: 'Saltear', exact: true })
  if (await saltear.isVisible().catch(() => false)) { await saltear.click(); await p.waitForTimeout(250) }
}
for (let i = 0; i < 3; i++) await anotarSerie()

// ── 4. Y el motor no lo lee como un fracaso ───────────────────────────────
const antes = await conLaBase(p, ['avances'], async (leer) =>
  JSON.stringify((await leer('avances')).map((a) => [a.patron, a.objetivoActual.cantidad, a.senal])))

const siguiente = p.getByRole('button', { name: 'Siguiente ejercicio', exact: true })
if (await siguiente.isVisible().catch(() => false)) {
  notas.push('El primer ejercicio se completó con discos puestos.')
}

// La tabla del borrador se llama `curso`, no `sesionEnCurso`: el tipo es
// `SesionEnCurso` y la tabla es otra cosa. La primera versión de este portón
// leía una tabla que no existe y decía que no se había guardado nada.
const guardado = await conLaBase(p, ['curso'], async (leer) => {
  const [curso] = await leer('curso')
  const porEjercicio = Object.entries(curso?.hechas ?? {}).map(([id, series]) => ({
    id, series: series.map((s) => ({ logrado: s.logrado, kg: s.kg ?? null })),
  }))
  return JSON.stringify(porEjercicio)
}).catch(() => '[]')
notas.push(`En el borrador: ${guardado}.`)
const conKilos = JSON.parse(guardado).flatMap((e) => e.series).filter((s) => s.kg === 20)
if (conKilos.length < 3) {
  fallos.push(`Solo ${conKilos.length} series quedaron con los 20 kg anotados, y fueron tres`)
}
notas.push(`Avances antes de cerrar: ${antes}.`)

await navegador.close()

for (const n of notas) console.log(n)
if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}
console.log('\nLos discos se ofrecen solo cuando hay con qué, y lo que se pone llega a la base.')
