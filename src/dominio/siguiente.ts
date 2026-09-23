/**
 * Qué viene después.
 *
 * ## El agujero que tapa
 *
 * "No hay nada que me avise qué ejercicio viene después y tener que estar
 * pendiente de eso me quita segundos de actividad y me hace perder ritmo."
 *
 * Era literal: en toda la pantalla de entrenar no se nombraba nunca el
 * ejercicio siguiente. Lo único que decía "siguiente" era la etiqueta de un
 * botón, que no dice cuál.
 *
 * ## Por qué el momento no es el que parece
 *
 * Uno diría "en el descanso", pero el descanso está ENTRE SERIES del mismo
 * ejercicio: lo que sigue a un descanso es otra serie de lo mismo. Y después de
 * la última serie no hay descanso —`anotar` solo lo arranca si queda otra— así
 * que la transición entre ejercicios es instantánea y muda: cambia el título y
 * hay que leerlo.
 *
 * O sea que hay dos momentos, y los dos importan:
 *
 * 1. **El último descanso del ejercicio**, donde queda una serie. Es el aviso
 *    previo: uno a tres minutos antes, así que cuando la última serie termina
 *    ya lo sabías.
 * 2. **La pantalla de ejercicio completo**, que hoy dice eso y nada más. Es el
 *    instante exacto en que se pierde el hilo.
 *
 * Con dos o más series por delante devuelve `null` a propósito: ahí lo que
 * viene es otra serie de lo mismo, y decirlo sería mobiliario. Un dato que
 * aparece siempre deja de ser un dato.
 *
 * ## Por qué vive en el dominio
 *
 * Mismo motivo que `dichoDelDescanso`: son cinco ramas, no un renderizado, y
 * una de ellas —la del final de la sesión— depende de si hay fuelle y de si hay
 * serie de cierre, que son dos cosas que la pantalla calcula lejos de acá.
 */

/** Lo que viene, ya resuelto. La pantalla solo lo dibuja. */
export type LoQueViene =
  | { clase: 'ejercicio'; nombre: string }
  | { clase: 'bajada'; nombre: string }
  | { clase: 'fuelle' }
  | { clase: 'cierre'; nombre: string }
  | { clase: 'preguntas' }

export interface Paso {
  nombre: string
  bajada: boolean
}

export function loQueViene(entrada: {
  plan: readonly Paso[]
  /** En qué paso del plan va. */
  enCurso: number
  /** Series que quedan de ESTE ejercicio. Cero es "ya está completo". */
  quedan: number
  /** Si la sesión tiene bloque de fuelle después de la fuerza. */
  hayFuelle: boolean
  /** El nombre de la serie de cierre, o null si esta sesión no tiene. */
  nombreDelCierre: string | null
}): LoQueViene | null {
  const { plan, enCurso, quedan, hayFuelle, nombreDelCierre } = entrada

  // Con dos series o más por delante, lo que viene es otra serie de lo mismo.
  if (quedan > 1) return null

  const siguiente = plan[enCurso + 1]
  if (siguiente) {
    // La bajada se nombra distinto porque ES distinto: en una sesión densa, lo
    // que viene después del trabajo duro es un eslabón MÁS FÁCIL de la misma
    // cadena. Sin rotularlo se lee como un error de la app.
    return { clase: siguiente.bajada ? 'bajada' : 'ejercicio', nombre: siguiente.nombre }
  }

  // Se terminó la fuerza. Lo que sigue lo decide la sesión, no el plan.
  if (hayFuelle) return { clase: 'fuelle' }
  if (nombreDelCierre) return { clase: 'cierre', nombre: nombreDelCierre }
  return { clase: 'preguntas' }
}

/**
 * Cómo se escribe en pantalla.
 *
 * Y de paso arregla una deshonestidad chica: hoy, en el último ejercicio, el
 * botón dice "Terminar" y después aparecen ocho a doce minutos de fuelle.
 */
export function textoDeLoQueViene(viene: LoQueViene): string {
  switch (viene.clase) {
    case 'ejercicio':
      return viene.nombre
    case 'bajada':
      return viene.nombre
    case 'fuelle':
      return 'El fuelle'
    case 'cierre':
      return `${viene.nombre}, la de cierre`
    case 'preguntas':
      return 'El final de la sesión'
  }
}

/** El rótulo de arriba. La bajada lo dice ahí para no alargar el nombre. */
export function rotuloDeLoQueViene(viene: LoQueViene): string {
  return viene.clase === 'bajada' ? 'DESPUÉS · BAJADA' : 'DESPUÉS'
}

/**
 * Lo que se dice en voz alta.
 *
 * Con "sigue" adelante porque una frase que arranca con el nombre del ejercicio
 * se pierde: la primera sílaba llega mientras la persona todavía está
 * registrando que alguien habló.
 */
export function dichoDeLoQueViene(viene: LoQueViene): string {
  switch (viene.clase) {
    case 'ejercicio':
      return `Sigue: ${viene.nombre.toLowerCase()}.`
    case 'bajada':
      return `Bajada: ${viene.nombre.toLowerCase()}.`
    case 'fuelle':
      return 'Sigue el fuelle.'
    case 'cierre':
      return `Última: ${viene.nombre.toLowerCase()}.`
    case 'preguntas':
      return 'Terminaste.'
  }
}
