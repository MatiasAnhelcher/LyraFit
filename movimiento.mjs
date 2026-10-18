/**
 * EL PORTÓN DEL MOVIMIENTO.
 *
 * Tres reglas del sistema estaban escritas como comentarios y nada más:
 *
 *   1. Nada se mueve durante el esfuerzo.
 *   2. Con `prefers-reduced-motion` todo queda quieto SIN PERDER INFORMACIÓN.
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

import { BASE, abrir, alta, completarUnaSesion, revisarQueSirvaLoCompilado } from './lib/portones.mjs'

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
 * carta que el cierre dibuja, y al cierre no se llega navegando: hay que
 * entrenar la sesión entera.
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
const DEL_CIERRE = ['.revelar', '.anim-estrella', '.anim-regla', '.anim-trazo']
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
      objetivo: (() => {
        const el = a.effect?.target
        if (!el || !el.tagName) return '(?)'
        const clase = typeof el.className === 'string' ? el.className.split(' ')[0] : ''
        return `${el.tagName.toLowerCase()}${clase ? '.' + clase : ''}`
      })(),
      estado: a.playState,
    })),
  )

async function entrarAEntrenar(p) {
  await p.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(900)
}

async function main() {
  await revisarQueSirvaLoCompilado(BASE)

  // ── 1. El esfuerzo: nada se mueve ──────────────────────────────────────
  {
    const { navegador, pagina } = await abrir({ fallos })
    await alta(pagina)
    await entrarAEntrenar(pagina)

    const pantalla = await pagina.evaluate(() => document.documentElement.dataset.pantalla)
    if (pantalla !== 'entrenar') {
      fallos.push(`No se llegó a entrenar: data-pantalla es "${pantalla}". El resto de esta medición no vale.`)
    }

    const vivas = (await corriendo(pagina)).filter(
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
      ['/reloj', 'El reloj'],
    ]) {
      await pagina.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' })
      await pagina.waitForTimeout(700)
      const infinitas = (await corriendo(pagina)).filter((a) => a.infinito)
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
     * LAS RUTAS, Y POR QUÉ ESTA LISTA NO ES LA OBVIA.
     *
     * La versión anterior recorría Hoy, Cadenas, Progreso y el Reloj, y
     * buscaba seis selectores de los cuales CUATRO solo existen en el cierre:
     * `.revelar`, `.anim-regla`, `.anim-trazo` y `.anim-estrella` son la
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
            // `parseFloat` y no `Number`: Chrome serializa la propiedad
            // calculada con unidad —"1px"— y `Number('1px')` es NaN, así que
            // `NaN > 0.01` era SIEMPRE falso. La comprobación existía, se
            // leía bien, y no podía disparar nunca.
            if (sel === '.anim-trazo' && parseFloat(e.strokeDashoffset) > 0.01) {
              salida.push(`.anim-trazo quedó con dashoffset ${e.strokeDashoffset}: el camino no se dibujó`)
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
     * Dos de las cuatro —`.anim-estrella` y `.anim-trazo`— cuelgan de
     * `animar={huboSalto}` en `Cierre.tsx:139`: solo se dibujan el día que el
     * motor te sube de eslabón. Una sola sesión desde cero nunca produce eso,
     * así que el cierre de la primera trae `.revelar` y `.anim-regla` y nada
     * más — y justamente `.anim-trazo` es donde vivía el `NaN > 0.01` que no
     * podía disparar nunca. Medir el cierre sin salto deja esa comprobación
     * tan sin ejercitar como estaba.
     *
     * Así que se entrena hasta que el salto pase: el objetivo sube solo
     * mientras se cumple, y al llegar al techo el motor consolida dos
     * sesiones y cambia de eslabón. El tope existe para que el portón termine
     * aunque algo cambie en el motor; si se agota, lo dice.
     */
    const TOPE_DE_SESIONES = 14
    let sesiones = 0
    let porQueNo = null
    while (sesiones < TOPE_DE_SESIONES) {
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
    }

    const nuncaVistos = SOSPECHOSAS.filter((s) => vistos[s] === 0)
    if (nuncaVistos.length > 0) {
      anotar(
        `Con movimiento reducido no apareció NI UNO de ${nuncaVistos.join(', ')} en ninguna pantalla. O el recorrido no pasa por donde viven, o la clase dejó de usarse: en los dos casos este bloque no está en verde, está ciego.`,
      )
    }
    await navegador.close()
  }

  if (fallos.length > 0) {
    console.log('PROBLEMAS DE MOVIMIENTO:')
    for (const f of fallos) console.log(' -', f)
    process.exit(1)
  }
  console.log('Movimiento verificado: nada se mueve en el esfuerzo, un solo infinito, y con movimiento reducido todo queda quieto y visible.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
