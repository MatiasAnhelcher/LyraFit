/**
 * LAS CUENTAS DEL COLOR, para los portones que miden contraste.
 *
 * Viven acá y no adentro de un portón porque son el único lugar donde una
 * medición de contraste puede estar mal sin que nada lo avise: si cada portón
 * tuviera su copia, corregir una dejaría a los demás midiendo distinto.
 */

const canal = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export const luminancia = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)

/** El contraste de WCAG 2.x entre dos colores [r, g, b]. */
export const contraste = (a, b) => {
  const x = luminancia(a)
  const y = luminancia(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** "rgb(16, 15, 13)" o "#100f0d" → [16, 15, 13]. Alfa: se compone sobre el fondo. */
export function aRGB(valor, debajo) {
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

/**
 * Cómo ve el color una persona con protanopía, deuteranopía y tritanopía: la
 * simulación de Machado, Oliveira y Fernandes (2009), con severidad completa y
 * sobre RGB lineal.
 */
export const MACHADO = {
  protanopía: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopía: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopía: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
}

const lineal = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** RGB lineal → OKLab (Björn Ottosson, 2020). */
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** Lo que ve una persona con esa visión, en RGB lineal y dentro del gamut. */
function simular(rgb, matriz) {
  const x = rgb.map(lineal)
  return matriz.map((f) => Math.min(1, Math.max(0, f[0] * x[0] + f[1] * x[1] + f[2] * x[2])))
}

/** La distancia OKLab ×100 entre dos colores, como los ve esa visión. */
export function distanciaCon(a, b, matriz) {
  const p = oklab(simular(a, matriz))
  const q = oklab(simular(b, matriz))
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}
