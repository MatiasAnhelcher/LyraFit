import { describe, expect, it } from 'vitest'
import {
  QUEDAN_TRES,
  anuncioDeLaSerie,
  anuncioDeLoQueViene,
  anuncioDelDescanso,
  anuncioDelEjercicioCompleto,
  crearAnunciador,
  duracionDicha,
} from './anuncios'

describe('duracionDicha', () => {
  it('dice minutos enteros como minutos', () => {
    expect(duracionDicha(60)).toBe('1 minuto')
    expect(duracionDicha(120)).toBe('2 minutos')
  })

  it('dice los segundos que sobran, y los segundos solos', () => {
    expect(duracionDicha(90)).toBe('1 minuto y 30 segundos')
    expect(duracionDicha(150)).toBe('2 minutos y 30 segundos')
    expect(duracionDicha(45)).toBe('45 segundos')
    expect(duracionDicha(61)).toBe('1 minuto y 1 segundo')
  })
})

describe('los anuncios de la sesión', () => {
  it('la serie anotada, con la unidad cuando son segundos', () => {
    expect(anuncioDeLaSerie(2, 8, 'repeticiones')).toBe('Serie 2 anotada: 8.')
    expect(anuncioDeLaSerie(1, 30, 'segundos')).toBe('Serie 1 anotada: 30 segundos.')
  })

  it('el descanso, y la ráfaga que lo abre si la hay', () => {
    expect(anuncioDelDescanso(120, null)).toBe('Descanso de 2 minutos.')
    expect(anuncioDelDescanso(90, 'Saltos de tijera')).toBe('Descanso de 1 minuto y 30 segundos. Ráfaga: saltos de tijera.')
  })

  it('lo que viene, en minúscula como se dice', () => {
    expect(anuncioDeLoQueViene({ clase: 'ejercicio', nombre: 'Flexiones declinadas' })).toBe('Después: flexiones declinadas.')
    expect(anuncioDeLoQueViene({ clase: 'fuelle' })).toBe('Después: el fuelle.')
    expect(anuncioDeLoQueViene({ clase: 'preguntas' })).toBe('Después: el final de la sesión.')
  })

  it('el ejercicio completo dice qué sigue', () => {
    expect(anuncioDelEjercicioCompleto({ clase: 'bajada', nombre: 'Flexiones inclinadas' })).toBe(
      'Ejercicio completo. A continuación: flexiones inclinadas.',
    )
    expect(anuncioDelEjercicioCompleto(null)).toBe('Ejercicio completo.')
  })

  it('la cuenta de los últimos segundos', () => {
    expect(QUEDAN_TRES).toBe('Quedan 3 segundos.')
  })

  it('ninguno levanta la voz', () => {
    const todos = [
      anuncioDeLaSerie(2, 8, 'repeticiones'),
      anuncioDelDescanso(90, 'Burpees'),
      anuncioDeLoQueViene({ clase: 'cierre', nombre: 'Plancha' }),
      anuncioDelEjercicioCompleto({ clase: 'preguntas' }),
      QUEDAN_TRES,
    ]
    for (const texto of todos) expect(texto).not.toMatch(/[!¡]/)
  })
})

describe('crearAnunciador', () => {
  /** La región, con el texto a la vista: `escribir` aplica el cambio como lo haría React. */
  function region() {
    const r = { dicho: '' }
    const anunciador = crearAnunciador((cambio) => {
      r.dicho = cambio(r.dicho)
    })
    return Object.assign(r, anunciador)
  }
  /** Que corran las promesas pendientes. */
  const pasar = () => new Promise((listo) => setTimeout(listo, 0))

  it('reemplaza el texto, y lo repetido cambia igual para que se vuelva a decir', () => {
    const r = region()
    r.anunciar('Serie 1 anotada: 8.')
    expect(r.dicho).toBe('Serie 1 anotada: 8.')
    r.anunciar(QUEDAN_TRES)
    expect(r.dicho).toBe(QUEDAN_TRES)
    r.anunciar(QUEDAN_TRES)
    expect(r.dicho).toBe(`${QUEDAN_TRES}\u00a0`)
    r.anunciar(QUEDAN_TRES)
    expect(r.dicho).toBe(QUEDAN_TRES)
  })

  it('callar la deja vacía, y lo que viene después se dice entero', () => {
    const r = region()
    r.anunciar('Serie 1 anotada: 8. Descanso de 2 minutos.')
    r.callar()
    expect(r.dicho).toBe('')
    r.anunciar('Serie 1 anotada: 8. Descanso de 2 minutos.')
    expect(r.dicho).toBe('Serie 1 anotada: 8. Descanso de 2 minutos.')
  })

  it('anunciarSi espera la confirmación, y sin ella no dice nada', async () => {
    const r = region()
    r.anunciarSi(Promise.resolve(true), 'Serie 1 anotada: 8.')
    expect(r.dicho).toBe('')
    await pasar()
    expect(r.dicho).toBe('Serie 1 anotada: 8.')

    r.anunciarSi(Promise.resolve(false), 'Serie 2 anotada: 8.')
    await pasar()
    expect(r.dicho).toBe('Serie 1 anotada: 8.')

    r.anunciarSi(Promise.reject(new Error('sin base')), 'Serie 3 anotada: 8.')
    await pasar()
    expect(r.dicho).toBe('Serie 1 anotada: 8.')
  })

  it('lo que se calla o se dice mientras espera gana: el anuncio viejo no llega', async () => {
    const r = region()
    r.anunciarSi(Promise.resolve(true), 'Serie 1 anotada: 8. Descanso de 2 minutos.')
    r.callar()
    await pasar()
    expect(r.dicho).toBe('')

    r.anunciarSi(Promise.resolve(true), 'Serie 2 anotada: 8.')
    r.anunciar(QUEDAN_TRES)
    await pasar()
    expect(r.dicho).toBe(QUEDAN_TRES)
  })
})
