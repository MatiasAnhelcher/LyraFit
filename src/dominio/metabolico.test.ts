import { describe, expect, it } from 'vitest'
import { EJERCICIOS } from './biblioteca'
import {
  MINIMO_DE_RAFAGA,
  PISO_DE_RECUPERACION,
  RAFAGAS,
  TOPE_DE_RAFAGA,
  TOPE_SUAVE,
  bloqueDeFuelle,
  rafagaDelDescanso,
  rafagasDisponibles,
  segundosDeRafaga,
  type Densidad,
  type Equipo,
} from './metabolico'
import type { Patron } from './tipos'

/**
 * Que el fuelle no le cueste fuerza a nadie.
 *
 * Los dos defectos que esta función puede tener no se ven mirando la pantalla:
 * un descanso que quedó corto se siente como un mal día, y una ráfaga que carga
 * el patrón que viene se siente como haber perdido fuerza. Los dos terminan en
 * el mismo lugar —el motor bajando de eslabón a alguien que no perdió nada— y
 * los dos son desigualdades, así que se comprueban solos.
 */

const PATRONES: Patron[] = ['empuje', 'traccion', 'piernas', 'core']
const DENSIDADES: Densidad[] = ['suave', 'fuerte']

/** Las cuatro combinaciones de equipo posibles, incluida la más pobre. */
const EQUIPOS: Equipo[] = [
  {},
  { puedeSaltar: true },
  { tieneEscalon: true },
  { puedeSaltar: true, tieneEscalon: true },
]

/** Los descansos que de verdad existen en la biblioteca, no números inventados. */
const DESCANSOS_REALES = [...new Set(EJERCICIOS.map((e) => e.descansoSegundos))].sort(
  (a, b) => a - b,
)

describe('el piso de recuperación', () => {
  it('da esta tabla exacta contra los descansos de la biblioteca', () => {
    // Escrita a mano y no calculada: si mañana alguien toca las constantes, la
    // que tiene que fallar es esta línea y no una desigualdad que sigue siendo
    // cierta con otros números. Los descansos son los siete que existen de
    // verdad en `biblioteca.ts`, no una grilla inventada.
    expect(DESCANSOS_REALES).toEqual([45, 60, 75, 90, 120, 150, 180])

    const fuerte = DESCANSOS_REALES.map((d) => segundosDeRafaga(d, 'fuerte'))
    const suave = DESCANSOS_REALES.map((d) => segundosDeRafaga(d, 'suave'))

    expect(fuerte).toEqual([0, 0, 0, 30, 45, 45, 45])
    expect(suave).toEqual([0, 0, 0, 30, 30, 30, 30])
  })

  it('el descanso que queda nunca baja del piso por culpa de la ráfaga', () => {
    // Un descanso de 45 s queda en 45 s: no llega al piso, pero no lo bajó la
    // ráfaga —lo eligió el ejercicio—. Lo que se comprueba acá es que esta
    // función nunca EMPUJE un descanso por debajo del piso.
    for (const descanso of DESCANSOS_REALES) {
      for (const densidad of DENSIDADES) {
        const rafaga = segundosDeRafaga(descanso, densidad)
        if (rafaga === 0) continue
        expect(
          descanso - rafaga,
          `descanso de ${descanso}s con densidad ${densidad}: quedan ${descanso - rafaga}s`,
        ).toBeGreaterThanOrEqual(PISO_DE_RECUPERACION)
      }
    }
  })

  it('tampoco se toca para ninguna duración imaginable', () => {
    for (let descanso = 0; descanso <= 600; descanso++) {
      for (const densidad of DENSIDADES) {
        expect(descanso - segundosDeRafaga(descanso, densidad)).toBeGreaterThanOrEqual(
          Math.min(descanso, PISO_DE_RECUPERACION),
        )
      }
    }
  })

  it('los descansos cortos no tienen ráfaga', () => {
    // Menos de lo que hace falta para que sobre el mínimo: no entra nada.
    for (let descanso = 0; descanso < PISO_DE_RECUPERACION + MINIMO_DE_RAFAGA; descanso++) {
      expect(segundosDeRafaga(descanso, 'fuerte'), `${descanso}s`).toBe(0)
    }
  })

  it('una ráfaga, si existe, dura entre el mínimo y el tope', () => {
    for (let descanso = 0; descanso <= 600; descanso++) {
      for (const densidad of DENSIDADES) {
        const segundos = segundosDeRafaga(descanso, densidad)
        if (segundos === 0) continue
        expect(segundos).toBeGreaterThanOrEqual(MINIMO_DE_RAFAGA)
        expect(segundos).toBeLessThanOrEqual(
          densidad === 'suave' ? TOPE_SUAVE : TOPE_DE_RAFAGA,
        )
      }
    }
  })

  it('con la densidad apagada la sesión queda exactamente como estaba', () => {
    for (const descanso of DESCANSOS_REALES) {
      expect(segundosDeRafaga(descanso, 'apagada')).toBe(0)
    }
    expect(rafagasDisponibles({ puedeSaltar: true, tieneEscalon: true }, 'apagada')).toEqual([])
  })

  it('cuanto más largo el descanso, nunca menos ráfaga', () => {
    // La monotonía importa: si en algún punto un descanso más largo diera menos
    // relleno, habría un ejercicio avanzado con menos densidad que uno fácil.
    for (const densidad of DENSIDADES) {
      let anterior = 0
      for (let descanso = 0; descanso <= 600; descanso++) {
        const actual = segundosDeRafaga(descanso, densidad)
        expect(actual, `${descanso}s con ${densidad}`).toBeGreaterThanOrEqual(anterior)
        anterior = actual
      }
    }
  })
})

describe('la ráfaga no compite con lo que viene', () => {
  it('nunca carga el patrón de la serie siguiente', () => {
    for (const patron of PATRONES) {
      for (const equipo of EQUIPOS) {
        for (const densidad of DENSIDADES) {
          for (const descanso of DESCANSOS_REALES) {
            for (let indice = 0; indice < 12; indice++) {
              const elegida = rafagaDelDescanso({
                descansoSegundos: descanso,
                patronQueViene: patron,
                equipo,
                densidad,
                indice,
              })
              if (!elegida) continue
              expect(
                elegida.rafaga.carga,
                `${elegida.rafaga.id} antes de una serie de ${patron}`,
              ).not.toContain(patron)
            }
          }
        }
      }
    }
  })

  it('siempre queda al menos una candidata, con cualquier equipo', () => {
    // Si un patrón se quedara sin ráfagas, la función devolvería null en
    // silencio y el fuelle simplemente no existiría para quien entrena ese
    // patrón. Es el defecto que no se ve: no rompe nada, no hace nada.
    for (const patron of PATRONES) {
      for (const equipo of EQUIPOS) {
        for (const densidad of DENSIDADES) {
          const candidatas = rafagasDisponibles(equipo, densidad).filter(
            (r) => !r.carga.includes(patron),
          )
          expect(
            candidatas.length,
            `patrón ${patron}, densidad ${densidad}, equipo ${JSON.stringify(equipo)}`,
          ).toBeGreaterThan(0)
        }
      }
    }
  })

  it('rota: dos descansos seguidos no dan la misma ráfaga', () => {
    for (const patron of PATRONES) {
      const salen = [0, 1, 2].map(
        (indice) =>
          rafagaDelDescanso({
            descansoSegundos: 150,
            patronQueViene: patron,
            equipo: { puedeSaltar: true, tieneEscalon: true },
            densidad: 'fuerte',
            indice,
          })?.rafaga.id,
      )
      expect(salen[0], `${patron}: la primera y la segunda son iguales`).not.toBe(salen[1])
    }
  })
})

describe('el equipo se respeta', () => {
  it('sin poder saltar, ninguna ráfaga pide saltar', () => {
    for (const densidad of DENSIDADES) {
      for (const rafaga of rafagasDisponibles({ tieneEscalon: true }, densidad)) {
        expect(rafaga.requiere, rafaga.id).not.toBe('salto')
      }
    }
  })

  it('sin escalón, ninguna ráfaga pide escalón', () => {
    for (const densidad of DENSIDADES) {
      for (const rafaga of rafagasDisponibles({ puedeSaltar: true }, densidad)) {
        expect(rafaga.requiere, rafaga.id).not.toBe('escalon')
      }
    }
  })

  it('en suave no entra nada de intensidad 3', () => {
    for (const equipo of EQUIPOS) {
      for (const rafaga of rafagasDisponibles(equipo, 'suave')) {
        expect(rafaga.intensidad, rafaga.id).toBeLessThan(3)
      }
    }
  })
})

describe('la biblioteca de ráfagas', () => {
  it('no tiene ids repetidos', () => {
    expect(new Set(RAFAGAS.map((r) => r.id)).size).toBe(RAFAGAS.length)
  })

  it('cada una dice qué carga y cómo se hace', () => {
    for (const rafaga of RAFAGAS) {
      expect(rafaga.carga.length, `${rafaga.id} no carga nada`).toBeGreaterThan(0)
      expect(rafaga.gesto.length, `${rafaga.id}: el gesto es muy corto`).toBeGreaterThan(20)
      expect(rafaga.gesto.trim().endsWith('.'), `${rafaga.id}: el gesto no cierra`).toBe(true)
    }
  })

  it('ninguna carga tracción, y es a propósito', () => {
    // Está en el comentario de RAFAGAS: el agarre es justamente lo que limita
    // la serie de dominadas siguiente. Si alguien agrega una que traccione, que
    // sea una decisión y no un descuido.
    for (const rafaga of RAFAGAS) {
      expect(rafaga.carga, rafaga.id).not.toContain('traccion')
    }
  })
})

describe('el bloque de fuelle', () => {
  it('entra en los minutos que se le dan', () => {
    for (const minutos of [8, 10, 12, 15]) {
      const bloque = bloqueDeFuelle(minutos, { puedeSaltar: true, tieneEscalon: true }, 'fuerte')
      const total = bloque.reduce((suma, p) => suma + p.segundos + p.descansoSegundos, 0)
      expect(total, `${minutos} min dieron ${total}s`).toBeLessThanOrEqual(minutos * 60)
      expect(bloque.length).toBeGreaterThan(0)
    }
  })

  it('termina en trabajo, no en una pausa colgada', () => {
    const bloque = bloqueDeFuelle(12, { puedeSaltar: true, tieneEscalon: true }, 'fuerte')
    expect(bloque.at(-1)!.descansoSegundos).toBe(0)
  })

  it('arranca por lo más liviano', () => {
    const bloque = bloqueDeFuelle(12, { puedeSaltar: true, tieneEscalon: true }, 'fuerte')
    expect(bloque[0]!.rafaga.intensidad).toBe(1)
  })

  it('sin equipo y sin saltar igual hay bloque', () => {
    expect(bloqueDeFuelle(10, {}, 'fuerte').length).toBeGreaterThan(0)
  })

  it('apagado no hay bloque', () => {
    expect(bloqueDeFuelle(10, { puedeSaltar: true }, 'apagada')).toEqual([])
  })
})
