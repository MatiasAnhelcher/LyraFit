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
import { BASE, CHROMIUM, alta, revisarQueSirvaLoCompilado } from './lib/portones.mjs'
import { readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'

const SALIDA = 'capturas'

const problemas = []

/**
 * Cuántos músculos declara cubiertos el dominio.
 *
 * Se lee del archivo en vez de escribirlo acá: este portón ya falló una vez
 * por tener un 18 pineado a mano cuando el dominio pasó a 20, y el comentario
 * que avisaba del riesgo estaba escrito justo arriba del número.
 */
const CUBIERTOS = (() => {
  const fuente = readFileSync('src/dominio/musculos.ts', 'utf8')
  const bloque = fuente.match(/MUSCULOS_CUBIERTOS: Musculo\[\] = \[([^\]]*)\]/s)?.[1]
  if (!bloque) {
    console.log('No se pudo leer MUSCULOS_CUBIERTOS de src/dominio/musculos.ts')
    process.exit(2)
  }
  return (bloque.match(/'/g)?.length ?? 0) / 2
})()

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

/*
 * EL GUARDIÁN DEL BUILD VIVE EN `lib/portones.mjs`, Y ACÁ HABÍA UNA COPIA.
 *
 * Esta copia cotejaba el bundle servido contra el de disco y atrapaba un
 * caso: "el servidor quedó con un build viejo". No atrapaba el otro —
 * **compilar nunca**—, porque con `dist/` viejo y el servidor sirviendo ese
 * mismo `dist/` los dos hashes coinciden y la comprobación pasa feliz.
 *
 * Ese segundo caso lo arreglé ayer comparando fechas de modificación, y puse
 * el arreglo en la librería. Esta copia quedó atrás: el portón que más
 * pantallas mira era el que peor protegido estaba, y ya había producido una
 * revisión en verde sobre código que no era el compilado, con una prueba por
 * mutación que "pasó" con la mutación puesta.
 *
 * Una función duplicada no es dos copias de lo mismo: es una que se arregla
 * y otra que no. Por eso ahora se importa.
 */

async function main() {
  await revisarQueSirvaLoCompilado(BASE)
  await mkdir(SALIDA, { recursive: true })

  // El contenedor trae su propio Chromium; se lo señalamos en vez de bajar otro.
  const navegador = await chromium.launch({ executablePath: CHROMIUM })

  // Una sola pasada. Hasta el rediseño había dos, una por tema, y tenía
  // sentido: la app tenía papel claro y oscuro. Ahora tiene un solo mundo —la
  // noche— así que la segunda pasada capturaba exactamente las mismas
  // pantallas y tardaba lo mismo en hacerlo. Lo que SÍ queda verificado, al
  // final de esta función, es que el tema del sistema ya no cambia nada: es la
  // afirmación que reemplaza a la pasada.
  for (const tema of ['dark']) {
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

    // El descanso se captura una sola vez, la primera que aparece. Es la
    // pantalla que más tiempo está a la vista de toda la app —unos veinte
    // minutos por sesión mirando el arco vaciarse— y hasta acá era la única
    // que la revisión cruzaba sin mirar, porque el bucle la saltea apenas la
    // ve. Desde que Lyra habla ahí, encima, tiene contenido que puede
    // desbordar.
    let descansoVisto = false

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
        if (!descansoVisto) {
          descansoVisto = true
          await capturar(pagina, `2b-descanso-${tema}`)
          await revisarDesborde(pagina, `Descanso (${tema})`)
        }
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

    // El reloj, en sus dos estados: la lista corta —lo que te toca hoy— y la
    // larga, que son los cuarenta y siete y es la que puede desbordar.
    await pagina.goto(`${BASE}/#/reloj`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(400)
    await capturar(pagina, `6b-reloj-${tema}`)
    await revisarDesborde(pagina, `El reloj (${tema})`)

    const verTodos = pagina.getByRole('button', { name: 'Ver todos los ejercicios' })
    if (!(await verTodos.isVisible().catch(() => false))) {
      problemas.push(`No está la salida a los cuarenta y siete en el reloj (${tema})`)
    } else {
      await verTodos.click()
      await pagina.waitForTimeout(400)
      const cuantos = await pagina.locator('section .registro .fila-pulsable').count()
      if (cuantos < 40) {
        problemas.push(`Con "ver todos" el reloj ofrece ${cuantos} filas y la biblioteca tiene 47 (${tema})`)
      }
      await capturar(pagina, `6c-reloj-todos-${tema}`)
      await revisarDesborde(pagina, `El reloj con los cuarenta y siete (${tema})`)
    }

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
    // Los novecientos milisegundos son por el chunk lazy de recharts.
    await pagina.waitForTimeout(900)
    await capturar(pagina, `8-progreso-${tema}`)
    await revisarDesborde(pagina, `Progreso (${tema})`)

    // Aserciones de contenido sobre Progreso, que hasta acá no tenía NINGUNA:
    // solo se le miraba el desborde y la consola, así que una sección entera
    // podía dejar de renderizarse y la revisión pasaba en verde.
    const mapa = pagina.getByText('QUÉ ESTÁS ENTRENANDO')
    if (!(await mapa.isVisible().catch(() => false))) {
      problemas.push(`No apareció el mapa muscular en Progreso (${tema})`)
    } else {
      // Una fila por músculo cubierto. El número sale de `MUSCULOS_CUBIERTOS`
      // y no está escrito acá, que es el arreglo de lo que acaba de pasar:
      // decía 18 con un comentario que avisaba "si un día entra el empuje
      // vertical y el deltoide lateral pasa a estar cubierto, esta cuenta
      // cambia y hay que venir a decirlo". Entró el empuje vertical, la cuenta
      // cambió a 20 y el portón falló por tener razón sobre algo que ya no era
      // cierto. Un número copiado a mano en un portón es deuda con fecha.
      //
      // Lo que se verifica sigue siendo lo mismo y es lo que importa: que la
      // pantalla dibuje TODOS los músculos cubiertos y ninguno de más. Si un
      // día la lista crece y la pantalla no, esto lo agarra igual.
      const filas = await pagina
        .locator('section', { has: pagina.getByText('QUÉ ESTÁS ENTRENANDO') })
        .locator('.registro > *')
        .count()
      if (filas !== CUBIERTOS) {
        problemas.push(
          `El mapa muscular tiene ${filas} filas y hay ${CUBIERTOS} músculos cubiertos (${tema})`,
        )
      }
      // Y que diga algo: las cuatro salidas del diagnóstico son excluyentes, así
      // que siempre tiene que haber exactamente una.
      const dichos = await Promise.all(
        [
          /todavía no hay con qué/,
          /Tu rutina no incluye/,
          /Lo que menos venís trabajando/,
          /No hay ningún músculo muy atrás/,
        ].map((r) => pagina.getByText(r).isVisible().catch(() => false)),
      )
      const cuantos = dichos.filter(Boolean).length
      if (cuantos !== 1) {
        problemas.push(`El mapa muscular dijo ${cuantos} diagnósticos y tenía que decir 1 (${tema})`)
      }
    }

    /*
     * EL DIARIO, con aserciones de contenido y no solo una captura.
     *
     * La primera versión de esta pantalla se publicó VACÍA —rayas y nada
     * más— y pasó la revisión: `useLiveQuery` devuelve `undefined` mientras
     * carga, `db.diario.get()` devuelve `undefined` cuando no hay fila, y la
     * guarda contra el parpadeo confundía las dos cosas. O sea que se rompía
     * exactamente en el caso más común: el primer día, antes de contestar
     * nada.
     *
     * No lo agarró ningún test y no podía: es la unión de un hook de React
     * con una consulta de Dexie. Lo agarró una captura mirada a ojo, y eso es
     * un golpe de suerte, no un proceso. Estas tres líneas lo convierten en
     * proceso.
     */
    /*
     * LA FICHA DE UN EJERCICIO QUE NO ES ESLABÓN.
     *
     * Cuatro frases falsas salían del mismo -1 de `indexOf`, y la peor no era
     * una frase: el botón "empezar la cadena de empuje acá" le escribía al
     * avance de empuje un ejercicio que no está en la cadena de empuje. Eso
     * deja la base en un estado del que la app no puede salir sola.
     */
    await pagina.goto(`${BASE}/#/biblioteca/press-militar-barra`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(400)
    const textoFicha = (await pagina.locator('main').innerText()).toLowerCase()
    for (const mentira of ['0 de 11', 'eslabones atrás', 'en la cadena']) {
      if (textoFicha.includes(mentira)) {
        problemas.push(
          `La ficha del press militar dice "${mentira}", y no está en ninguna cadena (${tema})`,
        )
      }
    }
    if (await pagina.getByRole('button', { name: /Empezar la cadena/ }).isVisible().catch(() => false)) {
      problemas.push(
        `La ficha de un ejercicio fuera de cadena ofrece "empezar la cadena acá": eso corrompe el avance (${tema})`,
      )
    }
    if (!textoFicha.includes('progresa por peso')) {
      problemas.push(`La ficha del press militar no explica cómo se progresa sin cadena (${tema})`)
    }
    await capturar(pagina, `7c-ficha-barra-${tema}`)
    await revisarDesborde(pagina, `Ficha de un ejercicio con barra (${tema})`)

    await pagina.goto(`${BASE}/#/diario`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(500)
    for (const texto of ['¿Cuánto dormiste anoche?', '¿En cuántas comidas de hoy hubo proteína?']) {
      if (!(await pagina.getByText(texto).isVisible().catch(() => false))) {
        problemas.push(`El diario no dibuja "${texto}" (${tema}): la pantalla quedó vacía.`)
      }
    }
    const segmentos = await pagina.locator('main .segmento').count()
    if (segmentos < 20) {
      problemas.push(`El diario tiene ${segmentos} opciones para elegir y tendría que tener más de 20 (${tema})`)
    }
    await capturar(pagina, `9a-diario-${tema}`)
    await revisarDesborde(pagina, `El diario (${tema})`)

    // Y que lo que se toca quede guardado, que es lo único que esta pantalla
    // tiene que hacer bien. Sin esto podría dibujarse entera y no escribir nada.
    await pagina.getByRole('button', { name: '7-8', exact: true }).click()
    await pagina.waitForTimeout(400)
    await pagina.reload({ waitUntil: 'networkidle' })
    await pagina.waitForTimeout(600)
    const elegido = await pagina
      .getByRole('button', { name: '7-8', exact: true })
      .getAttribute('aria-pressed')
    if (elegido !== 'true') {
      problemas.push(`El diario no recuerda lo que se anotó: después de recargar, 7-8 quedó en ${elegido} (${tema})`)
    }

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

  // UN SOLO MUNDO: con el sistema en claro la app tiene que verse igual.
  // Es lo que reemplaza a la segunda pasada entera. Si alguien vuelve a meter
  // un override de `prefers-color-scheme`, esto lo agarra en una medición en
  // vez de en una captura que haya que mirar.
  const enClaro = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
    locale: 'es-AR',
  })
  const paginaClara = await enClaro.newPage()
  /*
   * EL ALTA TAMBIÉN ACÁ, Y SIN ESTO LOS DOS ÚLTIMOS CONTEXTOS NO VEÍAN LA APP.
   *
   * Son contextos nuevos: IndexedDB arranca vacío, `altaCompletadaEn` no
   * existe, y el portero de `App.tsx` redirige CUALQUIER ruta a `/alta`. Los
   * dos bloques de abajo medían la pantalla de bienvenida creyendo medir la
   * app — comprobado: `url` daba `/alta` en los dos.
   *
   * Con el fondo zafaba de casualidad, porque lo pinta `body` y es global.
   * Con el escritorio no: «la app en 1280 no queda rota» era, literalmente,
   * el desborde de la pantalla de alta a 1280.
   */
  await alta(paginaClara)
  const fondo = await paginaClara.evaluate(() => getComputedStyle(document.body).backgroundColor)
  if (fondo !== 'rgb(7, 9, 12)') {
    problemas.push(
      `Con el sistema en tema claro el fondo es ${fondo} y tiene que ser rgb(7, 9, 12): el sistema tiene un solo mundo.`,
    )
  }
  await enClaro.close()

  // La app también se usa en tablet y computadora: se revisa que no quede rota.
  const ancho = await navegador.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
    locale: 'es-AR',
  })
  const escritorio = await ancho.newPage()
  await alta(escritorio)
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
