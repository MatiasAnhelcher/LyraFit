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
import { completarUnaSesion, conLaBase, revisarQueSirvaLoCompilado } from './lib/portones.mjs'

const BASE = 'http://localhost:4173'
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

const fallos = []
const notas = []


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

/*
 * Que lo que se mide sea el código que está en disco.
 *
 * Esta llamada faltaba, y faltaba justo acá. El guardián se escribió DESPUÉS
 * de que este portón midiera un build viejo y reportara una rotura que ya
 * estaba arreglada en `src/` — y se guardó en `lib/portones.mjs`, que este
 * archivo no importaba. El seguro no cubría al portón para el que se hizo.
 */
await revisarQueSirvaLoCompilado(BASE)

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
  const puesto = await p.locator('[data-prueba="kilos"]').innerText().catch(() => '')
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
const senalesDe = (p) =>
  conLaBase(p, ['avances'], async (leer) =>
    Object.fromEntries((await leer('avances')).map((a) => [a.patron, a.senal])))

const antesDeCerrar = await senalesDe(p)
const antes = JSON.stringify(
  await conLaBase(p, ['avances'], async (leer) =>
    (await leer('avances')).map((a) => [a.patron, a.objetivoActual.cantidad, a.senal])),
)

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

/*
 * Y ACÁ ESTABA EL AGUJERO: el título de esta sección prometía algo que la
 * sección no medía.
 *
 * Decía «y el motor no lo lee como un fracaso», que es la afirmación que
 * importa de toda la carga externa: una serie hecha CON DISCOS cumple el
 * objetivo igual que una sin ellos, y si el motor la leyera como un fracaso
 * le bajaría el objetivo a alguien que cumplió. Es el daño más caro que
 * puede hacer el motor, porque se acumula en silencio.
 *
 * Lo que había era `notas.push('Avances antes de cerrar: …')` y nada más:
 * la sesión no se cerraba, el después no se leía, y no había UNA sola
 * aserción. Las notas se imprimen con `console.log` y no tocan `fallos`, así
 * que el portón salía con 0 pasara lo que pasara.
 *
 * Ahora la sesión se termina de verdad y se comparan las señales de los dos
 * lados. Anotar el objetivo propuesto es cumplirlo, así que ninguna señal
 * tiene derecho a bajar; la que baje delata que las series con kilos se
 * leyeron mal.
 */
{
  const porQueNo = await completarUnaSesion(p)
  if (porQueNo) {
    fallos.push(
      `No se pudo cerrar la sesión con discos puestos (${porQueNo}), así que no se midió si el motor los lee como un fracaso.`,
    )
  } else {
    const despuesDeCerrar = await senalesDe(p)
    notas.push(`Señales antes: ${JSON.stringify(antesDeCerrar)} · después: ${JSON.stringify(despuesDeCerrar)}.`)
    const bajaron = Object.entries(despuesDeCerrar).filter(
      ([patron, senal]) => senal < (antesDeCerrar[patron] ?? 0) - 1e-9,
    )
    for (const [patron, senal] of bajaron) {
      fallos.push(
        `Cerrada una sesión cumplida CON DISCOS, la señal de ${patron} bajó de ${antesDeCerrar[patron]} a ${senal}: el motor está leyendo la carga externa como un fracaso y le va a bajar el objetivo a alguien que cumplió.`,
      )
    }
    if (Object.keys(despuesDeCerrar).length === 0) {
      fallos.push('Después de cerrar la sesión no hay ningún avance que mirar: esta comprobación no midió nada.')
    }
  }
}

/*
 * ── 4. La propuesta del motor llega a la pantalla ────────────────────────
 *
 * Desde que el motor puede decir "subí a 12,5 kg" al final de una cadena, ese
 * número tiene que estar PUESTO cuando la persona llega a la serie. Si la
 * pantalla siguiera mostrando el peso de la vez pasada, la propuesta quedaría
 * en un texto del cierre que nadie va a seguir a mano, y el motor estaría
 * hablando solo.
 *
 * Se escribe un objetivo con kilos directo en la base —es la forma de llegar
 * a ese estado sin hacer quince sesiones— y se mira qué muestra Entrenar.
 */
{
  // `leer` YA devuelve una promesa —lo dice `lib/portones.mjs`— y la primera
  // versión de esto la trataba como un IDBRequest con `onsuccess`. El
  // resultado no fue un error claro sino una transacción que se cerraba sola
  // y una promesa colgada: "Resulting promise was garbage collected".
  // El borrador primero. A esta altura del portón hay una sesión a medio
  // hacer guardada en `curso`, y Entrenar la RETOMA en vez de armar el plan
  // desde los avances — que es exactamente lo que tiene que hacer, y lo que
  // hace que esta medición mire la pantalla equivocada si no se limpia.
  await p.evaluate(async () => {
    const req = indexedDB.open('lyrafit')
    const db = await new Promise((r) => { req.onsuccess = () => r(req.result) })
    await new Promise((r) => {
      const tx = db.transaction(['curso'], 'readwrite')
      tx.objectStore('curso').clear()
      tx.oncomplete = () => r()
    })
  })

  await conLaBase(p, ['avances'], async (leer, poner) => {
    const avances = await leer('avances')
    for (const a of avances) {
      poner('avances', { ...a, objetivoActual: { ...a.objetivoActual, kg: 12.5 } })
    }
    return avances.length
  })
  await p.reload({ waitUntil: 'networkidle' })
  await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(900)
  const puestos = await p.locator('[data-prueba="kilos"]').first().innerText().catch(() => '')
  if (!puestos.includes('12')) {
    fallos.push(
      `El motor propuso 12,5 kg y la pantalla muestra "${puestos}": la propuesta no llega, y queda en un texto que nadie va a seguir a mano`,
    )
  } else {
    console.log(`La propuesta del motor llega a la serie: ${puestos.replace(/\s+/g, ' ')}.`)
  }
}

await navegador.close()

for (const n of notas) console.log(n)
if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}
console.log('\nLos discos se ofrecen solo cuando hay con qué, y lo que se pone llega a la base.')
