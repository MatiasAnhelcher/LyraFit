/**
 * Revisión visual automática.
 *
 * Levanta la app compilada, la recorre como la recorrería una persona
 * —incluida una sesión de entrenamiento completa— y saca capturas de cada
 * pantalla en los dos temas. El validador de colores revisa la paleta; esto
 * revisa que nada se superponga, se corte o se desborde.
 *
 * Uso: node revisar.mjs
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = 'http://localhost:4173'
const SALIDA = 'capturas'

const problemas = []

async function capturar(pagina, nombre) {
  await pagina.waitForTimeout(450)
  await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: true })
}

/** Detecta lo que el validador de paleta no puede ver: el desborde lateral. */
async function revisarDesborde(pagina, donde) {
  const desborda = await pagina.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  if (desborda) problemas.push(`Desborde horizontal en ${donde}`)
}

/**
 * Fuerza una cadena al techo de su ventana, ya consolidada.
 *
 * Es la única forma de ver la víspera —"si cerrás esta sesión, pasás a X"— en
 * un recorrido automático: aparece en una de cada cinco sesiones reales y nunca
 * en una instalación nueva, así que sin esto ninguna revisión la miraría jamás.
 * Se hace al final de todo, porque deja la base en un estado inventado.
 */
async function forzarVispera(pagina, patron) {
  return pagina.evaluate(async (patron) => {
    const base = await new Promise((res, rej) => {
      const r = indexedDB.open('lyrafit')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const avance = await new Promise((res, rej) => {
      const q = base.transaction('avances').objectStore('avances').get(patron)
      q.onsuccess = () => res(q.result)
      q.onerror = () => rej(q.error)
    })
    if (!avance) return null
    // Muy por encima del techo de cualquier ventana, con la señal a favor y la
    // consolidación cumplida: el motor cambia de eslabón en la próxima sesión.
    avance.objetivoActual = { ...avance.objetivoActual, cantidad: 999 }
    avance.senal = 1
    avance.sesionesEnObjetivo = 5
    avance.graciaRestante = 0
    await new Promise((res, rej) => {
      const q = base.transaction('avances', 'readwrite').objectStore('avances').put(avance)
      q.onsuccess = res
      q.onerror = () => rej(q.error)
    })
    return avance.ejercicioId
  }, patron)
}

async function main() {
  await mkdir(SALIDA, { recursive: true })

  // El contenedor trae su propio Chromium; se lo señalamos en vez de bajar otro.
  const navegador = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  })

  for (const tema of ['dark', 'light']) {
    const contexto = await navegador.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      colorScheme: tema,
      locale: 'es-AR',
      timezoneId: 'America/Argentina/Buenos_Aires',
    })

    const pagina = await contexto.newPage()
    pagina.on('pageerror', (e) => problemas.push(`Error de JavaScript (${tema}): ${e.message}`))
    pagina.on('console', (m) => {
      if (m.type() === 'error') problemas.push(`Error en consola (${tema}): ${m.text()}`)
    })

    // El alta primero: sin completarla, el portero manda todo a /alta.
    await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(500)
    await capturar(pagina, `0-alta-${tema}`)
    await revisarDesborde(pagina, `Alta (${tema})`)

    await pagina.getByRole('button', { name: 'Empezar', exact: true }).click()
    await pagina.getByRole('button', { name: 'Sí, tengo barra' }).click()
    // Cuatro pruebas de nivel: se suben unas repeticiones y se sigue.
    for (let i = 0; i < 4; i++) {
      for (let n = 0; n < 6; n++) {
        await pagina.getByRole('button', { name: 'Sumar' }).click()
      }
      const seguir = pagina.getByRole('button', { name: 'Siguiente', exact: true })
      const plan = pagina.getByRole('button', { name: 'Ver mi plan' })
      if (await plan.isVisible().catch(() => false)) await plan.click()
      else await seguir.click()
      await pagina.waitForTimeout(120)
    }
    await pagina.waitForTimeout(300)
    await capturar(pagina, `0b-plan-${tema}`)
    await revisarDesborde(pagina, `Revelación del plan (${tema})`)

    await pagina.getByRole('button', { name: 'Seguir', exact: true }).click()
    await pagina.waitForTimeout(200)
    await pagina.getByRole('button', { name: /Cuerpo completo/ }).click()
    await pagina.waitForTimeout(600)

    await capturar(pagina, `1-hoy-${tema}`)
    await revisarDesborde(pagina, `Hoy (${tema})`)

    // Una sesión completa: se anotan todas las series de todos los bloques.
    await pagina.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(600)
    await capturar(pagina, `2-entrenar-${tema}`)
    await revisarDesborde(pagina, `Entrenar (${tema})`)

    for (let vuelta = 0; vuelta < 60; vuelta++) {
      // Nombres exactos: sin `exact`, "Saltear" también engancha "Saltear este
      // ejercicio" y la revisión se saltea media sesión sin avisar.
      const anotar = pagina.getByRole('button', { name: 'Anotar serie', exact: true })
      const saltear = pagina.getByRole('button', { name: 'Saltear', exact: true })
      const siguiente = pagina.getByRole('button', { name: 'Siguiente ejercicio', exact: true })
      const terminar = pagina.getByRole('button', { name: 'Terminar', exact: true })

      if (await saltear.isVisible().catch(() => false)) {
        await saltear.click() // saltea el descanso
      } else if (await anotar.isVisible().catch(() => false)) {
        await anotar.click()
      } else if (await siguiente.isVisible().catch(() => false)) {
        await siguiente.click()
      } else if (await terminar.isVisible().catch(() => false)) {
        await terminar.click()
        break
      }
      await pagina.waitForTimeout(120)
    }

    // La serie de cierre, y después las tres preguntas del final.
    await pagina.waitForTimeout(400)
    await capturar(pagina, `3-serie-de-cierre-${tema}`)
    await revisarDesborde(pagina, `Serie de cierre (${tema})`)
    await pagina.getByRole('button', { name: 'Listo', exact: true }).click()

    await pagina.waitForTimeout(400)
    await capturar(pagina, `4-preguntas-${tema}`)
    await revisarDesborde(pagina, `Preguntas del final (${tema})`)
    // Las tres respuestas del final: esfuerzo, ánimo y energía. La tercera usa
    // la escala de cinco puntos del chequeo diario, no la de antes.
    for (const respuesta of ['Exigente', 'Bien', 'Con energía']) {
      await pagina.getByRole('button', { name: respuesta, exact: true }).click()
    }
    await pagina.getByRole('button', { name: 'Cerrar la sesión' }).click()

    // El cierre se revela por etapas: hay que esperar a que termine.
    await pagina.waitForTimeout(4200)
    await capturar(pagina, `5-cierre-${tema}`)
    await revisarDesborde(pagina, `Cierre (${tema})`)

    // La segunda visita, que es la que importa: ya hay historial, así que acá
    // es donde aparece la vara de la vez pasada. Sin este paso el recorrido
    // solo veía la app vacía, que es el único estado en que esa capa no existe.
    await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(700)
    await capturar(pagina, `5b-hoy-con-historial-${tema}`)
    await revisarDesborde(pagina, `Hoy con historial (${tema})`)

    await pagina.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(700)
    await capturar(pagina, `5c-entrenar-con-vara-${tema}`)
    await revisarDesborde(pagina, `Entrenar con vara (${tema})`)

    await pagina.goto(`${BASE}/#/biblioteca`, { waitUntil: 'networkidle' })
    await capturar(pagina, `6-biblioteca-${tema}`)
    await revisarDesborde(pagina, `Biblioteca (${tema})`)

    await pagina.goto(`${BASE}/#/biblioteca/flexion-completa`, { waitUntil: 'networkidle' })
    await capturar(pagina, `7-ficha-${tema}`)
    await revisarDesborde(pagina, `Ficha de ejercicio (${tema})`)

    await pagina.goto(`${BASE}/#/progreso`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(900)
    await capturar(pagina, `8-progreso-${tema}`)
    await revisarDesborde(pagina, `Progreso (${tema})`)

    await pagina.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
    await capturar(pagina, `9-ajustes-${tema}`)
    await revisarDesborde(pagina, `Ajustes (${tema})`)

    // Y la víspera, que va última porque deja la base en un estado inventado.
    // Se fuerza la rutina de cuatro días para que hoy toque entrenar sea cual
    // sea el día en que se corra la revisión.
    await pagina.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
    await pagina.getByRole('button', { name: /Empuje y tracción/ }).click()
    await pagina.waitForTimeout(300)
    const forzado = await forzarVispera(pagina, 'traccion')
    if (!forzado) problemas.push(`No se pudo forzar la víspera (${tema})`)

    await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(800)
    await capturar(pagina, `11-vispera-hoy-${tema}`)
    await revisarDesborde(pagina, `Hoy con víspera (${tema})`)
    if (!(await pagina.getByText(/pasás a/).first().isVisible().catch(() => false))) {
      problemas.push(`La víspera no aparece en Hoy (${tema})`)
    }

    await pagina.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(800)
    // El bloque de tracción es el segundo del plan: hay que saltear el primero.
    await pagina.getByRole('button', { name: 'Saltear este ejercicio', exact: true }).click()
    await pagina.waitForTimeout(600)
    await capturar(pagina, `12-vispera-entrenar-${tema}`)
    await revisarDesborde(pagina, `Entrenar con víspera (${tema})`)
    if (
      !(await pagina
        .getByText(/Si cerrás esta sesión/)
        .first()
        .isVisible()
        .catch(() => false))
    ) {
      problemas.push(`La víspera no aparece en Entrenar (${tema})`)
    }

    await contexto.close()
  }

  // La app también se usa en tablet y computadora: se revisa que no quede rota.
  const ancho = await navegador.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
    locale: 'es-AR',
  })
  const escritorio = await ancho.newPage()
  await escritorio.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await escritorio.screenshot({ path: `${SALIDA}/10-escritorio.png` })
  await revisarDesborde(escritorio, 'escritorio')
  await ancho.close()

  await navegador.close()

  if (problemas.length > 0) {
    console.log('PROBLEMAS ENCONTRADOS:')
    for (const p of problemas) console.log(' -', p)
    process.exit(1)
  }
  console.log('Revisión completa: sin errores de consola ni desbordes.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
