import { describe, expect, it } from 'vitest'
import {
  CELDA_MINIMA_ESFUERZO,
  celdaMasAngosta,
  columnasDeLaCelda,
  dosFilas,
  entra,
  repartir,
} from './regleta'

/** Una regleta a todo el ancho de un 320: 320 menos 16 de cada costado. */
const A320 = 288
/** Lo mismo en el esfuerzo, donde el rem es de 17 y el margen también. */
const A320_ESFUERZO = 286

/** Anchos medidos en Chromium con Inter 600 a 13 px y Sora 600 a 16 px. */
const MODERADA = 63.8
const DOLORIDOS = 60.4 // la palabra más ancha de "Muy doloridos"
const CINCO_SEIS = 30

describe('repartir', () => {
  it('pone en una fila las cinco horas de sueño: cada celda da 52,8 a 320', () => {
    expect(repartir({ opciones: 5, ancho: A320, palabraMasAncha: CINCO_SEIS })).toMatchObject({
      filas: 1,
      arriba: 5,
    })
  })

  it('parte en dos filas parejas lo que no da 48 por celda: 3 + 3, 4 + 3 y 4 + 4', () => {
    expect(repartir({ opciones: 6, ancho: A320, palabraMasAncha: 20 })).toMatchObject({ filas: 2, arriba: 3, abajo: 3 })
    expect(repartir({ opciones: 7, ancho: A320, palabraMasAncha: 20 })).toMatchObject({ filas: 2, arriba: 4, abajo: 3 })
    expect(repartir({ opciones: 8, ancho: A320, palabraMasAncha: 20 })).toMatchObject({ filas: 2, arriba: 4, abajo: 4 })
  })

  it('parte en 3 + 2 cinco rótulos de texto aunque las celdas den 48: "Moderada" no entra entera', () => {
    expect(repartir({ opciones: 5, ancho: A320, palabraMasAncha: MODERADA })).toMatchObject({
      filas: 2,
      arriba: 3,
      abajo: 2,
    })
    expect(repartir({ opciones: 5, ancho: A320, palabraMasAncha: DOLORIDOS }).filas).toBe(2)
  })

  it('en el esfuerzo pide 56 por celda: cinco opciones van en dos filas aunque las palabras entren', () => {
    expect(
      repartir({ opciones: 5, ancho: A320_ESFUERZO, palabraMasAncha: 20, celdaMinima: CELDA_MINIMA_ESFUERZO }).filas,
    ).toBe(2)
  })

  it('deja en una fila las de tres palabras cortas y las de sí o no', () => {
    expect(repartir({ opciones: 3, ancho: A320, palabraMasAncha: 32 }).filas).toBe(1)
    expect(repartir({ opciones: 2, ancho: A320, palabraMasAncha: 20 }).filas).toBe(1)
  })

  it('decide igual en cualquier teléfono, porque se le pasa el ancho que tendría en un 320', () => {
    const a360 = repartir({ opciones: 6, ancho: A320, palabraMasAncha: 20 })
    // A 360 las seis darían 50 por celda, pero la regla se toma a 320.
    expect(celdaMasAngosta({ filas: 1, arriba: 6, abajo: 0, columnas: 6 }, 328)).toBeGreaterThan(48)
    expect(a360.filas).toBe(2)
  })
})

describe('la grilla de dos filas', () => {
  it('reparte 12 columnas: 4 + 4 + 4 arriba y 6 + 6 abajo en el 3 + 2', () => {
    const reparto = dosFilas(5)
    expect(reparto.columnas).toBe(12)
    expect([0, 1, 2, 3, 4].map((i) => columnasDeLaCelda(reparto, i))).toEqual([4, 4, 4, 6, 6])
  })

  it('da las celdas de la especificación a 360: 104 arriba en el 3 + 2', () => {
    // (328 − 8 − 11 × 4) / 12 = 23 por columna; cuatro columnas y tres huecos.
    expect(celdaMasAngosta(dosFilas(5), 328)).toBeCloseTo(104, 5)
  })

  it('pasa al múltiplo común cuando 12 no se divide parejo', () => {
    const nueve = dosFilas(9)
    expect(nueve).toMatchObject({ arriba: 5, abajo: 4, columnas: 20 })
    expect(columnasDeLaCelda(nueve, 0)).toBe(4)
    expect(columnasDeLaCelda(nueve, 8)).toBe(5)
  })
})

describe('entra', () => {
  it('acepta "Con poca energía" partida en dos renglones: "energía" entra entera', () => {
    expect(entra(dosFilas(5), A320, 49.6)).toBe(true)
  })

  it('manda a una columna la letra al 125 % en un 320: "Moderada" ya no entra ni arriba', () => {
    expect(entra(dosFilas(5), A320, MODERADA * 1.25)).toBe(false)
  })
})
