/**
 * EL PORTÓN DEL MOVIMIENTO.
 *
 * Tres reglas del sistema estaban escritas como comentarios y nada más:
 *
 *   1. Nada se mueve durante el esfuerzo.
 *   2. Con movimiento reducido —el del teléfono o el interruptor de Ajustes—
 *      todo queda quieto SIN PERDER INFORMACIÓN.
 *   3. Hay un solo `infinite` en toda la app, y es Lyra respirando.
 *
 * Las tres se erosionaron. El comentario de `figura.tsx` seguía diciendo
 * "cinco animaciones en toda la aplicación" cuando ya había ocho, y dos
 * líneas más abajo del propio comentario que lo prometía, Lyra metía un
 * segundo `infinite`. Un comentario no sostiene una regla: solo la documenta
 * hasta que alguien no lo lee.
 *
 * Esto las mide con `getAnimations()`, que devuelve lo que el navegador está
 * corriendo de verdad — no lo que el CSS declara, que es distinto en cuanto
 * hay una cascada o un `!important` de por medio.
 */

import { BASE, abrir, alta, completarUnaSesion, conLaBase, revisarQueSirvaLoCompilado } from './lib/portones.mjs'

const fallos = []

/**
 * Un problema se dice una vez.
 *
 * Una regla rota en un componente que la pantalla repite veinte veces es un
 * problema, no veinte. La primera corrida de esto escupió la misma línea
 * cuatro veces seguidas y el informe dejó de leerse.
 */
/**
 * Los elementos cuyo estado final hay que verificar con movimiento reducido.
 *
 * Arriba y no adentro del `evaluate`, para que el portón pueda contar cuántos
 * encontró y plantarse si no encontró ninguno.
 */
/*
 * Van en DOS grupos porque viven en dos lugares distintos, y confundirlos fue
 * el defecto.
 *
 * `.entrar-en-orden` está en Hoy, Cadenas, Progreso y el Diario: cualquier
 * ruta lo encuentra. Las otras cuatro existen ÚNICAMENTE en el cierre y en la
 * barra de cadena que el cierre llena, y al cierre no se llega navegando: hay
 * que entrenar la sesión entera.
 *
 * Con los seis en una sola lista, el guardián «¿encontré alguno?» se
 * satisfacía con los diez `.entrar-en-orden` de las rutas comunes mientras
 * las cuatro del cierre daban CERO en todas. Medía 10 y creía medir 6 clases.
 * Por eso ahora se cuenta por selector y se nombra el que falta.
 *
 * `.entrar` no está en ninguno de los dos grupos y no es un olvido: la regla
 * existe en `estilos.css` pero ningún componente aplica esa clase. Pedirla
 * haría fallar el portón para siempre por una línea de CSS sin usar.
 */
const DE_ENTRADA = ['.entrar-en-orden']
const DEL_CIERRE = ['.revelar', '.anim-estrella', '.anim-regla', '.anim-llenar']
const SOSPECHOSAS = [...DE_ENTRADA, ...DEL_CIERRE]

const dichos = new Set()
const anotar = (linea) => {
  if (dichos.has(linea)) return
  dichos.add(linea)
  fallos.push(linea)
}

/** Lo que el navegador está animando ahora mismo, con nombre y dueño. */
const corriendo = (p) =>
  p.evaluate(() =>
    document.getAnimations().map((a) => ({
      nombre: a.animationName ?? a.transitionProperty ?? '(sin nombre)',
      tipo: a.constructor.name,
      infinito: a.effect?.getTiming?.().iterations === Infinity,
      // Una animación atada al scroll o a la vista de un elemento corre
      // cuando el dedo se mueve, no cuando el reloj avanza: ninguna de las
      // reglas de abajo la vería como lo que es.
      delDocumento: a.timeline === document.timeline,
      objetivo: (() => {
        const el = a.effect?.target
        if (!el || !el.tagName) return '(?)'
        const clase = typeof el.className === 'string' ? el.className.split(' ')[0] : ''
        return `${el.tagName.toLowerCase()}${clase ? '.' + clase : ''}`
      })(),
      estado: a.playState,
    })),
  )

/** Ninguna animación con otra línea de tiempo que `document.timeline`. */
function revisarLineasDeTiempo(lista, nombre) {
  for (const a of lista.filter((x) => !x.delDocumento)) {
    anotar(
      `[${nombre}] "${a.nombre}" sobre ${a.objetivo} no corre sobre document.timeline: una animación atada al scroll se mueve con el dedo y se saltea todas las reglas de este portón.`,
    )
  }
}

/**
 * Los ganchos, puestos antes de que corra una sola línea de la app.
 *
 * Cuentan dos cosas que el CSS no muestra: cuántas veces se llamó a
 * `startViewTransition` —con movimiento reducido no tiene que haber
 * ninguna, y un pasaje con duración cero sigue siendo un pasaje— y cuántos
 * cuadros pidió el JavaScript. La figura se anima con `requestAnimationFrame`
 * y no con CSS, así que `getAnimations()` no la ve nunca: quieta en
 * apariencia y despertando a React sesenta veces por segundo es justo lo
 * que hacía antes con `animar={false}`.
 *
 * Cada pasaje guarda su comienzo, su `finished` y lo que corría cuando
 * arrancó, para la puerta: si algún día la puerta tiene pasaje (la Tarjeta
 * 1), este mismo portón mide que sea el que dice la especificación.
 */
function instalarGanchos() {
  window.__pasajes = []
  const original = Document.prototype.startViewTransition
  if (original) {
    Document.prototype.startViewTransition = function (...args) {
      const t = original.apply(this, args)
      const registro = { inicio: performance.now(), fin: null, durante: null }
      window.__pasajes.push(registro)
      t.ready.then(
        () => {
          registro.durante = document.getAnimations().map((a) => {
            const efecto = a.effect
            const tiempo = efecto?.getTiming?.() ?? {}
            const objetivo = efecto?.target
            return {
              pseudo: efecto?.pseudoElement ?? null,
              nombre: a.animationName ?? a.transitionProperty ?? '(sin nombre)',
              tipo: a.constructor.name,
              total: (Number(tiempo.duration) || 0) + (Number(tiempo.delay) || 0),
              enElEsfuerzo: !!objetivo?.closest?.('.pantalla-esfuerzo'),
            }
          })
        },
        () => {},
      )
      t.finished.then(
        () => (registro.fin = performance.now()),
        () => (registro.fin = performance.now()),
      )
      return t
    }
  }
  window.__cuadros = 0
  const real = window.requestAnimationFrame.bind(window)
  window.__rafReal = real
  window.requestAnimationFrame = (cb) => {
    window.__cuadros++
    return real(cb)
  }
}

/**
 * Lo quieta que está la pantalla durante `ms`: los cuadros pedidos, los
 * cambios adentro de Lyra (atributos, hijos o texto: parpadear cambia el
 * dibujo de los ojos, mirar mueve un `transform`), los `data-viva` y
 * `data-animada` que siguen en verdadero, y si `latir` está corriendo.
 *
 * Mientras mide, el puntero se pasea por la pantalla: Lyra viva lo sigue
 * con los ojos, así que quieta tampoco tiene que mirarlo.
 */
async function quietud(p, ms) {
  const medicion = medirQuietud(p, ms)
  for (let i = 0; i < Math.floor(ms / 300); i++) {
    await p.mouse.move(30 + ((i * 67) % 300), 90 + ((i * 131) % 480)).catch(() => {})
    await p.waitForTimeout(300)
  }
  return medicion
}

const medirQuietud = (p, ms) =>
  p.evaluate(async (ms) => {
    const lyras = [...document.querySelectorAll('.lyra')]
    let cambios = 0
    const vigia = new MutationObserver((l) => (cambios += l.length))
    for (const l of lyras) vigia.observe(l, { attributes: true, childList: true, subtree: true, characterData: true })
    const antes = window.__cuadros
    await new Promise((r) => setTimeout(r, ms))
    vigia.disconnect()
    return {
      lyras: lyras.length,
      cambios,
      cuadros: window.__cuadros - antes,
      vivas: document.querySelectorAll('[data-viva="true"]').length,
      animadas: document.querySelectorAll('[data-animada="true"]').length,
      quietas: document.querySelectorAll('[data-animada="false"]').length,
      late: document.getAnimations().some((a) => a.animationName === 'latir' && a.playState === 'running'),
      // Los ojos que siguen al puntero llevan un `translate`; los de arco
      // (contenta, festejo) no se mueven nunca, ni con Lyra viva.
      ojosQueSiguen: lyras.some((l) => l.dataset.viva === 'true' && l.querySelector('g[transform^="translate"]')),
    }
  }, ms)

const cuantosPasajes = (p) => p.evaluate(() => window.__pasajes?.length ?? -1)

/**
 * Ir por la interfaz, como una persona, y esperar a que la ruta cambie.
 * Devuelve false si no cambió: un recorrido que no llegó no midió nada.
 */
async function tocarYLlegar(p, locator, ruta) {
  await locator.first().click()
  return p
    .waitForFunction(
      (r) => (r === '/' ? location.hash === '#/' || location.hash === '' : location.hash.startsWith(`#${r}`)),
      ruta,
      { timeout: 3000 },
    )
    .then(() => true)
    .catch(() => false)
}

const LA_BARRA = [
  ['nav-cadenas', '/biblioteca'],
  ['nav-diario', '/diario'],
  ['nav-progreso', '/progreso'],
  ['nav-ajustes', '/ajustes'],
  ['nav-hoy', '/'],
]

/** Las cinco pestañas por la barra. Devuelve las que no llegaron. */
async function recorrerLaBarra(p) {
  const sinLlegar = []
  for (const [prueba, ruta] of LA_BARRA) {
    if (!(await tocarYLlegar(p, p.locator(`[data-prueba="${prueba}"]`), ruta))) sinLlegar.push(ruta)
    await p.waitForTimeout(450)
  }
  return sinLlegar
}

/**
 * Las animaciones de CSS que terminan y están corriendo: todas menos `latir`.
 * Las transiciones no cuentan: la perilla se corre con una, y es el toque.
 */
const finitasCorriendo = (p) =>
  p.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a instanceof CSSAnimation && a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)
      .map((a) => a.animationName),
  )

/**
 * El interruptor de Ajustes, leído como lo lee una persona: "Como en tu
 * teléfono" cuenta si se ve, porque su renglón queda reservado (invisible)
 * cuando el valor es explícito. Y dónde está la perilla, en coordenadas de
 * documento, para ver que no salte con el toque. Se mide quieta: la entrada
 * de la pantalla la trae 4 px más abajo, y eso es llegar, no saltar.
 */
async function leerElInterruptor(p) {
  const boton = p.getByRole('button', { name: /Movimiento reducido/ })
  await boton.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {})
  if (!(await boton.isVisible().catch(() => false))) return null
  for (let i = 0; i < 20 && (await finitasCorriendo(p)).length > 0; i++) await p.waitForTimeout(100)
  return {
    boton,
    dice: await boton.getAttribute('aria-pressed'),
    comoElTelefono: await boton.getByText('Como en tu teléfono', { exact: true }).isVisible(),
    raiz: await p.evaluate(() => document.documentElement.getAttribute('data-movimiento')),
    perilla: await boton.locator('.interruptor').evaluate((el) => {
      const c = el.getBoundingClientRect()
      return { x: c.left + window.scrollX, y: c.top + window.scrollY, ancho: c.width, alto: c.height }
    }),
  }
}

/** Si la perilla quedó en otra caja después del toque. Medio píxel de redondeo. */
const perillaMovida = (antes, despues) =>
  !despues ||
  ['x', 'y', 'ancho', 'alto'].some((k) => Math.abs(antes.perilla[k] - despues.perilla[k]) > 0.5)

async function main() {
  await revisarQueSirvaLoCompilado(BASE)

  // ── 1. El esfuerzo: nada se mueve ──────────────────────────────────────
  {
    const { navegador, contexto, pagina } = await abrir({ fallos })
    await contexto.addInitScript(instalarGanchos)
    await alta(pagina)

    /*
     * POR LA PUERTA, Y MEDIDO DESDE EL TOQUE.
     *
     * Antes se entraba con `goto('#/entrenar')`, que no pasa por donde pasa
     * una persona: el `goto` recarga, y el esfuerzo arrancaba siempre de cero
     * y sin nada de Hoy encima. Ahora se toca Empezar y se mide desde ese
     * toque. Por defecto la puerta es un corte, y entonces el atributo tiene
     * que estar en el primer cuadro: si llega un cuadro tarde, ese cuadro
     * dibuja el esfuerzo con las reglas de Hoy.
     */
    const empezar = pagina.getByRole('button', { name: 'Empezar', exact: true })
    await empezar.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    if (!(await empezar.isVisible().catch(() => false))) {
      fallos.push('En Hoy no apareció "Empezar": la puerta quedó sin medir. Este bloque no está en verde: está ciego.')
    }
    await pagina.evaluate(() => {
      const raiz = document.documentElement
      window.__puerta = { toque: null, marca: null, enElPrimerCuadro: null, pasajesAntes: window.__pasajes.length }
      new MutationObserver(() => {
        if (raiz.dataset.pantalla === 'entrenar' && window.__puerta.marca === null) window.__puerta.marca = performance.now()
      }).observe(raiz, { attributes: true, attributeFilter: ['data-pantalla'] })
      // En captura y en `window`: corre antes que el botón. El cuadro que se
      // pide acá es el primero que se dibuja después del toque.
      window.addEventListener(
        'click',
        () => {
          window.__puerta.toque = performance.now()
          window.__rafReal(() => (window.__puerta.enElPrimerCuadro = raiz.dataset.pantalla === 'entrenar'))
        },
        { capture: true, once: true },
      )
    })
    await empezar.click().catch(() => {})
    // Sin esperas fijas: hasta 1500 ms, y en cuanto aparece se sigue.
    await pagina
      .waitForFunction(() => document.documentElement.dataset.pantalla === 'entrenar', null, { timeout: 1500 })
      .catch(() => {})
    const puerta = await pagina.evaluate(() => {
      const nuevos = window.__pasajes.slice(window.__puerta.pasajesAntes)
      return { ...window.__puerta, pasajes: nuevos }
    })
    if (puerta.toque === null) {
      fallos.push('El toque en Empezar no llegó a la página: la puerta quedó sin medir.')
    } else if (puerta.pasajes.length === 0) {
      // El corte: lo que rige mientras la Tarjeta 1 no esté programada.
      if (puerta.enElPrimerCuadro !== true) {
        fallos.push(
          'La puerta es un corte pero el primer cuadro después de tocar Empezar todavía no tiene data-pantalla="entrenar": ese cuadro dibuja el esfuerzo con las reglas de Hoy.',
        )
      }
    } else {
      // El pasaje de la puerta (Tarjeta 1): uno solo, corto, y nada adentro
      // del esfuerzo moviéndose mientras dura.
      if (puerta.pasajes.length > 1) {
        fallos.push(`Tocar Empezar arrancó ${puerta.pasajes.length} pasajes. La puerta es uno.`)
      }
      const [pasaje] = puerta.pasajes
      if (pasaje.fin === null || pasaje.fin - puerta.toque > 430) {
        fallos.push(
          `El pasaje de la puerta terminó ${pasaje.fin === null ? 'nunca' : `a los ${Math.round(pasaje.fin - puerta.toque)} ms`} del toque. Tiene que ser a 430 ms o menos.`,
        )
      }
      for (const a of pasaje.durante ?? []) {
        if (a.tipo !== 'CSSAnimation' && a.tipo !== 'Animation') continue
        if (!a.pseudo?.startsWith('::view-transition')) {
          anotar(`Durante el pasaje de la puerta corre "${a.nombre}", que no es del pasaje. Hasta finished solo se mueve el pasaje.`)
        } else if (a.total > 280) {
          anotar(`En la puerta, ${a.pseudo} dura ${a.total} ms con su espera. Como mucho, 280.`)
        }
        if (a.enElEsfuerzo) anotar(`En la puerta se anima "${a.nombre}" adentro de .pantalla-esfuerzo.`)
      }
    }

    const pantalla = await pagina.evaluate(() => document.documentElement.dataset.pantalla)
    if (pantalla !== 'entrenar') {
      fallos.push(`No se llegó a entrenar: data-pantalla es "${pantalla}". El resto de esta medición no vale.`)
    }

    const todasAlEntrar = await corriendo(pagina)
    revisarLineasDeTiempo(todasAlEntrar, 'Entrenar')
    const vivas = todasAlEntrar.filter(
      (a) => a.tipo === 'CSSAnimation' && a.estado === 'running',
    )
    for (const a of vivas) {
      anotar(
        `Durante el esfuerzo corre la animación "${a.nombre}" sobre ${a.objetivo}. Bajo [data-pantalla='entrenar'] no se mueve nada.`,
      )
    }

    /*
     * Y el descanso, que es donde más tentador es meter algo.
     *
     * El botón se llama `botonAnotar` y no `anotar`, y el nombre importa: la
     * versión anterior lo declaraba como `const anotar` en ESTE mismo bloque,
     * donde más arriba se llama a la función `anotar` del módulo. Por `const`
     * y zona muerta temporal, aquellas llamadas resolvían al locator y tiraban
     * `ReferenceError: Cannot access 'anotar' before initialization`.
     *
     * O sea que este portón explotaba exactamente cuando ENCONTRABA algo, y
     * pasaba en verde cuando no encontraba nada. La regla 1 —"nada se mueve
     * durante el esfuerzo"— nunca se reportó una sola vez.
     *
     * Y me engañó dos veces: cuando probé este portón por mutación, lo que
     * mutaba lo agarraba la sección 2, que está en otro bloque y no tenía el
     * problema. Vi el portón fallar y di por probada la sección equivocada.
     */
    /*
     * «VOY» PRIMERO, Y ESTE BLOQUE NO CORRIÓ NUNCA HASTA ACÁ.
     *
     * La primera serie de cada ejercicio arranca con la predicción del motor,
     * y el botón que la cierra se llama «Voy». Hasta que no se toca, «Anotar
     * serie» NO EXISTE en el árbol: los botones de la pantalla son SALIR,
     * CÓMO SE HACE, −, +, VOY y SALTEAR ESTE EJERCICIO.
     *
     * O sea que el `isVisible()` de abajo daba false, el `if` no entraba, y
     * las líneas que miden el descanso no se ejecutaban jamás. La regla «nada
     * se mueve durante el descanso» y la comprobación de que el arco sigue
     * vivo estuvieron declaradas y sin medir desde que se escribieron.
     *
     * Y es el segundo defecto distinto en el MISMO bloque: antes era un
     * `const anotar` que pisaba la función del módulo. Arreglé aquel, vi el
     * portón en verde, y di por medido un bloque que seguía sin ejecutarse.
     *
     * Por eso ahora, si después de «Voy» tampoco aparece «Anotar serie», eso
     * se REPORTA. Un bloque que no puede medir no está en verde: está ciego,
     * y la diferencia tiene que llegar a la salida.
     */
    /*
     * «CÓMO SE HACE», que se abre en medio del esfuerzo.
     *
     * La figura de adentro se anima con `requestAnimationFrame`, que
     * `getAnimations()` no ve: por eso se cuentan los cuadros. Tiene que
     * estar en sus dos posturas, quieta, y sin pedir un solo cuadro.
     */
    const comoSeHace = pagina.getByRole('button', { name: 'cómo se hace', exact: true })
    if (await comoSeHace.isVisible().catch(() => false)) {
      await comoSeHace.click()
      await pagina.getByRole('dialog').waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
      const q = await quietud(pagina, 2000)
      if (q.quietas === 0) {
        fallos.push('En "Cómo se hace" no apareció ninguna figura con data-animada="false": la figura quedó sin medir.')
      }
      if (q.animadas > 0) anotar(`En "Cómo se hace" hay ${q.animadas} figura(s) con data-animada="true". En el esfuerzo la figura va quieta, en sus dos posturas.`)
      if (q.cuadros > 0) anotar(`En "Cómo se hace" se pidieron ${q.cuadros} cuadros en 2 s. Quieta no pide ninguno.`)
      for (const a of (await corriendo(pagina)).filter((x) => x.tipo === 'CSSAnimation' && x.estado === 'running')) {
        anotar(`En "Cómo se hace" corre la animación "${a.nombre}" sobre ${a.objetivo}. Abre en seco y no se mueve.`)
      }
      await pagina.getByRole('button', { name: 'Volver a la serie' }).click()
      await pagina.waitForTimeout(250)
    } else {
      fallos.push('En la serie no apareció "cómo se hace": la figura en el esfuerzo quedó sin medir. Este bloque no está en verde: está ciego.')
    }

    const voy = pagina.getByRole('button', { name: 'Voy', exact: true })
    if (await voy.isVisible().catch(() => false)) {
      await voy.click()
      await pagina.waitForTimeout(250)
    }
    const botonAnotar = pagina.getByRole('button', { name: 'Anotar serie', exact: true })
    if (await botonAnotar.isVisible().catch(() => false)) {
      await botonAnotar.click()
      await pagina.waitForTimeout(1600)
      const enDescanso = (await corriendo(pagina)).filter(
        (a) => a.tipo === 'CSSAnimation' && a.estado === 'running',
      )
      for (const a of enDescanso) {
        anotar(`Durante el DESCANSO corre la animación "${a.nombre}" sobre ${a.objetivo}.`)
      }
      // El arco TIENE que estar andando: es el reloj, y apagarlo sería perder
      // el dato. Si esto falla, el interruptor se pasó de ancho.
      const hayArco = await pagina.locator('.arco-descanso').count()
      if (hayArco === 0) {
        fallos.push('En el descanso no hay arco: el interruptor de movimiento se llevó puesto el reloj.')
      }

      /*
       * Lyra en el descanso: seis segundos mirándola.
       *
       * Parpadea cada dos a cinco segundos y medio cuando está viva, así que
       * en seis un vigía sobre ella ve cambios seguro. Quieta no tiene que
       * ver ninguno, y ni ella ni la figura piden cuadros.
       */
      const q = await quietud(pagina, 6000)
      if (q.lyras === 0) {
        fallos.push('En el descanso no hay ninguna Lyra: el vigía no tuvo a quién mirar. Este bloque no está en verde: está ciego.')
      }
      if (q.cambios > 0) anotar(`En 6 s de descanso Lyra cambió ${q.cambios} veces (parpadeo o mirada). En el esfuerzo está quieta.`)
      if (q.cuadros > 0) anotar(`En 6 s de descanso se pidieron ${q.cuadros} cuadros de animación. En el esfuerzo no se pide ninguno.`)
      if (q.vivas > 0) anotar(`En el descanso hay ${q.vivas} elemento(s) con data-viva="true".`)
      if (q.animadas > 0) anotar(`En el descanso hay ${q.animadas} figura(s) con data-animada="true".`)
    } else {
      fallos.push(
        'No se pudo anotar una serie, así que el DESCANSO quedó sin medir. Este bloque no está en verde: está ciego.',
      )
    }

    await navegador.close()
  }

  // ── 2. Un solo `infinite` en toda la app ───────────────────────────────
  {
    const { navegador, pagina } = await abrir({ fallos })
    await alta(pagina)

    for (const [ruta, nombre] of [
      ['/', 'Hoy'],
      ['/biblioteca', 'Cadenas'],
      ['/progreso', 'Progreso'],
      ['/ajustes', 'Ajustes'],
      ['/estado', 'Estado'],
      ['/molestia', 'Molestia'],
      ['/reloj', 'El reloj'],
    ]) {
      await pagina.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' })
      await pagina.waitForTimeout(700)
      const todas = await corriendo(pagina)
      revisarLineasDeTiempo(todas, nombre)
      const infinitas = todas.filter((a) => a.infinito)
      const ajenas = infinitas.filter((a) => a.nombre !== 'latir')
      for (const a of ajenas) {
        anotar(
          `[${nombre}] "${a.nombre}" sobre ${a.objetivo} corre para siempre. El único infinito del sistema es "latir", que es Lyra respirando.`,
        )
      }
      if (infinitas.length > 1) {
        anotar(
          `[${nombre}] hay ${infinitas.length} animaciones infinitas a la vez. Tiene que haber como mucho una.`,
        )
      }
    }
    await navegador.close()
  }

  // ── 3. Movimiento reducido: quieto, y sin perder información ───────────
  //
  // Esta es la que de verdad importa y la más fácil de arruinar. Apagar una
  // animación con `animation: none` deja el elemento en su estado INICIAL, y
  // el estado inicial de casi todas estas primitivas es "invisible". O sea:
  // alguien con movimiento reducido no vería el dato en absoluto. Por eso lo
  // que se mide no es "está quieto" sino "está quieto Y SE VE".
  {
    const { navegador, contexto, pagina } = await abrir({ fallos })
    await contexto.addInitScript(instalarGanchos)
    await contexto.addInitScript(() => {
      // El emulateMedia de Playwright llega después del primer render en
      // algunas rutas; esto lo deja puesto desde el arranque.
      const real = window.matchMedia.bind(window)
      window.matchMedia = (q) =>
        q.includes('prefers-reduced-motion: reduce')
          ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }
          : real(q)
    })
    await pagina.emulateMedia({ reducedMotion: 'reduce' })
    await alta(pagina)

    /*
     * POR LA INTERFAZ, Y CONTANDO PASAJES.
     *
     * Con movimiento reducido no hay ni un `startViewTransition`: ni en los
     * pasos del alta que acaba de pasar, ni en la barra, ni yendo a una
     * ficha o a la molestia y volviendo. Se navega tocando, porque un `goto`
     * no pasa nunca por `irA` y daría cero sin probar nada.
     */
    {
      const sinLlegar = await recorrerLaBarra(pagina)
      if (await tocarYLlegar(pagina, pagina.locator('[data-prueba="nav-cadenas"]'), '/biblioteca')) {
        await pagina.waitForTimeout(300)
        if (!(await tocarYLlegar(pagina, pagina.locator('main a[href*="/biblioteca/"]'), '/biblioteca/'))) sinLlegar.push('una ficha')
        await pagina.waitForTimeout(500)
        const q = await quietud(pagina, 300)
        if (q.quietas === 0) fallos.push('[La ficha, movimiento reducido] no hay figura con data-animada="false": la figura quedó sin medir.')
        if (q.animadas > 0) anotar('[La ficha, movimiento reducido] la figura sigue con data-animada="true".')
      } else sinLlegar.push('/biblioteca')
      if (await tocarYLlegar(pagina, pagina.locator('[data-prueba="nav-hoy"]'), '/')) {
        await pagina.waitForTimeout(300)
        if (await tocarYLlegar(pagina, pagina.locator('[data-prueba="avisar-molestia"]'), '/molestia')) {
          await pagina.waitForTimeout(300)
          if (!(await tocarYLlegar(pagina, pagina.getByRole('button', { name: 'Volver', exact: true }), '/'))) sinLlegar.push('la vuelta de la molestia')
        } else sinLlegar.push('/molestia')
      }
      if (sinLlegar.length > 0) {
        fallos.push(`[Movimiento reducido] no se llegó por la interfaz a ${sinLlegar.join(', ')}: esos pasajes quedaron sin contar.`)
      }
      const pasajes = await cuantosPasajes(pagina)
      if (pasajes !== 0) {
        fallos.push(
          `[Movimiento reducido] se llamó ${pasajes} ${pasajes === 1 ? 'vez' : 'veces'} a startViewTransition entre el alta, la barra, la ficha y la molestia. Tienen que ser cero: un pasaje sin animación sigue congelando la pantalla un cuadro.`,
        )
      }
    }

    /*
     * LAS RUTAS, Y POR QUÉ ESTA LISTA NO ES LA OBVIA.
     *
     * La versión anterior recorría Hoy, Cadenas, Progreso y el Reloj, y
     * buscaba seis selectores de los cuales CUATRO solo existen en el cierre:
     * `.revelar`, `.anim-regla`, `.anim-llenar` y `.anim-estrella` son la
     * coreografía de esa pantalla y de ninguna otra. El bloque que el propio
     * comentario llama «la que de verdad importa» barría cuatro pantallas
     * donde no había nada que mirar.
     *
     * Así que se verifica que al menos un selector esté presente en algún
     * lado: un portón que no encuentra su objeto no está en verde, está
     * ciego, y la diferencia tiene que ser visible.
     */
    /*
     * Cuántas veces se vio CADA selector, no cuántos elementos en total.
     *
     * El guardián anterior sumaba todo en un contador y preguntaba si era
     * cero. Los diez `.entrar-en-orden` de las rutas comunes lo dejaban en
     * diez, así que nunca disparaba — mientras las cuatro primitivas del
     * cierre, que son las que el comentario de arriba llama «la que de verdad
     * importa», daban cero en las cinco rutas. El guardián que puse para que
     * este bloque no quedara ciego estaba ciego él mismo.
     */
    const vistos = Object.fromEntries(SOSPECHOSAS.map((s) => [s, 0]))

    const mirar = async (nombre) => {
      for (const sel of SOSPECHOSAS) vistos[sel] += await pagina.locator(sel).count()

      const vivas = (await corriendo(pagina)).filter(
        (a) => a.tipo === 'CSSAnimation' && a.estado === 'running',
      )
      for (const a of vivas) {
        anotar(`[${nombre}, movimiento reducido] todavía corre "${a.nombre}" sobre ${a.objetivo}.`)
      }

      // Y nada quedó invisible por haberse apagado a mitad de camino.
      const invisibles = await pagina.evaluate((sospechosas) => {
        const salida = []
        for (const sel of sospechosas) {
          for (const el of document.querySelectorAll(sel)) {
            const e = getComputedStyle(el)
            const op = Number(e.opacity)
            if (op < 0.99) salida.push(`${sel} quedó en opacidad ${op}`)
            if (sel === '.anim-regla' && e.transform.includes('matrix') && e.transform.startsWith('matrix(0')) {
              salida.push('.anim-regla quedó en scaleX(0): la regla no se imprimió nunca')
            }
            // El relleno de la barra entra con `scaleX` desde la izquierda. Si
            // la animación se apagara a mitad de camino sin que el estado
            // final sea el propio del elemento, quedaría en `scaleX(0)`: el
            // eslabón nuevo vacío justo el día que lo ganaste.
            if (sel === '.anim-llenar' && e.transform.startsWith('matrix(0')) {
              salida.push('.anim-llenar quedó en scaleX(0): el relleno del eslabón nuevo no entró nunca')
            }
            // Y que tenga ancho de verdad: la regla de arriba no ve un relleno
            // que se dibujó con ancho cero, que se ve igual de vacío. Se
            // compara el número y no el texto: Chrome normaliza "0.00%" a
            // "0%", y un relleno en el piso de la ventana mide cero con
            // derecho.
            if (sel === '.anim-llenar' && parseFloat(el.style.width) > 0 && el.getBoundingClientRect().width < 0.5) {
              salida.push(`.anim-llenar mide ${el.getBoundingClientRect().width} px de ancho y tenía que medir ${el.style.width}`)
            }
          }
        }
        return salida
      }, SOSPECHOSAS)
      for (const i of invisibles) {
        anotar(
          `[${nombre}, movimiento reducido] ${i}. Con movimiento reducido la información se CONGELA, no desaparece: el estado tiene que ser el final.`,
        )
      }
    }

    for (const [ruta, nombre] of [
      ['/', 'Hoy'],
      ['/biblioteca', 'Cadenas'],
      ['/progreso', 'Progreso'],
      ['/reloj', 'El reloj'],
      ['/diario', 'El diario'],
    ]) {
      await pagina.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' })
      await pagina.waitForTimeout(800)
      await mirar(nombre)
    }

    /*
     * Y EL CIERRE, que es donde viven las cuatro que importan.
     *
     * No hay ruta: hay que entrenar la sesión entera. Eso es lo que hace
     * `completarUnaSesion`, y si no llega lo dice en vez de devolver una
     * pantalla cualquiera — que es exactamente cómo este bloque venía
     * midiendo cero elementos y saliendo en verde.
     *
     * Y de paso el descanso, que es la pantalla donde más tiempo está la
     * vista —unos veinte minutos por sesión— y que con movimiento reducido
     * también tiene que quedar quieta. Se mide al pasar, con el gancho, y
     * después se saltea: esperarla de verdad son minutos y el recorrido no
     * llegaría nunca al cierre.
     */
    /*
     * Y POR QUÉ MÁS DE UNA SESIÓN.
     *
     * Dos de las cuatro —`.anim-estrella` y `.anim-llenar`— viven en
     * `FilaDeSalto`, que el Cierre dibuja solo para la cadena con
     * `cambioDeNivel`: aparecen el día que el motor te sube de eslabón. Una
     * sola sesión desde cero nunca produce eso, así que el cierre de la
     * primera trae `.revelar` y `.anim-regla` y nada más. Medir el cierre sin
     * salto deja las dos comprobaciones del relleno sin ejercitar.
     *
     * Así que se entrena hasta que el salto pase: el objetivo sube solo
     * mientras se cumple, y al llegar al techo el motor consolida dos
     * sesiones y cambia de eslabón. El tope existe para que el portón termine
     * aunque algo cambie en el motor; si se agota, lo dice.
     */
    /*
     * Y CADA SESIÓN EN SU DÍA.
     *
     * Cada cadena se lee una vez por día: catorce sesiones en la misma tarde
     * dejarían de leer desde la segunda y el salto no llegaría nunca. Así que
     * el reloj se instala una vez y, antes de cada sesión, se pasa a las 9:00
     * del siguiente día del plan con fuerza. `setSystemTime` y no
     * `setFixedTime`: adentro de la sesión el tiempo tiene que correr, para el
     * cronómetro, los descansos y la coreografía del cierre.
     *
     * Los días salen de la semana guardada; el alta de este bloque elige
     * Cuerpo completo y no la escribe, y entonces son los de esa rutina:
     * lunes, miércoles y viernes. La hora es la del navegador de `abrir`
     * (Buenos Aires, UTC−3 todo el año).
     */
    const conFuerza =
      (await conLaBase(pagina, ['preferencias'], async (leer) => {
        const [preferencias] = await leer('preferencias')
        if (!preferencias?.semana) return null
        return Object.entries(preferencias.semana)
          .filter(([, clase]) => clase === 'fuerza' || clase === 'ambos')
          .map(([dia]) => Number(dia))
      })) ?? [1, 3, 5]
    const siguienteDiaConFuerza = (desde) => {
      const fecha = new Date(`${desde}T12:00:00Z`)
      do {
        fecha.setUTCDate(fecha.getUTCDate() + 1)
      } while (!conFuerza.includes(fecha.getUTCDay() || 7))
      return fecha.toISOString().slice(0, 10)
    }
    let dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
    await pagina.clock.install()
    await pagina.reload({ waitUntil: 'networkidle' })

    const TOPE_DE_SESIONES = 14
    let sesiones = 0
    let porQueNo = null
    while (sesiones < TOPE_DE_SESIONES) {
      dia = siguienteDiaConFuerza(dia)
      await pagina.clock.setSystemTime(new Date(`${dia}T09:00:00-03:00`))
      porQueNo = await completarUnaSesion(pagina, {
        alVerElDescanso: sesiones === 0 ? () => mirar('El descanso') : null,
      })
      sesiones++
      if (porQueNo) break
      await mirar(`El cierre (sesión ${sesiones})`)
      if (DEL_CIERRE.every((sel) => vistos[sel] > 0)) break
      await pagina.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
      await pagina.waitForTimeout(400)
    }
    if (porQueNo) {
      fallos.push(
        `No se llegó al cierre con movimiento reducido (${porQueNo}), así que las cuatro primitivas que solo existen ahí quedaron sin medir.`,
      )
    } else if (DEL_CIERRE.every((sel) => vistos[sel] > 0)) {
      console.log(`· Con movimiento reducido, el salto llegó al cierre en la sesión ${sesiones}, cada una en su día (la última, ${dia}).`)
    }

    const nuncaVistos = SOSPECHOSAS.filter((s) => vistos[s] === 0)
    if (nuncaVistos.length > 0) {
      anotar(
        `Con movimiento reducido no apareció NI UNO de ${nuncaVistos.join(', ')} en ninguna pantalla. O el recorrido no pasa por donde viven, o la clase dejó de usarse: en los dos casos este bloque no está en verde, está ciego.`,
      )
    }
    await navegador.close()
  }

  // ── 4. El interruptor de Ajustes, sin tocar el teléfono ─────────────────
  //
  // El teléfono no pide nada y no se emula nada: el movimiento reducido
  // llega solo por el interruptor, y sin recargar. Cada medición tiene su
  // control ANTES de prenderlo —Lyra parpadea, la figura se anima, la barra
  // tiene pasaje—, porque un vigía que no ve cambios no prueba nada si
  // tampoco los hubiera visto con todo andando.
  {
    const { navegador, contexto, pagina } = await abrir({ fallos })
    await contexto.addInitScript(instalarGanchos)
    await alta(pagina)

    /*
     * Los controles, con el movimiento completo.
     *
     * Lyra viva se declara con `data-viva` y respira con `latir`, y las dos
     * cosas se exigen acá. El vigía de los ojos solo puede probarse cuando
     * los ojos son de los que se mueven: la Lyra de Hoy de una persona nueva
     * está contenta, con ojos de arco, que no parpadean ni siguen a nadie.
     * Si esta vez tiene ojos que siguen, el vigía TIENE que ver cambios.
     */
    const enHoy = await quietud(pagina, 6000)
    if (enHoy.lyras === 0) fallos.push('[Interruptor] el control falló: en Hoy no hay Lyra.')
    if (enHoy.vivas === 0 || !enHoy.late) {
      fallos.push(
        `[Interruptor] el control falló: con todo andando, Lyra en Hoy ${enHoy.vivas === 0 ? 'no tiene data-viva="true"' : 'no respira'}. Sin control, el «quieta» de después no prueba nada.`,
      )
    }
    if (enHoy.ojosQueSiguen && enHoy.cambios === 0) {
      fallos.push('[Interruptor] el control falló: Lyra viva, con ojos que siguen al puntero, no cambió en 6 s. El vigía no ve.')
    }
    if (await tocarYLlegar(pagina, pagina.locator('[data-prueba="nav-cadenas"]'), '/biblioteca')) {
      await pagina.waitForTimeout(400)
      await tocarYLlegar(pagina, pagina.locator('main a[href*="/biblioteca/"]'), '/biblioteca/')
      await pagina.waitForTimeout(500)
      if ((await quietud(pagina, 200)).animadas === 0) {
        fallos.push('[Interruptor] el control falló: con todo andando, la figura de la ficha no tiene data-animada="true".')
      }
    }
    const pasajesConMovimiento = await cuantosPasajes(pagina)
    if (pasajesConMovimiento === 0) {
      fallos.push('[Interruptor] el control falló: con todo andando, ir a Cadenas y a una ficha no arrancó ningún pasaje. El gancho no cuenta.')
    }

    // Prenderlo, por la interfaz.
    await tocarYLlegar(pagina, pagina.locator('[data-prueba="nav-ajustes"]'), '/ajustes')
    const antes = await leerElInterruptor(pagina)
    if (!antes) {
      fallos.push('[Interruptor] en Ajustes no está "Movimiento reducido".')
    } else {
      if (antes.dice !== 'false') fallos.push(`[Interruptor] con el teléfono sin pedir nada, dice ${antes.dice === 'true' ? 'SÍ' : antes.dice}. Muestra lo que rige, y no rige.`)
      if (!antes.comoElTelefono) fallos.push('[Interruptor] sin tocarlo nunca, no dice "Como en tu teléfono".')
      await antes.boton.click()
      await pagina
        .waitForFunction(() => document.documentElement.getAttribute('data-movimiento') === 'reducido', null, { timeout: 2000 })
        .catch(() => {})
      const despues = await leerElInterruptor(pagina)
      if (despues?.raiz !== 'reducido') fallos.push('[Interruptor] al prenderlo, <html> no pasó a data-movimiento="reducido" sin recargar.')
      if (despues?.dice !== 'true') fallos.push('[Interruptor] al prenderlo no dice SÍ.')
      if (despues?.comoElTelefono) fallos.push('[Interruptor] prendido a mano sigue diciendo "Como en tu teléfono".')
      if (perillaMovida(antes, despues)) {
        fallos.push(
          `[Interruptor] la perilla saltó con el primer toque: estaba en ${JSON.stringify(antes.perilla)} y quedó en ${JSON.stringify(despues?.perilla)}. El control que se acaba de tocar no se corre.`,
        )
      }
      const guardado = await conLaBase(pagina, ['preferencias'], async (leer) => (await leer('preferencias'))[0]?.movimiento ?? null)
      if (guardado !== 'reducido') fallos.push(`[Interruptor] al prenderlo se guardó ${JSON.stringify(guardado)} y no "reducido".`)
    }

    // El mismo recorrido, ahora quieto.
    const pasajesAntes = await cuantosPasajes(pagina)
    if (!(await tocarYLlegar(pagina, pagina.locator('[data-prueba="nav-hoy"]'), '/'))) fallos.push('[Interruptor] no se volvió a Hoy por la barra.')
    await pagina.waitForTimeout(300)
    const quieta = await quietud(pagina, 6000)
    if (quieta.lyras === 0) fallos.push('[Interruptor] en Hoy no hay Lyra para mirar.')
    if (quieta.cambios > 0) anotar(`[Interruptor] con el movimiento reducido prendido, Lyra en Hoy cambió ${quieta.cambios} veces en 6 s.`)
    if (quieta.vivas > 0) anotar(`[Interruptor] con el movimiento reducido prendido hay ${quieta.vivas} elemento(s) con data-viva="true".`)
    if (quieta.late) anotar('[Interruptor] con el movimiento reducido prendido, Lyra sigue respirando (latir).')
    if (await tocarYLlegar(pagina, pagina.locator('[data-prueba="nav-cadenas"]'), '/biblioteca')) {
      await pagina.waitForTimeout(300)
      await tocarYLlegar(pagina, pagina.locator('main a[href*="/biblioteca/"]'), '/biblioteca/')
      await pagina.waitForTimeout(500)
      const ficha = await quietud(pagina, 2000)
      if (ficha.quietas === 0) fallos.push('[Interruptor] en la ficha no hay figura con data-animada="false".')
      if (ficha.animadas > 0) anotar('[Interruptor] con el movimiento reducido prendido, la figura de la ficha sigue con data-animada="true".')
      if (ficha.cuadros > 0) anotar(`[Interruptor] con el movimiento reducido prendido, la ficha pidió ${ficha.cuadros} cuadros en 2 s.`)
    } else fallos.push('[Interruptor] no se llegó a Cadenas por la barra.')
    const pasajesQuietos = (await cuantosPasajes(pagina)) - pasajesAntes
    if (pasajesQuietos !== 0) {
      anotar(`[Interruptor] con el movimiento reducido prendido se llamó ${pasajesQuietos} veces a startViewTransition. Tienen que ser cero.`)
    }
    await navegador.close()
  }

  // ── 5. El teléfono lo pide, el interruptor manda, y borrar lo devuelve ──
  {
    const { navegador, contexto, pagina } = await abrir({ fallos })
    await contexto.addInitScript(instalarGanchos)
    // Emulado de verdad y sin tocar `matchMedia`: el script de index.html
    // tiene que leerlo solo, como en un teléfono con la opción prendida.
    await pagina.emulateMedia({ reducedMotion: 'reduce' })
    await alta(pagina)

    const raiz = () => pagina.evaluate(() => document.documentElement.getAttribute('data-movimiento'))
    if ((await raiz()) !== 'reducido') {
      fallos.push('[Sistema] con el teléfono pidiendo movimiento reducido y nada tocado, <html> no tiene data-movimiento="reducido".')
    }
    await tocarYLlegar(pagina, pagina.locator('[data-prueba="nav-ajustes"]'), '/ajustes')
    const pedido = await leerElInterruptor(pagina)
    if (!pedido) {
      fallos.push('[Sistema] en Ajustes no está "Movimiento reducido".')
    } else {
      if (pedido.dice !== 'true') fallos.push('[Sistema] con el teléfono pidiéndolo, el interruptor no dice SÍ: muestra lo que rige.')
      if (!pedido.comoElTelefono) fallos.push('[Sistema] sin tocarlo, no dice "Como en tu teléfono".')

      // Mientras sigue al teléfono, lo sigue también si cambia con la app
      // abierta. Y vuelve a pedirlo, para lo que sigue.
      await pagina.emulateMedia({ reducedMotion: 'no-preference' })
      await pagina.waitForFunction(() => !document.documentElement.hasAttribute('data-movimiento'), null, { timeout: 2000 }).catch(() => {})
      if ((await raiz()) !== null) fallos.push('[Sistema] el teléfono dejó de pedirlo con la app abierta y el atributo quedó puesto.')
      await pagina.emulateMedia({ reducedMotion: 'reduce' })
      await pagina.waitForFunction(() => document.documentElement.getAttribute('data-movimiento') === 'reducido', null, { timeout: 2000 }).catch(() => {})
      if ((await raiz()) !== 'reducido') fallos.push('[Sistema] el teléfono volvió a pedirlo con la app abierta y el atributo no volvió.')

      // "NO" a mano: manda sobre el teléfono. Y lo que ya está en pantalla
      // no vuelve a entrar: sacar `animation: none` arranca de cero cada
      // animación, y Ajustes entera parpadeaba bajo el dedo.
      await pedido.boton.click()
      await pagina.waitForFunction(() => !document.documentElement.hasAttribute('data-movimiento'), null, { timeout: 2000 }).catch(() => {})
      const reentradas = await finitasCorriendo(pagina)
      if (reentradas.length > 0) {
        fallos.push(
          `[Sistema] al poner el interruptor en NO, lo que ya estaba en pantalla volvió a entrar (${[...new Set(reentradas)].join(', ')}). Lo que llegó, queda llegado.`,
        )
      }
      const completo = await leerElInterruptor(pagina)
      if (completo?.raiz !== null) fallos.push('[Sistema] con el interruptor en NO, <html> sigue con data-movimiento aunque el teléfono lo pida.')
      if (completo?.dice !== 'false') fallos.push('[Sistema] tocado una vez, el interruptor no dice NO.')
      if (completo?.comoElTelefono) fallos.push('[Sistema] en NO a mano sigue diciendo "Como en tu teléfono".')
      if (perillaMovida(pedido, completo)) {
        fallos.push(
          `[Sistema] la perilla saltó con el primer toque: estaba en ${JSON.stringify(pedido.perilla)} y quedó en ${JSON.stringify(completo?.perilla)}.`,
        )
      }
      const guardado = await conLaBase(pagina, ['preferencias'], async (leer) => (await leer('preferencias'))[0]?.movimiento ?? null)
      if (guardado !== 'completo') fallos.push(`[Sistema] con el interruptor en NO se guardó ${JSON.stringify(guardado)} y no "completo".`)

      // Y hay movimiento: la barra tiene pasaje y Lyra está viva.
      const antes = await cuantosPasajes(pagina)
      await tocarYLlegar(pagina, pagina.locator('[data-prueba="nav-hoy"]'), '/')
      await pagina.waitForTimeout(500)
      if ((await cuantosPasajes(pagina)) - antes === 0) fallos.push('[Sistema] con el interruptor en NO, ir a Hoy por la barra no tuvo pasaje.')
      if ((await quietud(pagina, 100)).vivas === 0) fallos.push('[Sistema] con el interruptor en NO, Lyra en Hoy no está viva.')

      // Recargar no lo pierde: lo aplica el portero desde la base.
      await pagina.reload({ waitUntil: 'networkidle' })
      await pagina.waitForTimeout(400)
      if ((await raiz()) !== null) fallos.push('[Sistema] después de recargar, el NO guardado no se aplicó: el portero tiene que ganarle al script.')

      // Borrar todo: vuelve a seguir al teléfono.
      await tocarYLlegar(pagina, pagina.locator('[data-prueba="nav-ajustes"]'), '/ajustes')
      await pagina.getByRole('button', { name: 'Borrar todos mis datos' }).click()
      await pagina.getByRole('button', { name: 'Sí, borrar todo' }).click()
      await pagina.waitForFunction(() => location.hash.startsWith('#/alta'), null, { timeout: 5000 }).catch(() => {})
      await pagina.waitForTimeout(400)
      const borrado = await conLaBase(pagina, ['preferencias'], async (leer) => (await leer('preferencias'))[0]?.movimiento ?? null)
      if (borrado !== null && borrado !== 'sistema') fallos.push(`[Sistema] después de borrar todo, lo guardado es ${JSON.stringify(borrado)}: tiene que volver a "sistema".`)
      if ((await raiz()) !== 'reducido') fallos.push('[Sistema] después de borrar todo, la app no volvió a seguir al teléfono: <html> no tiene data-movimiento="reducido".')
      await alta(pagina, { ir: false })
      await tocarYLlegar(pagina, pagina.locator('[data-prueba="nav-ajustes"]'), '/ajustes')
      const deNuevo = await leerElInterruptor(pagina)
      if (!deNuevo?.comoElTelefono || deNuevo.dice !== 'true') {
        fallos.push('[Sistema] después de borrar todo, el interruptor no volvió a "Como en tu teléfono" con SÍ.')
      }
    }
    await navegador.close()
  }

  if (fallos.length > 0) {
    console.log('PROBLEMAS DE MOVIMIENTO:')
    for (const f of fallos) console.log(' -', f)
    process.exit(1)
  }
  console.log(
    'Movimiento verificado: la puerta desde el toque, nada se mueve en el esfuerzo (ni Lyra ni la figura), un solo infinito, todo sobre document.timeline, y con movimiento reducido —del teléfono o del interruptor— todo queda quieto, visible y sin pasajes.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
