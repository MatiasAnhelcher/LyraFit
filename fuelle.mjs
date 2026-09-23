/**
 * ¿El fuelle le cuesta fuerza a alguien?
 *
 * Es la única pregunta que importa de todo lo metabólico, y ni los tests ni la
 * revisión visual pueden contestarla. Los tests de `metabolico.test.ts`
 * verifican la aritmética —que la ráfaga salga de lo que sobra por encima del
 * piso y que no cargue el patrón que viene— pero la aritmética correcta puede
 * llegar mal a la pantalla: alcanza con que el descanso arranque después de la
 * ráfaga en vez de contenerla para que el piso de recuperación desaparezca sin
 * que ninguna desigualdad se entere.
 *
 * Así que esto mide en la app compilada tres cosas que solo existen ahí:
 *
 * 1. **Que el piso llegue entero a la pantalla.** Se anota una serie, se espera
 *    a que termine el tramo de ráfaga y se lee el reloj: lo que queda tiene que
 *    ser descanso de verdad, y no menos de sesenta segundos.
 *
 * 2. **Que el fuelle quede escrito y aparte.** La sesión guardada tiene que
 *    tener `rafagas` y `densa`, y ninguna ráfaga puede haberse colado entre los
 *    `registros`, que es de donde lee el motor.
 *
 * 3. **Que el día de fuelle no mueva el plan.** Se leen los avances, se hace un
 *    día de fuelle entero y se vuelven a leer: tienen que ser idénticos, byte
 *    por byte. Es la propiedad que justifica que exista el tipo de sesión, y la
 *    única forma de comprobarla es contra la base real.
 *
 * Uso: npm run build && npm run preview &  →  node fuelle.mjs
 */

import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'

const BASE = 'http://localhost:4173'
const fallos = []

/** Que lo que se está revisando sea lo que está en disco. Ver `rescate.mjs`. */
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

// ── El alta, que es el portero ─────────────────────────────────────────────
await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
await p.waitForTimeout(400)
await p.getByRole('button', { name: 'Empezar', exact: true }).click()
await p.getByRole('button', { name: 'Sí, tengo barra' }).click()
await p.getByRole('button', { name: '12', exact: true }).click()
await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
await p.waitForTimeout(150)
for (let i = 0; i < 3; i++) {
  for (let n = 0; n < 6; n++) await p.getByRole('button', { name: 'Sumar' }).click()
  const plan = p.getByRole('button', { name: 'Ver mi plan' })
  if (await plan.isVisible().catch(() => false)) await plan.click()
  else await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await p.waitForTimeout(120)
}
await p.getByRole('button', { name: 'Seguir', exact: true }).click()
await p.waitForTimeout(250)
await p.getByRole('button', { name: /Cuerpo completo/ }).click()
await p.waitForTimeout(600)

/**
 * Leer y escribir la base por atrás de Dexie.
 *
 * Igual que en `revisar.mjs`: una escritura cruda NO dispara la invalidación de
 * `liveQuery`, así que después de tocar la base hay que recargar de verdad, no
 * navegar por hash. Y se espera el `oncomplete` de la transacción, no el
 * `onsuccess` del pedido: entre uno y otro la escritura todavía no está.
 */
const conLaBase = (tablas, fn, arg) =>
  p.evaluate(
    async ([tablas, codigo, arg]) => {
      const base = await new Promise((res, rej) => {
        const r = indexedDB.open('lyrafit')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const leer = (tabla) =>
        new Promise((res, rej) => {
          const q = base.transaction(tabla).objectStore(tabla).getAll()
          q.onsuccess = () => res(q.result)
          q.onerror = () => rej(q.error)
        })
      const poner = (tabla, valor) =>
        new Promise((res, rej) => {
          const tx = base.transaction(tabla, 'readwrite')
          tx.objectStore(tabla).put(valor)
          tx.oncomplete = () => res()
          tx.onerror = () => rej(tx.error)
          tx.onabort = () => rej(tx.error)
        })
      // eslint-disable-next-line no-new-func
      const salida = await new Function(
        'leer',
        'poner',
        'arg',
        `return (${codigo})(leer, poner, arg)`,
      )(leer, poner, arg)
      base.close()
      return salida
    },
    [tablas, fn.toString(), arg],
  )

// ── (0) El ofrecimiento de Hoy: se hace una vez y no vuelve ───────────────
//
// El fuelle se publicó apagado, así que la app se veía idéntica y quien lo
// había pedido no lo encontró. La fila de Hoy es la respuesta, y su contrato
// tiene dos mitades: que aparezca cuando nunca se preguntó, y que NO vuelva
// después de cualquiera de las dos respuestas. La segunda es la que se olvida,
// y la que dejaría a alguien viendo el mismo ofrecimiento para siempre.

const ofrecimiento = () => p.getByText('El fuelle', { exact: true })

// El marcador de "ya se preguntó" se mudó de `densidad` a `semana` cuando el
// fuelle pasó a ser del día. `densidad` ahora dice cuán fuerte y no en qué
// días, así que "Ahora no" no tendría dónde escribirse: los dos botones
// escriben la semana entera, y con eso la fila no vuelve nunca más.
const semanaGuardada = () =>
  conLaBase(['preferencias'], async (leer) => (await leer('preferencias'))[0]?.semana ?? null)
const diasConFuelle = (semana) =>
  Object.values(semana ?? {}).filter((c) => c === 'fuelle' || c === 'ambos').length
const olvidarLaRespuesta = () =>
  conLaBase(['preferencias'], async (leer, poner) => {
    const [prefe] = await leer('preferencias')
    const { semana: _, ...sinSemana } = prefe
    await poner('preferencias', sinSemana)
  })
const volverAHoy = async () => {
  // Recarga de verdad y no navegación de hash: la escritura fue cruda y
  // `liveQuery` no se entera. Es el error que hizo fallar `revisar.mjs` una de
  // cada dos corridas sin que hubiera nada roto en la app.
  await p.goto('about:blank')
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
}

if (!(await ofrecimiento().isVisible().catch(() => false))) {
  fallos.push('En una instalación nueva, Hoy no ofrece el fuelle')
} else {
  if ((await semanaGuardada()) !== null) {
    fallos.push('La semana ya estaba escrita antes de contestar el ofrecimiento')
  }

  await p.getByRole('button', { name: 'Probarlo', exact: true }).click()
  await p.waitForTimeout(500)
  const tras = await semanaGuardada()
  if (diasConFuelle(tras) === 0) {
    fallos.push(`"Probarlo" no dejó ningún día con fuelle: ${JSON.stringify(tras)}`)
  }
  // Y no puede agregar días: probar algo nuevo no cuesta un día más de la
  // semana de nadie.
  const entrenaTras = Object.values(tras ?? {}).filter((c) => c !== 'descanso').length
  if (entrenaTras !== 3) {
    fallos.push(`"Probarlo" cambió la cantidad de días de 3 a ${entrenaTras}`)
  }

  await volverAHoy()
  if (await ofrecimiento().isVisible().catch(() => false)) {
    fallos.push('Después de aceptar, el ofrecimiento sigue ahí')
  }

  // La otra mitad: decir que no también cierra la pregunta.
  await olvidarLaRespuesta()
  await volverAHoy()
  if (!(await ofrecimiento().isVisible().catch(() => false))) {
    fallos.push('Olvidada la respuesta, el ofrecimiento no volvió')
  } else {
    await p.getByRole('button', { name: 'Ahora no', exact: true }).click()
    await p.waitForTimeout(500)
    const negado = await semanaGuardada()
    if (negado === null) {
      fallos.push('"Ahora no" no dejó escrita la semana, así que el ofrecimiento va a volver')
    } else if (diasConFuelle(negado) !== 0) {
      fallos.push(`"Ahora no" dejó ${diasConFuelle(negado)} días con fuelle: tenía que no cambiar nada`)
    }
    await volverAHoy()
    if (await ofrecimiento().isVisible().catch(() => false)) {
      fallos.push('Después de decir que no, el ofrecimiento vuelve igual')
    } else {
      console.log('El fuelle se ofrece una vez en Hoy y no vuelve, se acepte o se rechace.')
    }
  }
}

// ── Encender el fuelle y ponerse en un eslabón con descanso largo ──────────
//
// Sin esto la revisión sería vacía: con los descansos cortos de los primeros
// eslabones no entra ninguna ráfaga —que es justamente lo que tiene que pasar—
// y el guion pasaría en verde sin haber mirado una sola.
const puestos = await conLaBase(['preferencias', 'avances'], async (leer, poner) => {
  const [prefe] = await leer('preferencias')
  await poner('preferencias', {
    ...prefe,
    densidad: 'fuerte',
    puedeSaltar: true,
    tieneEscalon: true,
    // La densidad ya no decide QUÉ días llevan fuelle: eso lo dice la semana.
    // Así que para una sesión densa hay que marcar los días como `ambos`, que
    // es fuerza CON fuelle. Los siete, para que el recorrido no dependa de qué
    // día de la semana se corra el portón.
    semana: { 1: 'ambos', 2: 'ambos', 3: 'ambos', 4: 'ambos', 5: 'ambos', 6: 'ambos', 7: 'ambos' },
  })
  const avances = await leer('avances')
  // Eslabones con descanso de 150 s en las cuatro cadenas: ahí la ráfaga dura
  // cuarenta y cinco segundos y quedan ciento cinco de descanso verdadero.
  const largos = {
    empuje: 'flexion-pseudoplancha',
    traccion: 'dominada-completa',
    piernas: 'sentadilla-bulgara',
    core: 'elevacion-piernas-colgado',
  }
  for (const avance of avances) {
    const id = largos[avance.patron]
    if (!id) continue
    await poner('avances', { ...avance, ejercicioId: id, objetivoActual: { series: 3, cantidad: 5 } })
  }
  return (await leer('avances')).map((a) => `${a.patron}:${a.ejercicioId}`)
})

// Recarga de verdad: la escritura fue cruda y `liveQuery` no se enteró.
await p.goto('about:blank')
await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
await p.waitForTimeout(700)

const rotulo = async () => (await p.locator('.rotulo').allInnerTexts()).join(' | ')
const reloj = async () => {
  const t = await p.locator('main p.cifra.text-5xl').innerText()
  const [m, s] = t.split(':').map(Number)
  return m * 60 + s
}
const anotar = async () => {
  const voy = p.getByRole('button', { name: 'Voy', exact: true })
  if (await voy.isVisible().catch(() => false)) {
    await voy.click()
    await p.waitForTimeout(120)
  }
  await p.getByRole('button', { name: 'Anotar serie', exact: true }).click()
  await p.waitForTimeout(250)
}

// ── (1) El piso de recuperación, en la pantalla ────────────────────────────
await anotar()

const primerRotulo = await rotulo()
if (!primerRotulo.includes('RÁFAGA')) {
  fallos.push(
    `Con el fuelle en fuerte y un descanso de 150 s no apareció ninguna ráfaga (rótulo: "${primerRotulo}"). Avances: ${puestos.join(', ')}`,
  )
} else {
  const alEmpezar = await reloj()
  // `.first()` no es cosmético: sin él, el día que otra cosa de esta pantalla
  // use `text-lg` el locator machea dos elementos y Playwright revienta por
  // modo estricto, o sea que el portón falla por un motivo que no es el que
  // está midiendo.
  const nombre = await p.locator('main section p.text-lg').first().innerText()

  // Esperar a que el tramo de ráfaga termine solo. Son cuarenta y cinco
  // segundos reales y no hay forma de acelerarlos: el arco representa tiempo
  // real, que es exactamente lo que se está midiendo.
  await p
    .locator('section .rotulo', { hasText: 'DESCANSO' })
    .waitFor({ timeout: 90_000 })
    .catch(() => {})

  const trasLaRafaga = await rotulo()
  const quedan = await reloj()

  if (!trasLaRafaga.includes('DESCANSO')) {
    fallos.push(`La ráfaga no dio paso al descanso (rótulo: "${trasLaRafaga}")`)
  }
  if (quedan < 60) {
    fallos.push(
      `Terminada la ráfaga quedan ${quedan} s de descanso: el piso de recuperación son 60.`,
    )
  }
  console.log(
    `La ráfaga entra adentro del descanso y no lo recorta: "${nombre}", ${alEmpezar} s totales, ${quedan} s de descanso verdadero después.`,
  )
}

// ── (2) El fuelle queda escrito, y aparte de los registros ────────────────
const saltear = async () => {
  const b = p.getByRole('button', { name: 'Saltear', exact: true })
  if (await b.isVisible().catch(() => false)) {
    await b.click()
    await p.waitForTimeout(200)
  }
}

// Caminar la sesión entera hasta que aparezca el bloque de fuelle. El plan de
// una sesión densa tiene el doble de entradas —cada cadena trae su bajada— así
// que el recorrido no puede asumir cuántos ejercicios son: avanza mientras haya
// algo que anotar, con un tope por si algo se traba.
for (let vuelta = 0; vuelta < 80; vuelta++) {
  if ((await rotulo()).includes('EL FUELLE')) break
  const anotarVisible = await p
    .getByRole('button', { name: /Anotar serie|Voy/ })
    .isVisible()
    .catch(() => false)
  if (anotarVisible) {
    await anotar()
    await saltear()
    continue
  }
  const siguiente = p.getByRole('button', { name: /Siguiente ejercicio|Terminar$/ })
  if (await siguiente.isVisible().catch(() => false)) {
    await siguiente.click()
    await p.waitForTimeout(300)
    continue
  }
  await saltear()
}

const enElFuelle = (await rotulo()).includes('EL FUELLE')
if (!enElFuelle) {
  fallos.push(`Terminadas las series no apareció el bloque de fuelle (rótulo: "${await rotulo()}")`)
} else {
  // Una vuelta entera del bloque, para que quede al menos una ráfaga anotada
  // desde acá y no solo desde los descansos.
  await p.waitForTimeout(42_000)
  await p.getByRole('button', { name: 'Cortar el fuelle' }).click()
  await p.waitForTimeout(400)
}

// La serie de cierre va DESPUÉS del fuelle: es lo que hace que la sesión no
// termine en el punto más duro. Si el orden se invirtiera, esto lo dice.
const hayCierre = await p
  .getByRole('button', { name: /Saltear/ })
  .isVisible()
  .catch(() => false)
if (!hayCierre) fallos.push('Después del fuelle no apareció la serie de cierre')
await p.getByRole('button', { name: /Saltear/ }).click().catch(() => {})
await p.waitForTimeout(300)

// Las preguntas del final, y a guardar.
const contestarYCerrar = async () => {
  for (const etiqueta of ['Exigente', 'Bien', 'Normal']) {
    const b = p.getByRole('button', { name: etiqueta, exact: true }).first()
    if (await b.isVisible().catch(() => false)) {
      await b.click()
      await p.waitForTimeout(150)
    }
  }
  await p.getByRole('button', { name: 'Cerrar la sesión' }).click()
  await p.waitForTimeout(1500)
}
await contestarYCerrar()

const densa = await conLaBase(['sesiones'], async (leer) => {
  const sesiones = await leer('sesiones')
  const ultima = sesiones.sort((a, b) => b.finalizadaEn - a.finalizadaEn)[0]
  if (!ultima) return null
  return {
    tipo: ultima.tipo,
    densa: ultima.densa === true,
    rafagas: (ultima.rafagas ?? []).length,
    idsDeRafaga: [...new Set((ultima.rafagas ?? []).map((r) => r.rafagaId))],
    idsDeRegistro: ultima.registros.map((r) => r.ejercicioId),
    bajadas: ultima.registros.filter((r) => r.bajada).length,
    duros: ultima.registros.filter((r) => !r.bajada).length,
    // Lo que el motor decidió esa noche, guardado con la sesión. Una decisión
    // por cadena entrenada: si hubiera ocho, la bajada estaría moviendo el plan.
    decisiones: (ultima.decisiones ?? []).map((d) => d.patron),
  }
})

if (!densa) {
  fallos.push('No quedó ninguna sesión guardada')
} else {
  if (!densa.densa) fallos.push('La sesión densa no quedó marcada como densa')
  if (densa.rafagas === 0) fallos.push('La sesión densa no guardó ninguna ráfaga')
  const coladas = densa.idsDeRegistro.filter((id) => densa.idsDeRafaga.includes(id))
  if (coladas.length > 0) {
    fallos.push(`Una ráfaga se coló entre los registros de ejercicio: ${coladas.join(', ')}`)
  }
  if (densa.bajadas === 0) {
    fallos.push('La sesión densa no registró ninguna bajada')
  }
  // La comprobación que de verdad cierra el caso: el motor decidió una vez por
  // cadena entrenada, no una por registro. Si la bajada moviera el plan, acá
  // habría el doble de decisiones y las cadenas aparecerían repetidas.
  const repetidas = densa.decisiones.filter((patron, i) => densa.decisiones.indexOf(patron) !== i)
  if (repetidas.length > 0) {
    fallos.push(`El motor decidió dos veces sobre la misma cadena: ${repetidas.join(', ')}`)
  }
  if (densa.decisiones.length > densa.duros) {
    fallos.push(
      `El motor tomó ${densa.decisiones.length} decisiones para ${densa.duros} ejercicios medidos`,
    )
  }
  console.log(
    `La sesión guardó ${densa.rafagas} ráfagas y ${densa.bajadas} bajadas; el motor decidió ${densa.decisiones.length} veces, una por cadena (${densa.decisiones.join(', ')}).`,
  )
}

// ── (3) El día de fuelle no mueve el plan ─────────────────────────────────
const antes = await conLaBase(['avances'], async (leer) =>
  JSON.stringify(
    (await leer('avances'))
      .map(({ actualizadoEn: _, ...resto }) => resto)
      .sort((a, b) => a.patron.localeCompare(b.patron)),
  ),
)

await p.goto('about:blank')
await p.goto(`${BASE}/#/entrenar?fuelle=1`, { waitUntil: 'networkidle' })
await p.waitForTimeout(800)

const abrioEnFuelle = (await rotulo()).includes('EL FUELLE')
if (!abrioEnFuelle) {
  fallos.push(`El día de fuelle no abrió en el bloque (rótulo: "${await rotulo()}")`)
}

await p.getByRole('button', { name: 'Cortar el fuelle' }).click().catch(() => {})
await p.waitForTimeout(400)
await contestarYCerrar()

const despues = await conLaBase(['avances'], async (leer) =>
  JSON.stringify(
    (await leer('avances'))
      .map(({ actualizadoEn: _, ...resto }) => resto)
      .sort((a, b) => a.patron.localeCompare(b.patron)),
  ),
)

const tipoDelDia = await conLaBase(['sesiones'], async (leer) => {
  const sesiones = await leer('sesiones')
  return sesiones.sort((a, b) => b.finalizadaEn - a.finalizadaEn)[0]?.tipo ?? null
})

if (tipoDelDia !== 'fuelle') {
  fallos.push(`El día de fuelle se guardó como "${tipoDelDia}" en vez de "fuelle"`)
}
if (antes !== despues) {
  fallos.push('Un día de fuelle movió los avances. No puede tocar el plan.')
} else {
  console.log('Un día de fuelle entero deja todos los avances exactamente como estaban.')
}

await navegador.close()

if (fallos.length > 0) {
  console.log('\nProblemas:')
  for (const f of fallos) console.log(`  · ${f}`)
  process.exit(1)
}
console.log('\nEl fuelle transpira sin cobrarle fuerza a nadie.')
