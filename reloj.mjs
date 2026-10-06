/**
 * El reloj: que los tiempos sean los tiempos, y que no le hable al motor.
 *
 * Un reloj de intervalos tiene exactamente dos formas de estar mal y las dos
 * son invisibles en una captura:
 *
 *   1. **Que los tramos no duren lo que dicen.** Veintidós segundos en vez de
 *      veinte no se notan mirando, y arruinan el protocolo: un tabata es veinte
 *      a fondo, y si son veinticinco ya no se puede ir a fondo.
 *   2. **Que le mueva algo al motor.** Veinte segundos cerca del fallo con diez
 *      de pausa no son una medida de capacidad, y leerlos como tal bajaría de
 *      eslabón por series que nadie pidió.
 *
 * Así que esto corre un tabata ENTERO, de punta a punta, contra el reloj de
 * verdad. Son cuatro minutos y no hay forma de acelerarlos: el arco representa
 * tiempo real, que es exactamente lo que se está midiendo.
 *
 * La voz se prueba inyectando una voz falsa en es-AR. Sin eso este navegador se
 * queda mudo por diseño —no trae ninguna voz instalada— y el portón mediría
 * silencio llamándolo éxito.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node reloj.mjs`.
 */

import { chromium } from 'playwright'

const BASE = 'http://localhost:4173'
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

/** Cuánto puede desviarse un tramo de lo que promete, en segundos. */
const TOLERANCIA = 2

const fallos = []
const notas = []

const VOZ_FALSA = () => {
  window.__dicho = []
  const falsa = {
    voiceURI: 'prueba', name: 'Voz de prueba', lang: 'es-AR', localService: true, default: true,
  }
  Object.defineProperty(window.speechSynthesis, 'getVoices', { value: () => [falsa], configurable: true })
  Object.defineProperty(window.speechSynthesis, 'speak', {
    value: (u) => { if (u && typeof u.text === 'string' && u.text.length > 0) window.__dicho.push(u.text) },
    configurable: true,
  })
  Object.defineProperty(window.speechSynthesis, 'cancel', { value: () => {}, configurable: true })
  window.SpeechSynthesisUtterance = class {
    constructor(texto) {
      this.text = texto; this.voice = null; this.lang = ''
      this.rate = 1; this.pitch = 1; this.volume = 1
    }
  }
}

/** Lee la base sin pasar por la interfaz. */
async function conLaBase(pagina, tablas, trabajo) {
  return pagina.evaluate(
    async ([tablas, cuerpo]) => {
      const req = indexedDB.open('lyrafit')
      const db = await new Promise((r) => { req.onsuccess = () => r(req.result) })
      const tx = db.transaction(tablas, 'readwrite')
      const leer = (t) =>
        new Promise((r) => { const q = tx.objectStore(t).getAll(); q.onsuccess = () => r(q.result) })
      const poner = (t, v) => tx.objectStore(t).put(v)
      // eslint-disable-next-line no-new-func
      return new Function('leer', 'poner', `return (${cuerpo})(leer, poner)`)(leer, poner)
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
  await p.waitForTimeout(700)
}

const navegador = await chromium.launch({ executablePath: CHROMIUM })
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 }, locale: 'es-AR', colorScheme: 'dark',
})
await contexto.addInitScript(VOZ_FALSA)
const p = await contexto.newPage()
p.on('pageerror', (e) => fallos.push(`Error de JavaScript: ${e.message}`))
p.on('console', (m) => { if (m.type() === 'error') fallos.push(`Error en consola: ${m.text()}`) })

await alta(p)

// Los avances ANTES, para poder comparar byte por byte al final.
const antes = await conLaBase(p, ['avances'], async (leer) => JSON.stringify(await leer('avances')))

// ── El reloj, de punta a punta ────────────────────────────────────────────
await p.goto(`${BASE}/#/biblioteca`, { waitUntil: 'networkidle' })
await p.waitForTimeout(500)
if (!(await p.getByText('El reloj', { exact: true }).isVisible().catch(() => false))) {
  fallos.push('No se llega al reloj desde Cadenas')
}
await p.getByText('El reloj', { exact: true }).click()
await p.waitForTimeout(600)

// Dos ejercicios, para que la rotación se pueda ver.
await p.getByRole('button', { name: /Flexiones/ }).first().click()
await p.waitForTimeout(150)
await p.getByRole('button', { name: /Sentadilla|Zancada|Puente/ }).first().click()
await p.waitForTimeout(150)

const empezar = p.getByRole('button', { name: 'Empezar', exact: true })
if (!(await empezar.isEnabled())) fallos.push('Con dos ejercicios elegidos, "Empezar" sigue inerte')

const arrancoEn = Date.now()
await empezar.click()
await p.waitForTimeout(400)

const rotulo = () => p.locator('main p.rotulo').first().innerText().catch(() => '')

if (!(await rotulo()).includes('PREPARATE')) {
  fallos.push(`El reloj no arranca preparando, arranca en "${await rotulo()}"`)
}

// Se muestrea cada medio segundo y se anota cada cambio de rótulo con el
// momento en que pasó. De ahí salen las duraciones reales.
const cambios = []
let anterior = await rotulo()
let vueltasVistas = new Set()
let dibujoVisto = false
let avisoDeLoQueViene = false

for (let i = 0; i < 560; i++) {
  await p.waitForTimeout(500)
  const termino = await p.getByText('TERMINASTE').isVisible().catch(() => false)
  if (termino) break
  const ahora = await rotulo()
  const cambio = Boolean(ahora) && ahora !== anterior
  if (cambio) {
    cambios.push({ rotulo: ahora, en: Math.round((Date.now() - arrancoEn) / 1000) })
    anterior = ahora
  }
  const cabecera = await p.locator('header p.rotulo').innerText().catch(() => '')
  const v = cabecera.match(/VUELTA (\d+)/)
  if (v) vueltasVistas.add(v[1])
  if (!dibujoVisto) dibujoVisto = await p.locator('main svg[role="img"]').isVisible().catch(() => false)

  // Al ENTRAR en cada pausa se anota una cantidad: dos toques y nada más. Si
  // se tocara en cada muestreo serían cuarenta por pausa, el conteo quedaría en
  // cualquier número y los clics propios atrasarían el muestreo.
  if (cambio && ahora === 'AFLOJÁ') {
    const mas = p.getByRole('button', { name: 'Sumar' })
    if (await mas.isVisible().catch(() => false)) {
      await mas.click()
      await mas.click()
    }
    // Y que la pausa diga qué viene: es la queja que originó todo esto.
    if (!avisoDeLoQueViene) {
      avisoDeLoQueViene = await p
        .getByText('VIENE', { exact: true })
        .isVisible()
        .catch(() => false)
    }
  }
}

const duro = Date.now() - arrancoEn
notas.push(`El tabata entero duró ${Math.round(duro / 1000)} s (el plan dice 240).`)
if (Math.abs(duro / 1000 - 240) > TOLERANCIA * 3) {
  fallos.push(`El tabata duró ${Math.round(duro / 1000)} s y tenía que durar 240`)
}

// ── Los tramos duran lo que dicen ─────────────────────────────────────────
for (let i = 1; i < cambios.length; i++) {
  const largo = cambios[i].en - cambios[i - 1].en
  const esperado = cambios[i - 1].rotulo === 'AHORA' ? 20 : cambios[i - 1].rotulo === 'AFLOJÁ' ? 10 : 10
  if (Math.abs(largo - esperado) > TOLERANCIA) {
    fallos.push(
      `El tramo "${cambios[i - 1].rotulo}" duró ${largo} s y tenía que durar ${esperado}`,
    )
  }
}
notas.push(`Tramos medidos: ${cambios.length}.`)

if (vueltasVistas.size < 8) {
  fallos.push(`Se vieron ${vueltasVistas.size} vueltas distintas y el tabata tiene 8`)
}
if (!dibujoVisto) fallos.push('Nunca apareció el dibujo del ejercicio')
if (!avisoDeLoQueViene) fallos.push('La pausa no avisa qué ejercicio viene después')

// ── La voz cantó los cambios ──────────────────────────────────────────────
const dicho = await p.evaluate(() => window.__dicho.slice())
notas.push(`Dijo ${dicho.length} cosas. La primera: "${dicho[0] ?? '(nada)'}".`)
if (dicho.length < 8) {
  fallos.push(`La voz dijo ${dicho.length} cosas y el tabata tiene al menos 16 tramos`)
}
if (!dicho.some((d) => /^Última/.test(d))) {
  fallos.push('La voz nunca cantó la última vuelta')
}
if (!dicho[0]?.startsWith('Preparate')) {
  fallos.push(`La primera cosa que dijo fue "${dicho[0]}" en vez de preparar`)
}
// La preparación tiene que nombrar el ejercicio que viene: son diez segundos y
// es lo único que hace falta saber. Si dice "Preparate. ." quedó un hueco.
if (dicho[0] === 'Preparate.' || /\.\s*\.$/.test(dicho[0] ?? '')) {
  fallos.push(`La preparación no nombra el ejercicio: dijo "${dicho[0]}"`)
}
if (dicho.some((d) => /\.\s+\./.test(d))) {
  fallos.push(`Dijo una frase con un hueco: ${JSON.stringify(dicho.find((d) => /\.\s+\./.test(d)))}`)
}
// Con dos ejercicios rotando, la pausa tiene que cantar el que viene.
if (!dicho.some((d) => /^Aflojá\. Viene /.test(d))) {
  fallos.push('Con rotación, ninguna pausa cantó el ejercicio que venía')
}

// ── El final, y lo que quedó guardado ─────────────────────────────────────
if (!(await p.getByText('TERMINASTE').isVisible().catch(() => false))) {
  fallos.push('El reloj no llegó a la pantalla del final')
}

// La octava vuelta no tiene pausa: no hubo dónde contarla, y es justo la que
// suele ser el puntaje. Tiene que poder contarse acá.
const ultimaCuenta = p.getByText('¿Cuántas en la vuelta 8?')
if (!(await ultimaCuenta.isVisible().catch(() => false))) {
  fallos.push('La última vuelta no se puede contar en ningún lado: no tuvo pausa y el final no la pide')
} else {
  await p.getByRole('button', { name: 'Sumar' }).click()
  await p.waitForTimeout(200)
}

// Con rotación el puntaje es uno por ejercicio: un mínimo entre flexiones y
// sentadillas no sería un puntaje.
const filas = await p.locator('main .registro div').count().catch(() => 0)
notas.push(`Filas en el final: ${filas}.`)
if (await p.locator('main p.cifra.text-7xl').isVisible().catch(() => false)) {
  fallos.push('Con dos ejercicios rotando muestra UN puntaje, y no hay un puntaje único que tenga sentido')
}

// El final es la pantalla más alta del reloj —el puntaje, la última cuenta y
// las ocho vueltas— así que se mide en el teléfono más chico que la app soporta.
// Acá el scroll sí es legítimo (ya terminaste), pero los dos botones del fondo
// no pueden quedar inalcanzables y nada puede salirse a lo ancho.
await p.setViewportSize({ width: 320, height: 568 })
await p.waitForTimeout(400)
const anchoFinal = await p.evaluate(() => document.documentElement.scrollWidth)
const altoFinal = await p.evaluate(() => document.documentElement.scrollHeight)
notas.push(`El final en 320×568: ${anchoFinal} px de ancho y ${altoFinal} de alto.`)
if (anchoFinal > 321) {
  const quien = await p.evaluate(() => {
    const limite = document.documentElement.clientWidth
    let peor = null
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.right > limite + 0.5 && (!peor || r.right > peor.right)) {
        peor = `<${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 30)}"`
      }
    }
    return peor
  })
  fallos.push(`El final del reloj desborda a lo ancho en 320 px. Lo empuja ${quien ?? 'algo que ya no está'}`)
}
if (!(await p.getByRole('button', { name: 'Listo', exact: true }).isVisible().catch(() => false))) {
  fallos.push('En 320×568 el botón de cerrar el reloj no se ve')
}
await p.setViewportSize({ width: 390, height: 844 })
await p.waitForTimeout(300)

// Se guarda al salir, no al entrar: antes de salir todavía se puede anotar la
// última vuelta.
await p.getByRole('button', { name: 'Listo', exact: true }).click()
await p.waitForTimeout(1500)

const guardada = await conLaBase(p, ['sesiones'], async (leer) => {
  const todas = await leer('sesiones')
  const reloj = todas.filter((s) => s.tipo === 'reloj')
  return JSON.stringify({
    cuantas: reloj.length,
    tipos: todas.map((s) => s.tipo),
    registros: reloj[0]?.registros?.map((r) => ({
      id: r.ejercicioId, series: r.series.length, reloj: r.reloj === true,
      logros: r.series.map((s) => s.logrado),
    })) ?? [],
    ceros: (reloj[0]?.registros ?? []).flatMap((r) => r.series).filter((s) => s.logrado === 0).length,
  })
})
const g = JSON.parse(guardada)
notas.push(`Quedó guardada como: ${JSON.stringify(g.registros)}.`)
if (g.cuantas !== 1) {
  fallos.push(`Se guardaron ${g.cuantas} sesiones de reloj y tenía que ser 1 (tipos: ${g.tipos})`)
}
if (!g.registros.every((r) => r.reloj)) {
  fallos.push('Algún registro del reloj no quedó marcado, así que va a ensuciar la curva de fuerza')
}
if (g.registros.length !== 2) {
  fallos.push(`Se guardaron ${g.registros.length} ejercicios y rotaban 2`)
}
if (!g.registros.every((r) => r.series === 4)) {
  fallos.push(`Las vueltas no quedaron repartidas de a cuatro: ${JSON.stringify(g.registros)}`)
}
// Si alguna vuelta quedó en cero, es que no hubo dónde contarla.
if (g.ceros > 0) {
  fallos.push(`${g.ceros} vueltas quedaron sin contar aunque se contaron todas: falta un lugar para anotarlas`)
}

// ── Y lo único que de verdad importa: el motor no se movió ────────────────
const despues = await conLaBase(p, ['avances'], async (leer) => JSON.stringify(await leer('avances')))
const limpiar = (crudo) =>
  JSON.stringify(JSON.parse(crudo).map(({ actualizadoEn, ...resto }) => resto))
if (limpiar(antes) !== limpiar(despues)) {
  fallos.push('El reloj movió un avance. Un tabata no puede opinar sobre el plan de nadie.')
}

await navegador.close()

for (const n of notas) console.log(n)

if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}

console.log('\nEl tabata dura lo que dice, canta los cambios, y no le mueve nada al motor.')
