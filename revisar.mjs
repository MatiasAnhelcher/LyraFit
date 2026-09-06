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

    await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await capturar(pagina, `1-hoy-${tema}`)
    await revisarDesborde(pagina, `Hoy (${tema})`)

    // Una sesión completa: se registran todas las series de todos los bloques.
    await pagina.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(600)
    await capturar(pagina, `2-entrenar-${tema}`)
    await revisarDesborde(pagina, `Entrenar (${tema})`)

    for (let vuelta = 0; vuelta < 60; vuelta++) {
      // Nombres exactos: sin `exact`, "Saltear" también engancha "Saltear este
      // ejercicio" y la revisión se saltea media sesión sin avisar.
      const registrar = pagina.getByRole('button', { name: 'Registrar serie', exact: true })
      const saltear = pagina.getByRole('button', { name: 'Saltear', exact: true })
      const siguiente = pagina.getByRole('button', { name: 'Siguiente ejercicio', exact: true })
      const terminar = pagina.getByRole('button', { name: 'Terminar sesión', exact: true })

      if (await registrar.isVisible().catch(() => false)) {
        await registrar.click()
      } else if (await saltear.isVisible().catch(() => false)) {
        await saltear.click() // saltea el descanso
      } else if (await siguiente.isVisible().catch(() => false)) {
        await siguiente.click()
      } else if (await terminar.isVisible().catch(() => false)) {
        if (vuelta === 0) continue
        await terminar.click()
        break
      }
      await pagina.waitForTimeout(120)
    }

    await pagina.waitForTimeout(700)
    await capturar(pagina, `3-resumen-${tema}`)
    await revisarDesborde(pagina, `Resumen de sesión (${tema})`)

    await pagina.goto(`${BASE}/#/biblioteca`, { waitUntil: 'networkidle' })
    await capturar(pagina, `4-biblioteca-${tema}`)
    await revisarDesborde(pagina, `Biblioteca (${tema})`)

    await pagina.goto(`${BASE}/#/biblioteca/dominada-completa`, { waitUntil: 'networkidle' })
    await capturar(pagina, `5-ficha-${tema}`)
    await revisarDesborde(pagina, `Ficha de ejercicio (${tema})`)

    await pagina.goto(`${BASE}/#/progreso`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(900)
    await capturar(pagina, `6-progreso-${tema}`)
    await revisarDesborde(pagina, `Progreso (${tema})`)

    await pagina.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
    await capturar(pagina, `7-ajustes-${tema}`)
    await revisarDesborde(pagina, `Ajustes (${tema})`)

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
  await escritorio.screenshot({ path: `${SALIDA}/8-escritorio.png` })
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
