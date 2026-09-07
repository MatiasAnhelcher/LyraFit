/**
 * Estadísticas derivadas del historial.
 *
 * Funciones puras sobre las sesiones ya guardadas. No hay ningún número
 * guardado en la base que después pueda quedar desactualizado: todo se calcula
 * a partir de lo que efectivamente entrenaste.
 *
 * Dos cosas que estaban acá y ya no están, porque hacían más mal que bien:
 *
 * - **El "volumen"** sumaba repeticiones con segundos. Veinticinco segundos de
 *   plancha más diez flexiones daban treinta y cinco de algo que no existe. Era
 *   la tercera cifra de la pantalla principal y el eje de todos los gráficos.
 *   Lo reemplaza el conteo de series, que sí es comparable, y el índice de
 *   carga, que sí dice algo sobre fuerza.
 *
 * - **La racha de días.** Estaba rota —contaba días de calendario con hueco
 *   máximo de dos, y las rutinas de la app tienen huecos de tres y cuatro, así
 *   que alguien impecable durante dos meses veía un tres— pero el problema no
 *   era el cálculo. En una app de fuerza el descanso es parte del programa, y
 *   una racha diaria premia exactamente lo que no hay que hacer. Lo que la
 *   reemplaza vive en `adherencia.ts`.
 */

import type { Patron, Sesion } from './tipos'
import { POR_ID } from './biblioteca'
import { indiceDeCarga } from './progresion'
import { lunesDe } from './adherencia'

/** Cuántas series se completaron en una sesión. Es la unidad comparable. */
export function seriesDeSesion(sesion: Sesion): number {
  return sesion.registros.reduce((total, r) => total + r.series.length, 0)
}

export function seriesPorPatron(sesion: Sesion): Record<Patron, number> {
  const acumulado: Record<Patron, number> = { empuje: 0, traccion: 0, piernas: 0, core: 0 }

  for (const registro of sesion.registros) {
    const ejercicio = POR_ID.get(registro.ejercicioId)
    if (!ejercicio) continue
    acumulado[ejercicio.patron] += registro.series.length
  }
  return acumulado
}

/**
 * Repeticiones totales de una sesión, contando solo lo que se mide en
 * repeticiones. Los sostenes tienen su propia cuenta porque son otra cosa.
 */
export function repeticionesDeSesion(sesion: Sesion): number {
  return sumarPorMedida(sesion, 'repeticiones')
}

/** Segundos de sostén de una sesión. */
export function segundosDeSesion(sesion: Sesion): number {
  return sumarPorMedida(sesion, 'segundos')
}

function sumarPorMedida(sesion: Sesion, medida: 'repeticiones' | 'segundos'): number {
  return sesion.registros.reduce((total, registro) => {
    const ejercicio = POR_ID.get(registro.ejercicioId)
    if (!ejercicio || ejercicio.medida !== medida) return total
    return total + registro.series.reduce((suma, serie) => suma + serie.logrado, 0)
  }, 0)
}

export interface ResumenSemana {
  /** Lunes de esa semana, en formato AAAA-MM-DD. */
  semana: string
  sesiones: number
  series: number
  minutos: number
}

/** Agrupa el historial por semana, de la más vieja a la más nueva. */
export function porSemana(sesiones: Sesion[]): ResumenSemana[] {
  const mapa = new Map<string, ResumenSemana>()

  for (const sesion of sesiones) {
    const semana = lunesDe(sesion.fecha)
    const actual = mapa.get(semana) ?? { semana, sesiones: 0, series: 0, minutos: 0 }
    actual.sesiones += 1
    actual.series += seriesDeSesion(sesion)
    actual.minutos += Math.round(sesion.duracionSegundos / 60)
    mapa.set(semana, actual)
  }

  return [...mapa.values()].sort((a, b) => a.semana.localeCompare(b.semana))
}

export interface PuntoHistorico {
  fecha: string
  /** La mejor serie de ese día para ese ejercicio. */
  mejor: number
  /** Cuántas series se hicieron. */
  series: number
}

/** La evolución de un ejercicio puntual a lo largo del tiempo. */
export function historicoDeEjercicio(
  sesiones: Sesion[],
  ejercicioId: string,
): PuntoHistorico[] {
  const puntos: PuntoHistorico[] = []

  for (const sesion of [...sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    for (const registro of sesion.registros) {
      if (registro.ejercicioId !== ejercicioId) continue
      const logros = registro.series.map((s) => s.logrado)
      if (logros.length === 0) continue
      puntos.push({
        fecha: sesion.fecha,
        mejor: Math.max(...logros),
        series: logros.length,
      })
    }
  }

  return puntos
}

/** El récord personal de un ejercicio: la mejor serie que registraste. */
export function recordDe(sesiones: Sesion[], ejercicioId: string): number {
  const puntos = historicoDeEjercicio(sesiones, ejercicioId)
  if (puntos.length === 0) return 0
  return Math.max(...puntos.map((p) => p.mejor))
}

export interface PuntoDeFuerza {
  fecha: string
  /** El índice de carga de la mejor serie del día en esta cadena. */
  carga: number
  ejercicioId: string
}

/**
 * La curva de fuerza de una cadena, en índice de carga.
 *
 * Es el gráfico que antes no se podía dibujar. El registro crudo de
 * repeticiones se desploma cada vez que se cambia de eslabón —pasás de hacer
 * quince a hacer seis— y muestra un retroceso justo en el momento de mayor
 * logro. El índice de carga hace comparables ejercicios distintos, así que la
 * línea sube parejo a través de toda la cadena.
 *
 * Es una estimación, y en la pantalla se dice.
 */
export function curvaDeFuerza(sesiones: Sesion[], patron: Patron): PuntoDeFuerza[] {
  const porDia = new Map<string, PuntoDeFuerza>()

  for (const sesion of sesiones) {
    for (const registro of sesion.registros) {
      const ejercicio = POR_ID.get(registro.ejercicioId)
      if (!ejercicio || ejercicio.patron !== patron) continue

      const mejor = Math.max(0, ...registro.series.map((s) => s.logrado))
      if (mejor <= 0) continue

      const carga = indiceDeCarga(ejercicio, mejor)
      const previo = porDia.get(sesion.fecha)
      if (!previo || carga > previo.carga) {
        porDia.set(sesion.fecha, { fecha: sesion.fecha, carga, ejercicioId: ejercicio.id })
      }
    }
  }

  return [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export interface Totales {
  sesiones: number
  series: number
  minutos: number
  repeticiones: number
  segundos: number
}

export function totales(sesiones: Sesion[]): Totales {
  return {
    sesiones: sesiones.length,
    series: sesiones.reduce((suma, s) => suma + seriesDeSesion(s), 0),
    minutos: Math.round(sesiones.reduce((suma, s) => suma + s.duracionSegundos, 0) / 60),
    repeticiones: sesiones.reduce((suma, s) => suma + repeticionesDeSesion(s), 0),
    segundos: sesiones.reduce((suma, s) => suma + segundosDeSesion(s), 0),
  }
}

export { lunesDe }
