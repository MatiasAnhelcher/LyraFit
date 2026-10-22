/**
 * Lo que dice la región viva de Entrenar.
 *
 * Es una sola, educada y montada vacía desde que abre la sesión (§7.4): los
 * lectores de pantalla registran una región cuando aparece, así que una que
 * se monta junto con su texto —como el "después ·" del descanso o "lo que
 * viene" del ejercicio completo— no anuncia nada. Por eso esos dos ya no
 * llevan `aria-live`, y lo que pasa se dice acá, una vez y en el momento en
 * que pasa: al anotar una serie, al arrancar el descanso y cuando quedan tres
 * segundos. Y se vacía cuando eso deja de ser cierto (`crearAnunciador`).
 *
 * Las frases son cortas y terminan en punto: el lector las encadena, y sin el
 * punto "Serie 2 anotada: 8 Descanso de 2 minutos" se oye como un número de
 * teléfono. El reloj no se anuncia nunca segundo a segundo: tiene
 * `role="timer"`, y quien quiera saber cuánto falta lo pregunta.
 */

import type { Medida } from '@/dominio/tipos'
import { textoDeLoQueViene, type LoQueViene } from '@/dominio/siguiente'

const cuenta = (n: number, singular: string, varios: string) => `${n} ${n === 1 ? singular : varios}`

/** Una duración como se dice: "2 minutos", "1 minuto y 30 segundos", "45 segundos". */
export function duracionDicha(segundos: number): string {
  const minutos = Math.floor(segundos / 60)
  const resto = segundos % 60
  if (minutos === 0) return cuenta(resto, 'segundo', 'segundos')
  const enMinutos = cuenta(minutos, 'minuto', 'minutos')
  return resto === 0 ? enMinutos : `${enMinutos} y ${cuenta(resto, 'segundo', 'segundos')}`
}

export function anuncioDeLaSerie(numero: number, logrado: number, medida: Medida): string {
  return `Serie ${numero} anotada: ${medida === 'segundos' ? cuenta(logrado, 'segundo', 'segundos') : logrado}.`
}

/** El descanso que arranca, y la ráfaga que ocupa su principio si le toca una. */
export function anuncioDelDescanso(segundos: number, rafaga: string | null): string {
  const descanso = `Descanso de ${duracionDicha(segundos)}.`
  return rafaga ? `${descanso} Ráfaga: ${rafaga.toLowerCase()}.` : descanso
}

/** En minúscula, como lo dice la voz (`dichoDeLoQueViene`): va en el medio de una frase. */
const loQueVieneDicho = (viene: LoQueViene) => textoDeLoQueViene(viene).toLowerCase()

export function anuncioDeLoQueViene(viene: LoQueViene): string {
  return `Después: ${loQueVieneDicho(viene)}.`
}

export function anuncioDelEjercicioCompleto(viene: LoQueViene | null): string {
  return viene ? `Ejercicio completo. A continuación: ${loQueVieneDicho(viene)}.` : 'Ejercicio completo.'
}

/** Una sola vez por descanso: los tics de la piel cuentan los otros dos. */
export const QUEDAN_TRES = 'Quedan 3 segundos.'

/**
 * Lo que la región hace con lo que se le pide, sin React: `escribir` recibe
 * cómo pasar del texto de antes al nuevo.
 *
 * - `anunciar` reemplaza el texto. Si es igual al anterior le agrega un
 *   espacio duro: un texto igual no cambia el DOM, y sin cambio el lector calla.
 * - `callar` lo vacía. Una región educada que se vacía no dice nada, y así no
 *   le queda adentro una frase que ya no es cierta —la serie deshecha, el
 *   descanso salteado— para quien la lea de arriba a abajo después.
 * - `anunciarSi` dice el texto cuando `confirmacion` da true, y solo si
 *   mientras tanto nadie anunció ni calló otra cosa: lo que se dijo o se
 *   calló después es más nuevo, y gana.
 */
export function crearAnunciador(escribir: (cambio: (antes: string) => string) => void) {
  let vuelta = 0
  const anunciar = (texto: string) => {
    vuelta++
    escribir((antes) => (antes === texto ? `${texto}\u00a0` : texto))
  }
  return {
    anunciar,
    callar: () => {
      vuelta++
      escribir(() => '')
    },
    anunciarSi: (confirmacion: Promise<boolean>, texto: string) => {
      const esta = ++vuelta
      void confirmacion.then(
        (sigue) => {
          if (sigue && vuelta === esta) anunciar(texto)
        },
        () => undefined,
      )
    },
  }
}
