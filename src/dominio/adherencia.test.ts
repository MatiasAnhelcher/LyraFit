import { describe, expect, it } from 'vitest'
import {
  CREDITOS_MAXIMOS,
  adherencia,
  consistenciaHoraria,
  esHito,
  esVuelta,
  horaHabitual,
  intervaloHabitual,
  proximoHito,
  sesionesDeVida,
} from './adherencia'
import type { Sesion } from './tipos'

function sesion(fecha: string, hora = 18): Sesion {
  return {
    id: `s-${fecha}-${hora}`,
    fecha,
    finalizadaEn: new Date(`${fecha}T${String(hora).padStart(2, '0')}:00:00`).getTime(),
    duracionSegundos: 1800,
    tipo: 'plan',
    registros: [],
  }
}

/** Genera sesiones perfectas para una rutina de N días por semana. */
function rutina(desde: string, dias: number[], semanas: number): Sesion[] {
  const base = new Date(`${desde}T00:00:00`)
  const out: Sesion[] = []
  for (let s = 0; s < semanas; s++) {
    for (const d of dias) {
      const f = new Date(base)
      f.setDate(f.getDate() + s * 7 + d)
      const dd = (n: number) => String(n).padStart(2, '0')
      out.push(sesion(`${f.getFullYear()}-${dd(f.getMonth() + 1)}-${dd(f.getDate())}`))
    }
  }
  return out
}

/** Los días del plan, de 1 (lunes) a 7 (domingo), como los da `diasDe`. */
const LMV = [1, 3, 5]
const MA_V = [2, 5]
const L_MA_J_V = [1, 2, 4, 5]

describe('adherencia rodante', () => {
  // 2026-01-05 es lunes.
  it('alguien impecable ve el máximo, con la rutina de la propia app', () => {
    // Esto es exactamente lo que la racha de días hacía mal: con lunes,
    // miércoles y viernes, ocho semanas perfectas mostraban un tres.
    const sesiones = rutina('2026-01-05', [0, 2, 4], 8)
    const a = adherencia(sesiones, '2026-02-27', LMV)
    expect(a.porcentaje).toBe(100)
    expect(a.hechas).toBe(12)
    expect(a.meta).toBe(12)
  })

  it('la rutina mínima de dos días también llega al máximo', () => {
    const sesiones = rutina('2026-01-06', [0, 3], 8)
    const a = adherencia(sesiones, '2026-02-27', MA_V)
    expect(a.porcentaje).toBe(100)
    expect(a.meta).toBe(8)
  })

  it('faltar una vez no derrumba nada, porque hay crédito', () => {
    // Una falta de verdad: el miércoles 25 pasó sin sesión, y se mira el
    // viernes ya entrenado. Antes este test sacaba la sesión de HOY y la
    // contaba como falta, que es justo el error que tenía la barra.
    const sesiones = rutina('2026-01-05', [0, 2, 4], 8).filter((s) => s.fecha !== '2026-02-25')
    const a = adherencia(sesiones, '2026-02-27', LMV)
    expect(a.hechas).toBe(11)
    expect(a.cubiertos).toBe(1)
    expect(a.porcentaje).toBe(100)
  })

  it('pero los créditos tienen tope: faltar mucho sí se nota', () => {
    const sesiones = rutina('2026-01-05', [0, 2, 4], 8).slice(0, -6)
    const a = adherencia(sesiones, '2026-02-27', LMV)
    expect(a.creditos).toBeLessThanOrEqual(CREDITOS_MAXIMOS)
    expect(a.porcentaje).toBeLessThan(100)
  })

  it('nunca vuelve a cero de golpe: siempre se puede recuperar en días', () => {
    const sesiones = rutina('2026-01-05', [0, 2, 4], 8)
    // Dos semanas sin entrenar: la barra baja, pero no desaparece.
    const a = adherencia(sesiones, '2026-03-13', LMV)
    expect(a.porcentaje).toBeGreaterThan(0)
    expect(a.porcentaje).toBeLessThan(100)
  })

  it('sin historial no explota, y no mide nada', () => {
    const a = adherencia([], '2026-02-27', LMV)
    expect(a.porcentaje).toBe(0)
    expect(a.creditos).toBe(0)
    expect(a.meta).toBe(0)
  })

  it('dos sesiones el mismo día cuentan como un día', () => {
    const a = adherencia([sesion('2026-02-26'), sesion('2026-02-26', 20)], '2026-02-27', LMV)
    expect(a.hechas).toBe(1)
  })
})

/**
 * La barra de 28 días le avisaba faltas a quien no faltó.
 *
 * Medido con la función de antes, para alguien que entrena lunes, miércoles y
 * viernes y no falla nunca: el día 7 veía "3 de 12"; el día 8, antes de
 * entrenar, "Un día cubierto con tus créditos. Faltar estaba previsto."; desde
 * el día 15, "2 días cubiertos"; y con diez semanas perfectas el aviso seguía
 * saliendo cada lunes, miércoles y viernes antes de la sesión. El test de
 * arriba solo miraba un viernes ya entrenado de la semana 8, y por eso no lo vio.
 */
describe('la barra de 28 días no le avisa faltas a quien no faltó', () => {
  const dd = (n: number) => String(n).padStart(2, '0')
  /** Fecha local AAAA-MM-DD, como la arma la app con `fechaISO`. */
  const local = (d: Date) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
  const masDias = (fecha: string, n: number) => {
    const d = new Date(`${fecha}T12:00:00`)
    d.setDate(d.getDate() + n)
    return local(d)
  }
  const diaDeLaSemana = (fecha: string) => new Date(`${fecha}T12:00:00`).getDay() || 7

  /**
   * Recorre `dias` días desde `desde` entrenando exactamente los días del plan,
   * y devuelve lo que se ve cada día antes y, si tocaba, después de entrenar.
   */
  function recorrer(desde: string, plan: readonly number[], dias: number) {
    const sesiones: Sesion[] = []
    const vistas: { hoy: string; momento: string; a: ReturnType<typeof adherencia> }[] = []
    for (let i = 0; i < dias; i++) {
      const hoy = masDias(desde, i)
      vistas.push({ hoy, momento: 'antes', a: adherencia(sesiones, hoy, plan) })
      if (plan.includes(diaDeLaSemana(hoy))) {
        sesiones.push(sesion(hoy))
        vistas.push({ hoy, momento: 'después', a: adherencia(sesiones, hoy, plan) })
      }
    }
    return vistas
  }

  it('en la primera semana se mide contra los días que pasaron, no contra 28', () => {
    // El domingo, día 7: tres de tres, y no tres de doce.
    const a = adherencia(rutina('2026-01-05', [0, 2, 4], 1), '2026-01-11', LMV)
    expect(`${a.hechas} de ${a.meta}`).toBe('3 de 3')
    expect(a.cubiertos).toBe(0)
    // A las dos semanas, seis de seis.
    const b = adherencia(rutina('2026-01-05', [0, 2, 4], 2), '2026-01-18', LMV)
    expect(`${b.hechas} de ${b.meta}`).toBe('6 de 6')
    expect(b.cubiertos).toBe(0)
  })

  it('la meta crece con los días que pasan y se queda en la de cuatro semanas', () => {
    const despues = recorrer('2026-01-05', LMV, 70).filter((v) => v.momento === 'después')
    expect(despues.slice(0, 5).map((v) => v.a.meta)).toEqual([1, 2, 3, 4, 5])
    for (const v of despues.slice(11)) expect(v.a.meta, v.hoy).toBe(12)
  })

  it('la primera sesión, hoy mismo, es una de una', () => {
    const a = adherencia([sesion('2026-01-05')], '2026-01-05', LMV)
    expect(`${a.hechas} de ${a.meta}`).toBe('1 de 1')
    expect(a.cubiertos).toBe(0)
    expect(a.porcentaje).toBe(100)
  })

  it('si arranca un día que no es del plan, ese día igual cuenta', () => {
    // Martes 6 con un plan de lunes, miércoles y viernes: es el día que eligió
    // para empezar. Sin esta regla, el miércoles leería "2 de 1".
    const martes = [sesion('2026-01-06')]
    expect(adherencia(martes, '2026-01-06', LMV)).toMatchObject({ hechas: 1, meta: 1 })
    expect(adherencia(martes, '2026-01-07', LMV)).toMatchObject({ hechas: 1, meta: 1 })
    const miercoles = [...martes, sesion('2026-01-07')]
    expect(adherencia(miercoles, '2026-01-07', LMV)).toMatchObject({ hechas: 2, meta: 2 })
  })

  it('antes de entrenar hoy, la ventana termina ayer', () => {
    // Diez semanas impecables, hasta el viernes 13 de marzo. El lunes 16, antes
    // de entrenar, antes leía "11 de 12" y "Un día cubierto con tus créditos".
    const sesiones = rutina('2026-01-05', [0, 2, 4], 10)
    const antes = adherencia(sesiones, '2026-03-16', LMV)
    expect(`${antes.hechas} de ${antes.meta}`).toBe('12 de 12')
    expect(antes.cubiertos).toBe(0)

    const despues = adherencia([...sesiones, sesion('2026-03-16')], '2026-03-16', LMV)
    expect(`${despues.hechas} de ${despues.meta}`).toBe('12 de 12')
    expect(despues.cubiertos).toBe(0)
  })

  const RUTINAS: [string, readonly number[], string][] = [
    ['cuerpo completo (L-M-V)', LMV, '2026-01-05'],
    ['la mínima (Ma-V)', MA_V, '2026-01-06'],
    ['empuje y tracción (L-Ma-J-V)', L_MA_J_V, '2026-01-05'],
  ]

  for (const [nombre, plan, desde] of RUTINAS) {
    it(`en ${nombre}, diez semanas día por día: nunca un aviso ni una falta`, () => {
      for (const { hoy, momento, a } of recorrer(desde, plan, 70)) {
        expect(a.cubiertos, `${hoy} ${momento}`).toBe(0)
        expect(a.hechas, `${hoy} ${momento}`).toBe(a.meta)
      }
    })
  }

  it('una semana armada a mano con sábado o domingo se cuenta igual', () => {
    // Ajustes deja marcar cualquier día, y ninguna rutina de la app trae el fin
    // de semana: sin este caso, un domingo numerado 0 en vez de 7 pasaba todos
    // los tests y la barra dejaba de contar los domingos del plan.
    const SEMANAS: readonly number[][] = [[6, 7], [1, 3, 6], [2, 4, 7], [1, 2, 3, 4, 5, 6, 7]]
    for (const plan of SEMANAS) {
      for (let arranque = 0; arranque < 7; arranque++) {
        const vistas = recorrer(masDias('2026-01-05', arranque), plan, 42)
        for (const { hoy, momento, a } of vistas) {
          expect(a.cubiertos, `${plan} ${hoy} ${momento}`).toBe(0)
          expect(a.hechas, `${plan} ${hoy} ${momento}`).toBe(a.meta)
        }
        // A las seis semanas, la meta es la de cuatro semanas enteras.
        expect(vistas[vistas.length - 1]!.a.meta, `${plan}`).toBe(plan.length * 4)
      }
    }
  })

  it('cambiar un día de lugar no es faltar', () => {
    // Entrenó el martes 24 en vez del lunes 23: el lunes pasó sin sesión, pero
    // las sesiones son las mismas y no hay nada que cubrir.
    const sesiones = rutina('2026-01-05', [0, 2, 4], 8)
      .filter((s) => s.fecha <= '2026-02-25')
      .map((s) => (s.fecha === '2026-02-23' ? sesion('2026-02-24') : s))
    const a = adherencia(sesiones, '2026-02-25', LMV)
    expect(`${a.hechas} de ${a.meta}`).toBe('12 de 12')
    expect(a.cubiertos).toBe(0)
  })

  it('el aviso de créditos sale solo si de verdad pasó un día del plan sin sesión', () => {
    // Historias al azar, con semilla para que el test sea siempre el mismo
    // (mulberry32): cada día del plan se entrena con probabilidad 0,7 y cada
    // día libre con 0,15, arrancando cualquier día de la semana. Se mira cada
    // día, antes y después de entrenar.
    let semilla = 20261020
    const azar = () => {
      semilla = (semilla + 0x6d2b79f5) | 0
      let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    let conAviso = 0
    for (let historia = 0; historia < 60; historia++) {
      const [, plan] = RUTINAS[historia % RUTINAS.length]!
      const desde = masDias('2026-01-05', historia % 7)
      const sesiones: Sesion[] = []
      for (let i = 0; i < 49; i++) {
        const hoy = masDias(desde, i)
        const toca = plan.includes(diaDeLaSemana(hoy))
        const entrena = i === 0 || azar() < (toca ? 0.7 : 0.15)
        for (const yaEntreno of entrena ? [false, true] : [false]) {
          if (yaEntreno) sesiones.push(sesion(hoy))
          const a = adherencia(sesiones, hoy, plan)
          if (a.cubiertos === 0) continue
          conAviso++
          // El tramo medido, contado aparte: desde la primera sesión, o desde
          // hace 27 días, hasta hoy si ya entrenó o hasta ayer si todavía no.
          // Un día del plan que todavía no terminó no puede ser la falta.
          const fechas = new Set(sesiones.map((s) => s.fecha))
          const hasta = fechas.has(hoy) ? hoy : masDias(hoy, -1)
          const primera = [...fechas].sort()[0]!
          let huboFalta = false
          for (let d = 0; d < 28; d++) {
            const dia = masDias(hasta, -d)
            if (dia < primera) break
            if (plan.includes(diaDeLaSemana(dia)) && !fechas.has(dia)) huboFalta = true
          }
          expect(huboFalta, `${hoy} con ${a.cubiertos} cubiertos`).toBe(true)
        }
      }
    }
    // Que el test no pase en el vacío: en estas historias hay faltas reales.
    expect(conAviso).toBeGreaterThan(50)
  })

  it('alrededor de la medianoche, el día cuenta cuando termina', () => {
    // Cuatro semanas impecables desde el lunes 21 de septiembre de 2026, y el
    // lunes 19 de octubre es día de entrenar.
    const historia = rutina('2026-09-21', [0, 2, 4], 4)
    const lunes2359 = local(new Date(2026, 9, 19, 23, 59))
    const martes0001 = local(new Date(2026, 9, 20, 0, 1))
    const martes0010 = local(new Date(2026, 9, 20, 0, 10))

    // Lunes 23:59 sin haber entrenado: el lunes todavía no pasó.
    expect(adherencia(historia, lunes2359, LMV).cubiertos).toBe(0)

    // Entrenó el lunes a las 23:30: a las 00:01 del martes, todo en orden.
    const conLunes = [...historia, sesion('2026-10-19', 23)]
    expect(adherencia(conLunes, martes0001, LMV)).toMatchObject({ hechas: 12, meta: 12, cubiertos: 0 })

    // La sesión empezó el lunes y terminó pasada la medianoche, así que quedó
    // con fecha del martes: es un día cambiado de lugar, no una falta.
    const pasadaLaMedianoche = [...historia, sesion('2026-10-20', 0)]
    expect(adherencia(pasadaLaMedianoche, martes0010, LMV).cubiertos).toBe(0)

    // Y si el lunes de verdad pasó sin sesión, a las 00:01 sí aparece el día
    // cubierto: ahí corresponde.
    const falto = adherencia(historia, martes0001, LMV)
    expect(falto.hechas).toBe(11)
    expect(falto.cubiertos).toBe(1)
  })

  it('el cambio de hora no corre los días del plan', () => {
    // En Sídney (la corrida con TZ=Australia/Sydney) el horario de verano
    // termina el domingo 5 de abril de 2026 y empieza el domingo 4 de octubre.
    const CASOS: [string, string, string][] = [
      // desde, el viernes después del cambio, el lunes después del cambio
      ['2026-03-09', '2026-04-10', '2026-04-06'],
      ['2026-09-07', '2026-10-09', '2026-10-05'],
    ]
    for (const [desde, viernes, lunes] of CASOS) {
      const sesiones = rutina(desde, [0, 2, 4], 8)
      const delViernes = adherencia(sesiones.filter((s) => s.fecha <= viernes), viernes, LMV)
      expect(delViernes, viernes).toMatchObject({ hechas: 12, meta: 12, cubiertos: 0 })
      // El lunes, antes de entrenar.
      const delLunes = adherencia(sesiones.filter((s) => s.fecha < lunes), lunes, LMV)
      expect(delLunes, lunes).toMatchObject({ hechas: 12, meta: 12, cubiertos: 0 })
    }
  })
})

describe('el contador que solo sube', () => {
  it('cuenta todo lo que hiciste en tu vida', () => {
    expect(sesionesDeVida(rutina('2026-01-05', [0, 2, 4], 10))).toBe(30)
  })

  it('los hitos van marcando el camino', () => {
    expect(proximoHito(0)).toEqual({ hito: 10, faltan: 10 })
    expect(proximoHito(47)).toEqual({ hito: 50, faltan: 3 })
    expect(esHito(50)).toBe(true)
    expect(esHito(51)).toBe(false)
  })

  it('después del último hito ya no hay nada que perseguir', () => {
    expect(proximoHito(5000)).toBeNull()
  })
})

describe('el ritmo de cada uno', () => {
  it('mide el intervalo real, no el declarado', () => {
    expect(intervaloHabitual(rutina('2026-01-05', [0, 2, 4], 4))).toBe(2)
  })

  it('sin suficiente historial no inventa un ritmo', () => {
    expect(intervaloHabitual([sesion('2026-02-01')])).toBeNull()
  })

  it('la vuelta se juzga contra el hábito propio, no contra un número fijo', () => {
    const tresPorSemana = rutina('2026-01-05', [0, 2, 4], 4)
    // Cuatro días sin entrenar es mucho para quien entrena día por medio.
    expect(esVuelta(tresPorSemana, '2026-02-05')).toBe(true)
    // Pero un día de descanso normal no es una vuelta.
    expect(esVuelta(tresPorSemana, '2026-01-31')).toBe(false)
  })
})

describe('consistencia horaria', () => {
  it('quien entrena siempre a la misma hora tiene consistencia alta', () => {
    const sesiones = rutina('2026-01-05', [0, 2, 4], 3).map((s) => ({ ...s }))
    expect(consistenciaHoraria(sesiones)!).toBeGreaterThan(0.9)
  })

  it('quien entrena a cualquier hora tiene consistencia baja', () => {
    const horas = [6, 13, 21, 8, 23, 15, 11, 19, 7, 22]
    const sesiones = horas.map((h, i) => sesion(`2026-01-${String(i + 5).padStart(2, '0')}`, h))
    expect(consistenciaHoraria(sesiones)!).toBeLessThan(0.6)
  })

  it('no dice nada con pocos datos', () => {
    expect(consistenciaHoraria([sesion('2026-01-05')])).toBeNull()
    expect(horaHabitual([sesion('2026-01-05')])).toBeNull()
  })

  it('la hora habitual es la de la primera sesión de cada día', () => {
    // Siete días a las 8. Si contaran todas, la tarde de tres sesiones del
    // último día movería la hora habitual hacia el mediodía.
    const mananas = Array.from({ length: 7 }, (_, i) =>
      sesion(`2026-01-${String(i + 5).padStart(2, '0')}`, 8),
    )
    const masDelUltimo = [13, 19, 21].map((h) => sesion('2026-01-11', h))
    expect(horaHabitual(mananas)).toBe(8)
    expect(horaHabitual([...mananas, ...masDelUltimo])).toBe(8)
    expect(consistenciaHoraria([...mananas, ...masDelUltimo])).toBe(consistenciaHoraria(mananas))
    // Y cinco sesiones en un día no son cinco días de datos.
    expect(horaHabitual([8, 10, 13, 17, 21].map((h) => sesion('2026-01-05', h)))).toBeNull()
  })

  it('la hora típica cruza la medianoche sin volverse loca', () => {
    // Las 23 y la 1 están a dos horas, no a veintidós: por eso la cuenta es
    // circular. El promedio ingenuo daría el mediodía.
    const sesiones = [23, 0, 1, 23.5, 0.5, 23, 1].map((h, i) =>
      sesion(`2026-01-${String(i + 5).padStart(2, '0')}`, Math.floor(h)),
    )
    const hora = horaHabitual(sesiones)!
    expect(hora > 22 || hora < 2).toBe(true)
  })
})

/**
 * La vuelta y el fin de semana.
 *
 * Medido contra la mediana de los intervalos, la rutina por defecto —lunes,
 * miércoles y viernes— daba "vuelta" TODOS los lunes: mediana 2, umbral 3, y
 * el hueco del fin de semana es exactamente 3. El objetivo se recortaba al 70%
 * un día de cada tres y, desde que las vueltas dejaron de mover la progresión,
 * un tercio de las sesiones de alguien impecable no contaba para nada.
 */
describe('una vuelta es faltar, no es el fin de semana', () => {
  const comoFecha = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  /** Seis semanas impecables de una rutina, por día de la semana. */
  function impecable(diasDeLaSemana: number[]): Sesion[] {
    const lunes = new Date(2026, 0, 5)
    const fechas: string[] = []
    for (let semana = 0; semana < 6; semana++) {
      for (const dia of diasDeLaSemana) {
        const d = new Date(lunes)
        d.setDate(lunes.getDate() + semana * 7 + dia)
        fechas.push(comoFecha(d))
      }
    }
    return fechas.map((fecha, i) => ({
      id: `s${i}`, fecha, finalizadaEn: i, duracionSegundos: 1800, tipo: 'plan', registros: [],
    }))
  }

  const masTarde = (fecha: string, dias: number) => {
    const d = new Date(`${fecha}T12:00:00`)
    d.setDate(d.getDate() + dias)
    return comoFecha(d)
  }

  const RUTINAS: [string, number[], number, number][] = [
    // nombre, días, hueco normal más largo, primer hueco que SÍ es una vuelta
    ['cuerpo completo (L-M-V)', [0, 2, 4], 3, 5],
    ['la mínima (Ma-V)', [1, 4], 4, 7],
    ['empuje y tracción (L-Ma-J-V)', [0, 1, 3, 4], 3, 5],
  ]

  for (const [nombre, dias, normal, vuelta] of RUTINAS) {
    it(`en ${nombre}, ${normal} días es su ritmo y ${vuelta} es haber faltado`, () => {
      const sesiones = impecable(dias)
      const ultima = sesiones[sesiones.length - 1]!.fecha
      expect(esVuelta(sesiones, masTarde(ultima, normal)), `${normal} días`).toBe(false)
      expect(esVuelta(sesiones, masTarde(ultima, vuelta)), `${vuelta} días`).toBe(true)
    })
  }

  it('todas las sesiones del día de la vuelta son vuelta', () => {
    // La segunda del día encuentra a la primera, que es de hoy: si contara,
    // el hueco sería de cero días y dejaría de ser vuelta a la tarde.
    const sesiones = impecable([0, 2, 4])
    const ultima = sesiones[sesiones.length - 1]!.fecha
    const dia = masTarde(ultima, 5)
    const manana = { ...sesiones[0]!, id: 'manana', fecha: dia, finalizadaEn: 10_000 }
    const tarde = { ...sesiones[0]!, id: 'tarde', fecha: dia, finalizadaEn: 20_000 }
    expect(esVuelta(sesiones, dia)).toBe(true)
    expect(esVuelta([...sesiones, manana], dia)).toBe(true)
    expect(esVuelta([...sesiones, manana, tarde], dia)).toBe(true)
    // Y al día siguiente ya no: la vuelta fue ayer.
    expect(esVuelta([...sesiones, manana, tarde], masTarde(dia, 1))).toBe(false)
  })

  it('y una ausencia real no le sube el umbral para siempre', () => {
    // Quien faltó una semana entera no puede quedar con un "hueco normal" de
    // siete días: dejaría de detectarse cualquier vuelta durante dos semanas.
    const sesiones = impecable([0, 2, 4]).filter((s) => !s.fecha.startsWith('2026-01-19'))
    const ultima = sesiones[sesiones.length - 1]!.fecha
    expect(esVuelta(sesiones, masTarde(ultima, 5))).toBe(true)
  })
})
