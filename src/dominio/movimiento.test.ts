import { describe, expect, it } from 'vitest'
import { movimientoAlTocar, movimientoGuardado, rigeReducido } from './movimiento'

/**
 * Lo que rige, lo que se guarda y lo que escribe el interruptor.
 *
 * Lo que importa que no se rompa: que nadie que nunca tocó el interruptor
 * deje de seguir a su teléfono, y que tocarlo cambie siempre lo que se ve.
 */

describe('lo guardado', () => {
  it('sin el campo es seguir al teléfono: las bases y las copias de antes', () => {
    expect(movimientoGuardado({})).toBe('sistema')
    expect(movimientoGuardado({ movimiento: undefined })).toBe('sistema')
  })

  it('los tres valores pasan tal cual, y lo que no se entiende es seguir al teléfono', () => {
    expect(movimientoGuardado({ movimiento: 'reducido' })).toBe('reducido')
    expect(movimientoGuardado({ movimiento: 'completo' })).toBe('completo')
    expect(movimientoGuardado({ movimiento: 'sistema' })).toBe('sistema')
    expect(movimientoGuardado({ movimiento: true })).toBe('sistema')
    expect(movimientoGuardado({ movimiento: 'quieto' })).toBe('sistema')
  })
})

describe('lo que rige', () => {
  it('siguiendo al teléfono, rige lo que pide el teléfono', () => {
    expect(rigeReducido('sistema', true)).toBe(true)
    expect(rigeReducido('sistema', false)).toBe(false)
  })

  it('lo elegido en Ajustes manda, pida lo que pida el teléfono', () => {
    expect(rigeReducido('reducido', false)).toBe(true)
    expect(rigeReducido('completo', true)).toBe(false)
  })
})

describe('el interruptor', () => {
  it('escribe el valor explícito contrario al que rige, nunca seguir al teléfono', () => {
    expect(movimientoAlTocar(true)).toBe('completo')
    expect(movimientoAlTocar(false)).toBe('reducido')
  })

  it('tocarlo cambia siempre lo que se ve, también si el teléfono pide lo contrario', () => {
    for (const telefono of [true, false]) {
      for (const guardado of ['sistema', 'reducido', 'completo'] as const) {
        const antes = rigeReducido(guardado, telefono)
        expect(rigeReducido(movimientoAlTocar(antes), telefono)).toBe(!antes)
      }
    }
  })
})
