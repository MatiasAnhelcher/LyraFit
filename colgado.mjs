/**
 * Sin barra, nada colgado. Y a la palanca frontal, recién con dominadas.
 *
 * Es el portón del arreglo del alta y la palanca frontal (revisión del 20 de
 * octubre de 2026). Los tests del dominio prueban las reglas; esto prueba que
 * la pantalla y la base usen esas reglas y no otras, que es lo que ningún test
 * de `src/dominio/` puede ver:
 *
 *   1. **Alta sin barra, 120 s de plancha.** Antes daba "Palanca frontal
 *      negativa 3×13 s". El plan tiene que decir "Elevación de piernas en el
 *      suelo" en core, nada colgado en ninguna fila, y nombrar hasta dónde
 *      llega cada cadena y cómo se abre. La base tiene que guardar lo mismo.
 *   2. **Alta con barra, cero dominadas y 120 s de plancha.** Tampoco colgado
 *      en core: una plancha no dice nada de colgarse.
 *   3. **Hoy no promete lo que el motor no va a hacer.** Con core en el techo
 *      de la elevación en el suelo y sin barra, no puede decir "pasás a
 *      elevación de rodillas colgado". Con "Tengo dónde colgarme" prendido en
 *      Ajustes, sí: ese es el control, sin él el primer chequeo pasaría igual
 *      con la anticipación rota.
 *   4. **Una sesión entera sin barra.** El motor no sube a lo colgado, y lo
 *      dice al cerrar.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node colgado.mjs`.
 * En otro puerto: `BASE=http://localhost:4181 node colgado.mjs`.
 */

import { BASE, abrir, completarUnaSesion, conLaBase, revisarQueSirvaLoCompilado } from './lib/portones.mjs'

const fallos = []
const notas = []

/** Lo que cuelga de una barra, por nombre, como lo muestra el plan. */
const COLGADO = /colgado|Dominadas|Palanca frontal/

/** El alta hasta el plan, contestando con la regleta. */
async function altaHastaElPlan(p, { barra, respuestas }) {
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'Empezar', exact: true }).click()
  await p.getByRole('button', { name: barra ? 'Sí, tengo barra' : 'No, por ahora no' }).click()
  for (const [i, valor] of respuestas.entries()) {
    await p.getByRole('button', { name: String(valor), exact: true }).click()
    const ultima = i === respuestas.length - 1
    await p.getByRole('button', { name: ultima ? 'Ver mi plan' : 'Siguiente', exact: true }).click()
    await p.waitForTimeout(150)
  }
  await p.waitForTimeout(300)
  return {
    filas: await p.locator('.registro .nombre').allInnerTexts(),
    texto: await p.locator('body').innerText(),
  }
}

async function terminarElAlta(p) {
  await p.getByRole('button', { name: 'Seguir', exact: true }).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: /Cuerpo completo/ }).click()
  await p.waitForTimeout(700)
  const ahoraNo = p.getByRole('button', { name: 'Ahora no' })
  if (await ahoraNo.isVisible().catch(() => false)) {
    await ahoraNo.click()
    await p.waitForTimeout(300)
  }
}

const leerTodo = (p) =>
  conLaBase(p, ['avances', 'preferencias', 'sesiones'], async (leer) => ({
    avances: await leer('avances'),
    preferencias: (await leer('preferencias'))[0],
    sesiones: await leer('sesiones'),
  }))

async function textoDeHoy(p) {
  await p.goto('about:blank')
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  return p.locator('body').innerText()
}

await revisarQueSirvaLoCompilado(BASE)

// ── 1. Alta sin barra, 120 s de plancha ───────────────────────────────────
const sinBarra = await abrir({ fallos })
const p = sinBarra.pagina
{
  // Flexiones 12, remos 12, sentadillas 25, plancha 120.
  const { filas, texto } = await altaHastaElPlan(p, { barra: false, respuestas: [12, 12, 25, 120] })
  notas.push(`Sin barra, el plan: ${filas.join(' · ')}.`)
  if (!filas.includes('Elevación de piernas en el suelo')) {
    fallos.push(`Sin barra y con 120 s de plancha, core no quedó en "Elevación de piernas en el suelo": ${filas.join(' · ')}`)
  }
  const colgadas = filas.filter((f) => COLGADO.test(f))
  if (colgadas.length > 0) fallos.push(`Sin barra, el plan del alta propone algo colgado: ${colgadas.join(', ')}`)
  if (!/Sin barra, tracción llega hasta/.test(texto) || !/Ajustes/.test(texto)) {
    fallos.push('Sin barra, el plan no dice hasta dónde llega cada cadena ni cómo se abre')
  }
  await terminarElAlta(p)

  const { avances, preferencias } = await leerTodo(p)
  const core = avances.find((a) => a.patron === 'core')
  if (preferencias?.tieneBarra !== false) fallos.push('El alta sin barra no guardó tieneBarra = false')
  if (core?.ejercicioId !== 'elevacion-piernas-suelo') {
    fallos.push(`La base guardó core en "${core?.ejercicioId}" y el plan mostraba la elevación de piernas en el suelo`)
  }
  notas.push(`En la base: ${avances.map((a) => `${a.patron}:${a.ejercicioId}`).join(', ')}.`)
}

// ── 2. Alta con barra, cero dominadas, 120 s de plancha ───────────────────
{
  const conBarra = await abrir({ fallos })
  const q = conBarra.pagina
  const { filas, texto } = await altaHastaElPlan(q, { barra: true, respuestas: [12, 0, 15, 120] })
  notas.push(`Con barra y cero dominadas, el plan: ${filas.join(' · ')}.`)
  if (!filas.includes('Elevación de piernas en el suelo')) {
    fallos.push(`Con barra, cero dominadas y 120 s de plancha, core quedó en: ${filas.join(' · ')}`)
  }
  if (filas.some((f) => /Palanca frontal/.test(f))) fallos.push('El alta ubicó a alguien en la palanca frontal')
  if (/Sin barra,/.test(texto)) fallos.push('Con barra, el plan igual dice hasta dónde llega "sin barra"')
  await conBarra.navegador.close()
}

// ── 3. Hoy, con core en el techo de lo que no cuelga ──────────────────────
await conLaBase(p, ['avances', 'preferencias'], async (leer, poner) => {
  const [prefe] = await leer('preferencias')
  // Los siete días de fuerza, para que el portón no dependa del día en que se corre.
  await poner('preferencias', {
    ...prefe,
    semana: { 1: 'fuerza', 2: 'fuerza', 3: 'fuerza', 4: 'fuerza', 5: 'fuerza', 6: 'fuerza', 7: 'fuerza' },
  })
  const core = (await leer('avances')).find((a) => a.patron === 'core')
  // En el techo de la ventana (12) y con la consolidación cumplida: cumpliendo
  // hoy, sin cierres, el motor pasaría a la elevación de rodillas colgado.
  await poner('avances', {
    ...core,
    ejercicioId: 'elevacion-piernas-suelo',
    objetivoActual: { series: 3, cantidad: 12 },
    senal: 1,
    sesionesEnObjetivo: 2,
    graciaRestante: 0,
  })
})

const PROMESA = /pasás a elevación de rodillas colgado/
if (PROMESA.test(await textoDeHoy(p))) {
  fallos.push('Sin barra, Hoy promete "pasás a elevación de rodillas colgado": el motor no lo va a hacer')
}

// El control: con barra, la misma situación sí abre el eslabón.
await p.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
await p.waitForTimeout(500)
const interruptor = p.getByRole('button', { name: /Tengo dónde colgarme/ })
if (!(await interruptor.isVisible().catch(() => false))) {
  fallos.push('No está "Tengo dónde colgarme" en Ajustes: quien consiga una barra no tiene dónde decirlo')
} else {
  if (!/NO$/.test((await interruptor.innerText()).trim())) {
    fallos.push('"Tengo dónde colgarme" no arranca en NO después de un alta sin barra')
  }
  await interruptor.click()
  await p.waitForTimeout(300)
  const { preferencias } = await leerTodo(p)
  if (preferencias?.tieneBarra !== true) fallos.push('Prender "Tengo dónde colgarme" no guardó tieneBarra = true')
  if (!PROMESA.test(await textoDeHoy(p))) {
    fallos.push('Con barra, Hoy no anuncia el paso a la elevación de rodillas colgado: el control falló, y el chequeo de arriba no prueba nada')
  }
  // Y se vuelve a apagar para la sesión de abajo.
  await p.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  await p.getByRole('button', { name: /Tengo dónde colgarme/ }).click()
  await p.waitForTimeout(300)
  if ((await leerTodo(p)).preferencias?.tieneBarra !== false) {
    fallos.push('Apagar "Tengo dónde colgarme" no guardó tieneBarra = false')
  }
}

// ── 4. Una sesión entera sin barra ────────────────────────────────────────
const razon = await completarUnaSesion(p)
if (razon) {
  fallos.push(`La sesión no se pudo completar: ${razon}`)
} else {
  const { avances, sesiones } = await leerTodo(p)
  const core = avances.find((a) => a.patron === 'core')
  notas.push(`Después de la sesión, core: ${core?.ejercicioId} ${core?.objetivoActual?.series}×${core?.objetivoActual?.cantidad}.`)
  if (core?.ejercicioId !== 'elevacion-piernas-suelo') {
    fallos.push(`Sin barra, el motor movió core a "${core?.ejercicioId}"`)
  }
  const colgados = avances.filter((a) => /colgado|dominada|palanca/.test(a.ejercicioId))
  if (colgados.length > 0) {
    fallos.push(`Sin barra, quedó algo colgado en el plan: ${colgados.map((a) => a.ejercicioId).join(', ')}`)
  }
  const decision = sesiones.at(-1)?.decisiones?.find((d) => d.patron === 'core')
  if (!decision) {
    fallos.push('La sesión no guardó ninguna decisión de core')
  } else {
    notas.push(`Lo que dijo el motor: "${decision.explicacion}"`)
    if (!/necesita una barra/.test(decision.explicacion)) {
      fallos.push(`El motor no dice por qué no sube: "${decision.explicacion}"`)
    }
  }
}

await sinBarra.navegador.close()

for (const n of notas) console.log(n)

if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}

console.log('\nSin barra no hay nada colgado, la palanca no se abre desde el alta, y Hoy no promete lo que el motor no hace.')
