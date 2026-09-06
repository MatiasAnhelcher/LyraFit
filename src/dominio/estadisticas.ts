/**
 * Estadísticas derivadas del historial.
 *
 * Funciones puras sobre las sesiones ya guardadas. No hay ningún número
 * guardado en la base que después pueda quedar desactualizado: todo se calcula
 * a partir de lo que efectivamente entrenaste.
 */

import type { Patron, Sesion } from './tipos'
import { POR_ID } from './biblioteca'

/** Volumen de una serie: repeticiones, o segundos de sostén. */
export function volumenDeSesion(sesion: Sesion): number {
  return sesion.registros.reduce(
    (total, registro) =>
      total + registro.series.reduce((suma, serie) => suma + serie.logrado, 0),
    0,
  )
}

export function volumenPorPatron(sesion: Sesion): Record<Patron, number> {
  const acumulado: Record<Patron, number> = {
    empuje: 0,
    traccion: 0,
    piernas: 0,
    core: 0,
  }

  for (const registro of sesion.registros) {
    const ejercicio = POR_ID.get(registro.ejercicioId)
    if (!ejercicio) continue
    acumulado[ejercicio.patron] += registro.series.reduce(
      (suma, serie) => suma + serie.logrado,
      0,
    )
  }

  return acumulado
}

/** Diferencia en días entre dos fechas AAAA-MM-DD. */
function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00`)
  const b = new Date(`${hasta}T00:00:00`)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Racha de días entrenados: cuántos días seguidos con al menos una sesión,
 * contando hacia atrás desde hoy. Se permite un día de hueco porque descansar
 * es parte del plan, no una falla — el que rompe la racha es el segundo.
 */
export function rachaActual(sesiones: Sesion[], hoy: string): number {
  const dias = [...new Set(sesiones.map((s) => s.fecha))].sort().reverse()
  const primero = dias[0]
  if (!primero) return 0

  // Si hace más de dos días que no entrenás, la racha ya se cortó.
  if (diasEntre(primero, hoy) > 2) return 0

  let racha = 1
  for (let i = 1; i < dias.length; i++) {
    const anterior = dias[i - 1]
    const actual = dias[i]
    if (!anterior || !actual) break
    if (diasEntre(actual, anterior) <= 2) racha++
    else break
  }

  return racha
}

export interface ResumenSemana {
  /** Lunes de esa semana, en formato AAAA-MM-DD. */
  semana: string
  sesiones: number
  volumen: number
  minutos: number
}

/** El lunes de la semana a la que pertenece una fecha. */
export function lunesDe(fechaISO: string): string {
  const fecha = new Date(`${fechaISO}T00:00:00`)
  const dia = fecha.getDay()
  const retroceso = dia === 0 ? 6 : dia - 1
  fecha.setDate(fecha.getDate() - retroceso)
  return fecha.toISOString().slice(0, 10)
}

/** Agrupa el historial por semana, de la más vieja a la más nueva. */
export function porSemana(sesiones: Sesion[]): ResumenSemana[] {
  const mapa = new Map<string, ResumenSemana>()

  for (const sesion of sesiones) {
    const semana = lunesDe(sesion.fecha)
    const actual = mapa.get(semana) ?? { semana, sesiones: 0, volumen: 0, minutos: 0 }
    actual.sesiones += 1
    actual.volumen += volumenDeSesion(sesion)
    actual.minutos += Math.round(sesion.duracionSegundos / 60)
    mapa.set(semana, actual)
  }

  return [...mapa.values()].sort((a, b) => a.semana.localeCompare(b.semana))
}

export interface PuntoHistorico {
  fecha: string
  /** La mejor serie de ese día para ese ejercicio. */
  mejor: number
  /** Volumen total del ejercicio ese día. */
  volumen: number
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
        volumen: logros.reduce((a, b) => a + b, 0),
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

export interface Totales {
  sesiones: number
  volumen: number
  minutos: number
  racha: number
}

export function totales(sesiones: Sesion[], hoy: string): Totales {
  return {
    sesiones: sesiones.length,
    volumen: sesiones.reduce((suma, s) => suma + volumenDeSesion(s), 0),
    minutos: Math.round(
      sesiones.reduce((suma, s) => suma + s.duracionSegundos, 0) / 60,
    ),
    racha: rachaActual(sesiones, hoy),
  }
}
