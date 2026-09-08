/**
 * Lo que la app guarda, ¿es cierto y sigue estando?
 *
 * Dos preguntas sobre los datos, no sobre el dibujo — de eso se ocupa
 * `revisar.mjs`—. Las dos fallaron alguna vez en silencio y ninguna se ve en
 * una captura de pantalla.
 *
 * ## 1. ¿Sobrevive una sesión a que el navegador recicle la pestaña?
 *
 * Es la pregunta más cara de toda la app. No hay servidor: los cuarenta
 * minutos de una sesión viven en el dispositivo, y hasta la versión 3 de la
 * base vivían además en la memoria de la pestaña, que iOS descarta sin avisar
 * cuando atendés un llamado, cambiás de app o el teléfono queda corto de
 * memoria. Perder una sesión entera es peor que cualquier función que la app
 * pueda no tener, así que esto se revisa aparte y con un guion propio.
 *
 * La prueba hace media sesión, recarga la página a lo bruto —lo más parecido a
 * que muera la pestaña: se pierde todo el estado de React y queda solo lo que
 * llegó a IndexedDB— y revisa tres cosas: que las series anotadas sigan ahí,
 * que el cronómetro no se haya reiniciado, y que "empezar de cero" limpie de
 * verdad el borrador en vez de dejarlo para la próxima.
 *
 * ## 2. ¿Predicho y logrado son de verdad dos números?
 *
 * La app pregunta "¿cuántas te salen ahora?" antes de la primera serie de cada
 * ejercicio y "¿cuántas hiciste?" después. Durante un tiempo fueron la misma
 * pantalla y el mismo número: se guardaba el propuesto como predicho y como
 * logrado, así que el error de calibración daba cero por construcción y la
 * pantalla de progreso mostraba un 0 fijo que no medía nada. Es un defecto que
 * vuelve solo si alguien simplifica `anotar()`, y que no se ve mirando la app:
 * hay que abrir la base y comparar los dos campos.
 *
 * ## 3. ¿La sesión que se retoma es la MISMA sesión?
 *
 * Un borrador que se restaura mal es peor que un borrador que no existe,
 * porque el error queda escrito en el historial y en el motor. Dos formas de
 * restaurar mal, las dos encontradas revisando antes de publicar:
 *
 * - El tipo de sesión venía en la URL (`/entrenar?corta=1`) y la URL se pierde
 *   cuando el navegador recicla la pestaña. Una sesión de siete minutos se
 *   retomaba como sesión de plan y se cerraba con un rendimiento de 0,33
 *   —una serie contra un objetivo de tres— así que el motor le bajaba el
 *   objetivo a las cuatro cadenas por series que nunca se le pidieron.
 * - El cronómetro contaba desde la hora original, así que el hueco entre que
 *   te fuiste y volviste quedaba adentro. Empezar a las ocho y volver a las
 *   doce y media escribía una sesión de cuatro horas y media.
 *
 * Uso: node rescate.mjs   (con `npm run preview` andando en el 4173)
 */

import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'

const BASE = 'http://localhost:4173'
const fallos = []

/**
 * Que lo que se está revisando sea lo que está en disco.
 *
 * `vite preview` se deja abierto entre corridas y puede quedar sirviendo un
 * build viejo. Pasó, y produjo el peor resultado posible: una revisión en verde
 * sobre código que no era el compilado — incluida una prueba por mutación que
 * "pasó" con la mutación puesta—. Un guion que puede revisar el archivo
 * equivocado sin decirlo es peor que no tener guion.
 *
 * Cotejar el hash del bundle contra `dist/index.html` cuesta una línea.
 */
async function revisarQueSirvaLoCompilado(base) {
  const enDisco = (await readFile('dist/index.html', 'utf8')).match(/assets\/index-[^"']+\.js/)?.[0]
  const servido = (await (await fetch(`${base}/`)).text()).match(/assets\/index-[^"']+\.js/)?.[0]
  if (!enDisco || !servido) {
    console.log('No se pudo comparar el build servido con el de disco.')
    process.exit(2)
  }
  if (enDisco !== servido) {
    console.log('EL SERVIDOR ESTÁ SIRVIENDO UN BUILD VIEJO.')
    console.log(`  en disco:  ${enDisco}`)
    console.log(`  sirviendo: ${servido}`)
    console.log('Reiniciá `npm run preview` después de compilar; si no, esto revisa otro código.')
    process.exit(2)
  }
}

await revisarQueSirvaLoCompilado(BASE)

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
})
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: 'dark',
  locale: 'es-AR',
})
const p = await contexto.newPage()
p.on('pageerror', (e) => fallos.push(`Error de JavaScript: ${e.message}`))

// El alta, que es el portero: sin completarla todo redirige a /alta.
await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await p.waitForTimeout(400)
await p.getByRole('button', { name: 'Empezar', exact: true }).click()
await p.getByRole('button', { name: 'Sí, tengo barra' }).click()
for (let i = 0; i < 4; i++) {
  for (let n = 0; n < 6; n++) await p.getByRole('button', { name: 'Sumar' }).click()
  const plan = p.getByRole('button', { name: 'Ver mi plan' })
  if (await plan.isVisible().catch(() => false)) await plan.click()
  else await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await p.waitForTimeout(100)
}
await p.getByRole('button', { name: 'Seguir', exact: true }).click()
await p.waitForTimeout(200)
await p.getByRole('button', { name: /Cuerpo completo/ }).click()
await p.waitForTimeout(500)

// Media sesión: se anotan tres series salteando los descansos.
await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
const salteaDescanso = async () => {
  const saltear = p.getByRole('button', { name: 'Saltear', exact: true })
  if (await saltear.isVisible().catch(() => false)) await saltear.click()
}
for (let i = 0; i < 3; i++) {
  await salteaDescanso()
  // La primera serie de cada ejercicio pide primero la predicción.
  const voy = p.getByRole('button', { name: 'Voy', exact: true })
  if (await voy.isVisible().catch(() => false)) {
    await voy.click()
    await p.waitForTimeout(150)
  }
  await p.getByRole('button', { name: 'Anotar serie', exact: true }).click()
  await p.waitForTimeout(200)
}
await salteaDescanso()
await p.waitForTimeout(300)

const casilleros = () => p.locator('ul[aria-label="Series de este ejercicio"] li').allInnerTexts()
const reloj = () => p.locator('header p').innerText()
const enSegundos = (t) => {
  const partes = t.trim().split(':').map(Number)
  return partes.length === 3
    ? partes[0] * 3600 + partes[1] * 60 + partes[2]
    : partes[0] * 60 + partes[1]
}

const antes = await casilleros()
const relojAntes = await reloj()
if (!antes.some((t) => /\d/.test(t))) {
  fallos.push(`No se anotó nada antes de la prueba: ${JSON.stringify(antes)}`)
}

// Que pase un rato, para que el cronómetro tenga algo que perder.
await p.waitForTimeout(4000)

// Acá muere la pestaña.
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

const despues = await casilleros()
const relojDespues = await reloj()
const avisa = await p.getByText('sesión retomada donde la dejaste').isVisible().catch(() => false)

if (JSON.stringify(antes) !== JSON.stringify(despues)) {
  fallos.push(`Las series no sobrevivieron: ${JSON.stringify(antes)} → ${JSON.stringify(despues)}`)
}
if (!avisa) fallos.push('La sesión se retomó sin decírselo a la persona.')
if (enSegundos(relojDespues) < enSegundos(relojAntes)) {
  fallos.push(`El cronómetro se reinició: ${relojAntes} → ${relojDespues}`)
}

// Y "empezar de cero" tiene que borrar el borrador, no solo limpiar la pantalla.
await p.getByRole('button', { name: 'empezar de cero' }).click()
await p.waitForTimeout(400)
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
if (await p.getByText('sesión retomada donde la dejaste').isVisible().catch(() => false)) {
  fallos.push('Empezar de cero no borró el borrador: la sesión volvió a retomarse.')
}

// ─── 2. Predicho y logrado tienen que poder ser distintos ────────────────

// Se predice dos por encima de lo propuesto y después se anota tres menos que
// eso: si los dos campos salen iguales, la medición volvió a ser una mentira.
await p.getByRole('button', { name: 'Sumar' }).click()
await p.getByRole('button', { name: 'Sumar' }).click()
const dijo = Number(await p.locator('main p.cifra.w-32').innerText())
await p.getByRole('button', { name: 'Voy', exact: true }).click()
await p.waitForTimeout(300)

const pregunta = await p.locator('main section p').first().innerText()
if (!/hiciste/i.test(pregunta)) {
  fallos.push(`Después de predecir, la app no pregunta qué hiciste: "${pregunta}"`)
}

for (let i = 0; i < 3; i++) await p.getByRole('button', { name: 'Restar' }).click()
const hizo = Number(await p.locator('main p.cifra.w-32').innerText())
await p.getByRole('button', { name: 'Anotar serie', exact: true }).click()
await p.waitForTimeout(400)

// Y la segunda serie del mismo ejercicio no vuelve a preguntar.
const saltea = p.getByRole('button', { name: 'Saltear', exact: true })
if (await saltea.isVisible().catch(() => false)) await saltea.click()
await p.waitForTimeout(300)
if (await p.getByRole('button', { name: 'Voy', exact: true }).isVisible().catch(() => false)) {
  fallos.push('La app pide predicción en la segunda serie: son cuatro por sesión, no dieciocho.')
}

const anotadas = await p.evaluate(async () => {
  const base = await new Promise((res, rej) => {
    const r = indexedDB.open('lyrafit')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  const borrador = await new Promise((res, rej) => {
    const q = base.transaction('curso').objectStore('curso').get('actual')
    q.onsuccess = () => res(q.result)
    q.onerror = () => rej(q.error)
  })
  return Object.values(borrador?.hechas ?? {}).flat()
})
const conPrediccion = anotadas.filter((s) => s.predicho !== undefined)
if (conPrediccion.length === 0) {
  fallos.push('No se guardó ninguna predicción.')
} else if (conPrediccion.every((s) => s.predicho === s.logrado)) {
  fallos.push(
    `Predicho y logrado se guardaron iguales (dije ${dijo}, hice ${hizo}): ` +
      'la calibración vuelve a medir cero por construcción.',
  )
}

// ─── 3. La sesión retomada es la misma sesión ────────────────────────────
//
// Regla de oro de esta sección: NUNCA tocar la base con Entrenar montado. Esa
// pantalla reescribe el borrador cada vez que cambia algo, así que una
// escritura hecha desde ahí se pisa sola y la prueba mide cualquier cosa. Todo
// lo que manipula la base se hace parado en Hoy.

const enHoy = async () => {
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
}

const conLaBase = (fn, arg) => p.evaluate(async ([codigo, arg]) => {
  const base = await new Promise((res, rej) => {
    const r = indexedDB.open('lyrafit')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  const leer = () => new Promise((res, rej) => {
    const q = base.transaction('curso').objectStore('curso').get('actual')
    q.onsuccess = () => res(q.result ?? null)
    q.onerror = () => rej(q.error)
  })
  const escribir = (b) => new Promise((res, rej) => {
    const tx = base.transaction('curso', 'readwrite')
    if (b === null) tx.objectStore('curso').delete('actual')
    else tx.objectStore('curso').put(b)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  // eslint-disable-next-line no-new-func
  const salida = await new Function('leer', 'escribir', 'arg', `return (${codigo})(leer, escribir, arg)`)(leer, escribir, arg)
  base.close()
  return salida
}, [fn.toString(), arg])

// (a) Una sesión corta tiene que seguir siendo corta después de morir la pestaña.
await enHoy()
await conLaBase(async (leer, escribir) => escribir(null))

await p.goto(`${BASE}/#/entrenar?corta=1`, { waitUntil: 'networkidle' })
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1000)

const casillasCorta = await p.locator('ul[aria-label="Series de este ejercicio"] li').count()
if (casillasCorta !== 1) fallos.push(`Una sesión corta debería pedir una serie y pide ${casillasCorta}.`)

await salteaDescanso()
await p.waitForTimeout(300)
const voyCorta = p.getByRole('button', { name: 'Voy', exact: true })
if (await voyCorta.isVisible().catch(() => false)) { await voyCorta.click(); await p.waitForTimeout(400) }
const anotarCorta = p.getByRole('button', { name: 'Anotar serie', exact: true })
if (!(await anotarCorta.isVisible().catch(() => false))) {
  const botones = (await p.locator('button').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
  fallos.push(`No se pudo anotar la serie de la sesión corta. Botones en pantalla: ${botones.join(' · ')}`)
} else {
  await anotarCorta.click()
  await p.waitForTimeout(700)
}

// La pestaña muere y se vuelve SIN el parámetro, que es lo que pasa de verdad:
// la URL se pierde y la PWA reabre en su start_url.
//
// El paso por `about:blank` no es cosmético. Ir directo de `#/entrenar?corta=1`
// a `#/entrenar` es un cambio de hash: NO recarga el documento, así que la
// página viva se queda un instante con esCorta=false y reescribe el borrador
// con corta:false antes de que uno alcance a recargar. Eso no le pasa a nadie
// —la app nunca linkea a /entrenar sin el parámetro— pero arruinaba la prueba y
// hacía parecer roto algo que no lo estaba.
await p.goto('about:blank')
await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)

const casillasTrasRetomar = await p.locator('ul[aria-label="Series de este ejercicio"] li').count()
await enHoy()
const borradorCorta = await conLaBase(async (leer) => leer())

if (borradorCorta?.corta !== true) {
  fallos.push('El borrador no recuerda que la sesión era corta.')
} else if (casillasTrasRetomar !== 1) {
  fallos.push(
    `La sesión corta se retomó como sesión de plan: pide ${casillasTrasRetomar} series en vez de 1. ` +
      'Al cerrarla, el motor le baja el objetivo a las cuatro cadenas por series que nunca se pidieron.',
  )
}

// (b) El hueco entre que te fuiste y volviste no es tiempo entrenado.
const CUATRO_HORAS = 4 * 60 * 60 * 1000
const acumulado = borradorCorta?.duracionAcumulada ?? 0
await conLaBase(async (leer, escribir, hueco) => {
  const b = await leer()
  if (!b) return
  // Como si te hubieras ido hace cuatro horas: el arranque queda viejo, pero
  // lo efectivamente entrenado sigue siendo lo mismo.
  b.arrancadaEn -= hueco
  b.actualizadoEn = Date.now()
  await escribir(b)
}, CUATRO_HORAS)

await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
await p.reload({ waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
const relojRetomado = await reloj()
if (enSegundos(relojRetomado) > acumulado + 120) {
  fallos.push(
    `Al retomar cuatro horas después, el cronómetro marca ${relojRetomado} en vez de los ~${acumulado}s ` +
      'realmente entrenados: el hueco quedaría escrito en el historial.',
  )
}

await navegador.close()

if (fallos.length > 0) {
  console.log('PROBLEMAS ENCONTRADOS:')
  for (const f of fallos) console.log(' -', f)
  process.exit(1)
}
console.log(`La sesión sobrevive a que muera la pestaña (${relojAntes} → ${relojDespues}).`)
console.log(`Predicho y logrado se guardan por separado (dije ${dijo}, hice ${hizo}).`)
console.log(`Una sesión corta se retoma corta, y el hueco no cuenta (${relojRetomado}).`)
