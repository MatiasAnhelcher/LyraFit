/**
 * Tres sesiones en un día: cada cadena se lee una vez.
 *
 * Los tests de dominio prueban la regla con `leerLaSesion` (en
 * `progresion.test.ts` y `simulacion.test.ts`). Esto la prueba con la app de
 * verdad, tocando la interfaz de hoy y con el reloj del navegador fijo, en un
 * miércoles de alguien con Cuerpo completo:
 *
 *   1. **El plan a las 9:10.** Lee las cadenas de la sesión.
 *   2. **Un tabata del Reloj a las 13:30.** No lee ninguna: la sesión queda sin
 *      decisiones y los avances no se tocan.
 *   3. **El plan otra vez a las 19:05.** Las cadenas ya se leyeron a la
 *      mañana, así que sus avances quedan IDÉNTICOS byte por byte a los de las
 *      9:10, `actualizadoEn` incluido, y las decisiones de la tercera son
 *      neutras, con `motivo: 'ya-leida-hoy'` y `leidaA` en la hora de la
 *      primera. El Cierre lo dice con la hora, "ya se leyeron hoy a las
 *      9:10", y ya no dice "Como no completaste…".
 *   4. **ÚLTIMOS 28 DÍAS cuenta un día**, no tres.
 *   5. **Ningún texto recorrido dice algo de `PROHIBIDAS`** (`lib/palabras.mjs`).
 *   6. **La energía del chequeo es la de antes solo en la primera.** Con el
 *      chequeo de las 9:00, la sesión de las 9:10 guarda `vitalidadPre` y la
 *      de las 19:05 no: a esa hora, la energía de la mañana ya no es la de antes.
 *
 * El reloj fijo es lo que hace que la hora sea la del enunciado: con
 * `setFixedTime` la sesión entera cierra a las 9:10 en punto. El tabata, en
 * cambio, cuenta con `Date.now()`, así que ahí el reloj se corre a mano, de a
 * cinco segundos, hasta el final: los cuatro minutos pasan en unos quince.
 *
 * Corre a 360×640 y a 320×640, cada uno con su base limpia.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después
 * `node tres-sesiones.mjs`. Con otro puerto: `BASE=http://localhost:4184 node tres-sesiones.mjs`.
 */

import {
  BASE,
  abrir,
  alta,
  completarUnaSesion,
  conLaBase,
  revisarQueSirvaLoCompilado,
} from './lib/portones.mjs'
import { loProhibido } from './lib/palabras.mjs'

await revisarQueSirvaLoCompilado(BASE)

/** Un miércoles: Cuerpo completo entrena lunes, miércoles y viernes. */
const DIA = '2026-10-21'
/** Esa hora de ese día en Buenos Aires, la zona que fija `abrir`. */
const aLas = (hora) => new Date(`${DIA}T${hora}:00-03:00`)

const fallos = []
const notas = []

/**
 * Un tabata del Reloj, entrando por Cadenas como hoy, con un ejercicio.
 *
 * La vuelta 8 se cuenta en el final, que es lo que hace que se guarde: un
 * reloj sin ninguna vuelta contada no deja nada que anotar.
 *
 * @returns {Promise<string|null>} null si quedó guardado; si no, la razón.
 */
async function unTabata(p, desde, sinProhibidas) {
  await p.goto(`${BASE}/#/biblioteca`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  await sinProhibidas('Cadenas, a las 13:30')
  const entrada = p.getByText('El reloj', { exact: true })
  if (!(await entrada.isVisible().catch(() => false))) return 'no se llega al Reloj desde Cadenas'
  await entrada.click()
  await p.waitForTimeout(600)
  await p.getByRole('button', { name: /Flexiones/ }).first().click()
  await p.waitForTimeout(150)
  await sinProhibidas('La configuración del Reloj')
  const empezar = p.getByRole('button', { name: 'Empezar', exact: true })
  if (!(await empezar.isEnabled().catch(() => false))) return 'con un ejercicio elegido, "Empezar" sigue inerte'
  await empezar.click()

  const termino = () => p.getByText('TERMINASTE').isVisible().catch(() => false)
  // El temporizador pregunta la hora cuatro veces por segundo: cada paso
  // espera más que eso, para que ningún tramo se saltee sin dibujarse.
  let ahora = desde.getTime()
  for (let paso = 0; paso < 120 && !(await termino()); paso++) {
    ahora += 5000
    await p.clock.setFixedTime(ahora)
    await p.waitForTimeout(300)
    await sinProhibidas('El tabata en marcha')
  }
  if (!(await termino())) return 'el tabata no llegó a TERMINASTE'

  const ultima = p.getByText('¿Cuántas en la vuelta 8?')
  if (!(await ultima.isVisible().catch(() => false))) return 'el final no pide la vuelta 8'
  await sinProhibidas('El final del tabata')
  await p.getByRole('button', { name: 'Sumar' }).click()
  await p.waitForTimeout(200)
  await p.getByRole('button', { name: 'Listo', exact: true }).click()
  await p.waitForTimeout(1500)
  await sinProhibidas('Después de guardar el tabata')
  return null
}

const leerAvances = (p) =>
  conLaBase(p, ['avances'], async (leer) => JSON.stringify(await leer('avances')))
const leerSesiones = (p) =>
  conLaBase(p, ['sesiones'], async (leer) =>
    (await leer('sesiones')).sort((a, b) => a.finalizadaEn - b.finalizadaEn),
  )

for (const viewport of [
  { width: 360, height: 640 },
  { width: 320, height: 640 },
]) {
  const donde = `${viewport.width}×${viewport.height}`
  const { navegador, pagina: p } = await abrir({ viewport, fallos })
  const texto = async () => p.locator('body').innerText()
  /** Lo que dice la pantalla de ahora, contra la lista de lo que no se dice nunca. */
  const sinProhibidas = async (pantalla) => {
    const dicho = loProhibido(await texto())
    if (dicho) fallos.push(`[${donde}] ${pantalla} dice "${dicho}", que la app no dice nunca.`)
  }

  try {
    await p.clock.setFixedTime(aLas('09:00'))
    await alta(p, { enCadaPaso: (paso) => sinProhibidas(`El alta (${paso})`) })
    // El chequeo de la mañana, solo con la energía: es el dato de `vitalidadPre`.
    await conLaBase(p, ['estados'], `async (leer, poner) => {
      poner('estados', { fecha: '${DIA}', energia: 4, actualizadoEn: ${aLas('09:00').getTime()} })
    }`)
    await p.reload({ waitUntil: 'networkidle' })

    // ── 1. El plan a las 9:10 ──────────────────────────────────────────────
    /** Cada pantalla de Entrenar, el descanso, la serie de cierre y las preguntas, a esa hora. */
    const mirandoTodo = (hora) => ({
      alEmpezar: () => sinProhibidas(`Entrenar a las ${hora}`),
      enCadaVuelta: (vuelta) => sinProhibidas(`Entrenar a las ${hora}, vuelta ${vuelta}`),
      alVerElDescanso: () => sinProhibidas(`El descanso de las ${hora}`),
      alVerElFinal: (cual) => sinProhibidas(`${cual} de las ${hora}`),
    })
    await p.clock.setFixedTime(aLas('09:10'))
    const primera = await completarUnaSesion(p, mirandoTodo('9:10'))
    if (primera) throw new Error(`la sesión de las 9:10 no llegó al cierre: ${primera}`)
    await sinProhibidas('El Cierre de las 9:10')
    const avancesDeLaManana = await leerAvances(p)

    // ── 2. Un tabata a las 13:30 ───────────────────────────────────────────
    await p.clock.setFixedTime(aLas('13:30'))
    const tabata = await unTabata(p, aLas('13:30'), sinProhibidas)
    if (tabata) throw new Error(`el tabata de las 13:30: ${tabata}`)
    if ((await leerAvances(p)) !== avancesDeLaManana) {
      fallos.push(`[${donde}] El tabata movió un avance: el Reloj no lee ninguna cadena.`)
    }

    // ── 3. El plan otra vez a las 19:05 ────────────────────────────────────
    await p.clock.setFixedTime(aLas('19:05'))
    const tercera = await completarUnaSesion(p, mirandoTodo('19:05'))
    if (tercera) throw new Error(`la sesión de las 19:05 no llegó al cierre: ${tercera}`)
    const cierre = await texto()
    await sinProhibidas('El Cierre de las 19:05')
    if (!cierre.includes('ya se leyeron hoy a las 9:10')) {
      fallos.push(`[${donde}] El Cierre de las 19:05 no dice que las cadenas ya se leyeron hoy a las 9:10.`)
    }
    if (cierre.includes('Como no completaste')) {
      fallos.push(`[${donde}] El Cierre de las 19:05 todavía dice "Como no completaste…".`)
    }

    const avancesDeLaNoche = await leerAvances(p)
    if (avancesDeLaNoche !== avancesDeLaManana) {
      fallos.push(
        `[${donde}] Los avances cambiaron entre las 9:10 y las 19:05. Cada cadena se lee una vez por día: ` +
          `la de la noche no puede escribirlos, ni siquiera la fecha.\n      antes:   ${avancesDeLaManana}\n      después: ${avancesDeLaNoche}`,
      )
    }

    const sesiones = await leerSesiones(p)
    if (sesiones.length !== 3) {
      fallos.push(`[${donde}] Quedaron ${sesiones.length} sesiones guardadas y tenían que ser 3.`)
    } else {
      const [manana, reloj, noche] = sesiones
      if (manana.vitalidadPre !== 4 || noche.vitalidadPre !== undefined) {
        fallos.push(
          `[${donde}] La energía de antes tiene que ser la del chequeo solo en la primera: ` +
            `9:10 guardó ${manana.vitalidadPre}, 19:05 guardó ${noche.vitalidadPre}.`,
        )
      }
      const leidas = manana.decisiones ?? []
      if (leidas.length === 0 || leidas.some((d) => d.movimiento === 'neutra')) {
        fallos.push(`[${donde}] La sesión de las 9:10 no leyó sus cadenas: ${JSON.stringify(leidas)}`)
      }
      if (reloj.tipo !== 'reloj' || (reloj.decisiones ?? []).length > 0) {
        fallos.push(`[${donde}] El tabata quedó como "${reloj.tipo}" y con decisiones: ${JSON.stringify(reloj.decisiones)}`)
      }
      const deLaNoche = noche.decisiones ?? []
      const patrones = (lista) => lista.map((d) => d.patron).sort().join(',')
      if (patrones(deLaNoche) !== patrones(leidas)) {
        fallos.push(
          `[${donde}] La de las 19:05 decidió sobre ${patrones(deLaNoche) || 'nada'} y la mañana leyó ${patrones(leidas)}.`,
        )
      }
      const mal = deLaNoche.filter(
        (d) => d.movimiento !== 'neutra' || d.motivo !== 'ya-leida-hoy' || d.leidaA !== manana.finalizadaEn,
      )
      if (mal.length > 0) {
        fallos.push(
          `[${donde}] Decisiones de las 19:05 que no son "ya leída hoy" con la hora de las 9:10: ${JSON.stringify(mal)}`,
        )
      } else {
        notas.push(
          `[${donde}] A las 19:05, ${deLaNoche.length} cadenas neutras con "ya-leida-hoy" y leidaA a las 9:10; avances idénticos byte por byte.`,
        )
      }
    }

    // ── 4. ÚLTIMOS 28 DÍAS cuenta un día ───────────────────────────────────
    await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(700)
    const seccion = p.locator('section', { has: p.getByText('ÚLTIMOS 28 DÍAS', { exact: true }) })
    if ((await seccion.count()) === 0) {
      fallos.push(`[${donde}] Después de tres sesiones, Hoy no muestra ÚLTIMOS 28 DÍAS: no se pudo contar.`)
    } else {
      const cifra = (await seccion.locator('.cifra').first().innerText()).trim()
      if (!cifra.startsWith('1 de ')) {
        fallos.push(`[${donde}] ÚLTIMOS 28 DÍAS dice "${cifra}" después de tres sesiones en un día: tiene que contar un día.`)
      } else {
        notas.push(`[${donde}] ÚLTIMOS 28 DÍAS: "${cifra}".`)
      }
    }
    await sinProhibidas('Hoy, después de las tres')
  } catch (e) {
    fallos.push(`[${donde}] El recorrido se cortó: ${e.message}`)
  } finally {
    await navegador.close()
  }
}

for (const n of notas) console.log(`· ${n}`)
if (fallos.length > 0) {
  console.error(`\n${fallos.length} problema(s):`)
  for (const f of fallos) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('\nTres sesiones en un día: cada cadena se leyó una vez, y el Cierre lo dice con la hora.')
