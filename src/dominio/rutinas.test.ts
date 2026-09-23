import { describe, expect, it } from 'vitest'
import {
  CICLO,
  DIAS,
  RUTINAS,
  RUTINA_POR_DEFECTO,
  RUTINA_POR_ID,
  claseDeDia,
  diaDeLaSemana,
  diasDe,
  diasDeFuerza,
  patronDelBloque,
  proximoDia,
  revisarSemana,
  semanaActiva,
  semanaCompleta,
  semanaDe,
  semanaValida,
  siguienteClase,
  tocaEntrenar,
} from './rutinas'
import type { ClaseDeDia } from './rutinas'
import type { Semana } from './tipos'

/**
 * Que las rutinas cierren.
 *
 * Eran cuatro objetos escritos a mano y por eso parecían no necesitar test, que
 * es exactamente el argumento con el que entra un día de fuelle declarado en un
 * día que la rutina no entrena: la app anunciaría "hoy fuelle" un sábado que no
 * existe, y no rompería nada — simplemente estaría mal.
 *
 * Ahora la semana la escribe una persona, así que la mitad de estos tests
 * dejaron de ser sobre constantes y pasaron a ser sobre `revisarSemana`, que es
 * la que corre en vivo mientras alguien arma su semana en Ajustes.
 */

/** Un lunes cualquiera, para poder construir los siete días sin ambigüedad. */
const LUNES = new Date(2026, 8, 14)

function delDia(dia: number): Date {
  const fecha = new Date(LUNES)
  fecha.setDate(fecha.getDate() + (dia - 1))
  return fecha
}

/** Arma una semana a partir de la lista de días de cada clase. */
function semana(de: Partial<Record<ClaseDeDia, number[]>>): Semana {
  const s: Semana = {}
  for (const dia of DIAS) s[dia] = 'descanso'
  for (const clase of ['fuerza', 'fuelle', 'ambos'] as const) {
    for (const dia of de[clase] ?? []) s[dia] = clase
  }
  return s
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

      it('no declara un día de fuelle ni uno denso fuera de sus días', () => {
        for (const dia of rutina.diasDeFuelle ?? []) {
          expect(rutina.dias, `el día ${dia} es de fuelle pero no se entrena`).toContain(dia)
        }
        for (const dia of rutina.diasDensos ?? []) {
          expect(rutina.dias, `el día ${dia} es denso pero no se entrena`).toContain(dia)
        }
      })

      it('ningún día es de fuelle y denso a la vez', () => {
        // Denso es fuerza CON fuelle; fuelle es fuelle SIN fuerza. Un día en las
        // dos listas es una contradicción que `semanaDe` resolvería en silencio
        // a favor de la primera que consulta.
        for (const dia of rutina.diasDensos ?? []) {
          expect(rutina.diasDeFuelle ?? [], `el día ${dia}`).not.toContain(dia)
        }
      })

      it('su semana declara los siete días, y solo clases conocidas', () => {
        const s = semanaDe(rutina)
        for (const dia of DIAS) {
          expect(CICLO, `día ${dia}`).toContain(s[dia])
        }
      })

      it('su semana deja al menos un día de fuerza y se puede guardar', () => {
        // Una rutina donde TODO es fuelle no haría progresar ninguna cadena, y
        // el motor no tendría de dónde leer nada. Es una rutina de
        // acondicionamiento disfrazada de rutina de fuerza.
        expect(diasDeFuerza(semanaDe(rutina)).length, 'ningún día de fuerza').toBeGreaterThan(0)
        expect(semanaValida(semanaDe(rutina), rutina)).toBe(true)
      })

      it('cada día es exactamente la clase que la rutina declaró', () => {
        const s = semanaDe(rutina)
        for (const dia of DIAS) {
          const fecha = delDia(dia)
          const clase = claseDeDia(s, fecha)
          if (!rutina.dias.includes(dia)) {
            expect(clase, `día ${dia}`).toBe('descanso')
          } else if (rutina.diasDeFuelle?.includes(dia)) {
            expect(clase, `día ${dia}`).toBe('fuelle')
          } else if (rutina.diasDensos?.includes(dia)) {
            expect(clase, `día ${dia}`).toBe('ambos')
          } else {
            expect(clase, `día ${dia}`).toBe('fuerza')
          }
          expect(tocaEntrenar(s, fecha), `día ${dia}`).toBe(rutina.dias.includes(dia))
        }
      })

      it('cada patrón que alterna aparece al menos una vez por semana', () => {
        // Este es el test que faltaba, y el que habría cazado el defecto: en
        // "Densa, cinco días" la bisagra NUNCA salía. `patronDelBloque` contaba
        // sobre todos los días de entrenamiento, y como martes y jueves eran de
        // fuelle, los tres días de fuerza caían en los índices 0, 2 y 4 —todos
        // pares— así que siempre daba sentadilla. Ocho eslabones de cadena,
        // hasta el curl nórdico, inalcanzables.
        const s = semanaDe(rutina)
        for (const bloque of rutina.bloques) {
          if (!bloque.alterna) continue
          const salidas = new Set(
            diasDeFuerza(s).map((dia) => patronDelBloque(bloque, s, delDia(dia))),
          )
          expect(salidas, `${rutina.id} · ${bloque.patron}/${bloque.alterna}`).toContain(
            bloque.patron,
          )
          expect(salidas, `${rutina.id} · ${bloque.patron}/${bloque.alterna}`).toContain(
            bloque.alterna,
          )
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

describe('la semana propia', () => {
  const cuerpoCompleto = RUTINA_POR_ID.get('cuerpo-completo')!

  it('sin semana guardada, manda la del preset', () => {
    expect(semanaActiva({ rutinaActivaId: 'cuerpo-completo' })).toEqual(semanaDe(cuerpoCompleto))
  })

  it('con semana guardada, manda la guardada', () => {
    const mia = semana({ fuerza: [6], fuelle: [7] })
    expect(semanaActiva({ rutinaActivaId: 'cuerpo-completo', semana: mia })).toEqual(mia)
  })

  it('una rutina desconocida cae en la de por defecto en vez de romper', () => {
    expect(semanaActiva({ rutinaActivaId: 'no-existe' })).toEqual(semanaDe(cuerpoCompleto))
  })

  it('una semana a medio escribir se completa con descanso', () => {
    const parcial: Semana = { 1: 'fuerza' }
    const llena = semanaCompleta(parcial, semanaDe(cuerpoCompleto))
    expect(llena[1]).toBe('fuerza')
    for (const dia of [2, 3, 4, 5, 6, 7]) expect(llena[dia], `día ${dia}`).toBe('descanso')
  })

  it('el ciclo de la interfaz recorre los cuatro estados y vuelve', () => {
    let clase: ClaseDeDia = 'descanso'
    const vistos: ClaseDeDia[] = []
    for (let i = 0; i < CICLO.length; i++) {
      vistos.push(clase)
      clase = siguienteClase(clase)
    }
    expect(new Set(vistos).size).toBe(4)
    expect(clase).toBe('descanso')
  })

  it('los días densos cuentan como fuerza y como fuelle', () => {
    const s = semana({ ambos: [1] })
    expect(diasDeFuerza(s)).toEqual([1])
    expect(diasDe(s)).toEqual([1])
    expect(claseDeDia(s, delDia(1))).toBe('ambos')
  })

  it('un día de fuelle no consume un turno de la alternancia', () => {
    // El defecto, contado como test: lunes fuerza, martes fuelle, miércoles
    // fuerza. Si el martes contara, el miércoles caería en el índice 2 y daría
    // el mismo patrón que el lunes.
    const bloque = { patron: 'piernas', alterna: 'bisagra' } as const
    const s = semana({ fuerza: [1, 3], fuelle: [2] })
    expect(patronDelBloque(bloque, s, delDia(1))).toBe('piernas')
    expect(patronDelBloque(bloque, s, delDia(3))).toBe('bisagra')
  })

  it('en un día que no se entrena, un bloque que alterna no inventa nada', () => {
    const bloque = { patron: 'piernas', alterna: 'bisagra' } as const
    const s = semana({ fuerza: [1] })
    expect(patronDelBloque(bloque, s, delDia(6))).toBe('piernas')
  })

  it('el próximo día salta los descansos y da la vuelta a la semana', () => {
    const s = semana({ fuerza: [1, 5] })
    expect(diaDeLaSemana(proximoDia(s, delDia(1))!)).toBe(5)
    expect(diaDeLaSemana(proximoDia(s, delDia(5))!)).toBe(1)
  })

  it('sin ningún día, no hay próximo día en vez de buscar para siempre', () => {
    expect(proximoDia(semana({}), LUNES)).toBeNull()
  })
})

describe('lo que la app tiene para decir de una semana', () => {
  const cuerpoCompleto = RUTINA_POR_ID.get('cuerpo-completo')!
  const clavesDe = (s: Semana) => revisarSemana(s, cuerpoCompleto).map((a) => a.clave)

  it('una semana vacía se impide, y no se dice nada más', () => {
    const avisos = revisarSemana(semana({}), cuerpoCompleto)
    expect(avisos).toHaveLength(1)
    expect(avisos[0]!.clave).toBe('vacia')
    expect(avisos[0]!.gravedad).toBe('impide')
    expect(semanaValida(semana({}), cuerpoCompleto)).toBe(false)
  })

  it('una semana toda de fuelle se impide: ninguna cadena avanzaría', () => {
    const s = semana({ fuelle: [1, 3, 5] })
    expect(clavesDe(s)).toContain('sin-fuerza')
    expect(semanaValida(s, cuerpoCompleto)).toBe(false)
  })

  it('seis días de fuerza se avisan, pero se pueden guardar', () => {
    // Es su cuerpo y su decisión. Se impide solo lo que dejaría a la app sin
    // poder hacer su trabajo, y esto no lo deja: lo hace peor, y se dice.
    const s = semana({ fuerza: [1, 2, 3, 4, 5, 6] })
    expect(clavesDe(s)).toContain('alternancia-apretada')
    expect(semanaValida(s, cuerpoCompleto)).toBe(true)
  })

  it('cinco de fuerza sin fuelle se avisan', () => {
    expect(clavesDe(semana({ fuerza: [1, 2, 3, 4, 5] }))).toContain('sin-recuperacion')
  })

  it('un día denso cuenta como recuperación y no dispara ese aviso', () => {
    // El fuelle adentro de la sesión no es un día liviano, así que denso no
    // alcanza: cinco días densos siguen siendo cinco días de fuerza.
    expect(clavesDe(semana({ ambos: [1, 2, 3, 4, 5] }))).toContain('sin-recuperacion')
    expect(clavesDe(semana({ fuerza: [1, 3, 5], fuelle: [2, 4] }))).not.toContain(
      'sin-recuperacion',
    )
  })

  it('tres días de fuerza seguidos se avisan; dos no', () => {
    expect(clavesDe(semana({ fuerza: [1, 2, 3] }))).toContain('seguidos')
    expect(clavesDe(semana({ fuerza: [1, 2, 5] }))).not.toContain('seguidos')
  })

  it('la semana no da la vuelta al contar seguidos', () => {
    // Domingo y lunes son consecutivos en la vida pero no en esta cuenta, y eso
    // es una decisión: la grilla se lee de lunes a domingo y un aviso que
    // saliera por los extremos no se entendería mirando la pantalla.
    expect(clavesDe(semana({ fuerza: [7, 1] }))).not.toContain('seguidos')
  })

  it('las cuatro rutinas de fábrica no disparan ningún aviso', () => {
    for (const rutina of RUTINAS) {
      expect(revisarSemana(semanaDe(rutina), rutina), rutina.id).toEqual([])
    }
  })

  it('ningún aviso está vacío ni es más largo de lo que se lee de reojo', () => {
    const s = semana({ fuerza: [1, 2, 3, 4, 5, 6] })
    for (const aviso of revisarSemana(s, cuerpoCompleto)) {
      expect(aviso.texto.length, aviso.clave).toBeGreaterThan(20)
      expect(aviso.texto.length, aviso.clave).toBeLessThan(240)
    }
  })
})
