import { describe, expect, it } from 'vitest'
import { RECORTE_DE_VUELTA } from './adherencia'
import { CADENAS, POR_ID } from './biblioteca'
import { registrosDeLaSesion } from './borrador'
import { TOPE_DE_PASOS as TOPE_DE_LA_COPIA, revisarCopia } from './copia'
import { equipoDe } from './equipo'
import { LARGO_DE_LINEA, lineaDeCambios } from './lineas'
import { VERSIONES, resolverMix } from './mixes'
import { loProhibido } from './palabras'
import { PREFATIGA, incremento } from './progresion'
import {
  LARGO_DEL_NOMBRE,
  RUTINA_NUEVA,
  TOPE_DE_PASOS,
  aplicarCambios,
  cambiosQueSeAplican,
  nombreLibre,
  objetivoDelFijo,
  pasoDesdeEjercicio,
  planDeRutina,
  revisarRutina,
  rutinaDesdeMix,
  rutinaDesdeSesion,
  type AvisoDeRutina,
} from './rutinasPropias'
import { SECTORES } from './sectores'
import type {
  Avance,
  CambioEnSesion,
  Objetivo,
  PasoDeRutina,
  PasoDelBorrador,
  Patron,
  RegistroEjercicio,
  RutinaPropia,
  Serie,
  Sesion,
} from './tipos'

/**
 * Una rutina propia promete dos cosas que la persona no puede verificar desde
 * afuera: que lo que armó es lo que corre (un paso de cadena con el número del
 * motor, un fijo con los suyos, subidos de a poco), y que ninguna puerta —un
 * mix copiado, una sesión guardada, los cambios del Cierre— le arma algo que
 * después la copia de seguridad rechace o que lea dos veces la misma cadena.
 */

/** Miércoles 21 de octubre de 2026. */
const HOY = '2026-10-21'
const AYER = '2026-10-20'
const ANTEAYER = '2026-10-19'

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
 * Empuje en flexiones completas (eslabón 6) con un objetivo que no es lo bajo
 * de la ventana, para que se note de dónde sale; tracción en el remo medio
 * (eslabón 2) y core en la plancha (eslabón 2).
 */
const AVANCES = new Map<Patron, Avance>([
  ['empuje', avanceEn('empuje', 'flexion-completa', { series: 3, cantidad: 7 })],
  ['traccion', avanceEn('traccion', 'remo-australiano-medio')],
  ['piernas', avanceEn('piernas', 'sentadilla-completa')],
  ['core', avanceEn('core', 'plancha')],
  ['bisagra', avanceEn('bisagra', 'puente-gluteos-pies-elevados')],
])

/** Lo que trae `equipoDe` sin nada marcado: la barra cuenta como sí y la banda como no. */
const EQUIPO = equipoDe({})

const fijo = (id: string, ejercicioId: string, extra: Partial<PasoDeRutina> = {}): PasoDeRutina => ({
  id,
  clase: 'fijo',
  ejercicioId,
  series: 3,
  cantidad: 8,
  seccion: 'principal',
  ...extra,
})
const deCadena = (id: string, patron: Patron, extra: Partial<PasoDeRutina> = {}): PasoDeRutina => ({
  id,
  clase: 'cadena',
  patron,
  series: 3,
  seccion: 'principal',
  ...extra,
})
const deVolumen = (id: string, patron: Patron, extra: Partial<PasoDeRutina> = {}): PasoDeRutina => ({
  id,
  clase: 'volumen',
  patron,
  series: 2,
  seccion: 'principal',
  ...extra,
})
const movil = (id: string, ejercicioId: string, extra: Partial<PasoDeRutina> = {}): PasoDeRutina => ({
  id,
  clase: 'movilidad',
  ejercicioId,
  series: 1,
  seccion: 'entrada',
  ...extra,
})

function rutina(pasos: PasoDeRutina[], extra: Partial<RutinaPropia> = {}): RutinaPropia {
  return {
    id: 'r1',
    nombre: 'Pecho en casa',
    pasos,
    creadaEn: a(ANTEAYER, 8),
    actualizadaEn: a(ANTEAYER, 8),
    ...extra,
  }
}

/** Un registro con lo logrado en cada serie; un número negativo es la serie de cierre. */
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

/**
 * Un registro como lo guarda Entrenar, con el mismo escritor
 * (`registrosDeLaSesion`): el objetivo con lo que se propuso, y los kilos en
 * cada serie, que es donde los anota (`Entrenar.tsx`, "los kilos de ESTA
 * serie"). Cada serie es [logrado, kg]; un logrado negativo es la serie de
 * cierre, que va sin kilos, y 0 kg es una serie sin discos.
 */
function comoLoGuardaEntrenar(
  ejercicioId: string,
  objetivo: Objetivo,
  series: [logrado: number, kg: number][],
): RegistroEjercicio[] {
  const hechas = series.map(([logrado, kg]): Serie =>
    logrado < 0 ? { logrado: -logrado, cierre: true } : { logrado, ...(kg > 0 ? { kg } : {}) },
  )
  return registrosDeLaSesion([{ id: 'p1', ejercicioId, objetivo, clase: 'fijo', fijo: true }], { p1: hechas })
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

/** Si la copia de seguridad aceptaría estas rutinas tal cual. */
function laCopiaLasAcepta(rutinas: RutinaPropia[]): boolean {
  const revision = revisarCopia({
    version: 4,
    exportadoEn: '2026-10-21T12:00:00.000Z',
    sesiones: [],
    avances: [],
    preferencias: { id: 'unico', rutinaActivaId: 'cuerpo-completo', sonidoDescanso: true },
    rutinas,
  })
  if ('problema' in revision) throw new Error(revision.problema)
  return true
}

/** Congela a fondo, para que un test falle si una función toca lo que recibe. */
function congelada<T>(valor: T): T {
  if (typeof valor === 'object' && valor !== null) {
    for (const v of Object.values(valor)) congelada(v)
    Object.freeze(valor)
  }
  return valor
}

describe('el tope de pasos', () => {
  it('es 30, y es el mismo número que revisa la copia', () => {
    expect(TOPE_DE_PASOS).toBe(30)
    expect(TOPE_DE_PASOS).toBe(TOPE_DE_LA_COPIA)
  })
})

describe('pasoDesdeEjercicio', () => {
  it('toma lo bajo de la ventana y las series de la ficha: "3 × 5–12" queda en 3 × 5', () => {
    expect(pasoDesdeEjercicio('flexion-diamante', { id: 'p1', avances: AVANCES })).toEqual({
      id: 'p1',
      clase: 'fijo',
      ejercicioId: 'flexion-diamante',
      series: 3,
      cantidad: 5,
      seccion: 'principal',
    })
    expect(pasoDesdeEjercicio('remo-australiano-alto', { id: 'p2' })).toMatchObject({ series: 3, cantidad: 8 })
    expect(pasoDesdeEjercicio('press-militar-barra', { id: 'p3' })).toMatchObject({
      clase: 'fijo',
      series: 4,
      cantidad: 6,
    })
  })

  it('no escribe el descanso ni editadoEn: el descanso es el de la ficha y la progresión sigue', () => {
    const paso = pasoDesdeEjercicio('flexion-diamante', { id: 'p1' })!
    expect(paso).not.toHaveProperty('descansoSegundos')
    expect(paso).not.toHaveProperty('editadoEn')
  })

  it('tu eslabón actual entra como paso de cadena, con el objetivo del motor', () => {
    expect(pasoDesdeEjercicio('flexion-completa', { id: 'p1', avances: AVANCES })).toEqual({
      id: 'p1',
      clase: 'cadena',
      patron: 'empuje',
      series: 3,
      seccion: 'principal',
    })
  })

  it('sin avances, o si la rutina ya sigue esa cadena, tu eslabón entra fijo', () => {
    expect(pasoDesdeEjercicio('flexion-completa', { id: 'p1' })).toMatchObject({ clase: 'fijo' })
    const yaLaSigue = pasoDesdeEjercicio('flexion-completa', {
      id: 'p2',
      avances: AVANCES,
      pasos: [deCadena('c', 'empuje')],
    })
    expect(yaLaSigue).toMatchObject({ clase: 'fijo', ejercicioId: 'flexion-completa', cantidad: 5 })
    // Otra cadena no cuenta.
    const otraCadena = pasoDesdeEjercicio('flexion-completa', {
      id: 'p3',
      avances: AVANCES,
      pasos: [deCadena('c', 'traccion')],
    })
    expect(otraCadena).toMatchObject({ clase: 'cadena', patron: 'empuje' })
  })

  it('la movilidad entra con la dosis de su ficha, en Entrada, y los estiramientos de después en Final', () => {
    expect(pasoDesdeEjercicio('munecas-cuatro-patas', { id: 'm1' })).toEqual({
      id: 'm1',
      clase: 'movilidad',
      ejercicioId: 'munecas-cuatro-patas',
      series: 2,
      cantidad: 10,
      seccion: 'entrada',
    })
    expect(pasoDesdeEjercicio('pectoral-marco', { id: 'm2' })).toMatchObject({ seccion: 'final' })
    expect(pasoDesdeEjercicio('pectoral-marco', { id: 'm3', seccion: 'principal' })).toMatchObject({
      seccion: 'principal',
    })
  })

  it('un id que la app no conoce no da ningún paso', () => {
    expect(pasoDesdeEjercicio('flexion-con-aplauso-triple', { id: 'p1' })).toBeNull()
  })
})

describe('objetivoDelFijo', () => {
  const DIAMANTE = POR_ID.get('flexion-diamante')! // 5 a 12 repeticiones
  const PARED = POR_ID.get('flexion-pared')! // 8 a 15 repeticiones
  const PLANCHA = POR_ID.get('plancha')! // 15 a 30 segundos

  it('sin historial, los números del paso; sin cantidad, lo bajo de la ventana y las series de la ficha', () => {
    expect(objetivoDelFijo({ series: 4, cantidad: 7 }, DIAMANTE, [])).toEqual({ series: 4, cantidad: 7 })
    expect(objetivoDelFijo({}, DIAMANTE, [])).toEqual({ series: 3, cantidad: 5 })
  })

  it('si todas las series llegaron, sube con incremento(): una repetición o 3 segundos', () => {
    const conDiamante = [sesion(AYER, [registro('flexion-diamante', [3, 8], [8, 8, 8])])]
    expect(objetivoDelFijo({ series: 3, cantidad: 8 }, DIAMANTE, conDiamante).cantidad).toBe(
      8 + incremento('repeticiones', 8),
    )
    expect(objetivoDelFijo({ series: 3, cantidad: 8 }, DIAMANTE, conDiamante).cantidad).toBe(9)

    const conPlancha = [sesion(AYER, [registro('plancha', [3, 20], [20, 22, 20])])]
    expect(objetivoDelFijo({ series: 3, cantidad: 20 }, PLANCHA, conPlancha).cantidad).toBe(
      20 + incremento('segundos', 20),
    )
    expect(objetivoDelFijo({ series: 3, cantidad: 20 }, PLANCHA, conPlancha).cantidad).toBe(23)
  })

  it('sube hasta el techo de la ventana y se queda ahí', () => {
    const de = (cantidad: number) => [
      sesion(AYER, [registro('flexion-diamante', [3, cantidad], [cantidad, cantidad, cantidad])]),
    ]
    expect(objetivoDelFijo({}, DIAMANTE, de(11)).cantidad).toBe(12)
    expect(objetivoDelFijo({}, DIAMANTE, de(12)).cantidad).toBe(12)
    const enLaPared = [sesion(AYER, [registro('flexion-pared', [3, 14], [14, 15, 14])])]
    expect(objetivoDelFijo({}, PARED, enLaPared).cantidad).toBe(15)
    const enLaPlancha = [sesion(AYER, [registro('plancha', [3, 29], [29, 29, 30])])]
    expect(objetivoDelFijo({}, PLANCHA, enLaPlancha).cantidad).toBe(30)
  })

  it('un objetivo que ya pasaba el techo no se recorta', () => {
    const arriba = [sesion(AYER, [registro('flexion-diamante', [3, 14], [14, 14, 14])])]
    expect(objetivoDelFijo({}, DIAMANTE, arriba).cantidad).toBe(14)
  })

  it('si no se cumplió, repite el objetivo: ni sube ni baja', () => {
    const corta = [sesion(AYER, [registro('flexion-diamante', [3, 9], [9, 9, 7])])]
    expect(objetivoDelFijo({ cantidad: 8 }, DIAMANTE, corta).cantidad).toBe(9)
    const unaMenos = [sesion(AYER, [registro('flexion-diamante', [3, 9], [10, 10])])]
    expect(objetivoDelFijo({ cantidad: 8 }, DIAMANTE, unaMenos).cantidad).toBe(9)
  })

  it('la serie de cierre no completa las que faltaron', () => {
    const conCierre = [sesion(AYER, [registro('flexion-diamante', [3, 8], [8, 8, -12])])]
    expect(objetivoDelFijo({}, DIAMANTE, conCierre).cantidad).toBe(8)
  })

  it('en una rutina, solo cuentan las sesiones posteriores a editadoEn', () => {
    const vieja = sesion(ANTEAYER, [registro('flexion-diamante', [3, 10], [10, 10, 10])])
    const editado = a(AYER, 9)
    expect(objetivoDelFijo({ cantidad: 6, editadoEn: editado }, DIAMANTE, [vieja]).cantidad).toBe(6)
    const nueva = sesion(HOY, [registro('flexion-diamante', [3, 6], [6, 6, 6])])
    expect(objetivoDelFijo({ cantidad: 6, editadoEn: editado }, DIAMANTE, [vieja, nueva]).cantidad).toBe(7)
  })

  it('la entrada en calor, el Reloj y las sesiones cortas o livianas no son la última vez', () => {
    const base = sesion(ANTEAYER, [registro('flexion-diamante', [3, 9], [9, 9, 9])])
    const despues = [
      sesion(AYER, [registro('flexion-diamante', [1, 5], [5], { calentamiento: true })]),
      sesion(AYER, [registro('flexion-diamante', [4, 20], [20, 20, 20, 20], { reloj: true })], {
        tipo: 'reloj',
        finalizadaEn: a(AYER, 12),
      }),
      sesion(HOY, [registro('flexion-diamante', [2, 5], [5, 5])], { tipo: 'corta' }),
    ]
    expect(objetivoDelFijo({}, DIAMANTE, [base, ...despues]).cantidad).toBe(10)
  })

  it('con dos sesiones el mismo día, manda la que cerró más tarde, vengan en el orden que vengan', () => {
    const manana = sesion(HOY, [registro('flexion-diamante', [3, 8], [8, 8, 8])], { finalizadaEn: a(HOY, 9) })
    const tarde = sesion(HOY, [registro('flexion-diamante', [3, 9], [9, 8, 8])], { finalizadaEn: a(HOY, 19) })
    expect(objetivoDelFijo({}, DIAMANTE, [manana, tarde]).cantidad).toBe(9)
    expect(objetivoDelFijo({}, DIAMANTE, [tarde, manana]).cantidad).toBe(9)
  })

  it('los kilos son los del paso o, si no tiene, los que se levantaron la última vez', () => {
    const press = POR_ID.get('press-militar-barra')!
    // Se propusieron 20 kg y se levantaron 25 en cada serie.
    const conKilos = [sesion(AYER, comoLoGuardaEntrenar('press-militar-barra', { series: 4, cantidad: 6, kg: 20 }, [[6, 25], [6, 25], [6, 25], [6, 25]]))]
    expect(objetivoDelFijo({}, press, conKilos)).toEqual({ series: 4, cantidad: 7, kg: 25 })
    expect(objetivoDelFijo({ kg: 30 }, press, conKilos)).toEqual({ series: 4, cantidad: 7, kg: 30 })
    expect(objetivoDelFijo({}, press, [])).not.toHaveProperty('kg')
  })

  it('la primera vez sin kilos propuestos, los kilos son los que se levantaron', () => {
    const press = POR_ID.get('press-militar-barra')!
    const primera = [sesion(AYER, comoLoGuardaEntrenar('press-militar-barra', { series: 4, cantidad: 6 }, [[6, 30], [6, 30], [6, 30], [6, 30]]))]
    expect(objetivoDelFijo({}, press, primera)).toEqual({ series: 4, cantidad: 7, kg: 30 })
  })

  it('los kilos son los de la serie más pesada, sin la de cierre; sin kilos en las series, no se inventan', () => {
    const press = POR_ID.get('press-militar-barra')!
    const desparejas = [
      sesion(AYER, comoLoGuardaEntrenar('press-militar-barra', { series: 3, cantidad: 6, kg: 20 }, [[6, 25], [6, 27.5], [5, 25], [-8, 0]])),
    ]
    expect(objetivoDelFijo({}, press, desparejas).kg).toBe(27.5)
    // Se propusieron 20 kg y se hizo sin discos: decir 20 sería proponer lo que no se levantó.
    const sinDiscos = [sesion(AYER, comoLoGuardaEntrenar('press-militar-barra', { series: 4, cantidad: 6, kg: 20 }, [[6, 0], [6, 0], [6, 0], [6, 0]]))]
    expect(objetivoDelFijo({}, press, sinDiscos)).not.toHaveProperty('kg')
  })

  it('dos veces seguidas con más peso: los kilos siguen a la última', () => {
    const press = POR_ID.get('press-militar-barra')!
    const historial = [
      sesion(ANTEAYER, comoLoGuardaEntrenar('press-militar-barra', { series: 4, cantidad: 6, kg: 20 }, [[6, 25], [6, 25], [6, 25], [6, 25]])),
      sesion(AYER, comoLoGuardaEntrenar('press-militar-barra', { series: 4, cantidad: 7, kg: 25 }, [[7, 27.5], [7, 27.5], [7, 27.5], [7, 27.5]])),
    ]
    expect(objetivoDelFijo({}, press, historial)).toEqual({ series: 4, cantidad: 8, kg: 27.5 })
  })
})

describe('planDeRutina', () => {
  it('el paso de cadena toma el eslabón y el objetivo del motor, y no va como fijo', () => {
    const [paso] = planDeRutina(rutina([deCadena('c', 'empuje')]), { avances: AVANCES, historial: [] })
    expect(paso).toEqual({
      id: 'c',
      ejercicioId: 'flexion-completa',
      objetivo: { series: 3, cantidad: 7 },
      clase: 'cadena',
      seccion: 'principal',
    })
  })

  it('el fijo va con sus números, su descanso y la marca de fijo', () => {
    const r = rutina([fijo('f', 'flexion-diamante', { series: 4, cantidad: 6, descansoSegundos: 60 })])
    expect(planDeRutina(r, { avances: AVANCES, historial: [] })).toEqual([
      {
        id: 'f',
        ejercicioId: 'flexion-diamante',
        objetivo: { series: 4, cantidad: 6 },
        clase: 'fijo',
        fijo: true,
        seccion: 'principal',
        descansoSegundos: 60,
      },
    ])
  })

  it('el fijo sube con su doble progresión', () => {
    const historial = [sesion(AYER, [registro('flexion-diamante', [4, 6], [6, 6, 6, 7])])]
    const r = rutina([fijo('f', 'flexion-diamante', { series: 4, cantidad: 6 })])
    expect(planDeRutina(r, { avances: AVANCES, historial })[0]?.objetivo).toEqual({ series: 4, cantidad: 7 })
  })

  it('el de volumen es el eslabón anterior con la dosis de la bajada, y se guarda con bajada', () => {
    expect(planDeRutina(rutina([deVolumen('v', 'empuje')]), { avances: AVANCES, historial: [] })).toEqual([
      {
        id: 'v',
        ejercicioId: 'flexion-rodillas',
        objetivo: { series: 2, cantidad: 15 },
        bajada: true,
        clase: 'volumen',
        seccion: 'principal',
      },
    ])
  })

  it('un paso de volumen en el primer eslabón no va: no hay uno más fácil', () => {
    const enLaPared = new Map(AVANCES).set('empuje', avanceEn('empuje', 'flexion-pared'))
    const r = rutina([deVolumen('v', 'empuje'), deCadena('c', 'empuje')])
    expect(planDeRutina(r, { avances: enLaPared, historial: [] }).map((p) => p.id)).toEqual(['c'])
  })

  it('un id desconocido se saltea y el resto sigue', () => {
    const r = rutina([
      fijo('x', 'flexion-con-aplauso-triple'),
      fijo('f', 'flexion-diamante'),
      movil('m', 'estiramiento-que-se-retiro'),
    ])
    expect(planDeRutina(r, { avances: AVANCES, historial: [] }).map((p) => p.id)).toEqual(['f'])
  })

  it('una rutina sin pasos da un plan vacío, también con molestia y ajuste', () => {
    expect(planDeRutina(rutina([]), { avances: AVANCES, historial: [] })).toEqual([])
    expect(
      planDeRutina(rutina([]), {
        avances: AVANCES,
        historial: [],
        molestias: 'empuje',
        ajuste: { factor: 0.9 },
        bajarLosTuyos: true,
        vuelta: true,
      }),
    ).toEqual([])
    expect(planDeRutina(rutina([]), { avances: new Map(), historial: [] })).toEqual([])
  })

  it('la movilidad va con la dosis de su ficha, o con la cantidad que le puso la persona', () => {
    const r = rutina([movil('m', 'gato-vaca'), movil('n', 'gato-vaca', { series: 2, cantidad: 12 })])
    expect(planDeRutina(r, { avances: AVANCES, historial: [] })).toEqual([
      { id: 'm', ejercicioId: 'gato-vaca', objetivo: { series: 1, cantidad: 8 }, clase: 'movilidad', seccion: 'entrada' },
      { id: 'n', ejercicioId: 'gato-vaca', objetivo: { series: 2, cantidad: 12 }, clase: 'movilidad', seccion: 'entrada' },
    ])
  })

  it('corre por secciones, como se ven, y adentro de cada una en su orden', () => {
    const r = rutina([
      fijo('z', 'plancha', { seccion: 'final' }),
      deCadena('c', 'empuje'),
      movil('m', 'gato-vaca'),
      fijo('f', 'flexion-diamante'),
      movil('n', 'libro-abierto'),
    ])
    expect(planDeRutina(r, { avances: AVANCES, historial: [] }).map((p) => p.id)).toEqual([
      'm',
      'n',
      'c',
      'f',
      'z',
    ])
  })

  it('un fijo o un volumen en Entrada es entrada en calor; un paso de cadena ahí sigue leyendo', () => {
    const r = rutina([
      fijo('e', 'flexion-rodillas', { seccion: 'entrada', series: 1 }),
      deVolumen('v', 'traccion', { seccion: 'entrada' }),
      deCadena('c', 'empuje', { seccion: 'entrada' }),
      fijo('f', 'flexion-diamante'),
    ])
    const plan = planDeRutina(r, { avances: AVANCES, historial: [] })
    expect(plan.find((p) => p.id === 'e')).toMatchObject({ calentamiento: true, fijo: true })
    expect(plan.find((p) => p.id === 'v')).toMatchObject({ calentamiento: true, bajada: true })
    expect(plan.find((p) => p.id === 'c')).not.toHaveProperty('calentamiento')
    expect(plan.find((p) => p.id === 'f')).not.toHaveProperty('calentamiento')
  })

  describe('el chequeo y la vuelta', () => {
    const r = rutina([deCadena('c', 'empuje'), fijo('f', 'flexion-diamante', { cantidad: 8 })])

    it('el ajuste baja los pasos de cadena y deja los fijos como los armaste', () => {
      const plan = planDeRutina(r, { avances: AVANCES, historial: [], ajuste: { factor: 0.9 } })
      expect(plan.map((p) => p.objetivo.cantidad)).toEqual([6, 8])
    })

    it('Bajar también los tuyos aplica el mismo ajuste a los fijos', () => {
      const plan = planDeRutina(r, {
        avances: AVANCES,
        historial: [],
        ajuste: { factor: 0.9 },
        bajarLosTuyos: true,
      })
      expect(plan.map((p) => p.objetivo.cantidad)).toEqual([6, 7])
    })

    it('la vuelta recorta los pasos de cadena, y se multiplica con el ajuste', () => {
      const vuelta = planDeRutina(r, { avances: AVANCES, historial: [], vuelta: true })
      expect(vuelta.map((p) => p.objetivo.cantidad)).toEqual([Math.round(7 * RECORTE_DE_VUELTA), 8])
      const lasDos = planDeRutina(r, { avances: AVANCES, historial: [], vuelta: true, ajuste: { factor: 0.9 } })
      expect(lasDos[0]?.objetivo.cantidad).toBe(Math.round(7 * RECORTE_DE_VUELTA * 0.9))
    })

    it('un día sin ajuste no cambia nada', () => {
      expect(planDeRutina(r, { avances: AVANCES, historial: [], ajuste: { factor: 1 }, bajarLosTuyos: true })).toEqual(
        planDeRutina(r, { avances: AVANCES, historial: [] }),
      )
    })
  })

  describe('la molestia', () => {
    const r = rutina([
      movil('m', 'munecas-cuatro-patas'),
      deCadena('c', 'empuje'),
      fijo('f', 'flexion-diamante'),
      fijo('t', 'remo-australiano-alto'),
    ])

    it('el paso de cadena baja un eslabón y el fijo de esa cadena recibe la regla del plan', () => {
      const plan = planDeRutina(r, { avances: AVANCES, historial: [], molestias: 'empuje' })
      expect(plan.find((p) => p.id === 'c')).toMatchObject({
        ejercicioId: 'flexion-rodillas',
        objetivo: { series: 2, cantidad: 8 },
        bajada: true,
        clase: 'volumen',
      })
      expect(plan.find((p) => p.id === 'f')).toMatchObject({
        ejercicioId: 'flexion-completa',
        bajada: true,
        fijo: true,
      })
      // Lo que no carga empuje y la movilidad quedan igual.
      expect(plan.find((p) => p.id === 't')).toMatchObject({ ejercicioId: 'remo-australiano-alto' })
      expect(plan.find((p) => p.id === 'm')).toMatchObject({ ejercicioId: 'munecas-cuatro-patas' })
    })

    it('"Dejarlo como lo armé" deja los fijos y baja igual el de cadena', () => {
      const plan = planDeRutina(r, {
        avances: AVANCES,
        historial: [],
        molestias: ['empuje'],
        fijos: 'como-los-armaste',
      })
      expect(plan.find((p) => p.id === 'f')).toMatchObject({ ejercicioId: 'flexion-diamante' })
      expect(plan.find((p) => p.id === 'f')).not.toHaveProperty('bajada')
      expect(plan.find((p) => p.id === 'c')).toMatchObject({ ejercicioId: 'flexion-rodillas' })
    })

    it('lo que ya tiene series anotadas no cambia', () => {
      const plan = planDeRutina(r, {
        avances: AVANCES,
        historial: [],
        molestias: 'empuje',
        hechas: { c: [{ logrado: 7 }] },
      })
      expect(plan.find((p) => p.id === 'c')).toMatchObject({ ejercicioId: 'flexion-completa', clase: 'cadena' })
    })
  })

  it('con la misma entrada da lo mismo, y no toca la rutina que recibe', () => {
    const historial = congelada([sesion(AYER, [registro('flexion-diamante', [3, 8], [8, 8, 8])])])
    const r = congelada(
      rutina([fijo('f', 'flexion-diamante'), deCadena('c', 'empuje'), movil('m', 'gato-vaca')]),
    )
    const contexto = { avances: AVANCES, historial, molestias: 'empuje' as const, ajuste: { factor: 0.9 } }
    expect(planDeRutina(r, contexto)).toEqual(planDeRutina(r, contexto))
  })
})

describe('revisarRutina', () => {
  const revisar = (r: RutinaPropia, extra: { equipo?: ReturnType<typeof equipoDe>; historial?: Sesion[] } = {}) =>
    revisarRutina(r, { avances: AVANCES, historial: extra.historial ?? [], equipo: extra.equipo ?? EQUIPO })
  const textos = (avisos: AvisoDeRutina[]) => avisos.map((a) => a.texto)

  it('una rutina sin pasos no tiene avisos', () => {
    expect(revisar(rutina([]))).toEqual([])
  })

  it('una rutina sin nada que decir no tiene avisos', () => {
    expect(revisar(rutina([deCadena('c', 'empuje'), fijo('f', 'remo-australiano-alto')]))).toEqual([])
  })

  it('un fijo con tu eslabón ofrece que siga tu nivel', () => {
    expect(revisar(rutina([fijo('f', 'flexion-completa')]))).toEqual([
      { clase: 'que-siga', pasoId: 'f', patron: 'empuje', texto: 'Es tu eslabón de empuje. ¿Que siga tu nivel?' },
    ])
    expect(textos(revisar(rutina([fijo('t', 'remo-australiano-medio')])))).toEqual([
      'Es tu eslabón de tracción. ¿Que siga tu nivel?',
    ])
  })

  it('no lo ofrece con "Dejarlo fijo", con otro paso que ya sigue esa cadena ni en la entrada en calor', () => {
    expect(revisar(rutina([fijo('f', 'flexion-completa')], { dejarFijo: ['f'] }))).toEqual([])
    expect(revisar(rutina([fijo('f', 'flexion-completa'), deCadena('c', 'empuje')]))).toEqual([])
    expect(revisar(rutina([fijo('f', 'flexion-completa', { seccion: 'entrada' })]))).toEqual([])
  })

  it('un fijo arriba de tu nivel lo dice, con cuántos eslabones', () => {
    expect(revisar(rutina([fijo('f', 'flexion-declinada')]))).toEqual([
      {
        clase: 'arriba',
        pasoId: 'f',
        patron: 'empuje',
        eslabones: 2,
        texto: 'Está dos eslabones arriba de tu empuje.',
      },
    ])
  })

  it('un fijo con un requisito sin cumplir lo dice, y no lo saca', () => {
    const r = rutina([fijo('p', 'palanca-frontal-agrupada')])
    const avisos = revisar(r)
    expect(avisos).toContainEqual({
      clase: 'requisito',
      pasoId: 'p',
      texto: 'Pide antes: dominadas completas 3 × 8.',
    })
    expect(planDeRutina(r, { avances: AVANCES, historial: [] }).map((p) => p.id)).toEqual(['p'])
  })

  it('un segundo paso que sigue la misma cadena suma volumen, y lo dice el que corre después', () => {
    const r = rutina([deCadena('c1', 'empuje'), deCadena('c2', 'empuje')])
    expect(revisar(r)).toEqual([
      {
        clase: 'ya-hay-uno',
        pasoId: 'c2',
        patron: 'empuje',
        texto: 'Ya hay un paso que sigue tu nivel de empuje: este suma volumen.',
      },
    ])
    // El que corre primero es el de la sección de antes, aunque esté después en la lista.
    const alReves = rutina([deCadena('c1', 'empuje'), deCadena('c2', 'empuje', { seccion: 'entrada' })])
    expect(revisar(alReves).map((a) => a.pasoId)).toEqual(['c1'])
  })

  describe('la prefatiga', () => {
    const pecho = (seriesAntes: [number, number], extra: Partial<PasoDeRutina> = {}) =>
      rutina([
        fijo('a', 'flexion-rodillas', { series: seriesAntes[0], ...extra }),
        fijo('b', 'flexion-inclinada-baja', { series: seriesAntes[1] }),
        deCadena('c', 'empuje'),
      ])

    it('el paso que lee su cadena después de 7 series de pectoral lo dice', () => {
      expect(revisar(pecho([3, 4]))).toEqual([
        {
          clase: 'prefatiga',
          pasoId: 'c',
          musculo: 'pectoral',
          series: 7,
          texto: 'Va después de 7 series de pectoral: si sale menos, tu nivel no baja.',
        },
      ])
    })

    it(`desde ${PREFATIGA} series, y no antes`, () => {
      expect(revisar(pecho([3, 3])).map((a) => a.clase)).toEqual(['prefatiga'])
      expect(revisar(pecho([2, 3]))).toEqual([])
    })

    it('la entrada en calor, la movilidad y lo que va después no cuentan', () => {
      expect(revisar(pecho([3, 3], { seccion: 'entrada' }))).toEqual([])
      const despues = rutina([
        movil('m', 'munecas-cuatro-patas'),
        deCadena('c', 'empuje'),
        fijo('a', 'flexion-rodillas', { series: 4 }),
        fijo('b', 'flexion-inclinada-baja', { series: 4 }),
      ])
      expect(revisar(despues)).toEqual([])
    })

    it('el segundo paso de la misma cadena no lee, así que no lleva la prefatiga', () => {
      const r = rutina([
        deCadena('c1', 'empuje'),
        fijo('a', 'flexion-rodillas', { series: 4 }),
        deCadena('c2', 'empuje'),
      ])
      expect(revisar(r).map((a) => a.clase)).toEqual(['ya-hay-uno'])
    })
  })

  it('lo que pide algo que no marcaste lo nombra; lo dado por tenido, nunca', () => {
    const asistida = rutina([fijo('d', 'dominada-asistida')])
    const deEquipo = (equipo: ReturnType<typeof equipoDe>) =>
      revisar(asistida, { equipo }).filter((a) => a.clase === 'equipo')
    expect(deEquipo(EQUIPO)).toEqual([
      { clase: 'equipo', pasoId: 'd', faltan: ['banda'], texto: 'Pide banda elástica, que no marcaste.' },
    ])
    expect(textos(deEquipo(equipoDe({ tieneBarra: false })))).toEqual([
      'Pide barra fija y banda elástica, que no marcaste.',
    ])
    expect(deEquipo(equipoDe({ tieneBanda: true }))).toEqual([])
    // Con un equipo vacío, la silla igual no se nombra: no se marca en ningún lado.
    expect(revisarRutina(rutina([fijo('s', 'flexion-inclinada')]), { avances: AVANCES, historial: [], equipo: [] })).toEqual([])
  })

  it('un paso con un id que ya no existe lo dice', () => {
    const r = rutina([fijo('x', 'flexion-con-aplauso-triple'), movil('m', 'estiramiento-que-se-retiro')])
    // Los avisos salen en el orden en que se hacen los pasos: la movilidad de la Entrada va primero.
    expect(revisar(r)).toEqual([
      { clase: 'ya-no-esta', pasoId: 'm', texto: 'Este ejercicio ya no está en la app.' },
      { clase: 'ya-no-esta', pasoId: 'x', texto: 'Este ejercicio ya no está en la app.' },
    ])
  })

  it('cada aviso respeta la voz: sin palabras prohibidas, sin exclamación y en 140', () => {
    const todo = rutina([
      fijo('x', 'flexion-con-aplauso-triple'),
      fijo('a', 'flexion-rodillas', { series: 4 }),
      fijo('b', 'flexion-inclinada-baja', { series: 4 }),
      deCadena('c1', 'empuje'),
      deCadena('c2', 'empuje'),
      fijo('t', 'remo-australiano-medio'),
      fijo('p', 'palanca-frontal-agrupada'),
      fijo('d', 'dominada-asistida'),
      fijo('n', 'sentadilla-una-pierna-asistida'),
    ])
    const avisos = revisar(todo, { equipo: equipoDe({ tieneBarra: false }) })
    expect(new Set(avisos.map((a) => a.clase))).toEqual(
      new Set(['ya-no-esta', 'que-siga', 'arriba', 'requisito', 'ya-hay-uno', 'prefatiga', 'equipo']),
    )
    for (const { texto } of avisos) {
      expect(loProhibido(texto), texto).toBeNull()
      expect(texto.length, texto).toBeLessThanOrEqual(LARGO_DE_LINEA)
      expect(texto, texto).not.toContain('!')
      expect(texto, texto).toMatch(/[.?]$/)
    }
  })

  it('con la misma entrada da lo mismo', () => {
    const r = congelada(rutina([fijo('f', 'flexion-completa'), deCadena('c1', 'empuje'), deCadena('c2', 'empuje')]))
    expect(revisar(r)).toEqual(revisar(r))
  })
})

describe('rutinaDesdeSesion', () => {
  /** Una sesión libre con un caso de cada regla de §5.6 G. */
  function laSesion(): Sesion {
    return sesion(
      HOY,
      [
        registro('flexion-rodillas', [1, 8], [8], { calentamiento: true }),
        registro('flexion-completa', [3, 7], [7, 7, 7]),
        registro('flexion-diamante', [3, 6], [6, 6, 5]),
        registro('flexion-rodillas', [2, 15], [15, 15], { bajada: true }),
        registro('remo-australiano-alto', [3, 8], [8, 8, 8], { fijo: true }),
        registro('press-militar-barra', [4, 6], [6, 6, 6, 6], { bajada: true }),
        registro('plancha', [4, 20], [20, 20, 20, 20], { reloj: true }),
        registro('flexion-con-aplauso-triple', [3, 8], [8, 8, 8]),
        registro('sentadilla-completa', [3, 10], [-5]),
      ],
      {
        movilidad: [
          { ejercicioId: 'gato-vaca', logrado: [8] },
          { ejercicioId: 'estiramiento-que-se-retiro', logrado: [1] },
        ],
        origen: { clase: 'libre', nombre: 'Sesión libre' },
      },
    )
  }
  const NUEVA = { id: 'r9', ahora: a(HOY, 21), nombre: 'Sesión libre 21/10' }

  it('arma los pasos con las cinco reglas de §5.6 G', () => {
    const s = laSesion()
    const r = rutinaDesdeSesion(s, NUEVA)
    expect(r.pasos).toEqual([
      // 5. La movilidad, en Entrada y con la dosis de su ficha; la que no existe no vuelve.
      { id: 'r9-p1', clase: 'movilidad', ejercicioId: 'gato-vaca', series: 1, cantidad: 8, seccion: 'entrada' },
      // 1. Sin la entrada en calor. 4. El primero de empuje sigue tu nivel.
      { id: 'r9-p2', clase: 'cadena', patron: 'empuje', series: 3, seccion: 'principal' },
      // 4. El segundo de empuje vuelve fijo, con su objetivo (no se cumplió: se repite).
      { id: 'r9-p3', clase: 'fijo', ejercicioId: 'flexion-diamante', series: 3, cantidad: 6, seccion: 'principal' },
      // 2. La bajada vuelve como volumen de su cadena.
      { id: 'r9-p4', clase: 'volumen', patron: 'empuje', series: 2, seccion: 'principal' },
      // 3. Lo fijo vuelve fijo, con la doble progresión: 3 × 8 cumplido es 3 × 9.
      { id: 'r9-p5', clase: 'fijo', ejercicioId: 'remo-australiano-alto', series: 3, cantidad: 9, seccion: 'principal' },
      // 3. Lo que no está en CADENAS vuelve fijo aunque una sesión vieja lo guardara con bajada.
      { id: 'r9-p6', clase: 'fijo', ejercicioId: 'press-militar-barra', series: 4, cantidad: 7, seccion: 'principal' },
      // 1. Sin el Reloj ni lo desconocido. Lo salteado (solo la serie de cierre) vuelve.
      { id: 'r9-p7', clase: 'cadena', patron: 'piernas', series: 3, seccion: 'principal' },
    ])
  })

  it('guarda de dónde salió, su nombre y sus fechas, y la copia la acepta', () => {
    const s = laSesion()
    const r = rutinaDesdeSesion(s, NUEVA)
    expect(r).toMatchObject({
      id: 'r9',
      nombre: 'Sesión libre 21/10',
      creadaEn: a(HOY, 21),
      actualizadaEn: a(HOY, 21),
      desde: { clase: 'sesion', sesionId: s.id },
    })
    expect(r).not.toHaveProperty('carpeta')
    expect(new Set(r.pasos.map((p) => p.id)).size).toBe(r.pasos.length)
    expect(laCopiaLasAcepta([r])).toBe(true)
  })

  it('nunca deja dos pasos que lean la misma cadena', () => {
    const r = rutinaDesdeSesion(laSesion(), NUEVA)
    const deCadenaPorPatron = r.pasos.filter((p) => p.clase === 'cadena').map((p) => p.patron)
    expect(new Set(deCadenaPorPatron).size).toBe(deCadenaPorPatron.length)
  })

  it('la serie de cierre no vuelve: un fijo vuelve con sus series y sube si las otras llegaron', () => {
    // 3 × 8 cumplido y un cierre de 3. Contada, la de cierre sería una cuarta
    // serie que no llegó a 8, y el fijo repetiría en vez de subir (§5.6 G1).
    const s = sesion(HOY, [registro('remo-australiano-alto', [3, 8], [8, 8, 8, -3], { fijo: true })], {
      origen: { clase: 'libre', nombre: 'Sesión libre' },
    })
    expect(rutinaDesdeSesion(s, NUEVA).pasos).toEqual([
      { id: 'r9-p1', clase: 'fijo', ejercicioId: 'remo-australiano-alto', series: 3, cantidad: 9, seccion: 'principal' },
    ])
  })

  it('la progresión de los fijos mira el historial: una vez posterior manda', () => {
    const s = laSesion()
    const despues = sesion(HOY, [registro('remo-australiano-alto', [3, 9], [9, 9, 9])], { finalizadaEn: a(HOY, 22) })
    const r = rutinaDesdeSesion(s, { ...NUEVA, historial: [s, despues] })
    expect(r.pasos.find((p) => p.ejercicioId === 'remo-australiano-alto')).toMatchObject({ cantidad: 10 })
  })

  it('un fijo con discos vuelve con los kilos que se levantaron, no con los propuestos', () => {
    const s = sesion(HOY, comoLoGuardaEntrenar('press-militar-barra', { series: 4, cantidad: 6, kg: 20 }, [[6, 25], [6, 25], [6, 25], [6, 25]]))
    expect(rutinaDesdeSesion(s, NUEVA).pasos).toEqual([
      { id: 'r9-p1', clase: 'fijo', ejercicioId: 'press-militar-barra', series: 4, cantidad: 7, kg: 25, seccion: 'principal' },
    ])
    // Y si después se levantó más, eso: como la cantidad, de la última vez.
    const despues = sesion(HOY, comoLoGuardaEntrenar('press-militar-barra', { series: 4, cantidad: 7, kg: 25 }, [[7, 27.5], [7, 27.5], [7, 27.5], [7, 27.5]]), {
      finalizadaEn: a(HOY, 22),
    })
    expect(rutinaDesdeSesion(s, { ...NUEVA, historial: [s, despues] }).pasos[0]).toMatchObject({ cantidad: 8, kg: 27.5 })
  })

  it('el nombre llega limpio: sin espacios en las puntas, hasta 40 y nunca vacío', () => {
    expect(rutinaDesdeSesion(laSesion(), { ...NUEVA, nombre: '  Mix de pecho  ' }).nombre).toBe('Mix de pecho')
    expect(rutinaDesdeSesion(laSesion(), { ...NUEVA, nombre: 'a'.repeat(50) }).nombre).toHaveLength(LARGO_DEL_NOMBRE)
    expect(rutinaDesdeSesion(laSesion(), { ...NUEVA, nombre: '   ' }).nombre).toBe(RUTINA_NUEVA)
  })

  it('no pasa del tope de 30 pasos', () => {
    const larga = sesion(
      HOY,
      Array.from({ length: 35 }, () => registro('remo-australiano-alto', [3, 8], [8, 8, 8], { fijo: true })),
    )
    const r = rutinaDesdeSesion(larga, NUEVA)
    expect(r.pasos).toHaveLength(TOPE_DE_PASOS)
    expect(laCopiaLasAcepta([r])).toBe(true)
  })

  it('una sesión sin nada que vuelva da una rutina sin pasos, que la copia acepta', () => {
    const r = rutinaDesdeSesion(sesion(HOY, [registro('plancha', [4, 20], [20], { reloj: true })]), NUEVA)
    expect(r.pasos).toEqual([])
    expect(laCopiaLasAcepta([r])).toBe(true)
  })

  it('con la misma sesión da lo mismo, y no toca la sesión', () => {
    const s = congelada(laSesion())
    expect(rutinaDesdeSesion(s, NUEVA)).toEqual(rutinaDesdeSesion(s, NUEVA))
  })
})

describe('rutinaDesdeMix', () => {
  /** El mix de pecho como lo dejaría `resolverMix`, con un bloque cambiado. */
  const PASOS_DEL_MIX: PasoDelBorrador[] = [
    { id: 'e1', ejercicioId: 'munecas-cuatro-patas', objetivo: { series: 2, cantidad: 10 }, clase: 'movilidad', seccion: 'entrada' },
    {
      id: 'e2',
      ejercicioId: 'flexion-rodillas',
      objetivo: { series: 1, cantidad: 8 },
      clase: 'fijo',
      fijo: true,
      calentamiento: true,
      seccion: 'entrada',
    },
    { id: 'b1', ejercicioId: 'flexion-completa', objetivo: { series: 3, cantidad: 7 }, clase: 'cadena', seccion: 'principal' },
    {
      id: 'b2',
      ejercicioId: 'flexion-diamante',
      objetivo: { series: 3, cantidad: 6 },
      clase: 'fijo',
      fijo: true,
      seccion: 'principal',
      descansoSegundos: 90,
    },
    {
      id: 'b3',
      ejercicioId: 'flexion-rodillas',
      objetivo: { series: 2, cantidad: 15 },
      bajada: true,
      clase: 'volumen',
      seccion: 'principal',
    },
    {
      id: 'b4',
      ejercicioId: 'press-militar-barra',
      objetivo: { series: 2, cantidad: 6, kg: 20 },
      clase: 'fijo',
      fijo: true,
      seccion: 'principal',
    },
    { id: 'b5', ejercicioId: 'flexion-con-aplauso-triple', objetivo: { series: 3, cantidad: 8 }, clase: 'fijo', fijo: true },
  ]
  const NUEVA = { id: 'r7', ahora: a(HOY, 18), nombres: [] as string[] }

  it('los bloques de cadena quedan siguiendo tu nivel y el resto, fijos, con sus números', () => {
    const r = rutinaDesdeMix('pecho', { pasos: PASOS_DEL_MIX }, NUEVA)
    expect(r.pasos).toEqual([
      { id: 'r7-p1', clase: 'movilidad', ejercicioId: 'munecas-cuatro-patas', series: 2, cantidad: 10, seccion: 'entrada' },
      { id: 'r7-p2', clase: 'fijo', ejercicioId: 'flexion-rodillas', series: 1, cantidad: 8, seccion: 'entrada' },
      { id: 'r7-p3', clase: 'cadena', patron: 'empuje', series: 3, seccion: 'principal' },
      {
        id: 'r7-p4',
        clase: 'fijo',
        ejercicioId: 'flexion-diamante',
        series: 3,
        cantidad: 6,
        seccion: 'principal',
        descansoSegundos: 90,
      },
      { id: 'r7-p5', clase: 'fijo', ejercicioId: 'flexion-rodillas', series: 2, cantidad: 15, seccion: 'principal' },
      { id: 'r7-p6', clase: 'fijo', ejercicioId: 'press-militar-barra', series: 2, cantidad: 6, kg: 20, seccion: 'principal' },
    ])
  })

  it('recuerda el mix, se llama como el mix sin pisar otro nombre y la copia la acepta', () => {
    const r = rutinaDesdeMix('pecho', { pasos: PASOS_DEL_MIX }, NUEVA)
    expect(r).toMatchObject({
      id: 'r7',
      nombre: 'Mix de pecho',
      desde: { clase: 'mix', sector: 'pecho' },
      creadaEn: a(HOY, 18),
      actualizadaEn: a(HOY, 18),
    })
    expect(rutinaDesdeMix('pecho', { pasos: PASOS_DEL_MIX }, { ...NUEVA, nombres: ['Mix de pecho'] }).nombre).toBe(
      'Mix de pecho 2',
    )
    expect(rutinaDesdeMix('gluteos', { pasos: [] }, NUEVA).nombre).toBe('Mix de glúteos')
    expect(rutinaDesdeMix('cuerpo', { pasos: [] }, NUEVA).nombre).toBe('Mix de cuerpo completo')
    expect(laCopiaLasAcepta([r])).toBe(true)
  })

  it('la serie fácil de la entrada vuelve a correr como entrada en calor', () => {
    const r = rutinaDesdeMix('pecho', { pasos: PASOS_DEL_MIX }, NUEVA)
    const plan = planDeRutina(r, { avances: AVANCES, historial: [] })
    expect(plan.find((p) => p.id === 'r7-p2')).toMatchObject({ calentamiento: true, ejercicioId: 'flexion-rodillas' })
    expect(plan.filter((p) => p.clase === 'cadena').map((p) => p.ejercicioId)).toEqual(['flexion-completa'])
  })

  it('copia directo lo que arma resolverMix, en cada sector y versión', () => {
    // Sin adaptar nada: el resultado de `resolverMix` entra tal cual, y cada
    // paso sale con la clase que el mix le dio.
    const patronDe = (id: string) => CADENAS.find((c) => c.ejercicios.includes(id))?.patron
    for (const sector of SECTORES) {
      for (const version of VERSIONES) {
        const mix = resolverMix(sector, version, { avances: AVANCES, equipo: EQUIPO, historial: [], hoy: HOY })
        const r = rutinaDesdeMix(sector, mix, NUEVA)
        const cual = `${sector} · ${version}`
        expect(mix.pasos.length, cual).toBeGreaterThan(0)
        expect(r.pasos, cual).toHaveLength(mix.pasos.length)
        mix.pasos.forEach((paso, i) => {
          const copiado = r.pasos[i]
          if (paso.clase === 'cadena') {
            expect(copiado, cual).toMatchObject({ clase: 'cadena', patron: patronDe(paso.ejercicioId), seccion: 'principal' })
          } else if (paso.clase === 'movilidad') {
            expect(copiado, cual).toMatchObject({ clase: 'movilidad', ejercicioId: paso.ejercicioId, seccion: 'entrada' })
          } else {
            expect(copiado, cual).toMatchObject({
              clase: 'fijo',
              ejercicioId: paso.ejercicioId,
              series: paso.objetivo.series,
              cantidad: paso.objetivo.cantidad,
              seccion: paso.seccion,
            })
          }
        })
        expect(laCopiaLasAcepta([r]), cual).toBe(true)
      }
    }
  })

  it('entiende un paso de un borrador viejo, sin clase', () => {
    const viejos: PasoDelBorrador[] = [
      { ejercicioId: 'flexion-completa', objetivo: { series: 3, cantidad: 7 } },
      { ejercicioId: 'flexion-rodillas', objetivo: { series: 2, cantidad: 15 }, bajada: true },
    ]
    expect(rutinaDesdeMix('pecho', { pasos: viejos }, NUEVA).pasos.map((p) => p.clase)).toEqual(['cadena', 'fijo'])
  })
})

describe('aplicarCambios', () => {
  function laRutina(): RutinaPropia {
    return rutina(
      [
        movil('m', 'gato-vaca'),
        deCadena('c', 'empuje'),
        fijo('f', 'flexion-diamante', { series: 4, cantidad: 7, descansoSegundos: 120, editadoEn: 5 }),
        fijo('g', 'remo-australiano-alto'),
        fijo('z', 'plancha', { seccion: 'final', cantidad: 20 }),
      ],
      { dejarFijo: ['f', 'g'] },
    )
  }
  const ids = (r: RutinaPropia) => r.pasos.map((p) => p.id)
  const cambio = (pasoId: string, de: string, a: string): CambioEnSesion => ({ clase: 'cambio', pasoId, de, a })

  it('sin cambios, o solo salteados, devuelve la misma rutina', () => {
    const r = laRutina()
    expect(aplicarCambios(r, [])).toBe(r)
    expect(aplicarCambios(r, [{ clase: 'salteado', pasoId: 'f' }, { clase: 'salteado', pasoId: 'c' }])).toBe(r)
  })

  it('un salteado después de un cambio o de un agregado no los deshace', () => {
    const elCambio = cambio('f', 'flexion-diamante', 'flexion-declinada')
    const elAgregado: CambioEnSesion = { clase: 'agregado', pasoId: 's1', ejercicioId: 'plancha-rodillas' }
    const esperada = aplicarCambios(laRutina(), [elCambio, elAgregado])
    expect(ids(esperada)).toContain('s1')
    const conSalteados = aplicarCambios(laRutina(), [
      elCambio,
      { clase: 'salteado', pasoId: 'f' },
      elAgregado,
      { clase: 'salteado', pasoId: 's1' },
    ])
    expect(conSalteados).toEqual(esperada)
  })

  it('un cambio deja el ejercicio nuevo en el mismo lugar, con las series de la persona y su editadoEn', () => {
    const r = aplicarCambios(laRutina(), [cambio('f', 'flexion-diamante', 'flexion-declinada')])
    expect(ids(r)).toEqual(['m', 'c', 'f', 'g', 'z'])
    expect(r.pasos[2]).toEqual({
      id: 'f',
      clase: 'fijo',
      ejercicioId: 'flexion-declinada',
      series: 4,
      cantidad: 5,
      seccion: 'principal',
      editadoEn: 5,
    })
    // "Dejarlo fijo" era para el de antes.
    expect(r.dejarFijo).toEqual(['g'])
  })

  it('un paso de cadena cambiado por otro ejercicio pasa a fijo', () => {
    const r = aplicarCambios(laRutina(), [cambio('c', 'flexion-completa', 'flexion-diamante')])
    expect(r.pasos[1]).toEqual({
      id: 'c',
      clase: 'fijo',
      ejercicioId: 'flexion-diamante',
      series: 3,
      cantidad: 5,
      seccion: 'principal',
    })
  })

  it('cambiarlo y volver al de antes no es un cambio; dos cambios valen por el último', () => {
    const r = laRutina()
    expect(
      aplicarCambios(r, [
        cambio('f', 'flexion-diamante', 'flexion-declinada'),
        cambio('f', 'flexion-declinada', 'flexion-diamante'),
      ]),
    ).toBe(r)
    const dos = aplicarCambios(r, [
      cambio('f', 'flexion-diamante', 'flexion-declinada'),
      cambio('f', 'flexion-declinada', 'flexion-rodillas'),
    ])
    expect(dos.pasos[2]).toMatchObject({ ejercicioId: 'flexion-rodillas', cantidad: 8 })
  })

  it('un agregado entra al final de su sección, con el id que tuvo en la sesión', () => {
    const r = aplicarCambios(laRutina(), [
      { clase: 'agregado', pasoId: 's1', ejercicioId: 'plancha-rodillas' },
      { clase: 'agregado', pasoId: 's2', ejercicioId: 'libro-abierto' },
      { clase: 'agregado', pasoId: 's3', ejercicioId: 'pectoral-marco' },
    ])
    expect(ids(r)).toEqual(['m', 's2', 'c', 'f', 'g', 's1', 'z', 's3'])
    expect(r.pasos[5]).toEqual({
      id: 's1',
      clase: 'fijo',
      ejercicioId: 'plancha-rodillas',
      series: 3,
      cantidad: 15,
      seccion: 'principal',
    })
  })

  it('un agregado que después se cambió entra con el último, y un id usado toma otro', () => {
    const r = aplicarCambios(laRutina(), [
      { clase: 'agregado', pasoId: 'g', ejercicioId: 'plancha-rodillas' },
      cambio('g', 'plancha-rodillas', 'plancha'),
    ])
    expect(ids(r)).toEqual(['m', 'c', 'f', 'g', 'g-2', 'z'])
    expect(r.pasos[4]).toMatchObject({ ejercicioId: 'plancha', clase: 'fijo' })
    // El paso de la rutina que tenía ese id no se toca.
    expect(r.pasos[3]).toEqual(laRutina().pasos[3])
  })

  it('pasar al final lo deja último en su sección', () => {
    expect(ids(aplicarCambios(laRutina(), [{ clase: 'al-final', pasoId: 'c' }]))).toEqual(['m', 'f', 'g', 'c', 'z'])
    const conEntrada = rutina([movil('m', 'gato-vaca'), movil('n', 'libro-abierto'), deCadena('c', 'empuje')])
    expect(ids(aplicarCambios(conEntrada, [{ clase: 'al-final', pasoId: 'm' }]))).toEqual(['n', 'm', 'c'])
    const r = laRutina()
    expect(aplicarCambios(r, [{ clase: 'al-final', pasoId: 'g' }])).toBe(r)
  })

  it('lo que no se puede aplicar no se aplica: un ejercicio que no existe o un paso que no está', () => {
    const r = laRutina()
    expect(aplicarCambios(r, [cambio('f', 'flexion-diamante', 'flexion-con-aplauso-triple')])).toBe(r)
    expect(aplicarCambios(r, [cambio('nadie', 'flexion-diamante', 'flexion-declinada')])).toBe(r)
    expect(aplicarCambios(r, [{ clase: 'agregado', pasoId: 's1', ejercicioId: 'no-existe' }])).toBe(r)
  })

  it('no pasa del tope de 30 pasos', () => {
    const llena = rutina(Array.from({ length: TOPE_DE_PASOS }, (_, i) => fijo(`p${i}`, 'remo-australiano-alto')))
    expect(aplicarCambios(llena, [{ clase: 'agregado', pasoId: 's1', ejercicioId: 'plancha' }])).toBe(llena)
  })

  it('pasar al final el que ya era el último de su sección no cambia nada, y el Cierre no lo nombra', () => {
    const r = laRutina()
    const plan = planDeRutina(r, { avances: AVANCES, historial: [] })
    // g es el último de Principal; m, la única de Entrada; z, la única de Final.
    for (const pasoId of ['g', 'm', 'z']) {
      const cambios: CambioEnSesion[] = [{ clase: 'al-final', pasoId }]
      expect(cambiosQueSeAplican(r, cambios), pasoId).toEqual([])
      expect(lineaDeCambios(cambiosQueSeAplican(r, cambios), plan), pasoId).toBeNull()
      expect(aplicarCambios(r, cambios), pasoId).toBe(r)
    }
    // Con otra cosa que sí cambia, la línea nombra solo esa.
    const conOtra: CambioEnSesion[] = [{ clase: 'al-final', pasoId: 'g' }, cambio('f', 'flexion-diamante', 'flexion-declinada')]
    expect(lineaDeCambios(cambiosQueSeAplican(r, conOtra), plan)).toBe(
      'Cambiaste 1 cosa: Flexiones declinadas en vez de Flexiones diamante.',
    )
  })

  it('con la rutina en 30 pasos no dice "sumaste": el agregado no entra', () => {
    const llena = rutina(Array.from({ length: TOPE_DE_PASOS }, (_, i) => fijo(`p${i}`, 'remo-australiano-alto')))
    const sumado: CambioEnSesion[] = [{ clase: 'agregado', pasoId: 's1', ejercicioId: 'plancha' }]
    expect(cambiosQueSeAplican(llena, sumado)).toEqual([])
    expect(lineaDeCambios(cambiosQueSeAplican(llena, sumado))).toBeNull()
    // Con lugar para uno, dice uno: el primero, que es el que entra.
    const casiLlena = rutina(llena.pasos.slice(1))
    const dos: CambioEnSesion[] = [...sumado, { clase: 'agregado', pasoId: 's2', ejercicioId: 'zancada' }]
    expect(lineaDeCambios(cambiosQueSeAplican(casiLlena, dos))).toBe('Cambiaste 1 cosa: sumaste Plancha.')
    expect(ids(aplicarCambios(casiLlena, dos)).slice(-1)).toEqual(['s1'])
  })

  it('los que se pasaron al final quedan en el orden en que se pasaron por última vez, como en la sesión', () => {
    // En la sesión: c al final (f, g, c), después f (g, c, f) y c otra vez (g, f, c).
    const cambios: CambioEnSesion[] = [
      { clase: 'al-final', pasoId: 'c' },
      { clase: 'al-final', pasoId: 'f' },
      { clase: 'al-final', pasoId: 'c' },
    ]
    expect(ids(aplicarCambios(laRutina(), cambios))).toEqual(['m', 'g', 'f', 'c', 'z'])
  })

  it('lo que deja la sección como estaba no cuenta ni se nombra', () => {
    const r = laRutina()
    const plan = planDeRutina(r, { avances: AVANCES, historial: [] })
    // f y después g al final: c, g, f, y otra vez c, f, g.
    const idaYVuelta: CambioEnSesion[] = [{ clase: 'al-final', pasoId: 'f' }, { clase: 'al-final', pasoId: 'g' }]
    expect(cambiosQueSeAplican(r, idaYVuelta)).toEqual([])
    expect(lineaDeCambios(cambiosQueSeAplican(r, idaYVuelta), plan)).toBeNull()
    expect(aplicarCambios(r, idaYVuelta)).toBe(r)

    // c, d y a al final dejan b, c, d, a: lo mismo que pasar solo a.
    const cuatro = rutina([
      fijo('a', 'flexion-diamante'),
      fijo('b', 'remo-australiano-alto'),
      fijo('c', 'sentadilla-completa'),
      fijo('d', 'plancha'),
    ])
    const tres: CambioEnSesion[] = [
      { clase: 'al-final', pasoId: 'c' },
      { clase: 'al-final', pasoId: 'd' },
      { clase: 'al-final', pasoId: 'a' },
    ]
    expect(cambiosQueSeAplican(cuatro, tres)).toEqual([{ clase: 'al-final', pasoId: 'a' }])
    expect(lineaDeCambios(cambiosQueSeAplican(cuatro, tres), planDeRutina(cuatro, { avances: AVANCES, historial: [] }))).toBe(
      'Cambiaste 1 cosa: pasaste Flexiones diamante al final.',
    )
    expect(ids(aplicarCambios(cuatro, tres))).toEqual(['b', 'c', 'd', 'a'])
  })

  it('aplica lo que el Cierre dice: si la línea no nombra nada, la rutina queda igual', () => {
    const r = laRutina()
    const llena = rutina(Array.from({ length: TOPE_DE_PASOS }, (_, i) => fijo(`p${i}`, 'remo-australiano-alto')))
    const juegos: [RutinaPropia, CambioEnSesion[]][] = [
      [r, [{ clase: 'salteado', pasoId: 'c' }]],
      [r, [cambio('f', 'flexion-diamante', 'flexion-declinada'), cambio('f', 'flexion-declinada', 'flexion-diamante')]],
      [r, [cambio('f', 'flexion-diamante', 'flexion-declinada')]],
      [r, [{ clase: 'agregado', pasoId: 's1', ejercicioId: 'plancha-rodillas' }]],
      [r, [{ clase: 'al-final', pasoId: 'c' }]],
      // Lo que el Cierre nombraba sin que se aplicara.
      [r, [{ clase: 'al-final', pasoId: 'g' }]],
      [r, [{ clase: 'al-final', pasoId: 'm' }]],
      [r, [{ clase: 'al-final', pasoId: 'z' }]],
      [r, [{ clase: 'al-final', pasoId: 'f' }, { clase: 'al-final', pasoId: 'g' }]],
      [r, [cambio('f', 'flexion-diamante', 'flexion-con-aplauso-triple')]],
      [r, [{ clase: 'agregado', pasoId: 's1', ejercicioId: 'no-existe' }]],
      [llena, [{ clase: 'agregado', pasoId: 's1', ejercicioId: 'plancha' }]],
      // Y mezclas.
      [r, [{ clase: 'al-final', pasoId: 'g' }, cambio('f', 'flexion-diamante', 'flexion-declinada')]],
      [r, [cambio('g', 'remo-australiano-alto', 'remo-australiano-medio'), { clase: 'al-final', pasoId: 'g' }, { clase: 'al-final', pasoId: 'c' }]],
    ]
    for (const [laDelJuego, cambios] of juegos) {
      const cual = JSON.stringify(cambios)
      const aplicables = cambiosQueSeAplican(laDelJuego, cambios)
      const dice = lineaDeCambios(aplicables, planDeRutina(laDelJuego, { avances: AVANCES, historial: [] }))
      const aplicada = aplicarCambios(laDelJuego, cambios)
      expect(aplicada !== laDelJuego, cual).toBe(dice !== null)
      // Aplicar solo lo que la línea nombra da la misma rutina que aplicar todo.
      expect(aplicarCambios(laDelJuego, aplicables), cual).toEqual(aplicada)
    }
  })

  it('no toca la rutina que recibe, y lo que devuelve lo acepta la copia', () => {
    const r = congelada(laRutina())
    const actualizada = aplicarCambios(r, [
      cambio('c', 'flexion-completa', 'flexion-diamante'),
      { clase: 'agregado', pasoId: 'g', ejercicioId: 'plancha-rodillas' },
      { clase: 'al-final', pasoId: 'm' },
    ])
    expect(laCopiaLasAcepta([actualizada])).toBe(true)
  })
})

describe('nombreLibre', () => {
  it('"Rutina nueva", y si ya hay una, "Rutina nueva 2", "Rutina nueva 3"…', () => {
    expect(nombreLibre([])).toBe('Rutina nueva')
    expect(nombreLibre([], RUTINA_NUEVA)).toBe('Rutina nueva')
    expect(nombreLibre(['Rutina nueva'])).toBe('Rutina nueva 2')
    expect(nombreLibre(['Rutina nueva', 'Rutina nueva 2'])).toBe('Rutina nueva 3')
  })

  it('toma el primer número libre, y la base si está libre', () => {
    expect(nombreLibre(['Rutina nueva', 'Rutina nueva 3'])).toBe('Rutina nueva 2')
    expect(nombreLibre(['Rutina nueva 2'])).toBe('Rutina nueva')
  })

  it('compara como se lee: sin mayúsculas, sin tildes y sin espacios en las puntas', () => {
    expect(nombreLibre(['  rutina NUEVA '])).toBe('Rutina nueva 2')
    expect(nombreLibre(['Gluteos'], 'Glúteos')).toBe('Glúteos 2')
  })

  it('duplicar "Pecho en casa 2" da "Pecho en casa 3", no "Pecho en casa 2 2"', () => {
    const nombres = ['Pecho en casa', 'Pecho en casa 2']
    expect(nombreLibre(['Pecho en casa'], 'Pecho en casa')).toBe('Pecho en casa 2')
    expect(nombreLibre(nombres, 'Pecho en casa 2')).toBe('Pecho en casa 3')
    expect(nombreLibre([...nombres, 'Pecho en casa 3'], 'Pecho en casa 2')).toBe('Pecho en casa 4')
    expect(nombreLibre(['Día 1'], 'Día 1')).toBe('Día 1 2')
  })

  it('un número que es parte del nombre no se sigue: "Semana 10" da "Semana 10 2", no "Semana 11"', () => {
    expect(nombreLibre(['Semana 10'], 'Semana 10')).toBe('Semana 10 2')
    expect(nombreLibre(['Verano 2026'], 'Verano 2026')).toBe('Verano 2026 2')
    expect(nombreLibre(['Semana 10', 'Semana 10 2'], 'Semana 10')).toBe('Semana 10 3')
    // La copia de una copia cuyo original ya no está: no hay de dónde saber que el 2 era de copia.
    expect(nombreLibre(['Pecho en casa 2'], 'Pecho en casa 2')).toBe('Pecho en casa 2 2')
    // Se compara como se lee también para saber si el original está.
    expect(nombreLibre(['pecho en CASA', 'Pecho en casa 2'], 'Pecho en casa 2')).toBe('Pecho en casa 3')
  })

  it('si el número no entra en 40, se corta la base y no el número, sin dejar media palabra', () => {
    const conAnio = 'Rutina de piernas y glúteos, verano 2026'
    expect(conAnio).toHaveLength(LARGO_DEL_NOMBRE)
    // Cortado justo a 38 quedaría "verano 20 2": un año que no es.
    expect(nombreLibre([conAnio], conAnio)).toBe('Rutina de piernas y glúteos, verano 2')
    expect(nombreLibre([conAnio, 'Rutina de piernas y glúteos, verano 2'], conAnio)).toBe(
      'Rutina de piernas y glúteos, verano 3',
    )
    // Una sola palabra larga se corta igual: algo tiene que quedar.
    const unaPalabra = 'a'.repeat(LARGO_DEL_NOMBRE)
    expect(nombreLibre([unaPalabra], unaPalabra)).toBe(`${'a'.repeat(LARGO_DEL_NOMBRE - 2)} 2`)
  })

  it('nunca pasa de 40 ni queda vacío', () => {
    const larga = 'Una rutina con un nombre larguísimo de verdad'
    const primera = nombreLibre([], larga)
    expect(primera.length).toBeLessThanOrEqual(LARGO_DEL_NOMBRE)
    const segunda = nombreLibre([primera], larga)
    expect(segunda.length).toBeLessThanOrEqual(LARGO_DEL_NOMBRE)
    expect(segunda.endsWith(' 2')).toBe(true)
    expect(nombreLibre([], '   ')).toBe('Rutina nueva')
    expect(nombreLibre([], '  Pecho  ')).toBe('Pecho')
  })
})
