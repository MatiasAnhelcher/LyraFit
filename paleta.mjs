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
 *
 * ## El umbral
 *
 * 4,5:1 para texto normal y 3:1 para texto grande (≥24px, o ≥18.66px en
 * negrita), que es el AA de WCAG 2.1. No se usa AAA porque el sistema tiene
 * glosa deliberadamente apagada —la jerarquía de tinta es información— y
 * exigir 7:1 a todo obligaría a aplanarla.
 */

import { BASE, abrir, alta, revisarQueSirvaLoCompilado } from './lib/portones.mjs'

const problemas = []

/* ── El cálculo, que es el único lugar donde esto puede estar mal ──────── */

const canal = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

const luminancia = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)

const contraste = (a, b) => {
  const x = luminancia(a)
  const y = luminancia(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** "rgb(16, 15, 13)" o "#100f0d" → [16, 15, 13]. Alfa: se compone sobre el fondo. */
function aRGB(valor, debajo) {
  if (!valor) return null
  if (valor.startsWith('#')) {
    const h = valor.length === 4
      ? valor.slice(1).split('').map((c) => c + c).join('')
      : valor.slice(1)
    const n = parseInt(h, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const nums = valor.match(/[\d.]+/g)
  if (!nums || nums.length < 3) return null
  const rgb = nums.slice(0, 3).map(Number)
  const alfa = nums.length > 3 ? Number(nums[3]) : 1
  if (alfa >= 0.999) return rgb
  if (alfa <= 0.001 || !debajo) return null
  return rgb.map((c, i) => Math.round(c * alfa + debajo[i] * (1 - alfa)))
}

/* ── (1) Los pares declarados del sistema ──────────────────────────────── */

/**
 * Cada par que el sistema afirma que es legible, con el mínimo que le toca.
 *
 * El par que falló durante meses está acá arriba de todo, con su número, para
 * que si alguien vuelve a escribirlo se encuentre con la medición y no con
 * una opinión.
 */
const PARES = [
  ['sobre-acento', 'vega', 4.5, 'la barra de acción y el segmento elegido'],
  ['tinta', 'fondo', 4.5, 'el texto de la app'],
  ['tinta', 'papel', 4.5, 'el texto sobre superficie'],
  ['glosa', 'fondo', 4.5, 'la letra chica'],
  ['glosa', 'papel', 4.5, 'la letra chica sobre superficie'],
  ['vega', 'fondo', 3, 'el acento como texto o filete'],
  ['ambar', 'fondo', 3, 'el techo de alarma'],
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
]

/**
 * Los cuatro campos de dominio NO se miden por contraste: son atmósfera, y la
 * idea entera es que casi no se distingan del fondo. Lo que se verifica es lo
 * contrario — que estén lo bastante CERCA como para no leerse como una
 * tarjeta, y que la tinta encima siga siendo legible.
 */
const CAMPOS = ['dominio-fuerza-campo', 'dominio-fuelle-campo', 'dominio-comida-campo', 'dominio-sueno-campo']
const CERCANIA_MAXIMA = 1.25

/* ── (2) Cada texto de cada pantalla, con su fondo real ────────────────── */

async function medirPantalla(pagina, nombre) {
  const malos = await pagina.evaluate(() => {
    const fondoDe = (el) => {
      let n = el
      while (n && n !== document.documentElement) {
        const c = getComputedStyle(n).backgroundColor
        const m = c.match(/[\d.]+/g)
        if (m && (m.length < 4 || Number(m[3]) > 0.9)) return c
        n = n.parentElement
      }
      return getComputedStyle(document.body).backgroundColor
    }
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
      let opacidad = 1
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        opacidad *= Number(getComputedStyle(n).opacity)
      }
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
    const fondo = aRGB(m.fondo, [16, 15, 13])
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
  await pagina.emulateMedia({ reducedMotion: 'reduce' })
  await alta(pagina)

  // (1) Los tokens, leídos de la app viva y no del archivo: así lo que se mide
  //     es lo que el navegador resolvió, con las cascadas y todo.
  const tokens = await pagina.evaluate((nombres) => {
    const e = getComputedStyle(document.documentElement)
    const salida = {}
    for (const n of nombres) salida[n] = e.getPropertyValue(`--color-${n}`).trim() || e.getPropertyValue(`--${n}`).trim()
    return salida
  }, [...new Set([...PARES.flatMap(([a, b]) => [a, b]), ...CAMPOS])])

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

  // (2) Las pantallas, una por una.
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
    await asentarse(pagina, nombre)
    await medirPantalla(pagina, nombre)
  }

  await navegador.close()

  if (problemas.length > 0) {
    console.log('PROBLEMAS DE CONTRASTE:')
    for (const p of problemas) console.log(' -', p)
    process.exit(1)
  }
  console.log(`Paleta verificada: ${PARES.length} pares del sistema y todo el texto de 7 pantallas.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
