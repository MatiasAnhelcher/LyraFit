/**
 * El pliegue, medido en vez de mirado.
 *
 * Esta app tiene una restricción que ya se rompió DOS veces y que hasta hoy se
 * verificaba a mano: en `Hoy`, el botón `Empezar` tiene doce píxeles de aire
 * sobre la barra de navegación en un Android de 360×640. Las dos veces la
 * rompió un renglón nuevo que parecía inofensivo, y la segunda la encontré
 * midiendo después de haberla publicado.
 *
 * Un comentario escrito cinco veces en el código no impide nada. Una medición
 * que corre en cada cambio, sí.
 *
 * Mide tres cosas, las tres con `boundingBox()` y no con el ojo:
 *
 *   1. `Empezar` con aire suficiente sobre la barra, en tres teléfonos, con
 *      hoy puesto como día de entrenar: es el estado alto, y el que ya se
 *      rompió. Un día de descanso sobran 188 px y uno de entrenar quedan 12.
 *   2. Los botones del descanso —`+30 s` y `Saltear`— adentro de la pantalla.
 *      Esta es la que decide si el aviso de "qué viene después" se queda en el
 *      descanso o se va: esa pantalla ya estaba a pocos píxeles del borde.
 *   3. La grilla de la semana en Ajustes, sin desborde y con las filas
 *      alcanzables con el dedo.
 *   4. El reloj: la pantalla de elegir sin desborde a lo ancho, y la PAUSA
 *      entera adentro de la pantalla. La pausa dura diez segundos y nadie
 *      scrollea con las manos en el piso: si la cuenta queda abajo del borde,
 *      no existe.
 *
 * Uso: npm run build && npx vite preview --port 4173, y después `node pliegue.mjs`.
 */

import { chromium } from 'playwright'

const BASE = 'http://localhost:4173'
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

/**
 * Los teléfonos.
 *
 * `exige` marca cuáles hacen fallar el portón. Los dos exigidos son los del
 * conjunto con el que esta app siempre midió. El de 320×568 se mide y se
 * informa pero no falla, y eso está dicho así a propósito: al agregarlo
 * aparecieron dos desbordes ANTERIORES a este cambio —la pantalla del descanso
 * termina abajo del borde y el botón "cómo se hace" se sale a lo ancho— y
 * hacer fallar el portón por deuda vieja lo volvería ruido que nadie mira.
 * Los números quedan impresos para que la deuda no se olvide.
 */
const TELEFONOS = [
  { nombre: '320×568', width: 320, height: 568, exige: false },
  { nombre: '360×640', width: 360, height: 640, exige: true },
  { nombre: '390×844', width: 390, height: 844, exige: true },
]

/**
 * Un fallo que solo cuenta en los teléfonos exigidos.
 *
 * Se llama `culpar` y no `anotar` porque adentro de `medirDescanso` ya hay una
 * `anotar` que anota una SERIE. Con el mismo nombre, esta función llamaba a la
 * otra sin esperarla y el portón moría con "la página se cerró" en vez de
 * decir qué había medido mal.
 */
function culpar(telefono, texto) {
  if (telefono.exige) fallos.push(texto)
  else deudas.push(texto)
}

/** Cuánto aire tiene que quedar entre la acción y la barra. Medido, no elegido. */
const AIRE_MINIMO = 12

const fallos = []
const deudas = []
const medidas = []

async function alta(p) {
  await p.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'Empezar', exact: true }).click()
  await p.getByRole('button', { name: 'Sí, tengo barra' }).click()
  await p.getByRole('button', { name: '12', exact: true }).click()
  await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await p.waitForTimeout(150)
  for (let i = 0; i < 3; i++) {
    for (let n = 0; n < 6; n++) await p.getByRole('button', { name: 'Sumar' }).click()
    const ver = p.getByRole('button', { name: 'Ver mi plan' })
    if (await ver.isVisible().catch(() => false)) await ver.click()
    else await p.getByRole('button', { name: 'Siguiente', exact: true }).click()
    await p.waitForTimeout(120)
  }
  await p.getByRole('button', { name: 'Seguir', exact: true }).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: /Cuerpo completo/ }).click()
  await p.waitForTimeout(600)
}

/** Quién se sale a lo ancho, con nombre y apellido. Suponerlo acusa al inocente. */
async function quienDesborda(p) {
  return p.evaluate(() => {
    const limite = document.documentElement.clientWidth
    let peor = null
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.right > limite + 0.5 && (!peor || r.right > peor.right)) {
        peor = {
          right: Math.round(r.right),
          que: `<${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 30)}"`,
        }
      }
    }
    return peor
  })
}

/**
 * Hoy, puesto como día de entrenar antes de medirlo.
 *
 * Sin esto el portón medía el día que le tocara correr. Con la rutina por
 * defecto —lunes, miércoles y viernes— un martes Hoy no dibuja las cuatro filas
 * de las cadenas y sobran 188 px de aire; un miércoles sí las dibuja y quedan
 * **12, que es exactamente el mínimo**. O sea que el portón pasaba cinco días
 * de cada siete sin mirar el único caso que puede romperse, y la regresión que
 * ya ocurrió dos veces es justo esa.
 *
 * Medido en 360×640: día de fuerza, 12 px; día de "las dos", 12 px también. No
 * hay lugar para un renglón más en Hoy, y por eso la fila del reloj se quedó en
 * Cadenas.
 */
async function ponerDiaDeEntrenar(p) {
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const hoy = DIAS[new Date().getDay()]
  await p.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  const fila = p.getByRole('button', { name: new RegExp(hoy) })
  // El ciclo es descanso → fuerza → las dos → fuelle, así que en tres toques se
  // llega desde cualquier estado. Se para en "las dos", que es el más alto.
  for (let i = 0; i < 4; i++) {
    if (/LAS DOS/i.test(await fila.innerText().catch(() => ''))) return true
    await fila.click()
    await p.waitForTimeout(250)
  }
  return /LAS DOS/i.test(await fila.innerText().catch(() => ''))
}

/**
 * Poner la rutina MÁS ALTA antes de medir Hoy.
 *
 * Hasta acá este portón medía con la rutina por defecto, que tiene cuatro
 * bloques. Las cuatro rutinas por grupo muscular tienen cinco, y cada fila de
 * Hoy mide 56 px: con la quinta, `Empezar` quedaría cuarenta y cuatro píxeles
 * por debajo de la barra de navegación.
 *
 * O sea que la regla del pliegue —que ya se rompió tres veces— pasó a poder
 * romperse SIN TOCAR UNA LÍNEA DE HOY: alcanzaría con elegir otra rutina en
 * Ajustes. Un portón que solo mide la rutina por defecto no habría visto nada.
 *
 * Hoy tiene un tope de cuatro filas y cuenta el resto en un renglón, y esto es
 * lo que verifica que ese tope esté puesto y alcance.
 */
async function ponerLaRutinaMasAlta(p) {
  await p.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)

  // LA BARRA PRIMERO, Y ESTO NO ES UN DETALLE.
  //
  // Dos de los cinco bloques de la rutina por grupo son accesorios con barra
  // cargable, y sin barra la pantalla no los dibuja —correctamente—. O sea
  // que elegir la rutina "alta" sin cargar la barra da TRES filas, no cinco,
  // y el portón mediría el caso fácil creyendo que mide el difícil. Lo
  // descubrí mirando una captura: la rutina estaba puesta y había tres filas.
  //
  // Un portón que cree medir el peor caso y mide otro es peor que no tenerlo.
  // `waitFor` y no `isVisible`: la fila de la barra solo aparece DESPUÉS de
  // que el peso esté cargado, y eso viaja por `liveQuery`. La primera versión
  // de esto esperaba 250 ms fijos y a veces llegaba tarde, así que el portón
  // medía tres filas creyendo medir cinco — justo el error que vino a evitar.
  const subir = async (titulo) => {
    const boton = p.getByRole('button', { name: `Subir ${titulo}` })
    await boton.waitFor({ state: 'visible', timeout: 5000 })
    await boton.click()
    await p.waitForTimeout(150)
  }
  // El peso arranca "sin decir" y sube desde 35; la barra, desde 0 de a 5.
  await subir('tu peso')
  await subir('barra cargable')

  const boton = p.getByRole('button', { name: /Pecho y core/ })
  if (!(await boton.isVisible().catch(() => false))) return false
  await boton.click()
  await p.waitForTimeout(400)

  // Y el día de entrenar OTRA VEZ, porque elegir un preset reescribe la
  // semana entera. `ponerDiaDeEntrenar` ya había forzado hoy a "las dos" para
  // la primera medición, y este clic lo pisa con los días del preset: si hoy
  // no es uno de ellos, Hoy no dibuja ninguna fila y el portón mide una
  // pantalla de descanso creyendo que mide la más alta.
  //
  // Pasó, y el síntoma era elocuente: cero filas y `Empezar` ciento trece
  // píxeles más arriba que en la medición anterior. Sin la verificación de
  // "¿son cinco filas?" habría pasado en verde con muchísimo aire.
  return ponerDiaDeEntrenar(p)
}

async function medirHoy(p, telefono, rutina) {
  // El ofrecimiento del fuelle se cierra: su fila también ocupa alto, y se mide
  // el estado en el que la app se abre veinte veces por semana, no el del
  // primer día.
  const ahoraNo = p.getByRole('button', { name: 'Ahora no' })
  if (await ahoraNo.isVisible().catch(() => false)) {
    await ahoraNo.click()
    await p.waitForTimeout(300)
  }

  // Al tope antes de medir: `boundingBox` es relativo al viewport, así que con
  // la página scrolleada el número da negativo y no quiere decir nada.
  await p.evaluate(() => window.scrollTo(0, 0))
  await p.waitForTimeout(200)

  const empezar = await p.getByRole('button', { name: /^Empezar$/ }).boundingBox()
  if (!empezar) {
    culpar(telefono, `[${telefono.nombre}] No se encontró el botón Empezar en Hoy (${rutina}).`)
    return
  }
  // El piso es la barra de navegación; si no hay, el borde de la pantalla.
  const nav = await p.locator('nav').first().boundingBox()
  const piso = nav ? nav.y : telefono.height
  const aire = piso - (empezar.y + empezar.height)
  medidas.push(
    `[${telefono.nombre}] Hoy (${rutina}) · Empezar termina en ${Math.round(empezar.y + empezar.height)}, la barra arranca en ${Math.round(piso)}: ${Math.round(aire)} px de aire.`,
  )
  // Medio píxel de tolerancia: el alto real es fraccionario y sin esto un aire
  // de 11,996 se imprime como 12 y falla, que es la peor clase de portón.
  if (aire + 0.5 < AIRE_MINIMO) {
    culpar(
      telefono,
      `[${telefono.nombre}] con la rutina "${rutina}", "Empezar" quedó a ${Math.round(aire)} px de la barra (hacen falta ${AIRE_MINIMO}). Es la regresión que ya pasó tres veces: algo nuevo lo empujó.`,
    )
  }
}

async function medirDescanso(p, telefono) {
  await p.getByRole('button', { name: /^Empezar$/ }).click()
  await p.waitForTimeout(600)

  const anotar = async () => {
    const voy = p.getByRole('button', { name: 'Voy', exact: true })
    if (await voy.isVisible().catch(() => false)) {
      await voy.click()
      await p.waitForTimeout(150)
    }
    await p.getByRole('button', { name: 'Anotar serie', exact: true }).click()
    await p.waitForTimeout(500)
  }

  /** Dónde termina el último botón del descanso. Es lo que decide si se ve. */
  const fondoDeLosBotones = async () => {
    let fondo = 0
    for (const nombre of ['+30 s', 'Saltear']) {
      const caja = await p.getByRole('button', { name: nombre, exact: true }).boundingBox()
      if (!caja) return null
      fondo = Math.max(fondo, caja.y + caja.height)
    }
    return fondo
  }

  // El descanso del MEDIO: el que esta entrega no tocó, y el más alto de los
  // dos porque lleva la indicación de técnica, que ocupa hasta tres renglones.
  //
  // Se mide en sus DOS formas, porque desde que el portón fuerza un día de "las
  // dos" el descanso arranca con ráfaga y la forma con ráfaga no es la más
  // alta. Primero como viene, y después con la ráfaga salteada —"Hoy no", que
  // la apaga para el resto de la sesión— que es la forma con Lyra y la
  // indicación de técnica. La vara es la peor de las dos.
  await anotar()
  const medioConRafaga = await fondoDeLosBotones()

  // "Hoy no" saltea ESA ráfaga y no las de la sesión: `rafagaSalteada` se
  // reinicia cuando arranca cada descanso. Medido, porque lo había supuesto al
  // revés y el portón acusó a la app de no mostrar un aviso que sí mostraba.
  const saltearRafaga = async () => {
    const hoyNo = p.getByRole('button', { name: 'Hoy no', exact: true })
    if (!(await hoyNo.isVisible().catch(() => false))) return false
    await hoyNo.click()
    await p.waitForTimeout(400)
    return true
  }

  await saltearRafaga()
  const medioConLyra = await fondoDeLosBotones()
  const medio =
    medioConRafaga === null || medioConLyra === null
      ? (medioConLyra ?? medioConRafaga)
      : Math.max(medioConRafaga, medioConLyra)

  await p.getByRole('button', { name: 'Saltear', exact: true }).click()
  await p.waitForTimeout(300)

  // Y el ÚLTIMO, que es el que lleva el aviso de lo que viene. Se le saltea la
  // ráfaga para medir la forma alta —Lyra, la frase y el aviso— que es la que
  // puede empujar los botones abajo del borde. Que el aviso aparezca también
  // durante el tramo de ráfaga es otra pregunta, y la respuesta es que no va
  // ahí: lo verifica `despues.mjs` esperando a que el tramo termine.
  await anotar()
  await saltearRafaga()
  const ultimo = await fondoDeLosBotones()

  if (medio === null || ultimo === null) {
    culpar(telefono, `[${telefono.nombre}] No se encontraron los botones del descanso.`)
    return
  }

  const despues = p.getByText(/^después ·/)
  if (!(await despues.isVisible().catch(() => false))) {
    // Esta sí falla siempre: es la función que se está entregando. Si no está,
    // no hay nada que medir.
    fallos.push(
      `[${telefono.nombre}] En el último descanso no apareció el aviso de lo que viene.`,
    )
  }

  medidas.push(
    `[${telefono.nombre}] Descanso · los botones terminan en ${Math.round(medio)} en el del medio y ${Math.round(ultimo)} en el último, de ${telefono.height}.`,
  )

  /*
   * La aserción que importa, y por qué NO es "que los botones entren".
   *
   * No entran, y no entraban antes de esta entrega: el descanso del medio
   * termina en 690 de 568 en el teléfono más chico, empujado por la indicación
   * de técnica de tres renglones. Poner "que entren" haría un portón que nace
   * en rojo y que por lo tanto nadie mira, que es peor que no tenerlo.
   *
   * Lo que sí se puede exigir es que lo agregado no empeore lo que había: el
   * último descanso —el que lleva el aviso— no puede irse MÁS abajo del borde
   * de lo que ya se iba el del medio, que nadie tocó. Es una vara que se
   * calibra sola, sin número mágico, y se rompe exactamente cuando alguien
   * agrega un renglón de más acá.
   *
   * Se compara lo que se sale, no el alto: en un teléfono donde las dos
   * pantallas entran enteras, doce píxeles más de alto no le hacen daño a
   * nadie, y hacer fallar el portón por eso sería medir la cosa equivocada.
   */
  const seVa = (fondo) => Math.max(0, fondo - telefono.height)
  if (seVa(ultimo) > seVa(medio)) {
    fallos.push(
      `[${telefono.nombre}] El último descanso se va ${Math.round(seVa(ultimo))} px abajo del borde, y el del medio se iba ${Math.round(seVa(medio))}. Lo que se agregó ahí empeoró una pantalla que ya estaba al borde.`,
    )
  }

  const ancho = await p.evaluate(() => document.documentElement.scrollWidth)
  if (ancho > telefono.width + 1) {
    const quien = await quienDesborda(p)
    culpar(
      telefono,
      `[${telefono.nombre}] El descanso desborda a lo ancho: ${ancho} px en ${telefono.width}. Lo empuja ${quien?.que ?? 'algo que ya no está'}.`,
    )
  }
}

async function medirSemana(p, telefono) {
  await p.goto(`${BASE}/#/ajustes`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)

  // Se toca un día para que la semana pase a ser propia, que es el estado nuevo
  // y el que puede desbordar: la fila del sábado pasa de "—" a "FUERZA + FUELLE",
  // que es el rótulo más largo de los cuatro.
  const sabado = p.getByRole('button', { name: /Sábado/ })
  if (!(await sabado.isVisible().catch(() => false))) {
    culpar(telefono, `[${telefono.nombre}] No se encontró la fila del sábado en la grilla de la semana.`)
    return
  }
  await sabado.click()
  await p.waitForTimeout(200)
  await sabado.click()
  await p.waitForTimeout(300)

  const caja = await sabado.boundingBox()
  if (caja && caja.height < 44) {
    culpar(
      telefono,
      `[${telefono.nombre}] La fila del sábado mide ${Math.round(caja.height)} px de alto: por debajo de los 44 que el sistema fija como mínimo táctil.`,
    )
  }
  if (caja) {
    medidas.push(`[${telefono.nombre}] Ajustes · la fila de un día mide ${Math.round(caja.height)} px de alto.`)
  }

  const ancho = await p.evaluate(() => document.documentElement.scrollWidth)
  if (ancho > telefono.width + 1) {
    const quien = await quienDesborda(p)
    culpar(
      telefono,
      `[${telefono.nombre}] Ajustes desborda a lo ancho: ${ancho} px en ${telefono.width}. Lo empuja ${quien?.que ?? 'algo que ya no está'}.`,
    )
  }
}

async function medirReloj(p, telefono) {
  await p.goto(`${BASE}/#/reloj`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)

  // La pantalla de elegir SÍ puede scrollear —cuatro formatos con su nota y
  // trece ejercicios no entran en 568 px y no tienen por qué— pero no puede
  // desbordar a lo ancho: las notas son el texto más largo de la app.
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth)
  if (ancho > telefono.width + 1) {
    const quien = await quienDesborda(p)
    culpar(
      telefono,
      `[${telefono.nombre}] El reloj desborda a lo ancho: ${ancho} px en ${telefono.width}. Lo empuja ${quien?.que ?? 'algo que ya no está'}.`,
    )
  }

  const filaTabata = p.getByRole('button', { name: /Tabata/ })
  const caja = await filaTabata.boundingBox()
  if (caja) {
    medidas.push(`[${telefono.nombre}] Reloj · la fila de un formato mide ${Math.round(caja.height)} px de alto.`)
    if (caja.height < 44) {
      culpar(
        telefono,
        `[${telefono.nombre}] La fila del formato mide ${Math.round(caja.height)} px: por debajo de los 44 del mínimo táctil.`,
      )
    }
  }

  // Y la PAUSA, que es el estado más alto del reloj corriendo: el arco, lo que
  // viene y la cuenta. Acá el scroll no es una opción —nadie scrollea con las
  // manos en el piso— así que tiene que entrar entera. Son treinta segundos de
  // espera porque el arco representa tiempo real y no hay forma de apurarlo.
  const primero = p.getByRole('button', { name: /Flexiones/ }).first()
  if (!(await primero.isVisible().catch(() => false))) {
    culpar(telefono, `[${telefono.nombre}] No se encontró ningún ejercicio para elegir en el reloj.`)
    return
  }
  await primero.click()
  await p.getByRole('button', { name: 'Empezar', exact: true }).click()
  await p.waitForTimeout(32_000)

  if (!(await p.getByText('AFLOJÁ').isVisible().catch(() => false))) {
    culpar(telefono, `[${telefono.nombre}] Treinta y dos segundos después de empezar, el reloj no estaba en la pausa.`)
    return
  }

  // Medir el fondo de `main` no servía: `main` lleva `flex-1`, así que su caja
  // llega siempre al borde y el número daba "568 de 568" en los tres teléfonos,
  // que es la clase de medición que parece tranquilizadora y no mide nada. Lo
  // que importa es si la página necesita scroll y dónde termina el botón de
  // sumar, que es lo último que se dibuja y lo que hay que poder tocar.
  const alto = await p.evaluate(() => document.documentElement.scrollHeight)
  const mas = await p.getByRole('button', { name: 'Sumar' }).boundingBox()
  const fondo = mas ? Math.round(mas.y + mas.height) : null
  medidas.push(
    `[${telefono.nombre}] Reloj · la pausa ocupa ${alto} px de ${telefono.height}; sumar termina en ${fondo ?? 'ninguna parte'}.`,
  )
  if (fondo === null) {
    culpar(telefono, `[${telefono.nombre}] En la pausa del reloj no hay con qué contar la vuelta.`)
  } else if (fondo > telefono.height || alto > telefono.height + 1) {
    culpar(
      telefono,
      `[${telefono.nombre}] La pausa del reloj no entra: ocupa ${alto} px y sumar termina en ${fondo}, de ${telefono.height}. Nadie scrollea en una pausa de diez segundos.`,
    )
  }

  const anchoCorriendo = await p.evaluate(() => document.documentElement.scrollWidth)
  if (anchoCorriendo > telefono.width + 1) {
    const quien = await quienDesborda(p)
    culpar(
      telefono,
      `[${telefono.nombre}] El reloj corriendo desborda a lo ancho: ${anchoCorriendo} px. Lo empuja ${quien?.que ?? 'algo que ya no está'}.`,
    )
  }

  await p.getByRole('button', { name: 'Salir', exact: true }).click()
  await p.waitForTimeout(300)
}

const navegador = await chromium.launch({ executablePath: CHROMIUM })

for (const telefono of TELEFONOS) {
  const contexto = await navegador.newContext({
    viewport: { width: telefono.width, height: telefono.height },
    locale: 'es-AR',
    // La zona horaria importa acá más que en ningún otro portón: qué día de
    // la semana es decide si Hoy dibuja la lista de ejercicios o la pantalla
    // de descanso, y sin esto el navegador usa UTC. A las nueve de la noche
    // de un viernes argentino, UTC ya es sábado: el portón medía la pantalla
    // de descanso de otro día y creía estar midiendo la de entrenar.
    timezoneId: 'America/Argentina/Buenos_Aires',
  })
  const pagina = await contexto.newPage()
  pagina.on('pageerror', (e) => fallos.push(`[${telefono.nombre}] Error de JavaScript: ${e.message}`))

  // Cada teléfono en su propio try: que uno se caiga no puede dejar sin medir a
  // los otros dos, que es justo cuando una regresión se escapa.
  try {
    await alta(pagina)
    if (!(await ponerDiaDeEntrenar(pagina))) {
      culpar(
        telefono,
        `[${telefono.nombre}] No se pudo poner hoy como día de entrenar, así que lo que se midió en Hoy no es el caso alto.`,
      )
    }
    // Primero con la rutina por defecto, que es la que usa casi todo el mundo.
    await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(600)
    await medirHoy(pagina, telefono, 'cuerpo completo')

    // Y después con la más alta, que es la que puede romperlo.
    if (!(await ponerLaRutinaMasAlta(pagina))) {
      culpar(
        telefono,
        `[${telefono.nombre}] No se pudo elegir la rutina por grupo, así que el caso alto de Hoy quedó sin medir.`,
      )
    } else {
      await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
      await pagina.waitForTimeout(600)

      /*
       * Que de verdad esté midiendo el caso alto.
       *
       * Lo que se cuenta es la SESIÓN, no las filas: Hoy muestra como mucho
       * cuatro —y tres cuando sobran, con el resto en una línea de rótulo—
       * justamente para no romper el pliegue, así que contar filas visibles
       * mediría el tope en vez del plan.
       *
       * La primera versión de esto exigía cinco filas visibles y fallaba con
       * el arreglo puesto: pedía ver exactamente lo que el arreglo existe para
       * no mostrar. Un portón que contradice al arreglo que lo hizo pasar está
       * midiendo la implementación y no la propiedad.
       *
       * La propiedad es: la sesión de hoy tiene cinco ejercicios, y Hoy los
       * CUENTA a todos aunque no los dibuje a todos.
       */
      const visibles = await pagina.locator('[data-prueba="plan-de-hoy"] > *').count()
      const resto = await pagina
        .locator('[data-prueba="resto-del-plan"]')
        .innerText()
        .catch(() => '')
      const ocultos = Number(resto.match(/\d+/)?.[0] ?? 0)
      if (visibles + ocultos < 5) {
        culpar(
          telefono,
          `[${telefono.nombre}] Con la rutina por grupo la sesión tiene ${visibles + ocultos} ejercicios (${visibles} dibujados + ${ocultos} contados) y el caso alto son 5. Falta la barra cargable: lo que se midió no es el peor caso.`,
        )
      }
      if (visibles > 4) {
        culpar(
          telefono,
          `[${telefono.nombre}] Hoy dibujó ${visibles} filas y el tope son 4. Con más, Empezar se va abajo de la barra: es la regla del pliegue, no una preferencia.`,
        )
      }
      await medirHoy(pagina, telefono, 'pecho y core')
    }

    await medirSemana(pagina, telefono)
    await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    await pagina.waitForTimeout(400)
    await medirDescanso(pagina, telefono)
    await medirReloj(pagina, telefono)
  } catch (e) {
    fallos.push(`[${telefono.nombre}] El recorrido se cortó: ${e.message.split('\n')[0]}`)
  }

  await contexto.close()
}

await navegador.close()

for (const linea of medidas) console.log(linea)

if (deudas.length > 0) {
  console.log(
    '\nDeuda vieja en 320×568, anterior a este portón y que no lo hace fallar:\n' +
      deudas.map((d) => `· ${d}`).join('\n'),
  )
}

if (fallos.length > 0) {
  console.error('\n' + fallos.map((f) => `· ${f}`).join('\n'))
  process.exit(1)
}

console.log('\nLa acción de Hoy tiene su aire y nada nuevo se fue abajo del pliegue.')
