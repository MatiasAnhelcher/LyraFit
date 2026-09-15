import { describe, expect, it } from 'vitest'
import { CADENAS, EJERCICIOS, POR_ID, cadenaDe } from './biblioteca'
import { curvaDeFuerza } from './estadisticas'
import {
  BLOQUE_MAXIMO,
  BLOQUE_MINIMO,
  DESCANSO_DE_BAJADA,
  MINUTOS_OBJETIVO,
  SERIES_DE_BAJADA,
  bajadaDe,
  minutosDelBloque,
  minutosDeSesion,
} from './bajada'
import type { Patron, Sesion } from './tipos'

/**
 * Que el volumen extra sea gratis para el motor.
 *
 * La bajada funciona apoyada en dos reglas que ya existían y que no escribió
 * nadie pensando en ella: `cerrarSesion` saltea los registros cuyo ejercicio no
 * es el que el avance tenía puesto, y `curvaDeFuerza` se queda con el máximo
 * índice de carga del día. Las dos son ciertas hoy y las dos podrían dejar de
 * serlo mañana sin que nadie relacione el cambio con esto.
 *
 * Por eso están acá: no como documentación de lo que la bajada hace, sino como
 * alarma de las dos cosas de las que depende.
 */

const PATRONES: Patron[] = ['empuje', 'traccion', 'piernas', 'core']

describe('la bajada', () => {
  it('nunca es el mismo ejercicio que el que se está entrenando', () => {
    // Si lo fuera, `cerrarSesion` la sumaría al registro que el motor mide y
    // dos series de volumen contra un objetivo de tres inflarían o hundirían
    // el rendimiento según el día.
    for (const ejercicio of EJERCICIOS) {
      const abajo = bajadaDe(ejercicio, cadenaDe(ejercicio.patron), POR_ID)
      if (!abajo) continue
      expect(abajo.ejercicio.id, ejercicio.id).not.toBe(ejercicio.id)
    }
  })

  it('siempre es el eslabón inmediatamente anterior de la misma cadena', () => {
    for (const ejercicio of EJERCICIOS) {
      const cadena = cadenaDe(ejercicio.patron)
      const abajo = bajadaDe(ejercicio, cadena, POR_ID)
      const posicion = cadena.ejercicios.indexOf(ejercicio.id)
      if (posicion === 0) {
        expect(abajo, `${ejercicio.id} es el primero: no hay dónde bajar`).toBeNull()
        continue
      }
      expect(abajo?.ejercicio.id).toBe(cadena.ejercicios[posicion - 1])
      expect(abajo?.ejercicio.patron).toBe(ejercicio.patron)
    }
  })

  it('siempre pide menos carga que el ejercicio del que baja', () => {
    // Es lo que la hace una bajada y no un segundo entrenamiento, y también lo
    // que garantiza que no pueda reemplazar el punto del día en la curva.
    for (const ejercicio of EJERCICIOS) {
      const abajo = bajadaDe(ejercicio, cadenaDe(ejercicio.patron), POR_ID)
      if (!abajo) continue
      expect(abajo.ejercicio.ccr, `${ejercicio.id} → ${abajo.ejercicio.id}`).toBeLessThanOrEqual(
        ejercicio.ccr,
      )
    }
  })

  it('el primer eslabón de cada cadena no tiene bajada', () => {
    for (const cadena of CADENAS) {
      const primero = POR_ID.get(cadena.ejercicios[0]!)!
      expect(bajadaDe(primero, cadena, POR_ID), cadena.patron).toBeNull()
    }
  })

  it('su descanso queda por debajo del piso de recuperación del fuelle', () => {
    // Consecuencia buscada: la bajada no lleva ráfagas. Es volumen, y meterle
    // trabajo metabólico adentro la convertiría en otra cosa.
    expect(DESCANSO_DE_BAJADA).toBeLessThan(60)
  })
})

describe('la bajada no toca la curva de fuerza', () => {
  /** Una sesión con el ejercicio duro y, opcionalmente, su bajada. */
  function sesionCon(patron: Patron, ejercicioId: string, conBajada: boolean): Sesion {
    const ejercicio = POR_ID.get(ejercicioId)!
    const abajo = bajadaDe(ejercicio, cadenaDe(patron), POR_ID)
    return {
      id: `s-${ejercicioId}-${conBajada}`,
      fecha: '2026-09-14',
      finalizadaEn: 1,
      duracionSegundos: 1800,
      tipo: 'plan',
      registros: [
        {
          ejercicioId,
          objetivo: { series: 3, cantidad: ejercicio.ventana.min },
          series: Array.from({ length: 3 }, () => ({ logrado: ejercicio.ventana.min })),
        },
        ...(conBajada && abajo
          ? [
              {
                ejercicioId: abajo.ejercicio.id,
                objetivo: abajo.objetivo,
                bajada: true as const,
                series: Array.from({ length: SERIES_DE_BAJADA }, () => ({
                  logrado: abajo.objetivo.cantidad,
                })),
              },
            ]
          : []),
      ],
    }
  }

  it('el punto del día sigue siendo el del trabajo duro', () => {
    // `curvaDeFuerza` se queda con el MÁXIMO índice de carga del día. Si alguna
    // vez se cambiara por el promedio o por el último, la bajada hundiría la
    // curva justo en las sesiones más completas — y este test es el que lo
    // tiene que decir, porque mirando el gráfico parecería un estancamiento.
    for (const patron of PATRONES) {
      const cadena = cadenaDe(patron)
      for (const ejercicioId of cadena.ejercicios) {
        const sin = curvaDeFuerza([sesionCon(patron, ejercicioId, false)], patron)
        const con = curvaDeFuerza([sesionCon(patron, ejercicioId, true)], patron)
        expect(con.length, ejercicioId).toBe(sin.length)
        if (sin.length === 0) continue
        expect(con[0]!.carga, `${ejercicioId}: la bajada movió la curva`).toBeCloseTo(
          sin[0]!.carga,
          10,
        )
        expect(con[0]!.ejercicioId, `${ejercicioId}: el punto del día cambió de ejercicio`).toBe(
          sin[0]!.ejercicioId,
        )
      }
    }
  })
})

describe('cuánto dura una sesión', () => {
  /** El plan de cuerpo completo en el eslabón que se indique de cada cadena. */
  function plan(posicion: number, conBajada: boolean) {
    return PATRONES.flatMap((patron) => {
      const cadena = cadenaDe(patron)
      const id = cadena.ejercicios[Math.min(posicion, cadena.ejercicios.length - 1)]!
      const ejercicio = POR_ID.get(id)!
      const duro = {
        ejercicio,
        objetivo: { series: 3, cantidad: ejercicio.ventana.min },
      }
      if (!conBajada) return [duro]
      const abajo = bajadaDe(ejercicio, cadena, POR_ID)
      return abajo ? [duro, { ...abajo, descansoSegundos: DESCANSO_DE_BAJADA }] : [duro]
    })
  }

  it('una sesión de fuerza sola es corta, y por eso hacía falta todo esto', () => {
    // El punto de partida, medido: cuatro cadenas por tres series, en un
    // eslabón intermedio, no llegan ni a media hora. De acá sale la queja
    // original —"quiero transpirar"— y también la respuesta.
    const sola = minutosDeSesion(plan(4, false))
    expect(sola).toBeGreaterThan(15)
    expect(sola).toBeLessThan(40)
  })

  it('cumple la duración pedida, o llega al tope y lo dice', () => {
    // Las dos mitades importan. Que 45 y 60 se cumplan al minuto es lo que
    // convierte "quiero una hora" en algo que la app hace en vez de aproximar.
    // Y que más arriba el bloque quede clavado en su tope es lo que impide que
    // la app prometa noventa minutos estirando series que a nadie le sirven.
    for (const objetivo of MINUTOS_OBJETIVO) {
      const entradas = plan(4, true)
      const fuerza = minutosDeSesion(entradas)
      const bloque = minutosDelBloque(objetivo, fuerza)
      const total = minutosDeSesion(entradas, bloque * 60)

      if (bloque === BLOQUE_MAXIMO || bloque === BLOQUE_MINIMO) {
        expect(total, `pedidos ${objetivo}: el tope tiene que quedar por debajo`).toBeLessThan(
          objetivo,
        )
        continue
      }
      expect(total, `pedidos ${objetivo}, dieron ${total}`).toBeGreaterThanOrEqual(objetivo - 2)
      expect(total, `pedidos ${objetivo}, dieron ${total}`).toBeLessThanOrEqual(objetivo + 2)
    }
  })

  it('el techo de duración sube a medida que se progresa', () => {
    // Medido: 56 minutos en el primer eslabón, 71 en el noveno. No hay que
    // programarlo — los ejercicios difíciles tienen descansos más largos— pero
    // sí hay que no romperlo, porque es lo que hace que "lo más largo que dé"
    // signifique algo distinto en seis meses.
    const techo = (pos: number) => {
      const entradas = plan(pos, true)
      return minutosDeSesion(entradas, minutosDelBloque(90, minutosDeSesion(entradas)) * 60)
    }
    expect(techo(8)).toBeGreaterThan(techo(0))
  })

  it('pero no estira el bloque más allá del tope', () => {
    // Treinta y cinco minutos de metabólico pegados a la fuerza ya son dos
    // sesiones. Pedir tres horas no puede dar tres horas.
    expect(minutosDelBloque(180, 25)).toBe(BLOQUE_MAXIMO)
    // Y una sesión de fuerza que ya se pasó del objetivo igual lleva su bloque
    // mínimo: el fuelle no es relleno de tiempo, es parte del entrenamiento.
    expect(minutosDelBloque(45, 60)).toBe(BLOQUE_MINIMO)
  })

  it('nunca da un número negativo ni absurdo', () => {
    expect(minutosDeSesion([])).toBeGreaterThan(0)
    expect(minutosDeSesion(plan(0, true), 0)).toBeLessThan(180)
  })
})
