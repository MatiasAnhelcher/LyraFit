import { describe, expect, it } from 'vitest'
import { cuentaComoSesion as cuentaDesdeAdherencia } from './adherencia'
import { CADENAS, POR_ID } from './biblioteca'
import {
  SESIONES_PARA_EL_RESUMEN,
  TOPE_DE_SUGERENCIAS,
  cuentaComoSesion,
  cuentaDelDia,
  esDeFuerza,
  esMovilidad,
  estadoDeHoy,
  fuerzaHoy,
  inicioDe,
  origenDe,
  planDeHoyHecho,
  planPendiente,
  planSemanal,
  resumenDelCierre,
  resumenDelDia,
  sePuedeRepetir,
  sesionesDelDia,
  sugerenciasDeHoy,
  type Sugerencia,
} from './dia'
import { equipoDe } from './equipo'
import { mixesConTrabajo } from './mixes'
import { semanaActiva } from './rutinas'
import {
  ZONAS,
  seriesDeZona,
  sugerirZona,
  ultimaVezDeZona,
  zonaSinSeries,
  type MixConTrabajo,
  type Zona,
} from './sectores'
import type { Avance, Equipo, OrigenDeSesion, Patron, RegistroEjercicio, Sector, Semana, Sesion } from './tipos'

/**
 * El día decide qué muestra Hoy y qué sugiere Entrenar, así que lo que más
 * importa probar es lo que el booleano de antes hacía mal: un tabata que daba
 * el día por entrenado, un mix que daba el plan por hecho, y una lista de
 * horas que se desordena o se corre de día a la medianoche.
 */

/** Miércoles 21 de octubre de 2026. */
const HOY = '2026-10-21'
const AYER = '2026-10-20'
const MANANA = '2026-10-22'

/** Lunes, miércoles y viernes de fuerza: hoy toca, mañana es descanso. */
const LMV: Semana = {
  1: 'fuerza',
  2: 'descanso',
  3: 'fuerza',
  4: 'descanso',
  5: 'fuerza',
  6: 'descanso',
  7: 'descanso',
}

const EQUIPO = equipoDe({})

/** El mismo eslabón en las cinco cadenas, con el objetivo en lo bajo de la ventana. */
function avancesEn(n: number): Map<Patron, Pick<Avance, 'ejercicioId' | 'objetivoActual'>> {
  const avances = new Map<Patron, Pick<Avance, 'ejercicioId' | 'objetivoActual'>>()
  for (const cadena of CADENAS) {
    const id = cadena.ejercicios[Math.min(n, cadena.ejercicios.length) - 1]!
    avances.set(cadena.patron, { ejercicioId: id, objetivoActual: { series: 3, cantidad: POR_ID.get(id)!.ventana.min } })
  }
  return avances
}

/** Si cada mix tiene trabajo, para alguien con el mismo eslabón en las cinco cadenas. */
const enElEslabon = (n: number, equipo: readonly Equipo[] = EQUIPO): MixConTrabajo =>
  mixesConTrabajo({ avances: avancesEn(n), equipo, historial: [], hoy: HOY })

/** En el eslabón 5 los ocho mixes tienen trabajo: sugiere como si no hubiera filtro. */
const HAY_TRABAJO = enElEslabon(5)

/** Un instante de ese día, en la hora local de quien corre el test. */
const a = (fecha: string, h: number, m = 0) =>
  new Date(`${fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime()

type Registro = [ejercicioId: string, series: number, extra?: Partial<RegistroEjercicio>]

let siguiente = 0
function sesion(fecha: string, registros: Registro[], extra: Partial<Sesion> = {}): Sesion {
  siguiente++
  return {
    id: `s${String(siguiente).padStart(3, '0')}`,
    fecha,
    finalizadaEn: a(fecha, 10),
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

/** Empezó a las `h:m` y cerró media hora después. */
const aLas = (fecha: string, h: number, m = 0): Partial<Sesion> => ({
  iniciadaEn: a(fecha, h, m),
  finalizadaEn: a(fecha, h, m) + 30 * 60_000,
})

const PLAN: OrigenDeSesion = { clase: 'plan', nombre: 'Cuerpo completo' }
const mix = (sector: 'brazos' | 'pecho' | 'gluteos' | 'espalda' | 'hombros'): OrigenDeSesion => ({
  clase: 'mix',
  sector,
  nombre: `Mix de ${sector}`,
  version: 'completa',
})

const CUERPO: Registro[] = [
  ['dominada-completa', 3],
  ['flexion-completa', 3],
  ['sentadilla-completa', 3],
  ['plancha', 3],
]

const delPlan = (fecha: string, h = 9, m = 10) =>
  sesion(fecha, CUERPO, { origen: PLAN, ...aLas(fecha, h, m) })
const deBrazos = (fecha: string, h = 9, m = 10) =>
  sesion(fecha, [['dominada-completa', 3], ['flexion-diamante', 3]], {
    origen: mix('brazos'),
    ...aLas(fecha, h, m),
  })
const tabata = (fecha: string, h = 9) =>
  sesion(fecha, [['flexion-completa', 8, { reloj: true }]], {
    tipo: 'reloj',
    origen: { clase: 'rapida', cual: 'reloj', nombre: 'Tabata' },
    ...aLas(fecha, h),
  })
const movilidad = (fecha: string, sector: 'espalda' | 'pecho' | 'gluteos' = 'espalda', h = 12) =>
  sesion(fecha, [], {
    tipo: 'fuelle',
    origen: { clase: 'movilidad', sector, nombre: `Movilidad de ${sector}` },
    movilidad: [{ ejercicioId: 'gato-vaca', logrado: [10, 10] }],
    duracionSegundos: 300,
    ...aLas(fecha, h),
  })
const fuelleDeRapidas = (fecha: string, h = 9) =>
  sesion(fecha, [], {
    tipo: 'fuelle',
    origen: { clase: 'rapida', cual: 'fuelle', nombre: 'El fuelle' },
    rafagas: [{ rafagaId: 'burpee', segundos: 40, despuesDe: null }],
    ...aLas(fecha, h),
  })
/** Una sesión de antes de la reestructura: sin origen y sin hora de inicio. */
const vieja = (fecha: string, tipo: Sesion['tipo'] = 'plan', h = 18) =>
  sesion(fecha, tipo === 'reloj' ? [['flexion-completa', 8, { reloj: true }]] : CUERPO, {
    tipo,
    finalizadaEn: a(fecha, h),
  })

// ─── De dónde salió y a qué hora ───────────────────────────────────────

describe('de dónde salió una sesión', () => {
  it('el origen guardado manda', () => {
    expect(origenDe(deBrazos(HOY))).toEqual(mix('brazos'))
  })

  it('una vieja lo deduce de su tipo, sin escribir nada', () => {
    expect(origenDe(vieja(HOY, 'reloj'))).toEqual({ clase: 'rapida', cual: 'reloj', nombre: 'Reloj' })
    expect(origenDe(vieja(HOY, 'corta'))).toEqual({
      clase: 'rapida',
      cual: 'corta',
      nombre: 'Solo tengo 7 minutos',
    })
    // El fuelle era el día de fuelle del plan; plan y vuelta, el plan.
    for (const tipo of ['fuelle', 'plan', 'vuelta'] as const) {
      expect(origenDe(vieja(HOY, tipo)), tipo).toEqual({ clase: 'plan', nombre: 'Plan' })
    }
    const sinTocar = vieja(HOY)
    origenDe(sinTocar)
    expect(sinTocar.origen).toBeUndefined()
  })
})

describe('a qué hora empezó', () => {
  it('con iniciadaEn, esa', () => {
    const s = sesion(HOY, CUERPO, aLas(HOY, 9, 10))
    expect(inicioDe(s)).toEqual({ hora: a(HOY, 9, 10), esDeCierre: false })
  })

  it('sin iniciadaEn, la de cierre, marcada como tal', () => {
    // Nunca el cierre menos la duración: al retomar, la duración se re-ancla.
    const s = vieja(HOY, 'plan', 9)
    expect(inicioDe(s)).toEqual({ hora: a(HOY, 9), esDeCierre: true })
    expect(inicioDe(s).hora).not.toBe(s.finalizadaEn - s.duracionSegundos * 1000)
  })

  it('un inicio después del cierre no es un inicio: va la de cierre', () => {
    const s = sesion(HOY, CUERPO, { finalizadaEn: a(HOY, 9), iniciadaEn: a(HOY, 11) })
    expect(inicioDe(s)).toEqual({ hora: a(HOY, 9), esDeCierre: true })
  })
})

// ─── Las sesiones del día ──────────────────────────────────────────────

describe('las sesiones del día', () => {
  // Arrancó el miércoles a las 23:40 y cerró el jueves a las 00:05: es del
  // miércoles, que es el día en que se entrenó.
  const trasnoche = sesion(HOY, CUERPO, { iniciadaEn: a(HOY, 23, 40), finalizadaEn: a(MANANA, 0, 5) })
  const temprano = sesion(MANANA, CUERPO, aLas(MANANA, 0, 20))
  const manana = delPlan(HOY, 9, 10)
  // Una vieja cerrada a las 13:30: va por su hora de cierre.
  const mediodia = vieja(HOY, 'plan', 13)
  const tarde = movilidad(HOY, 'espalda', 19)
  const historial = [trasnoche, temprano, tarde, mediodia, manana, delPlan(AYER)]

  it('en el cambio de día, cada una queda en el día en que se entrenó', () => {
    expect(sesionesDelDia(historial, HOY).map((s) => s.id)).toEqual([
      manana.id,
      mediodia.id,
      tarde.id,
      trasnoche.id,
    ])
    expect(sesionesDelDia(historial, MANANA).map((s) => s.id)).toEqual([temprano.id])
  })

  it('van en el orden en que empezaron, venga como venga el historial', () => {
    const horas = sesionesDelDia(historial, HOY).map((s) => inicioDe(s).hora)
    expect(horas).toEqual([...horas].sort((x, y) => x - y))
    expect(sesionesDelDia([...historial].reverse(), HOY)).toEqual(sesionesDelDia(historial, HOY))
  })

  it('la movilidad tiene su fila, pero se cuenta aparte', () => {
    expect(sesionesDelDia(historial, HOY)).toContain(tarde)
    expect(cuentaDelDia(historial, HOY)).toEqual({ sesiones: 3, movilidades: 1 })
    expect(cuentaDelDia([movilidad(HOY), movilidad(HOY, 'pecho', 18)], HOY)).toEqual({
      sesiones: 0,
      movilidades: 2,
    })
    expect(cuentaDelDia(historial, '2026-10-01')).toEqual({ sesiones: 0, movilidades: 0 })
  })
})

// ─── Por zona ──────────────────────────────────────────────────────────

describe('el día por zona', () => {
  const nueve = sesion(HOY, CUERPO, aLas(HOY, 9, 10))
  const unaYMedia = sesion(HOY, [['puente-una-pierna-elevado', 4]], aLas(HOY, 13, 30))
  const siete = sesion(
    HOY,
    [
      ['remo-australiano-medio', 4],
      // La entrada en calor no es trabajo: no suma a ninguna zona.
      ['flexion-rodillas', 2, { calentamiento: true }],
    ],
    aLas(HOY, 19, 5),
  )
  const delDia = [nueve, unaYMedia, siete]
  const historial = [...delDia, movilidad(HOY), sesion(AYER, [['flexion-completa', 10]])]

  it('da lo mismo que seriesDeZona, zona por zona', () => {
    const resumen = resumenDelDia(historial, HOY)
    for (const zona of ZONAS) {
      const series = seriesDeZona(zona, historial, HOY, 1)
      const fila = resumen.find((z) => z.zona === zona)
      if (series === 0) expect(fila, zona).toBeUndefined()
      else expect(fila?.series, zona).toBe(series)
    }
    expect(resumen.length).toBeGreaterThan(0)
  })

  it('va de la más trabajada a la menos', () => {
    const resumen = resumenDelDia(historial, HOY)
    // Siete de dorsal (tres de dominada y cuatro de remo): espalda primero.
    expect(resumen[0]).toEqual({ zona: 'espalda', series: 7 })
    for (let i = 1; i < resumen.length; i++) {
      expect(resumen[i - 1]!.series).toBeGreaterThanOrEqual(resumen[i]!.series)
    }
  })

  it('una zona en cero no aparece, y ni la movilidad ni otro día suman', () => {
    const soloPecho = resumenDelDia([sesion(HOY, [['flexion-completa', 3]])], HOY)
    expect(soloPecho.map((z) => z.zona)).not.toContain('piernas')
    expect(resumenDelDia([...delDia, movilidad(HOY)], HOY)).toEqual(resumenDelDia(delDia, HOY))
    expect(resumenDelDia(historial, HOY)).toEqual(resumenDelDia(delDia, HOY))
    expect(resumenDelDia([movilidad(HOY)], HOY)).toEqual([])
  })

  it('el Cierre lo suma desde la tercera sesión que cuenta', () => {
    expect(SESIONES_PARA_EL_RESUMEN).toBe(3)
    // Dos sesiones y una movilidad son dos sesiones.
    const laMovilidad = movilidad(HOY)
    expect(resumenDelCierre([nueve, unaYMedia, laMovilidad], HOY, unaYMedia)).toBeNull()
    expect(resumenDelCierre(delDia, HOY, siete)).toEqual(resumenDelDia(delDia, HOY))
    // Tres fuelles de ráfagas no tienen nada que decir por zona.
    const fuelles = [fuelleDeRapidas(HOY, 8), fuelleDeRapidas(HOY, 12), fuelleDeRapidas(HOY, 18)]
    expect(resumenDelCierre(fuelles, HOY, fuelles[2]!)).toBeNull()
  })
})

// ─── El estado de Hoy ──────────────────────────────────────────────────

describe('si hoy hubo fuerza', () => {
  it('un tabata, una movilidad y un fuelle de RÁPIDAS no la cumplen', () => {
    expect(fuerzaHoy([tabata(HOY)], HOY)).toBe(false)
    expect(fuerzaHoy([movilidad(HOY)], HOY)).toBe(false)
    expect(fuerzaHoy([fuelleDeRapidas(HOY)], HOY)).toBe(false)
    expect(fuerzaHoy([tabata(HOY), movilidad(HOY), fuelleDeRapidas(HOY)], HOY)).toBe(false)
    // El Reloj de antes, sin origen, tampoco.
    expect(fuerzaHoy([vieja(HOY, 'reloj')], HOY)).toBe(false)
  })

  it('un mix, el plan y una sesión vieja sin origen sí', () => {
    expect(fuerzaHoy([deBrazos(HOY)], HOY)).toBe(true)
    expect(fuerzaHoy([delPlan(HOY)], HOY)).toBe(true)
    expect(fuerzaHoy([vieja(HOY)], HOY)).toBe(true)
    expect(fuerzaHoy([vieja(HOY, 'corta')], HOY)).toBe(true)
  })

  it('solo hoy, y solo con trabajo anotado', () => {
    expect(fuerzaHoy([deBrazos(AYER)], HOY)).toBe(false)
    const calentamiento = sesion(HOY, [['flexion-rodillas', 2, { calentamiento: true }]], { origen: PLAN })
    expect(esDeFuerza(calentamiento)).toBe(false)
    const enCero = sesion(HOY, [['flexion-completa', 3]], { origen: PLAN })
    enCero.registros[0]!.series = [{ logrado: 0 }]
    expect(esDeFuerza(enCero)).toBe(false)
    // Un ejercicio que ya no está en la biblioteca sigue siendo fuerza.
    expect(esDeFuerza(sesion(HOY, [['retirado-hace-tiempo', 3]], { origen: PLAN }))).toBe(true)
  })
})

describe('si hoy se hizo el plan', () => {
  it('solo con una sesión de origen plan', () => {
    expect(planDeHoyHecho([delPlan(HOY)], HOY)).toBe(true)
    expect(planDeHoyHecho([deBrazos(HOY)], HOY)).toBe(false)
    expect(planDeHoyHecho([tabata(HOY), movilidad(HOY)], HOY)).toBe(false)
    expect(planDeHoyHecho([delPlan(AYER)], HOY)).toBe(false)
  })

  it('una vieja sin origen cuenta como el plan que era', () => {
    expect(planDeHoyHecho([vieja(HOY)], HOY)).toBe(true)
    expect(planDeHoyHecho([vieja(HOY, 'vuelta')], HOY)).toBe(true)
    expect(planDeHoyHecho([vieja(HOY, 'fuelle')], HOY)).toBe(true)
    // La corta y el Reloj de antes no eran el plan.
    expect(planDeHoyHecho([vieja(HOY, 'corta')], HOY)).toBe(false)
    expect(planDeHoyHecho([vieja(HOY, 'reloj')], HOY)).toBe(false)
  })

  it('el día de fuelle del plan también, y la versión liviana del plan también', () => {
    const fuelleDelPlan = sesion(HOY, [], { tipo: 'fuelle', origen: PLAN })
    expect(planDeHoyHecho([fuelleDelPlan], HOY)).toBe(true)
    const liviana = sesion(HOY, CUERPO, { tipo: 'corta', origen: { ...PLAN, liviana: true } })
    expect(planDeHoyHecho([liviana], HOY)).toBe(true)
  })
})

describe('si el plan sigue pendiente', () => {
  it('después de un mix de Brazos, sigue', () => {
    expect(planPendiente(LMV, [], HOY)).toBe(true)
    expect(planPendiente(LMV, [deBrazos(HOY)], HOY)).toBe(true)
    expect(planPendiente(LMV, [tabata(HOY), movilidad(HOY)], HOY)).toBe(true)
    expect(planPendiente(LMV, [deBrazos(HOY), delPlan(HOY, 19)], HOY)).toBe(false)
  })

  it('en un día de descanso, y sin plan, no', () => {
    expect(planPendiente(LMV, [], MANANA)).toBe(false)
    expect(planPendiente(null, [], HOY)).toBe(false)
  })

  it('un día de fuelle del plan también espera, hasta que se hace', () => {
    const conFuelle: Semana = { ...LMV, 3: 'fuelle' }
    expect(planPendiente(conFuelle, [], HOY)).toBe(true)
    const fuelleDelPlan = sesion(HOY, [], { tipo: 'fuelle', origen: PLAN })
    expect(planPendiente(conFuelle, [fuelleDelPlan], HOY)).toBe(false)
  })

  it('sin plan es null, y con plan la semana que corre', () => {
    const preferencias = { rutinaActivaId: 'cuerpo-completo' }
    expect(planSemanal({ ...preferencias, modoPlan: 'libre' })).toBeNull()
    expect(planSemanal({ ...preferencias, modoPlan: 'semana' })).toEqual(semanaActiva(preferencias))
    expect(planSemanal(preferencias)).toEqual(semanaActiva(preferencias))
    expect(planSemanal({ ...preferencias, semana: LMV })).toEqual(LMV)
  })
})

describe('el estado de Hoy', () => {
  it('A con el plan pendiente y nada de fuerza; un tabata no lo cambia', () => {
    expect(estadoDeHoy(LMV, [], HOY)).toEqual({ estado: 'A', descanso: false })
    expect(estadoDeHoy(LMV, [tabata(HOY), movilidad(HOY)], HOY)).toEqual({ estado: 'A', descanso: false })
  })

  it('B después de un mix, aunque el plan siga pendiente', () => {
    const historial = [deBrazos(HOY)]
    expect(estadoDeHoy(LMV, historial, HOY).estado).toBe('B')
    expect(planPendiente(LMV, historial, HOY)).toBe(true)
  })

  it('B con el plan hecho y en el día de descanso, que se dice', () => {
    expect(estadoDeHoy(LMV, [delPlan(HOY)], HOY)).toEqual({ estado: 'B', descanso: false })
    expect(estadoDeHoy(LMV, [], MANANA)).toEqual({ estado: 'B', descanso: true })
    expect(estadoDeHoy(LMV, [deBrazos(MANANA)], MANANA)).toEqual({ estado: 'B', descanso: true })
  })

  it('sin plan, A hasta que hay fuerza', () => {
    expect(estadoDeHoy(null, [], HOY)).toEqual({ estado: 'A', descanso: false })
    expect(estadoDeHoy(null, [tabata(HOY)], HOY).estado).toBe('A')
    expect(estadoDeHoy(null, [deBrazos(HOY)], HOY).estado).toBe('B')
  })
})

// ─── Lo que cuenta como sesión ─────────────────────────────────────────

describe('qué cuenta como sesión', () => {
  it('todo menos la movilidad, y es la misma regla que la adherencia', () => {
    expect(cuentaComoSesion).toBe(cuentaDesdeAdherencia)
    expect(cuentaComoSesion(movilidad(HOY))).toBe(false)
    expect(esMovilidad(movilidad(HOY))).toBe(true)
    for (const s of [delPlan(HOY), deBrazos(HOY), tabata(HOY), fuelleDeRapidas(HOY), vieja(HOY), vieja(HOY, 'fuelle')]) {
      expect(cuentaComoSesion(s), s.origen?.clase ?? s.tipo).toBe(true)
      expect(esMovilidad(s)).toBe(false)
    }
  })
})

// ─── Lo que Entrenar sugiere ───────────────────────────────────────────

/** Lo que no puede pasar en ninguna lista de PARA VOS HOY. */
function revisarSugerencias(tarjetas: Sugerencia[], historial: Sesion[], conTrabajo: MixConTrabajo = HAY_TRABAJO) {
  expect(tarjetas.length).toBeLessThanOrEqual(TOPE_DE_SUGERENCIAS)
  // Sin repetidas: ni dos de la misma clase ni dos mixes de la misma zona.
  const clases = tarjetas.map((t) => t.clase)
  expect(new Set(clases).size).toBe(clases.length)
  const sectores = tarjetas.flatMap((t) => {
    if (t.clase === 'para-hoy' || t.clase === 'otra-zona') return [t.sector]
    if (t.clase === 'repetir') {
      const origen = origenDe(t.sesion)
      return origen.clase === 'mix' ? [origen.sector] : []
    }
    return []
  })
  expect(new Set(sectores).size).toBe(sectores.length)
  // En el orden de siempre.
  const orden = ['plan', 'para-hoy', 'otra-zona', 'repetir', 'movilidad']
  const posiciones = clases.map((c) => orden.indexOf(c))
  expect(posiciones).toEqual([...posiciones].sort((x, y) => x - y))
  // Sin ninguna sin dato, y sin lo de hoy en REPETIR.
  for (const t of tarjetas) {
    if (t.clase === 'repetir') {
      expect(t.sesion.fecha < HOY).toBe(true)
      expect(cuentaComoSesion(t.sesion)).toBe(true)
      expect(sePuedeRepetir(t.sesion)).toBe(true)
    }
    if (t.clase === 'movilidad') {
      expect(historial.some((s) => s.fecha === HOY && cuentaComoSesion(s))).toBe(true)
    }
    if (t.clase === 'otra-zona') {
      expect(historial.some((s) => s.fecha <= HOY && cuentaComoSesion(s))).toBe(true)
    }
    // "<Zona>: no hay sesiones anotadas todavía." solo si es verdad.
    if (t.clase === 'para-hoy' || t.clase === 'otra-zona') {
      expect(t.sinSeries, t.sector).toBe(zonaSinSeries(t.sector, historial))
      if (t.ultimaVez !== null) expect(t.sinSeries, t.sector).toBe(false)
    }
    // Ninguna empieza un mix vacío.
    const origen = t.clase === 'repetir' ? origenDe(t.sesion) : null
    if (t.clase === 'para-hoy' || t.clase === 'otra-zona') expect(conTrabajo(t.sector), t.sector).toBe(true)
    if (origen?.clase === 'mix') expect(conTrabajo(origen.sector, origen.version), origen.sector).toBe(true)
  }
}

describe('lo que Entrenar sugiere', () => {
  it('el primer día, una sola tarjeta: el plan, o sin plan Cuerpo completo', () => {
    const conPlan = sugerenciasDeHoy({ historial: [], hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(conPlan).toEqual([{ clase: 'plan' }])
    const sinPlan = sugerenciasDeHoy({ historial: [], hoy: HOY, semana: null, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(sinPlan).toEqual([{ clase: 'para-hoy', sector: 'cuerpo', ultimaVez: null, sinSeries: true }])
    // Una movilidad no es un primer día que terminó.
    const conMovilidad = [movilidad(HOY)]
    expect(sugerenciasDeHoy({ historial: conMovilidad, hoy: HOY, semana: null, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })).toEqual([
      { clase: 'para-hoy', sector: 'cuerpo', ultimaVez: null, sinSeries: true },
    ])
  })

  it('EL PLAN DE HOY sigue primero después de un mix de Brazos', () => {
    const historial = [delPlan('2026-10-19'), deBrazos(AYER, 19, 5), deBrazos(HOY)]
    const tarjetas = sugerenciasDeHoy({ historial, hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(tarjetas[0]).toEqual({ clase: 'plan' })
    revisarSugerencias(tarjetas, historial)
    // Y se va cuando se hace el plan.
    const conPlan = [...historial, delPlan(HOY, 19)]
    const despues = sugerenciasDeHoy({ historial: conPlan, hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(despues.map((t) => t.clase)).not.toContain('plan')
    revisarSugerencias(despues, conPlan)
  })

  it('OTRA ZONA es la de sugerirZona, sin la de la primera tarjeta', () => {
    const historial = [delPlan('2026-10-19'), deBrazos(AYER)]
    const sinPlan = sugerenciasDeHoy({ historial, hoy: HOY, semana: null, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    const primera = sinPlan[0]
    if (primera?.clase !== 'para-hoy') throw new Error('sin plan, primero va PARA HOY')
    expect(primera.sector).toBe(sugerirZona(historial, HOY, EQUIPO))
    const otra = sinPlan.find((t) => t.clase === 'otra-zona')
    if (otra?.clase !== 'otra-zona') throw new Error('se esperaba OTRA ZONA')
    expect(otra.sector).toBe(sugerirZona(historial, HOY, EQUIPO, primera.sector))
    expect(otra.sector).not.toBe(primera.sector)
    revisarSugerencias(sinPlan, historial)
  })

  it('sin plan y con fuerza hoy, no hay PARA HOY', () => {
    const historial = [delPlan(AYER), deBrazos(HOY)]
    const tarjetas = sugerenciasDeHoy({ historial, hoy: HOY, semana: null, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(tarjetas.map((t) => t.clase)).not.toContain('para-hoy')
    const otra = tarjetas[0]
    if (otra?.clase !== 'otra-zona') throw new Error('se esperaba OTRA ZONA primero')
    expect(otra.sector).toBe(sugerirZona(historial, HOY, EQUIPO))
    revisarSugerencias(tarjetas, historial)
  })

  it('REPETIR es la última antes de hoy, nunca una de hoy', () => {
    const anteayer = deBrazos('2026-10-19', 19)
    const ayerTemprano = delPlan(AYER, 8)
    const ayerTarde = sesion(AYER, [['remo-australiano-medio', 3]], { origen: mix('espalda'), ...aLas(AYER, 19, 5) })
    const historial = [anteayer, ayerTarde, ayerTemprano, delPlan(HOY)]
    const tarjetas = sugerenciasDeHoy({ historial, hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    const repetir = tarjetas.find((t) => t.clase === 'repetir')
    if (repetir?.clase !== 'repetir') throw new Error('se esperaba REPETIR')
    expect(repetir.sesion).toBe(ayerTarde)
    revisarSugerencias(tarjetas, historial)
  })

  it('REPETIR saltea el Reloj, el fuelle de RÁPIDAS y la movilidad', () => {
    const base = delPlan('2026-10-16')
    const historial = [base, tabata(AYER, 19), fuelleDeRapidas(AYER, 20), movilidad(AYER, 'espalda', 21), vieja(AYER, 'reloj', 22)]
    expect(sePuedeRepetir(tabata(AYER))).toBe(false)
    expect(sePuedeRepetir(fuelleDeRapidas(AYER))).toBe(false)
    expect(sePuedeRepetir(vieja(AYER, 'reloj'))).toBe(false)
    expect(sePuedeRepetir(vieja(AYER, 'corta'))).toBe(true)
    expect(sePuedeRepetir(movilidad(AYER))).toBe(true)
    const tarjetas = sugerenciasDeHoy({ historial, hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    const repetir = tarjetas.find((t) => t.clase === 'repetir')
    if (repetir?.clase !== 'repetir') throw new Error('se esperaba REPETIR')
    expect(repetir.sesion).toBe(base)
  })

  it('MOVILIDAD es de la zona más trabajada hoy, y no si ya se hizo', () => {
    const espalda = sesion(HOY, [['remo-australiano-medio', 4], ['dominada-completa', 3]], aLas(HOY, 9))
    const historial = [delPlan(HOY, 13), espalda]
    // Con el plan hecho, la primera tarjeta no está y la movilidad entra.
    const tarjetas = sugerenciasDeHoy({ historial, hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(tarjetas).toContainEqual({ clase: 'movilidad', sector: resumenDelDia(historial, HOY)[0]!.zona })
    expect(tarjetas).toContainEqual({ clase: 'movilidad', sector: 'espalda' })
    revisarSugerencias(tarjetas, historial)
    // Hecha la movilidad de espalda, no se vuelve a proponer.
    const conMovilidad = [...historial, movilidad(HOY, 'espalda', 19)]
    const despues = sugerenciasDeHoy({ historial: conMovilidad, hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(despues.map((t) => t.clase)).not.toContain('movilidad')
    // Sin sesión hoy, tampoco.
    const sinHoy = sugerenciasDeHoy({ historial: [delPlan(AYER)], hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(sinHoy.map((t) => t.clase)).not.toContain('movilidad')
  })

  it('con las cuatro, la cuarta no entra', () => {
    // Plan pendiente, otra zona, una de ayer y fuerza hoy (un mix de Brazos).
    const historial = [delPlan('2026-10-19'), deBrazos(AYER, 19), deBrazos(HOY)]
    expect(resumenDelDia(historial, HOY).length).toBeGreaterThan(0)
    const tarjetas = sugerenciasDeHoy({ historial, hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(tarjetas.map((t) => t.clase)).toEqual(['plan', 'otra-zona', 'repetir'])
  })

  it('un mix que ya está arriba no vuelve como REPETIR', () => {
    // Armado a propósito para que coincidan: ayer fue un "mix de glúteos" y
    // hoy la zona sugerida es Glúteos, la menos trabajada de la semana (solo
    // el medio aporte de la sentadilla). Empezar cualquiera de las dos es la
    // misma sesión.
    const historial = [
      sesion('2026-10-15', [
        ['flexion-completa', 3],
        ['flexion-declinada', 3],
        ['remo-australiano-medio', 3],
        ['flexion-diamante', 3],
        ['plancha', 3],
        ['sentadilla-completa', 3],
      ], { origen: PLAN }),
      sesion(AYER, [['plancha', 3]], { origen: mix('gluteos'), ...aLas(AYER, 19) }),
    ]
    const sugerida = sugerirZona(historial, HOY, EQUIPO)
    expect(sugerida).toBe('gluteos')
    const tarjetas = sugerenciasDeHoy({ historial, hoy: HOY, semana: null, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(tarjetas[0]).toMatchObject({ clase: 'para-hoy', sector: 'gluteos' })
    expect(tarjetas.map((t) => t.clase)).not.toContain('repetir')
    revisarSugerencias(tarjetas, historial)
  })

  it('la misma entrada da siempre las mismas tarjetas', () => {
    const historial = [delPlan('2026-10-19'), deBrazos(AYER, 19), deBrazos(HOY), movilidad(AYER)]
    const una = sugerenciasDeHoy({ historial, hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    const otra = sugerenciasDeHoy({ historial: [...historial].reverse(), hoy: HOY, semana: LMV, equipo: new Set(EQUIPO), conTrabajo: HAY_TRABAJO })
    expect(otra).toEqual(una)
  })
})

describe('el Cierre de una movilidad', () => {
  it('no lleva el resumen por zona, aunque haya tres sesiones antes en el día', () => {
    const tres = [
      sesion(HOY, CUERPO, aLas(HOY, 8)),
      sesion(HOY, [['remo-australiano-medio', 4]], aLas(HOY, 12)),
      sesion(HOY, [['sentadilla-completa', 3]], aLas(HOY, 17)),
    ]
    const laMovilidad = movilidad(HOY, 'espalda', 20)
    const historial = [...tres, laMovilidad]
    // Tres que cuentan: el Cierre de la tercera lo lleva.
    expect(resumenDelCierre(historial, HOY, tres[2]!)).toEqual(resumenDelDia(historial, HOY))
    // La movilidad no es la tercera de nada (§4.15).
    expect(resumenDelCierre(historial, HOY, laMovilidad)).toBeNull()
  })
})

describe('nunca sugiere un mix vacío', () => {
  /** Lo que más carga a cada zona entre lo que ya está en la biblioteca. */
  const DE_LA_ZONA: Record<Zona, string> = {
    pecho: 'flexion-completa',
    espalda: 'remo-australiano-medio',
    hombros: 'flexion-pseudoplancha',
    brazos: 'curl-barra',
    core: 'plancha',
    piernas: 'sentadilla-completa',
    gluteos: 'puente-gluteos',
  }
  const todasMenos = (zona: Zona, fecha = AYER) =>
    sesion(fecha, ZONAS.filter((z) => z !== zona).map((z): Registro => [DE_LA_ZONA[z], 3]), aLas(fecha, 18))
  /** Ayer, el mix de Hombros de alguien que tenía discos o estaba más arriba. */
  const deHombros = sesion(AYER, [['flexion-pseudoplancha', 3]], { origen: mix('hombros'), ...aLas(AYER, 19) })
  const HISTORIALES: readonly Sesion[][] = [
    [],
    ...ZONAS.map((zona) => [todasMenos(zona)]),
    ...ZONAS.map((zona) => [todasMenos(zona, '2026-10-19'), deHombros]),
    ...ZONAS.map((zona) => [todasMenos(zona), deBrazos(HOY)]),
  ]
  const conDiscos: readonly Equipo[] = [...EQUIPO, 'discos']

  /** Los sectores de los mixes que empiezan las tarjetas, en cada historial, con y sin plan. */
  function mixesSugeridos(equipo: readonly Equipo[], conTrabajo: MixConTrabajo): Sector[] {
    const sectores: Sector[] = []
    for (const historial of HISTORIALES) {
      for (const semana of [null, LMV]) {
        const tarjetas = sugerenciasDeHoy({ historial, hoy: HOY, semana, equipo, conTrabajo })
        revisarSugerencias(tarjetas, historial, conTrabajo)
        for (const t of tarjetas) {
          if (t.clase === 'para-hoy' || t.clase === 'otra-zona') sectores.push(t.sector)
          const origen = t.clase === 'repetir' ? origenDe(t.sesion) : null
          if (origen?.clase === 'mix') sectores.push(origen.sector)
        }
      }
    }
    return sectores
  }

  it('a quien empieza, en el eslabón 1 y sin discos, nunca Hombros ni Brazos', () => {
    const hay = enElEslabon(1)
    expect(hay('hombros')).toBe(false)
    expect(hay('brazos')).toBe(false)
    // Sin el filtro, PARA HOY sería Hombros: la zona menos trabajada.
    expect(sugerirZona([todasMenos('hombros')], HOY, EQUIPO)).toBe('hombros')
    const sugeridos = mixesSugeridos(EQUIPO, hay)
    expect(sugeridos.length).toBeGreaterThan(0)
    expect(sugeridos).not.toContain('hombros')
    expect(sugeridos).not.toContain('brazos')
  })

  it('con discos, o desde el eslabón 2, Hombros y Brazos sí', () => {
    for (const [equipo, hay] of [
      [conDiscos, enElEslabon(1, conDiscos)],
      [EQUIPO, enElEslabon(2)],
    ] as const) {
      const sugeridos = mixesSugeridos(equipo, hay)
      expect(sugeridos).toContain('hombros')
      expect(sugeridos).toContain('brazos')
    }
  })

  it('REPETIR un mix que hoy sería la entrada sola no aparece', () => {
    const historial = [delPlan('2026-10-19'), deHombros]
    const tarjetas = (hay: MixConTrabajo) =>
      sugerenciasDeHoy({ historial, hoy: HOY, semana: LMV, equipo: EQUIPO, conTrabajo: hay })
    expect(tarjetas(enElEslabon(2))).toContainEqual({ clase: 'repetir', sesion: deHombros })
    expect(tarjetas(enElEslabon(1)).map((t) => t.clase)).not.toContain('repetir')
  })

  it('el primer día, el cuerpo completo tiene trabajo desde el eslabón 1', () => {
    expect(sugerenciasDeHoy({ historial: [], hoy: HOY, semana: null, equipo: EQUIPO, conTrabajo: enElEslabon(1) })).toEqual([
      { clase: 'para-hoy', sector: 'cuerpo', ultimaVez: null, sinSeries: true },
    ])
  })
})

describe('la última vez de cada tarjeta de zona', () => {
  it('con 1,5 series en la zona y ningún día de ella, no dice que no hay sesiones', () => {
    const historial = [
      sesion(AYER, [
        ['flexion-completa', 3],
        ['remo-australiano-medio', 3],
        ['sentadilla-completa', 3],
        ['puente-gluteos', 3],
        ['plancha', 3],
        ['curl-barra', 3],
      ], aLas(AYER, 18)),
    ]
    // Las flexiones le dan 1,5 series a Hombros: la zona menos trabajada.
    expect(seriesDeZona('hombros', historial, HOY)).toBe(1.5)
    expect(ultimaVezDeZona('hombros', historial)).toBeNull()
    const tarjetas = sugerenciasDeHoy({ historial, hoy: HOY, semana: null, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(tarjetas[0]).toEqual({ clase: 'para-hoy', sector: 'hombros', ultimaVez: null, sinSeries: false })
    revisarSugerencias(tarjetas, historial)
  })

  it('una zona sin ninguna serie lo dice, y una con última vez nunca', () => {
    const historial = [sesion(AYER, [['flexion-completa', 3]], aLas(AYER, 18))]
    const tarjetas = sugerenciasDeHoy({ historial, hoy: HOY, semana: null, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(tarjetas[0]).toEqual({ clase: 'para-hoy', sector: 'espalda', ultimaVez: null, sinSeries: true })
    revisarSugerencias(tarjetas, historial)
    // Con espalda y piernas hechas antes, OTRA ZONA tiene última vez.
    const conMas = [...historial, sesion('2026-10-19', [['remo-australiano-medio', 4], ['sentadilla-completa', 4]])]
    const despues = sugerenciasDeHoy({ historial: conMas, hoy: HOY, semana: null, equipo: EQUIPO, conTrabajo: HAY_TRABAJO })
    expect(despues.some((t) => t.clase === 'otra-zona' && t.ultimaVez !== null && !t.sinSeries)).toBe(true)
    revisarSugerencias(despues, conMas)
  })
})
