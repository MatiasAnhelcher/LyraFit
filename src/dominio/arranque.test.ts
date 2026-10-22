import { describe, expect, it } from 'vitest'
import { RECORTE_DE_VUELTA, sumarDias } from './adherencia'
import {
  busquedaDelPedido,
  conCambiosDelMix,
  lineaDelPedido,
  pasosParaRepetir,
  pedidoDesdeUrl,
  planDelPedido,
  versionLiviana,
  type ArranqueDeSesion,
  type ContextoDelPedido,
  type LoQueNoSeEntiende,
  type PedidoDeSesion,
} from './arranque'
import { CADENA_POR_PATRON, POR_ID } from './biblioteca'
import { mismaSesion } from './borrador'
import { equipoDe } from './equipo'
import { RECORTE_AMBAR, ajusteDelDia, bandaSostenida } from './estado'
import { LARGO_DE_LINEA } from './lineas'
import { resolverMix } from './mixes'
import { MOVILIDAD, movilidadDe } from './movilidad'
import { loProhibido } from './palabras'
import { planDeRutina, rutinaDesdeSesion } from './rutinasPropias'
import { sugerirZona } from './sectores'
import type {
  Avance,
  Estado,
  Objetivo,
  OrigenDeSesion,
  PasoDelBorrador,
  Patron,
  RegistroEjercicio,
  RutinaPropia,
  Serie,
  Sesion,
} from './tipos'

/**
 * El arranque es la única puerta a `/entrenar`, así que lo que más importa
 * probar es que ninguna URL arme algo distinto de lo que promete la pantalla
 * que la abrió: el plan como siempre, una rutina como la armaste, un mix como
 * lo viste en el Sector, y que nada de lo que no se entiende rompa la sesión
 * ni diga algo que no es verdad.
 */

/** Miércoles 21 de octubre de 2026: con Cuerpo completo (lunes, miércoles y viernes) toca fuerza. */
const HOY = '2026-10-21'
/** Martes: descanso en Cuerpo completo. */
const MARTES = '2026-10-20'

/** Un instante de ese día, en la hora local de quien corre el test. */
const a = (fecha: string, h: number, m = 0) =>
  new Date(`${fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime()

/** Un avance parado en un eslabón, con el objetivo que se le pida. */
function avanceEn(patron: Patron, ejercicioId: string, objetivo?: Objetivo): Avance {
  const ejercicio = POR_ID.get(ejercicioId)!
  return {
    patron,
    ejercicioId,
    objetivoActual: objetivo ?? { series: ejercicio.series, cantidad: ejercicio.ventana.min },
    senal: 1,
    sesionesEnObjetivo: 0,
    graciaRestante: 0,
    actualizadoEn: 0,
  }
}

/**
 * Empuje en flexiones completas (ventana 5 a 12) con 3 × 7, para que se note
 * cuándo un número sale del motor y cuándo de lo bajo de la ventana.
 */
const AVANCES = new Map<Patron, Avance>([
  ['empuje', avanceEn('empuje', 'flexion-completa', { series: 3, cantidad: 7 })],
  ['traccion', avanceEn('traccion', 'remo-australiano-medio')],
  ['piernas', avanceEn('piernas', 'sentadilla-completa')],
  ['core', avanceEn('core', 'plancha')],
  ['bisagra', avanceEn('bisagra', 'puente-gluteos-pies-elevados')],
])

const CON_PLAN = { rutinaActivaId: 'cuerpo-completo' }
const SIN_PLAN = { rutinaActivaId: 'cuerpo-completo', modoPlan: 'libre' as const }

/** El miércoles de Cuerpo completo: tracción, empuje, bisagra (le toca a la alternancia) y core. */
const PLAN_DEL_MIERCOLES = ['remo-australiano-medio', 'flexion-completa', 'puente-gluteos-pies-elevados', 'plancha']

const RUTINA: RutinaPropia = {
  id: 'r1',
  nombre: 'Pecho en casa',
  creadaEn: 0,
  actualizadaEn: 0,
  pasos: [
    { id: 'p1', clase: 'movilidad', ejercicioId: 'gato-vaca', series: 1, cantidad: 8, seccion: 'entrada' },
    { id: 'p2', clase: 'cadena', patron: 'empuje', series: 3, seccion: 'principal' },
    { id: 'p3', clase: 'fijo', ejercicioId: 'flexion-diamante', series: 3, cantidad: 6, seccion: 'principal' },
    { id: 'p4', clase: 'fijo', ejercicioId: 'remo-australiano-alto', series: 3, cantidad: 10, seccion: 'principal' },
  ],
}

const VACIA: RutinaPropia = { id: 'r0', nombre: 'Rutina nueva', creadaEn: 0, actualizadaEn: 0, pasos: [] }

function contexto(extra: Partial<ContextoDelPedido> = {}): ContextoDelPedido {
  return {
    preferencias: CON_PLAN,
    avances: AVANCES,
    estados: [],
    historial: [],
    rutinas: [RUTINA, VACIA],
    dia: HOY,
    ...extra,
  }
}

function registro(
  ejercicioId: string,
  [series, cantidad]: [number, number],
  logrados: number[],
  extra: Partial<RegistroEjercicio> = {},
): RegistroEjercicio {
  return {
    ejercicioId,
    objetivo: { series, cantidad },
    series: logrados.map((n): Serie => (n < 0 ? { logrado: -n, cierre: true } : { logrado: n })),
    ...extra,
  }
}

let siguiente = 0
function sesion(fecha: string, registros: RegistroEjercicio[], extra: Partial<Sesion> = {}): Sesion {
  siguiente++
  return {
    id: `s${String(siguiente).padStart(3, '0')}`,
    fecha,
    finalizadaEn: a(fecha, 10),
    duracionSegundos: 1800,
    tipo: 'plan',
    registros,
    ...extra,
  }
}

/** Cuatro sesiones a principios de septiembre y nada desde entonces: hoy es la vuelta. */
const ANTES_DE_LA_VUELTA = ['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-08'].map((f) =>
  sesion(f, [registro('flexion-completa', [3, 7], [7, 7, 7])]),
)

/** Veinte días buenos y tres malos hasta hoy: el chequeo baja (ámbar o rojo, los dos con 0,9). */
const DIAS_FLOJOS: Estado[] = [
  ...Array.from({ length: 20 }, (_, i) => ({
    fecha: sumarDias(HOY, i - 22),
    sueno: 4,
    energia: 4,
    musculos: 4,
    actualizadoEn: i,
  })),
  ...[-2, -1, 0].map((d, i) => ({
    fecha: sumarDias(HOY, d),
    sueno: 1,
    energia: 1,
    musculos: 1,
    actualizadoEn: 30 + i,
  })),
]

const arrancar = (url: string, extra: Partial<ContextoDelPedido> = {}, estado?: unknown) =>
  planDelPedido(pedidoDesdeUrl(url, estado), contexto(extra))

const ejercicios = (r: ArranqueDeSesion) => r.pasos.map((p) => p.ejercicioId)

/** Los campos de cada origen, tal como los define `OrigenDeSesion` en `tipos.ts`. */
const CAMPOS_DEL_ORIGEN: Record<OrigenDeSesion['clase'], { siempre: string[]; aveces: string[] }> = {
  plan: { siempre: ['clase', 'nombre'], aveces: ['liviana'] },
  rutina: { siempre: ['clase', 'rutinaId', 'nombre'], aveces: ['liviana'] },
  mix: { siempre: ['clase', 'sector', 'nombre', 'version'], aveces: [] },
  ejercicio: { siempre: ['clase', 'ejercicioId', 'nombre'], aveces: ['liviana'] },
  repetir: { siempre: ['clase', 'sesionId', 'nombre'], aveces: ['liviana'] },
  libre: { siempre: ['clase', 'nombre'], aveces: [] },
  movilidad: { siempre: ['clase', 'sector', 'nombre'], aveces: [] },
  rapida: { siempre: ['clase', 'cual', 'nombre'], aveces: [] },
}

/** Si un origen tiene exactamente la forma de `OrigenDeSesion`: ni un campo de más ni uno de menos. */
function tieneLaFormaDelOrigen(origen: OrigenDeSesion): boolean {
  const { siempre, aveces } = CAMPOS_DEL_ORIGEN[origen.clase]
  const campos = Object.keys(origen)
  const estan = siempre.every((c) => campos.includes(c))
  const sobran = campos.filter((c) => !siempre.includes(c) && !aveces.includes(c))
  const livianaBien = !('liviana' in origen) || origen.liviana === true
  return estan && sobran.length === 0 && livianaBien && typeof origen.nombre === 'string' && origen.nombre !== ''
}

// ─── pedidoDesdeUrl ─────────────────────────────────────────────────────

describe('pedidoDesdeUrl', () => {
  it('entiende cada parámetro de §2.4', () => {
    expect(pedidoDesdeUrl('')).toEqual({ clase: 'plan' })
    expect(pedidoDesdeUrl('?corta=1')).toEqual({ clase: 'corta' })
    expect(pedidoDesdeUrl('?fuelle=1')).toEqual({ clase: 'fuelle' })
    expect(pedidoDesdeUrl('?densa=1')).toEqual({ clase: 'densa' })
    expect(pedidoDesdeUrl('?rutina=r1')).toEqual({ clase: 'rutina', rutinaId: 'r1' })
    expect(pedidoDesdeUrl('?liviana=1')).toEqual({ clase: 'plan', liviana: true })
    expect(pedidoDesdeUrl('?rutina=r1&liviana=1')).toEqual({ clase: 'rutina', rutinaId: 'r1', liviana: true })
    expect(pedidoDesdeUrl('?repetir=s1&liviana=1')).toEqual({ clase: 'repetir', sesionId: 's1', liviana: true })
    expect(pedidoDesdeUrl('?mix=pecho&version=corta')).toEqual({ clase: 'mix', sector: 'pecho', version: 'corta' })
    expect(pedidoDesdeUrl('?ejercicio=flexion-diamante')).toEqual({ clase: 'ejercicio', ejercicioId: 'flexion-diamante' })
    expect(pedidoDesdeUrl('?movilidad=todo')).toEqual({ clase: 'movilidad', sector: 'todo' })
    expect(pedidoDesdeUrl('?libre=1')).toEqual({ clase: 'libre' })
  })

  it('acepta la búsqueda con o sin "?" y también un URLSearchParams', () => {
    expect(pedidoDesdeUrl('rutina=r1')).toEqual({ clase: 'rutina', rutinaId: 'r1' })
    expect(pedidoDesdeUrl(new URLSearchParams({ mix: 'core' }))).toEqual({ clase: 'mix', sector: 'core', version: 'completa' })
  })

  it('un "1" es un "1": ?corta=0 o ?libre=si no piden nada', () => {
    expect(pedidoDesdeUrl('?corta=0')).toEqual({ clase: 'plan' })
    expect(pedidoDesdeUrl('?libre=si')).toEqual({ clase: 'plan' })
    expect(pedidoDesdeUrl('?liviana=true')).toEqual({ clase: 'plan' })
  })

  it('un mix sin versión, o con una inventada, es el completo; con &liviana=1 es el liviano', () => {
    expect(pedidoDesdeUrl('?mix=pecho')).toMatchObject({ version: 'completa' })
    expect(pedidoDesdeUrl('?mix=pecho&version=enorme')).toMatchObject({ version: 'completa' })
    expect(pedidoDesdeUrl('?mix=pecho&liviana=1')).toMatchObject({ version: 'liviana' })
    expect(pedidoDesdeUrl('?mix=pecho&version=completa&liviana=1')).toMatchObject({ version: 'liviana' })
  })

  it('no valida contra los datos: una rutina o una zona inventadas siguen siendo un pedido', () => {
    expect(pedidoDesdeUrl('?rutina=no-existe')).toEqual({ clase: 'rutina', rutinaId: 'no-existe' })
    expect(pedidoDesdeUrl('?mix=rodillas')).toMatchObject({ clase: 'mix', sector: 'rodillas' })
    expect(pedidoDesdeUrl('?rutina=')).toEqual({ clase: 'rutina', rutinaId: '' })
  })

  it('ignora lo que no conoce, y con varios gana siempre el mismo', () => {
    expect(pedidoDesdeUrl('?utm_source=algo&tema=oscuro')).toEqual({ clase: 'plan' })
    expect(pedidoDesdeUrl('?corta=1&rutina=r1&mix=pecho')).toEqual({ clase: 'rutina', rutinaId: 'r1' })
    expect(pedidoDesdeUrl('?mix=pecho&repetir=s1')).toEqual({ clase: 'repetir', sesionId: 's1' })
    expect(pedidoDesdeUrl('?densa=1&fuelle=1')).toEqual({ clase: 'fuelle' })
  })

  it('lo cambiado en el Sector llega en el estado, solo para un mix', () => {
    const estado = { cambiosDelMix: { bloques: { empuje: 'flexion-diamante' }, entrada: false } }
    expect(pedidoDesdeUrl('?mix=pecho', estado)).toEqual({
      clase: 'mix',
      sector: 'pecho',
      version: 'completa',
      cambios: { bloques: { empuje: 'flexion-diamante' }, entrada: false },
    })
    expect(pedidoDesdeUrl('?rutina=r1', estado)).toEqual({ clase: 'rutina', rutinaId: 'r1' })
    expect(pedidoDesdeUrl('', estado)).toEqual({ clase: 'plan' })
  })

  it('un estado mal formado no rompe nada: se toma solo lo que tiene la forma esperada', () => {
    for (const estado of [null, undefined, 'texto', 3, [], { cambiosDelMix: null }, { cambiosDelMix: [] }, { otra: 1 }]) {
      expect(pedidoDesdeUrl('?mix=pecho', estado)).toEqual({ clase: 'mix', sector: 'pecho', version: 'completa' })
    }
    const mezclado = { cambiosDelMix: { bloques: { empuje: 'flexion-diamante', otro: 7 }, entrada: 'no' } }
    expect(pedidoDesdeUrl('?mix=pecho', mezclado)).toMatchObject({ cambios: { bloques: { empuje: 'flexion-diamante' } } })
    expect(pedidoDesdeUrl('?mix=pecho', mezclado)).not.toHaveProperty('cambios.entrada')
  })

  it('una clave "__proto__" en el estado queda como dato y no toca el prototipo', () => {
    const estado = JSON.parse('{"cambiosDelMix":{"bloques":{"__proto__":"x","empuje":"flexion-diamante"}}}')
    const pedido = pedidoDesdeUrl('?mix=pecho', estado)
    const bloques = pedido.clase === 'mix' ? pedido.cambios?.bloques : undefined
    expect(bloques && Object.getPrototypeOf(bloques)).toBe(Object.prototype)
    expect(bloques?.empuje).toBe('flexion-diamante')
  })
})

describe('busquedaDelPedido', () => {
  const PEDIDOS: PedidoDeSesion[] = [
    { clase: 'plan' },
    { clase: 'plan', liviana: true },
    { clase: 'corta' },
    { clase: 'fuelle' },
    { clase: 'densa' },
    { clase: 'rutina', rutinaId: 'r 1/ñ' },
    { clase: 'rutina', rutinaId: 'r1', liviana: true },
    { clase: 'mix', sector: 'gluteos', version: 'corta' },
    { clase: 'mix', sector: 'pecho', version: 'liviana' },
    { clase: 'ejercicio', ejercicioId: 'flexion-diamante' },
    { clase: 'repetir', sesionId: 's1', liviana: true },
    { clase: 'movilidad', sector: 'todo' },
    { clase: 'libre' },
  ]

  it('es la inversa de pedidoDesdeUrl', () => {
    for (const pedido of PEDIDOS) expect(pedidoDesdeUrl(busquedaDelPedido(pedido))).toEqual(pedido)
  })

  it('el plan de hoy es /entrenar pelado', () => {
    expect(busquedaDelPedido({ clase: 'plan' })).toBe('')
    expect(busquedaDelPedido({ clase: 'mix', sector: 'pecho', version: 'corta' })).toBe('?mix=pecho&version=corta')
  })
})

// ─── /entrenar sin parámetros ───────────────────────────────────────────

describe('/entrenar con plan', () => {
  it('arma el plan de hoy con los números del motor, como siempre', () => {
    const r = arrancar('')
    expect(ejercicios(r)).toEqual(PLAN_DEL_MIERCOLES)
    expect(r.pasos.find((p) => p.ejercicioId === 'flexion-completa')).toEqual({
      id: 'flexion-completa',
      ejercicioId: 'flexion-completa',
      objetivo: { series: 3, cantidad: 7 },
      clase: 'cadena',
      seccion: 'principal',
    })
    expect(r).toMatchObject({
      origen: { clase: 'plan', nombre: 'Cuerpo completo' },
      tipo: 'plan',
      diaDeFuelle: false,
      densa: false,
      cierre: true,
      molestia: [],
      aviso: null,
    })
  })

  it('cada paso lleva como id el de su ejercicio, la clave con la que un borrador viejo tiene sus series', () => {
    for (const paso of arrancar('').pasos) expect(paso.id).toBe(paso.ejercicioId)
  })

  it('en un día de descanso es la sesión de fuerza de tu rutina', () => {
    const r = arrancar('', { dia: MARTES })
    expect(r.pasos.length).toBeGreaterThan(0)
    expect(r).toMatchObject({ origen: { clase: 'plan' }, tipo: 'plan', diaDeFuelle: false, densa: false })
  })

  it('en un día de fuelle arranca en el bloque, sin serie de cierre', () => {
    const r = arrancar('', { preferencias: { ...CON_PLAN, semana: { 3: 'fuelle' } } })
    expect(r).toMatchObject({ origen: { clase: 'plan' }, tipo: 'fuelle', diaDeFuelle: true, densa: false, cierre: false })
  })

  it('en un día de las dos es la densa: la bajada después de cada eslabón, con su descanso corto', () => {
    const r = arrancar('', { preferencias: { ...CON_PLAN, semana: { 3: 'ambos' } } })
    expect(r).toMatchObject({ origen: { clase: 'plan' }, tipo: 'plan', densa: true, diaDeFuelle: false })
    const empuje = r.pasos.findIndex((p) => p.ejercicioId === 'flexion-completa')
    expect(r.pasos[empuje + 1]).toEqual({
      id: 'flexion-rodillas',
      ejercicioId: 'flexion-rodillas',
      objetivo: { series: 2, cantidad: POR_ID.get('flexion-rodillas')!.ventana.max },
      clase: 'volumen',
      seccion: 'principal',
      bajada: true,
      descansoSegundos: 45,
    })
  })

  it('el día de la vuelta es vuelta, y los pasos bajan el recorte de la vuelta', () => {
    const r = arrancar('', { historial: ANTES_DE_LA_VUELTA })
    expect(r.tipo).toBe('vuelta')
    const empuje = r.pasos.find((p) => p.ejercicioId === 'flexion-completa')!
    expect(empuje.objetivo).toEqual({ series: 3, cantidad: Math.round(7 * RECORTE_DE_VUELTA) })
  })

  it('el chequeo flojo baja la cantidad, como siempre en el plan', () => {
    expect(ajusteDelDia(bandaSostenida(DIAS_FLOJOS, HOY)).factor).toBe(RECORTE_AMBAR)
    const r = arrancar('', { estados: DIAS_FLOJOS })
    expect(r.pasos.find((p) => p.ejercicioId === 'flexion-completa')!.objetivo.cantidad).toBe(Math.round(7 * RECORTE_AMBAR))
  })

  it('los accesorios van solo con discos, siguen su vez pasada y se guardan con bajada', () => {
    const grupo = { rutinaActivaId: 'grupo-pecho-core' }
    expect(ejercicios(arrancar('', { preferencias: grupo }))).not.toContain('press-militar-barra')

    const conDiscos = arrancar('', { preferencias: { ...grupo, cargaMaximaKg: 40 } })
    expect(conDiscos.pasos.find((p) => p.ejercicioId === 'press-militar-barra')).toMatchObject({
      objetivo: { series: 4, cantidad: 6 },
      clase: 'volumen',
      bajada: true,
    })

    const vez = sesion('2026-10-19', [registro('press-militar-barra', [4, 6], [8, 8, 7, 7], { bajada: true })])
    vez.registros[0]!.series = vez.registros[0]!.series.map((s) => ({ ...s, kg: 30 }))
    const conVara = arrancar('', { preferencias: { ...grupo, cargaMaximaKg: 40 }, historial: [vez] })
    expect(conVara.pasos.find((p) => p.ejercicioId === 'press-militar-barra')!.objetivo).toEqual({
      series: 4,
      cantidad: 8,
      kg: 30,
    })
  })

  it('la molestia baja el eslabón al anterior y lo dice; lo que ya tiene series no cambia', () => {
    const r = arrancar('', { molestias: new Set<Patron>(['empuje']) })
    expect(r.pasos.find((p) => p.ejercicioId === 'flexion-completa')).toBeUndefined()
    expect(r.pasos.find((p) => p.ejercicioId === 'flexion-rodillas')).toEqual({
      id: 'flexion-rodillas',
      ejercicioId: 'flexion-rodillas',
      objetivo: { series: 2, cantidad: 8 },
      clase: 'volumen',
      seccion: 'principal',
      bajada: true,
    })
    expect(r.molestia).toEqual([
      { paso: 'flexion-rodillas', patron: 'empuje', cambio: 'baja', de: 'flexion-completa', a: 'flexion-rodillas', fijo: false },
    ])

    const empezado = arrancar('', {
      molestias: new Set<Patron>(['empuje']),
      hechas: { 'flexion-completa': [{ logrado: 7 }] },
    })
    expect(ejercicios(empezado)).toEqual(PLAN_DEL_MIERCOLES)
    expect(empezado.molestia).toEqual([])
  })

  it('en el primer eslabón no hay dónde bajar y la cadena se saltea ese día', () => {
    const enElPrimero = new Map(AVANCES).set('core', avanceEn('core', CADENA_POR_PATRON.get('core')!.ejercicios[0]!))
    const r = arrancar('', { avances: enElPrimero, molestias: new Set<Patron>(['core']) })
    expect(r.pasos.some((p) => POR_ID.get(p.ejercicioId)?.patron === 'core')).toBe(false)
    expect(r.molestia).toMatchObject([{ patron: 'core', cambio: 'saltea' }])
  })
})

describe('/entrenar sin plan', () => {
  it('el primer día es el mix completo de Cuerpo completo', () => {
    const r = arrancar('', { preferencias: SIN_PLAN })
    expect(r.origen).toEqual({ clase: 'mix', sector: 'cuerpo', nombre: 'Mix de cuerpo completo', version: 'completa' })
    const mix = resolverMix('cuerpo', 'completa', {
      avances: AVANCES,
      equipo: equipoDe({}),
      historial: [],
      hoy: HOY,
      plan: null,
    })
    expect(r.pasos).toEqual(mix.pasos)
    // La serie de cierre de un mix es la de su bloque Cierre (§4.14), y el de
    // Cuerpo completo no lo tiene: la sesión lleva lo que dice el mix.
    expect(r).toMatchObject({ tipo: 'plan', cierre: mix.cierre, aviso: null })
  })

  it('después, el mix de la zona que sugiere Hoy', () => {
    const historial = [sesion('2026-10-19', [registro('flexion-completa', [3, 7], [7, 7, 7])])]
    const sugerida = sugerirZona(historial, HOY, equipoDe({}))
    expect(sugerida).not.toBe('cuerpo')
    expect(arrancar('', { preferencias: SIN_PLAN, historial }).origen).toMatchObject({ clase: 'mix', sector: sugerida, version: 'completa' })
  })
})

// ─── Los parámetros ─────────────────────────────────────────────────────

describe('?corta=1', () => {
  it('es "Solo tengo 7 minutos": una serie por ejercicio, corta, desde la rutina activa', () => {
    const r = arrancar('?corta=1')
    expect(ejercicios(r)).toEqual(PLAN_DEL_MIERCOLES)
    expect(r.pasos.every((p) => p.objetivo.series === 1)).toBe(true)
    expect(r).toMatchObject({
      origen: { clase: 'rapida', cual: 'corta', nombre: 'Solo tengo 7 minutos' },
      tipo: 'corta',
      diaDeFuelle: false,
      densa: false,
    })
  })

  it('también sin plan, en un día de descanso y en uno de fuelle, y nunca es densa', () => {
    expect(arrancar('?corta=1', { preferencias: SIN_PLAN })).toMatchObject({ tipo: 'corta', origen: { cual: 'corta' } })
    expect(arrancar('?corta=1', { dia: MARTES }).pasos.length).toBeGreaterThan(0)
    expect(arrancar('?corta=1', { preferencias: { ...CON_PLAN, semana: { 3: 'fuelle' } } })).toMatchObject({
      tipo: 'corta',
      diaDeFuelle: false,
    })
    const enUnDiaDeLasDos = arrancar('?corta=1', { preferencias: { ...CON_PLAN, semana: { 3: 'ambos' } } })
    expect(enUnDiaDeLasDos.densa).toBe(false)
    expect(enUnDiaDeLasDos.pasos.some((p) => p.bajada)).toBe(false)
  })
})

describe('?fuelle=1 · ?densa=1', () => {
  it('el fuelle es el plan si hoy el plan dice fuelle; si no, el de RÁPIDAS', () => {
    const deFuelle = { preferencias: { ...CON_PLAN, semana: { 3: 'fuelle' as const } } }
    expect(arrancar('?fuelle=1', deFuelle)).toMatchObject({ origen: { clase: 'plan' }, tipo: 'fuelle', diaDeFuelle: true })
    expect(arrancar('?fuelle=1')).toMatchObject({
      origen: { clase: 'rapida', cual: 'fuelle', nombre: 'El fuelle' },
      tipo: 'fuelle',
      diaDeFuelle: true,
      cierre: false,
    })
    expect(arrancar('?fuelle=1', { preferencias: SIN_PLAN }).origen).toMatchObject({ clase: 'rapida', cual: 'fuelle' })
  })

  it('un fuelle en un día de las dos no es el plan: el plan de ese día es la densa', () => {
    const deLasDos = { preferencias: { ...CON_PLAN, semana: { 3: 'ambos' as const } } }
    expect(arrancar('?fuelle=1', deLasDos).origen).toMatchObject({ clase: 'rapida', cual: 'fuelle' })
  })

  it('la densa es el plan si hoy toca las dos; si no, la de RÁPIDAS, con su bajada', () => {
    const deLasDos = { preferencias: { ...CON_PLAN, semana: { 3: 'ambos' as const } } }
    expect(arrancar('?densa=1', deLasDos)).toMatchObject({ origen: { clase: 'plan' }, densa: true })
    const rapida = arrancar('?densa=1')
    expect(rapida).toMatchObject({ origen: { clase: 'rapida', cual: 'densa' }, densa: true, tipo: 'plan', cierre: true })
    expect(rapida.pasos.filter((p) => p.bajada && p.descansoSegundos === 45).length).toBeGreaterThan(0)
    expect(arrancar('?densa=1', { preferencias: SIN_PLAN }).origen).toMatchObject({ clase: 'rapida', cual: 'densa' })
  })
})

describe('?rutina=', () => {
  it('arma los pasos de esa rutina como planDeRutina, sin serie de cierre', () => {
    const r = arrancar('?rutina=r1')
    expect(r.pasos).toEqual(planDeRutina(RUTINA, { avances: AVANCES, historial: [] }))
    expect(r).toMatchObject({
      origen: { clase: 'rutina', rutinaId: 'r1', nombre: 'Pecho en casa' },
      tipo: 'plan',
      cierre: false,
      aviso: null,
    })
  })

  it('el día de la vuelta es vuelta, y la vuelta baja solo los pasos de cadena', () => {
    const r = arrancar('?rutina=r1', { historial: ANTES_DE_LA_VUELTA })
    expect(r.tipo).toBe('vuelta')
    expect(r.pasos.find((p) => p.id === 'p2')!.objetivo.cantidad).toBe(Math.round(7 * RECORTE_DE_VUELTA))
    expect(r.pasos.find((p) => p.id === 'p4')!.objetivo.cantidad).toBe(10)
  })

  it('el chequeo baja los pasos de cadena; los fijos solo con Bajar también los tuyos', () => {
    const sinTocar = arrancar('?rutina=r1', { estados: DIAS_FLOJOS })
    expect(sinTocar.pasos.find((p) => p.id === 'p2')!.objetivo.cantidad).toBe(Math.round(7 * RECORTE_AMBAR))
    expect(sinTocar.pasos.find((p) => p.id === 'p4')!.objetivo.cantidad).toBe(10)
    const conLosTuyos = arrancar('?rutina=r1', { estados: DIAS_FLOJOS, bajarLosTuyos: true })
    expect(conLosTuyos.pasos.find((p) => p.id === 'p4')!.objetivo.cantidad).toBe(Math.round(10 * RECORTE_AMBAR))
  })

  it('la molestia baja los de cadena y los fijos; "Dejarlo como lo armé" deja los fijos', () => {
    const r = arrancar('?rutina=r1', { molestias: new Set<Patron>(['empuje']) })
    expect(r.pasos.find((p) => p.id === 'p2')).toMatchObject({ ejercicioId: 'flexion-rodillas', bajada: true, clase: 'volumen' })
    expect(r.pasos.find((p) => p.id === 'p3')).toMatchObject({ ejercicioId: 'flexion-completa', bajada: true, fijo: true })
    expect(r.molestia.map((c) => [c.paso, c.cambio, c.fijo])).toEqual([
      ['p2', 'baja', false],
      ['p3', 'baja', true],
    ])
    const comoLaArme = arrancar('?rutina=r1', { molestias: new Set<Patron>(['empuje']), fijos: 'como-los-armaste' })
    expect(comoLaArme.pasos.find((p) => p.id === 'p3')).toMatchObject({ ejercicioId: 'flexion-diamante' })
  })

  it('una rutina que no existe da el plan de hoy, y lo dice', () => {
    const r = arrancar('?rutina=borrada')
    expect(ejercicios(r)).toEqual(PLAN_DEL_MIERCOLES)
    expect(r.origen).toEqual({ clase: 'plan', nombre: 'Cuerpo completo' })
    expect(r.aviso).toBe('Esa rutina ya no está: va el plan de hoy.')
  })

  it('sin plan, una rutina que no existe da la sugerencia', () => {
    const r = arrancar('?rutina=borrada', { preferencias: SIN_PLAN })
    expect(r.origen).toMatchObject({ clase: 'mix', sector: 'cuerpo', version: 'completa' })
    expect(r.aviso).toBe('Esa rutina ya no está: va la sugerencia de hoy.')
  })

  it('una rutina sin pasos para armar no arranca vacía: va el plan con su renglón', () => {
    const r = arrancar('?rutina=r0')
    expect(ejercicios(r)).toEqual(PLAN_DEL_MIERCOLES)
    expect(r.aviso).toBe('Esa rutina no tiene pasos para armar hoy: va el plan de hoy.')
  })
})

describe('&liviana=1', () => {
  /** Lo que promete la versión liviana, paso por paso, contra lo de hoy. */
  function esLaLivianaDe(liviana: readonly PasoDelBorrador[], deHoy: readonly PasoDelBorrador[]) {
    expect(liviana.map((p) => p.id)).toEqual(deHoy.map((p) => p.id))
    liviana.forEach((paso, i) => {
      const hoy = deHoy[i]!
      if (paso.clase === 'movilidad' || paso.calentamiento) {
        expect(paso).toEqual(hoy)
        return
      }
      const ventana = POR_ID.get(paso.ejercicioId)!.ventana
      expect(paso.objetivo.series).toBe(2)
      expect(paso.objetivo.cantidad).toBe(Math.min(hoy.objetivo.cantidad, ventana.min))
    })
  }

  it('con el plan: 2 series al piso, corta y sin cierre, con liviana en el origen', () => {
    const r = arrancar('?liviana=1')
    esLaLivianaDe(r.pasos, arrancar('').pasos)
    expect(r).toMatchObject({ origen: { clase: 'plan', nombre: 'Cuerpo completo', liviana: true }, tipo: 'corta', cierre: false })
    expect(r.pasos.find((p) => p.ejercicioId === 'flexion-completa')!.objetivo).toEqual({ series: 2, cantidad: 5 })
  })

  it('con una rutina, y la movilidad de la entrada queda como estaba', () => {
    const r = arrancar('?rutina=r1&liviana=1')
    esLaLivianaDe(r.pasos, arrancar('?rutina=r1').pasos)
    expect(r).toMatchObject({ origen: { clase: 'rutina', rutinaId: 'r1', liviana: true }, tipo: 'corta' })
  })

  it('con una repetición', () => {
    const vieja = sesion('2026-10-14', [registro('flexion-completa', [3, 7], [7, 7, 7]), registro('plancha', [3, 15], [15, 15, 15])])
    const historial = [vieja]
    const r = arrancar(`?repetir=${vieja.id}&liviana=1`, { historial })
    esLaLivianaDe(r.pasos, arrancar(`?repetir=${vieja.id}`, { historial }).pasos)
    expect(r).toMatchObject({ origen: { clase: 'repetir', sesionId: vieja.id, liviana: true }, tipo: 'corta' })
  })

  it('con un ejercicio solo', () => {
    const r = arrancar('?ejercicio=flexion-completa&liviana=1')
    expect(r.pasos[0]!.objetivo).toEqual({ series: 2, cantidad: 5 })
    expect(r).toMatchObject({ origen: { clase: 'ejercicio', liviana: true }, tipo: 'corta' })
  })

  it('sin plan, /entrenar?liviana=1 es el mix sugerido en versión liviana', () => {
    const r = arrancar('?liviana=1', { preferencias: SIN_PLAN })
    expect(r.origen).toEqual({ clase: 'mix', sector: 'cuerpo', nombre: 'Mix de cuerpo completo', version: 'liviana' })
    expect(r).toMatchObject({ tipo: 'corta', cierre: false })
  })

  it('versionLiviana no toca la entrada en calor ni la movilidad', () => {
    const pasos: PasoDelBorrador[] = [
      { id: 'a', ejercicioId: 'flexion-rodillas', objetivo: { series: 1, cantidad: 8 }, clase: 'fijo', calentamiento: true },
      { id: 'b', ejercicioId: 'gato-vaca', objetivo: { series: 1, cantidad: 8 }, clase: 'movilidad' },
      { id: 'c', ejercicioId: 'flexion-completa', objetivo: { series: 4, cantidad: 3, kg: 5 }, clase: 'fijo' },
    ]
    const [calentamiento, movilidad, trabajo] = versionLiviana(pasos)
    expect(calentamiento).toBe(pasos[0])
    expect(movilidad).toBe(pasos[1])
    expect(trabajo!.objetivo).toEqual({ series: 2, cantidad: 3, kg: 5 })
  })
})

describe('?mix=', () => {
  const MIX = (version: 'completa' | 'corta' | 'liviana', extra: { entrada?: boolean } = {}) =>
    resolverMix('pecho', version, {
      avances: AVANCES,
      equipo: equipoDe({}),
      historial: [],
      hoy: HOY,
      plan: null,
      ...extra,
    })

  it('arma el mix resuelto con tu nivel, y su versión decide el tipo y la serie de cierre', () => {
    const completo = arrancar('?mix=pecho&version=completa')
    expect(completo.origen).toEqual({ clase: 'mix', sector: 'pecho', nombre: 'Mix de pecho', version: 'completa' })
    expect(completo).toMatchObject({ tipo: 'plan', cierre: true })
    expect(ejercicios(completo)).toEqual(MIX('completa').pasos.map((p) => p.ejercicioId))

    expect(arrancar('?mix=pecho&version=corta')).toMatchObject({ tipo: 'plan', cierre: false, origen: { version: 'corta' } })
    const liviano = arrancar('?mix=pecho&version=liviana')
    expect(liviano).toMatchObject({ tipo: 'corta', cierre: false, origen: { version: 'liviana' } })
    expect(liviano.pasos).toEqual(MIX('liviana').pasos)
  })

  it('el chequeo y la vuelta bajan sus pasos de cadena', () => {
    const r = arrancar('?mix=pecho', { historial: ANTES_DE_LA_VUELTA })
    expect(r.tipo).toBe('vuelta')
    const deCadena = r.pasos.find((p) => p.clase === 'cadena')!
    expect(deCadena.objetivo.cantidad).toBe(Math.round(7 * RECORTE_DE_VUELTA))
  })

  describe('en Liviano, el día va antes del piso, como en el plan y en una rutina livianos', () => {
    // Core en plancha 3 × 30 (ventana de 15 a 30) y empuje en flexiones 3 × 7
    // (de 5 a 12): el número del motor está arriba del piso en las dos, así
    // que se nota si el chequeo y la vuelta cortan antes o después del piso.
    const avances = new Map(AVANCES).set('core', avanceEn('core', 'plancha', { series: 3, cantidad: 30 }))
    const DE_CADENAS: RutinaPropia = {
      id: 'rc',
      nombre: 'Empuje y core',
      creadaEn: 0,
      actualizadaEn: 0,
      pasos: [
        { id: 'c1', clase: 'cadena', patron: 'empuje', series: 3, seccion: 'principal' },
        { id: 'c2', clase: 'cadena', patron: 'core', series: 3, seccion: 'principal' },
      ],
    }
    const DIAS: [nombre: string, dia: Partial<ContextoDelPedido>][] = [
      ['un día sin ajuste', {}],
      ['un chequeo flojo', { estados: DIAS_FLOJOS }],
      ['la vuelta', { historial: ANTES_DE_LA_VUELTA }],
      ['el chequeo flojo y la vuelta', { estados: DIAS_FLOJOS, historial: ANTES_DE_LA_VUELTA }],
    ]
    const deCadena = (r: ArranqueDeSesion, ejercicioId: string) =>
      r.pasos.find((p) => p.clase === 'cadena' && p.ejercicioId === ejercicioId)?.objetivo

    for (const [nombre, dia] of DIAS) {
      it(`${nombre}: el mix liviano pide lo mismo que el plan, la rutina y el ejercicio livianos`, () => {
        const extra = { ...dia, avances, rutinas: [DE_CADENAS] }
        const plan = arrancar('?liviana=1', extra)
        const rutina = arrancar('?rutina=rc&liviana=1', extra)
        for (const [sector, ejercicioId] of [
          ['pecho', 'flexion-completa'],
          ['core', 'plancha'],
        ] as const) {
          const mix = arrancar(`?mix=${sector}&version=liviana`, extra)
          const pide = deCadena(mix, ejercicioId)
          expect(pide, `${sector}: ${ejercicioId}`).toBeDefined()
          expect(pide, `${sector} contra el plan`).toEqual(deCadena(plan, ejercicioId))
          expect(pide, `${sector} contra la rutina`).toEqual(deCadena(rutina, ejercicioId))
          expect(pide, `${sector} contra el ejercicio`).toEqual(
            deCadena(arrancar(`?ejercicio=${ejercicioId}&liviana=1`, extra), ejercicioId),
          )
        }
      })
    }

    it('los números: el piso de la ventana, salvo que el día baje el número de hoy por debajo', () => {
      const conAvances = (dia: Partial<ContextoDelPedido>) => ({ ...dia, avances })
      // Un chequeo de 0,9: 30 baja a 27, y el piso es 15 (antes daba 14).
      expect(deCadena(arrancar('?mix=core&version=liviana', conAvances({ estados: DIAS_FLOJOS })), 'plancha')).toEqual({
        series: 2,
        cantidad: 15,
      })
      // La vuelta: 7 baja a 5, que es el piso (antes daba 4).
      expect(deCadena(arrancar('?mix=pecho&version=liviana', conAvances({ historial: ANTES_DE_LA_VUELTA })), 'flexion-completa')).toEqual({
        series: 2,
        cantidad: Math.min(Math.round(7 * RECORTE_DE_VUELTA), 5),
      })
      // Las dos juntas: 7 baja a 4, debajo del piso, y queda el 4 de hoy.
      expect(
        deCadena(arrancar('?mix=pecho&version=liviana', conAvances({ estados: DIAS_FLOJOS, historial: ANTES_DE_LA_VUELTA })), 'flexion-completa'),
      ).toEqual({ series: 2, cantidad: Math.round(7 * RECORTE_AMBAR * RECORTE_DE_VUELTA) })
    })

    it('con Bajar también los tuyos, un fijo baja su número de hoy y después va al piso, como en una rutina liviana', () => {
      // Flexiones inclinadas bajas (ventana de 8 a 15) hechas 3 × 12 completas:
      // hoy tocan 3 × 13, el chequeo las deja en 12 y el piso en 8. Bajar el
      // piso después daba 7.
      const vez = sesion('2026-10-19', [registro('flexion-inclinada-baja', [3, 12], [12, 12, 12])])
      const conFijo: RutinaPropia = {
        id: 'rf',
        nombre: 'Con un fijo',
        creadaEn: 0,
        actualizadaEn: 0,
        pasos: [{ id: 'f1', clase: 'fijo', ejercicioId: 'flexion-inclinada-baja', series: 3, cantidad: 8, seccion: 'principal' }],
      }
      const extra = { estados: DIAS_FLOJOS, historial: [vez], rutinas: [conFijo], bajarLosTuyos: true }
      const cambiado = { cambiosDelMix: { bloques: { empuje: 'flexion-inclinada-baja' } } }
      const delMix = arrancar('?mix=pecho&version=liviana', extra, cambiado).pasos.find((p) => p.id === 'empuje')!
      const deLaRutina = arrancar('?rutina=rf&liviana=1', extra).pasos.find((p) => p.id === 'f1')!
      expect(delMix.objetivo).toEqual({ series: 2, cantidad: 8 })
      expect(delMix.objetivo).toEqual(deLaRutina.objetivo)
      // Sin Bajar también los tuyos el fijo no toca el día: el piso, como siempre.
      const sinTocar = arrancar('?mix=pecho&version=liviana', { ...extra, bajarLosTuyos: false }, cambiado)
      expect(sinTocar.pasos.find((p) => p.id === 'empuje')!.objetivo).toEqual({ series: 2, cantidad: 8 })
    })
  })

  it('un bloque cambiado en el Sector entra fijo, con las series del bloque y su id', () => {
    const r = arrancar('?mix=pecho', {}, { cambiosDelMix: { bloques: { empuje: 'flexion-inclinada-baja' } } })
    expect(r.pasos.find((p) => p.id === 'empuje')).toEqual({
      id: 'empuje',
      ejercicioId: 'flexion-inclinada-baja',
      objetivo: { series: 3, cantidad: POR_ID.get('flexion-inclinada-baja')!.ventana.min },
      clase: 'fijo',
      fijo: true,
      seccion: 'principal',
    })
    expect(r.pasos.filter((p) => p.clase === 'cadena')).toEqual([])
  })

  it('el ejercicio elegido sube con su doble progresión, dentro de su ventana', () => {
    const vez = sesion('2026-10-19', [registro('flexion-diamante', [3, 6], [6, 6, 6])])
    const r = arrancar('?mix=pecho', { historial: [vez] }, { cambiosDelMix: { bloques: { empuje: 'flexion-diamante' } } })
    expect(r.pasos.find((p) => p.id === 'empuje')!.objetivo).toEqual({ series: 3, cantidad: 7 })
  })

  it('en Liviano, lo cambiado también va al piso', () => {
    const r = arrancar('?mix=pecho&version=liviana', {}, { cambiosDelMix: { bloques: { empuje: 'flexion-diamante' } } })
    expect(r.pasos.find((p) => p.id === 'empuje')!.objetivo).toEqual({ series: 2, cantidad: 5 })
  })

  it('la entrada se apaga con su interruptor y no se cambia con Cambiar', () => {
    const sinEntrada = arrancar('?mix=pecho', {}, { cambiosDelMix: { entrada: false } })
    expect(sinEntrada.pasos).toEqual(MIX('completa', { entrada: false }).pasos)
    expect(sinEntrada.pasos.some((p) => p.seccion === 'entrada')).toBe(false)

    const entrada = MIX('completa').pasos.find((p) => p.calentamiento)!
    const r = arrancar('?mix=pecho', {}, { cambiosDelMix: { bloques: { [entrada.id]: 'flexion-diamante' } } })
    expect(r.pasos.find((p) => p.id === entrada.id)).toEqual(entrada)
  })

  it('volver al ejercicio del mix, un bloque que no existe o un ejercicio desconocido no cambian nada', () => {
    const sinCambios = arrancar('?mix=pecho').pasos
    for (const bloques of [{ empuje: 'flexion-completa' }, { 'no-hay': 'flexion-diamante' }, { empuje: 'flexion-imaginaria' }]) {
      expect(arrancar('?mix=pecho', {}, { cambiosDelMix: { bloques } }).pasos).toEqual(sinCambios)
    }
  })

  it('conCambiosDelMix es lo mismo que corre la sesión, para que el Sector muestre esos números', () => {
    const cambios = { bloques: { empuje: 'flexion-diamante' } }
    const sector = conCambiosDelMix(MIX('corta').pasos, cambios, { version: 'corta', historial: [] })
    expect(arrancar('?mix=pecho&version=corta', {}, { cambiosDelMix: cambios }).pasos).toEqual(sector)
  })

  it('un sector inventado da el plan de hoy, o sin plan la sugerencia, y lo dice', () => {
    expect(arrancar('?mix=rodillas')).toMatchObject({
      origen: { clase: 'plan' },
      aviso: 'Esa zona no está: va el plan de hoy.',
    })
    expect(arrancar('?mix=toString', { preferencias: SIN_PLAN })).toMatchObject({
      origen: { clase: 'mix', sector: 'cuerpo' },
      aviso: 'Esa zona no está: va la sugerencia de hoy.',
    })
  })
})

describe('?ejercicio=', () => {
  it('tu eslabón actual entra como paso de cadena, con el objetivo del motor', () => {
    const r = arrancar('?ejercicio=flexion-completa')
    expect(r.pasos).toEqual([
      { id: 'flexion-completa', ejercicioId: 'flexion-completa', objetivo: { series: 3, cantidad: 7 }, clase: 'cadena', seccion: 'principal' },
    ])
    expect(r).toMatchObject({
      origen: { clase: 'ejercicio', ejercicioId: 'flexion-completa', nombre: POR_ID.get('flexion-completa')!.nombre },
      tipo: 'plan',
      aviso: null,
    })
  })

  it('otro entra fijo: lo bajo de la ventana la primera vez, y después su doble progresión', () => {
    const primera = arrancar('?ejercicio=flexion-diamante')
    expect(primera.pasos).toEqual([
      {
        id: 'flexion-diamante',
        ejercicioId: 'flexion-diamante',
        objetivo: { series: 3, cantidad: 5 },
        clase: 'fijo',
        fijo: true,
        seccion: 'principal',
      },
    ])
    const vez = sesion('2026-10-19', [registro('flexion-diamante', [3, 6], [6, 6, 6])])
    expect(arrancar('?ejercicio=flexion-diamante', { historial: [vez] }).pasos[0]!.objetivo).toEqual({ series: 3, cantidad: 7 })
  })

  it('un ejercicio que la app no tiene da el plan de hoy, y lo dice', () => {
    expect(arrancar('?ejercicio=flexion-imaginaria')).toMatchObject({
      origen: { clase: 'plan' },
      aviso: 'Ese ejercicio no está en la app: va el plan de hoy.',
    })
  })

  it('una ficha de movilidad sola no arma una sesión que cuente: va lo de siempre, y lo dice sin decir que no está', () => {
    for (const [conPlan, preferencias] of [
      [true, CON_PLAN],
      [false, SIN_PLAN],
    ] as const) {
      const deSiempre = arrancar('', { preferencias })
      for (const ficha of MOVILIDAD) {
        const r = arrancar(`?ejercicio=${ficha.id}`, { preferencias })
        expect(r.origen, ficha.id).toEqual(deSiempre.origen)
        expect(r.origen.clase, ficha.id).not.toBe('ejercicio')
        expect(r.pasos, ficha.id).toEqual(deSiempre.pasos)
        expect(r.aviso, ficha.id).toBe(lineaDelPedido('movilidad-sola', conPlan))
        expect(r.aviso, ficha.id).not.toContain('no está en la app')
      }
    }
    expect(arrancar('?ejercicio=gato-vaca').aviso).toBe('Una ficha de movilidad sola no arma una sesión: va el plan de hoy.')
  })
})

describe('?repetir=', () => {
  const deLaRutina = sesion('2026-10-14', [registro('flexion-completa', [3, 7], [7, 7, 7])], {
    origen: { clase: 'rutina', rutinaId: 'r1', nombre: 'Pecho en casa' },
  })
  const deLaBorrada = sesion('2026-10-14', [registro('flexion-completa', [3, 7], [7, 7, 7])], {
    origen: { clase: 'rutina', rutinaId: 'r-borrada', nombre: 'La de antes' },
  })
  const delMix = sesion('2026-10-15', [registro('flexion-completa', [3, 7], [7, 7, 7])], {
    origen: { clase: 'mix', sector: 'pecho', nombre: 'Mix de pecho', version: 'corta' },
  })
  const delEjercicio = sesion('2026-10-15', [registro('flexion-diamante', [3, 5], [5, 5, 5])], {
    origen: { clase: 'ejercicio', ejercicioId: 'flexion-diamante', nombre: 'Flexiones diamante' },
  })
  const deMovilidad = sesion('2026-10-16', [], {
    tipo: 'fuelle',
    origen: { clase: 'movilidad', sector: 'hombros', nombre: 'Movilidad de hombros' },
  })
  const delReloj = sesion('2026-10-16', [registro('flexion-completa', [8, 20], [20, 20], { reloj: true })], { tipo: 'reloj' })
  const historial = [deLaRutina, deLaBorrada, delMix, delEjercicio, deMovilidad, delReloj]

  it('de una rutina que existe es esa rutina, como está hoy', () => {
    const r = arrancar(`?repetir=${deLaRutina.id}`, { historial })
    expect(r.origen).toEqual({ clase: 'rutina', rutinaId: 'r1', nombre: 'Pecho en casa' })
    expect(r.pasos).toEqual(arrancar('?rutina=r1', { historial }).pasos)
  })

  it('de una rutina borrada se rearma con sus registros, con origen repetir', () => {
    // El día siguiente a la última: con tres días seguidos de historial, el 21 ya sería la vuelta.
    const r = arrancar(`?repetir=${deLaBorrada.id}`, { historial, dia: '2026-10-17' })
    expect(r.origen).toEqual({ clase: 'repetir', sesionId: deLaBorrada.id, nombre: 'La de antes' })
    expect(r.pasos).toEqual([
      { id: `${deLaBorrada.id}-p1`, ejercicioId: 'flexion-completa', objetivo: { series: 3, cantidad: 7 }, clase: 'cadena', seccion: 'principal' },
    ])
    expect(r).toMatchObject({ tipo: 'plan', cierre: false })
  })

  it('de un mix es el mix con su versión; de un ejercicio, el ejercicio; de una movilidad, la movilidad', () => {
    expect(arrancar(`?repetir=${delMix.id}`, { historial }).origen).toEqual({
      clase: 'mix',
      sector: 'pecho',
      nombre: 'Mix de pecho',
      version: 'corta',
    })
    expect(arrancar(`?repetir=${delMix.id}&liviana=1`, { historial }).origen).toMatchObject({ version: 'liviana' })
    expect(arrancar(`?repetir=${delEjercicio.id}`, { historial }).origen).toEqual({
      clase: 'ejercicio',
      ejercicioId: 'flexion-diamante',
      nombre: POR_ID.get('flexion-diamante')!.nombre,
    })
    expect(arrancar(`?repetir=${deMovilidad.id}`, { historial })).toMatchObject({
      origen: { clase: 'movilidad', sector: 'hombros' },
      tipo: 'fuelle',
    })
  })

  it('una sesión que no está da el plan de hoy, y lo dice', () => {
    expect(arrancar('?repetir=s-que-no-esta', { historial })).toMatchObject({
      origen: { clase: 'plan' },
      aviso: 'Esa sesión no está: va el plan de hoy.',
    })
  })

  it('una sesión de la que no vuelve nada (la del Reloj) no arranca vacía', () => {
    expect(arrancar(`?repetir=${delReloj.id}`, { historial })).toMatchObject({
      origen: { clase: 'plan' },
      aviso: 'Esa sesión no tiene ejercicios para armar de nuevo: va el plan de hoy.',
    })
  })
})

describe('?movilidad=', () => {
  it('arma todas las fichas de la zona, en orden y con su dosis, como fuelle que no tiene bloque', () => {
    const r = arrancar('?movilidad=pecho')
    const fichas = movilidadDe('pecho')
    expect(r.pasos).toEqual(
      fichas.map((f) => ({
        id: f.id,
        ejercicioId: f.id,
        objetivo: { series: f.dosis.series, cantidad: f.dosis.cantidad },
        clase: 'movilidad',
        seccion: 'principal',
      })),
    )
    expect(r).toMatchObject({
      origen: { clase: 'movilidad', sector: 'pecho', nombre: 'Movilidad de pecho' },
      tipo: 'fuelle',
      diaDeFuelle: false,
      densa: false,
      cierre: false,
    })
  })

  it('todo el cuerpo se guarda como "todo", se pida como se pida', () => {
    for (const zona of ['todo', 'cuerpo']) {
      expect(arrancar(`?movilidad=${zona}`).origen).toEqual({
        clase: 'movilidad',
        sector: 'todo',
        nombre: 'Movilidad de todo el cuerpo',
      })
    }
    expect(arrancar('?movilidad=gluteos').origen).toMatchObject({ nombre: 'Movilidad de glúteos' })
  })

  it('la molestia no la toca: ninguna ficha carga una cadena', () => {
    const r = arrancar('?movilidad=core', { molestias: new Set<Patron>(['core', 'bisagra']) })
    expect(r.pasos.map((p) => p.ejercicioId)).toEqual(movilidadDe('core').map((f) => f.id))
    expect(r.molestia).toEqual([])
  })

  it('una zona inventada da el plan de hoy, y lo dice', () => {
    expect(arrancar('?movilidad=rodillas')).toMatchObject({ origen: { clase: 'plan' }, aviso: 'Esa zona no está: va el plan de hoy.' })
  })
})

describe('?libre=1, hasta el paquete L', () => {
  it('es un parámetro que no se entiende: arma el plan de hoy y lo dice', () => {
    const r = arrancar('?libre=1')
    expect(r.pasos).toEqual(arrancar('').pasos)
    expect(r.origen).toEqual({ clase: 'plan', nombre: 'Cuerpo completo' })
    expect(r.aviso).toBe('La sesión libre no está en esta versión de la app: va el plan de hoy.')
  })

  it('sin plan, la sugerencia', () => {
    const r = arrancar('?libre=1', { preferencias: SIN_PLAN })
    expect(r.origen).toMatchObject({ clase: 'mix' })
    expect(r.aviso).toBe('La sesión libre no está en esta versión de la app: va la sugerencia de hoy.')
  })
})

// ─── Repetir ────────────────────────────────────────────────────────────

describe('pasosParaRepetir', () => {
  it('de una rutina que existe es ?rutina=, y con Versión liviana, su liviana', () => {
    const s = sesion(HOY, [], { origen: { clase: 'rutina', rutinaId: 'r1', nombre: 'Pecho en casa' } })
    expect(pasosParaRepetir(s, AVANCES, { rutinas: [RUTINA] })).toEqual({
      clase: 'ir',
      pedido: { clase: 'rutina', rutinaId: 'r1' },
      busqueda: '?rutina=r1',
    })
    expect(pasosParaRepetir(s, AVANCES, { rutinas: [RUTINA], liviana: true })).toMatchObject({ busqueda: '?rutina=r1&liviana=1' })
  })

  it('de un mix es ?mix= con su versión; de un ejercicio, ?ejercicio=', () => {
    const mix = sesion(HOY, [], { origen: { clase: 'mix', sector: 'gluteos', nombre: 'Mix de glúteos', version: 'corta' } })
    expect(pasosParaRepetir(mix, AVANCES)).toMatchObject({ clase: 'ir', busqueda: '?mix=gluteos&version=corta' })
    const ejercicio = sesion(HOY, [], { origen: { clase: 'ejercicio', ejercicioId: 'flexion-diamante', nombre: 'Flexiones diamante' } })
    expect(pasosParaRepetir(ejercicio, AVANCES)).toMatchObject({ clase: 'ir', busqueda: '?ejercicio=flexion-diamante' })
  })

  it('la movilidad y el fuelle van a la suya, y lo liviano se repite liviano', () => {
    const movilidad = sesion(HOY, [], { tipo: 'fuelle', origen: { clase: 'movilidad', sector: 'hombros', nombre: 'Movilidad de hombros' } })
    expect(pasosParaRepetir(movilidad, AVANCES)).toMatchObject({ busqueda: '?movilidad=hombros' })
    // Un fuelle no deja registros: rearmarlo no daría nada, y repetirlo es el fuelle otra vez.
    const fuelleDelPlan = sesion(HOY, [], { tipo: 'fuelle' })
    expect(pasosParaRepetir(fuelleDelPlan, AVANCES)).toMatchObject({ busqueda: '?fuelle=1' })
    const fuelleDeRapidas = sesion(HOY, [], { tipo: 'fuelle', origen: { clase: 'rapida', cual: 'fuelle', nombre: 'El fuelle' } })
    expect(pasosParaRepetir(fuelleDeRapidas, AVANCES)).toMatchObject({ busqueda: '?fuelle=1' })
    const livianaDeLaRutina = sesion(HOY, [], {
      tipo: 'corta',
      origen: { clase: 'rutina', rutinaId: 'r1', nombre: 'Pecho en casa', liviana: true },
    })
    expect(pasosParaRepetir(livianaDeLaRutina, AVANCES, { rutinas: [RUTINA] })).toMatchObject({ busqueda: '?rutina=r1&liviana=1' })
  })

  describe('"Solo tengo 7 minutos" y la densa se rearman con sus registros, con origen repetir (§5.6 G)', () => {
    // La corta del lunes 19 con dos ejercicios. La corta de hoy saldría de la
    // rutina activa (Cuerpo completo, cuatro ejercicios): ir a ?corta=1 daría
    // otra sesión, guardada como rápida y no como repetición.
    const corta = sesion('2026-10-19', [registro('flexion-completa', [1, 7], [7]), registro('plancha', [1, 30], [30])], {
      tipo: 'corta',
      origen: { clase: 'rapida', cual: 'corta', nombre: 'Solo tengo 7 minutos' },
    })
    const cortaVieja = sesion('2026-10-19', [registro('flexion-completa', [1, 7], [7])], { tipo: 'corta' })
    const densa = sesion(
      '2026-10-19',
      [registro('flexion-completa', [3, 7], [7, 7, 7]), registro('flexion-rodillas', [2, 15], [15, 15], { bajada: true })],
      { origen: { clase: 'rapida', cual: 'densa', nombre: 'Sesión densa' } },
    )

    it('pasosParaRepetir no lleva a ?corta=1 ni a ?densa=1: rearma lo que se hizo', () => {
      const r = pasosParaRepetir(corta, AVANCES, { historial: [corta] })
      expect(r).toEqual({
        clase: 'pasos',
        pasos: [
          { id: `${corta.id}-p1`, ejercicioId: 'flexion-completa', objetivo: { series: 3, cantidad: 7 }, clase: 'cadena', seccion: 'principal' },
          { id: `${corta.id}-p2`, ejercicioId: 'plancha', objetivo: AVANCES.get('core')!.objetivoActual, clase: 'cadena', seccion: 'principal' },
        ],
        origen: { clase: 'repetir', sesionId: corta.id, nombre: 'Solo tengo 7 minutos' },
      })
      expect(pasosParaRepetir(cortaVieja, AVANCES)).toMatchObject({
        clase: 'pasos',
        origen: { clase: 'repetir', sesionId: cortaVieja.id, nombre: 'Solo tengo 7 minutos' },
      })
      expect(pasosParaRepetir(densa, AVANCES, { historial: [densa] })).toMatchObject({
        clase: 'pasos',
        pasos: [
          { ejercicioId: 'flexion-completa', clase: 'cadena' },
          { ejercicioId: 'flexion-rodillas', clase: 'volumen', bajada: true },
        ],
        origen: { clase: 'repetir', sesionId: densa.id, nombre: 'Sesión densa' },
      })
    })

    it('?repetir= arma esos mismos ejercicios con tu nivel de hoy, y no los de la rutina activa', () => {
      const historial = [corta, densa]
      const deLaCorta = arrancar(`?repetir=${corta.id}`, { historial })
      expect(ejercicios(deLaCorta)).toEqual(['flexion-completa', 'plancha'])
      expect(deLaCorta).toMatchObject({
        origen: { clase: 'repetir', sesionId: corta.id, nombre: 'Solo tengo 7 minutos' },
        tipo: 'plan',
        aviso: null,
      })
      const deLaDensa = arrancar(`?repetir=${densa.id}`, { historial })
      expect(ejercicios(deLaDensa)).toEqual(['flexion-completa', 'flexion-rodillas'])
      expect(deLaDensa).toMatchObject({ origen: { clase: 'repetir', sesionId: densa.id }, tipo: 'plan' })
      // Con Versión liviana, la liviana de lo rearmado.
      expect(arrancar(`?repetir=${corta.id}&liviana=1`, { historial })).toMatchObject({
        origen: { clase: 'repetir', sesionId: corta.id, liviana: true },
        tipo: 'corta',
      })
    })
  })

  /** Una sesión libre con un caso de cada regla de §5.6 G. */
  function laSesion(): Sesion {
    return sesion(
      HOY,
      [
        registro('flexion-rodillas', [1, 8], [8], { calentamiento: true }),
        registro('flexion-completa', [3, 7], [7, 7, 7, -4]),
        registro('flexion-diamante', [3, 6], [6, 6, 5]),
        registro('flexion-rodillas', [2, 15], [15, 15], { bajada: true }),
        registro('remo-australiano-alto', [3, 8], [8, 8, 8], { fijo: true }),
        registro('press-militar-barra', [4, 6], [6, 6, 6, 6], { bajada: true }),
        registro('plancha', [4, 20], [20, 20, 20, 20], { reloj: true }),
        registro('sentadilla-completa', [3, 10], [10, 10, 10]),
      ],
      {
        movilidad: [{ ejercicioId: 'gato-vaca', logrado: [8] }],
        origen: { clase: 'libre', nombre: 'Sesión libre' },
      },
    )
  }

  it('sin puerta a la que ir, se rearma con los registros y las cinco reglas de §5.6 G', () => {
    const s = laSesion()
    const r = pasosParaRepetir(s, AVANCES, { historial: [s] })
    if (r.clase !== 'pasos') throw new Error('tenía que rearmarse')
    expect(r.origen).toEqual({ clase: 'repetir', sesionId: s.id, nombre: 'Sesión libre' })
    const gatoVaca = movilidadDe('cuerpo').find((f) => f.id === 'gato-vaca')!
    expect(r.pasos).toEqual([
      // 5. La movilidad, primero y en Entrada, con la dosis de su ficha.
      {
        id: `${s.id}-p1`,
        ejercicioId: 'gato-vaca',
        objetivo: { series: gatoVaca.dosis.series, cantidad: gatoVaca.dosis.cantidad },
        clase: 'movilidad',
        seccion: 'entrada',
      },
      // 1. Sin la entrada en calor. 4. El primero de empuje lee: tu eslabón con el objetivo de hoy.
      { id: `${s.id}-p2`, ejercicioId: 'flexion-completa', objetivo: { series: 3, cantidad: 7 }, clase: 'cadena', seccion: 'principal' },
      // 4. El segundo de empuje vuelve fijo; no se cumplió, así que repite.
      {
        id: `${s.id}-p3`,
        ejercicioId: 'flexion-diamante',
        objetivo: { series: 3, cantidad: 6 },
        clase: 'fijo',
        fijo: true,
        seccion: 'principal',
      },
      // 2. Lo de bajada vuelve como volumen: el eslabón de abajo del de hoy.
      {
        id: `${s.id}-p4`,
        ejercicioId: 'flexion-rodillas',
        objetivo: { series: 2, cantidad: POR_ID.get('flexion-rodillas')!.ventana.max },
        clase: 'volumen',
        bajada: true,
        seccion: 'principal',
      },
      // 3. Lo fijo vuelve fijo, con la doble progresión: 3 × 8 cumplido es 3 × 9.
      {
        id: `${s.id}-p5`,
        ejercicioId: 'remo-australiano-alto',
        objetivo: { series: 3, cantidad: 9 },
        clase: 'fijo',
        fijo: true,
        seccion: 'principal',
      },
      // 3. Lo que no está en CADENAS vuelve fijo aunque se haya guardado con bajada.
      {
        id: `${s.id}-p6`,
        ejercicioId: 'press-militar-barra',
        objetivo: { series: 4, cantidad: 7 },
        clase: 'fijo',
        fijo: true,
        seccion: 'principal',
      },
      // 1. Sin el Reloj. 4. Piernas lee.
      { id: `${s.id}-p7`, ejercicioId: 'sentadilla-completa', objetivo: { series: 3, cantidad: 10 }, clase: 'cadena', seccion: 'principal' },
    ])
  })

  it('las reglas son las de Guardar como rutina, no una copia', () => {
    const s = laSesion()
    const r = pasosParaRepetir(s, AVANCES, { historial: [s] })
    const rutina = rutinaDesdeSesion(s, { id: s.id, ahora: 0, nombre: 'x', historial: [s] })
    expect(r).toMatchObject({ pasos: planDeRutina(rutina, { avances: AVANCES, historial: [s] }) })
  })

  it('nunca deja dos pasos que lean la misma cadena', () => {
    const s = laSesion()
    const r = pasosParaRepetir(s, AVANCES, { historial: [s] })
    const leen = r.clase === 'pasos' ? r.pasos.filter((p) => p.clase === 'cadena').map((p) => POR_ID.get(p.ejercicioId)!.patron) : []
    expect(new Set(leen).size).toBe(leen.length)
  })

  it('la serie de cierre no vuelve: un fijo vuelve con sus series y sube si las otras llegaron', () => {
    // 3 × 8 cumplido y un cierre de 3. Contada, la de cierre sería una cuarta
    // serie que no llegó a 8, y el fijo repetiría en vez de subir (§5.6 G1).
    const s = sesion(HOY, [registro('remo-australiano-alto', [3, 8], [8, 8, 8, -3], { fijo: true })], {
      origen: { clase: 'libre', nombre: 'Sesión libre' },
    })
    expect(pasosParaRepetir(s, AVANCES, { historial: [s] })).toMatchObject({
      clase: 'pasos',
      pasos: [{ ejercicioId: 'remo-australiano-alto', objetivo: { series: 3, cantidad: 9 }, clase: 'fijo', fijo: true }],
    })
  })

  it('el plan de otro día, una rutina borrada y una sesión vieja sin origen se rearman', () => {
    const vieja = sesion('2026-09-30', [registro('flexion-completa', [3, 7], [7, 7, 7])])
    expect(pasosParaRepetir(vieja, AVANCES)).toMatchObject({ clase: 'pasos', origen: { clase: 'repetir', nombre: 'Plan' } })
    const borrada = sesion(HOY, [], { origen: { clase: 'rutina', rutinaId: 'r-borrada', nombre: 'La de antes' } })
    expect(pasosParaRepetir(borrada, AVANCES, { rutinas: [RUTINA] })).toMatchObject({ clase: 'pasos' })
  })

  it('con Versión liviana, la liviana de lo rearmado', () => {
    const s = laSesion()
    const r = pasosParaRepetir(s, AVANCES, { historial: [s], liviana: true })
    if (r.clase !== 'pasos') throw new Error('tenía que rearmarse')
    expect(r.origen).toMatchObject({ liviana: true })
    const normal = pasosParaRepetir(s, AVANCES, { historial: [s] })
    expect(r.pasos).toEqual(versionLiviana(normal.clase === 'pasos' ? normal.pasos : []))
  })

  it('de la del Reloj no vuelve nada', () => {
    const reloj = sesion(HOY, [registro('flexion-completa', [8, 20], [20, 20], { reloj: true })], { tipo: 'reloj' })
    expect(pasosParaRepetir(reloj, AVANCES)).toMatchObject({ clase: 'pasos', pasos: [] })
  })
})

// ─── Lo que vale para todos ─────────────────────────────────────────────

describe('lo que vale para cualquier pedido', () => {
  const vieja = sesion('2026-10-14', [registro('flexion-completa', [3, 7], [7, 7, 7])])
  const URLS = [
    '',
    '?liviana=1',
    '?corta=1',
    '?fuelle=1',
    '?densa=1',
    '?rutina=r1',
    '?rutina=r1&liviana=1',
    '?rutina=borrada',
    '?mix=pecho&version=corta',
    '?mix=rodillas',
    '?ejercicio=flexion-diamante',
    '?ejercicio=flexion-completa&liviana=1',
    `?repetir=${vieja.id}`,
    `?repetir=${vieja.id}&liviana=1`,
    '?movilidad=todo',
    '?libre=1',
  ]

  it('el origen tiene exactamente la forma de OrigenDeSesion, y mismaSesion lo reconoce', () => {
    for (const preferencias of [CON_PLAN, SIN_PLAN]) {
      for (const url of URLS) {
        const { origen } = arrancar(url, { preferencias, historial: [vieja] })
        expect(tieneLaFormaDelOrigen(origen), `${url}: ${JSON.stringify(origen)}`).toBe(true)
        expect(mismaSesion({ origen, corta: false }, origen)).toBe(true)
      }
    }
  })

  it('los ids de los pasos no se repiten: son las claves de lo anotado', () => {
    for (const url of URLS) {
      const ids = arrancar(url, { historial: [vieja] }).pasos.map((p) => p.id)
      expect(ids.every((id) => typeof id === 'string')).toBe(true)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('lo liviano nunca lee: se guarda como corta', () => {
    for (const url of URLS.filter((u) => u.includes('liviana'))) {
      expect(arrancar(url, { historial: [vieja] }).tipo).toBe('corta')
    }
  })

  it('con la misma entrada da siempre lo mismo, y no toca lo que recibe', () => {
    const historial = Object.freeze([...ANTES_DE_LA_VUELTA, vieja]) as readonly Sesion[]
    const estados = Object.freeze([...DIAS_FLOJOS]) as readonly Estado[]
    const rutinas = Object.freeze([RUTINA, VACIA])
    for (const url of URLS) {
      const una = arrancar(url, { historial, estados, rutinas })
      const otra = arrancar(url, { historial, estados, rutinas })
      expect(una).toEqual(otra)
    }
  })
})

describe('un pedido que no se arma da lo de siempre (§2.4)', () => {
  // Cada forma de pedir algo que no está, con plan y sin plan. Tiene que dar
  // exactamente lo que da /entrenar sin parámetros —el plan de hoy o, sin plan,
  // la sugerencia— más el renglón que dice por qué. Sin plan, nunca un plan
  // que la persona no tiene.
  const delReloj = sesion('2026-10-16', [registro('flexion-completa', [8, 20], [20, 20], { reloj: true })], {
    tipo: 'reloj',
  })
  const CASOS: [url: string, que: LoQueNoSeEntiende][] = [
    ['?rutina=borrada', 'rutina'],
    ['?rutina=r0', 'rutina-vacia'],
    ['?mix=rodillas', 'zona'],
    ['?ejercicio=flexion-imaginaria', 'ejercicio'],
    ['?ejercicio=gato-vaca', 'movilidad-sola'],
    ['?ejercicio=isquios-toalla&liviana=1', 'movilidad-sola'],
    ['?repetir=s-que-no-esta', 'sesion'],
    [`?repetir=${delReloj.id}`, 'sesion-vacia'],
    ['?movilidad=rodillas', 'zona'],
    ['?libre=1', 'libre'],
  ]

  for (const [conPlan, preferencias] of [
    [true, CON_PLAN],
    [false, SIN_PLAN],
  ] as const) {
    it(conPlan ? 'con plan, el plan de hoy con su renglón' : 'sin plan, la sugerencia de hoy con su renglón', () => {
      const deSiempre = arrancar('', { preferencias, historial: [delReloj] })
      expect(deSiempre.aviso).toBeNull()
      expect(deSiempre.origen.clase).toBe(conPlan ? 'plan' : 'mix')
      for (const [url, que] of CASOS) {
        const r = arrancar(url, { preferencias, historial: [delReloj] })
        expect({ ...r, aviso: null }, url).toEqual(deSiempre)
        expect(r.aviso, url).toBe(lineaDelPedido(que, conPlan))
      }
    })
  }
})

describe('lineaDelPedido', () => {
  const TODOS: LoQueNoSeEntiende[] = [
    'rutina',
    'rutina-vacia',
    'zona',
    'ejercicio',
    'movilidad-sola',
    'sesion',
    'sesion-vacia',
    'libre',
  ]

  it('dice las dos de la especificación tal cual', () => {
    expect(lineaDelPedido('rutina', true)).toBe('Esa rutina ya no está: va el plan de hoy.')
    expect(lineaDelPedido('zona', true)).toBe('Esa zona no está: va el plan de hoy.')
    expect(lineaDelPedido('zona', false)).toBe('Esa zona no está: va la sugerencia de hoy.')
  })

  it('informa sin retar: nada prohibido, sin signos de exclamación y en un renglón', () => {
    for (const que of TODOS) {
      for (const conPlan of [true, false]) {
        const linea = lineaDelPedido(que, conPlan)
        expect(loProhibido(linea), linea).toBeNull()
        expect(linea).not.toMatch(/[!¡]/)
        expect(linea.length).toBeLessThanOrEqual(LARGO_DE_LINEA)
        expect(linea).toMatch(conPlan ? /: va el plan de hoy\.$/ : /: va la sugerencia de hoy\.$/)
      }
    }
  })

  it('un pedido que se arma no lleva renglón', () => {
    for (const url of ['', '?corta=1', '?rutina=r1', '?mix=pecho', '?ejercicio=flexion-diamante', '?movilidad=pecho']) {
      expect(arrancar(url).aviso).toBeNull()
    }
  })
})

// ─── El dominio del centro, puro ────────────────────────────────────────

/**
 * Las fuentes de R2 como texto: los módulos nuevos de §5.1 y los que R2
 * cambió. Que una función dé lo mismo dos veces no alcanza para llamarla
 * pura: un `Date.now()` en una rama que ningún test pisa también da lo mismo
 * dos veces seguidas. Esto mira el código, y el arranque es el que junta a
 * todos: nada del reloj, del azar, de la base ni de las pantallas (§5).
 */
const FUENTES_DE_R2 = import.meta.glob<string>(
  [
    './sectores.ts',
    './equipo.ts',
    './catalogo.ts',
    './mixes.ts',
    './rutinasPropias.ts',
    './dia.ts',
    './recuperacion.ts',
    './arranque.ts',
    './movilidad.ts',
    './lineas.ts',
    './adherencia.ts',
    './musculos.ts',
    './biblioteca.ts',
    './bajada.ts',
    './estadisticas.ts',
    './molestia.ts',
    './estado.ts',
    './frases.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
)

/**
 * El código sin comentarios, que pueden nombrar lo que el código no hace
 * ("por qué no hay `Math.random()` acá"). Alcanza con esto y no con un
 * recorrido como el de `simbolo.test.ts`: si una cadena se lleva algo por
 * delante, lo único que puede pasar es que se busque en menos texto, nunca
 * que aparezca algo que no está.
 */
const sinComentarios = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1')

const LO_QUE_NO_ES_PURO: [que: string, patron: RegExp][] = [
  ['el reloj', /\bDate\.now\s*\(|\bnew Date\s*\(\s*\)|\bperformance\.now\s*\(/],
  ['el azar', /\bMath\.random\s*\(|\bcrypto\s*\./],
  ['el almacenamiento', /\b(localStorage|sessionStorage|indexedDB)\b/],
  ['la red', /\bfetch\s*\(/],
  ['el navegador', /\b(window|document|navigator)\s*\./],
  ['React o Dexie', /from\s+['"](react|react-dom|react-router-dom|dexie|dexie-react-hooks)(\/[^'"]*)?['"]/],
  ['la base o las pantallas', /from\s+['"](@\/|\.\.\/)(datos|componentes|pantallas|hooks)\b/],
]

describe('el dominio del centro es puro', () => {
  it('están todos los módulos de R2', () => {
    expect(Object.keys(FUENTES_DE_R2)).toHaveLength(18)
  })

  it('ninguno lee el reloj, el azar, la base ni las pantallas: la hora y los datos entran como argumentos', () => {
    for (const [archivo, fuente] of Object.entries(FUENTES_DE_R2)) {
      const codigo = sinComentarios(fuente)
      for (const [que, patron] of LO_QUE_NO_ES_PURO) {
        expect(codigo.match(patron)?.[0] ?? null, `${archivo} usa ${que}`).toBeNull()
      }
    }
  })
})
