/**
 * Lo que todos los portones hacían por su cuenta, una sola vez.
 *
 * ## Por qué existe
 *
 * Nueve de los diez portones arrancaban con la misma secuencia de alta,
 * copiada a mano nueve veces con nueve juegos de esperas levemente distintos.
 * Eso convertía el texto de un botón del alta en API de pruebas: renombrar
 * `'Sí, tengo barra'` rompía nueve archivos a la vez, y cada arreglo había que
 * hacerlo nueve veces o quedaba un portón en rojo que nadie miraba.
 *
 * Ahora la secuencia vive acá. Si el alta cambia, cambia un archivo.
 *
 * ## Qué NO va acá
 *
 * Nada que un portón concreto mida. Esto es plomería: abrir el navegador,
 * pasar el portero, verificar que se está revisando el build que está en
 * disco. Las afirmaciones son de cada portón, y tienen que seguir estando
 * escritas en el portón que las hace — un helper que afirma cosas es un
 * helper que oculta qué se está midiendo.
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

export const BASE = process.env.BASE ?? 'http://localhost:4173'
export const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

/** El teléfono de referencia. Un Android chico de verdad, no un iPhone grande. */
export const TELEFONO = { width: 390, height: 844 }

/**
 * Que lo que se está revisando sea lo que está en disco.
 *
 * `vite preview` se deja abierto entre corridas y puede quedar sirviendo un
 * build viejo. Pasó, y produjo el peor resultado posible: una revisión en
 * verde sobre código que no era el compilado — incluida una prueba por
 * mutación que "pasó" con la mutación puesta. Un guion que puede revisar el
 * archivo equivocado sin decirlo es peor que no tener guion.
 */
export async function revisarQueSirvaLoCompilado(base = BASE) {
  /*
   * PRIMERO: ¿el build es más nuevo que el código?
   *
   * La comprobación de abajo cotejaba el bundle servido contra el de disco, y
   * atrapaba un caso: "el servidor quedó con un build viejo". No atrapaba el
   * otro, que resultó ser igual de fácil de producir: **compilar nunca**.
   * Con `dist/` viejo y el servidor sirviendo ese mismo `dist/` viejo, los dos
   * hashes coinciden y la comprobación pasa feliz mientras el portón mide
   * código que ya no existe.
   *
   * Me pasó: arreglé la regla del pliegue, corrí el portón, y me informó la
   * misma rotura de antes con el mismo número al píxel. El arreglo estaba en
   * `src/` y nunca había llegado a `dist/`.
   *
   * Comparar fechas de modificación cuesta dos líneas y cierra el agujero.
   */
  const masNuevo = async (dir) => {
    const archivos = await readdir(dir, { withFileTypes: true, recursive: true })
    let tope = 0
    for (const a of archivos) {
      if (!a.isFile()) continue
      const { mtimeMs } = await stat(join(a.parentPath ?? a.path, a.name))
      if (mtimeMs > tope) tope = mtimeMs
    }
    return tope
  }
  const fuente = await masNuevo('src')
  const compilado = (await stat('dist/index.html')).mtimeMs
  if (fuente > compilado) {
    console.log('EL BUILD ES MÁS VIEJO QUE EL CÓDIGO.')
    console.log(`  src/ cambió después de la última compilación, por ${Math.round((fuente - compilado) / 1000)} s.`)
    console.log('Compilá con `npm run build` antes de correr esto; si no, estás midiendo código que ya no existe.')
    process.exit(2)
  }

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

/**
 * Espera a que termine el pasaje en curso, si hay uno.
 *
 * Preguntar por rol mientras la pantalla se mueve no es gratis: para cada
 * pregunta el motor de roles de Playwright calcula el nombre accesible de
 * todos los botones, adentro de la página, y con la CPU frenada eso son unos
 * 15 ms que caen en el primer cuadro del movimiento. `transiciones.mjs` lo
 * contaba como un tirón de la app: medido sin esas preguntas, el cuadro del
 * paso a la prueba termina de 3 a 7 ms después de `ready`; con ellas, hasta
 * 54. Tampoco sirve `waitForFunction`: la primera vez instala en la página
 * el guion de Playwright entero, y después sondea desde adentro. Lo que
 * queda es una evaluación suelta cada 100 ms, que mira un atributo y vuelve.
 *
 * Si el atributo no se va nunca, sigue igual a los 5 s: un pasaje que no
 * termina lo informa `transiciones.mjs`, y acá no se esconde nada.
 *
 * @param {import('playwright').Page} p
 */
export async function trasElPasaje(p, tope = 5000) {
  const hasta = Date.now() + tope
  while (Date.now() < hasta) {
    const seMueve = await p.evaluate(() => document.documentElement.hasAttribute('data-vt')).catch(() => false)
    if (!seMueve) return
    await p.waitForTimeout(100)
  }
}

/**
 * El alta completa, hasta quedar parado en Hoy con un plan elegido.
 *
 * Es el portero: sin esto, cualquier ruta redirige a `/alta` y el portón mide
 * la pantalla equivocada.
 *
 * @param {import('playwright').Page} p
 * @param {{ ir?: boolean, rutina?: RegExp, conBarra?: boolean, enCadaPaso?: (paso: string) => Promise<void> }} opciones
 *   `ir: false` para cuando el portón ya navegó por su cuenta (el de
 *   actualización sirve la app desde su propio servidor).
 *   `conBarra: false` contesta "No, por ahora no": cambia la prueba de
 *   tracción, y con ella su regleta.
 *   `enCadaPaso` se llama con cada pantalla del alta ya dibujada, antes de
 *   tocar nada en ella: 'inicio', 'equipo', 'prueba', 'prueba-elegida',
 *   'prueba-2', 'prueba-3', 'prueba-4', 'plan' y 'dias'. Es para el portón
 *   que necesita mirar el alta y no solo pasarla, sin escribir de nuevo la
 *   secuencia.
 */
export async function alta(p, { ir = true, rutina = /Cuerpo completo/, conBarra = true, enCadaPaso = null } = {}) {
  // El paso se avisa recién cuando su pantalla está: un clic no espera a que
  // se dibuje la siguiente, y mirar en ese hueco es mirar la anterior.
  const paso = async (nombre, listo) => {
    if (!enCadaPaso) return
    await listo.first().waitFor({ state: 'visible' })
    await enCadaPaso(nombre)
  }
  // Cada paso del alta llega con su pasaje. Lo que viene después de tocar
  // pregunta por rol, así que antes deja que termine (ver `trasElPasaje`).
  const tocarYPasar = async (boton) => {
    await boton.click()
    await trasElPasaje(p)
  }
  if (ir) {
    await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await p.waitForTimeout(400)
  }
  const empezar = p.getByRole('button', { name: 'Empezar', exact: true })
  await paso('inicio', empezar)
  await tocarYPasar(empezar)
  const equipo = p.getByRole('button', { name: conBarra ? 'Sí, tengo barra' : 'No, por ahora no' })
  await paso('equipo', equipo)
  await tocarYPasar(equipo)

  // La prueba de nivel: cuatro pantallas, una por patrón. Se contesta con la
  // regleta cuando está (el primer patrón) y sumando cuando no.
  const doce = p.getByRole('button', { name: '12', exact: true })
  const laPrueba = doce.or(p.getByRole('button', { name: 'Sumar' }))
  // Los pasos del alta llegan con su pasaje, y el pasaje cambia la pantalla
  // un cuadro DESPUÉS del clic: preguntar `isVisible` en ese hueco es
  // preguntarle a la pantalla del equipo, que dice que no hay regleta.
  await laPrueba.first().waitFor({ state: 'visible' })
  await paso('prueba', laPrueba)
  let numero = 1
  if (await doce.isVisible().catch(() => false)) {
    await doce.click()
    await paso('prueba-elegida', p.locator('[aria-pressed="true"]'))
    await tocarYPasar(p.getByRole('button', { name: 'Siguiente', exact: true }))
    await p.waitForTimeout(150)
    numero++
  }
  for (let i = 0; i < 4; i++) {
    const sumar = p.getByRole('button', { name: 'Sumar' })
    if (!(await sumar.isVisible().catch(() => false))) break
    if (numero > 1) await paso(`prueba-${numero}`, sumar)
    numero++
    for (let n = 0; n < 6; n++) await sumar.click()
    const ver = p.getByRole('button', { name: 'Ver mi plan' })
    if (await ver.isVisible().catch(() => false)) await tocarYPasar(ver)
    else await tocarYPasar(p.getByRole('button', { name: 'Siguiente', exact: true }))
    await p.waitForTimeout(120)
  }

  const seguir = p.getByRole('button', { name: 'Seguir', exact: true })
  await paso('plan', seguir)
  await tocarYPasar(seguir)
  await p.waitForTimeout(400)
  const elegida = p.getByRole('button', { name: rutina })
  await paso('dias', elegida)
  await elegida.click()
  await p.waitForTimeout(700)

  // El ofrecimiento de instalar la app, si aparece: tapa media pantalla.
  const ahoraNo = p.getByRole('button', { name: 'Ahora no' })
  if (await ahoraNo.isVisible().catch(() => false)) {
    await ahoraNo.click()
    await p.waitForTimeout(300)
  }
}

/**
 * Navegador, contexto y página, con los errores de consola ya enganchados.
 *
 * Devuelve también `fallos`, el array donde caen los errores de JavaScript:
 * un portón que no los escucha puede pasar en verde con la pantalla rota.
 */
export async function abrir({ viewport = TELEFONO, escala = 1, fallos = [] } = {}) {
  const navegador = await chromium.launch({ executablePath: CHROMIUM })
  const contexto = await navegador.newContext({
    viewport,
    deviceScaleFactor: escala,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  })
  const pagina = await contexto.newPage()
  pagina.on('pageerror', (e) => fallos.push(`Error de JavaScript: ${e.message}`))
  pagina.on('console', (m) => {
    if (m.type() === 'error') fallos.push(`Error en consola: ${m.text()}`)
  })
  return { navegador, contexto, pagina, fallos }
}

/**
 * Leer y escribir la base por atrás de la interfaz.
 *
 * Estaba copiada en SEIS portones con seis nombres parecidos —`conLaBase`,
 * `enLaBase`— y las seis con la misma trampa escrita (o no escrita) al lado.
 *
 * ## La trampa, dicha una sola vez
 *
 * Una escritura cruda NO dispara la invalidación de `liveQuery`: Dexie se
 * entera de los cambios que pasan por Dexie, y esto los hace por debajo. Así
 * que después de escribir hay que RECARGAR de verdad (`page.reload`), no
 * navegar por hash: un cambio de hash no vuelve a montar la app y la pantalla
 * sigue mostrando lo de antes.
 *
 * Y se espera el `oncomplete` de la transacción, no el `onsuccess` del
 * pedido: entre uno y otro la escritura todavía no está en disco.
 *
 * @param tablas  los object stores que la transacción necesita.
 * @param trabajo una función `(leer, poner) => …`, serializada al navegador.
 *                NO puede cerrar sobre nada de este archivo.
 */
export async function conLaBase(pagina, tablas, trabajo) {
  return pagina.evaluate(
    async ([tablas, cuerpo]) => {
      const req = indexedDB.open('lyrafit')
      const db = await new Promise((r) => {
        req.onsuccess = () => r(req.result)
      })
      const tx = db.transaction(tablas, 'readwrite')
      const leer = (t) =>
        new Promise((r) => {
          const q = tx.objectStore(t).getAll()
          q.onsuccess = () => r(q.result)
        })
      const poner = (t, v) => tx.objectStore(t).put(v)
      // eslint-disable-next-line no-new-func
      const resultado = await new Function('leer', 'poner', `return (${cuerpo})(leer, poner)`)(
        leer,
        poner,
      )
      // El `oncomplete` y no el `onsuccess` del último pedido: entre los dos
      // la escritura todavía no está.
      //
      // La carrera: si el trabajo no dejó ningún pedido pendiente, la
      // transacción ya se cerró sola antes de llegar acá y `oncomplete` no va
      // a dispararse nunca. Una promesa que no resuelve adentro de
      // `page.evaluate` no falla — queda colgada hasta que el recolector la
      // levanta, y Playwright tira "Resulting promise was garbage collected",
      // que no se parece en nada al problema real. El `Promise.race` con un
      // tope corto lo cierra.
      await Promise.race([
        new Promise((r) => {
          tx.oncomplete = () => r()
          tx.onerror = () => r()
          tx.onabort = () => r()
        }),
        new Promise((r) => setTimeout(r, 1500)),
      ])
      return resultado
    },
    [tablas, trabajo.toString()],
  )
}

/**
 * Recorrer una sesión entera hasta el CIERRE, que es la última pantalla.
 *
 * ## Por qué esto vive acá y no en un portón
 *
 * Cuatro de las primitivas de movimiento del sistema —`.revelar`,
 * `.anim-regla`, `.anim-llenar` y `.anim-estrella`— existen ÚNICAMENTE en el
 * cierre y en la barra de cadena que el cierre llena. `movimiento.mjs` decía medirlas
 * con movimiento reducido en cinco rutas donde ninguna de las cuatro está,
 * así que recorría cero elementos y salía en verde. Era la tercera vez que
 * ese mismo bloque quedaba ciego.
 *
 * Llegar al cierre no es navegar a una ruta: no hay ruta. Hay que entrenar
 * la sesión entera. `revisar.mjs` ya lo hacía con su propio bucle; esto es
 * el mismo recorrido, acá, para que el próximo portón que necesite el cierre
 * no lo vuelva a escribir ni lo vuelva a omitir.
 *
 * ## El bucle
 *
 * Los nombres van con `exact`: sin eso, "Saltear" también engancha "Saltear
 * este ejercicio" y el recorrido se saltea media sesión sin avisar.
 *
 * El orden importa. "Voy" cierra la predicción de la primera serie de cada
 * ejercicio y tapa a "Anotar serie": un portón que busca "Anotar serie" sin
 * pasar antes por "Voy" encuentra un locator vacío, y `isVisible()` sobre un
 * locator vacío devuelve false sin lanzar. Eso dejó todo el bloque del
 * descanso de `movimiento.mjs` como código muerto.
 *
 * ## El descanso se mira y se saltea
 *
 * Los descansos SIEMPRE se saltean, y no es una opción: duran minutos reales
 * y un bucle que los espera no llega nunca al cierre. La primera versión de
 * esto tenía un `saltearDescansos: false` que parecía razonable y no podía
 * terminar jamás — una opción que garantiza el fallo es peor que no tenerla.
 *
 * Para mirar el descanso está `alVerElDescanso`: se llama UNA vez, la primera
 * que la pantalla aparece, antes de saltearla. Así el que necesita medirla la
 * mide y el recorrido igual llega. `alVerElFinal` es lo mismo para las dos
 * pantallas de después de "Terminar": se llama con 'la serie de cierre' y con
 * 'las preguntas', ya dibujadas y antes de tocar nada en ellas.
 *
 * @returns {Promise<string|null>} null si llegó al cierre; si no, la razón,
 *          para que el portón la reporte en vez de seguir como si nada.
 */
export async function completarUnaSesion(p, { alVerElDescanso = null, alVerElFinal = null } = {}) {
  let descansoVisto = false
  await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)

  const boton = (nombre) => p.getByRole('button', { name: nombre, exact: true })
  const sePuede = (b) => b.isVisible().catch(() => false)

  let termino = false
  for (let vuelta = 0; vuelta < 120; vuelta++) {
    const saltear = boton('Saltear')
    const voy = boton('Voy')
    const anotar = boton('Anotar serie')
    const siguiente = boton('Siguiente ejercicio')
    const terminar = boton('Terminar')

    if (await sePuede(saltear)) {
      if (!descansoVisto) {
        descansoVisto = true
        if (alVerElDescanso) await alVerElDescanso()
      }
      await saltear.click()
    } else if (await sePuede(voy)) await voy.click()
    else if (await sePuede(anotar)) await anotar.click()
    else if (await sePuede(siguiente)) await siguiente.click()
    else if (await sePuede(terminar)) {
      await terminar.click()
      termino = true
      break
    } else break
    await p.waitForTimeout(120)
  }
  if (!termino) return 'la sesión no llegó a "Terminar" en 120 vueltas'

  // La serie de cierre.
  await p.waitForTimeout(400)
  const listo = boton('Listo')
  if (!(await sePuede(listo))) return 'después de "Terminar" no apareció la serie de cierre'
  if (alVerElFinal) await alVerElFinal('la serie de cierre')
  await listo.click()

  // Las tres preguntas del final: esfuerzo, ánimo y energía.
  await p.waitForTimeout(400)
  if (alVerElFinal) {
    await boton('Exigente').waitFor({ state: 'visible' }).catch(() => {})
    await alVerElFinal('las preguntas')
  }
  for (const respuesta of ['Exigente', 'Bien', 'Con energía']) {
    const r = boton(respuesta)
    if (!(await sePuede(r))) return `no apareció la respuesta "${respuesta}" en las preguntas del final`
    await r.click()
  }
  const cerrar = p.getByRole('button', { name: 'Cerrar la sesión' })
  if (!(await sePuede(cerrar))) return 'no apareció "Cerrar la sesión"'
  await cerrar.click()

  // El cierre se revela por etapas: hay que esperar a que termine de contar.
  await p.waitForTimeout(4200)
  return null
}
