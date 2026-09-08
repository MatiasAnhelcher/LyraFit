/**
 * La anticipación.
 *
 * El motor es determinista: dado un avance, sabe con exactitud cuántas
 * sesiones cumplidas faltan para cambiar de eslabón, en qué punto de la
 * ventana está la persona, y si la sesión de hoy es la que dispara el salto.
 *
 * Ese dato ya existía y no se mostraba en ningún lado, que es probablemente el
 * desperdicio más grande que tenía el producto. Vale la pena explicar por qué:
 *
 * La señal dopaminérgica no responde a la recompensa, responde al **error de
 * predicción de recompensa**. Un premio perfectamente predecible deja de
 * producir señal —por eso las monedas y el confeti se apagan en dos semanas—
 * mientras que estar a una sesión de algo que todavía no pasó es exactamente
 * la forma que tiene la anticipación. Y acá esa anticipación no hay que
 * inventarla ni fabricarla con una barra de progreso decorativa: es una
 * propiedad real del motor, y es verdad.
 *
 * La contracara es que el énfasis se gasta. La mayoría de los días faltan seis
 * sesiones y eso no es noticia. Por eso hay un umbral: la app se calla salvo
 * cuando de verdad está cerca.
 */

import type { Avance, Cadena, Ejercicio, Sesion } from './tipos'
import { indiceDeCarga, proximoHitoDeCadena, proyectar } from './progresion'

/**
 * A partir de acá la app puede hablar. Con más sesiones por delante, la
 * anticipación no es información: es ruido con forma de promesa.
 */
export const CERCA = 2

export interface Anticipacion {
  /** El eslabón que viene, o null si es el último de la cadena. */
  siguiente: Ejercicio | null
  /**
   * Sesiones cumplidas que faltan para llegar. Null si no se puede proyectar
   * —porque ya está en el último eslabón, o porque el cálculo no converge—.
   */
  sesiones: number | null
  /** La próxima sesión cumplida cambia de ejercicio. Es el estado más cargado. */
  aUnaSesion: boolean
  /** Está cerca como para que valga la pena decirlo. */
  cerca: boolean
  /** Qué parte de la ventana del eslabón actual lleva recorrida, de 0 a 1. */
  enLaVentana: number
  /** Está en el techo de la ventana, consolidando antes de saltar. */
  enElTecho: boolean
}

export function anticipacion(
  avance: Avance,
  cadena: Cadena,
  ejercicios: Map<string, Ejercicio>,
): Anticipacion {
  const actual = ejercicios.get(avance.ejercicioId)
  const siguiente = proximoHitoDeCadena(avance, cadena, ejercicios)

  const recorrido = actual ? actual.ventana.max - actual.ventana.min : 0
  const hecho = actual ? avance.objetivoActual.cantidad - actual.ventana.min : 0
  const enLaVentana = recorrido > 0 ? Math.min(1, Math.max(0, hecho / recorrido)) : 1

  const sesiones = siguiente
    ? proyectar(avance, { cadena, ejercicios }, siguiente.id)
    : null

  return {
    siguiente,
    sesiones,
    aUnaSesion: sesiones === 1,
    cerca: sesiones !== null && sesiones <= CERCA,
    enLaVentana,
    enElTecho: actual ? avance.objetivoActual.cantidad >= actual.ventana.max : false,
  }
}

/**
 * ¿La serie que está por anotar es un récord personal en este ejercicio?
 *
 * Se calcula antes de anotarla, así el momento se puede marcar cuando ocurre y
 * no diez minutos después en un resumen.
 */
export function esRecord(
  sesiones: Sesion[],
  ejercicioId: string,
  logrado: number,
): boolean {
  if (logrado <= 0) return false

  let mejor = 0
  for (const sesion of sesiones) {
    for (const registro of sesion.registros) {
      if (registro.ejercicioId !== ejercicioId) continue
      for (const serie of registro.series) {
        if (serie.logrado > mejor) mejor = serie.logrado
      }
    }
  }
  // El primer registro de un ejercicio no es un récord: es una línea de base.
  return mejor > 0 && logrado > mejor
}

/**
 * Hechos verdaderos sobre la persona, para cuando hay algo que decir.
 *
 * Ninguno es una recompensa: todos son feedback informativo sobre la propia
 * competencia, que es la única clase de refuerzo que la evidencia muestra que
 * no erosiona la motivación. Y ninguno se inventa: si el dato no está, la
 * función devuelve una lista vacía y la app se calla.
 */
export interface Hecho {
  clave: string
  texto: string
  /** De 0 a 3: cuánto pesa. Ordena qué se muestra cuando hay varios. */
  peso: number
}

export function hechos(
  sesiones: Sesion[],
  avances: Map<string, Avance>,
  ejercicios: Map<string, Ejercicio>,
): Hecho[] {
  const salida: Hecho[] = []
  if (sesiones.length === 0) return salida

  // Cuánta más carga movés hoy que la primera vez, por cadena. Es el número
  // que responde "¿esto sirve para algo?" sin comparar con nadie más.
  for (const avance of avances.values()) {
    const ejercicio = ejercicios.get(avance.ejercicioId)
    if (!ejercicio) continue

    const primeras = sesiones
      .flatMap((s) => s.registros)
      .filter((r) => {
        const e = ejercicios.get(r.ejercicioId)
        return e?.patron === avance.patron
      })
    if (primeras.length < 6) continue

    const primerRegistro = primeras[primeras.length - 1]
    const primerEjercicio = primerRegistro ? ejercicios.get(primerRegistro.ejercicioId) : undefined
    if (!primerRegistro || !primerEjercicio) continue

    const antes = indiceDeCarga(
      primerEjercicio,
      Math.max(...primerRegistro.series.map((s) => s.logrado), 1),
    )
    const ahora = indiceDeCarga(ejercicio, avance.objetivoActual.cantidad)
    const subida = Math.round((ahora / antes - 1) * 100)

    if (subida >= 10) {
      salida.push({
        clave: `carga-${avance.patron}`,
        peso: 2,
        texto: `Estás moviendo un ${subida}% más de carga en ${ejercicio.nombre.toLowerCase()} que en tu primera sesión.`,
      })
    }
  }

  return salida.sort((a, b) => b.peso - a.peso)
}
