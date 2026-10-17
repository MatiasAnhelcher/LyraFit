import { describe, expect, it } from 'vitest'
import {
  DIAS_PARA_LEER_SUENO,
  HORAS_DE_CAFEINA,
  PISO_DE_PROTEINA,
  SESIONES_POR_LADO,
  SIN_CAFEINA,
  TRAMOS_DE_SUENO,
  cafeinaTarde,
  comoHora,
  corteDeCafeina,
  cruzarSuenoConRendimiento,
  dichoDelSueno,
  senalesDelDia,
  type DiaDelDiario,
} from './nutricion'

const dia = (extra: Partial<DiaDelDiario> = {}): DiaDelDiario => ({
  fecha: '2026-03-10',
  actualizadoEn: 0,
  ...extra,
})

describe('la cafeína', () => {
  it('a nueve horas justas ya no cuenta, y a ocho y media sí', () => {
    // El umbral es un borde y los bordes son donde se equivocan los umbrales.
    const dormir = 23 * 60
    expect(cafeinaTarde(dia({ horaDeDormir: dormir, ultimaCafeina: dormir - 9 * 60 }))).toBe(false)
    expect(cafeinaTarde(dia({ horaDeDormir: dormir, ultimaCafeina: dormir - 8.5 * 60 }))).toBe(true)
  })

  it('cruza la medianoche, que es justo el caso que importa', () => {
    // Acostarse 00:30 y tomar café a las 17:00 son siete horas y media. Con
    // una resta lineal daría -16,5 h y la app diría que no pasa nada
    // exactamente a quien se acuesta tarde, que es a quien más le pasa.
    expect(cafeinaTarde(dia({ horaDeDormir: 30, ultimaCafeina: 17 * 60 }))).toBe(true)
    // Y a las 13:00 ya está fuera de la ventana: once horas y media.
    expect(cafeinaTarde(dia({ horaDeDormir: 30, ultimaCafeina: 13 * 60 }))).toBe(false)
  })

  it('sin alguno de los dos datos no afirma nada', () => {
    expect(cafeinaTarde(dia({ ultimaCafeina: 20 * 60 }))).toBe(false)
    expect(cafeinaTarde(dia({ horaDeDormir: 23 * 60 }))).toBe(false)
  })

  it('el corte también da la vuelta al reloj', () => {
    expect(comoHora(corteDeCafeina(23 * 60))).toBe('14:00')
    expect(comoHora(corteDeCafeina(30))).toBe('15:30')
  })
})

describe('las señales del día', () => {
  it('un día sin contestar nada no dice nada', () => {
    const s = senalesDelDia(undefined)
    expect(s.contestados).toBe(0)
    expect(s.avisoDeCafeina).toBeNull()
  })

  it('cuenta lo contestado, no lo cumplido', () => {
    // Esto es la regla entera del módulo: contestar "tomé bastante" es un
    // dato, no una falta. Si `contestados` bajara por contestar "mal", la
    // pantalla se convertiría en un examen.
    const s = senalesDelDia(dia({ alcohol: 'bastante', verduraEnDos: false, sueno: '<5' }))
    expect(s.contestados).toBe(3)
    expect(s.enPiso).toBe(0)
  })

  it('el piso de proteína son cuatro porciones, y tres no alcanzan', () => {
    expect(senalesDelDia(dia({ porcionesDeProteina: PISO_DE_PROTEINA })).enPiso).toBe(1)
    expect(senalesDelDia(dia({ porcionesDeProteina: PISO_DE_PROTEINA - 1 })).enPiso).toBe(0)
  })

  it('cero porciones es una respuesta, no un silencio', () => {
    // El bug clásico: `if (dia.porcionesDeProteina)` trata el 0 como "no
    // contestó" y la fila queda esperando para siempre una respuesta que ya
    // está dada.
    expect(senalesDelDia(dia({ porcionesDeProteina: 0 })).contestados).toBe(1)
  })
})

describe('el cruce de sueño y rendimiento', () => {
  const diario = (pares: [string, string][]) =>
    new Map(pares.map(([fecha, sueno]) => [fecha, dia({ fecha, sueno: sueno as never })]))

  it('con pocas sesiones de un lado no dice nada', () => {
    const sesiones = Array.from({ length: 10 }, (_, i) => ({
      fecha: `2026-03-${String(i + 1).padStart(2, '0')}`,
      rendimiento: i < 3 ? 0.4 : 1,
    }))
    const d = diario(
      sesiones.map((s, i) => [s.fecha, i < 3 ? '<5' : '8+'] as [string, string]),
    )
    // Tres de un lado: por debajo del mínimo, y con tres casos cualquier
    // diferencia es una anécdota.
    expect(cruzarSuenoConRendimiento(sesiones, d)).toBeNull()
    expect(SESIONES_POR_LADO).toBe(4)
  })

  it('con diferencia chica se calla, aunque haya datos de sobra', () => {
    const sesiones = Array.from({ length: 20 }, (_, i) => ({
      fecha: `2026-03-${String(i + 1).padStart(2, '0')}`,
      rendimiento: i < 10 ? 0.9 : 0.95,
    }))
    const d = diario(sesiones.map((s, i) => [s.fecha, i < 10 ? '5-6' : '7-8'] as [string, string]))
    expect(cruzarSuenoConRendimiento(sesiones, d)).toBeNull()
  })

  it('con señal de verdad, la dice con los dos números', () => {
    const sesiones = Array.from({ length: 20 }, (_, i) => ({
      fecha: `2026-03-${String(i + 1).padStart(2, '0')}`,
      rendimiento: i < 10 ? 0.6 : 0.95,
    }))
    const d = diario(sesiones.map((s, i) => [s.fecha, i < 10 ? '5-6' : '8+'] as [string, string]))
    const l = cruzarSuenoConRendimiento(sesiones, d)
    expect(l).not.toBeNull()
    expect(l!.durmiendoPoco).toBeCloseTo(0.6)
    expect(l!.durmiendoBien).toBeCloseTo(0.95)
    expect(dichoDelSueno(l!)).toBe(
      'En las sesiones que venís de dormir menos de seis horas cumpliste el objetivo el 60% de las veces; durmiendo más de siete, el 95%.',
    )
  })

  it('el tramo del medio no entra en ninguno de los dos grupos', () => {
    // 6-7 es la frontera. Meterlo de un lado inventaría una diferencia que no
    // está en los datos, y de qué lado se meta cambiaría el resultado — que es
    // la definición de un análisis que no se puede defender.
    const sesiones = Array.from({ length: 12 }, (_, i) => ({
      fecha: `2026-03-${String(i + 1).padStart(2, '0')}`,
      rendimiento: 1,
    }))
    const d = diario(sesiones.map((s) => [s.fecha, '6-7'] as [string, string]))
    expect(cruzarSuenoConRendimiento(sesiones, d)).toBeNull()
  })

  it('una sesión sin sueño anotado no arrastra a ningún grupo', () => {
    const sesiones = Array.from({ length: 8 }, (_, i) => ({
      fecha: `2026-03-${String(i + 1).padStart(2, '0')}`,
      rendimiento: i < 4 ? 0.5 : 0.9,
    }))
    const d = new Map<string, DiaDelDiario>()
    expect(cruzarSuenoConRendimiento(sesiones, d)).toBeNull()
  })
})

describe('las constantes que son promesas', () => {
  it('los cinco tramos de sueño son cinco y están en orden', () => {
    expect(TRAMOS_DE_SUENO).toEqual(['<5', '5-6', '6-7', '7-8', '8+'])
  })

  it('la ventana de cafeína son nueve horas y la espera, tres semanas', () => {
    // Los dos números están en la documentación y en el copy que ve la
    // persona. Si alguien los cambia acá, el texto pasa a mentir.
    expect(HORAS_DE_CAFEINA).toBe(9)
    expect(DIAS_PARA_LEER_SUENO).toBe(21)
  })
})

describe('"hoy no tomé" no es lo mismo que "no contesté"', () => {
  it('el centinela cuenta como respuesta y no dispara el aviso', () => {
    // Sin esto, el día sin café quedaría indistinguible del día sin contestar
    // y la fila se quedaría esperando para siempre una respuesta ya dada.
    const d = dia({ ultimaCafeina: SIN_CAFEINA, horaDeDormir: 23 * 60 })
    expect(cafeinaTarde(d)).toBe(false)
    expect(senalesDelDia(d).contestados).toBe(1)
    expect(senalesDelDia(d).avisoDeCafeina).toBeNull()
  })

  it('las doce de la noche son una hora real y no un centinela', () => {
    // El centinela no puede ser 0: alguien que se acuesta a las dos de la
    // mañana puede perfectamente haber tomado café a medianoche, y ese es
    // justo el caso donde el aviso tiene que salir.
    expect(cafeinaTarde(dia({ ultimaCafeina: 0, horaDeDormir: 2 * 60 }))).toBe(true)
    expect(SIN_CAFEINA).toBeLessThan(0)
  })
})
