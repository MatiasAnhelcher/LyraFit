import { describe, expect, it } from 'vitest'
import {
  RUTINAS,
  RUTINA_POR_DEFECTO,
  RUTINA_POR_ID,
  claseDeDia,
  diaDeLaSemana,
  tocaEntrenar,
} from './rutinas'

/**
 * Que las rutinas cierren.
 *
 * Son cuatro objetos escritos a mano y por eso parecen no necesitar test, que
 * es exactamente el argumento con el que entra un día de fuelle declarado en un
 * día que la rutina no entrena: la app anunciaría "hoy fuelle" un sábado que no
 * existe, y no rompería nada — simplemente estaría mal.
 */

/** Un lunes cualquiera, para poder construir los siete días sin ambigüedad. */
const LUNES = new Date(2026, 8, 14)

function delDia(dia: number): Date {
  const fecha = new Date(LUNES)
  fecha.setDate(fecha.getDate() + (dia - 1))
  return fecha
}

describe('las rutinas', () => {
  it('el lunes de referencia es de verdad un lunes', () => {
    // Todo lo de abajo cuenta días a partir de acá. Si esta fecha dejara de ser
    // lunes, los tests seguirían pasando por casualidad o fallarían por un
    // motivo que no tiene nada que ver con las rutinas.
    expect(diaDeLaSemana(LUNES)).toBe(1)
  })

  it('la rutina por defecto existe', () => {
    expect(RUTINA_POR_ID.get(RUTINA_POR_DEFECTO)).toBeDefined()
  })

  for (const rutina of RUTINAS) {
    describe(rutina.nombre, () => {
      it('entrena entre uno y siete días, sin repetir', () => {
        expect(rutina.dias.length).toBeGreaterThan(0)
        expect(new Set(rutina.dias).size).toBe(rutina.dias.length)
        for (const dia of rutina.dias) {
          expect(dia).toBeGreaterThanOrEqual(1)
          expect(dia).toBeLessThanOrEqual(7)
        }
      })

      it('tiene al menos un bloque', () => {
        expect(rutina.bloques.length).toBeGreaterThan(0)
      })

      it('no declara un día de fuelle fuera de sus días', () => {
        for (const dia of rutina.diasDeFuelle ?? []) {
          expect(rutina.dias, `el día ${dia} es de fuelle pero no se entrena`).toContain(dia)
        }
      })

      it('deja al menos un día de fuerza', () => {
        // Una rutina donde TODO es fuelle no haría progresar ninguna cadena, y
        // el motor no tendría de dónde leer nada. Es una rutina de
        // acondicionamiento disfrazada de rutina de fuerza.
        const fuerza = rutina.dias.filter((d) => !rutina.diasDeFuelle?.includes(d))
        expect(fuerza.length, 'todos los días son de fuelle').toBeGreaterThan(0)
      })

      it('cada día es exactamente una de las tres clases', () => {
        for (let dia = 1; dia <= 7; dia++) {
          const fecha = delDia(dia)
          const clase = claseDeDia(rutina, fecha)
          if (!tocaEntrenar(rutina, fecha)) {
            expect(clase, `día ${dia}`).toBe('descanso')
          } else {
            expect(clase, `día ${dia}`).toBe(
              rutina.diasDeFuelle?.includes(dia) ? 'fuelle' : 'fuerza',
            )
          }
        }
      })
    })
  }

  it('hay una rutina de cinco días, y tiene días de fuelle', () => {
    // Cinco días de las mismas cuatro cadenas al máximo no es voluntad: es no
    // recuperar, y el motor —que es reactivo— lo leería como pérdida de
    // capacidad y bajaría de eslabón. Si alguna vez aparece una rutina de cinco
    // días sin días de fuelle, es este test el que tiene que discutirlo.
    const decinco = RUTINAS.filter((r) => r.dias.length >= 5)
    expect(decinco.length).toBeGreaterThan(0)
    for (const rutina of decinco) {
      expect(rutina.diasDeFuelle?.length ?? 0, `${rutina.id}`).toBeGreaterThan(0)
    }
  })
})
