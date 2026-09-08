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
import { readFile } from 'node:fs/promises'
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
 *
 * Ojo con lo que viene después: esta escritura va por IndexedDB crudo, o sea
 * por atrás de Dexie, así que NO dispara la invalidación de `liveQuery`. Una
 * navegación de hash vuelve a montar el componente pero puede seguir sirviendo
 * el avance viejo desde la caché del observable. Hay que recargar la página de
 * verdad. Fallar en esto hacía que la revisión pasara o fallara al azar, con
 * la app funcionando perfecto: el falso rojo más caro que tuvo este archivo.
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
    // Se espera el `oncomplete` de la transacción y no el `onsuccess` del
    // pedido: son dos momentos distintos, y entre uno y otro la escritura
    // todavía no está confirmada. Esperar el pedido hacía que la revisión
    // fallara una de cada dos corridas, sin que hubiera nada roto en la app.
    await new Promise((res, rej) => {
      const tx = base.transaction('avances', 'readwrite')
      tx.objectStore('avances').put(avance)
      tx.oncomplete = () => res()
      tx.onerror = () => rej(tx.error)
      tx.onabort = () => rej(tx.error)
    })
    return avance.ejercicioId
  }, patron)
}

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

async function main() {
  await revisarQueSirvaLoCompilado(BASE)
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
    await pagina.waitForTimeout(300)
    await capturar(pagina, `0a-prueba-${tema}`)
    await revisarDesborde(pagina, `Prueba de nivel (${tema})`)

    // Cuatro pruebas de nivel. La primera se contesta con la regleta —de un
    // toque, que es para lo que existe— y el resto con el más, para que el
    // recorrido pase por los dos caminos.
    await pagina.getByRole('button', { name: '12', exact: true }).click()
    await pagina.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await pagina.waitForTimeout(120)

    for (let i = 0; i < 3; i++) {
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

    for (let vuelta = 0; vuelta < 80; vuelta++) {
      // Nombres exactos: sin `exact`, "Saltear" también engancha "Saltear este
      // ejercicio" y la revisión se saltea media sesión sin avisar.
      const anotar = pagina.getByRole('button', { name: 'Anotar serie', exact: true })
      // "Voy" cierra la predicción de la primera serie de cada ejercicio.
      const voy = pagina.getByRole('button', { name: 'Voy', exact: true })
      const saltear = pagina.getByRole('button', { name: 'Saltear', exact: true })
      const siguiente = pagina.getByRole('button', { name: 'Siguiente ejercicio', exact: true })
      const terminar = pagina.getByRole('button', { name: 'Terminar', exact: true })

      if (await saltear.isVisible().catch(() => false)) {
        await saltear.click() // saltea el descanso
      } else if (await voy.isVisible().catch(() => false)) {
        await voy.click()
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
    await pagina.waitForTimeout(400)
    await capturar(pagina, `7-ficha-${tema}`)
    await revisarDesborde(pagina, `Ficha de ejercicio (${tema})`)

    // La distancia se dice de tres formas y las tres tienen que salir: en
    // sesiones solo para el eslabón que viene, en eslabones para todo lo que
    // está más lejos, y "ya pasaste por acá" para lo que quedó atrás. La
    // primera versión de esto contaba sesiones hasta cualquier ejercicio y
    // prometía la flexión a una mano en dieciséis sesiones.
    for (const [id, esperado] of [
      ['flexion-pared', /Ya pasaste por acá/i],
      ['flexion-una-mano', /eslabones más adelante/i],
    ]) {
      await pagina.goto(`${BASE}/#/biblioteca/${id}`, { waitUntil: 'networkidle' })
      await pagina.waitForTimeout(400)
      const dice = await pagina
        .locator('main p, p')
        .filter({ hasText: esperado })
        .first()
        .isVisible()
        .catch(() => false)
      if (!dice) problemas.push(`La ficha de ${id} no dice a qué distancia está (${tema})`)
    }
    await capturar(pagina, `7b-ficha-lejos-${tema}`)
    await revisarDesborde(pagina, `Ficha de un ejercicio lejano (${tema})`)

    // Y la tercera redacción, la única que cuenta sesiones: el eslabón que
    // viene. Se deriva del avance real en vez de escribirlo a mano, porque
    // dónde cae la persona depende de lo que contestó en el alta.
    const proximo = await pagina.evaluate(async () => {
      const base = await new Promise((res, rej) => {
        const r = indexedDB.open('lyrafit')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const avance = await new Promise((res, rej) => {
        const q = base.transaction('avances').objectStore('avances').get('empuje')
        q.onsuccess = () => res(q.result)
        q.onerror = () => rej(q.error)
      })
      return avance?.ejercicioId ?? null
    })
    if (proximo) {
      await pagina.goto(`${BASE}/#/biblioteca/${proximo}`, { waitUntil: 'networkidle' })
      await pagina.waitForTimeout(400)
      const siguienteId = await pagina
        .locator('a[href*="/biblioteca/"]')
        .last()
        .getAttribute('href')
      const idDespues = siguienteId?.split('/').pop()
      if (idDespues) {
        await pagina.goto(`${BASE}/#/biblioteca/${idDespues}`, { waitUntil: 'networkidle' })
        await pagina.waitForTimeout(400)
        const cuenta = await pagina
          .locator('p')
          .filter({ hasText: /Estás a .* de acá, si sale todo bien/i })
          .first()
          .isVisible()
          .catch(() => false)
        if (!cuenta) {
          problemas.push(`El eslabón siguiente no dice a cuántas sesiones está (${tema})`)
        }
      }
    }

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

    // Recarga de verdad, no navegación de hash: ver la nota de `forzarVispera`.
    await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await pagina.reload({ waitUntil: 'networkidle' })
    await pagina.waitForTimeout(900)
    await capturar(pagina, `11-vispera-hoy-${tema}`)
    await revisarDesborde(pagina, `Hoy con víspera (${tema})`)
    if (!(await pagina.getByText(/pasás a/).first().isVisible().catch(() => false))) {
      problemas.push(`La víspera no aparece en Hoy (${tema})`)
    }

    await pagina.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
    await pagina.reload({ waitUntil: 'networkidle' })
    await pagina.waitForTimeout(900)
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
