import { describe, expect, it } from 'vitest'
import { avanceInicial } from '@/dominio/progresion'
import { POR_ID, cadenaDe } from '@/dominio/biblioteca'
import type { Avance } from '@/dominio/tipos'
import { enCadena, enCadenaCon, objetivoCorto, techoCorto, textoDeLaBarra } from './enCadena'

function avance(patron: Avance['patron'], ejercicioId: string, cantidad: number, kg?: number): Avance {
  return {
    ...avanceInicial(cadenaDe(patron), POR_ID, 0),
    ejercicioId,
    objetivoActual: { series: 3, cantidad, ...(kg ? { kg } : {}) },
  }
}

describe('dónde está en la cadena', () => {
  it('da el eslabón desde cero, el largo real y el relleno de la ventana', () => {
    // Flexiones diamante es el séptimo de once, con ventana de 5 a 12.
    const e = enCadena(avance('empuje', 'flexion-diamante', 9))
    expect(e.indice).toBe(6)
    expect(e.total).toBe(11)
    expect(e.relleno).toBeCloseTo(4 / 7)
    expect(e.enTecho).toBe(false)
  })

  it('el piso de la ventana es un segmento vacío y el techo uno lleno', () => {
    expect(enCadena(avance('empuje', 'flexion-diamante', 5)).relleno).toBe(0)
    const techo = enCadena(avance('empuje', 'flexion-diamante', 12))
    expect(techo.relleno).toBe(1)
    expect(techo.enTecho).toBe(true)
  })

  it('con segundos, igual', () => {
    // Plancha: segundo eslabón de core, ventana de 15 a 30 segundos.
    const e = enCadena(avance('core', 'plancha', 25))
    expect(e.indice).toBe(1)
    expect(e.relleno).toBeCloseTo(10 / 15)
  })

  it('la huella sale de un ejercicio y un objetivo sueltos', () => {
    const e = enCadenaCon('empuje', 'flexion-completa', { series: 3, cantidad: 12 })
    expect(e.indice).toBe(5)
    expect(e.relleno).toBe(1)
  })
})

describe('lo que la barra dice', () => {
  it('con repeticiones', () => {
    const e = enCadena(avance('empuje', 'flexion-diamante', 9))
    expect(textoDeLaBarra(e)).toBe('Empuje: eslabón 7 de 11, Flexiones diamante, 3 × 9 de un techo de 12')
    expect(objetivoCorto(e)).toBe('3 × 9')
    expect(techoCorto(e)).toBe('12')
  })

  it('con segundos, la palabra entera para el lector y la "s" para la vista', () => {
    const e = enCadena(avance('core', 'plancha', 25))
    expect(textoDeLaBarra(e)).toBe('Core: eslabón 2 de 9, Plancha, 3 × 25 segundos de un techo de 30 segundos')
    expect(objetivoCorto(e)).toBe('3 × 25 s')
    expect(techoCorto(e)).toBe('30 s')
  })

  it('en el techo lo dice, y con discos también', () => {
    const e = enCadena(avance('empuje', 'flexion-diamante', 12))
    expect(textoDeLaBarra(e)).toBe('Empuje: eslabón 7 de 11, Flexiones diamante, 3 × 12, en el techo')
    const conKg = enCadena(avance('traccion', 'dominada-un-brazo-asistida', 4, 10))
    expect(objetivoCorto(conKg)).toBe('3 × 4 con 10 kg')
    expect(textoDeLaBarra(conKg)).toContain('3 × 4 con 10 kilos')
  })
})
