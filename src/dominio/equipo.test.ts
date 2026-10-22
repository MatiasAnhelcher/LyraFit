import { describe, expect, it } from 'vitest'
import { CADENAS, EJERCICIOS, POR_ID } from './biblioteca'
import { DADOS_POR_TENIDOS, EQUIPOS, alcanza, equipoDe } from './equipo'
import { NECESITAN_BARRA, NECESITAN_BARRA_CARGABLE } from './musculos'
import type { Ejercicio, Equipo } from './tipos'

/**
 * El equipo decide qué se le propone a cada persona, así que un error acá no
 * se ve como un error: se ve como un mix que pide una barra a quien no tiene
 * dónde colgarse, o como un catálogo que esconde lo que sí puede hacer.
 */

const ficha = (id: string): Ejercicio => {
  const ejercicio = POR_ID.get(id)
  if (!ejercicio) throw new Error(`No existe ${id}`)
  return ejercicio
}

describe('lo dado por tenido', () => {
  it('son los siete de §6.5: la casa y la mesa, sin preguntar', () => {
    expect([...DADOS_POR_TENIDOS]).toEqual([
      'nada',
      'silla',
      'pared',
      'marco',
      'toalla',
      'objetos',
      'barra-baja',
    ])
  })

  it('no incluye nada que haya que comprar ni nada que ya tenga su pregunta', () => {
    for (const equipo of ['escalon', 'barra', 'banda', 'paralelas', 'anillas', 'discos'] as const) {
      expect(DADOS_POR_TENIDOS, equipo).not.toContain(equipo)
    }
  })

  it('todo lo dado por tenido es equipo que la app conoce', () => {
    for (const equipo of DADOS_POR_TENIDOS) expect(EQUIPOS).toContain(equipo)
    expect(new Set(EQUIPOS).size).toBe(EQUIPOS.length)
  })
})

describe('con lo que tengo', () => {
  it('sin nada contestado: lo dado por tenido y la barra, que en toda la app cuenta como sí', () => {
    expect(equipoDe({})).toEqual([...DADOS_POR_TENIDOS, 'barra'])
  })

  it('quien dijo que no tiene barra se queda con lo dado por tenido', () => {
    expect(equipoDe({ tieneBarra: false })).toEqual([...DADOS_POR_TENIDOS])
  })

  it('cada interruptor del perfil suma lo suyo y nada más', () => {
    const base = equipoDe({ tieneBarra: false })
    const suma = (perfil: Parameters<typeof equipoDe>[0]) =>
      equipoDe({ tieneBarra: false, ...perfil }).filter((e) => !base.includes(e))
    expect(suma({ tieneEscalon: true })).toEqual(['escalon'])
    expect(suma({ tieneBanda: true })).toEqual(['banda'])
    expect(suma({ tieneParalelas: true })).toEqual(['paralelas'])
    expect(suma({ tieneAnillas: true })).toEqual(['anillas'])
    expect(suma({ cargaMaximaKg: 40 })).toEqual(['discos'])
    expect(suma({ tieneBarra: true })).toEqual(['barra'])
  })

  it('las preguntas nuevas sin contestar cuentan como no', () => {
    const equipo = equipoDe({})
    for (const nuevo of ['escalon', 'banda', 'paralelas', 'anillas', 'discos'] as const) {
      expect(equipo, nuevo).not.toContain(nuevo)
    }
  })

  it('una carga máxima en cero es no tener barra cargable, como en Hoy y en Progreso', () => {
    expect(equipoDe({ cargaMaximaKg: 0 })).not.toContain('discos')
  })

  it('sale siempre en el orden de EQUIPOS, marque lo que marque', () => {
    const todo = equipoDe({
      tieneBarra: true,
      cargaMaximaKg: 20,
      tieneEscalon: true,
      tieneBanda: true,
      tieneParalelas: true,
      tieneAnillas: true,
    })
    expect(todo).toEqual([...EQUIPOS])
  })
})

describe('alcanza', () => {
  const casa = DADOS_POR_TENIDOS

  it('con lo dado por tenido: el piso, la pared, la silla, el marco, la toalla y la mesa', () => {
    for (const id of [
      'flexion-completa',
      'flexion-pared',
      'flexion-inclinada',
      'sentadilla-asistida',
      'curl-talones-deslizando',
      'remo-australiano-alto',
      'remo-australiano-pies-elevados',
    ]) {
      expect(alcanza(ficha(id), casa), id).toBe(true)
    }
  })

  it('con lo dado por tenido, nada de lo que cuelga ni de lo que lleva discos', () => {
    for (const id of [...NECESITAN_BARRA, ...NECESITAN_BARRA_CARGABLE]) {
      expect(alcanza(ficha(id), casa), id).toBe(false)
    }
  })

  it('con lo dado por tenido hay al menos un eslabón de cada cadena', () => {
    for (const cadena of CADENAS) {
      expect(
        cadena.ejercicios.some((id) => alcanza(ficha(id), casa)),
        cadena.patron,
      ).toBe(true)
    }
  })

  it('hace falta todo lo que la ficha pide: la dominada asistida pide la barra y la banda', () => {
    const asistida = ficha('dominada-asistida')
    expect(alcanza(asistida, [...casa, 'barra'])).toBe(false)
    expect(alcanza(asistida, [...casa, 'banda'])).toBe(false)
    expect(alcanza(asistida, [...casa, 'barra', 'banda'])).toBe(true)
  })

  it('la barra cargable abre los seis de discos, y la de dominadas no', () => {
    for (const id of NECESITAN_BARRA_CARGABLE) {
      expect(alcanza(ficha(id), [...casa, 'barra']), id).toBe(false)
      expect(alcanza(ficha(id), [...casa, 'discos']), id).toBe(true)
    }
  })

  it('"nada" alcanza siempre, aunque el equipo no lo nombre', () => {
    expect(alcanza(ficha('flexion-completa'), [])).toBe(true)
    expect(alcanza(ficha('flexion-completa'), new Set<Equipo>())).toBe(true)
    expect(alcanza(ficha('flexion-pared'), [])).toBe(false)
  })

  it('una ficha sin el dato no alcanza: sin saber qué pide, no se propone', () => {
    expect(alcanza({}, EQUIPOS)).toBe(false)
    expect(alcanza({ equipo: [] }, EQUIPOS)).toBe(false)
  })

  it('da lo mismo con una lista que con un conjunto', () => {
    const conjuntos: Equipo[][] = [[], [...casa], [...casa, 'barra'], [...EQUIPOS]]
    for (const equipo of conjuntos) {
      for (const ejercicio of EJERCICIOS) {
        expect(alcanza(ejercicio, new Set(equipo)), ejercicio.id).toBe(alcanza(ejercicio, equipo))
      }
    }
  })

  it('con todo el equipo se alcanza la biblioteca entera', () => {
    for (const ejercicio of EJERCICIOS) expect(alcanza(ejercicio, EQUIPOS), ejercicio.id).toBe(true)
  })

  it('con lo de equipoDe, quien no tiene barra no alcanza nada colgado', () => {
    const sinBarra = equipoDe({ tieneBarra: false })
    for (const id of NECESITAN_BARRA) expect(alcanza(ficha(id), sinBarra), id).toBe(false)
    const conBarra = equipoDe({})
    expect(alcanza(ficha('dominada-completa'), conBarra)).toBe(true)
  })
})
