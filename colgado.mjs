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
 *      con la anticipación rota. Y apagarlo estando en las dominadas y en las
 *      elevaciones colgado baja las dos a lo último que no cuelga.
 *   4. **Una sesión entera sin barra.** El motor no sube a lo colgado, y lo
 *      dice al cerrar. Y en ningún momento de la sesión Entrenar promete el
 *      paso a lo colgado.
 *   5. **La palanca frontal pide 3 series de 8 dominadas completas, y quien ya
 *      estaba en ella baja una sola vez.** El alta deja escrita la revisión
 *      vacía. Una instalación de antes, con la palanca abierta (3×8), no se
 *      toca; con 3×5 —abierta con la regla vieja— baja a la elevación de
 *      piernas colgado al abrir la app, y Hoy lo dice en una línea, debajo de
 *      Empezar. La revisión no vuelve a correr, y si core vuelve a la palanca
 *      a mano, el aviso se calla. Hoy no promete la palanca con 3×5 y sí con
 *      3×8 (el control), la ficha dice qué la abre, y al cerrar la sesión el
 *      motor nombra el 3×8 y el aviso se calla.
 *   6. **Saltear el alta también deja la revisión escrita.** Es una
 *      instalación nueva: si se pone en la palanca a mano, no baja.
 *   7. **Con una sesión a medio hacer, la revisión espera**, y corre en el
 *      primer arranque con el borrador ya vencido.
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

// Un vigía para la víspera de Entrenar. Ahí la promesa sale recién en el
// bloque de core, después de anotar todo lo anterior, así que mirar la
// pantalla una vez al entrar no alcanza: si aparece en cualquier momento,
// queda anotado. El paso 4 lo pone en cero antes de empezar.
await p.addInitScript(() => {
  new MutationObserver(() => {
    if (/pasás a elevación de rodillas colgado/i.test(document.body?.textContent ?? '')) {
      sessionStorage.setItem('promesa-colgado', '1')
    }
  }).observe(document, { subtree: true, childList: true, characterData: true })
})
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
  // Con barra, alguien que ya está colgado en las dos cadenas. Apagar el
  // interruptor tiene que bajarlo a lo último que no cuelga: el interruptor
  // dice que el plan no pide nada colgado, y saltear un ejercicio no mueve el
  // plan, así que sin esto se quedaba en las dominadas para siempre.
  await conLaBase(p, ['avances'], async (leer, poner) => {
    const avances = await leer('avances')
    const traccion = avances.find((a) => a.patron === 'traccion')
    const core = avances.find((a) => a.patron === 'core')
    await poner('avances', { ...traccion, ejercicioId: 'dominada-completa', objetivoActual: { series: 3, cantidad: 6 } })
    await poner('avances', { ...core, ejercicioId: 'elevacion-rodillas-colgado', objetivoActual: { series: 3, cantidad: 8 } })
  })

  // Y se vuelve a apagar, que es también lo que necesita la sesión de abajo.
  await p.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  await p.getByRole('button', { name: /Tengo dónde colgarme/ }).click()
  await p.waitForTimeout(300)
  const apagado = await leerTodo(p)
  if (apagado.preferencias?.tieneBarra !== false) {
    fallos.push('Apagar "Tengo dónde colgarme" no guardó tieneBarra = false')
  }
  const donde = Object.fromEntries(apagado.avances.map((a) => [a.patron, a.ejercicioId]))
  notas.push(`Al apagar la barra estando colgado: tracción ${donde.traccion}, core ${donde.core}.`)
  if (donde.traccion !== 'remo-australiano-pies-elevados' || donde.core !== 'elevacion-piernas-suelo') {
    fallos.push(
      `Apagar "Tengo dónde colgarme" dejó a la persona colgada: tracción en ${donde.traccion}, core en ${donde.core}`,
    )
  }
  const hoy = (await textoDeHoy(p)).toLowerCase()
  const enHoy = ['Dominadas completas', 'Elevación de rodillas colgado'].filter((n) =>
    hoy.includes(n.toLowerCase()),
  )
  if (enHoy.length > 0) fallos.push(`Sin barra, Hoy sigue mostrando ${enHoy.join(' y ')}`)

  // El core vuelve a como lo dejó el paso 3, que es lo que mide la sesión.
  await conLaBase(p, ['avances'], async (leer, poner) => {
    const core = (await leer('avances')).find((a) => a.patron === 'core')
    await poner('avances', {
      ...core,
      ejercicioId: 'elevacion-piernas-suelo',
      objetivoActual: { series: 3, cantidad: 12 },
      senal: 1,
      sesionesEnObjetivo: 2,
      graciaRestante: 0,
    })
  })
}

// ── 4. Una sesión entera sin barra ────────────────────────────────────────
// Core sigue en el techo y consolidado, como en el paso 3: sin el cierre,
// Entrenar diría "pasás a elevación de rodillas colgado" en el bloque de core.
// La recarga es de verdad porque la última escritura fue cruda: sin ella,
// `liveQuery` le muestra a Entrenar el avance de antes y el vigía no mide nada.
await p.evaluate(() => sessionStorage.removeItem('promesa-colgado'))
await p.goto('about:blank')
const razon = await completarUnaSesion(p)
if (await p.evaluate(() => sessionStorage.getItem('promesa-colgado'))) {
  fallos.push('Sin barra, Entrenar prometió "pasás a elevación de rodillas colgado": el motor no lo va a hacer')
}
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

// ── 5. La palanca frontal, con 3×8 dominadas; y quien ya estaba, baja una vez ──
{
  const conBarra = await abrir({ fallos })
  const q = conBarra.pagina
  // El mismo vigía que en el paso 1, para la promesa de la palanca.
  await q.addInitScript(() => {
    new MutationObserver(() => {
      if (/pasás a palanca frontal/i.test(document.body?.textContent ?? '')) {
        sessionStorage.setItem('promesa-palanca', '1')
      }
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
  await altaHastaElPlan(q, { barra: true, respuestas: [12, 0, 15, 120] })
  await terminarElAlta(q)

  const recien = (await leerTodo(q)).preferencias?.revisionDeRequisitos
  if (!recien || !Array.isArray(recien.bajadas) || recien.bajadas.length !== 0) {
    fallos.push(`El alta no dejó escrita la revisión de requisitos vacía: ${JSON.stringify(recien)}`)
  }

  /**
   * Abre la app de verdad —que es cuando corre la revisión— y espera a que la
   * revisión quede escrita. La pantalla se lee después: la revisión escribe
   * por Dexie, así que Hoy se entera solo.
   */
  async function abrirLaApp() {
    await q.goto('about:blank')
    await q.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    for (let i = 0; i < 40; i++) {
      if ((await leerTodo(q)).preferencias?.revisionDeRequisitos) break
      await q.waitForTimeout(100)
    }
    await q.waitForTimeout(500)
    const datos = await leerTodo(q)
    const donde = Object.fromEntries(datos.avances.map((a) => [a.patron, a]))
    return { ...datos, donde, texto: await q.locator('body').innerText() }
  }
  const AVISO = 'Bajamos core a elevación de piernas colgado hasta que llegues a 3 series de 8 dominadas completas'

  // a. El control: una instalación de antes con la palanca abierta (3×8 de
  // dominadas completas) no se toca, aunque no tenga la revisión escrita.
  await conLaBase(q, ['avances', 'preferencias'], async (leer, poner) => {
    const [prefe] = await leer('preferencias')
    const { revisionDeRequisitos: _, ...deAntes } = prefe
    await poner('preferencias', {
      ...deAntes,
      semana: { 1: 'fuerza', 2: 'fuerza', 3: 'fuerza', 4: 'fuerza', 5: 'fuerza', 6: 'fuerza', 7: 'fuerza' },
    })
    for (const a of await leer('avances')) {
      if (a.patron === 'traccion') {
        await poner('avances', { ...a, ejercicioId: 'dominada-completa', objetivoActual: { series: 3, cantidad: 8 } })
      }
      if (a.patron === 'core') {
        await poner('avances', { ...a, ejercicioId: 'palanca-frontal-agrupada', objetivoActual: { series: 3, cantidad: 12 } })
      }
    }
  })
  {
    const { donde, preferencias, texto } = await abrirLaApp()
    if (donde.core?.ejercicioId !== 'palanca-frontal-agrupada') {
      fallos.push(`Con 3×8 dominadas la palanca está abierta, y la revisión movió core a "${donde.core?.ejercicioId}"`)
    }
    const r = preferencias?.revisionDeRequisitos
    if (!r || r.bajadas?.length !== 0) fallos.push(`Con la palanca abierta, la revisión anotó: ${JSON.stringify(r)}`)
    if (texto.includes('Bajamos core') || (await q.locator('[data-prueba="aviso-de-bajada"]').count()) > 0) {
      fallos.push('Con la palanca abierta, Hoy igual avisa una bajada')
    }
  }

  // b. La instalación de antes con 3×5: con la regla vieja la palanca estaba
  // abierta, con la nueva no. Baja una vez, y Hoy dice por qué.
  await conLaBase(q, ['avances', 'preferencias'], async (leer, poner) => {
    const [prefe] = await leer('preferencias')
    const { revisionDeRequisitos: _, ...deAntes } = prefe
    await poner('preferencias', deAntes)
    for (const a of await leer('avances')) {
      if (a.patron === 'traccion') {
        await poner('avances', { ...a, ejercicioId: 'dominada-completa', objetivoActual: { series: 3, cantidad: 5 } })
      }
      if (a.patron === 'core') {
        await poner('avances', { ...a, ejercicioId: 'palanca-frontal-agrupada', objetivoActual: { series: 3, cantidad: 12 } })
      }
    }
  })
  {
    const { donde, preferencias, texto } = await abrirLaApp()
    notas.push(`En la palanca con 3×5 dominadas, al abrir la app: core ${donde.core?.ejercicioId} ${donde.core?.objetivoActual?.series}×${donde.core?.objetivoActual?.cantidad}.`)
    if (donde.core?.ejercicioId !== 'elevacion-piernas-colgado') {
      fallos.push(`Con 3×5 dominadas, la revisión dejó core en "${donde.core?.ejercicioId}" y no en la elevación de piernas colgado`)
    }
    if (donde.traccion?.ejercicioId !== 'dominada-completa' || donde.traccion?.objetivoActual?.cantidad !== 5) {
      fallos.push('La revisión tocó la tracción, que solo tenía que mirar')
    }
    const bajadas = preferencias?.revisionDeRequisitos?.bajadas ?? []
    if (
      bajadas.length !== 1 ||
      bajadas[0].desde !== 'palanca-frontal-agrupada' ||
      bajadas[0].hasta !== 'elevacion-piernas-colgado'
    ) {
      fallos.push(`La revisión no anotó la bajada como corresponde: ${JSON.stringify(bajadas)}`)
    }
    if (!texto.includes(AVISO)) {
      fallos.push('Hoy no dice por qué bajó el core')
    } else {
      const linea = (await q.locator('[data-prueba="aviso-de-bajada"]').allInnerTexts())[0] ?? ''
      notas.push(`Hoy dice: "${linea}"`)
      const aviso = await q.locator('[data-prueba="aviso-de-bajada"]').first().boundingBox()
      const empezar = await q.getByRole('button', { name: 'Empezar', exact: true }).boundingBox()
      if (!aviso || !empezar || aviso.y < empezar.y) {
        fallos.push('El aviso de la bajada va arriba de Empezar: rompe la regla del pliegue')
      }
    }
    const filas = await q.locator('[data-prueba="plan-de-hoy"] .nombre').allInnerTexts()
    if (filas.some((f) => /Palanca frontal/.test(f))) fallos.push(`Después de bajar, Hoy sigue mostrando la palanca: ${filas.join(' · ')}`)

    // La ficha dice qué la abre, con el mismo número.
    await q.goto(`${BASE}/#/biblioteca/palanca-frontal-agrupada`, { waitUntil: 'networkidle' })
    await q.waitForTimeout(500)
    const ficha = await q.locator('body').innerText()
    if (!ficha.includes('Se abre cuando llegues a 3 series de 8 dominadas completas.')) {
      fallos.push('La ficha de la palanca frontal agrupada no dice qué la abre')
    }
  }

  // c. Una sola vez: con la revisión ya escrita, alguien que vuelve a la
  // palanca —a mano, desde la ficha— no baja de nuevo al abrir la app. Y Hoy
  // ya no le dice "Bajamos core a elevación de piernas colgado": no es donde
  // está, y la línea contradiría al plan que tiene justo arriba.
  await conLaBase(q, ['avances'], async (leer, poner) => {
    const core = (await leer('avances')).find((a) => a.patron === 'core')
    await poner('avances', { ...core, ejercicioId: 'palanca-frontal-agrupada', objetivoActual: { series: 3, cantidad: 12 } })
  })
  {
    const { donde, texto } = await abrirLaApp()
    if (donde.core?.ejercicioId !== 'palanca-frontal-agrupada') {
      fallos.push(`La revisión volvió a correr: bajó core a "${donde.core?.ejercicioId}" con la revisión ya escrita`)
    }
    if (texto.includes('Bajamos core') || (await q.locator('[data-prueba="aviso-de-bajada"]').count()) > 0) {
      fallos.push('Con core de vuelta en la palanca, Hoy sigue diciendo que lo bajamos a la elevación de piernas colgado')
    }
  }

  // d. Hoy no promete la palanca con 3×5, y sí con 3×8 (el control). Core en
  // el techo de la elevación colgado y consolidado: sin el requisito, cumplir
  // hoy lo pasaría a la palanca.
  await conLaBase(q, ['avances'], async (leer, poner) => {
    const core = (await leer('avances')).find((a) => a.patron === 'core')
    await poner('avances', {
      ...core,
      ejercicioId: 'elevacion-piernas-colgado',
      objetivoActual: { series: 3, cantidad: 10 },
      senal: 1,
      sesionesEnObjetivo: 2,
      graciaRestante: 0,
    })
  })
  const PROMESA_PALANCA = /pasás a palanca frontal agrupada/
  if (PROMESA_PALANCA.test((await abrirLaApp()).texto)) {
    fallos.push('Con 3×5 dominadas, Hoy promete "pasás a palanca frontal agrupada": el motor no lo va a hacer')
  }
  await conLaBase(q, ['avances'], async (leer, poner) => {
    const t = (await leer('avances')).find((a) => a.patron === 'traccion')
    await poner('avances', { ...t, objetivoActual: { series: 3, cantidad: 8 } })
  })
  if (!PROMESA_PALANCA.test((await abrirLaApp()).texto)) {
    fallos.push('Con 3×8 dominadas, Hoy no anuncia la palanca: el control falló, y el chequeo de arriba no prueba nada')
  }
  await conLaBase(q, ['avances'], async (leer, poner) => {
    const t = (await leer('avances')).find((a) => a.patron === 'traccion')
    await poner('avances', { ...t, objetivoActual: { series: 3, cantidad: 5 } })
  })

  // e. Una sesión entera con 3×5: el motor no abre la palanca y nombra el
  // 3×8; Entrenar no la promete; y después el aviso de Hoy se calla.
  await q.goto('about:blank')
  await q.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await q.evaluate(() => sessionStorage.removeItem('promesa-palanca'))
  await q.goto('about:blank')
  const razon5 = await completarUnaSesion(q)
  if (await q.evaluate(() => sessionStorage.getItem('promesa-palanca'))) {
    fallos.push('Con 3×5 dominadas, Entrenar prometió el paso a la palanca frontal')
  }
  if (razon5) {
    fallos.push(`La sesión con barra no se pudo completar: ${razon5}`)
  } else {
    const { donde, sesiones, texto } = await abrirLaApp()
    if (donde.core?.ejercicioId !== 'elevacion-piernas-colgado') {
      fallos.push(`Con 3×5 dominadas, el motor movió core a "${donde.core?.ejercicioId}"`)
    }
    const decision = sesiones.at(-1)?.decisiones?.find((d) => d.patron === 'core')
    notas.push(`Lo que dijo el motor con 3×5 dominadas: "${decision?.explicacion}"`)
    if (!/se abre cuando llegues a 3 series de 8 dominadas completas/.test(decision?.explicacion ?? '')) {
      fallos.push(`El motor no nombra las 3 series de 8: "${decision?.explicacion}"`)
    }
    if (texto.includes('Bajamos core') || (await q.locator('[data-prueba="aviso-de-bajada"]').count()) > 0) {
      fallos.push('Después de entrenar, Hoy sigue avisando la bajada: tenía que callarse')
    }
  }

  await conBarra.navegador.close()
}

// ── 6. "Prefiero arrancar desde cero" también deja la revisión escrita ─────
{
  const desdeCero = await abrir({ fallos })
  const r = desdeCero.pagina
  await r.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await r.waitForTimeout(400)
  await r.getByRole('button', { name: 'Prefiero arrancar desde cero', exact: true }).click()
  await r.waitForTimeout(700)
  const revision = (await leerTodo(r)).preferencias?.revisionDeRequisitos
  if (!revision || !Array.isArray(revision.bajadas) || revision.bajadas.length !== 0) {
    fallos.push(`Saltear el alta no dejó escrita la revisión vacía: ${JSON.stringify(revision)}`)
  }
  // Y por eso, quien es nueva y se pone en la palanca a mano antes de volver
  // a abrir la app no baja: la regla vieja nunca la tocó.
  await conLaBase(r, ['avances'], async (_leer, poner) => {
    await poner('avances', {
      patron: 'core',
      ejercicioId: 'palanca-frontal-agrupada',
      objetivoActual: { series: 3, cantidad: 8 },
      senal: 1,
      sesionesEnObjetivo: 0,
      graciaRestante: 0,
      actualizadoEn: Date.now(),
    })
  })
  await r.goto('about:blank')
  await r.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await r.waitForTimeout(1200)
  const despues = await leerTodo(r)
  const core = despues.avances.find((a) => a.patron === 'core')
  if (core?.ejercicioId !== 'palanca-frontal-agrupada') {
    fallos.push(`Después de saltear el alta, la revisión corrió igual y bajó core a "${core?.ejercicioId}"`)
  }
  if ((await r.locator('[data-prueba="aviso-de-bajada"]').count()) > 0) {
    fallos.push('Después de saltear el alta, Hoy avisa una bajada que la regla vieja nunca hizo')
  }

  // ── 7. Con una sesión a medio hacer, la revisión espera ──────────────────
  // La misma base hecha pasar por una de antes: sin revisión, 3×5 dominadas y
  // core en la palanca. Con un borrador vigente no se toca nada —cambiar el
  // core en medio de la sesión dejaría huérfanas las series anotadas—; con
  // uno vencido, baja.
  const reabrir = async () => {
    await r.goto('about:blank')
    await r.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await r.waitForTimeout(1200)
    const datos = await leerTodo(r)
    return { ...datos, core: datos.avances.find((a) => a.patron === 'core') }
  }
  await conLaBase(r, ['avances', 'preferencias', 'curso'], async (leer, poner) => {
    const [prefe] = await leer('preferencias')
    const { revisionDeRequisitos: _, ...deAntes } = prefe
    await poner('preferencias', deAntes)
    await poner('avances', {
      patron: 'traccion',
      ejercicioId: 'dominada-completa',
      objetivoActual: { series: 3, cantidad: 5 },
      senal: 1,
      sesionesEnObjetivo: 0,
      graciaRestante: 0,
      actualizadoEn: Date.now(),
    })
    await poner('curso', { id: 'actual', actualizadoEn: Date.now() })
  })
  {
    const { core, preferencias } = await reabrir()
    if (core?.ejercicioId !== 'palanca-frontal-agrupada') {
      fallos.push(`Con una sesión a medio hacer, la revisión movió core a "${core?.ejercicioId}"`)
    }
    if (preferencias?.revisionDeRequisitos) {
      fallos.push('Con una sesión a medio hacer, la revisión se dio por hecha sin haber mirado nada')
    }
  }
  await conLaBase(r, ['curso'], async (_leer, poner) => {
    await poner('curso', { id: 'actual', actualizadoEn: Date.now() - 7 * 60 * 60 * 1000 })
  })
  {
    const { core, preferencias } = await reabrir()
    if (core?.ejercicioId !== 'elevacion-piernas-colgado') {
      fallos.push(`Con el borrador vencido, la revisión no bajó core: quedó en "${core?.ejercicioId}"`)
    }
    if (preferencias?.revisionDeRequisitos?.bajadas?.length !== 1) {
      fallos.push(`Con el borrador vencido, la revisión anotó: ${JSON.stringify(preferencias?.revisionDeRequisitos)}`)
    }
  }
  await desdeCero.navegador.close()
}

for (const n of notas) console.log(n)

if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}

console.log('\nSin barra no hay nada colgado, la palanca no se abre desde el alta ni sin 3×8 dominadas, quien ya estaba baja una sola vez y se le dice por qué, y ni Hoy ni Entrenar prometen lo que el motor no hace.')
