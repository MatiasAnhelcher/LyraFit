/**
 * El motor de progresión.
 *
 * Es el corazón de la app y la única parte que decide qué entrenás mañana.
 * Todo acá adentro son funciones puras: reciben datos, devuelven datos, no
 * tocan la base ni la pantalla. Eso es lo que las hace verificables con tests
 * y lo que permite cambiar las reglas sin romper el resto del proyecto.
 *
 * La idea del método es vieja y probada: no subís de ejercicio porque pasó el
 * tiempo, subís cuando el cuerpo demuestra que puede. Y cuando dos sesiones
 * seguidas salen mal, bajás en vez de insistir — ahí es donde la mayoría se
 * lesiona o abandona.
 */

import type {
  Avance,
  Cadena,
  Ejercicio,
  Medida,
  Objetivo,
  Serie,
} from './tipos'

/** Cómo salió una sesión para un ejercicio determinado. */
export type Resultado = 'exito' | 'parcial' | 'fallo'

/** Sesiones consecutivas cumpliendo el objetivo para pasar de nivel. */
export const EXITOS_PARA_AVANZAR = 2

/** Sesiones consecutivas por debajo del mínimo antes de hacer descarga. */
export const FALLOS_PARA_DESCARGAR = 2

/** Por debajo de esta proporción del objetivo, la sesión cuenta como fallo. */
export const UMBRAL_FALLO = 0.6

/** Cuánto sube el objetivo cuando se cumple, según la unidad del ejercicio. */
export function incremento(medida: Medida): number {
  return medida === 'segundos' ? 5 : 1
}

/**
 * Cómo se nombra una cantidad según su unidad. "Subimos a 25 por serie" no
 * dice lo mismo en una plancha que en una flexión: en una es tiempo y en la
 * otra son repeticiones, y el texto tiene que decir cuál.
 */
export function conUnidad(medida: Medida, cantidad: number): string {
  return medida === 'segundos' ? `${cantidad} segundos` : `${cantidad}`
}

/**
 * Clasifica cómo salió un ejercicio en una sesión.
 *
 * Se mira la serie más floja, no el promedio: tres series de diez y una de
 * dos no es un objetivo cumplido, es una serie que se fue de rango.
 */
export function evaluarSesion(objetivo: Objetivo, series: Serie[]): Resultado {
  const completadas = series.filter((s) => s.logrado > 0)
  if (completadas.length === 0) return 'fallo'

  const peor = Math.min(...completadas.map((s) => s.logrado))
  const seriesCompletas = completadas.length >= objetivo.series

  if (seriesCompletas && peor >= objetivo.cantidad) return 'exito'

  const proporcion = peor / objetivo.cantidad
  const faltaronSeries = completadas.length < Math.ceil(objetivo.series / 2)
  if (proporcion < UMBRAL_FALLO || faltaronSeries) return 'fallo'

  return 'parcial'
}

/** La decisión que toma el motor después de evaluar una sesión. */
export interface Decision {
  avance: Avance
  /** Qué cambió, en una frase, para poder mostrárselo a la persona. */
  explicacion: string
  /** True si hubo cambio de ejercicio, para destacarlo en la interfaz. */
  cambioDeNivel: boolean
}

interface Contexto {
  cadena: Cadena
  /** Los ejercicios de la cadena, indexados por id. */
  ejercicios: Map<string, Ejercicio>
}

function ejercicioDe(ctx: Contexto, id: string): Ejercicio {
  const ejercicio = ctx.ejercicios.get(id)
  if (!ejercicio) {
    throw new Error(`El ejercicio "${id}" no está en la cadena de ${ctx.cadena.patron}.`)
  }
  return ejercicio
}

function vecino(ctx: Contexto, id: string, salto: 1 | -1): string | null {
  const posicion = ctx.cadena.ejercicios.indexOf(id)
  if (posicion === -1) return null
  const destino = ctx.cadena.ejercicios[posicion + salto]
  return destino ?? null
}

/**
 * Decide el próximo paso a partir del avance actual y de cómo salió la sesión.
 *
 * Las reglas, en orden:
 *
 * - Se cumple el objetivo dos sesiones seguidas → se pasa al ejercicio
 *   siguiente de la cadena, arrancando con su carga de entrada.
 * - Se cumple una sola vez → mismo ejercicio, un poco más de exigencia.
 * - Sale parcial → se sostiene todo igual y se corta la racha. Consolidar
 *   también es progresar.
 * - Se falla dos sesiones seguidas → descarga: primero se baja la exigencia
 *   dentro del mismo ejercicio y, si ya estaba en el piso, se vuelve al
 *   ejercicio anterior.
 */
export function siguienteAvance(
  avance: Avance,
  resultado: Resultado,
  ctx: Contexto,
  ahora: number = Date.now(),
): Decision {
  const actual = ejercicioDe(ctx, avance.ejercicioId)
  const base = { patron: avance.patron, actualizadoEn: ahora }

  if (resultado === 'exito') {
    const rachaExitos = avance.rachaExitos + 1

    if (rachaExitos >= EXITOS_PARA_AVANZAR) {
      const siguiente = vecino(ctx, actual.id, 1)

      if (siguiente) {
        const nuevo = ejercicioDe(ctx, siguiente)
        return {
          cambioDeNivel: true,
          explicacion: `Dos sesiones seguidas cumpliendo el objetivo. Subís a ${nuevo.nombre}.`,
          avance: {
            ...base,
            ejercicioId: nuevo.id,
            objetivoActual: { ...nuevo.entrada },
            rachaExitos: 0,
            rachaFallos: 0,
          },
        }
      }

      // Último eslabón de la cadena: no hay adónde subir, así que se sigue
      // acumulando volumen sobre el ejercicio más exigente.
      return {
        cambioDeNivel: false,
        explicacion: `Llegaste al final de la cadena de ${ctx.cadena.nombre}. Seguís sumando volumen sobre ${actual.nombre}.`,
        avance: {
          ...base,
          ejercicioId: actual.id,
          objetivoActual: {
            series: avance.objetivoActual.series,
            cantidad: avance.objetivoActual.cantidad + incremento(actual.medida),
          },
          rachaExitos: 0,
          rachaFallos: 0,
        },
      }
    }

    const subido = avance.objetivoActual.cantidad + incremento(actual.medida)
    const tope = actual.objetivo.cantidad
    const cantidad = Math.min(subido, tope)
    const enElTope = cantidad === avance.objetivoActual.cantidad

    return {
      cambioDeNivel: false,
      explicacion: enElTope
        ? `Objetivo cumplido. Una sesión más así y pasás al siguiente nivel.`
        : `Objetivo cumplido. Subimos a ${conUnidad(actual.medida, cantidad)} por serie.`,
      avance: {
        ...base,
        ejercicioId: actual.id,
        objetivoActual: { series: avance.objetivoActual.series, cantidad },
        rachaExitos,
        rachaFallos: 0,
      },
    }
  }

  if (resultado === 'parcial') {
    return {
      cambioDeNivel: false,
      explicacion: 'Quedaste cerca. Repetimos el mismo objetivo para consolidarlo.',
      avance: {
        ...base,
        ejercicioId: actual.id,
        objetivoActual: { ...avance.objetivoActual },
        rachaExitos: 0,
        rachaFallos: 0,
      },
    }
  }

  const rachaFallos = avance.rachaFallos + 1

  if (rachaFallos < FALLOS_PARA_DESCARGAR) {
    return {
      cambioDeNivel: false,
      explicacion: 'Sesión floja. Puede ser un mal día: mantenemos el objetivo.',
      avance: {
        ...base,
        ejercicioId: actual.id,
        objetivoActual: { ...avance.objetivoActual },
        rachaExitos: 0,
        rachaFallos,
      },
    }
  }

  const piso = actual.entrada.cantidad
  const reducido = Math.max(
    piso,
    Math.floor(avance.objetivoActual.cantidad * 0.8),
  )

  if (reducido < avance.objetivoActual.cantidad) {
    return {
      cambioDeNivel: false,
      explicacion: `Dos sesiones por debajo del mínimo. Bajamos a ${conUnidad(actual.medida, reducido)} por serie para recuperar la técnica.`,
      avance: {
        ...base,
        ejercicioId: actual.id,
        objetivoActual: {
          series: avance.objetivoActual.series,
          cantidad: reducido,
        },
        rachaExitos: 0,
        rachaFallos: 0,
      },
    }
  }

  const anterior = vecino(ctx, actual.id, -1)

  if (anterior) {
    const previo = ejercicioDe(ctx, anterior)
    return {
      cambioDeNivel: true,
      explicacion: `${actual.nombre} todavía te queda grande. Volvemos a ${previo.nombre} para construir la base.`,
      avance: {
        ...base,
        ejercicioId: previo.id,
        objetivoActual: { ...previo.objetivo },
        rachaExitos: 0,
        rachaFallos: 0,
      },
    }
  }

  return {
    cambioDeNivel: false,
    explicacion: 'Ya estás en el primer nivel con la carga mínima. Sostené y dale tiempo.',
    avance: {
      ...base,
      ejercicioId: actual.id,
      objetivoActual: { ...actual.entrada },
      rachaExitos: 0,
      rachaFallos: 0,
    },
  }
}

/** Crea el punto de partida de un patrón: primer ejercicio, carga de entrada. */
export function avanceInicial(
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
  ahora: number = Date.now(),
): Avance {
  const primeroId = cadena.ejercicios[0]
  if (!primeroId) {
    throw new Error(`La cadena de ${cadena.patron} está vacía.`)
  }
  const primero = ejercicios.get(primeroId)
  if (!primero) {
    throw new Error(`Falta el ejercicio "${primeroId}".`)
  }

  return {
    patron: cadena.patron,
    ejercicioId: primero.id,
    objetivoActual: { ...primero.entrada },
    rachaExitos: 0,
    rachaFallos: 0,
    actualizadoEn: ahora,
  }
}

/**
 * Qué porcentaje de la cadena llevás recorrido, contando el ejercicio actual
 * y lo que falta para dominarlo. Sirve para la barra de progreso.
 */
export function porcentajeDeCadena(
  avance: Avance,
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
): number {
  const total = cadena.ejercicios.length
  if (total === 0) return 0

  const posicion = cadena.ejercicios.indexOf(avance.ejercicioId)
  if (posicion === -1) return 0

  const actual = ejercicios.get(avance.ejercicioId)
  if (!actual) return 0

  const recorrido = actual.objetivo.cantidad - actual.entrada.cantidad
  const hecho = avance.objetivoActual.cantidad - actual.entrada.cantidad
  const dentroDelNivel = recorrido > 0 ? Math.min(1, hecho / recorrido) : 0

  return Math.round(((posicion + dentroDelNivel) / total) * 100)
}
