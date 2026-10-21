/**
 * Cómo se reparte una regleta: en una fila o en dos filas parejas.
 *
 * Vive aparte de `ui.tsx` porque es una cuenta y no un dibujo, y una cuenta se
 * prueba sin navegador. El componente mide; esto decide.
 *
 * La regla es una sola y se decide contra un teléfono de 320 de ancho, no
 * contra el que está mirando: una regleta va en una fila solo si cada celda da
 * el mínimo táctil (48, o 56 en el esfuerzo) Y la palabra más ancha entra
 * entera. Si no, va en dos filas: arriba la mitad redondeada para arriba y
 * abajo el resto, cada fila repartiendo el ancho entero. Decidido así, la
 * misma pregunta se ve igual en un 320 y en un 390, y nadie aprende dónde
 * tocar en un teléfono para desaprenderlo en otro.
 *
 * Lo que la regla no puede es cortar una palabra. Si ni en dos filas entra la
 * más ancha —la letra al 125 % en un 320, por ejemplo— la regleta pasa a una
 * columna: una lista fea es mejor que "Mode-" arriba y "rada" abajo.
 */

/** El ancho de referencia: el teléfono más angosto que la app sostiene. */
export const ANCHO_DE_REFERENCIA = 320

/** El mínimo táctil de una celda, fuera y dentro del esfuerzo. */
export const CELDA_MINIMA = 48
export const CELDA_MINIMA_ESFUERZO = 56

/**
 * Lo que ocupa una celda además de su texto: 6 px de padding y 1 de borde de
 * cada lado. Si cambia `.segmento` en `estilos.css`, cambia esto.
 */
export const MARGEN_DEL_TEXTO = 14

/** El padding y el hueco de `.regleta`, también de `estilos.css`. */
export const RELLENO = 4
export const HUECO = 4

export interface Reparto {
  filas: 1 | 2
  /** Cuántas celdas van en la primera fila. */
  arriba: number
  /** Cuántas en la segunda; 0 si va en una. */
  abajo: number
  /** Las columnas de la grilla. */
  columnas: number
}

/** Cuántas columnas ocupa la celda `indice`. */
export function columnasDeLaCelda(reparto: Reparto, indice: number): number {
  if (reparto.filas === 1) return 1
  return reparto.columnas / (indice < reparto.arriba ? reparto.arriba : reparto.abajo)
}

function mcd(a: number, b: number): number {
  return b === 0 ? a : mcd(b, a % b)
}

/**
 * Las dos filas en una grilla de 12 columnas, que reparte parejo el 3 + 2,
 * el 3 + 3, el 4 + 3 y el 4 + 4. Una regleta de nueve o más no existe hoy;
 * si aparece, la grilla pasa al múltiplo común en vez de dejar un hueco.
 */
export function dosFilas(opciones: number): Reparto {
  const arriba = Math.ceil(opciones / 2)
  const abajo = Math.floor(opciones / 2)
  const columnas = 12 % arriba === 0 && 12 % abajo === 0 ? 12 : (arriba * abajo) / mcd(arriba, abajo)
  return { filas: 2, arriba, abajo, columnas }
}

export function unaFila(opciones: number): Reparto {
  return { filas: 1, arriba: opciones, abajo: 0, columnas: Math.max(1, opciones) }
}

/** El ancho de la celda más angosta de un reparto, en una regleta de `ancho`. */
export function celdaMasAngosta(reparto: Reparto, ancho: number): number {
  const util = ancho - RELLENO * 2
  const columna = (util - HUECO * (reparto.columnas - 1)) / reparto.columnas
  const ocupa = reparto.filas === 1 ? 1 : reparto.columnas / reparto.arriba
  return columna * ocupa + HUECO * (ocupa - 1)
}

/**
 * Una fila o dos, contra el ancho que la regleta tendría en un 320.
 *
 * @param ancho           el ancho exterior de la regleta a 320, en px.
 * @param palabraMasAncha la palabra más ancha de todas las opciones, en px y
 *                        con la letra con la que se dibuja.
 */
export function repartir({
  opciones,
  ancho,
  palabraMasAncha,
  celdaMinima = CELDA_MINIMA,
}: {
  opciones: number
  ancho: number
  palabraMasAncha: number
  celdaMinima?: number
}): Reparto {
  if (opciones <= 2) return unaFila(opciones)
  const fila = unaFila(opciones)
  const celda = celdaMasAngosta(fila, ancho)
  return celda >= celdaMinima && palabraMasAncha + MARGEN_DEL_TEXTO <= celda ? fila : dosFilas(opciones)
}

/**
 * Si el reparto entra en el ancho que de verdad tiene la regleta. Cuando no,
 * va en una columna.
 */
export function entra(reparto: Reparto, ancho: number, palabraMasAncha: number): boolean {
  return palabraMasAncha + MARGEN_DEL_TEXTO <= celdaMasAngosta(reparto, ancho) + 0.5
}
