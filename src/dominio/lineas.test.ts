import { describe, expect, it } from 'vitest'
import { EJERCICIOS, REQUISITOS, cadenaDe } from './biblioteca'
import { requisitosSinCumplir, type RequisitoDelCatalogo } from './catalogo'
import { equipoDe } from './equipo'
import { ajusteDelDia } from './estado'
import {
  DERIVACION,
  LARGO_DE_LINEA,
  RECUPERACION_CON_FUENTE,
  arribaDeTuNivel,
  horaDicha,
  lineaAMedias,
  lineaArribaDeTuNivel,
  lineaCambiado,
  lineaDeBorrador,
  lineaDeCambios,
  lineaDeEquipo,
  lineaDeMolestia,
  lineaDeNivel,
  lineaDeRecuperacion,
  lineaDeRequisito,
  lineaDeSeguridad,
  lineaDeVolumen,
  lineaDelChequeo,
  lineaDelDia,
  lineaDelTecho,
  lineaLiviana,
  lineaSinCadenas,
  lineaUltimaVez,
  lineaYaLeida,
  type AvancesPorCadena,
} from './lineas'
import { pasosConMolestia } from './molestia'
import type { Musculo } from './musculos'
import { loProhibido } from './palabras'
import { disparadorAntesDeEmpezar, type DisparadorDeRecuperacion } from './recuperacion'
import { ultimaVezDeZona, zonaSinSeries, type Zona } from './sectores'
import type {
  CambioEnSesion,
  DecisionGuardada,
  Ejercicio,
  PasoDelBorrador,
  Patron,
  RegistroEjercicio,
  Serie,
  Sesion,
  SesionEnCurso,
} from './tipos'

/** Un instante del 21/10/2026 a esta hora, en la hora local de quien corre el test. */
const a = (h: number, m: number) => new Date(2026, 9, 21, h, m).getTime()

describe('la hora, como se dice', () => {
  it('en 24 h y sin cero adelante de la hora', () => {
    expect(horaDicha(a(9, 10))).toBe('9:10')
    expect(horaDicha(a(19, 5))).toBe('19:05')
    expect(horaDicha(a(0, 0))).toBe('0:00')
  })
})

describe('ya se leyó hoy', () => {
  it('una cadena', () => {
    expect(lineaYaLeida([{ patron: 'empuje', hora: a(9, 10) }])).toBe(
      'Empuje ya se leyó hoy a las 9:10: esta sesión sumó volumen.',
    )
  })

  it('varias a la misma hora, juntas y en plural', () => {
    expect(
      lineaYaLeida([
        { patron: 'traccion', hora: a(9, 10) },
        { patron: 'empuje', hora: a(9, 10) },
        { patron: 'piernas', hora: a(9, 10) },
        { patron: 'core', hora: a(9, 10) },
      ]),
    ).toBe('Tracción, empuje, piernas y core ya se leyeron hoy a las 9:10: esta sesión sumó volumen.')
  })

  it('a distintas horas, cada una con la suya y en el orden en que se leyeron', () => {
    expect(
      lineaYaLeida([
        { patron: 'bisagra', hora: a(13, 30) },
        { patron: 'empuje', hora: a(9, 10) },
      ]),
    ).toBe('Empuje se leyó hoy a las 9:10 y bisagra a las 13:30: esta sesión sumó volumen.')
  })

  it('con dos cadenas en un mismo tramo, la coma separa los tramos', () => {
    expect(
      lineaYaLeida([
        { patron: 'empuje', hora: a(9, 10) },
        { patron: 'bisagra', hora: a(13, 30) },
        { patron: 'core', hora: a(13, 30) },
      ]),
    ).toBe('Empuje se leyó hoy a las 9:10, y bisagra y core a las 13:30: esta sesión sumó volumen.')
  })

  it('la misma cadena dos veces se dice una sola', () => {
    expect(
      lineaYaLeida([
        { patron: 'empuje', hora: a(9, 10) },
        { patron: 'empuje', hora: a(13, 30) },
      ]),
    ).toBe('Empuje ya se leyó hoy a las 9:10: esta sesión sumó volumen.')
  })

  it('a la una, en singular', () => {
    expect(lineaYaLeida([{ patron: 'empuje', hora: a(1, 20) }])).toBe(
      'Empuje ya se leyó hoy a la 1:20: esta sesión sumó volumen.',
    )
    expect(
      lineaYaLeida([
        { patron: 'empuje', hora: a(0, 40) },
        { patron: 'core', hora: a(1, 5) },
      ]),
    ).toBe('Empuje se leyó hoy a las 0:40 y core a la 1:05: esta sesión sumó volumen.')
  })

  it('una sesión de otro día no dice "hoy"', () => {
    // Arrancó a las 23:40 y cierra a las 00:05: es del día de antes.
    expect(lineaYaLeida([{ patron: 'empuje', hora: a(9, 10) }], { esHoy: false })).toBe(
      'Empuje ya se había leído ese día a las 9:10: esta sesión sumó volumen.',
    )
    expect(
      lineaYaLeida(
        [
          { patron: 'empuje', hora: a(9, 10) },
          { patron: 'core', hora: a(9, 10) },
          { patron: 'bisagra', hora: a(13, 30) },
        ],
        { esHoy: false },
      ),
    ).toBe(
      'Empuje y core se habían leído ese día a las 9:10, y bisagra a las 13:30: esta sesión sumó volumen.',
    )
  })

  it('sin cadenas leídas no hay línea', () => {
    expect(lineaYaLeida([])).toBeNull()
  })

  it('las cinco cadenas a cinco horas distintas entran en 140', () => {
    const patrones: Patron[] = ['traccion', 'empuje', 'piernas', 'bisagra', 'core']
    const linea = lineaYaLeida(patrones.map((patron, i) => ({ patron, hora: a(10 + 2 * i, 20) })))
    expect(linea).not.toBeNull()
    expect(linea!.length).toBeLessThanOrEqual(140)
  })
})

describe('sin pasos que sigan tu nivel', () => {
  it('lo dice solo cuando es cierto', () => {
    expect(lineaSinCadenas({ tipo: 'fuelle', pasosDeCadena: 0 })).toBe(
      'Esta sesión no tenía pasos que sigan tu nivel: tus cadenas quedan como estaban.',
    )
  })

  it('con pasos de cadena sin hacer no hubo nada que leer, y no dice nada', () => {
    expect(lineaSinCadenas({ tipo: 'plan', pasosDeCadena: 4 })).toBeNull()
  })

  it('el reloj no habla del motor', () => {
    expect(lineaSinCadenas({ tipo: 'reloj', pasosDeCadena: 0 })).toBeNull()
  })
})

describe('un paso de cadena cambiado', () => {
  it('una cadena y varias', () => {
    expect(lineaCambiado(['empuje'])).toBe('Empuje queda como estaba: hoy hiciste otro ejercicio.')
    expect(lineaCambiado(['empuje', 'traccion'])).toBe(
      'Empuje y tracción quedan como estaban: hoy hiciste otros ejercicios.',
    )
    expect(lineaCambiado([])).toBeNull()
  })
})

describe('la versión liviana', () => {
  it('se dice solo cuando lo es', () => {
    expect(lineaLiviana(true)).toBe('La versión liviana suma volumen y no mueve tus cadenas.')
    expect(lineaLiviana(false)).toBeNull()
  })
})

describe('a medias', () => {
  it('de hoy, dice que se puede leer hoy', () => {
    expect(lineaAMedias({ patrones: ['empuje'], esHoy: true })).toBe(
      'Empuje quedó a medias: no se movió y se puede leer hoy.',
    )
    expect(lineaAMedias({ patrones: ['empuje', 'traccion'], esHoy: true })).toBe(
      'Empuje y tracción quedaron a medias: no se movieron y se pueden leer hoy.',
    )
  })

  it('de otro día, no promete nada de un día que ya pasó', () => {
    expect(lineaAMedias({ patrones: ['empuje'], esHoy: false })).toBe(
      'Empuje quedó a medias: no se movió.',
    )
  })

  it('sin cadenas, no hay línea', () => {
    expect(lineaAMedias({ patrones: [], esHoy: true })).toBeNull()
  })
})

describe('las reglas de la voz, en todas', () => {
  const todas = [
    lineaYaLeida([{ patron: 'empuje', hora: a(9, 10) }]),
    lineaYaLeida([
      { patron: 'traccion', hora: a(9, 10) },
      { patron: 'bisagra', hora: a(13, 30) },
      { patron: 'core', hora: a(19, 5) },
    ]),
    lineaYaLeida(
      [
        { patron: 'traccion', hora: a(1, 10) },
        { patron: 'bisagra', hora: a(13, 30) },
        { patron: 'core', hora: a(19, 5) },
      ],
      { esHoy: false },
    ),
    lineaSinCadenas({ tipo: 'fuelle', pasosDeCadena: 0 }),
    lineaCambiado(['empuje', 'traccion', 'piernas']),
    lineaLiviana(true),
    lineaAMedias({ patrones: ['traccion', 'empuje', 'piernas', 'bisagra', 'core'], esHoy: true }),
  ].filter((l): l is string => l !== null)

  it('nada de lo prohibido, 140 como mucho, sin exclamación', () => {
    for (const linea of todas) {
      expect(loProhibido(linea), linea).toBeNull()
      expect(linea.length, linea).toBeLessThanOrEqual(140)
      expect(linea, linea).not.toMatch(/[!¡]/)
    }
  })

  it('con la llave apagada, ninguna afirma nada del cuerpo', () => {
    expect(RECUPERACION_CON_FUENTE).toBe(false)
    const delCuerpo = /recuper|descans|fatiga|lesi|músculo|crecimiento|esperable/i
    for (const linea of todas) expect(linea, linea).not.toMatch(delCuerpo)
  })
})

// ═══ R2 · Las líneas del centro ═══════════════════════════════════════════

/** Miércoles 21 de octubre de 2026: el día de `a`. */
const HOY = '2026-10-21'
const AYER = '2026-10-20'
const MINUTO = 60_000

/** Un instante de cualquier día, en la hora local de quien corre el test. */
const en = (fecha: string, h: number, m = 0) =>
  new Date(`${fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime()

type Registro = [ejercicioId: string, series: number, extra?: Partial<RegistroEjercicio>]

let siguienteId = 0
/**
 * Una sesión que empezó a esa hora y duró media hora. Para una vieja, sin
 * hora de inicio, se pasa `iniciadaEn: undefined` en `extra`.
 */
function sesion(
  fecha: string,
  [h, m]: [number, number],
  registros: Registro[],
  extra: Partial<Sesion> = {},
): Sesion {
  siguienteId++
  const iniciadaEn = en(fecha, h, m)
  return {
    id: `s${String(siguienteId).padStart(3, '0')}`,
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

/** Una movilidad: se guarda como fuelle, sin registros, con su origen. */
const movilidad = (fecha: string, hora: [number, number]): Sesion =>
  sesion(fecha, hora, [], {
    tipo: 'fuelle',
    origen: { clase: 'movilidad', sector: 'pecho', nombre: 'Movilidad de pecho' },
  })

const paso = (
  ejercicioId: string,
  series: number,
  cantidad = 8,
  extra: Partial<PasoDelBorrador> = {},
): PasoDelBorrador => ({ ejercicioId, objetivo: { series, cantidad }, ...extra })

/** Los avances, con cada cadena en el eslabón `n` (contando desde 1). */
const avancesEn = (lugares: Partial<Record<Patron, number>>): AvancesPorCadena =>
  new Map(
    Object.entries(lugares).map(([patron, n]) => {
      const id = cadenaDe(patron as Patron).ejercicios[n - 1]
      if (!id) throw new Error(`No hay eslabón ${n} en ${patron}.`)
      return [patron as Patron, { ejercicioId: id }] as const
    }),
  )

const ejercicio = (id: string): Ejercicio => {
  const encontrado = EJERCICIOS.find((e) => e.id === id)
  if (!encontrado) throw new Error(`No existe ${id}.`)
  return encontrado
}

/** Un disparador B como lo da `disparadorAntesDeEmpezar`. */
const enB = (extra: Partial<Extract<DisparadorDeRecuperacion, { clase: 'B' }>> = {}): DisparadorDeRecuperacion => ({
  clase: 'B',
  musculo: 'dorsal',
  zona: 'espalda',
  seriesHoy: 10,
  conEsta: 14,
  ultima: { sesionId: 's1', fecha: HOY, hora: a(9, 10), esDeCierre: false },
  cadenasLeidas: [],
  ...extra,
})

/** Un disparador C: la última vez de Espalda, ayer a las 21:40. */
const enC = (extra: Partial<Extract<DisparadorDeRecuperacion, { clase: 'C' }>> = {}): DisparadorDeRecuperacion => ({
  clase: 'C',
  musculo: 'dorsal',
  zona: 'espalda',
  seriesHoy: 0,
  conEsta: 6,
  ultima: { sesionId: 's2', fecha: AYER, hora: en(AYER, 21, 40), esDeCierre: false },
  cadenasLeidas: [],
  ...extra,
})

describe('la línea de recuperación', () => {
  it('sin disparador no hay línea: A no dice nada', () => {
    expect(lineaDeRecuperacion(null, HOY)).toBeNull()
  })

  it('B: el músculo, sus series de hoy, la hora de la última y con esta', () => {
    expect(lineaDeRecuperacion(enB(), HOY)).toEqual({
      dato: 'Dorsal: 10 series hoy, la última a las 9:10; con esta, 14.',
      cadenas: null,
      conFuente: null,
    })
  })

  it('B redondea como Progreso, y una serie es una serie', () => {
    expect(lineaDeRecuperacion(enB({ seriesHoy: 9.5, conEsta: 13.5 }), HOY)?.dato).toBe(
      'Dorsal: 10 series hoy, la última a las 9:10; con esta, 14.',
    )
    expect(lineaDeRecuperacion(enB({ seriesHoy: 1, conEsta: 12 }), HOY)?.dato).toBe(
      'Dorsal: 1 serie hoy, la última a las 9:10; con esta, 12.',
    )
  })

  it('B con cadenas ya leídas lo dice aparte, en singular y en plural', () => {
    const una = lineaDeRecuperacion(enB({ cadenasLeidas: [{ patron: 'traccion', hora: a(9, 40) }] }), HOY)
    expect(una?.cadenas).toBe('Tracción ya se leyó hoy: esta sesión suma volumen y no la mueve.')
    const varias = lineaDeRecuperacion(
      enB({
        cadenasLeidas: [
          { patron: 'traccion', hora: a(9, 40) },
          { patron: 'empuje', hora: a(9, 40) },
          { patron: 'traccion', hora: a(9, 40) },
        ],
      }),
      HOY,
    )
    expect(varias?.cadenas).toBe(
      'Tracción y empuje ya se leyeron hoy: esta sesión suma volumen y no las mueve.',
    )
  })

  it('B con la hora de cierre de una sesión vieja la dice como cierre', () => {
    const vieja = enB({ ultima: { sesionId: 's1', fecha: HOY, hora: a(9, 34), esDeCierre: true } })
    expect(lineaDeRecuperacion(vieja, HOY)?.dato).toBe(
      'Dorsal: 10 series hoy, la última, cerrada a las 9:34; con esta, 14.',
    )
  })

  it('B de una sesión que no es de hoy no dice "hoy"', () => {
    const deAyer = enB({ ultima: { sesionId: 's1', fecha: AYER, hora: en(AYER, 9, 10), esDeCierre: false } })
    expect(lineaDeRecuperacion(deAyer, HOY)).toBeNull()
  })

  it('C: el grupo, cuándo fue la última vez y la serie cerca del fallo', () => {
    expect(lineaDeRecuperacion(enC(), HOY)).toEqual({
      dato: 'Espalda: la última vez fue ayer a las 21:40, con una serie con 1 repetición o menos en reserva.',
      cadenas: null,
      conFuente: null,
    })
  })

  it('C de hoy, a la una y de una sesión vieja', () => {
    const deHoy = enC({ ultima: { sesionId: 's2', fecha: HOY, hora: a(1, 20), esDeCierre: false } })
    expect(lineaDeRecuperacion(deHoy, HOY)?.dato).toBe(
      'Espalda: la última vez fue hoy a la 1:20, con una serie con 1 repetición o menos en reserva.',
    )
    const vieja = enC({ ultima: { sesionId: 's2', fecha: AYER, hora: en(AYER, 21, 40), esDeCierre: true } })
    expect(lineaDeRecuperacion(vieja, HOY)?.dato).toBe(
      'Espalda: la última vez fue ayer, cerrada a las 21:40, con una serie con 1 repetición o menos en reserva.',
    )
  })

  it('C de un día que todavía no llegó no se dice', () => {
    const futura = enC({ ultima: { sesionId: 's2', fecha: '2026-10-22', hora: en('2026-10-22', 8), esDeCierre: false } })
    expect(lineaDeRecuperacion(futura, HOY)).toBeNull()
  })

  it('con la llave prendida suma la frase con fuente; apagada, nada', () => {
    expect(RECUPERACION_CON_FUENTE).toBe(false)
    expect(lineaDeRecuperacion(enB(), HOY, { conFuente: true })?.conFuente).toBe(
      'Si la hacés, esperá menos repeticiones.',
    )
    expect(lineaDeRecuperacion(enC(), HOY, { conFuente: true })?.conFuente).toBe(
      'Si hoy sale menos, es esperable.',
    )
    expect(lineaDeRecuperacion(enC(), HOY)?.conFuente).toBeNull()
  })

  describe('con lo que da `disparadorAntesDeEmpezar`', () => {
    const MIX_DE_PECHO: PasoDelBorrador[] = [
      paso('flexion-rodillas', 1, 8, { clase: 'fijo', seccion: 'entrada', calentamiento: true }),
      paso('flexion-completa', 3, 8, { clase: 'cadena' }),
      paso('flexion-inclinada-baja', 3, 8, { clase: 'fijo', fijo: true }),
      paso('flexion-diamante', 3, 8, { clase: 'fijo', fijo: true }),
    ]
    const HECHO: Registro[] = [
      ['flexion-rodillas', 1, { calentamiento: true }],
      ['flexion-completa', 3],
      ['flexion-inclinada-baja', 3, { fijo: true }],
      ['flexion-diamante', 3, { fijo: true }],
    ]
    const leyoEmpuje: DecisionGuardada = {
      patron: 'empuje',
      movimiento: 'sostiene',
      explicacion: 'Repetimos el mismo objetivo.',
      cambioDeNivel: false,
    }

    it('repetir el mix de pecho: 9 + 9, y empuje ya leído', () => {
      const historial = [sesion(HOY, [9, 10], HECHO, { decisiones: [leyoEmpuje] })]
      const disparador = disparadorAntesDeEmpezar(MIX_DE_PECHO, historial, a(19, 0))
      expect(lineaDeRecuperacion(disparador, HOY)).toEqual({
        dato: 'Pectoral: 9 series hoy, la última a las 9:10; con esta, 18.',
        cadenas: 'Empuje ya se leyó hoy: esta sesión suma volumen y no la mueve.',
        conFuente: null,
      })
    })

    it('el primero del día no dice nada', () => {
      expect(lineaDeRecuperacion(disparadorAntesDeEmpezar(MIX_DE_PECHO, [], a(9, 0)), HOY)).toBeNull()
    })

    it('remos hoy después de una serie cerca del fallo anoche', () => {
      const conReservas: Serie[] = [{ logrado: 8 }, { logrado: 8 }, { logrado: 6, reservas: 1 }]
      const historial = [sesion(AYER, [21, 40], [['remo-australiano-medio', 3, { series: conReservas }]])]
      const disparador = disparadorAntesDeEmpezar(
        [paso('remo-australiano-medio', 3, 8, { clase: 'cadena' })],
        historial,
        a(19, 0),
      )
      expect(lineaDeRecuperacion(disparador, HOY)?.dato).toBe(
        'Espalda: la última vez fue ayer a las 21:40, con una serie con 1 repetición o menos en reserva.',
      )
    })
  })
})

describe('el volumen de un músculo en el Constructor', () => {
  const series = (pares: [Musculo, number][]) => new Map<Musculo, number>(pares)

  it('solo si alguno pasa de 11', () => {
    expect(lineaDeVolumen(series([['pectoral', 11], ['triceps', 6]]))).toBeNull()
    expect(lineaDeVolumen(series([]))).toBeNull()
    expect(lineaDeVolumen(series([['pectoral', 11.5]]))?.dato).toBe('Pectoral: 12 series en esta rutina.')
  })

  it('nombra el que más tiene, y con las mismas el que va primero en pantalla', () => {
    expect(lineaDeVolumen(series([['triceps', 12], ['pectoral', 14]]))).toEqual({
      dato: 'Pectoral: 14 series en esta rutina.',
      conFuente: null,
    })
    expect(lineaDeVolumen(series([['triceps', 14], ['pectoral', 14]]))?.dato).toBe(
      'Pectoral: 14 series en esta rutina.',
    )
  })

  it('con la llave prendida suma lo que dice el preprint, que no tiene revisión', () => {
    expect(lineaDeVolumen(series([['pectoral', 14]]), { conFuente: true })?.conFuente).toBe(
      'Un análisis todavía sin revisión por pares estima que, pasadas unas 11 por sesión, cada serie suma poco.',
    )
  })
})

describe('el nivel', () => {
  /** Una variante de la ola 1, como la va a escribir C1: ≈ empuje 6. */
  const flexionPica = { id: 'flexion-pica', patron: 'empuje', equivale: { patron: 'empuje', nivel: 6 } } as const

  it('cuántos eslabones arriba: un eslabón por su lugar, una variante por su equivale', () => {
    const avances = avancesEn({ empuje: 4, piernas: 2 })
    expect(arribaDeTuNivel(ejercicio('flexion-completa'), avances)).toEqual({ patron: 'empuje', eslabones: 2 })
    expect(arribaDeTuNivel(flexionPica, avances)).toEqual({ patron: 'empuje', eslabones: 2 })
    expect(arribaDeTuNivel(ejercicio('flexion-inclinada-baja'), avances)).toBeNull()
    expect(arribaDeTuNivel(ejercicio('flexion-pared'), avances)).toBeNull()
    expect(arribaDeTuNivel(ejercicio('remo-australiano-bajo'), avances)).toBeNull()
    expect(arribaDeTuNivel(ejercicio('press-militar-barra'), avances)).toBeNull()
  })

  it('"Está dos eslabones arriba de tu empuje.", en palabras y con su número', () => {
    const avances = avancesEn({ empuje: 4, piernas: 2, bisagra: 1 })
    expect(lineaArribaDeTuNivel(ejercicio('flexion-completa'), avances)).toBe(
      'Está dos eslabones arriba de tu empuje.',
    )
    expect(lineaArribaDeTuNivel(ejercicio('flexion-rodillas'), avances)).toBe(
      'Está un eslabón arriba de tu empuje.',
    )
    expect(lineaArribaDeTuNivel(ejercicio('zancada'), avances)).toBe('Está dos eslabones arriba de tus piernas.')
    expect(lineaArribaDeTuNivel(ejercicio('puente-una-pierna-elevado'), avances)).toBe(
      'Está cuatro eslabones arriba de tu bisagra.',
    )
    expect(lineaArribaDeTuNivel(ejercicio('flexion-inclinada'), avances)).toBeNull()
  })

  it('la Ficha dice el nivel; la variante, cómo se elige; y si está arriba, cuánto', () => {
    expect(lineaDeNivel(ejercicio('flexion-pared'))).toBe('Nivel I.')
    expect(lineaDeNivel(ejercicio('flexion-diamante'))).toBe('Nivel II.')
    expect(lineaDeNivel(ejercicio('flexion-una-mano'))).toBe('Nivel III.')
    expect(lineaDeNivel(flexionPica)).toBe('Nivel II. Se elige como el eslabón 6 de empuje.')
    expect(lineaDeNivel(flexionPica, avancesEn({ empuje: 4 }))).toBe(
      'Nivel II. Se elige como el eslabón 6 de empuje. Está dos eslabones arriba de tu empuje.',
    )
    expect(lineaDeNivel(flexionPica, avancesEn({ empuje: 6 }))).toBe(
      'Nivel II. Se elige como el eslabón 6 de empuje.',
    )
  })

  it('un accesorio dice su grado y no se compara con ninguna cadena', () => {
    const accesorio = { id: 'aperturas-banda', patron: 'empuje', grado: 3, accesorio: true } as const
    expect(lineaDeNivel(accesorio, avancesEn({ empuje: 1 }))).toBe('Nivel III.')
  })
})

describe('la seguridad, la primera vez', () => {
  it('la primera vez, con el primer error de la ficha y su rótulo', () => {
    expect(lineaDeSeguridad(ejercicio('flexion-diamante'), { primeraVez: true })).toBe(
      'Primera vez con Flexiones diamante. Error común: poner las manos muy adelante y cargar los hombros.',
    )
  })

  it('arriba de tu nivel sin ser la primera vez, lo dice así', () => {
    expect(
      lineaDeSeguridad(ejercicio('flexion-diamante'), { primeraVez: false, avances: avancesEn({ empuje: 5 }) }),
    ).toBe('Flexiones diamante están arriba de tu empuje. Error común: poner las manos muy adelante y cargar los hombros.')
  })

  it('el verbo va con el número del nombre: "están" con uno plural, "está" con uno singular', () => {
    const abajo = avancesEn({ empuje: 1, traccion: 1, piernas: 1, core: 1, bisagra: 1 })
    const empieza = (id: string) =>
      lineaDeSeguridad(ejercicio(id), { primeraVez: false, avances: abajo })?.split('. Error común:')[0]
    expect(empieza('dominada-negativa')).toBe('Dominadas negativas están arriba de tu tracción')
    expect(empieza('sentadilla-completa')).toBe('Sentadillas completas están arriba de tus piernas')
    expect(empieza('zancada')).toBe('Zancadas están arriba de tus piernas')
    expect(empieza('flexion-arquera')).toBe('Flexiones arqueras están arriba de tu empuje')
    expect(empieza('sentadilla-bulgara')).toBe('Sentadilla búlgara está arriba de tus piernas')
    expect(empieza('remo-australiano-bajo')).toBe('Remo australiano bajo está arriba de tu tracción')
    expect(empieza('plancha-brazo-alternado')).toBe('Plancha con brazo alternado está arriba de tu core')
    expect(empieza('curl-nordico')).toBe('Curl nórdico está arriba de tu bisagra')
  })

  it('cada nombre de la biblioteca arriba de tu nivel lleva el verbo en su número', () => {
    // Los plurales de hoy, uno por uno. Un ejercicio nuevo cuyo nombre
    // empiece con otra palabra en plural tiene que sumarse acá: así alguien
    // mira su número antes de que la línea lo diga.
    const PLURALES = new Set(['Flexiones', 'Dominadas', 'Sentadillas', 'Zancadas'])
    const abajo = avancesEn({ empuje: 1, traccion: 1, piernas: 1, core: 1, bisagra: 1 })
    let plurales = 0
    let singulares = 0
    for (const e of EJERCICIOS) {
      const linea = lineaDeSeguridad(e, { primeraVez: false, avances: abajo })
      if (linea === null) continue
      const plural = PLURALES.has(e.nombre.split(' ')[0]!)
      if (plural) plurales++
      else singulares++
      expect(linea, e.id).toMatch(new RegExp(`^${e.nombre} ${plural ? 'están' : 'está'} arriba de `))
    }
    // Que la vuelta haya pasado por los dos números.
    expect(plurales).toBeGreaterThan(10)
    expect(singulares).toBeGreaterThan(10)
  })

  it('ni primera vez ni arriba de tu nivel: no hay línea', () => {
    expect(lineaDeSeguridad(ejercicio('flexion-diamante'), { primeraVez: false })).toBeNull()
    expect(
      lineaDeSeguridad(ejercicio('flexion-diamante'), { primeraVez: false, avances: avancesEn({ empuje: 7 }) }),
    ).toBeNull()
  })

  it('si el error no entra, va sin su explicación; si ninguno entra, no hay línea', () => {
    const base = { id: 'x', nombre: 'Remo australiano con pies elevados', patron: 'traccion' } as const
    const largo = 'Elegir un apoyo tan alto que la cadera se quiebra sola y no hay forma de sostener la línea nunca.'
    expect(
      lineaDeSeguridad(
        { ...base, erroresComunes: ['Forzar la muñeca y apoyarse en ella con todo el peso del cuerpo encima. Si molesta, hacelas sobre los puños o sobre agarres.'] },
        { primeraVez: true },
      ),
    ).toBe(
      'Primera vez con Remo australiano con pies elevados. Error común: forzar la muñeca y apoyarse en ella con todo el peso del cuerpo encima.',
    )
    expect(
      lineaDeSeguridad(
        { ...base, erroresComunes: ['Dar un paso corto: la rodilla de adelante queda muy volcada sobre el pie y ahí aparece la molestia.'] },
        { primeraVez: true },
      ),
    ).toBe('Primera vez con Remo australiano con pies elevados. Error común: dar un paso corto.')
    expect(
      lineaDeSeguridad({ ...base, erroresComunes: [largo, 'Cortar el recorrido arriba.'] }, { primeraVez: true }),
    ).toBe('Primera vez con Remo australiano con pies elevados. Error común: cortar el recorrido arriba.')
    expect(lineaDeSeguridad({ ...base, erroresComunes: [largo] }, { primeraVez: true })).toBeNull()
    expect(lineaDeSeguridad({ ...base, erroresComunes: [] }, { primeraVez: true })).toBeNull()
  })

  it('cada ficha de la biblioteca tiene su línea, y entra en 140', () => {
    for (const e of EJERCICIOS) {
      const linea = lineaDeSeguridad(e, { primeraVez: true })
      expect(linea, e.id).not.toBeNull()
      expect(linea!.length, e.id).toBeLessThanOrEqual(LARGO_DE_LINEA)
      expect(linea, e.id).toMatch(new RegExp(`^Primera vez con ${e.nombre}\\. Error común: \\p{Ll}`, 'u'))
    }
  })
})

describe('el equipo en la Ficha', () => {
  const CON_LO_DADO = equipoDe({})

  it('lo que pide, y nada más si lo tenés', () => {
    expect(lineaDeEquipo({ equipo: ['barra'] }, CON_LO_DADO)).toBe('Pide: barra fija.')
    expect(lineaDeEquipo({ equipo: ['banda'] }, equipoDe({ tieneBanda: true }))).toBe('Pide: banda elástica.')
    expect(lineaDeEquipo({ equipo: ['silla'] }, CON_LO_DADO)).toBe('Pide: silla o banco.')
  })

  it('lo que no marcaste, con el pronombre que le toca', () => {
    expect(lineaDeEquipo({ equipo: ['banda'] }, CON_LO_DADO)).toBe(
      'Pide: banda elástica. No la marcaste en tu equipo.',
    )
    expect(lineaDeEquipo({ equipo: ['paralelas'] }, CON_LO_DADO)).toBe(
      'Pide: paralelas. No las marcaste en tu equipo.',
    )
    expect(lineaDeEquipo({ equipo: ['escalon'] }, CON_LO_DADO)).toBe('Pide: escalón. No lo marcaste en tu equipo.')
    expect(lineaDeEquipo({ equipo: ['barra', 'banda'] }, equipoDe({ tieneBarra: false }))).toBe(
      'Pide: barra fija y banda elástica. No las marcaste en tu equipo.',
    )
    expect(lineaDeEquipo({ equipo: ['banda', 'escalon'] }, CON_LO_DADO)).toBe(
      'Pide: banda elástica y escalón. No los marcaste en tu equipo.',
    )
  })

  it('si falta solo una parte, la nombra', () => {
    expect(lineaDeEquipo({ equipo: ['barra', 'banda'] }, CON_LO_DADO)).toBe(
      'Pide: barra fija y banda elástica. No marcaste banda elástica en tu equipo.',
    )
  })

  it('lo dado por tenido no se marca, y no se dice que falta', () => {
    expect(lineaDeEquipo({ equipo: ['pared'] }, new Set(['nada'] as const))).toBe('Pide: pared.')
  })

  it('sin el dato, o si no pide nada, no hay línea', () => {
    expect(lineaDeEquipo({}, CON_LO_DADO)).toBeNull()
    expect(lineaDeEquipo({ equipo: [] }, CON_LO_DADO)).toBeNull()
    expect(lineaDeEquipo({ equipo: ['nada'] }, CON_LO_DADO)).toBeNull()
  })

  it('con las fichas de la biblioteca', () => {
    expect(lineaDeEquipo(ejercicio('dominada-asistida'), CON_LO_DADO)).toBe(
      'Pide: barra fija y banda elástica. No marcaste banda elástica en tu equipo.',
    )
    expect(lineaDeEquipo(ejercicio('flexion-completa'), CON_LO_DADO)).toBeNull()
  })
})

describe('el requisito en la Ficha', () => {
  const palanca = REQUISITOS.get('palanca-frontal-agrupada')!

  it('sin requisitos sin cumplir, no hay línea', () => {
    expect(lineaDeRequisito([])).toBeNull()
  })

  it('un eslabón de otra cadena, con su mínimo', () => {
    expect(lineaDeRequisito([{ clase: 'avance', requisito: palanca }])).toBe('Pide antes: dominadas completas 3 × 8.')
    const sinMinimo: RequisitoDelCatalogo = {
      clase: 'avance',
      requisito: { patron: 'traccion', ejercicioId: 'dominada-completa', porque: 'así se cuida el codo' },
    }
    expect(lineaDeRequisito([sinMinimo])).toBe('Pide antes: dominadas completas.')
  })

  it('uno del historial, en segundos, y los dos juntos', () => {
    const plancha: RequisitoDelCatalogo = {
      clase: 'historial',
      requisito: { pide: { ejercicioId: 'plancha', series: 3, cantidad: 30 }, porque: 'para llegar firme' },
    }
    expect(lineaDeRequisito([plancha])).toBe('Pide antes: plancha 3 × 30 s.')
    expect(lineaDeRequisito([plancha, { clase: 'avance', requisito: palanca }])).toBe(
      'Pide antes: plancha 3 × 30 s y dominadas completas 3 × 8.',
    )
  })

  it('si pide algo que no está en la app, no dice solo una parte', () => {
    const fantasma: RequisitoDelCatalogo = {
      clase: 'historial',
      requisito: { pide: { ejercicioId: 'no-existe', series: 3, cantidad: 30 }, porque: 'x' },
    }
    expect(lineaDeRequisito([{ clase: 'avance', requisito: palanca }, fantasma])).toBeNull()
  })

  it('con lo que da `requisitosSinCumplir`', () => {
    const conObjetivo = (avances: AvancesPorCadena) =>
      new Map([...avances].map(([p, v]) => [p, { ...v, objetivoActual: { series: 3, cantidad: 8 } }]))
    const lejos = conObjetivo(avancesEn({ traccion: 5 }))
    expect(lineaDeRequisito(requisitosSinCumplir('palanca-frontal-agrupada', lejos, []))).toBe(
      'Pide antes: dominadas completas 3 × 8.',
    )
    const pasada = conObjetivo(avancesEn({ traccion: 9 }))
    expect(lineaDeRequisito(requisitosSinCumplir('palanca-frontal-agrupada', pasada, []))).toBeNull()
  })
})

describe('el chequeo, con pasos que armaste vos', () => {
  const AMBAR = ajusteDelDia('ambar')
  const fijo = (cantidad: number, extra: Partial<PasoDelBorrador> = {}) =>
    paso('flexion-diamante', 3, cantidad, { clase: 'fijo', fijo: true, ...extra })
  const deCadena = (cantidad: number) => paso('flexion-completa', 3, cantidad, { clase: 'cadena' })

  it('un día sin ajuste no dice nada', () => {
    expect(lineaDelChequeo([deCadena(10), fijo(10)], ajusteDelDia('normal'))).toBeNull()
    expect(lineaDelChequeo([deCadena(10), fijo(10)], ajusteDelDia('verde'))).toBeNull()
  })

  it('con fijos que bajarían y pasos de cadena que ya bajaron, la línea entera', () => {
    expect(lineaDelChequeo([deCadena(10), fijo(10)], AMBAR)).toBe(
      'El chequeo de hoy dio para bajar un poco: tus pasos de cadena ya bajaron.',
    )
    expect(lineaDelChequeo([deCadena(10), fijo(10)], ajusteDelDia('rojo'))).toBe(
      'El chequeo de hoy dio para bajar un poco: tus pasos de cadena ya bajaron.',
    )
  })

  it('sin pasos de cadena que hayan bajado, solo la primera parte', () => {
    expect(lineaDelChequeo([fijo(10)], AMBAR)).toBe('El chequeo de hoy dio para bajar un poco.')
    // 5 por 0,9 redondea a 5: ese paso de cadena no bajó.
    expect(lineaDelChequeo([deCadena(5), fijo(10)], AMBAR)).toBe('El chequeo de hoy dio para bajar un poco.')
  })

  it('si el botón no bajaría nada, no hay línea', () => {
    expect(lineaDelChequeo([deCadena(10)], AMBAR)).toBeNull()
    expect(lineaDelChequeo([deCadena(10), fijo(5)], AMBAR)).toBeNull()
    expect(lineaDelChequeo([deCadena(10), fijo(10, { calentamiento: true })], AMBAR)).toBeNull()
  })
})

describe('la molestia en un paso fijo', () => {
  it('con lo que da `pasosConMolestia`: bajó, o se saltea', () => {
    const { cambios } = pasosConMolestia(
      [
        paso('remo-australiano-pies-elevados', 3, 8, { id: 'p1', clase: 'fijo', fijo: true }),
        paso('remo-australiano-alto', 3, 8, { id: 'p2', clase: 'fijo', fijo: true }),
      ],
      'traccion',
    )
    expect(cambios.map((c) => lineaDeMolestia(c))).toEqual([
      'Molestia en tracción: este paso bajó a remo australiano bajo.',
      'Molestia en tracción: este paso se saltea hoy.',
    ])
  })

  it('bajado a algo que no está en la app, no hay línea', () => {
    expect(lineaDeMolestia({ patron: 'empuje', cambio: 'baja', a: 'no-existe' })).toBeNull()
    expect(lineaDeMolestia({ patron: 'empuje', cambio: 'baja' })).toBeNull()
  })

  it('la derivación, en su versión corta', () => {
    expect(DERIVACION).toBe('Si es un dolor punzante o que no se va, pará y consultá a un profesional.')
  })
})

describe('lo que cambió en una rutina', () => {
  const cambio = (pasoId: string, de: string, a: string): CambioEnSesion => ({ clase: 'cambio', pasoId, de, a })

  it('sin nada que cuente, no hay línea: saltear no es cambiar', () => {
    expect(lineaDeCambios([])).toBeNull()
    expect(lineaDeCambios([{ clase: 'salteado', pasoId: 'p1' }])).toBeNull()
  })

  it('saltear un paso que ya cambiaste o sumaste no borra el cambio', () => {
    expect(
      lineaDeCambios([
        cambio('p2', 'flexion-declinada', 'flexion-diamante'),
        { clase: 'salteado', pasoId: 'p2' },
        { clase: 'agregado', pasoId: 'p9', ejercicioId: 'plancha' },
        { clase: 'salteado', pasoId: 'p9' },
      ]),
    ).toBe('Cambiaste 2 cosas: Flexiones diamante en vez de Flexiones declinadas, y sumaste Plancha.')
  })

  it('el ejemplo: un cambio y un ejercicio sumado', () => {
    expect(
      lineaDeCambios([
        cambio('p2', 'flexion-declinada', 'flexion-diamante'),
        { clase: 'salteado', pasoId: 'p3' },
        { clase: 'agregado', pasoId: 'p9', ejercicioId: 'plancha' },
      ]),
    ).toBe('Cambiaste 2 cosas: Flexiones diamante en vez de Flexiones declinadas, y sumaste Plancha.')
  })

  it('una cosa, en singular', () => {
    expect(lineaDeCambios([cambio('p2', 'flexion-declinada', 'flexion-diamante')])).toBe(
      'Cambiaste 1 cosa: Flexiones diamante en vez de Flexiones declinadas.',
    )
  })

  it('cada paso cuenta por lo que quedó', () => {
    expect(
      lineaDeCambios([
        cambio('p2', 'flexion-declinada', 'flexion-diamante'),
        cambio('p2', 'flexion-diamante', 'flexion-completa'),
      ]),
    ).toBe('Cambiaste 1 cosa: Flexiones completas en vez de Flexiones declinadas.')
    expect(
      lineaDeCambios([
        cambio('p2', 'flexion-declinada', 'flexion-diamante'),
        cambio('p2', 'flexion-diamante', 'flexion-declinada'),
      ]),
    ).toBeNull()
    expect(
      lineaDeCambios([
        { clase: 'agregado', pasoId: 'p9', ejercicioId: 'plancha' },
        cambio('p9', 'plancha', 'plancha-rodillas'),
        { clase: 'al-final', pasoId: 'p9' },
      ]),
    ).toBe('Cambiaste 1 cosa: sumaste Plancha de rodillas.')
  })

  it('pasar al final es una cosa, con el nombre del paso', () => {
    expect(
      lineaDeCambios([{ clase: 'al-final', pasoId: 'p4' }], [{ id: 'p4', ejercicioId: 'zancada' }]),
    ).toBe('Cambiaste 1 cosa: pasaste Zancadas al final.')
  })

  it('hasta tres, y después cuántas más', () => {
    expect(
      lineaDeCambios([
        cambio('p1', 'flexion-declinada', 'flexion-diamante'),
        { clase: 'agregado', pasoId: 'p7', ejercicioId: 'plancha' },
        { clase: 'agregado', pasoId: 'p8', ejercicioId: 'zancada' },
        { clase: 'agregado', pasoId: 'p9', ejercicioId: 'puente-gluteos' },
        { clase: 'agregado', pasoId: 'p10', ejercicioId: 'gato-vaca' },
      ]),
    ).toBe(
      'Cambiaste 5 cosas: Flexiones diamante en vez de Flexiones declinadas, sumaste Plancha, sumaste Zancadas, y 2 más.',
    )
  })

  it('lo que no tiene nombre va en "más", y la línea no pasa de 140', () => {
    expect(
      lineaDeCambios([
        { clase: 'agregado', pasoId: 'p7', ejercicioId: 'no-existe' },
        cambio('p1', 'flexion-declinada', 'flexion-diamante'),
      ]),
    ).toBe('Cambiaste 2 cosas: Flexiones diamante en vez de Flexiones declinadas, y 1 más.')
    expect(lineaDeCambios([{ clase: 'agregado', pasoId: 'p7', ejercicioId: 'no-existe' }])).toBe(
      'Cambiaste 1 cosa.',
    )
    const largos = lineaDeCambios([
      cambio('p1', 'remo-australiano-pies-elevados', 'puente-una-pierna-elevado'),
      cambio('p2', 'sentadilla-a-banco-una-pierna', 'curl-talones-deslizando'),
      cambio('p3', 'elevacion-rodillas-suelo', 'sentadilla-una-pierna-asistida'),
    ])
    expect(largos!.length).toBeLessThanOrEqual(LARGO_DE_LINEA)
    expect(largos).toMatch(/^Cambiaste 3 cosas: .*, y \d más\.$/)
  })
})

describe('el techo de un fijo', () => {
  it('en una rutina, la pregunta; en un mix, lo que hace el mix', () => {
    const techo = { ejercicioId: 'flexion-diamante', series: 3, cantidad: 12, siguienteId: 'flexion-declinada' }
    expect(lineaDelTecho({ ...techo, en: 'rutina' })).toBe(
      'Flexiones diamante: dos veces 3 × 12. ¿Pasás a Flexiones declinadas?',
    )
    expect(lineaDelTecho({ ...techo, en: 'mix' })).toBe(
      'Flexiones diamante: dos veces 3 × 12. La próxima del mix van Flexiones declinadas.',
    )
  })

  it('en un mix, "va" o "van" según el número del que sigue', () => {
    expect(
      lineaDelTecho({ ejercicioId: 'plancha', series: 3, cantidad: 30, siguienteId: 'plancha-brazo-alternado', en: 'mix' }),
    ).toBe('Plancha: dos veces 3 × 30 s. La próxima del mix va Plancha con brazo alternado.')
    expect(
      lineaDelTecho({ ejercicioId: 'remo-australiano-pies-elevados', series: 3, cantidad: 12, siguienteId: 'dominada-negativa', en: 'mix' }),
    ).toBe('Remo australiano con pies elevados: dos veces 3 × 12. La próxima del mix van Dominadas negativas.')
  })

  it('en segundos', () => {
    expect(
      lineaDelTecho({ ejercicioId: 'plancha', series: 3, cantidad: 30, siguienteId: 'plancha-brazo-alternado', en: 'rutina' }),
    ).toBe('Plancha: dos veces 3 × 30 s. ¿Pasás a Plancha con brazo alternado?')
  })

  it('sin siguiente, o sin dato, no hay línea', () => {
    const base = { ejercicioId: 'flexion-diamante', series: 3, cantidad: 12, en: 'rutina' } as const
    expect(lineaDelTecho({ ...base, siguienteId: null })).toBeNull()
    expect(lineaDelTecho({ ...base, siguienteId: 'flexion-diamante' })).toBeNull()
    expect(lineaDelTecho({ ...base, siguienteId: 'no-existe' })).toBeNull()
    expect(lineaDelTecho({ ...base, ejercicioId: 'no-existe', siguienteId: 'flexion-declinada' })).toBeNull()
    expect(lineaDelTecho({ ...base, series: 0, siguienteId: 'flexion-declinada' })).toBeNull()
  })
})

describe('la glosa de Tu día', () => {
  const pecho: Registro[] = [['flexion-completa', 3]]

  it('sin nada ese día, no hay línea', () => {
    expect(lineaDelDia([], HOY)).toBeNull()
    expect(lineaDelDia([sesion(AYER, [9, 10], pecho)], HOY)).toBeNull()
  })

  it('las sesiones con sus horas, en el orden en que empezaron', () => {
    const historial = [
      sesion(HOY, [19, 5], pecho),
      sesion(HOY, [9, 10], pecho),
      sesion(HOY, [13, 30], pecho),
      sesion(AYER, [10, 0], pecho),
    ]
    expect(lineaDelDia(historial, HOY)).toBe('3 sesiones: 9:10 · 13:30 · 19:05')
    expect(lineaDelDia([sesion(HOY, [9, 10], pecho)], HOY)).toBe('Una sesión: 9:10')
  })

  it('la movilidad tiene su hora pero se nombra aparte', () => {
    expect(
      lineaDelDia([sesion(HOY, [9, 10], pecho), movilidad(HOY, [12, 0]), sesion(HOY, [19, 5], pecho)], HOY),
    ).toBe('2 sesiones y una movilidad: 9:10 · 12:00 · 19:05')
    expect(
      lineaDelDia(
        [sesion(HOY, [9, 10], pecho), movilidad(HOY, [12, 0]), sesion(HOY, [19, 5], pecho), movilidad(HOY, [21, 0])],
        HOY,
      ),
    ).toBe('2 sesiones y 2 movilidades: 9:10 · 12:00 · 19:05 · 21:00')
    expect(lineaDelDia([sesion(HOY, [9, 10], pecho), movilidad(HOY, [12, 0])], HOY)).toBe(
      'Una sesión y una movilidad: 9:10 · 12:00',
    )
    expect(lineaDelDia([movilidad(HOY, [12, 0])], HOY)).toBe('Una movilidad: 12:00')
    expect(lineaDelDia([movilidad(HOY, [12, 0]), movilidad(HOY, [18, 30])], HOY)).toBe('2 movilidades: 12:00 · 18:30')
  })

  it('las sesiones viejas dicen que la hora es la de cierre', () => {
    const vieja = (h: number, m: number) => {
      const s = sesion(HOY, [h, m], pecho, { iniciadaEn: undefined })
      return { ...s, finalizadaEn: en(HOY, h, m) }
    }
    expect(lineaDelDia([vieja(9, 34), vieja(19, 20)], HOY)).toBe('2 sesiones, cerradas a las 9:34 · 19:20')
    expect(lineaDelDia([vieja(9, 34)], HOY)).toBe('Una sesión, cerrada a las 9:34')
    expect(lineaDelDia([vieja(1, 20)], HOY)).toBe('Una sesión, cerrada a la 1:20')
    expect(lineaDelDia([vieja(9, 34), sesion(HOY, [19, 5], pecho)], HOY)).toBe('2 sesiones: 9:34 (cierre) · 19:05')
  })

  it('con la una entre otras horas, cada hora lleva su artículo', () => {
    const vieja = (h: number, m: number) => {
      const s = sesion(HOY, [h, m], pecho, { iniciadaEn: undefined })
      return { ...s, finalizadaEn: en(HOY, h, m) }
    }
    expect(lineaDelDia([vieja(1, 10), vieja(13, 50)], HOY)).toBe('2 sesiones, cerradas a la 1:10 · a las 13:50')
    expect(lineaDelDia([vieja(0, 30), vieja(1, 20)], HOY)).toBe('2 sesiones, cerradas a las 0:30 · a la 1:20')
    expect(lineaDelDia([vieja(0, 30), vieja(1, 20), vieja(11, 5)], HOY)).toBe(
      '3 sesiones, cerradas a las 0:30 · a la 1:20 · a las 11:05',
    )
    // Todas con el mismo artículo: uno solo para la lista.
    expect(lineaDelDia([vieja(1, 10), vieja(1, 50)], HOY)).toBe('2 sesiones, cerradas a la 1:10 · 1:50')
    expect(lineaDelDia([vieja(11, 5), vieja(21, 0)], HOY)).toBe('2 sesiones, cerradas a las 11:05 · 21:00')
  })

  it('la que arrancó a las 23:40 y cerró pasada la medianoche es del día en que arrancó', () => {
    const tarde = sesion(HOY, [23, 40], pecho)
    expect(tarde.finalizadaEn).toBeGreaterThan(en('2026-10-22', 0, 0))
    expect(lineaDelDia([tarde], HOY)).toBe('Una sesión: 23:40')
    expect(lineaDelDia([tarde], '2026-10-22')).toBeNull()
  })

  it('cinco sesiones y dos movilidades entran en 140', () => {
    const historial = [
      ...[7, 9, 12, 15, 19].map((h) => sesion(HOY, [h, 10], pecho)),
      movilidad(HOY, [13, 45]),
      movilidad(HOY, [21, 55]),
    ]
    const linea = lineaDelDia(historial, HOY)
    expect(linea).toBe('5 sesiones y 2 movilidades: 7:10 · 9:10 · 12:10 · 13:45 · 15:10 · 19:10 · 21:55')
    expect(linea!.length).toBeLessThanOrEqual(LARGO_DE_LINEA)
  })
})

describe('la última vez de una zona', () => {
  const vez = (fecha: string, h: number, m: number, esVieja = false) => ({
    fecha,
    sesion: esVieja ? { finalizadaEn: en(fecha, h, m) } : { iniciadaEn: en(fecha, h, m), finalizadaEn: en(fecha, h, m) + 30 * MINUTO },
  })

  it('nunca: no hay sesiones anotadas todavía, solo si la zona no tiene ni una serie', () => {
    expect(lineaUltimaVez('gluteos', null, HOY, { sinSeries: true })).toBe('Glúteos: no hay sesiones anotadas todavía.')
  })

  it('sin última vez pero con series, o sin saber si las hay, no dice nada', () => {
    // Una `ultimaVez` en `null` es "ningún día llegó al umbral", no "nunca".
    expect(lineaUltimaVez('gluteos', null, HOY, { sinSeries: false })).toBeNull()
    expect(lineaUltimaVez('gluteos', null, HOY, {})).toBeNull()
    expect(lineaUltimaVez('gluteos', null, HOY)).toBeNull()
    // Con una última vez, la frase es la de siempre: el dato manda.
    expect(lineaUltimaVez('pecho', vez(AYER, 19, 5), HOY, { sinSeries: true })).toBe('Pecho · última vez ayer.')
    expect(lineaUltimaVez('cuerpo', null, HOY, { sinSeries: true })).toBeNull()
  })

  it('hoy con la hora, ayer, el día de la semana y la fecha corta', () => {
    expect(lineaUltimaVez('pecho', vez(HOY, 9, 10), HOY)).toBe('Pecho · última vez hoy a las 9:10.')
    expect(lineaUltimaVez('pecho', vez(HOY, 1, 5), HOY)).toBe('Pecho · última vez hoy a la 1:05.')
    expect(lineaUltimaVez('pecho', vez(AYER, 19, 5), HOY)).toBe('Pecho · última vez ayer.')
    expect(lineaUltimaVez('gluteos', vez('2026-10-16', 18, 0), HOY)).toBe('Glúteos · última vez el viernes.')
    expect(lineaUltimaVez('gluteos', vez('2026-10-15', 18, 0), HOY)).toBe('Glúteos · última vez el jueves.')
    expect(lineaUltimaVez('gluteos', vez('2026-10-14', 18, 0), HOY)).toBe('Glúteos · última vez el 14/10.')
    expect(lineaUltimaVez('gluteos', vez('2026-10-05', 18, 0), HOY)).toBe('Glúteos · última vez el 5/10.')
  })

  it('una sesión vieja de hoy no tiene hora de inicio que decir', () => {
    expect(lineaUltimaVez('pecho', vez(HOY, 9, 34, true), HOY)).toBe('Pecho · última vez hoy.')
  })

  it('el cuerpo completo no es una zona, y un día que no llegó no se dice', () => {
    expect(lineaUltimaVez('cuerpo', null, HOY)).toBeNull()
    expect(lineaUltimaVez('pecho', vez('2026-10-22', 9, 0), HOY)).toBeNull()
  })

  it('con lo que da `ultimaVezDeZona`', () => {
    const historial = [
      sesion('2026-10-16', [9, 10], [['puente-gluteos', 3]]),
      sesion(HOY, [9, 10], [['flexion-completa', 3]]),
    ]
    expect(lineaUltimaVez('gluteos', ultimaVezDeZona('gluteos', historial), HOY)).toBe(
      'Glúteos · última vez el viernes.',
    )
    expect(lineaUltimaVez('pecho', ultimaVezDeZona('pecho', historial), HOY)).toBe(
      'Pecho · última vez hoy a las 9:10.',
    )
    const sinSeries = (zona: Zona) => ({ sinSeries: zonaSinSeries(zona, historial) })
    expect(lineaUltimaVez('piernas', ultimaVezDeZona('piernas', historial), HOY, sinSeries('piernas'))).toBe(
      'Piernas: no hay sesiones anotadas todavía.',
    )
    // Las flexiones le dan series a Hombros sin llegar a un día de Hombros:
    // "no hay sesiones anotadas" sería falso, y no se dice.
    expect(ultimaVezDeZona('hombros', historial)).toBeNull()
    expect(zonaSinSeries('hombros', historial)).toBe(false)
    expect(lineaUltimaVez('hombros', ultimaVezDeZona('hombros', historial), HOY, sinSeries('hombros'))).toBeNull()
  })
})

describe('la sesión a medio hacer', () => {
  const series = (...logrados: number[]): Serie[] => logrados.map((logrado) => ({ logrado }))
  const borrador = (extra: Partial<SesionEnCurso> = {}): Pick<
    SesionEnCurso,
    'origen' | 'corta' | 'iniciadaEn' | 'hechas' | 'rafagas'
  > => ({
    origen: { clase: 'mix', sector: 'gluteos', nombre: 'Mix de glúteos', version: 'completa' },
    corta: false,
    iniciadaEn: a(13, 30),
    hechas: { p1: series(8, 8, 7), p2: series(10, 10, 9, 0) },
    ...extra,
  })

  it('el nombre, la hora y las series con algo hecho', () => {
    expect(lineaDeBorrador(borrador())).toBe('Tenés a medio hacer Mix de glúteos, de las 13:30, con 6 series.')
    expect(lineaDeBorrador(borrador({ hechas: { p1: series(8) } }))).toBe(
      'Tenés a medio hacer Mix de glúteos, de las 13:30, con 1 serie.',
    )
    expect(lineaDeBorrador(borrador({ iniciadaEn: a(1, 5) }))).toBe(
      'Tenés a medio hacer Mix de glúteos, de la 1:05, con 6 series.',
    )
  })

  it('con ráfagas, y sin nada hecho no nombra lo que no hay', () => {
    const rafagas = [
      { id: 'burpees', segundos: 20 },
      { id: 'saltos', segundos: 20 },
    ] as unknown as SesionEnCurso['rafagas']
    expect(lineaDeBorrador(borrador({ rafagas }))).toBe(
      'Tenés a medio hacer Mix de glúteos, de las 13:30, con 6 series y 2 ráfagas.',
    )
    expect(lineaDeBorrador(borrador({ hechas: {}, rafagas }))).toBe(
      'Tenés a medio hacer Mix de glúteos, de las 13:30, con 2 ráfagas.',
    )
    expect(lineaDeBorrador(borrador({ hechas: { p1: series(0) } }))).toBe(
      'Tenés a medio hacer Mix de glúteos, de las 13:30.',
    )
  })

  it('un borrador viejo es el plan, y no tiene hora que inventar', () => {
    expect(lineaDeBorrador(borrador({ origen: undefined, iniciadaEn: undefined }))).toBe(
      'Tenés a medio hacer Plan, con 6 series.',
    )
    expect(lineaDeBorrador(borrador({ origen: undefined, corta: true, iniciadaEn: undefined }))).toBe(
      'Tenés a medio hacer Solo tengo 7 minutos, con 6 series.',
    )
  })

  it('sin nombre, no hay línea', () => {
    expect(lineaDeBorrador(borrador({ origen: { clase: 'libre', nombre: '  ' } }))).toBeNull()
  })
})

describe('las reglas de la voz, en todas las del centro', () => {
  const avances = avancesEn({ empuje: 3, traccion: 2, piernas: 2, core: 2, bisagra: 2 })
  const equipos = [equipoDe({}), equipoDe({ tieneBarra: false }), equipoDe({ tieneBanda: true, tieneParalelas: true, tieneAnillas: true, tieneEscalon: true, cargaMaximaKg: 40 })]
  const patrones: Patron[] = ['empuje', 'traccion', 'piernas', 'core', 'bisagra']
  const llave = [false, true]

  const recuperacion = [
    enB(),
    enB({ seriesHoy: 1, conEsta: 12, musculo: 'antebrazo', zona: null, ultima: { sesionId: 's', fecha: HOY, hora: a(19, 55), esDeCierre: true } }),
    enB({ cadenasLeidas: patrones.map((patron) => ({ patron, hora: a(9, 10) })) }),
    enC(),
    enC({ zona: 'gluteos', ultima: { sesionId: 's', fecha: '2026-10-19', hora: en('2026-10-19', 23, 40), esDeCierre: true } }),
  ]

  /** Lo que el motor afirma: las líneas que salen de un dato y no de una ficha. */
  const delMotor: (string | null)[] = [
    ...recuperacion.flatMap((d) => {
      const linea = lineaDeRecuperacion(d, HOY)
      return [linea?.dato ?? null, linea?.cadenas ?? null]
    }),
    lineaDeVolumen(new Map<Musculo, number>([['antebrazo', 24.5]]))?.dato ?? null,
    ...EJERCICIOS.map((e) => lineaDeNivel(e, avances)),
    ...EJERCICIOS.flatMap((e) => equipos.map((eq) => lineaDeEquipo(e, eq))),
    lineaDeRequisito([{ clase: 'avance', requisito: REQUISITOS.get('palanca-frontal-agrupada')! }]),
    lineaDelChequeo([paso('flexion-completa', 3, 10, { clase: 'cadena' }), paso('flexion-diamante', 3, 10, { clase: 'fijo' })], ajusteDelDia('ambar')),
    lineaDelChequeo([paso('flexion-diamante', 3, 10, { clase: 'fijo' })], ajusteDelDia('rojo')),
    ...patrones.flatMap((patron) => [
      lineaDeMolestia({ patron, cambio: 'saltea' }),
      lineaDeMolestia({ patron, cambio: 'baja', a: cadenaDe(patron).ejercicios[0] }),
    ]),
    DERIVACION,
    lineaDeCambios([
      { clase: 'cambio', pasoId: 'p1', de: 'flexion-declinada', a: 'flexion-diamante' },
      { clase: 'al-final', pasoId: 'p2' },
      { clase: 'agregado', pasoId: 'p3', ejercicioId: 'gato-vaca' },
      { clase: 'agregado', pasoId: 'p4', ejercicioId: 'zancada' },
    ], [{ id: 'p2', ejercicioId: 'plancha' }]),
    lineaDelTecho({ ejercicioId: 'flexion-diamante', series: 3, cantidad: 12, siguienteId: 'flexion-declinada', en: 'rutina' }),
    lineaDelTecho({ ejercicioId: 'plancha', series: 1, cantidad: 30, siguienteId: 'plancha-brazo-alternado', en: 'mix' }),
    lineaDelTecho({ ejercicioId: 'flexion-diamante', series: 3, cantidad: 12, siguienteId: 'flexion-declinada', en: 'mix' }),
    lineaDelDia([sesion(HOY, [9, 10], [['flexion-completa', 3]]), movilidad(HOY, [12, 0])], HOY),
    lineaDelDia(
      [
        { ...sesion(HOY, [1, 10], [['flexion-completa', 3]], { iniciadaEn: undefined }), finalizadaEn: en(HOY, 1, 10) },
        { ...sesion(HOY, [13, 50], [['flexion-completa', 3]], { iniciadaEn: undefined }), finalizadaEn: en(HOY, 13, 50) },
      ],
      HOY,
    ),
    lineaUltimaVez('gluteos', null, HOY, { sinSeries: true }),
    lineaUltimaVez('pecho', { fecha: '2026-10-16', sesion: { finalizadaEn: en('2026-10-16', 9) } }, HOY),
    lineaDeBorrador({ corta: false, iniciadaEn: a(13, 30), hechas: { p: [{ logrado: 8 }] } }),
  ]

  /** Las que además repiten el texto de una ficha, que tiene su propio test en `biblioteca.test.ts`. */
  const conFicha: (string | null)[] = EJERCICIOS.flatMap((e) => [
    lineaDeSeguridad(e, { primeraVez: true }),
    lineaDeSeguridad(e, { primeraVez: false, avances }),
  ])

  /** Lo que suma la llave prendida, que sale recién con la fuente confirmada. */
  const conLaLlave: (string | null)[] = [
    ...recuperacion.flatMap((d) => llave.map((conFuente) => lineaDeRecuperacion(d, HOY, { conFuente })?.conFuente ?? null)),
    lineaDeVolumen(new Map<Musculo, number>([['pectoral', 14]]), { conFuente: true })?.conFuente ?? null,
  ]

  const textos = (lista: (string | null)[]) => lista.filter((l): l is string => l !== null)

  it('hay de qué hablar: cada grupo trae líneas de verdad', () => {
    expect(textos(delMotor).length).toBeGreaterThan(100)
    expect(textos(conFicha).length).toBeGreaterThan(EJERCICIOS.length)
    expect(textos(conLaLlave).length).toBe(recuperacion.length + 1)
  })

  it('nada de lo prohibido, 140 como mucho, sin exclamación', () => {
    for (const linea of textos([...delMotor, ...conFicha, ...conLaLlave])) {
      expect(loProhibido(linea), linea).toBeNull()
      expect(linea.length, linea).toBeLessThanOrEqual(LARGO_DE_LINEA)
      expect(linea, linea).not.toMatch(/[!¡]/)
    }
  })

  it('con la llave apagada, ninguna afirma nada del cuerpo', () => {
    const delCuerpo = /recuper|descans|fatiga|lesi|músculo|crecimiento|esperable/i
    for (const linea of textos(delMotor)) expect(linea, linea).not.toMatch(delCuerpo)
  })

  it('la hora siempre en 24 h, sin "a. m." ni "p. m."', () => {
    for (const linea of textos(delMotor)) {
      expect(linea, linea).not.toMatch(/\b[ap]\.? ?m\.?(?![\p{L}])/iu)
      for (const [, h] of linea.matchAll(/\b(\d{1,2}):\d{2}\b/g)) expect(Number(h)).toBeLessThan(24)
    }
    expect(lineaDelDia([sesion(HOY, [21, 40], [['flexion-completa', 3]])], HOY)).toBe('Una sesión: 21:40')
  })
})
