import { describe, expect, it } from 'vitest'
import { debePegarse } from './dock'

const nada = { esDiaDeEntrenar: false, entrenoHoy: false, haySinCerrar: false }

describe('debePegarse', () => {
  it('se pega el día de entrenar, antes de entrenar', () => {
    expect(debePegarse({ ...nada, esDiaDeEntrenar: true })).toBe(true)
  })

  it('no se pega un día de descanso: Empezar queda quieto en su lugar', () => {
    expect(debePegarse(nada)).toBe(false)
  })

  it('no se pega con la sesión de hoy ya hecha', () => {
    expect(debePegarse({ ...nada, esDiaDeEntrenar: true, entrenoHoy: true })).toBe(false)
  })

  it('se pega con una sesión sin cerrar, aunque hoy ya hayas entrenado o toque descansar', () => {
    expect(debePegarse({ ...nada, entrenoHoy: true, haySinCerrar: true })).toBe(true)
    expect(debePegarse({ ...nada, haySinCerrar: true })).toBe(true)
  })
})
