import { describe, expect, it } from 'vitest'
import type { PasoDeFuelle } from '@/dominio/metabolico'
import { tramoDelFuelle } from './tramoDelFuelle'

const paso = (nombre: string, descansoSegundos: number): PasoDeFuelle =>
  ({ rafaga: { id: nombre, nombre, gesto: `gesto de ${nombre}` }, segundos: 40, descansoSegundos }) as PasoDeFuelle

const pasos = [paso('Marcha alta', 20), paso('Boxeo de sombra', 20), paso('Escalador', 0)]

describe('tramoDelFuelle', () => {
  it('en AHORA cuenta la ráfaga en curso y la nombra', () => {
    expect(tramoDelFuelle(pasos, 0, false)).toMatchObject({ rotulo: 'EL FUELLE · QUEDAN 3', rafaga: { nombre: 'Marcha alta' } })
    expect(tramoDelFuelle(pasos, 1, false)).toMatchObject({ rotulo: 'EL FUELLE · QUEDAN 2', rafaga: { nombre: 'Boxeo de sombra' } })
    expect(tramoDelFuelle(pasos, 2, false)).toMatchObject({ rotulo: 'EL FUELLE · LA ÚLTIMA', rafaga: { nombre: 'Escalador' } })
  })

  it('en AFLOJÁ la recién hecha ya no cuenta, y se nombra la que viene', () => {
    expect(tramoDelFuelle(pasos, 0, true)).toMatchObject({ rotulo: 'EL FUELLE · QUEDAN 2', rafaga: { nombre: 'Boxeo de sombra' } })
    expect(tramoDelFuelle(pasos, 1, true)).toMatchObject({ rotulo: 'EL FUELLE · LA ÚLTIMA', rafaga: { nombre: 'Escalador' } })
  })

  it('la pausa y la ráfaga que la sigue dicen lo mismo: nada cambia al volver a AHORA', () => {
    for (let i = 0; i < pasos.length - 1; i++) {
      expect(tramoDelFuelle(pasos, i, true)).toEqual(tramoDelFuelle(pasos, i + 1, false))
    }
  })

  it('pasado el bloque no hay ráfaga que nombrar', () => {
    expect(tramoDelFuelle(pasos, 3, false).rafaga).toBeUndefined()
  })
})
