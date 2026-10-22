import { describe, expect, it } from 'vitest'
import {
  RECUPERACION_CON_FUENTE,
  horaDicha,
  lineaCambiado,
  lineaLiviana,
  lineaSinCadenas,
  lineaYaLeida,
} from './lineas'
import { loProhibido } from './palabras'
import type { Patron } from './tipos'

/** Un instante del 21/10/2026 a esta hora, en la hora local de quien corre el test. */
const a = (h: number, m: number) => new Date(2026, 9, 21, h, m).getTime()

describe('la hora, como se dice', () => {
  it('en 24 h y sin cero adelante de la hora', () => {
    expect(horaDicha(a(9, 10))).toBe('9:10')
    expect(horaDicha(a(19, 5))).toBe('19:05')
    expect(horaDicha(a(0, 0))).toBe('0:00')
  })
})

describe('ya se leyó hoy', () => {
  it('una cadena', () => {
    expect(lineaYaLeida([{ patron: 'empuje', hora: a(9, 10) }])).toBe(
      'Empuje ya se leyó hoy a las 9:10: esta sesión sumó volumen.',
    )
  })

  it('varias a la misma hora, juntas y en plural', () => {
    expect(
      lineaYaLeida([
        { patron: 'traccion', hora: a(9, 10) },
        { patron: 'empuje', hora: a(9, 10) },
        { patron: 'piernas', hora: a(9, 10) },
        { patron: 'core', hora: a(9, 10) },
      ]),
    ).toBe('Tracción, empuje, piernas y core ya se leyeron hoy a las 9:10: esta sesión sumó volumen.')
  })

  it('a distintas horas, cada una con la suya y en el orden en que se leyeron', () => {
    expect(
      lineaYaLeida([
        { patron: 'bisagra', hora: a(13, 30) },
        { patron: 'empuje', hora: a(9, 10) },
      ]),
    ).toBe('Empuje se leyó hoy a las 9:10 y bisagra a las 13:30: esta sesión sumó volumen.')
  })

  it('con dos cadenas en un mismo tramo, la coma separa los tramos', () => {
    expect(
      lineaYaLeida([
        { patron: 'empuje', hora: a(9, 10) },
        { patron: 'bisagra', hora: a(13, 30) },
        { patron: 'core', hora: a(13, 30) },
      ]),
    ).toBe('Empuje se leyó hoy a las 9:10, y bisagra y core a las 13:30: esta sesión sumó volumen.')
  })

  it('la misma cadena dos veces se dice una sola', () => {
    expect(
      lineaYaLeida([
        { patron: 'empuje', hora: a(9, 10) },
        { patron: 'empuje', hora: a(13, 30) },
      ]),
    ).toBe('Empuje ya se leyó hoy a las 9:10: esta sesión sumó volumen.')
  })

  it('a la una, en singular', () => {
    expect(lineaYaLeida([{ patron: 'empuje', hora: a(1, 20) }])).toBe(
      'Empuje ya se leyó hoy a la 1:20: esta sesión sumó volumen.',
    )
    expect(
      lineaYaLeida([
        { patron: 'empuje', hora: a(0, 40) },
        { patron: 'core', hora: a(1, 5) },
      ]),
    ).toBe('Empuje se leyó hoy a las 0:40 y core a la 1:05: esta sesión sumó volumen.')
  })

  it('una sesión de otro día no dice "hoy"', () => {
    // Arrancó a las 23:40 y cierra a las 00:05: es del día de antes.
    expect(lineaYaLeida([{ patron: 'empuje', hora: a(9, 10) }], { esHoy: false })).toBe(
      'Empuje ya se había leído ese día a las 9:10: esta sesión sumó volumen.',
    )
    expect(
      lineaYaLeida(
        [
          { patron: 'empuje', hora: a(9, 10) },
          { patron: 'core', hora: a(9, 10) },
          { patron: 'bisagra', hora: a(13, 30) },
        ],
        { esHoy: false },
      ),
    ).toBe(
      'Empuje y core se habían leído ese día a las 9:10, y bisagra a las 13:30: esta sesión sumó volumen.',
    )
  })

  it('sin cadenas leídas no hay línea', () => {
    expect(lineaYaLeida([])).toBeNull()
  })

  it('las cinco cadenas a cinco horas distintas entran en 140', () => {
    const patrones: Patron[] = ['traccion', 'empuje', 'piernas', 'bisagra', 'core']
    const linea = lineaYaLeida(patrones.map((patron, i) => ({ patron, hora: a(10 + 2 * i, 20) })))
    expect(linea).not.toBeNull()
    expect(linea!.length).toBeLessThanOrEqual(140)
  })
})

describe('sin pasos que sigan tu nivel', () => {
  it('lo dice solo cuando es cierto', () => {
    expect(lineaSinCadenas({ tipo: 'fuelle', pasosDeCadena: 0 })).toBe(
      'Esta sesión no tenía pasos que sigan tu nivel: tus cadenas quedan como estaban.',
    )
  })

  it('con pasos de cadena sin hacer no hubo nada que leer, y no dice nada', () => {
    expect(lineaSinCadenas({ tipo: 'plan', pasosDeCadena: 4 })).toBeNull()
  })

  it('el reloj no habla del motor', () => {
    expect(lineaSinCadenas({ tipo: 'reloj', pasosDeCadena: 0 })).toBeNull()
  })
})

describe('un paso de cadena cambiado', () => {
  it('una cadena y varias', () => {
    expect(lineaCambiado(['empuje'])).toBe('Empuje queda como estaba: hoy hiciste otro ejercicio.')
    expect(lineaCambiado(['empuje', 'traccion'])).toBe(
      'Empuje y tracción quedan como estaban: hoy hiciste otros ejercicios.',
    )
    expect(lineaCambiado([])).toBeNull()
  })
})

describe('la versión liviana', () => {
  it('se dice solo cuando lo es', () => {
    expect(lineaLiviana(true)).toBe('La versión liviana suma volumen y no mueve tus cadenas.')
    expect(lineaLiviana(false)).toBeNull()
  })
})

describe('las reglas de la voz, en todas', () => {
  const todas = [
    lineaYaLeida([{ patron: 'empuje', hora: a(9, 10) }]),
    lineaYaLeida([
      { patron: 'traccion', hora: a(9, 10) },
      { patron: 'bisagra', hora: a(13, 30) },
      { patron: 'core', hora: a(19, 5) },
    ]),
    lineaYaLeida(
      [
        { patron: 'traccion', hora: a(1, 10) },
        { patron: 'bisagra', hora: a(13, 30) },
        { patron: 'core', hora: a(19, 5) },
      ],
      { esHoy: false },
    ),
    lineaSinCadenas({ tipo: 'fuelle', pasosDeCadena: 0 }),
    lineaCambiado(['empuje', 'traccion', 'piernas']),
    lineaLiviana(true),
  ].filter((l): l is string => l !== null)

  it('nada de lo prohibido, 140 como mucho, sin exclamación', () => {
    for (const linea of todas) {
      expect(loProhibido(linea), linea).toBeNull()
      expect(linea.length, linea).toBeLessThanOrEqual(140)
      expect(linea, linea).not.toMatch(/[!¡]/)
    }
  })

  it('con la llave apagada, ninguna afirma nada del cuerpo', () => {
    expect(RECUPERACION_CON_FUENTE).toBe(false)
    const delCuerpo = /recuper|descans|fatiga|lesi|músculo|crecimiento|esperable/i
    for (const linea of todas) expect(linea, linea).not.toMatch(delCuerpo)
  })
})
