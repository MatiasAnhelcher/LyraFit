/**
 * Vitalidad y calibración: lo que la app puede decir honestamente sobre el
 * efecto de entrenar, y sobre qué tan bien se conoce alguien su propio cuerpo.
 *
 * Sobre lo primero hay que ser cuidadoso. La idea de que entrenar mejora la
 * memoria o la concentración está mucho peor sostenida de lo que suena: cuando
 * se corrige por grupo control activo y por sesgo de publicación, el efecto se
 * desvanece. Lo que sí aguanta es el efecto agudo sobre el ánimo y la energía
 * el mismo día — que además es la única promesa que la persona puede verificar
 * por su cuenta.
 *
 * Por eso acá no hay ninguna promesa. Hay dos mediciones propias:
 *
 * - **Delta de vitalidad**: cuánta energía sentís antes y después. La app no
 *   te dice que vas a sentirte mejor, te muestra si te pasa a vos.
 * - **Calibración**: cuánto se parece lo que predecías a lo que te salió. Es
 *   una medida de conciencia corporal construida enteramente sobre datos que
 *   la app ya registraba, sin sensores y sin preguntar nada nuevo.
 */

import type { Sesion } from './tipos'

/** Series mínimas para que la calibración signifique algo. */
export const SERIES_MINIMAS = 30

/** Sesiones mínimas para hablar del delta de vitalidad. */
export const SESIONES_MINIMAS = 8

/**
 * Cambio mínimo que se puede llamar cambio, en repeticiones.
 * Por debajo de esto, con treinta series, es ruido.
 */
export const CAMBIO_MINIMO = 0.3

export interface Calibracion {
  /** Series con predicción usadas en el cálculo. */
  series: number
  /**
   * Error medio con signo. Positivo quiere decir que te salen más de las que
   * creías: te subestimás.
   */
  sesgo: number
  /** Error absoluto medio, en repeticiones. Es la precisión. */
  error: number
  /** El mismo error, relativo al tamaño de lo predicho. */
  errorRelativo: number
  /**
   * Cuánto mejoró respecto de las treinta series anteriores. Negativo es
   * mejor —menos error—. Es null cuando no hay datos suficientes o cuando la
   * diferencia es demasiado chica para distinguirla del ruido.
   */
  tendencia: number | null
}

interface Punto {
  predicho: number
  logrado: number
}

function puntos(sesiones: Sesion[]): Punto[] {
  return [...sesiones]
    .sort((a, b) => a.finalizadaEn - b.finalizadaEn)
    .flatMap((s) =>
      s.registros.flatMap((r) =>
        r.series.flatMap((serie) =>
          serie.predicho === undefined
            ? []
            : [{ predicho: serie.predicho, logrado: serie.logrado }],
        ),
      ),
    )
}

function resumir(datos: Punto[]): { sesgo: number; error: number; relativo: number } {
  const errores = datos.map((d) => d.logrado - d.predicho)
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return {
    sesgo: media(errores),
    error: media(errores.map(Math.abs)),
    relativo: media(datos.map((d) => Math.abs(d.logrado - d.predicho) / Math.max(d.predicho, 1))),
  }
}

/**
 * Qué tan bien predice esta persona lo que le va a salir.
 *
 * Se muestra por mes, nunca por sesión, y nunca como meta ni con recompensa:
 * si diera puntos se podría hacer trampa prediciendo bajo, y dejaría de medir
 * lo que dice medir.
 */
export function calibracion(sesiones: Sesion[]): Calibracion | null {
  const todos = puntos(sesiones)
  if (todos.length < SERIES_MINIMAS) return null

  const ultimas = todos.slice(-SERIES_MINIMAS)
  const actual = resumir(ultimas)

  let tendencia: number | null = null
  if (todos.length >= SERIES_MINIMAS * 2) {
    const previas = todos.slice(-SERIES_MINIMAS * 2, -SERIES_MINIMAS)
    const anterior = resumir(previas)
    const cambio = actual.error - anterior.error
    if (Math.abs(cambio) >= CAMBIO_MINIMO) tendencia = cambio
  }

  return {
    series: ultimas.length,
    sesgo: Math.round(actual.sesgo * 10) / 10,
    error: Math.round(actual.error * 10) / 10,
    errorRelativo: Math.round(actual.relativo * 100) / 100,
    tendencia: tendencia === null ? null : Math.round(tendencia * 10) / 10,
  }
}

/** Cómo contar la calibración en una frase, sin adjetivos. */
export function frasePorCalibracion(c: Calibracion): string {
  const direccion =
    Math.abs(c.sesgo) < 0.3
      ? 'y no tirás ni para arriba ni para abajo'
      : c.sesgo > 0
        ? `y tendés a subestimarte (+${c.sesgo.toFixed(1)})`
        : `y tendés a sobrestimarte (${c.sesgo.toFixed(1)})`

  return `En las últimas ${c.series} series te equivocaste en promedio ${c.error.toFixed(1)} ${c.error === 1 ? 'repetición' : 'repeticiones'}, ${direccion}.`
}

export interface Vitalidad {
  sesiones: number
  /** Promedio de cuánto sube la energía de principio a fin de la sesión. */
  delta: number
  /** Cuántas veces de las medidas subió. */
  subieron: number
}

/**
 * El delta de vitalidad de las últimas sesiones.
 *
 * Es el número más honesto que la app puede dar sobre lo que entrenar le hace
 * a la cabeza, porque no es un promedio de estudios ajenos: es lo que le pasó
 * a esta persona.
 */
export function vitalidad(sesiones: Sesion[], ultimas = 10): Vitalidad | null {
  const medidas = [...sesiones]
    .sort((a, b) => b.finalizadaEn - a.finalizadaEn)
    .filter((s) => s.vitalidadPre !== undefined && s.vitalidadPost !== undefined)
    .slice(0, ultimas)

  if (medidas.length < SESIONES_MINIMAS) return null

  const deltas = medidas.map((s) => (s.vitalidadPost ?? 0) - (s.vitalidadPre ?? 0))
  return {
    sesiones: deltas.length,
    delta: Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10,
    subieron: deltas.filter((d) => d > 0).length,
  }
}

/**
 * Ánimo medio de las últimas sesiones, de -2 a +2.
 *
 * Lo mira el motor de progresión antes de subir la exigencia. La respuesta
 * afectiva al entrenamiento predice si va a haber una próxima sesión mejor que
 * cualquier medida de rendimiento, así que apretar el acelerador justo cuando
 * alguien la está pasando mal es la forma más segura de perderlo.
 */
export function animoReciente(sesiones: Sesion[], ultimas = 3): number | undefined {
  const valores = [...sesiones]
    .sort((a, b) => b.finalizadaEn - a.finalizadaEn)
    .slice(0, ultimas)
    .map((s) => s.animo)
    .filter((a): a is number => a !== undefined)

  if (valores.length < 2) return undefined
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

/**
 * Carga interna de una sesión: el session-RPE de Foster.
 *
 * Es esfuerzo por duración, y es la forma mejor validada de estimar cuánto
 * costó un entrenamiento sin ningún sensor. En fuerza tiene una trampa —el
 * descanso domina el tiempo total, así que descansar más te sube la carga— por
 * eso se cuenta el tiempo de trabajo estimado y no el reloj entero.
 */
export function cargaInterna(sesion: Sesion): number | null {
  if (sesion.esfuerzo === undefined) return null
  const series = sesion.registros.reduce((n, r) => n + r.series.length, 0)
  if (series === 0) return null
  // Se estima el trabajo en 45 segundos por serie en vez de usar la duración
  // total, que está inflada por los descansos.
  const minutos = (series * 45) / 60
  return Math.round(sesion.esfuerzo * minutos)
}
