/**
 * El borrador: de qué día es la sesión, si se retoma o se pregunta, y qué se
 * guarda cuando la persona dice "Guardarla".
 *
 * Cada bloque de acá corresponde a una forma de perder trabajo sin enterarse
 * que se midió en un navegador de verdad (portón `datos.mjs`). Estos tests
 * atan la regla; el portón ata que la pantalla la use.
 */

import { describe, expect, it } from 'vitest'
import {
  VIGENCIA_DEL_BORRADOR,
  alCambiarDeNivel,
  cierreDelBorrador,
  destinoDelBorrador,
  diaDelBorrador,
  diaLocal,
  esDiaValido,
  fechaDelDia,
  iniciadaEn,
  mismaSesion,
  normalizarBorrador,
  origenDelBorrador,
  quedaPorCerrar,
  registrosDeLaSesion,
  textoDeSinCerrar,
  textoDelBorradorAlRestaurar,
} from './borrador'
import { RUTINA_POR_ID, diaDeLaSemana, patronDelBloque, semanaDe } from './rutinas'
import type { OrigenDeSesion, SesionEnCurso } from './tipos'

/** Un instante en hora LOCAL, para que el test diga lo mismo en Buenos Aires y en Sídney. */
const local = (anio: number, mes: number, dia: number, hora: number, minuto = 0) =>
  new Date(anio, mes - 1, dia, hora, minuto).getTime()

const MIERCOLES_2340 = local(2026, 10, 21, 23, 40)
const JUEVES_0005 = local(2026, 10, 22, 0, 5)

function borrador(cambios: Partial<SesionEnCurso> = {}): SesionEnCurso {
  return {
    id: 'actual',
    arrancadaEn: MIERCOLES_2340,
    duracionAcumulada: 1500,
    actualizadoEn: MIERCOLES_2340,
    corta: false,
    indice: 2,
    etapa: 'series',
    hechas: { 'puente-gluteos': [{ logrado: 12 }, { logrado: 11 }, { logrado: 10 }] },
    ...cambios,
  }
}

describe('el día de la sesión', () => {
  it('el día local de un instante, nunca el de UTC', () => {
    expect(diaLocal(MIERCOLES_2340)).toBe('2026-10-21')
    expect(diaLocal(JUEVES_0005)).toBe('2026-10-22')
  })

  it('un día válido es uno que existe en el calendario', () => {
    expect(esDiaValido('2026-10-21')).toBe(true)
    expect(esDiaValido('2026-02-30')).toBe(false)
    expect(esDiaValido('21/10/2026')).toBe(false)
    expect(esDiaValido(undefined)).toBe(false)
  })

  it('el campo propio manda, aunque el arranque haya quedado en otro día', () => {
    // Retomada una vez, la sesión re-ancla `arrancadaEn` a lo entrenado: puede
    // caer del otro lado de la medianoche. El día guardado no se mueve.
    expect(diaDelBorrador(borrador({ dia: '2026-10-21', arrancadaEn: JUEVES_0005 }))).toBe(
      '2026-10-21',
    )
  })

  it('un borrador viejo, sin el campo, usa el día local de su arranque', () => {
    expect(diaDelBorrador(borrador({ arrancadaEn: MIERCOLES_2340 }))).toBe('2026-10-21')
    expect(diaDelBorrador(borrador({ dia: 'cualquier cosa', arrancadaEn: MIERCOLES_2340 }))).toBe(
      '2026-10-21',
    )
  })

  it('la fecha de un día cae en ese día de la semana, en cualquier huso', () => {
    expect(diaDeLaSemana(fechaDelDia('2026-10-21'))).toBe(3)
    expect(diaDeLaSemana(fechaDelDia('2026-10-22'))).toBe(4)
  })

  it('pasada la medianoche, el bloque que alterna sigue siendo el del miércoles', () => {
    /*
     * El bug, en el dominio. Cuerpo completo alterna piernas y bisagra según
     * el día: el miércoles toca bisagra, el jueves —que no es día de fuerza—
     * cae en piernas. Rearmar con el reloj a las 00:05 cambiaba el tercer
     * ejercicio y dejaba afuera las series ya hechas. Rearmar con el día del
     * borrador da lo mismo que a las 23:40.
     */
    const rutina = RUTINA_POR_ID.get('cuerpo-completo')!
    const semana = semanaDe(rutina)
    const tercero = rutina.bloques[2]!
    const conElReloj = patronDelBloque(tercero, semana, new Date(JUEVES_0005))
    const conElBorrador = patronDelBloque(
      tercero,
      semana,
      fechaDelDia(diaDelBorrador(borrador({ dia: '2026-10-21' }))),
    )
    expect(patronDelBloque(tercero, semana, new Date(MIERCOLES_2340))).toBe('bisagra')
    expect(conElReloj).toBe('piernas')
    expect(conElBorrador).toBe('bisagra')
  })
})

describe('qué hacer con el borrador', () => {
  it('vigente se retoma, también justo en el límite', () => {
    const b = borrador()
    expect(destinoDelBorrador(b, b.actualizadoEn + 60_000)).toBe('retomar')
    expect(destinoDelBorrador(b, b.actualizadoEn + VIGENCIA_DEL_BORRADOR)).toBe('retomar')
  })

  it('vencido con series se ofrece: nunca se borra sin mostrarse', () => {
    const b = borrador()
    expect(destinoDelBorrador(b, b.actualizadoEn + VIGENCIA_DEL_BORRADOR + 1)).toBe('ofrecer')
    expect(destinoDelBorrador(b, b.actualizadoEn + 7 * 60 * 60 * 1000)).toBe('ofrecer')
  })

  it('vencido con solo ráfagas también: es trabajo hecho', () => {
    const b = borrador({
      hechas: {},
      rafagas: [{ rafagaId: 'saltos', segundos: 20, despuesDe: null }],
    })
    expect(destinoDelBorrador(b, b.actualizadoEn + VIGENCIA_DEL_BORRADOR + 1)).toBe('ofrecer')
  })

  it('vencido y sin nada hecho se descarta: no hay decisión que pedir', () => {
    // Una serie anotada en cero no es trabajo: `cerrarSesion` tampoco la guarda.
    const b = borrador({ hechas: { 'puente-gluteos': [{ logrado: 0 }] } })
    expect(destinoDelBorrador(b, b.actualizadoEn + VIGENCIA_DEL_BORRADOR + 1)).toBe('descartar')
  })

  it('queda una sesión por cerrar mientras se retoma o se ofrece, y no si se descarta', () => {
    // Lo pregunta la revisión de la palanca frontal antes de mover un avance:
    // una vencida con series todavía se puede guardar como esa noche, y bajar
    // el core antes le cambiaría el resultado.
    const conSeries = borrador()
    expect(quedaPorCerrar(conSeries, conSeries.actualizadoEn + 60_000)).toBe(true)
    expect(quedaPorCerrar(conSeries, conSeries.actualizadoEn + VIGENCIA_DEL_BORRADOR + 1)).toBe(
      true,
    )

    const vacio = borrador({ hechas: {} })
    expect(quedaPorCerrar(vacio, vacio.actualizadoEn + 60_000)).toBe(true)
    expect(quedaPorCerrar(vacio, vacio.actualizadoEn + VIGENCIA_DEL_BORRADOR + 1)).toBe(false)
  })

  it('mover un nivel a mano cierra con lo hecho, y tira solo lo vacío', () => {
    // Con series adentro, se cierra: tirarla perdía las series, y dejarla
    // hacía que Entrenar la rearmara con el eslabón nuevo, que las perdía igual.
    expect(alCambiarDeNivel(borrador())).toBe('cerrar')
    const conRafaga = borrador({
      hechas: {},
      rafagas: [{ rafagaId: 'x', segundos: 20, despuesDe: null }],
    })
    expect(alCambiarDeNivel(conRafaga)).toBe('cerrar')
    // Sin nada hecho no hay qué guardar, y cerrarla escribiría una sesión vacía.
    expect(alCambiarDeNivel(borrador({ hechas: {} }))).toBe('tirar')
    expect(alCambiarDeNivel(borrador({ hechas: { a: [{ logrado: 0 }] } }))).toBe('tirar')
  })
})

describe('los registros de la sesión', () => {
  it('cada paso del plan con lo anotado, y nada más', () => {
    const registros = registrosDeLaSesion(
      [
        { ejercicioId: 'a', objetivo: { series: 3, cantidad: 8 } },
        { ejercicioId: 'b', objetivo: { series: 2, cantidad: 10 }, bajada: true },
      ],
      { a: [{ logrado: 8 }], fuera: [{ logrado: 5 }] },
    )
    expect(registros).toEqual([
      { ejercicioId: 'a', objetivo: { series: 3, cantidad: 8 }, series: [{ logrado: 8 }] },
      { ejercicioId: 'b', objetivo: { series: 2, cantidad: 10 }, series: [], bajada: true },
    ])
  })
})

describe('guardar un borrador vencido', () => {
  const sinObjetivo = () => undefined

  it('uno nuevo se cierra con su plan, su tipo y su día, no con los de hoy', () => {
    const b = borrador({
      dia: '2026-10-21',
      pasos: [{ ejercicioId: 'puente-gluteos', objetivo: { series: 3, cantidad: 10 } }],
      tipo: 'plan',
      rafagas: [{ rafagaId: 'saltos', segundos: 20, despuesDe: 'puente-gluteos' }],
      densa: true,
    })
    expect(cierreDelBorrador(b, { historial: [], objetivoDe: sinObjetivo })).toEqual({
      fecha: '2026-10-21',
      registros: [
        {
          ejercicioId: 'puente-gluteos',
          objetivo: { series: 3, cantidad: 10 },
          series: [{ logrado: 12 }, { logrado: 11 }, { logrado: 10 }],
        },
      ],
      duracionSegundos: 1500,
      tipo: 'plan',
      rafagas: [{ rafagaId: 'saltos', segundos: 20, despuesDe: 'puente-gluteos' }],
      densa: true,
    })
  })

  it('la corta nunca lleva el bloque denso, igual que en Entrenar', () => {
    const b = borrador({ corta: true, densa: true })
    const cierre = cierreDelBorrador(b, { historial: [], objetivoDe: sinObjetivo })
    expect(cierre.densa).toBeUndefined()
    expect(cierre.tipo).toBe('corta')
  })

  it('uno viejo toma el objetivo del avance, y si no hay, lo hecho', () => {
    const b = borrador({
      hechas: {
        'puente-gluteos': [{ logrado: 12 }, { logrado: 11 }],
        desconocido: [{ logrado: 7 }, { logrado: 9 }],
      },
    })
    const cierre = cierreDelBorrador(b, {
      historial: [],
      objetivoDe: (id) => (id === 'puente-gluteos' ? { series: 3, cantidad: 10 } : undefined),
    })
    expect(cierre.fecha).toBe('2026-10-21')
    expect(cierre.tipo).toBe('plan')
    expect(cierre.registros).toEqual([
      {
        ejercicioId: 'puente-gluteos',
        objetivo: { series: 3, cantidad: 10 },
        series: [{ logrado: 12 }, { logrado: 11 }],
      },
      {
        ejercicioId: 'desconocido',
        objetivo: { series: 2, cantidad: 9 },
        series: [{ logrado: 7 }, { logrado: 9 }],
      },
    ])
  })

  it('el tipo de uno viejo sale de sus marcas, como en Entrenar', () => {
    const contexto = { historial: [], objetivoDe: sinObjetivo }
    expect(cierreDelBorrador(borrador({ diaDeFuelle: true }), contexto).tipo).toBe('fuelle')
    expect(cierreDelBorrador(borrador({ corta: true }), contexto).tipo).toBe('corta')
  })

  it('ninguna serie se pierde: todas las anotadas están en los registros', () => {
    const b = borrador({
      pasos: [
        { ejercicioId: 'dominada', objetivo: { series: 3, cantidad: 5 } },
        { ejercicioId: 'puente-gluteos', objetivo: { series: 3, cantidad: 10 } },
      ],
    })
    const cierre = cierreDelBorrador(b, { historial: [], objetivoDe: sinObjetivo })
    const guardadas = cierre.registros.flatMap((r) => r.series)
    expect(guardadas).toEqual(Object.values(b.hechas).flat())
  })
})

describe('cómo lo ofrece Hoy', () => {
  it('dice de cuándo es y cuánto trabajo tiene', () => {
    const b = borrador({ dia: '2026-10-21' })
    expect(textoDeSinCerrar(b, '2026-10-21')).toBe(
      'Quedó sin cerrar una sesión de hoy, con 3 series.',
    )
    expect(textoDeSinCerrar(b, '2026-10-22')).toBe(
      'Quedó sin cerrar una sesión de ayer, con 3 series.',
    )
    expect(textoDeSinCerrar(b, '2026-10-24')).toBe(
      'Quedó sin cerrar una sesión del miércoles 21/10, con 3 series.',
    )
  })

  it('cuenta solo lo hecho, en singular cuando es uno, y las ráfagas aparte', () => {
    const b = borrador({
      dia: '2026-10-21',
      hechas: { a: [{ logrado: 8 }, { logrado: 0 }] },
      rafagas: [
        { rafagaId: 'saltos', segundos: 20, despuesDe: 'a' },
        { rafagaId: 'burpee', segundos: 20, despuesDe: null },
      ],
    })
    expect(textoDeSinCerrar(b, '2026-10-22')).toBe(
      'Quedó sin cerrar una sesión de ayer, con 1 serie y 2 ráfagas.',
    )
  })
})

describe('cómo lo avisa Ajustes antes de restaurar', () => {
  it('dice que la sesión a medio hacer también se borra, de cuándo es y cuánto tiene', () => {
    // Restaurar vacía el borrador y el borrador no va en ninguna copia: era la
    // última forma de perder series sin que nadie las mostrara.
    const b = borrador({ dia: '2026-10-21' })
    expect(textoDelBorradorAlRestaurar(b, '2026-10-22')).toBe(
      'La sesión de ayer que quedó sin cerrar, con 3 series, también se borra: ' +
        'no entra en ninguna copia. Si la querés, guardala antes.',
    )
    expect(textoDelBorradorAlRestaurar(b, '2026-10-24')).toContain(
      'La sesión del miércoles 21/10 que quedó sin cerrar',
    )
  })
})

/**
 * Un borrador tal cual lo escribe la app de antes de la reestructura: pasos sin
 * id ni clase, series por id de ejercicio, sin origen y sin hora de inicio. Un
 * martes de empuje con la bajada, tracción y el saludo del final.
 */
function borradorV3(): SesionEnCurso {
  return {
    id: 'actual',
    arrancadaEn: local(2026, 10, 20, 9, 10),
    duracionAcumulada: 1240,
    actualizadoEn: local(2026, 10, 20, 9, 31),
    corta: false,
    densa: false,
    indice: 2,
    etapa: 'series',
    dia: '2026-10-20',
    tipo: 'plan',
    molestias: [],
    pasos: [
      { ejercicioId: 'flexion-completa', objetivo: { series: 3, cantidad: 9 } },
      { ejercicioId: 'flexion-rodillas', objetivo: { series: 2, cantidad: 10 }, bajada: true },
      { ejercicioId: 'remo-australiano-bajo', objetivo: { series: 3, cantidad: 8 } },
      { ejercicioId: 'sentadilla-completa', objetivo: { series: 3, cantidad: 12 } },
    ],
    hechas: {
      'flexion-completa': [{ logrado: 9 }, { logrado: 9 }, { logrado: 8 }],
      'flexion-rodillas': [{ logrado: 10 }, { logrado: 10 }],
      'remo-australiano-bajo': [{ logrado: 8, reservas: 1 }],
    },
  }
}

/** Los avances de ese martes: empuje y tracción en el eslabón del plan; piernas en otro. */
const AVANCES = [
  { ejercicioId: 'flexion-completa' },
  { ejercicioId: 'remo-australiano-bajo' },
  { ejercicioId: 'sentadilla-asistida' },
]

describe('un borrador de antes de la reestructura', () => {
  it('se normaliza sin perder una serie ni cambiar ninguna', () => {
    const viejo = borradorV3()
    const nuevo = normalizarBorrador(viejo, AVANCES)
    // Lo anotado queda idéntico, con las mismas claves.
    expect(nuevo.hechas).toEqual(viejo.hechas)
    // Y cada paso encuentra sus series por su id, que es el de su ejercicio.
    for (const paso of nuevo.pasos!) expect(paso.id).toBe(paso.ejercicioId)
    const cierre = cierreDelBorrador(nuevo, { historial: [], objetivoDe: () => undefined })
    expect(cierre.registros.flatMap((r) => r.series)).toEqual(Object.values(viejo.hechas).flat())
  })

  it('cada paso toma su clase: cadena, volumen o fijo', () => {
    const pasos = normalizarBorrador(borradorV3(), AVANCES).pasos!
    expect(pasos.map((p) => [p.ejercicioId, p.clase])).toEqual([
      ['flexion-completa', 'cadena'],
      // La bajada era el volumen en el eslabón de abajo.
      ['flexion-rodillas', 'volumen'],
      ['remo-australiano-bajo', 'cadena'],
      // No es el eslabón actual de piernas: no puede leer esa cadena.
      ['sentadilla-completa', 'fijo'],
    ])
  })

  it('es del plan, y sigue sin hora de inicio', () => {
    const nuevo = normalizarBorrador(borradorV3(), AVANCES)
    expect(nuevo.origen).toEqual({ clase: 'plan', nombre: 'Plan' })
    // Ningún campo viejo guarda la hora de arranque: no se inventa.
    expect('iniciadaEn' in nuevo).toBe(false)
  })

  it('la corta de antes es "Solo tengo 7 minutos", como en el historial', () => {
    expect(origenDelBorrador({ corta: true })).toEqual({
      clase: 'rapida',
      cual: 'corta',
      nombre: 'Solo tengo 7 minutos',
    })
  })

  it('el mismo ejercicio dos veces no cuenta sus series dos veces', () => {
    const b = borrador({
      pasos: [
        { ejercicioId: 'puente-gluteos', objetivo: { series: 3, cantidad: 10 } },
        { ejercicioId: 'puente-gluteos', objetivo: { series: 2, cantidad: 10 } },
      ],
    })
    const pasos = normalizarBorrador(b, []).pasos!
    expect(pasos.map((p) => p.id)).toEqual(['puente-gluteos', 'puente-gluteos#2'])
    const cierre = cierreDelBorrador({ ...b, pasos }, { historial: [], objetivoDe: () => undefined })
    expect(cierre.registros.flatMap((r) => r.series)).toEqual(b.hechas['puente-gluteos'])
  })

  it('lo que ya trae no se toca', () => {
    const origen: OrigenDeSesion = { clase: 'mix', sector: 'pecho', nombre: 'Mix de pecho', version: 'corta' }
    const b = borrador({
      origen,
      iniciadaEn: 5,
      pasos: [
        { id: 'p1', clase: 'fijo', ejercicioId: 'puente-gluteos', objetivo: { series: 3, cantidad: 10 } },
      ],
    })
    expect(normalizarBorrador(b, [{ ejercicioId: 'puente-gluteos' }])).toEqual(b)
  })

  it('un paso nuevo lee sus series por id de paso, y lleva sus marcas al registro', () => {
    const cierre = cierreDelBorrador(
      borrador({
        pasos: [
          { id: 'a', clase: 'fijo', fijo: true, ejercicioId: 'puente-gluteos', objetivo: { series: 2, cantidad: 10 } },
          { id: 'b', clase: 'cadena', ejercicioId: 'puente-gluteos', objetivo: { series: 3, cantidad: 12 } },
        ],
        hechas: { a: [{ logrado: 10 }], b: [{ logrado: 12 }, { logrado: 11 }] },
      }),
      { historial: [], objetivoDe: () => undefined },
    )
    expect(cierre.registros).toEqual([
      { ejercicioId: 'puente-gluteos', paso: 'a', fijo: true, objetivo: { series: 2, cantidad: 10 }, series: [{ logrado: 10 }] },
      { ejercicioId: 'puente-gluteos', paso: 'b', objetivo: { series: 3, cantidad: 12 }, series: [{ logrado: 12 }, { logrado: 11 }] },
    ])
  })
})

describe('si lo que se empieza es la misma sesión', () => {
  const plan: OrigenDeSesion = { clase: 'plan', nombre: 'Plan' }
  const rutina: OrigenDeSesion = { clase: 'rutina', rutinaId: 'r1', nombre: 'Pecho en casa' }

  it('la misma cosa, aunque cambie el nombre', () => {
    expect(mismaSesion({ corta: false, origen: rutina }, { ...rutina, nombre: 'Pecho' })).toBe(true)
    expect(mismaSesion({ corta: false, origen: plan }, plan)).toBe(true)
  })

  it('otra rutina, otra zona, otra versión u otra cosa no lo son', () => {
    expect(mismaSesion({ corta: false, origen: rutina }, { ...rutina, rutinaId: 'r2' })).toBe(false)
    expect(mismaSesion({ corta: false, origen: rutina }, { ...rutina, liviana: true })).toBe(false)
    const mix: OrigenDeSesion = { clase: 'mix', sector: 'pecho', nombre: 'Mix de pecho', version: 'completa' }
    expect(mismaSesion({ corta: false, origen: mix }, { ...mix, version: 'corta' })).toBe(false)
    expect(mismaSesion({ corta: false, origen: mix }, { ...mix, sector: 'brazos' })).toBe(false)
    expect(mismaSesion({ corta: false, origen: mix }, plan)).toBe(false)
  })

  it('un borrador viejo cuenta con lo que era: la corta no es el plan', () => {
    expect(mismaSesion({ corta: false }, plan)).toBe(true)
    expect(mismaSesion({ corta: true }, plan)).toBe(false)
    expect(
      mismaSesion({ corta: true }, { clase: 'rapida', cual: 'corta', nombre: 'Solo tengo 7 minutos' }),
    ).toBe(true)
  })
})

describe('la hora de inicio', () => {
  it('la escribe la primera serie y después no se mueve', () => {
    expect(iniciadaEn(null, 100)).toBe(100)
    expect(iniciadaEn(borrador({ hechas: {} }), 100)).toBe(100)
    expect(iniciadaEn(borrador({ iniciadaEn: 40 }), 100)).toBe(40)
  })

  it('un borrador viejo con trabajo adentro sigue sin hora: no se inventa', () => {
    expect(iniciadaEn(borrador(), 100)).toBeUndefined()
  })

  it('tampoco uno viejo con solo una serie en 0 o una ráfaga: ya había empezado', () => {
    expect(iniciadaEn(borrador({ hechas: { 'puente-gluteos': [{ logrado: 0 }] } }), 100)).toBeUndefined()
    expect(
      iniciadaEn(borrador({ hechas: {}, rafagas: [{ rafagaId: 'jumping-jacks', segundos: 20, despuesDe: null }] }), 100),
    ).toBeUndefined()
    expect(iniciadaEn(borrador({ hechas: { 'puente-gluteos': [] } }), 100)).toBe(100)
  })
})

describe('guardar desde afuera', () => {
  it('lo dice el cierre, y solo cuando se pide', () => {
    const b = borrador()
    expect(cierreDelBorrador(b, { historial: [], objetivoDe: () => undefined }).desdeAfuera).toBeUndefined()
    expect(
      cierreDelBorrador(b, { historial: [], objetivoDe: () => undefined, desdeAfuera: true }).desdeAfuera,
    ).toBe(true)
  })
})
