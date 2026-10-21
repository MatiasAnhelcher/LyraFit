/**
 * EL VALIDADOR DE PALETA.
 *
 * El proyecto afirmaba tener uno desde hacía meses. No existía. Mientras tanto
 * cinco regletas ponían texto blanco sobre Vega —2,6:1, por debajo del mínimo
 * legible de 4,5— y el propio CSS documentaba, dos secciones más abajo, que
 * ahí va tinta oscura. Nadie lo vio porque mirar una captura no mide contraste:
 * el naranja es brillante y el blanco encima parece que se lee.
 *
 * Esto lo mide. No sobre el CSS: sobre la app corriendo, tomando el color
 * calculado de cada elemento y el de su fondo real, que es lo único que no se
 * puede falsear con un token bien intencionado.
 *
 * ## Qué revisa
 *
 *   1. Los pares declarados del sistema, calculados contra los tokens.
 *   2. CADA elemento con texto de CADA pantalla, con su fondo efectivo —el
 *      primer ancestro que tenga uno opaco—, que es como lo ve el ojo.
 *   3. Lo que no es texto y dice algo: el borde del segmento sin elegir y el
 *      glifo de cada cadena, a 3:1 o más, y el contorno de foco de cada
 *      control al que se llega con Tab, medido sobre el trazo y no contra el
 *      fondo del contenedor.
 *   4. Que las cinco cadenas se distingan con daltonismo, por color y por
 *      forma.
 *
 * ## El umbral
 *
 * 4,5:1 para texto normal y 3:1 para texto grande (≥24px, o ≥18.66px en
 * negrita), que es el AA de WCAG 2.1. No se usa AAA porque el sistema tiene
 * glosa deliberadamente apagada —la jerarquía de tinta es información— y
 * exigir 7:1 a todo obligaría a aplanarla.
 */

import { BASE, abrir, alta, completarUnaSesion, revisarQueSirvaLoCompilado } from './lib/portones.mjs'
import { MACHADO, aRGB, contraste, distanciaCon } from './lib/color.mjs'
import { medidasEnLaPagina } from './lib/medidas.mjs'

const problemas = []
/** Cuántos controles distintos recibieron el foco con Tab y se midieron. */
let controlesConFoco = 0

/* ── (1) Los pares declarados del sistema ──────────────────────────────── */

/**
 * Cada par que el sistema afirma que es legible, con el mínimo que le toca.
 *
 * El par de la acción está acá arriba de todo porque es el que falló durante
 * meses —blanco sobre un acento claro, 2,6:1—: si alguien vuelve a
 * escribirlo se encuentra con la medición y no con una opinión.
 */
const PARES = [
  ['sobre-acento', 'acento', 4.5, 'la acción principal'],
  ['sobre-acento', 'acento-hundido', 4.5, 'la acción presionada'],
  ['fondo', 'tinta', 4.5, 'el segmento elegido'],
  ['sobre-acento', 'ambar', 4.5, 'lo elegido en ámbar (la molestia)'],
  ['sobre-acento', 'destructivo', 4.5, 'el texto sobre un relleno destructivo'],
  ['tinta', 'fondo', 4.5, 'el texto de la app'],
  ['tinta', 'papel', 4.5, 'el texto sobre superficie'],
  ['tinta', 'papel-alto', 4.5, 'el texto sobre lo que va encima: el presionado, la hoja'],
  ['glosa', 'fondo', 4.5, 'la letra chica'],
  ['glosa', 'papel', 4.5, 'la letra chica sobre superficie'],
  ['glosa', 'papel-alto', 4.5, 'lo terciario sobre papel-alto, que ahí va en glosa'],
  ['tenue', 'fondo', 4.5, 'lo terciario: la vara, el canal'],
  ['tenue', 'papel', 4.5, 'lo terciario sobre superficie'],
  ['acento', 'fondo', 3, 'el contorno de foco y la marca de la barra'],
  ['regla-fuerte', 'fondo', 3, 'el borde de un control'],
  ['regla-fuerte', 'papel', 3, 'el borde de un control sobre superficie'],
  ['regla-fuerte', 'papel-alto', 3, 'el borde de un control sobre lo que va encima'],
  ['vega', 'fondo', 3, 'Lyra y la última marca de la tira'],
  ['ambar', 'fondo', 3, 'el cuidado'],
  ['ambar', 'papel', 4.5, 'el aviso en ámbar sobre superficie'],
  ['destructivo', 'fondo', 3, 'borrar datos, solo en Ajustes'],
  ['dominio-fuerza-luz', 'fondo', 3, 'el rótulo del dominio fuerza'],
  ['dominio-fuelle-luz', 'fondo', 3, 'el rótulo del dominio fuelle'],
  ['dominio-comida-luz', 'fondo', 3, 'el rótulo del dominio comida'],
  ['dominio-sueno-luz', 'fondo', 3, 'el rótulo del dominio sueño'],
  ['empuje', 'fondo', 3, 'el glifo de empuje'],
  ['traccion', 'fondo', 3, 'el glifo de tracción'],
  ['piernas', 'fondo', 3, 'el glifo de piernas'],
  ['core', 'fondo', 3, 'el glifo de core'],
  ['bisagra', 'fondo', 3, 'el glifo de bisagra'],
  ['carta-estrella', 'carta-fondo', 4.5, 'la estrella sobre la carta'],
  ['carta-rotulo', 'carta-fondo', 4.5, 'los rótulos de la carta'],
  ['carta-futuro-nodo', 'carta-fondo', 3, 'lo que falta, en la carta'],
  ['carta-futuro-linea', 'carta-fondo', 3, 'la línea punteada de lo que falta'],
]

/**
 * Los cuatro campos de dominio NO se miden por contraste: son atmósfera, y la
 * idea entera es que casi no se distingan del fondo. Lo que se verifica es lo
 * contrario — que estén lo bastante CERCA como para no leerse como una
 * tarjeta, y que la tinta encima siga siendo legible.
 */
const CAMPOS = ['dominio-fuerza-campo', 'dominio-fuelle-campo', 'dominio-comida-campo', 'dominio-sueno-campo']
const CERCANIA_MAXIMA = 1.25

/**
 * LAS CINCO CADENAS, CON DALTONISMO.
 *
 * Cada cadena es un color en la carta, en el glifo y en la curva, y con cinco
 * colores siempre hay dos que se acercan en alguna visión. Se simula cómo ve
 * cada par una persona con protanopía, deuteranopía y tritanopía —la
 * simulación de Machado, Oliveira y Fernandes (2009), con severidad completa
 * y sobre RGB lineal— y se mide la distancia en OKLab ×100. Debajo de 10, dos
 * marcas chicas se confunden de un vistazo.
 *
 * El color no es el único seguro: cada glifo lleva además la forma de su
 * cadena (▲ ▼ ■ ● ▬), y eso se mide aparte. Que uno alcance no excusa que
 * falte el otro.
 */
const CADENAS = ['empuje', 'traccion', 'piernas', 'core', 'bisagra']
const DISTANCIA_MINIMA = 10

/**
 * Los pares que quedan cerca A PROPÓSITO, con su porqué. No se arreglan con un
 * hex: los separan la forma y el tipo de elemento, y nunca van en el mismo
 * tipo de elemento —una cadena nunca es un botón ni un aviso—. Están escritos
 * para que nadie los descubra de nuevo, y el portón verifica que ninguno sea
 * entre dos cadenas: esos tienen que pasar siempre.
 */
const EXCLUIDOS = [
  ['empuje', 'acento', 'deuteranopía (5,0): la menta es la acción y el empuje un glifo ▲; nunca son el mismo elemento'],
  ['bisagra', 'vega', 'tritanopía (2,9): Vega es Lyra, que no es un glifo; la bisagra lleva su barra ▬'],
  ['empuje', 'ambar', 'tritanopía (4,1): el ámbar es un aviso con texto, nunca un glifo'],
  ['piernas', 'acento', 'protanopía (7,3): la menta es la acción; piernas, un cuadrado ■ en el canal'],
  ['piernas', 'ambar', 'deuteranopía (7,8): el ámbar va siempre con texto; piernas, con su nombre y su ■'],
  ['acento', 'vega', 'deuteranopía (15,0, pasa), pero entre sí dan 1,83:1: Lyra no va nunca sobre la menta ni al lado de la acción'],
]

/* ── (2) Cada texto de cada pantalla, con su fondo real ────────────────── */

async function medirPantalla(pagina, nombre) {
  const malos = await pagina.evaluate(() => {
    const { fondoDe, opacidadDe } = window.__paleta
    const salida = []
    for (const el of document.querySelectorAll('body *')) {
      // Solo elementos con texto propio y visible.
      const propio = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join('')
      if (!propio) continue
      const caja = el.getBoundingClientRect()
      if (caja.width < 2 || caja.height < 2) continue
      const e = getComputedStyle(el)
      if (e.visibility === 'hidden' || e.opacity === '0') continue
      const px = parseFloat(e.fontSize)
      const negrita = parseInt(e.fontWeight, 10) >= 700

      /*
       * LA OPACIDAD ACUMULADA, que es lo que este portón no miraba.
       *
       * Descartaba `opacity: 0` y daba por bueno todo lo demás, así que un
       * `opacity: 0.55` sobre un color que solo da 6,97:1 pasaba como 6,97
       * cuando lo que se ve en pantalla son 2,89 — por debajo del piso. Pasó
       * de verdad, en el guion de "EL DÍA" en Hoy, y este portón imprimió
       * «Paleta verificada» mientras estaba ahí.
       *
       * Se multiplica por la cadena entera de ancestros porque la opacidad se
       * compone: un 0,8 adentro de un 0,7 se ve al 0,56.
       */
      const opacidad = opacidadDe(el)
      if (opacidad < 0.005) continue

      salida.push({
        texto: propio.slice(0, 40),
        color: e.color,
        opacidad,
        fondo: fondoDe(el),
        grande: px >= 24 || (px >= 18.66 && negrita),
        px: Math.round(px),
        etiqueta: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`,
      })
    }
    return salida
  })

  const vistos = new Set()
  for (const m of malos) {
    const fondo = aRGB(m.fondo, [7, 9, 12])
    const crudo = aRGB(m.color, fondo)
    if (!fondo || !crudo) continue
    // El color COMO SE VE: la opacidad acumulada lo mezcla con el fondo antes
    // de medir, que es lo que hace el ojo y lo que este portón no hacía.
    const color =
      m.opacidad >= 0.999
        ? crudo
        : crudo.map((c, i) => Math.round(c * m.opacidad + fondo[i] * (1 - m.opacidad)))
    const r = contraste(color, fondo)
    const minimo = m.grande ? 3 : 4.5
    if (r >= minimo) continue
    // Un mismo componente repetido veinte veces es un problema, no veinte.
    const clave = `${m.etiqueta}|${m.color}|${m.opacidad.toFixed(2)}|${m.fondo}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    problemas.push(
      `[${nombre}] "${m.texto}" (${m.etiqueta}, ${m.px}px) da ${r.toFixed(2)}:1 y necesita ${minimo}:1 — ${m.color}${m.opacidad < 0.999 ? ` a opacidad ${m.opacidad.toFixed(2)}` : ''} sobre ${m.fondo}.`,
    )
  }
}

/* ── (3) Lo que no es texto y dice algo ───────────────────────────────── */

/**
 * WCAG 1.4.11 pide 3:1 a todo lo que hace falta ver para usar la pantalla, y
 * no solo al texto. Acá se mide lo que en esta app cumple ese papel: el borde
 * de un segmento sin elegir —es lo único que dice que eso se toca— y el glifo
 * de cada cadena. Con el fondo efectivo y la opacidad acumulada, igual que el
 * texto.
 *
 * Y se verifica que todo glifo de cadena lleve su forma: un glifo con color y
 * sin `data-patron` es un cuadrado que solo se distingue por el color.
 */
async function medirLoQueNoEsTexto(pagina, nombre) {
  const vistos = await pagina.evaluate(() => {
    const { fondoDe, opacidadDe, visible } = window.__paleta
    const salida = []
    for (const el of document.querySelectorAll('.segmento:not([aria-pressed="true"]):not([data-elegido="true"])')) {
      if (!visible(el)) continue
      salida.push({
        que: 'el borde del segmento sin elegir',
        texto: el.textContent.trim().slice(0, 30),
        color: getComputedStyle(el).borderTopColor,
        fondo: fondoDe(el.parentElement),
        opacidad: opacidadDe(el),
      })
    }
    for (const el of document.querySelectorAll('.glifo')) {
      if (!visible(el)) continue
      salida.push({
        que: 'el glifo',
        texto: el.dataset.patron ?? '(sin patrón)',
        color: getComputedStyle(el).backgroundColor,
        fondo: fondoDe(el.parentElement),
        opacidad: opacidadDe(el),
        sinForma: el.style.getPropertyValue('--tinta-patron') !== '' && !el.dataset.patron,
      })
    }
    return salida
  })

  const dichos = new Set()
  for (const m of vistos) {
    const fondo = aRGB(m.fondo, [7, 9, 12])
    const crudo = aRGB(m.color, fondo)
    if (!fondo || !crudo) continue
    const color = crudo.map((c, i) => Math.round(c * m.opacidad + fondo[i] * (1 - m.opacidad)))
    const r = contraste(color, fondo)
    const clave = `${m.que}|${m.texto}|${m.color}|${m.fondo}`
    if (dichos.has(clave)) continue
    dichos.add(clave)
    if (r < 3) {
      problemas.push(`[${nombre}] ${m.que} "${m.texto}" da ${r.toFixed(2)}:1 y necesita 3:1 — ${m.color}${m.opacidad < 0.999 ? ` a opacidad ${m.opacidad.toFixed(2)}` : ''} sobre ${m.fondo}.`)
    }
    if (m.sinForma) {
      problemas.push(`[${nombre}] un glifo de cadena sin data-patron: es un cuadrado que solo se distingue por el color.`)
    }
  }
}

/**
 * EL CONTORNO DE FOCO, recorriendo la pantalla con Tab como la recorre quien
 * no usa las manos en la pantalla.
 *
 * Se mide el trazo de verdad y no el color contra el fondo del contenedor.
 * Así medido, "Saltear este ejercicio" daba 14:1 y pasaba, y en la pantalla
 * el foco no cambiaba un píxel: los costados caían fuera de la pantalla y el
 * borde de arriba, sobre la acción menta de encima, era acento sobre acento.
 *
 * Por cada lado se toman puntos cada 4 px sobre el centro del trazo. Un punto
 * cuenta si cae en la pantalla, si nada fijo o pegado lo tapa y si el trazo da
 * 3:1 contra lo que tiene justo adentro o justo afuera. Lo que cuenta tiene
 * que sumar por lo menos el lado más largo del elemento: un contorno del que
 * se ve menos que eso no alcanza para saber dónde está el foco. Un elemento
 * enfocado sin contorno también es una falla.
 */
async function medirElFoco(pagina, nombre, toques) {
  await pagina.evaluate(() => {
    document.activeElement?.blur?.()
    window.scrollTo(0, 0)
  })
  const dichos = new Set()
  for (let i = 0; i < toques; i++) {
    await pagina.keyboard.press('Tab')
    const m = await pagina.evaluate(async () => {
      // Dos cuadros de espera: con movimiento reducido toda propiedad hace
      // una transición de 0,01 ms (la regla de abajo de estilos.css pone la
      // duración y `transition-property` vale `all` por omisión), y leído en
      // el mismo cuadro del Tab el contorno todavía mide 0.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const el = document.activeElement
      if (!el || el === document.body) return null
      return {
        etiqueta: window.__paleta.etiqueta(el),
        texto: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30),
        ...window.__paleta.trazoDelFoco(el),
      }
    })
    if (!m) continue
    const clave = `${m.etiqueta}|${m.texto}`
    if (dichos.has(clave)) continue
    dichos.add(clave)
    controlesConFoco++
    if (m.estilo === 'none' || !(m.ancho > 0)) {
      problemas.push(`[${nombre}] "${m.texto}" (${m.etiqueta}) recibe el foco y no dibuja contorno.`)
      continue
    }
    const color = aRGB(m.color, [7, 9, 12])
    let seVe = 0
    const porLado = []
    for (const [lado, puntos] of Object.entries(m.lados)) {
      let cuentan = 0
      let fuera = 0
      let tapado = null
      let peor = null
      for (const q of puntos) {
        if (!q.visible) { fuera++; continue }
        if (q.tapado) { tapado = q.tapado; continue }
        const contra = [q.adentro, q.afuera]
          .filter(Boolean)
          .map((f) => ({ ...f, r: contraste(color, aRGB(f.color, [7, 9, 12])) }))
        if (contra.some((f) => f.r >= 3)) cuentan++
        else peor ??= contra.sort((x, y) => x.r - y.r)[0]
      }
      seVe += cuentan * 4
      if (cuentan === puntos.length) continue
      if (fuera === puntos.length) porLado.push(`${lado}, fuera de la pantalla`)
      else if (peor) porLado.push(`${lado}, ${peor.r.toFixed(2)}:1 sobre ${peor.color} (${peor.de})`)
      else if (tapado) porLado.push(`${lado}, tapado por ${tapado}`)
    }
    if (seVe < m.largo) {
      problemas.push(
        `[${nombre}] el contorno de foco de "${m.texto}" (${m.etiqueta}) se ve a 3:1 en ${seVe} px y hace falta el lado más largo, ${Math.round(m.largo)} px — ${porLado.join('; ')}.`,
      )
    }
  }
}

/**
 * Esperar a que la pantalla se quede QUIETA antes de medirla.
 *
 * Esto nació de seis hallazgos falsos. Desde que el portón compone la
 * opacidad de los ancestros, medir a los 260 ms de entrar a una ruta es medir
 * la animación de entrada a mitad de camino: `entrar-en-orden` va de opacidad
 * 0 a 1 con retraso escalonado, así que el portón veía el "×" de Cadenas al
 * 0,46 cuando en reposo está al 0,55, y cuatro rótulos de Ajustes al 0,76
 * cuando en reposo están al 1.
 *
 * Seis fallas de contraste que no existen, y —peor— la certeza de que si
 * alguna vez hay una de verdad va a estar mezclada con ruido que cambia en
 * cada corrida. Un portón que mide un estado transitorio no mide la pantalla:
 * mide el reloj.
 *
 * `latir` se excluye porque es infinita y nunca termina: es Lyra respirando y
 * es el único infinito del sistema (lo verifica `movimiento.mjs`). Si después
 * del plazo sigue habiendo algo corriendo, eso se DICE en vez de medirse
 * igual: medir una pantalla que no se asentó es exactamente lo que acaba de
 * pasar, y la próxima vez tiene que avisar.
 */
async function asentarse(p, nombre) {
  const quieta = () =>
    p.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming?.().iterations !== Infinity)
        .filter((a) => a.playState === 'running')
        .map((a) => a.animationName ?? a.transitionProperty ?? '(sin nombre)'),
    )

  const limite = Date.now() + 5000
  let corriendo = await quieta()
  while (corriendo.length > 0 && Date.now() < limite) {
    await p.waitForTimeout(100)
    corriendo = await quieta()
  }
  // Un respiro después de la última: el estilo calculado se actualiza al
  // siguiente cuadro, no al terminar la animación.
  await p.waitForTimeout(150)
  corriendo = await quieta()
  if (corriendo.length > 0) {
    problemas.push(
      `[${nombre}] la pantalla no se quedó quieta en 5 s: sigue corriendo ${[...new Set(corriendo)].join(', ')}. Lo que se mida acá es la animación, no la pantalla.`,
    )
  }
}

/* ── El recorrido ──────────────────────────────────────────────────────── */

async function main() {
  await revisarQueSirvaLoCompilado(BASE)

  /*
   * SE MIDE CON MOVIMIENTO REDUCIDO, Y NO ES UN ATAJO.
   *
   * Con las animaciones corriendo, este portón medía la entrada a mitad de
   * camino: `entrar-en-orden` va de opacidad 0 a 1 con retraso escalonado y
   * en Cadenas, con veinte eslabones, el escalonado dura más que cualquier
   * espera razonable. Las primeras seis fallas que reportó eran todas eso —
   * el "×" al 0,46 cuando en reposo está al 0,55— y esperar a que terminara
   * daba una lista todavía más larga de números que no existen.
   *
   * Con `prefers-reduced-motion` no hay nada que esperar, y lo que se ve es
   * el estado FINAL: `movimiento.mjs` verifica justamente eso —"con
   * movimiento reducido la información se congela, no desaparece"— así que
   * los dos portones se sostienen. Si alguien rompe esa promesa, movimiento
   * lo dice; mientras la promesa valga, esto mide la pantalla en reposo.
   *
   * Y lo que importa no se pierde: una opacidad ESCRITA en una regla —el
   * 0,55 del "×", el 0,55 del guion de EL DÍA que este portón dejó pasar—
   * sigue ahí con movimiento reducido. Lo único que desaparece es el ruido.
   */
  const { navegador, contexto, pagina } = await abrir({ fallos: problemas })
  await contexto.addInitScript(() => {
    const real = window.matchMedia.bind(window)
    window.matchMedia = (q) =>
      q.includes('prefers-reduced-motion: reduce')
        ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }
        : real(q)
  })
  await contexto.addInitScript(medidasEnLaPagina)
  await pagina.emulateMedia({ reducedMotion: 'reduce' })

  // Cada pantalla se mide entera: el texto, lo que no es texto y el foco con
  // `toques` pasadas de Tab. El alta se mide pantalla por pantalla mientras
  // se pasa: es la primera que ve todo el mundo, y la que tiene más regletas.
  let pantallas = 0
  const medirTodo = async (nombre, toques = 30) => {
    await asentarse(pagina, nombre)
    await medirPantalla(pagina, nombre)
    await medirLoQueNoEsTexto(pagina, nombre)
    await medirElFoco(pagina, nombre, toques)
    pantallas++
  }
  await alta(pagina, { enCadaPaso: (paso) => medirTodo(`Alta · ${paso}`, 25) })

  // (1) Los tokens, leídos de la app viva y no del archivo: así lo que se mide
  //     es lo que el navegador resolvió, con las cascadas y todo.
  const tokens = await pagina.evaluate((nombres) => {
    const e = getComputedStyle(document.documentElement)
    const salida = {}
    for (const n of nombres) salida[n] = e.getPropertyValue(`--color-${n}`).trim() || e.getPropertyValue(`--${n}`).trim()
    return salida
  }, [...new Set([...PARES.flatMap(([a, b]) => [a, b]), ...CAMPOS, ...CADENAS, ...EXCLUIDOS.flatMap(([a, b]) => [a, b])])])

  for (const [frente, detras, minimo, para] of PARES) {
    const a = aRGB(tokens[frente])
    const b = aRGB(tokens[detras])
    if (!a || !b) {
      problemas.push(`El par ${frente}/${detras} no se pudo leer: ${tokens[frente]} sobre ${tokens[detras]}.`)
      continue
    }
    const r = contraste(a, b)
    if (r < minimo) {
      problemas.push(
        `${frente} sobre ${detras} da ${r.toFixed(2)}:1 y necesita ${minimo}:1 — es ${para}.`,
      )
    }
  }

  const fondo = aRGB(tokens['fondo'])
  for (const campo of CAMPOS) {
    const c = aRGB(tokens[campo])
    if (!c) {
      problemas.push(`El campo ${campo} no se pudo leer.`)
      continue
    }
    const r = contraste(c, fondo)
    if (r > CERCANIA_MAXIMA) {
      problemas.push(
        `El campo ${campo} está a ${r.toFixed(2)}:1 del fondo y el máximo es ${CERCANIA_MAXIMA}: un dominio es atmósfera, no una tarjeta.`,
      )
    }
    for (const [texto, minimo] of [['tinta', 4.5], ['glosa', 4.5]]) {
      const t = aRGB(tokens[texto])
      const rr = contraste(t, c)
      if (rr < minimo) {
        problemas.push(`${texto} sobre ${campo} da ${rr.toFixed(2)}:1 y necesita ${minimo}:1.`)
      }
    }
  }

  // (4) Las cadenas con daltonismo: de a pares, en las tres visiones.
  for (let i = 0; i < CADENAS.length; i++) {
    for (let j = i + 1; j < CADENAS.length; j++) {
      const a = aRGB(tokens[CADENAS[i]])
      const b = aRGB(tokens[CADENAS[j]])
      if (!a || !b) {
        problemas.push(`Las cadenas ${CADENAS[i]} y ${CADENAS[j]} no se pudieron leer.`)
        continue
      }
      for (const [vision, matriz] of Object.entries(MACHADO)) {
        const d = distanciaCon(a, b, matriz)
        if (d < DISTANCIA_MINIMA) {
          problemas.push(
            `${CADENAS[i]} y ${CADENAS[j]} quedan a ${d.toFixed(1)} en ${vision} y el mínimo es ${DISTANCIA_MINIMA}: dos cadenas no pueden confundirse por color.`,
          )
        }
      }
    }
  }
  for (const [a, b, porque] of EXCLUIDOS) {
    if (CADENAS.includes(a) && CADENAS.includes(b)) {
      problemas.push(`${a}–${b} figura como par excluido (${porque}), y dos cadenas no se excluyen: tienen que distinguirse siempre.`)
    }
    if (!aRGB(tokens[a]) || !aRGB(tokens[b])) {
      problemas.push(`El par excluido ${a}–${b} nombra un token que no existe: la lista quedó vieja.`)
    }
  }

  // Y la forma: cinco glifos, uno por cadena, armados con la clase de verdad.
  const formas = await pagina.evaluate((cadenas) => {
    const caja = document.createElement('div')
    document.body.append(caja)
    const salida = {}
    for (const c of cadenas) {
      const g = document.createElement('span')
      g.className = 'glifo'
      g.dataset.patron = c
      caja.append(g)
      const e = getComputedStyle(g)
      salida[c] = `${e.clipPath} · radio ${e.borderRadius}`
    }
    caja.remove()
    return salida
  }, CADENAS)
  const porForma = new Map()
  for (const [cadena, forma] of Object.entries(formas)) porForma.set(forma, [...(porForma.get(forma) ?? []), cadena])
  for (const [forma, cadenas] of porForma) {
    if (cadenas.length > 1) {
      problemas.push(`${cadenas.join(' y ')} tienen el mismo glifo (${forma}): sin forma propia, solo los separa el color.`)
    }
  }

  // (2) Las pantallas, una por una.
  for (const [ruta, nombre] of [
    ['/', 'Hoy'],
    ['/biblioteca', 'Cadenas'],
    ['/biblioteca/flexion-completa', 'Una ficha'],
    ['/progreso', 'Progreso'],
    ['/diario', 'El diario'],
    ['/ajustes', 'Ajustes'],
    ['/estado', 'Estado'],
    ['/molestia', 'Molestia'],
    ['/reloj', 'El reloj'],
  ]) {
    await pagina.goto(`${BASE}/#${ruta}`, { waitUntil: 'networkidle' })
    await medirTodo(nombre, ruta === '/ajustes' ? 60 : 30)
  }

  // Entrenar, con la paleta de la noche: la serie y el descanso. La primera
  // serie arranca con la predicción, que es la que se ve primero.
  await pagina.goto(`${BASE}/#/entrenar`, { waitUntil: 'networkidle' })
  const boton = (nombre) => pagina.getByRole('button', { name: nombre, exact: true })
  await boton('Voy').waitFor({ state: 'visible' })
  await medirTodo('Entrenar · la predicción', 12)
  await boton('Voy').click()
  await boton('Anotar serie').waitFor({ state: 'visible' })
  await medirTodo('Entrenar · la serie', 12)
  await boton('Anotar serie').click()
  await boton('Saltear').waitFor({ state: 'visible' })
  await medirTodo('Entrenar · el descanso', 15)

  // Y el final, que no tiene ruta: se llega entrenando la sesión entera. La
  // serie de cierre y las preguntas se miden al pasar.
  const sinCierre = await completarUnaSesion(pagina, {
    alVerElFinal: (paso) => medirTodo(`Entrenar · ${paso}`, 15),
  })
  if (sinCierre) problemas.push(`No se pudo medir el cierre: ${sinCierre}.`)
  else await medirTodo('El cierre', 12)

  await navegador.close()

  if (problemas.length > 0) {
    console.log('PROBLEMAS DE CONTRASTE:')
    for (const p of problemas) console.log(' -', p)
    process.exit(1)
  }
  console.log(
    `Paleta verificada: ${PARES.length} pares del sistema, las ${CADENAS.length} cadenas en tres visiones y con su forma, y el texto, los bordes, los glifos y el foco con Tab de ${pantallas} pantallas (${controlesConFoco} controles enfocados).`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
