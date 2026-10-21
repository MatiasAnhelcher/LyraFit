/**
 * LO QUE LOS PORTONES DE CONTRASTE MIDEN ADENTRO DE LA PÁGINA.
 *
 * El fondo efectivo, la opacidad acumulada, si algo se ve y el trazo del
 * contorno de foco. Es una sola copia a propósito: es la regla que decide
 * contra qué se mide cada contraste —el umbral de alfa de 0,9, dónde se corta
 * la subida por los ancestros—, y si el texto y lo que no es texto la tuvieran
 * cada uno por su lado, corregir una dejaría a la otra midiendo distinto.
 *
 * Se instala con `contexto.addInitScript(medidasEnLaPagina)` y queda en
 * `window.__paleta`. Playwright la manda a la página como texto, así que no
 * puede usar nada de este archivo.
 */
export function medidasEnLaPagina() {
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
  const opacidadDe = (el) => {
    let o = 1
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) o *= Number(getComputedStyle(n).opacity)
    return o
  }
  const visible = (el) => {
    const c = el.getBoundingClientRect()
    const e = getComputedStyle(el)
    return c.width >= 2 && c.height >= 2 && e.visibility !== 'hidden' && opacidadDe(el) > 0.005
  }
  const etiqueta = (n) =>
    n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '')
  const opaco = (n) => {
    const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g)
    return m && (m.length < 4 || Number(m[3]) > 0.9) && opacidadDe(n) > 0.9
  }
  /*
   * El trazo del contorno de foco, lado por lado, para `medirElFoco`. Cada
   * punto va sobre el centro del trazo y dice si cae en la pantalla, qué lo
   * tapa si algo lo tapa, y el color que tiene justo adentro y justo afuera:
   * el del primero de la pila con fondo opaco, que es lo que pinta debajo.
   * Lo fijo o pegado que no contiene al elemento pinta ENCIMA del contorno.
   */
  const trazoDelFoco = (el) => {
    const e = getComputedStyle(el)
    const ancho = parseFloat(e.outlineWidth)
    const offset = parseFloat(e.outlineOffset)
    const c = el.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const enPantalla = (x, y) => x >= 0 && y >= 0 && x < vw && y < vh
    const colorEn = (x, y) => {
      if (!enPantalla(x, y)) return null
      const n = document.elementsFromPoint(x, y).find(opaco)
      return n
        ? { color: getComputedStyle(n).backgroundColor, de: etiqueta(n) }
        : { color: getComputedStyle(document.body).backgroundColor, de: 'body' }
    }
    const tapado = (x, y) => {
      for (let n = document.elementsFromPoint(x, y)[0]; n && !n.contains(el); n = n.parentElement) {
        if (['fixed', 'sticky'].includes(getComputedStyle(n).position)) return etiqueta(n)
      }
      return null
    }
    const lados = {}
    const lado = (nombre, desde, hasta, punto) => {
      const puntos = []
      for (let t = desde; t <= hasta; t += 4) {
        const [x, y] = punto(t, offset + ancho / 2)
        const visible = enPantalla(x, y)
        puntos.push({
          visible,
          tapado: visible ? tapado(x, y) : null,
          adentro: colorEn(...punto(t, offset - 0.5)),
          afuera: colorEn(...punto(t, offset + ancho + 0.5)),
        })
      }
      lados[nombre] = puntos
    }
    // Solo los tramos rectos: en las esquinas el contorno sigue el radio.
    const r = Math.max(1, ...['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map((k) => parseFloat(e[`border${k}Radius`]) || 0))
    lado('arriba', c.left + r, c.right - r, (t, d) => [t, c.top - d])
    lado('abajo', c.left + r, c.right - r, (t, d) => [t, c.bottom + d])
    lado('izquierda', c.top + r, c.bottom - r, (t, d) => [c.left - d, t])
    lado('derecha', c.top + r, c.bottom - r, (t, d) => [c.right + d, t])
    return { color: e.outlineColor, estilo: e.outlineStyle, ancho, lados, largo: Math.max(c.width, c.height) - 2 * r }
  }
  window.__paleta = { fondoDe, opacidadDe, visible, etiqueta, trazoDelFoco }
}
