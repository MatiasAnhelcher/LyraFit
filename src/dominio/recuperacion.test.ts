import { describe, expect, it } from 'vitest'
import {
  CERCA_DEL_FALLO,
  UMBRAL_MISMO_DIA,
  VENTANA_CERCA_DEL_FALLO,
  disparadorAntesDeEmpezar,
  type DisparadorDeRecuperacion,
} from './recuperacion'
import type { DecisionGuardada, PasoDelBorrador, Patron, RegistroEjercicio, Serie, Sesion } from './tipos'

/**
 * La línea de recuperación es la única que habla antes de empezar, y lo que
 * más importa probar es lo que la volvería un reto: que hable en la primera
 * sesión del día, que se calle cuando repetís un mix entero, que diga "la
 * última vez" de una sesión que ya no fue la última, o que traiga algo que una
 * pantalla pueda pintar de ámbar.
 */

/** Miércoles 21 de octubre de 2026. */
const HOY = '2026-10-21'
const AYER = '2026-10-20'

/** Un instante de ese día, en la hora local de quien corre el test. */
const a = (fecha: string, h: number, m = 0) =>
  new Date(`${fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime()

const MINUTO = 60_000

type Registro = [ejercicioId: string, series: number, extra?: Partial<RegistroEjercicio>]

let siguiente = 0
/**
 * Una sesión que empezó a esa hora y duró media hora. Sin `iniciadaEn` en
 * `extra` queda con la de inicio; para una vieja, se pasa `iniciadaEn:
 * undefined`.
 */
function sesion(
  fecha: string,
  [h, m]: [number, number],
  registros: Registro[],
  extra: Partial<Sesion> = {},
): Sesion {
  siguiente++
  const iniciadaEn = a(fecha, h, m)
  return {
    id: `s${siguiente}`,
    fecha,
    iniciadaEn,
    finalizadaEn: iniciadaEn + 30 * MINUTO,
    duracionSegundos: 1800,
    tipo: 'plan',
    registros: registros.map(([ejercicioId, series, mas]) => ({
      ejercicioId,
      objetivo: { series, cantidad: 8 },
      series: Array.from({ length: series }, () => ({ logrado: 8 })),
      ...mas,
    })),
    ...extra,
  }
}

/** Las series de un registro, con las reservas anotadas en la última. */
const conReservas = (series: number, reservas: number): Serie[] =>
  Array.from({ length: series }, (_, i) => (i === series - 1 ? { logrado: 8, reservas } : { logrado: 8 }))

const paso = (ejercicioId: string, series: number, extra: Partial<PasoDelBorrador> = {}): PasoDelBorrador => ({
  ejercicioId,
  objetivo: { series, cantidad: 8 },
  ...extra,
})

/**
 * Un mix de pecho que le da 9 series al pectoral: la serie fácil de la
 * entrada (que no suma), el eslabón y dos fijos. El tríceps recibe 6: medio
 * por cada flexión y uno entero en la diamante.
 */
const MIX_DE_PECHO: PasoDelBorrador[] = [
  paso('flexion-rodillas', 1, { clase: 'fijo', seccion: 'entrada', calentamiento: true }),
  paso('flexion-completa', 3, { clase: 'cadena', seccion: 'principal' }),
  paso('flexion-inclinada-baja', 3, { clase: 'fijo', fijo: true, seccion: 'principal' }),
  paso('flexion-diamante', 3, { clase: 'fijo', fijo: true, seccion: 'principal' }),
]

/** El mismo mix, hecho: lo que queda en el historial. */
const MIX_DE_PECHO_HECHO: Registro[] = [
  ['flexion-rodillas', 1, { calentamiento: true }],
  ['flexion-completa', 3],
  ['flexion-inclinada-baja', 3, { fijo: true }],
  ['flexion-diamante', 3, { fijo: true }],
]

const MIX_DE_GLUTEOS: PasoDelBorrador[] = [
  paso('puente-gluteos', 3, { clase: 'cadena' }),
  paso('puente-una-pierna', 3, { clase: 'fijo', fijo: true }),
]

const REMOS: PasoDelBorrador[] = [paso('remo-australiano-medio', 6, { clase: 'cadena' })]

const decision = (patron: Patron, movimiento = 'sostiene'): DecisionGuardada => ({
  patron,
  movimiento,
  explicacion: 'Repetimos el mismo objetivo.',
  cambioDeNivel: false,
})

/** El resultado, sabiendo que no es `null`. */
function disparo(
  pasos: readonly PasoDelBorrador[],
  historial: readonly Sesion[],
  ahora: number,
): DisparadorDeRecuperacion {
  const resultado = disparadorAntesDeEmpezar(pasos, historial, ahora)
  if (resultado === null) throw new Error('Se esperaba un disparador y no hubo ninguno.')
  return resultado
}

describe('las constantes', () => {
  it('el umbral del mismo día es 11 series fraccionales', () => {
    expect(UMBRAL_MISMO_DIA).toBe(11)
  })

  it('cerca del fallo es 1 repetición o menos en reserva, en las últimas 24 horas', () => {
    expect(CERCA_DEL_FALLO).toBe(1)
    expect(VENTANA_CERCA_DEL_FALLO).toBe(24 * 60 * MINUTO)
  })
})

describe('A · grupos distintos: no dice nada', () => {
  it('después de un mix de pecho, uno de glúteos no trae ninguna línea', () => {
    const historial = [sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO)]
    expect(disparadorAntesDeEmpezar(MIX_DE_GLUTEOS, historial, a(HOY, 13, 30))).toBeNull()
  })

  it('tampoco si el otro grupo terminó cerca del fallo', () => {
    const historial = [
      sesion(HOY, [9, 10], [['flexion-completa', 3, { series: conReservas(3, 0) }]]),
    ]
    expect(disparadorAntesDeEmpezar(MIX_DE_GLUTEOS, historial, a(HOY, 13, 30))).toBeNull()
  })

  it('sin pasos que carguen algo no hay dato: nada', () => {
    const historial = [sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO)]
    const ahora = a(HOY, 19, 5)
    expect(disparadorAntesDeEmpezar([], historial, ahora)).toBeNull()
    expect(
      disparadorAntesDeEmpezar([paso('gato-vaca', 2, { clase: 'movilidad' })], historial, ahora),
    ).toBeNull()
    expect(disparadorAntesDeEmpezar([paso('no-existe', 3)], historial, ahora)).toBeNull()
  })
})

describe('B · un principal ya tiene series hoy y con esta pasa de 11', () => {
  it('repetir el mix de pecho avisa: 9 + 9 = 18', () => {
    const manana = sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO)
    const resultado = disparo(MIX_DE_PECHO, [manana], a(HOY, 19, 5))
    expect(resultado).toMatchObject({
      clase: 'B',
      musculo: 'pectoral',
      zona: 'pecho',
      seriesHoy: 9,
      conEsta: 18,
    })
  })

  it('el primero del día no avisa (9)', () => {
    expect(disparadorAntesDeEmpezar(MIX_DE_PECHO, [], a(HOY, 9, 10))).toBeNull()
    // Ni con el mismo mix ayer, si no terminó cerca del fallo.
    const ayer = sesion(AYER, [19, 0], MIX_DE_PECHO_HECHO)
    expect(disparadorAntesDeEmpezar(MIX_DE_PECHO, [ayer], a(HOY, 9, 10))).toBeNull()
  })

  it('en el borde: 9 + 2 = 11 no pasa de 11; 9 + 3 = 12 sí', () => {
    const historial = [sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO)]
    const ahora = a(HOY, 19, 5)
    expect(disparadorAntesDeEmpezar([paso('flexion-completa', 2)], historial, ahora)).toBeNull()
    expect(disparo([paso('flexion-completa', 3)], historial, ahora)).toMatchObject({
      clase: 'B',
      musculo: 'pectoral',
      seriesHoy: 9,
      conEsta: 12,
    })
  })

  it('una sesión sola de 15 no avisa: B habla de volver al músculo en el día', () => {
    const quince = Array.from({ length: 5 }, () => paso('flexion-completa', 3))
    expect(disparadorAntesDeEmpezar(quince, [], a(HOY, 9, 10))).toBeNull()
    // Un paso de pecho salteado a la mañana no deja series hoy.
    const salteado = sesion(HOY, [9, 10], [
      ['flexion-completa', 3, { series: [] }],
      ['puente-gluteos', 3],
    ])
    expect(disparadorAntesDeEmpezar(quince, [salteado], a(HOY, 19, 5))).toBeNull()
  })

  it('cuenta lo de hoy como el mapa: la serie de cierre suma; la entrada en calor y la movilidad no', () => {
    const series: Serie[] = [...conReservas(7, 2), { logrado: 10, cierre: true }]
    const historial = [
      sesion(HOY, [9, 10], [
        ['flexion-inclinada', 3, { calentamiento: true }],
        ['flexion-completa', 8, { series }],
      ]),
      sesion(HOY, [12, 0], [['flexion-completa', 4]], {
        tipo: 'fuelle',
        origen: { clase: 'movilidad', sector: 'pecho', nombre: 'Movilidad de pecho' },
      }),
    ]
    // Con la entrada en calor o la movilidad, hoy serían 11 o 12; sin la de
    // cierre, 7, y con esta no pasaría de 11.
    expect(disparo([paso('flexion-completa', 4)], historial, a(HOY, 19, 5))).toMatchObject({
      clase: 'B',
      seriesHoy: 8,
      conEsta: 12,
    })
  })

  it('lo que vas a empezar no cuenta la entrada en calor ni la movilidad', () => {
    const historial = [sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO)]
    const pasos = [
      paso('flexion-rodillas', 5, { calentamiento: true }),
      paso('apertura-de-pecho', 2, { clase: 'movilidad' }),
      paso('flexion-completa', 2),
    ]
    expect(disparadorAntesDeEmpezar(pasos, historial, a(HOY, 19, 5))).toBeNull()
  })

  it('una sesión que arrancó ayer a las 23:40 y cerró hoy a las 00:05 es de ayer', () => {
    const cruzada: Sesion = {
      ...sesion(AYER, [23, 40], MIX_DE_PECHO_HECHO),
      finalizadaEn: a(HOY, 0, 5),
    }
    expect(disparadorAntesDeEmpezar(MIX_DE_PECHO, [cruzada], a(HOY, 9, 10))).toBeNull()
  })

  it('nombra el principal con más series hoy entre los que pasan de 11', () => {
    // El tríceps también pasa (6 + 6 = 12), pero el pectoral tiene más hoy.
    const historial = [sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO)]
    expect(disparo(MIX_DE_PECHO, historial, a(HOY, 19, 5)).musculo).toBe('pectoral')
  })

  it('si el pectoral no tiene series hoy, nombra el tríceps, que sí', () => {
    const historial = [sesion(HOY, [9, 10], [['extension-triceps-barra', 8]])]
    expect(disparo(MIX_DE_PECHO, historial, a(HOY, 19, 5))).toMatchObject({
      clase: 'B',
      musculo: 'triceps',
      zona: 'brazos',
      seriesHoy: 8,
      conEsta: 14,
    })
  })

  it('la última es la sesión de hoy que cargó ese músculo, con la hora en que empezó', () => {
    const pecho = sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO)
    const gluteos = sesion(HOY, [13, 30], [['puente-gluteos', 3]])
    expect(disparo(MIX_DE_PECHO, [pecho, gluteos], a(HOY, 19, 5)).ultima).toEqual({
      sesionId: pecho.id,
      fecha: HOY,
      hora: a(HOY, 9, 10),
      esDeCierre: false,
    })
  })

  it('con dos sesiones de pecho hoy, la última es la más tarde', () => {
    const primera = sesion(HOY, [9, 10], [['flexion-completa', 3]])
    const segunda = sesion(HOY, [13, 30], [['flexion-completa', 3]])
    const resultado = disparo(MIX_DE_PECHO, [segunda, primera], a(HOY, 19, 5))
    expect(resultado).toMatchObject({ seriesHoy: 6, conEsta: 15 })
    expect(resultado.ultima.sesionId).toBe(segunda.id)
  })

  it('de una sesión vieja que no guardó cuándo empezó, da la hora de cierre y lo dice', () => {
    const vieja = sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO, { iniciadaEn: undefined })
    expect(disparo(MIX_DE_PECHO, [vieja], a(HOY, 19, 5)).ultima).toEqual({
      sesionId: vieja.id,
      fecha: HOY,
      hora: vieja.finalizadaEn,
      esDeCierre: true,
    })
  })

  it('R6: 10 de dorsal a la mañana y 4 más da 14, con las cadenas que ya se leyeron', () => {
    const manana = sesion(
      HOY,
      [9, 10],
      [
        ['remo-australiano-medio', 4],
        ['remo-australiano-bajo', 3, { fijo: true }],
        ['remo-australiano-alto', 3, { bajada: true }],
        ['flexion-completa', 3],
        ['sentadilla-banco', 3],
      ],
      { decisiones: [decision('traccion', 'subida'), decision('empuje'), decision('piernas')] },
    )
    // Un plan de los de antes, sin clase: lo que no es bajada sigue tu nivel.
    const pasos = [
      paso('remo-australiano-medio', 4),
      paso('flexion-completa', 3),
      paso('sentadilla-banco', 2, { bajada: true }),
    ]
    const resultado = disparo(pasos, [manana], a(HOY, 19, 5))
    expect(resultado).toMatchObject({
      clase: 'B',
      musculo: 'dorsal',
      zona: 'espalda',
      seriesHoy: 10,
      conEsta: 14,
    })
    expect(resultado.ultima.hora).toBe(a(HOY, 9, 10))
    // Piernas se leyó, pero acá va como bajada: no lee, así que no se nombra.
    expect(resultado.cadenasLeidas).toEqual([
      { patron: 'traccion', hora: manana.finalizadaEn },
      { patron: 'empuje', hora: manana.finalizadaEn },
    ])
  })

  it('una decisión neutra no es una lectura, y un fijo no lee aunque sea tu eslabón', () => {
    const manana = sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO, {
      decisiones: [decision('empuje', 'neutra')],
    })
    expect(disparo(MIX_DE_PECHO, [manana], a(HOY, 19, 5)).cadenasLeidas).toEqual([])

    const leida = sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO, { decisiones: [decision('empuje')] })
    const soloFijos = MIX_DE_PECHO.map(
      (p): PasoDelBorrador => (p.clase === 'cadena' ? { ...p, clase: 'fijo', fijo: true } : p),
    )
    expect(disparo(soloFijos, [leida], a(HOY, 19, 5)).cadenasLeidas).toEqual([])
    expect(disparo(MIX_DE_PECHO, [leida], a(HOY, 19, 5)).cadenasLeidas).toEqual([
      { patron: 'empuje', hora: leida.finalizadaEn },
    ])
  })
})

describe('C · la última vez del grupo fue cerca del fallo, en las últimas 24 h', () => {
  const remosDeAnoche = (reservas?: number) =>
    sesion(AYER, [21, 40], [
      [
        'remo-australiano-medio',
        3,
        reservas === undefined ? {} : { series: conReservas(3, reservas) },
      ],
    ])

  it('anoche a las 21:40 con una serie con 1 en reserva: lo dice, con el grupo y la hora', () => {
    const anoche = remosDeAnoche(1)
    expect(disparo(REMOS, [anoche], a(HOY, 19, 0))).toEqual({
      clase: 'C',
      zona: 'espalda',
      musculo: 'dorsal',
      seriesHoy: 0,
      conEsta: 6,
      ultima: { sesionId: anoche.id, fecha: AYER, hora: a(AYER, 21, 40), esDeCierre: false },
      cadenasLeidas: [],
    })
  })

  it('en el borde de 24 h: justo 24 h avisa; un minuto más, no', () => {
    const ahora = a(HOY, 21, 40)
    const terminada = (finalizadaEn: number): Sesion => ({
      ...remosDeAnoche(0),
      iniciadaEn: finalizadaEn - 30 * MINUTO,
      finalizadaEn,
    })
    expect(
      disparo(REMOS, [terminada(ahora - VENTANA_CERCA_DEL_FALLO)], ahora).clase,
    ).toBe('C')
    expect(
      disparadorAntesDeEmpezar(REMOS, [terminada(ahora - VENTANA_CERCA_DEL_FALLO - MINUTO)], ahora),
    ).toBeNull()
  })

  it('con 2 en reserva, o sin reservas anotadas, no dice nada', () => {
    const ahora = a(HOY, 19, 0)
    expect(disparadorAntesDeEmpezar(REMOS, [remosDeAnoche(2)], ahora)).toBeNull()
    expect(disparadorAntesDeEmpezar(REMOS, [remosDeAnoche()], ahora)).toBeNull()
  })

  it('la serie cerca del fallo tiene que ser del grupo', () => {
    const anoche = sesion(AYER, [21, 40], [
      ['remo-australiano-medio', 3],
      ['curl-barra', 3, { series: conReservas(3, 0) }],
    ])
    expect(disparadorAntesDeEmpezar(REMOS, [anoche], a(HOY, 19, 0))).toBeNull()
  })

  it('si salta B no se mira C', () => {
    const manana = sesion(HOY, [9, 10], [
      ['remo-australiano-medio', 6, { series: conReservas(6, 0) }],
    ])
    expect(disparo(REMOS, [manana], a(HOY, 19, 0))).toMatchObject({
      clase: 'B',
      musculo: 'dorsal',
      seriesHoy: 6,
      conEsta: 12,
    })
  })

  it('si B no salta, C sí, aunque la serie sea de hoy', () => {
    const manana = sesion(HOY, [9, 10], [
      ['remo-australiano-medio', 3, { series: conReservas(3, 0) }],
    ])
    expect(disparo(REMOS, [manana], a(HOY, 13, 0))).toMatchObject({
      clase: 'C',
      zona: 'espalda',
      seriesHoy: 3,
      conEsta: 9,
      ultima: { sesionId: manana.id, fecha: HOY, hora: a(HOY, 9, 10) },
    })
  })

  it('si después hubo otra sesión del grupo sin una serie así, la última vez ya no es esa: nada', () => {
    const historial = [
      remosDeAnoche(0),
      sesion(HOY, [9, 10], [['remo-australiano-medio', 3]]),
    ]
    expect(disparadorAntesDeEmpezar(REMOS, historial, a(HOY, 13, 0))).toBeNull()
  })

  it('con dos grupos posibles, nombra el que más trabaja lo que vas a empezar', () => {
    // La diamante carga pectoral y tríceps: Pecho y Brazos tuvieron su última
    // vez anoche, cerca del fallo. El mix de pecho trabaja más el pectoral.
    const anoche = sesion(AYER, [21, 40], [
      ['flexion-diamante', 3, { series: conReservas(3, 0) }],
    ])
    expect(disparo(MIX_DE_PECHO, [anoche], a(HOY, 19, 0))).toMatchObject({
      clase: 'C',
      zona: 'pecho',
      musculo: 'pectoral',
      conEsta: 9,
    })
  })
})

describe('nunca devuelve un nivel de alarma', () => {
  it('trae la cifra, la hora y el nombre, y nada que se pueda pintar', () => {
    const anoche = sesion(AYER, [21, 40], [
      ['flexion-diamante', 3, { series: conReservas(3, 0) }],
      ['remo-australiano-medio', 3, { series: conReservas(3, 1) }],
    ])
    const manana = sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO, { decisiones: [decision('empuje')] })
    const casos = [
      disparadorAntesDeEmpezar(MIX_DE_PECHO, [manana], a(HOY, 19, 5)),
      disparadorAntesDeEmpezar(MIX_DE_PECHO, [anoche], a(HOY, 19, 0)),
      disparadorAntesDeEmpezar(REMOS, [anoche], a(HOY, 19, 0)),
      disparadorAntesDeEmpezar(MIX_DE_GLUTEOS, [anoche, manana], a(HOY, 19, 5)),
    ]
    const hubo = casos.filter((c): c is DisparadorDeRecuperacion => c !== null)
    expect(hubo.map((c) => c.clase)).toEqual(['B', 'C', 'C'])
    for (const resultado of hubo) {
      expect(Object.keys(resultado).sort()).toEqual([
        'cadenasLeidas',
        'clase',
        'conEsta',
        'musculo',
        'seriesHoy',
        'ultima',
        'zona',
      ])
      expect(Object.keys(resultado.ultima).sort()).toEqual(['esDeCierre', 'fecha', 'hora', 'sesionId'])
      expect(['B', 'C']).toContain(resultado.clase)
      expect(JSON.stringify(resultado)).not.toMatch(/ambar|ámbar|rojo|alarma|alerta|nivel|grave|riesgo/i)
    }
  })

  it('es pura: no toca lo que recibe y con lo mismo da lo mismo', () => {
    const congelar = <T>(valor: T): T => {
      if (valor && typeof valor === 'object') {
        for (const v of Object.values(valor)) congelar(v)
        Object.freeze(valor)
      }
      return valor
    }
    const historial = congelar([
      sesion(HOY, [9, 10], MIX_DE_PECHO_HECHO, { decisiones: [decision('empuje')] }),
    ])
    const pasos = congelar(MIX_DE_PECHO.map((p) => ({ ...p, objetivo: { ...p.objetivo } })))
    const ahora = a(HOY, 19, 5)
    const primero = disparadorAntesDeEmpezar(pasos, historial, ahora)
    expect(primero).not.toBeNull()
    expect(disparadorAntesDeEmpezar(pasos, historial, ahora)).toEqual(primero)
  })
})
