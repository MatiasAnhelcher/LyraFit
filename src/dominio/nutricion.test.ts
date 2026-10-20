import { describe, expect, it } from 'vitest'
import {
  DIAS_PARA_LEER_SUENO,
  DIAS_QUE_VALE_LA_HORA,
  HORAS_DE_CAFEINA,
  HORAS_DE_DORMIR,
  PISO_DE_PROTEINA,
  SESIONES_POR_LADO,
  SIN_CAFEINA,
  TRAMOS_DE_SUENO,
  cafeinaTarde,
  comoHora,
  corteDeCafeina,
  cruzarSuenoConRendimiento,
  cuandoSeContesto,
  desdeCuandoValeLaHora,
  dichoDelSueno,
  horaDeDormirVigente,
  preguntarHoraDeDormir,
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

  it('sin la hora de acostarse no hay aviso, aunque el café haya sido tarde', () => {
    // La pantalla suponía las 23:00 y las guardaba sola. Ahora no supone nada,
    // y esto es lo que garantiza que sin ese dato no se dice nada: ni el
    // aviso en el diario, ni el de Hoy.
    expect(senalesDelDia(dia({ ultimaCafeina: 20 * 60 })).avisoDeCafeina).toBeNull()
  })

  it('el aviso habla de esta noche: no le dice "dormiste" a quien no se acostó', () => {
    // Sale a la tarde, antes de dormir. "No es que dormiste mal" era un
    // pasado que todavía no había pasado.
    const aviso = senalesDelDia(dia({ horaDeDormir: 23 * 60, ultimaCafeina: 16 * 60 })).avisoDeCafeina
    expect(aviso).toBeTruthy()
    expect(aviso).not.toMatch(/\bdormiste\b/i)
    expect(aviso).toContain('esta noche')
    expect(aviso).toContain(`${HORAS_DE_CAFEINA} horas`)
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

describe('la hora de acostarse', () => {
  /** Un día con la hora contestada en la regleta, que es lo único que cuenta. */
  const conHora = (fecha: string, horaDeDormir?: number): DiaDelDiario =>
    dia({ fecha, ...(horaDeDormir === undefined ? {} : { horaDeDormir, horaDeDormirContestada: true }) })

  it('se pregunta solo cuando la respuesta puede cambiar algo', () => {
    // Sin contestar el café, o con "Nada", no hay cuenta que hacer.
    expect(preguntarHoraDeDormir(undefined)).toBe(false)
    expect(preguntarHoraDeDormir(SIN_CAFEINA)).toBe(false)
    // Un café a las 12 no toca el sueño ni acostándose a las 21 (nueve horas
    // justas): cualquier respuesta daría lo mismo, así que no se pregunta.
    for (const h of [8, 10, 12]) expect(preguntarHoraDeDormir(h * 60), `café a las ${h}`).toBe(false)
    for (const h of [14, 16, 18, 20]) expect(preguntarHoraDeDormir(h * 60), `café a las ${h}`).toBe(true)
  })

  it('0, 1 y 2 son de la madrugada siguiente, no de la de hoy', () => {
    // En el orden de la noche: después de las 23 viene el 0.
    expect(HORAS_DE_DORMIR).toEqual([21, 22, 23, 0, 1, 2])
    // Café a las 20 y a dormir a la 1: cinco horas, no diecinueve.
    expect(cafeinaTarde(dia({ ultimaCafeina: 20 * 60, horaDeDormir: 1 * 60 }))).toBe(true)
    // Café a las 14 y a dormir a las 0: diez horas. Con una resta lineal
    // daría -14 h, y "menos de nueve" avisaría a quien no tiene que avisar.
    expect(cafeinaTarde(dia({ ultimaCafeina: 14 * 60, horaDeDormir: 0 }))).toBe(false)
    // Y el corte sube con la noche, sin saltar al revés en la medianoche.
    expect(HORAS_DE_DORMIR.map((h) => comoHora(corteDeCafeina(h * 60)))).toEqual([
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
    ])
  })

  it('sin ninguna respuesta no hay hora: nunca una por defecto', () => {
    expect(horaDeDormirVigente([], '2026-03-10')).toBeNull()
    expect(horaDeDormirVigente([conHora('2026-03-10'), conHora('2026-03-09')], '2026-03-10')).toBeNull()
  })

  it('las 23:00 que la app escribía sola no son una respuesta', () => {
    // Hasta octubre de 2026, tocar la cafeína guardaba `horaDeDormir: 1380`
    // sin que nadie la contestara. Esas filas siguen en los teléfonos, y sin
    // la marca la app diría "como dijiste hace tres días" de algo que nadie
    // dijo.
    const vieja = dia({ fecha: '2026-03-09', ultimaCafeina: 16 * 60, horaDeDormir: 23 * 60 })
    expect(horaDeDormirVigente([vieja], '2026-03-10')).toBeNull()
    // Y una vieja de hoy tampoco dispara el aviso cuando la pantalla pasa la
    // hora vigente, aunque esté en la fila.
    const viejaDeHoy = dia({ fecha: '2026-03-10', ultimaCafeina: 20 * 60, horaDeDormir: 23 * 60 })
    const hora = horaDeDormirVigente([viejaDeHoy], '2026-03-10')
    expect(hora).toBeNull()
    expect(senalesDelDia(viejaDeHoy, hora).avisoDeCafeina).toBeNull()
    // Con la marca, la misma hora sí cuenta.
    expect(horaDeDormirVigente([{ ...vieja, horaDeDormirContestada: true }], '2026-03-10')).toEqual({
      minutos: 23 * 60,
      hace: 1,
    })
  })

  it('la de hoy gana a cualquier otra', () => {
    const dias = [conHora('2026-03-09', 1 * 60), conHora('2026-03-10', 23 * 60)]
    expect(horaDeDormirVigente(dias, '2026-03-10')).toEqual({ minutos: 23 * 60, hace: 0 })
  })

  it('si hoy no se contestó, vale la última respuesta, venga en el orden que venga', () => {
    const dias = [
      conHora('2026-03-03', 21 * 60),
      conHora('2026-03-10'),
      conHora('2026-03-08', 22 * 60),
      conHora('2026-03-05', 2 * 60),
    ]
    expect(horaDeDormirVigente(dias, '2026-03-10')).toEqual({ minutos: 22 * 60, hace: 2 })
  })

  it('las doce de la noche son una respuesta, no un hueco', () => {
    // `if (d.horaDeDormir)` trataría el 0 como "no contestó".
    expect(horaDeDormirVigente([conHora('2026-03-09', 0)], '2026-03-10')).toEqual({ minutos: 0, hace: 1 })
  })

  it('vale dos semanas y ni un día más', () => {
    expect(DIAS_QUE_VALE_LA_HORA).toBe(14)
    expect(horaDeDormirVigente([conHora('2026-03-10', 60)], '2026-03-24')).toEqual({ minutos: 60, hace: 14 })
    expect(horaDeDormirVigente([conHora('2026-03-10', 60)], '2026-03-25')).toBeNull()
  })

  it('cuenta días de calendario aunque en el medio cambie la hora', () => {
    // El 4/10/2026 Sídney adelanta el reloj y el 5/4/2026 lo atrasa: los
    // tests corren también en esa zona, y un día de 23 o 25 horas no puede
    // correr el borde de la vigencia.
    expect(horaDeDormirVigente([conHora('2026-09-26', 60)], '2026-10-10')?.hace).toBe(14)
    expect(horaDeDormirVigente([conHora('2026-09-25', 60)], '2026-10-10')).toBeNull()
    expect(horaDeDormirVigente([conHora('2026-03-29', 60)], '2026-04-12')?.hace).toBe(14)
    expect(desdeCuandoValeLaHora('2026-10-10')).toBe('2026-09-26')
    expect(desdeCuandoValeLaHora('2026-01-05')).toBe('2025-12-22')
  })

  it('un día posterior a hoy no es una respuesta de antes', () => {
    // Solo existe si el reloj del teléfono se movió.
    expect(horaDeDormirVigente([conHora('2026-03-11', 60)], '2026-03-10')).toBeNull()
  })

  it('dice de cuándo es la hora que se volvió a usar', () => {
    expect(cuandoSeContesto(1)).toBe('ayer')
    expect(cuandoSeContesto(3)).toBe('hace 3 días')
    expect(cuandoSeContesto(14)).toBe('hace 14 días')
  })

  it('el aviso usa la hora que vale hoy, aunque sea de otro día', () => {
    const hoy = dia({ ultimaCafeina: 20 * 60 })
    expect(senalesDelDia(hoy).avisoDeCafeina).toBeNull()
    expect(senalesDelDia(hoy, null).avisoDeCafeina).toBeNull()
    expect(senalesDelDia(hoy, { minutos: 23 * 60, hace: 2 }).avisoDeCafeina).toContain('esta noche')
    // Usarla no es contestarla: la cuenta de respuestas de hoy no cambia.
    expect(senalesDelDia(hoy, { minutos: 23 * 60, hace: 2 }).contestados).toBe(1)
    // Y con "Nada" no hay aviso, haya la hora que haya.
    expect(senalesDelDia(dia({ ultimaCafeina: SIN_CAFEINA }), { minutos: 0, hace: 0 }).avisoDeCafeina).toBeNull()
  })
})
