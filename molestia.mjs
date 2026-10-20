/**
 * La molestia, de punta a punta: avisarla cambia el plan y no cambia el motor.
 *
 * Es el portón del arreglo «la molestia que cambia el plan». Antes avisar una
 * molestia tenía cuatro trabas —el chequeo venía apagado, la pregunta salía
 * solo con los músculos doloridos, no estaba la bisagra y, cuando se avisaba,
 * la sesión pedía exactamente lo mismo sin decir nada—, y ninguna se ve en un
 * test del dominio: son caminos de pantalla. Esto los recorre con el chequeo
 * apagado, que es como viene la app:
 *
 *   1. **Se puede avisar desde Hoy** y la fila que queda no inventa sueño,
 *      energía ni músculos.
 *   2. **La cadena baja un eslabón**, en Hoy y en la sesión, con la línea que
 *      lo dice y dos series.
 *   3. **El motor no se entera**: cerrada la sesión, el avance de esa cadena
 *      está exactamente como estaba, el registro bajado va marcado y no hay
 *      decisión para esa cadena.
 *   4. **En el primer eslabón la cadena se saltea**, se dice en el primer
 *      ejercicio y ningún ejercicio de esa cadena aparece en la sesión.
 *   5. **El chequeo pregunta siempre**, con los músculos sin dolor, ofrece la
 *      bisagra, no promete lo que no hace y no borra la molestia ya avisada.
 *   6. **"Ya no" la retira** sin tocar las respuestas del chequeo.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después
 * `node molestia.mjs` (o `BASE=http://localhost:4183 node molestia.mjs`).
 */

import {
  BASE,
  abrir,
  alta,
  completarUnaSesion,
  conLaBase,
  revisarQueSirvaLoCompilado,
} from './lib/portones.mjs'

const fallos = []
const notas = []

await revisarQueSirvaLoCompilado(BASE)

const { navegador, pagina: p } = await abrir({ fallos })
await alta(p)

/** La fecha de hoy como la escribe la app: local y AAAA-MM-DD. */
const hoy = await p.evaluate(() => {
  const d = new Date()
  const dd = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
})

/** Recargar de verdad: una escritura cruda no despierta a `liveQuery`. */
async function recargar(ruta) {
  await p.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' })
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
}

async function filaDeHoy() {
  const json = await conLaBase(p, ['estados'], async (leer) =>
    JSON.stringify(await leer('estados')),
  )
  return JSON.parse(json).find((e) => e.fecha === hoy) ?? null
}

async function avances() {
  const json = await conLaBase(p, ['avances'], async (leer) =>
    JSON.stringify(await leer('avances')),
  )
  return Object.fromEntries(JSON.parse(json).map((a) => [a.patron, a]))
}

const texto = (selector) => p.locator(selector).first().innerText().catch(() => '')
const boton = (nombre) => p.getByRole('button', { name: nombre, exact: true })

// ── 0. Un punto de partida que se puede leer ─────────────────────────────
//
// Hoy como día de fuerza —si no, Hoy no dibuja el plan—, tracción en el
// cuarto eslabón (para que pueda bajar) y empuje en el primero (para que se
// saltee). Lo demás, como lo dejó el alta. El chequeo, apagado: es el valor
// de fábrica y el caso que este arreglo vino a cubrir.
await conLaBase(p, ['preferencias', 'avances'], async (leer, poner) => {
  const [pref] = await leer('preferencias')
  const d = new Date().getDay()
  const clave = d === 0 ? 7 : d
  const semana = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [n, n === clave ? 'fuerza' : 'descanso']))
  poner('preferencias', { ...pref, semana, estadoActivo: false })
  const avance = (patron, ejercicioId, series, cantidad) => ({
    patron,
    ejercicioId,
    objetivoActual: { series, cantidad },
    senal: 1,
    sesionesEnObjetivo: 0,
    graciaRestante: 0,
    actualizadoEn: 1,
  })
  poner('avances', avance('traccion', 'remo-australiano-pies-elevados', 3, 6))
  poner('avances', avance('empuje', 'flexion-pared', 3, 8))
})
await recargar('/')

const planAntes = await texto('[data-prueba="plan-de-hoy"]')
if (!planAntes.includes('Remo australiano con pies elevados')) {
  fallos.push(`Sin molestia, Hoy no muestra el eslabón de tracción puesto: "${planAntes}"`)
}

// ── 1. Avisar desde Hoy, con el chequeo apagado ──────────────────────────
const aviso = p.locator('[data-prueba="avisar-molestia"]')
if (!(await aviso.isVisible().catch(() => false))) {
  fallos.push('Con el chequeo apagado, Hoy no ofrece dónde avisar una molestia')
} else {
  notas.push(`En Hoy, debajo de Empezar: "${await aviso.innerText()}".`)
  await aviso.click()
  await p.waitForTimeout(500)
  if (!p.url().includes('#/molestia')) fallos.push(`El aviso no abre la pantalla de la molestia: ${p.url()}`)
  if (!(await boton('Bisagra').isVisible().catch(() => false))) {
    fallos.push('La pantalla de la molestia no ofrece la bisagra')
  }
  await boton('Tracción').click()
  await boton('Listo').click()
  await p.waitForTimeout(700)
}

const fila = await filaDeHoy()
if (fila?.molestia !== 'traccion') {
  fallos.push(`La molestia no quedó guardada: ${JSON.stringify(fila)}`)
} else if ('sueno' in fila || 'energia' in fila || 'musculos' in fila) {
  fallos.push(`Avisar la molestia inventó respuestas del chequeo: ${JSON.stringify(fila)}`)
} else {
  notas.push(`Quedó la fila ${JSON.stringify(fila)}: la molestia sola, sin inventar nada.`)
}

// ── 2. Tracción baja un eslabón, en Hoy y en la sesión ───────────────────
await recargar('/')
const planCon = await texto('[data-prueba="plan-de-hoy"]')
if (!planCon.includes('Remo australiano bajo') || !/por molestia/i.test(planCon)) {
  fallos.push(`Con molestia en tracción, Hoy no anuncia el eslabón de abajo: "${planCon}"`)
}
if (planCon.includes('Remo australiano con pies elevados')) {
  fallos.push('Con molestia en tracción, Hoy sigue anunciando el eslabón de siempre')
}
const enlace = await aviso.innerText().catch(() => '')
if (!/molestia en tracción/i.test(enlace)) {
  fallos.push(`Con una molestia avisada, el acceso no dice cuál: "${enlace}"`)
}

const avancesAntes = await avances()

await recargar('/entrenar')
const titulo = await texto('[data-prueba="titulo-ejercicio"]')
const linea = await texto('[data-prueba="linea-molestia"]')
const casilleros = await p.locator('ul[aria-label="Series de este ejercicio"] li').count()
notas.push(`La sesión arranca con "${titulo}", ${casilleros} series, y dice: "${linea}"`)
if (titulo !== 'Remo australiano bajo') {
  fallos.push(`La sesión no bajó tracción: arranca con "${titulo}"`)
}
if (linea !== 'Hoy bajamos un eslabón en tracción: avisaste una molestia.') {
  fallos.push(`La sesión no dice por qué bajó tracción: "${linea}"`)
}
if (casilleros !== 2) fallos.push(`El eslabón bajado pide ${casilleros} series y son 2`)

// ── 3. Cerrada la sesión, el motor no se enteró ──────────────────────────
const razon = await completarUnaSesion(p)
if (razon) {
  fallos.push(`No se pudo cerrar la sesión: ${razon}`)
} else {
  const despues = await avances()
  const clave = (a) =>
    JSON.stringify({
      ejercicioId: a?.ejercicioId,
      objetivoActual: a?.objetivoActual,
      senal: a?.senal,
      sesionesEnObjetivo: a?.sesionesEnObjetivo,
      graciaRestante: a?.graciaRestante,
    })
  if (clave(despues.traccion) !== clave(avancesAntes.traccion)) {
    fallos.push(
      `Avisar una molestia movió el motor de tracción: antes ${clave(avancesAntes.traccion)}, después ${clave(despues.traccion)}`,
    )
  }
  const json = await conLaBase(p, ['sesiones'], async (leer) => JSON.stringify(await leer('sesiones')))
  const sesion = JSON.parse(json).sort((a, b) => b.finalizadaEn - a.finalizadaEn)[0]
  const bajado = sesion?.registros.find((r) => r.ejercicioId === 'remo-australiano-bajo')
  if (!bajado) fallos.push('La sesión no guardó las series del eslabón bajado')
  else if (bajado.bajada !== true) {
    fallos.push('El eslabón bajado se guardó sin marcar: la curva de fuerza lo leería como un pozo')
  }
  if (sesion?.registros.some((r) => r.ejercicioId === 'remo-australiano-pies-elevados')) {
    fallos.push('La sesión guardó el eslabón de siempre de tracción con la molestia avisada')
  }
  if ((sesion?.decisiones ?? []).some((d) => d.patron === 'traccion')) {
    fallos.push('El motor decidió algo sobre tracción el día de la molestia')
  }
  notas.push(
    `Cerrada: tracción sigue en ${despues.traccion?.ejercicioId} ${JSON.stringify(despues.traccion?.objetivoActual)}; decisiones para ${(sesion?.decisiones ?? []).map((d) => d.patron).join(', ') || 'nadie'}.`,
  )
}

// ── 4. En el primer eslabón, la cadena se saltea ─────────────────────────
await recargar('/molestia')
if ((await boton('Tracción').getAttribute('aria-pressed')) !== 'true') {
  fallos.push('La pantalla de la molestia no muestra la que ya estaba avisada')
}
if (!(await boton('Ya no').isVisible().catch(() => false))) {
  fallos.push('Con una molestia avisada no hay forma de retirarla')
}
await boton('Empuje').click()
await boton('Listo').click()
await p.waitForTimeout(700)

await recargar('/')
const planSinEmpuje = await texto('[data-prueba="plan-de-hoy"]')
if (planSinEmpuje.includes('Flexiones en la pared') || /empuje/i.test(planSinEmpuje)) {
  fallos.push(`Con molestia en empuje y en su primer eslabón, Hoy sigue anunciando empuje: "${planSinEmpuje}"`)
}

await recargar('/entrenar')
const lineaSaltea = await texto('[data-prueba="linea-molestia"]')
if (lineaSaltea !== 'Hoy no cargamos empuje: avisaste una molestia.') {
  fallos.push(`La sesión no dice que empuje se saltea: "${lineaSaltea}"`)
}
const rotulos = []
for (let i = 0; i < 12; i++) {
  rotulos.push(await texto('main p.rotulo'))
  const saltear = boton('Saltear este ejercicio')
  if (!(await saltear.isVisible().catch(() => false))) break
  await saltear.click()
  await p.waitForTimeout(250)
}
notas.push(`La sesión con empuje salteado: ${rotulos.join(' / ')}.`)
if (rotulos.some((r) => /^EMPUJE/i.test(r))) {
  fallos.push(`Con empuje salteado, la sesión igual trae un ejercicio de empuje: ${rotulos.join(' / ')}`)
}
await boton('Salir').click()
await p.waitForTimeout(400)

// ── 5. El chequeo pregunta siempre, con la bisagra y sin promesas ────────
await recargar('/estado')
const pantalla = await p.locator('body').innerText()
if (/deja de empujar/i.test(pantalla)) {
  fallos.push('El chequeo sigue prometiendo que "la app deja de empujar esa cadena"')
}
if (!(await boton('Bisagra').isVisible().catch(() => false))) {
  fallos.push('Sin tocar los músculos, el chequeo no pregunta por la molestia o no ofrece la bisagra')
}
if ((await boton('Empuje').getAttribute('aria-pressed').catch(() => null)) !== 'true') {
  fallos.push('El chequeo no muestra la molestia que ya se había avisado desde Hoy')
}
await boton('Bien').click()
await boton('Normal').click()
await boton('Sin dolor').click()
await boton('Listo').click()
await p.waitForTimeout(700)
const conChequeo = await filaDeHoy()
if (conChequeo?.molestia !== 'empuje' || conChequeo?.musculos !== 5 || conChequeo?.sueno !== 4) {
  fallos.push(`Guardar el chequeo perdió la molestia o las respuestas: ${JSON.stringify(conChequeo)}`)
}

// ── 6. "Ya no" la retira, y el chequeo queda ─────────────────────────────
await recargar('/molestia')
await boton('Ya no').click()
await boton('Listo').click()
await p.waitForTimeout(700)
const retirada = await filaDeHoy()
if (retirada?.molestia !== undefined || retirada?.sueno !== 4 || retirada?.energia !== 3) {
  fallos.push(`"Ya no" no retiró la molestia o se llevó el chequeo: ${JSON.stringify(retirada)}`)
}
await recargar('/')
if (!/me molesta algo/i.test(await aviso.innerText().catch(() => ''))) {
  fallos.push('Retirada la molestia, el acceso de Hoy sigue diciendo que hay una')
}

await navegador.close()

for (const nota of notas) console.log(' ·', nota)
if (fallos.length > 0) {
  console.log('\nFALLOS:')
  for (const f of fallos) console.log(' -', f)
  process.exit(1)
}
console.log('\nLa molestia cambia el plan, se dice en la sesión y el motor no se entera.')
