import { describe, expect, it } from 'vitest'
import { minutosDeSesion, sinEjerciciosRepetidos } from './bajada'
import { CADENAS, EJERCICIOS, POR_ID } from './biblioteca'
import type { RequisitoDeHistorial } from './catalogo'
import { EQUIPOS, equipoDe } from './equipo'
import {
  IDS_DE_LOS_MIXES,
  MIXES,
  MIX_POR_SECTOR,
  REGLAS_DE_LOS_MIXES,
  VERSIONES,
  mixesConTrabajo,
  resolverMix,
  tieneTrabajo,
  type ContextoDelMix,
  type MixResuelto,
  type VersionDeMix,
} from './mixes'
import { MOVILIDAD_POR_ID } from './movilidad'
import { APORTE, loQueFaltaSinPlan } from './musculos'
import { loProhibido } from './palabras'
import { RUTINAS } from './rutinas'
import { objetivoDelFijo } from './rutinasPropias'
import { SECTORES, mixArmable, seriesDeZona, type Zona } from './sectores'
import type {
  Avance,
  DecisionGuardada,
  Ejercicio,
  Equipo,
  Objetivo,
  Patron,
  RegistroEjercicio,
  Sector,
  Sesion,
} from './tipos'

/**
 * Un mix es lo que la persona ve en el Sector y lo que empieza con un toque:
 * si dice una cosa y arma otra, o si propone algo que no se puede hacer, la
 * confianza se va con la primera sesión. Lo que más importa probar es lo que
 * se rompe sin que nadie lo note: que deje de ser determinista, que proponga
 * algo más difícil que tu eslabón, que una cadena se lea dos veces, que una
 * nota diga algo que no es verdad, o que un bloque de la ola 2 invente un
 * ejercicio que todavía no existe.
 *
 * Con la biblioteca de hoy (los 53) donde alcanza, y con fichas de prueba de
 * la ola 1 donde hace falta mostrar cómo elige entre varias.
 */

const HOY = '2026-10-22'
const AYER = '2026-10-21'
const ANTEAYER = '2026-10-20'

/** Un instante de ese día, en la hora local de quien corre el test. */
const a = (fecha: string, h: number, m = 0) =>
  new Date(`${fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime()

type Niveles = Partial<Record<Patron, number>>
type Avances = Map<Patron, Pick<Avance, 'ejercicioId' | 'objetivoActual'>>

/** El mismo eslabón en las cinco cadenas (o el último, si la cadena es más corta). */
const parejo = (n: number): Niveles => ({ empuje: n, traccion: n, piernas: n, core: n, bisagra: n })

/** Avances en esos eslabones, con el objetivo en lo bajo de la ventana. Lo que falta, en el 1. */
function avancesEn(niveles: Niveles): Avances {
  const avances: Avances = new Map()
  for (const cadena of CADENAS) {
    const n = Math.min(niveles[cadena.patron] ?? 1, cadena.ejercicios.length)
    const id = cadena.ejercicios[n - 1]!
    avances.set(cadena.patron, {
      ejercicioId: id,
      objetivoActual: { series: 3, cantidad: POR_ID.get(id)!.ventana.min },
    })
  }
  return avances
}

const CASA: readonly Equipo[] = equipoDe({ tieneBarra: false })
const CON_BARRA: readonly Equipo[] = [...CASA, 'barra']
const CON_BANDA: readonly Equipo[] = [...CASA, 'banda']
const TODO: readonly Equipo[] = EQUIPOS

const PERFILES: readonly [string, readonly Equipo[]][] = [
  ['casa', CASA],
  ['casa y barra', CON_BARRA],
  ['casa y banda', CON_BANDA],
  ['todo', TODO],
]

/** Bajo, medio y alto, con cadenas en eslabones distintos entre sí. */
const NIVELES: readonly [string, Niveles][] = [
  ['eslabón 2', parejo(2)],
  ['medio', { empuje: 6, traccion: 5, piernas: 4, core: 5, bisagra: 5 }],
  ['alto', { empuje: 11, traccion: 10, piernas: 9, core: 9, bisagra: 8 }],
]

function contexto(extra: Partial<ContextoDelMix> = {}): ContextoDelMix {
  return { avances: avancesEn(parejo(5)), equipo: CASA, historial: [], hoy: HOY, ...extra }
}

/** Los pasos de trabajo: lo que no es entrada. */
const trabajo = (r: MixResuelto) => r.pasos.filter((p) => p.seccion === 'principal')
const bloque = (r: MixResuelto, id: string) => r.bloques.find((b) => b.id === id)

/** Cada combinación de la matriz, con su nombre para el mensaje de error. */
function* matriz(catalogo?: readonly Ejercicio[]) {
  for (const sector of SECTORES) {
    for (const [perfil, equipo] of PERFILES) {
      for (const [nivel, niveles] of NIVELES) {
        for (const version of VERSIONES) {
          const ctx = contexto({ avances: avancesEn(niveles), equipo, ...(catalogo ? { catalogo } : {}) })
          yield {
            nombre: `${sector} · ${perfil} · ${nivel} · ${version}`,
            sector,
            version,
            ctx,
            niveles,
            r: resolverMix(sector, version, ctx),
          }
        }
      }
    }
  }
}

type Registro = [ejercicioId: string, objetivo: Objetivo, logrado: number[], extra?: Partial<RegistroEjercicio>]

let siguiente = 0
function sesion(fecha: string, hora: number, registros: Registro[], extra: Partial<Sesion> = {}): Sesion {
  siguiente++
  return {
    id: `s${siguiente}`,
    fecha,
    finalizadaEn: a(fecha, hora),
    duracionSegundos: 1800,
    tipo: 'plan',
    registros: registros.map(([ejercicioId, objetivo, logrado, mas]) => ({
      ejercicioId,
      objetivo,
      series: logrado.map((l) => ({ logrado: l })),
      ...mas,
    })),
    ...extra,
  }
}

// ─── Fichas de prueba de la ola 1 ───────────────────────────────────────

/** "flexion-pausa" → "Flexion pausa": un nombre legible para las notas. */
const nombreDe = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ')

function ficha(id: string, mas: Partial<Ejercicio> = {}): Ejercicio {
  return {
    id,
    nombre: nombreDe(id),
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 1,
    resumen: 'Una ficha de prueba para los mixes.',
    tecnica: ['Uno.', 'Dos.', 'Tres.'],
    erroresComunes: ['Uno.', 'Dos.'],
    ventana: { min: 6, max: 12 },
    series: 3,
    ccr: 0.5,
    descansoSegundos: 60,
    equipo: ['nada'],
    ...mas,
  }
}

const SEGUNDOS: Partial<Ejercicio> = { medida: 'segundos', ventana: { min: 15, max: 30 } }

/** Una variante: el nivel y el `equivale` de lo más bajo de su rango (§5.2). */
const variante = (id: string, patron: Patron, nivel: number, equipo: Equipo[] = ['nada'], mas: Partial<Ejercicio> = {}) =>
  ficha(id, { patron, nivel, equivale: { patron, nivel }, equipo, ...mas })

/** Un accesorio: nivel 1, su `grado` y su patrón. */
const accesorio = (id: string, patron: Patron, grado: 1 | 2 | 3, equipo: Equipo[] = ['nada'], mas: Partial<Ejercicio> = {}) =>
  ficha(id, { patron, nivel: 1, accesorio: true, grado, equipo, ...mas })

/**
 * Los 44 de la ola 1 (§6.1), con el patrón, el `equivale` o el `grado` y el
 * equipo de `catalogo.md` §2. Son de prueba: la ola 1 los escribe de verdad
 * en C1, y estos sirven para mostrar cómo elige el mix entre varios.
 */
const OLA_1: readonly Ejercicio[] = [
  variante('flexion-pausa', 'empuje', 6),
  variante('flexion-deficit', 'empuje', 7, ['objetos']),
  variante('flexion-anillas', 'empuje', 7, ['anillas']),
  variante('remo-marco-puerta', 'traccion', 1, ['marco']),
  variante('remo-australiano-supino', 'traccion', 2, ['barra-baja']),
  accesorio('remo-banda', 'traccion', 1, ['banda']),
  variante('dominada-supina', 'traccion', 8, ['barra']),
  accesorio('dominada-escapular', 'traccion', 1, ['barra']),
  accesorio('colgado-activo', 'traccion', 1, ['barra'], SEGUNDOS),
  accesorio('caminata-granjero', 'traccion', 1, ['objetos'], SEGUNDOS),
  accesorio('flexion-escapular', 'empuje', 1),
  variante('flexion-pica-inclinada', 'empuje', 4, ['silla']),
  variante('flexion-pica', 'empuje', 6),
  variante('flexion-pica-elevada', 'empuje', 8, ['silla']),
  variante('vertical-pared', 'empuje', 8, ['pared'], SEGUNDOS),
  accesorio('elevacion-lateral-banda', 'empuje', 1, ['banda']),
  accesorio('empuje-lateral-pared', 'empuje', 1, ['pared'], { ...SEGUNDOS, nombre: 'Empuje lateral contra la pared' }),
  accesorio('aperturas-banda', 'traccion', 1, ['banda']),
  accesorio('ytw-piso', 'traccion', 1),
  variante('curl-peso-corporal', 'traccion', 2, ['barra-baja']),
  accesorio('curl-banda', 'traccion', 1, ['banda']),
  accesorio('curl-isometrico-toalla', 'traccion', 1, ['toalla'], SEGUNDOS),
  variante('fondos-banco', 'empuje', 5, ['silla']),
  variante('fondos-banco-pies-elevados', 'empuje', 7, ['silla']),
  variante('flexion-esfinge', 'empuje', 6),
  accesorio('apoyo-paralelas', 'empuje', 1, ['paralelas'], SEGUNDOS),
  variante('fondos-negativos', 'empuje', 7, ['paralelas']),
  variante('fondos-paralelas', 'empuje', 8, ['paralelas']),
  variante('extension-triceps-mesada', 'empuje', 4, ['barra-baja']),
  variante('bicho-muerto', 'core', 2),
  variante('cuerpo-hueco', 'core', 4, ['nada'], SEGUNDOS),
  variante('plancha-lateral-rodillas', 'core', 1, ['nada'], { ...SEGUNDOS, porLado: true }),
  variante('plancha-lateral', 'core', 2, ['nada'], { ...SEGUNDOS, porLado: true }),
  variante('copenhague-corta', 'core', 3, ['silla'], { ...SEGUNDOS, porLado: true }),
  variante('perro-de-caza', 'core', 1, ['nada'], { porLado: true }),
  variante('nadador', 'bisagra', 1),
  variante('empuje-cadera-sillon', 'bisagra', 2, ['silla']),
  variante('empuje-cadera-una-pierna', 'bisagra', 4, ['silla'], { porLado: true }),
  accesorio('abduccion-de-costado', 'piernas', 1, ['nada'], { porLado: true }),
  variante('sentadilla-pared', 'piernas', 2, ['pared'], SEGUNDOS),
  variante('zancada-atras', 'piernas', 4, ['nada'], { porLado: true }),
  variante('subida-cajon', 'piernas', 4, ['silla'], { porLado: true }),
  accesorio('talones-escalon', 'piernas', 1, ['escalon']),
  accesorio('talones-una-pierna', 'piernas', 2, ['escalon'], { porLado: true }),
]

/** La biblioteca de hoy más algunas fichas de prueba. */
const con = (...ids: string[]): Ejercicio[] => [
  ...EJERCICIOS,
  ...ids.map((id) => {
    const encontrada = OLA_1.find((e) => e.id === id)
    if (!encontrada) throw new Error(`no hay ficha de prueba para ${id}`)
    return encontrada
  }),
]

/**
 * Los 68 ids nuevos de `catalogo.md` §2 (olas 1 y 2). Un mix puede nombrar un
 * ejercicio que todavía no está en la biblioteca, pero nunca uno que no esté
 * en ninguna de las dos listas: eso sería inventarlo.
 */
const DE_CATALOGO_MD: ReadonlySet<string> = new Set([
  'remo-marco-puerta', 'remo-australiano-supino', 'remo-australiano-abierto', 'remo-banda',
  'jalon-banda', 'remo-anillas', 'dominada-supina', 'dominada-escapular', 'colgado-activo',
  'caminata-granjero', 'flexion-escapular', 'flexion-pica-inclinada', 'flexion-pica',
  'flexion-pica-elevada', 'vertical-pared', 'flexion-vertical-negativa', 'flexion-vertical',
  'elevacion-lateral-banda', 'empuje-lateral-pared', 'aperturas-banda', 'tiron-cara-banda',
  'ytw-piso', 'curl-peso-corporal', 'curl-banda', 'curl-isometrico-toalla', 'fondos-banco',
  'fondos-banco-pies-elevados', 'apoyo-paralelas', 'fondos-negativos', 'fondos-paralelas',
  'extension-triceps-mesada', 'flexion-esfinge', 'flexion-pausa', 'flexion-deficit',
  'flexion-anillas', 'flexion-explosiva', 'bicho-muerto', 'cuerpo-hueco', 'crunch-inverso',
  'rueda-toalla', 'sentada-l-agrupada', 'sentada-l', 'plancha-lateral-rodillas',
  'plancha-lateral', 'plancha-lateral-abduccion', 'copenhague-corta', 'copenhague-larga',
  'pallof-banda', 'limpiaparabrisas-piso', 'perro-de-caza', 'nadador', 'buenos-dias',
  'empuje-cadera-sillon', 'empuje-cadera-una-pierna', 'abduccion-de-costado',
  'caminata-lateral-banda', 'sentadilla-pared', 'zancada-atras', 'subida-cajon',
  'sentadilla-cosaca', 'sentadilla-patinador', 'sentadilla-sissy-asistida',
  'puente-palanca-larga', 'curl-deslizando-una-pierna', 'talones-escalon',
  'talones-una-pierna', 'talones-rodilla-doblada', 'puntas-pared',
])

// ─── Los datos ──────────────────────────────────────────────────────────

describe('los datos de los mixes', () => {
  it('son ocho, uno por sector y en el orden de SECTORES, con ids congelados mix-…', () => {
    expect(MIXES.map((m) => m.sector)).toEqual([...SECTORES])
    expect(MIXES.map((m) => m.id)).toEqual([
      'mix-pecho',
      'mix-espalda',
      'mix-hombros',
      'mix-brazos',
      'mix-core',
      'mix-piernas',
      'mix-gluteos',
      'mix-cuerpo-completo',
    ])
    for (const mix of MIXES) {
      expect(mix.id).toMatch(/^mix-[a-z]+(-[a-z]+)*$/)
      expect(MIX_POR_SECTOR[mix.sector]).toBe(mix)
    }
  })

  it('tienen los bloques de §6.3, en orden, con los opcionales y las cadenas de la tabla', () => {
    const resumen = (s: Sector) =>
      MIX_POR_SECTOR[s].bloques.map(
        (b) => `${b.id}${b.clase === 'cadena' ? ' (cadena)' : ''}${b.opcional ? ' (opcional)' : ''}`,
      )
    expect(resumen('pecho')).toEqual([
      'explosivo (opcional)',
      'empuje (cadena)',
      'otra-palanca',
      'triceps',
      'cierre (opcional)',
    ])
    expect(resumen('espalda')).toEqual([
      'traccion (cadena)',
      'otro-plano',
      'hombro-atras',
      'espalda-baja',
      'agarre (opcional)',
    ])
    expect(resumen('hombros')).toEqual(['sobre-la-cabeza', 'adelante-serrato', 'costado', 'atras'])
    expect(resumen('brazos')).toEqual([
      'tiron-biceps',
      'empuje-triceps',
      'biceps',
      'triceps',
      'agarre (opcional)',
    ])
    expect(resumen('core')).toEqual([
      'core (cadena)',
      'lateral',
      'complemento',
      'rotacion',
      'espalda-baja',
    ])
    expect(resumen('piernas')).toEqual([
      'piernas (cadena)',
      'bisagra (cadena)',
      'una-pierna',
      'pantorrilla',
      'aductores (opcional)',
    ])
    expect(resumen('gluteos')).toEqual([
      'bisagra (cadena)',
      'empuje-cadera',
      'una-pierna',
      'gluteo-medio',
      'isquios (opcional)',
    ])
    expect(resumen('cuerpo')).toEqual([
      'traccion (cadena)',
      'empuje (cadena)',
      'piernas-o-bisagra (cadena)',
      'core (cadena)',
      'semana',
    ])
  })

  it('cada opción y cada ejercicio de la entrada está en la biblioteca o en catalogo.md §2: nada inventado', () => {
    const inventados: string[] = []
    for (const mix of MIXES) {
      const ids = [
        ...mix.entrada.fuerza.map((i) => i.id),
        ...(mix.entrada.unaDe ?? []).map((i) => i.id),
        ...mix.bloques.flatMap((b) => b.opciones.map((o) => o.id)),
      ]
      for (const id of ids) if (!POR_ID.has(id) && !DE_CATALOGO_MD.has(id)) inventados.push(`${mix.id}: ${id}`)
    }
    expect(inventados).toEqual([])
  })

  it('la movilidad de cada entrada existe y nunca es de las marcadas despues', () => {
    for (const mix of MIXES) {
      expect(mix.entrada.movilidad.length, mix.id).toBeGreaterThan(0)
      for (const id of mix.entrada.movilidad) {
        const ficha = MOVILIDAD_POR_ID.get(id)
        expect(ficha, `${mix.id}: ${id}`).toBeDefined()
        expect(ficha?.despues, `${mix.id}: ${id}`).toBeUndefined()
      }
    }
  })

  it('las entradas son las de §6.3: la fila 0 en cuatro, la movilidad de la zona en las otras', () => {
    expect(MIX_POR_SECTOR.pecho.entrada.movilidad).toEqual(['munecas-cuatro-patas'])
    expect(MIX_POR_SECTOR.espalda.entrada.movilidad).toEqual(['pasaje-hombros'])
    expect(MIX_POR_SECTOR.hombros.entrada.movilidad).toEqual(['munecas-cuatro-patas', 'pasaje-hombros'])
    expect(MIX_POR_SECTOR.piernas.entrada.movilidad).toEqual([
      'rodilla-pared',
      'sentadilla-profunda-sostenida',
      'zancada-rotacion',
    ])
    // Las de la regla común, sin el pectoral en el marco ni el flexor de cadera.
    expect(MIX_POR_SECTOR.brazos.entrada.movilidad).toEqual(['munecas-cuatro-patas', 'pasaje-hombros'])
    expect(MIX_POR_SECTOR.core.entrada.movilidad).toEqual(['gato-vaca', 'perro-cobra'])
    expect(MIX_POR_SECTOR.gluteos.entrada.movilidad).toEqual(['cadera-90-90', 'zancada-rotacion'])
    expect(MIX_POR_SECTOR.cuerpo.entrada.movilidad).toEqual([
      'gato-vaca',
      'zancada-rotacion',
      'pasaje-hombros',
      'perro-cobra',
    ])
    // Serie fácil: donde hay un bloque de cadena y la tabla no trae la suya.
    expect(MIXES.filter((m) => m.entrada.serieFacil).map((m) => m.sector)).toEqual([
      'pecho',
      'core',
      'gluteos',
      'cuerpo',
    ])
  })

  it('los ids de un bloque no se repiten en su mix, ni las opciones dentro de un bloque', () => {
    for (const mix of MIXES) {
      const ids = mix.bloques.map((b) => b.id)
      expect(new Set(ids).size, mix.id).toBe(ids.length)
      for (const b of mix.bloques) {
        const opciones = b.opciones.map((o) => o.id)
        expect(new Set(opciones).size, `${mix.id} · ${b.id}`).toBe(opciones.length)
      }
    }
  })

  it('IDS_DE_LOS_MIXES junta la entrada y las opciones de cada mix, sin repetir', () => {
    for (const mix of MIXES) {
      const ids = IDS_DE_LOS_MIXES[mix.sector]
      expect(new Set(ids).size).toBe(ids.length)
      for (const b of mix.bloques) for (const o of b.opciones) expect(ids).toContain(o.id)
      for (const id of mix.entrada.movilidad) expect(ids).toContain(id)
    }
    expect(IDS_DE_LOS_MIXES.brazos).toContain('flexion-diamante')
    expect(IDS_DE_LOS_MIXES.pecho).not.toContain('flexion-diamante')
  })

  it('las reglas comunes tienen fuente y evidencia, y ningún texto dice lo que no se dice', () => {
    expect(REGLAS_DE_LOS_MIXES).toHaveLength(8)
    for (const regla of REGLAS_DE_LOS_MIXES) {
      for (const texto of [regla.criterio, regla.regla, regla.fuente, regla.evidencia]) {
        expect(texto.length, texto).toBeGreaterThan(0)
        expect(texto.length, texto).toBeLessThanOrEqual(140)
        expect(texto, texto).not.toContain('!')
        expect(loProhibido(texto), texto).toBeNull()
      }
    }
  })
})

// ─── Determinismo y forma ───────────────────────────────────────────────

describe('resolverMix es determinista', () => {
  it('la misma entrada da siempre el mismo mix', () => {
    for (const { nombre, sector, version, ctx, r } of matriz()) {
      expect(resolverMix(sector, version, ctx), nombre).toEqual(r)
    }
  })

  it('no depende del orden en que llega el historial', () => {
    const historial = [
      sesion(ANTEAYER, 10, [['flexion-diamante', { series: 3, cantidad: 8 }, [8, 8, 8]]]),
      sesion(AYER, 9, [['flexion-diamante', { series: 3, cantidad: 9 }, [9, 9, 7]]]),
      sesion(AYER, 19, [['remo-australiano-bajo', { series: 3, cantidad: 8 }, [8, 8, 8]]]),
    ]
    const ctx = contexto({ avances: avancesEn(parejo(8)), historial })
    const alReves = contexto({ avances: avancesEn(parejo(8)), historial: [...historial].reverse() })
    for (const sector of SECTORES) {
      expect(resolverMix(sector, 'completa', alReves), sector).toEqual(resolverMix(sector, 'completa', ctx))
    }
  })

  it('en un empate de nivel equivalente desempata el id', () => {
    // Anillas y déficit equivalen las dos al 7 de empuje.
    const r = resolverMix(
      'pecho',
      'completa',
      contexto({ avances: avancesEn({ empuje: 7 }), equipo: TODO, catalogo: con('flexion-deficit', 'flexion-anillas') }),
    )
    expect(bloque(r, 'otra-palanca')?.pasos[0]?.ejercicioId).toBe('flexion-anillas')
    expect(bloque(r, 'otra-palanca')?.candidatas).toEqual(['flexion-anillas', 'flexion-deficit'])
  })

  it('cada paso tiene un id único, su clase y su sección; la entrada va primero', () => {
    for (const { nombre, r } of matriz()) {
      const ids = r.pasos.map((p) => p.id)
      expect(new Set(ids).size, nombre).toBe(ids.length)
      const secciones = r.pasos.map((p) => p.seccion)
      expect(secciones, nombre).toEqual([...secciones].sort((x, y) => (x === y ? 0 : x === 'entrada' ? -1 : 1)))
      expect(r.pasos, nombre).toEqual(r.bloques.flatMap((b) => b.pasos))
    }
  })

  it('un sector que no existe da un mix vacío, sin minutos que prometer', () => {
    const r = resolverMix('nada' as Sector, 'completa', contexto())
    expect(r).toEqual({ pasos: [], notas: [], minutos: 0, series: 0, mueve: [], cierre: false, bloques: [] })
  })
})

describe('ningún mix propone lo que no puede', () => {
  it('ninguno queda vacío: cada mix, perfil, nivel y versión tiene trabajo', () => {
    for (const { nombre, r } of matriz()) {
      expect(trabajo(r).length, nombre).toBeGreaterThan(0)
    }
  })

  it('cada id que propone existe: un ejercicio de la biblioteca o una ficha de movilidad', () => {
    for (const { nombre, r } of matriz()) {
      for (const paso of r.pasos) {
        const existe = paso.clase === 'movilidad' ? MOVILIDAD_POR_ID.has(paso.ejercicioId) : POR_ID.has(paso.ejercicioId)
        expect(existe, `${nombre}: ${paso.ejercicioId}`).toBe(true)
      }
    }
  })

  it('todo lo que propone, tu equipo lo alcanza', () => {
    for (const { nombre, ctx, r } of matriz()) {
      const tiene = new Set(ctx.equipo)
      for (const paso of r.pasos) {
        const pide = (POR_ID.get(paso.ejercicioId)?.equipo ?? MOVILIDAD_POR_ID.get(paso.ejercicioId)?.equipo)!
        expect(pide.every((e) => e === 'nada' || tiene.has(e)), `${nombre}: ${paso.ejercicioId}`).toBe(true)
      }
    }
  })

  it('nunca un eslabón por encima del tuyo, ni en la entrada', () => {
    for (const { nombre, ctx, r } of matriz(con(...OLA_1.map((e) => e.id)))) {
      for (const paso of r.pasos) {
        const cadena = CADENAS.find((c) => c.ejercicios.includes(paso.ejercicioId))
        if (!cadena) continue
        const tuyo = cadena.ejercicios.indexOf(ctx.avances.get(cadena.patron)!.ejercicioId)
        expect(cadena.ejercicios.indexOf(paso.ejercicioId), `${nombre}: ${paso.ejercicioId}`).toBeLessThanOrEqual(tuyo)
      }
    }
  })

  it('nunca una variante por encima de tu eslabón en un bloque de variante', () => {
    for (const { nombre, ctx, r } of matriz(con(...OLA_1.map((e) => e.id)))) {
      for (const b of r.bloques.filter((x) => x.clase === 'variante')) {
        for (const paso of b.pasos) {
          const equivale = OLA_1.find((e) => e.id === paso.ejercicioId)?.equivale
          if (!equivale) continue
          const cadena = CADENAS.find((c) => c.patron === equivale.patron)!
          const tuyo = cadena.ejercicios.indexOf(ctx.avances.get(equivale.patron)!.ejercicioId) + 1
          expect(equivale.nivel, `${nombre}: ${paso.ejercicioId}`).toBeLessThanOrEqual(tuyo)
        }
      }
    }
  })

  it('un solo paso cadena por patrón: una decisión por patrón (§5.6 B3)', () => {
    for (const { nombre, r } of matriz(con(...OLA_1.map((e) => e.id)))) {
      const patrones = r.pasos
        .filter((p) => p.clase === 'cadena')
        .map((p) => CADENAS.find((c) => c.ejercicios.includes(p.ejercicioId))!.patron)
      expect(new Set(patrones).size, nombre).toBe(patrones.length)
    }
  })

  it('no repite un ejercicio de trabajo: sinEjerciciosRepetidos no tiene nada que sacar', () => {
    for (const { nombre, r } of matriz(con(...OLA_1.map((e) => e.id)))) {
      const entradas = trabajo(r).map((p) => ({
        ejercicio: POR_ID.get(p.ejercicioId) ?? OLA_1.find((e) => e.id === p.ejercicioId)!,
        ...(p.bajada ? { bajada: true } : {}),
      }))
      expect(sinEjerciciosRepetidos(entradas).length, nombre).toBe(entradas.length)
    }
  })

  it('con la ola 1 (de prueba), cada mix tiene trabajo en casa desde el eslabón 1', () => {
    for (const sector of SECTORES) {
      const r = resolverMix(sector, 'completa', contexto({ avances: avancesEn(parejo(1)), catalogo: con(...OLA_1.map((e) => e.id)) }))
      expect(trabajo(r).length, sector).toBeGreaterThan(0)
    }
  })
})

// ─── La Decisión 44, bloque por bloque ──────────────────────────────────

/** Cómo quedó cada bloque, en una línea: lo que puso, o la nota con que se salteó. */
function porBloque(r: MixResuelto): Record<string, string> {
  return Object.fromEntries(
    r.bloques
      .filter((b) => b.id !== 'entrada')
      .map((b) => {
        const paso = b.pasos[0]
        return [b.id, paso ? `${paso.clase} ${paso.ejercicioId}` : (b.nota ?? 'nada')]
      }),
  )
}

describe('con la biblioteca de hoy, cada bloque sigue la Decisión 44', () => {
  // Empuje 6 (flexión completa), tracción 5 (dominada negativa), piernas 4
  // (zancada), core 5 (elevación de piernas) y bisagra 5 (puente a una pierna
  // elevado), con barra y sin discos. Las opciones de la ola 1 y la 2 no
  // existen todavía: un opcional se saltea y lo dice; un obligatorio baja al
  // eslabón anterior, que es la bajada de hoy; si eso ya está en el mix, no lo
  // repite y lo dice.
  const ctx = contexto({
    avances: avancesEn({ empuje: 6, traccion: 5, piernas: 4, core: 5, bisagra: 5 }),
    equipo: CON_BARRA,
  })
  const resuelto = (s: Sector) => porBloque(resolverMix(s, 'completa', ctx))

  it('Pecho: sin explosivo debajo del 7; otra palanca baja al eslabón anterior; el tríceps no lo repite', () => {
    expect(resuelto('pecho')).toEqual({
      empuje: 'cadena flexion-completa',
      'otra-palanca': 'volumen flexion-rodillas',
      triceps: 'Este mix ya tiene flexiones de rodillas: saltea el tríceps.',
      cierre: 'nada',
    })
  })

  it('Espalda: después de una dominada, el remo de la ventana; lo demás baja o se saltea', () => {
    expect(resuelto('espalda')).toEqual({
      traccion: 'cadena dominada-negativa',
      'otro-plano': 'fijo remo-australiano-bajo',
      'hombro-atras': 'volumen remo-australiano-pies-elevados',
      'espalda-baja': 'volumen bisagra-una-pierna',
      agarre: 'Las opciones para agarre todavía no están en la app: este mix lo saltea.',
    })
  })

  it('Hombros: la pica no está; la declinada y la pseudo plancha, más arriba, no entran', () => {
    expect(resuelto('hombros')).toEqual({
      'sobre-la-cabeza': 'volumen flexion-rodillas',
      'adelante-serrato':
        'Este mix ya tiene flexiones de rodillas: saltea el hombro de adelante y el serrato.',
      costado: 'Este mix ya tiene flexiones de rodillas: saltea el hombro de costado.',
      atras: 'volumen remo-australiano-pies-elevados',
    })
  })

  it('Brazos: la diamante, un eslabón arriba de tu empuje, no entra', () => {
    expect(resuelto('brazos')).toEqual({
      'tiron-biceps': 'volumen remo-australiano-pies-elevados',
      'empuje-triceps': 'volumen flexion-rodillas',
      biceps: 'Este mix ya tiene remo australiano con pies elevados: saltea el bíceps.',
      triceps: 'Este mix ya tiene flexiones de rodillas: saltea el tríceps.',
      agarre: 'Las opciones para agarre todavía no están en la app: este mix lo saltea.',
    })
  })

  it('Core: la plancha con brazo alternado, debajo de tu eslabón, es la rotación', () => {
    expect(resuelto('core')).toEqual({
      core: 'cadena elevacion-piernas-suelo',
      lateral: 'volumen elevacion-rodillas-suelo',
      complemento: 'Este mix ya tiene elevación de rodillas en el suelo: saltea el abdomen.',
      rotacion: 'fijo plancha-brazo-alternado',
      'espalda-baja': 'Este mix ya tiene elevación de rodillas en el suelo: saltea la espalda baja.',
    })
  })

  it('Piernas: las dos cadenas, la bajada de piernas y los aductores para cuando estén', () => {
    expect(resuelto('piernas')).toEqual({
      piernas: 'cadena zancada',
      bisagra: 'cadena puente-una-pierna-elevado',
      'una-pierna': 'volumen sentadilla-completa',
      pantorrilla: 'Este mix ya tiene sentadillas completas: saltea la pantorrilla.',
      aductores: 'Las opciones para aductores todavía no están en la app: este mix los saltea.',
    })
  })

  it('Glúteos: la búlgara, arriba de tu zancada, no entra', () => {
    expect(resuelto('gluteos')).toEqual({
      bisagra: 'cadena puente-una-pierna-elevado',
      'empuje-cadera': 'volumen bisagra-una-pierna',
      'una-pierna': 'volumen sentadilla-completa',
      'gluteo-medio': 'Este mix ya tiene sentadillas completas: saltea el glúteo medio.',
      isquios: 'Las opciones para isquiotibiales todavía no están en la app: este mix los saltea.',
    })
  })

  it('Cuerpo completo: las cuatro cadenas, y sin historial la semana no agrega nada', () => {
    expect(resuelto('cuerpo')).toEqual({
      traccion: 'cadena dominada-negativa',
      empuje: 'cadena flexion-completa',
      'piernas-o-bisagra': 'cadena zancada',
      core: 'cadena elevacion-piernas-suelo',
      semana: 'nada',
    })
  })

  it('con discos, lo de la barra con discos entra donde la tabla lo pone', () => {
    const r = resolverMix(
      'brazos',
      'completa',
      contexto({ avances: avancesEn({ empuje: 8, traccion: 8 }), equipo: TODO }),
    )
    expect(porBloque(r)).toMatchObject({ biceps: 'fijo curl-barra', triceps: 'fijo extension-triceps-barra' })
    const pecho = resolverMix('pecho', 'completa', contexto({ avances: avancesEn({ empuje: 8 }), equipo: TODO }))
    expect(porBloque(pecho).triceps).toBe('fijo extension-triceps-barra')
  })

  it('en el eslabón 1 no hay bajada: lo obligatorio que no está en la app se saltea y lo dice', () => {
    const r = resolverMix('hombros', 'completa', contexto({ avances: avancesEn(parejo(1)) }))
    expect(porBloque(r)).toEqual({
      'sobre-la-cabeza': 'Con tu nivel no hay opción para empuje por encima de la cabeza: este mix lo saltea.',
      'adelante-serrato': 'Con tu nivel no hay opción para hombro de adelante y serrato: este mix los saltea.',
      costado: 'Las opciones para hombro de costado todavía no están en la app: este mix lo saltea.',
      atras: 'Las opciones para hombro de atrás todavía no están en la app: este mix lo saltea.',
    })
  })

  it('lo que solo existe con discos, sin discos, se dice como equipo y sin nombrar los discos', () => {
    const r = resolverMix('brazos', 'completa', contexto({ avances: avancesEn(parejo(1)) }))
    expect(bloque(r, 'biceps')?.nota).toBe('Con tu equipo no hay opción para bíceps: este mix lo saltea.')
    expect(r.notas.join(' ')).not.toMatch(/discos/)
  })
})

describe('la Decisión 44 con opciones que existen', () => {
  it('un obligatorio sin nada en la ventana va a la más cercana por debajo, no a cualquiera', () => {
    // Piernas en el 9: la ventana es 7 a 9. Abajo están la sentadilla en la
    // pared (≈ 2) y la zancada atrás (≈ 4): va la zancada.
    const r = resolverMix(
      'piernas',
      'completa',
      contexto({ avances: avancesEn({ piernas: 9 }), catalogo: con('sentadilla-pared', 'zancada-atras') }),
    )
    expect(bloque(r, 'una-pierna')?.pasos[0]).toMatchObject({ ejercicioId: 'zancada-atras', clase: 'fijo', fijo: true })
  })

  it('nunca una más difícil: con todo arriba de tu eslabón, va el eslabón anterior', () => {
    // Empuje 4: la flexión con pausa (≈ 6) está arriba.
    const r = resolverMix(
      'pecho',
      'completa',
      contexto({ avances: avancesEn({ empuje: 4 }), catalogo: con('flexion-pausa') }),
    )
    expect(bloque(r, 'otra-palanca')?.pasos[0]).toMatchObject({
      ejercicioId: 'flexion-inclinada',
      clase: 'volumen',
      bajada: true,
      objetivo: { series: 2, cantidad: 15 },
      descansoSegundos: 45,
    })
  })

  it('un opcional sin nada en la ventana se saltea, aunque haya algo por debajo', () => {
    // Aductores con la bisagra en II: la Copenhague corta entra.
    const conCopenhague = resolverMix(
      'piernas',
      'completa',
      contexto({ avances: avancesEn({ bisagra: 4 }), catalogo: con('copenhague-corta') }),
    )
    expect(bloque(conCopenhague, 'aductores')?.pasos[0]?.ejercicioId).toBe('copenhague-corta')
    // El explosivo (≈ 7) en el 7 entra; un opcional nunca baja al eslabón anterior.
    const explosiva = variante('flexion-explosiva', 'empuje', 7)
    const en7 = resolverMix(
      'pecho',
      'completa',
      contexto({ avances: avancesEn({ empuje: 7 }), catalogo: [...EJERCICIOS, explosiva] }),
    )
    expect(bloque(en7, 'explosivo')?.pasos[0]).toMatchObject({ ejercicioId: 'flexion-explosiva', objetivo: { series: 2 } })
    const arriba = resolverMix(
      'pecho',
      'completa',
      contexto({ avances: avancesEn({ empuje: 11 }), catalogo: [...EJERCICIOS, explosiva] }),
    )
    expect(bloque(arriba, 'explosivo')?.pasos).toEqual([])
    expect(bloque(arriba, 'explosivo')?.nota).toBe('Con tu nivel no hay opción para lo explosivo: este mix lo saltea.')
  })

  it('un bloque con umbral no aparece debajo de él: el explosivo, desde empuje 7; los aductores, desde bisagra II', () => {
    const pecho = resolverMix('pecho', 'completa', contexto({ avances: avancesEn({ empuje: 6 }) }))
    expect(bloque(pecho, 'explosivo')).toBeUndefined()
    const piernas = resolverMix('piernas', 'completa', contexto({ avances: avancesEn({ bisagra: 3 }) }))
    expect(bloque(piernas, 'aductores')).toBeUndefined()
  })
})

// ─── La variante ────────────────────────────────────────────────────────

describe('la variante', () => {
  // Empuje 8: la ventana es 6 a 8. Pausa (≈ 6) y déficit (≈ 7) entran.
  const catalogo = con('flexion-pausa', 'flexion-deficit')
  const otraPalanca = (historial: Sesion[]) =>
    bloque(resolverMix('pecho', 'completa', contexto({ avances: avancesEn({ empuje: 8 }), catalogo, historial })), 'otra-palanca')!
  const enElTecho = (fecha: string, hora: number, id: string) =>
    sesion(fecha, hora, [[id, { series: 3, cantidad: 12 }, [12, 12, 12]]])
  const cerca = (fecha: string, hora: number, id: string) =>
    sesion(fecha, hora, [[id, { series: 3, cantidad: 12 }, [12, 12, 10]]])

  it('va la primera por nivel equivalente que no está superada', () => {
    expect(otraPalanca([]).pasos[0]?.ejercicioId).toBe('flexion-pausa')
    expect(otraPalanca([]).candidatas).toEqual(['flexion-pausa', 'flexion-deficit'])
  })

  it('se queda hasta llegar al techo dos veces seguidas, y ahí entra la siguiente', () => {
    expect(otraPalanca([enElTecho(AYER, 10, 'flexion-pausa')]).pasos[0]?.ejercicioId).toBe('flexion-pausa')
    expect(
      otraPalanca([cerca(ANTEAYER, 10, 'flexion-pausa'), enElTecho(AYER, 10, 'flexion-pausa')]).pasos[0]?.ejercicioId,
    ).toBe('flexion-pausa')
    expect(
      otraPalanca([enElTecho(ANTEAYER, 10, 'flexion-pausa'), enElTecho(AYER, 10, 'flexion-pausa')]).pasos[0]?.ejercicioId,
    ).toBe('flexion-deficit')
    // Seguidas quiere decir las dos últimas: una vez floja después del techo, vuelve.
    expect(
      otraPalanca([
        enElTecho('2026-10-18', 10, 'flexion-pausa'),
        enElTecho(ANTEAYER, 10, 'flexion-pausa'),
        cerca(AYER, 10, 'flexion-pausa'),
      ]).pasos[0]?.ejercicioId,
    ).toBe('flexion-pausa')
  })

  it('si todas están superadas, va la última', () => {
    const historial = [
      enElTecho(ANTEAYER, 10, 'flexion-pausa'),
      enElTecho(AYER, 10, 'flexion-pausa'),
      enElTecho(ANTEAYER, 18, 'flexion-deficit'),
      enElTecho(AYER, 18, 'flexion-deficit'),
    ]
    expect(otraPalanca(historial).pasos[0]?.ejercicioId).toBe('flexion-deficit')
  })

  it('el techo cuenta en cualquier origen, y la entrada en calor no cuenta', () => {
    const deUnaRutina = (fecha: string) =>
      sesion(fecha, 10, [['flexion-pausa', { series: 3, cantidad: 12 }, [12, 12, 12]]], {
        origen: { clase: 'rutina', rutinaId: 'r1', nombre: 'La mía' },
      })
    expect(otraPalanca([deUnaRutina(ANTEAYER), deUnaRutina(AYER)]).pasos[0]?.ejercicioId).toBe('flexion-deficit')
    const calentando = (fecha: string) =>
      sesion(fecha, 10, [['flexion-pausa', { series: 3, cantidad: 12 }, [12, 12, 12], { calentamiento: true }]])
    expect(otraPalanca([calentando(ANTEAYER), calentando(AYER)]).pasos[0]?.ejercicioId).toBe('flexion-pausa')
  })

  it('nunca va una por debajo de N − 2 si hay alguna en la ventana', () => {
    // Empuje 10: la ventana es 8 a 10. Los fondos (≈ 8) van antes que la pausa (≈ 6).
    const r = resolverMix(
      'pecho',
      'completa',
      contexto({ avances: avancesEn({ empuje: 10 }), equipo: TODO, catalogo: con('flexion-pausa', 'fondos-paralelas') }),
    )
    expect(bloque(r, 'otra-palanca')?.pasos[0]?.ejercicioId).toBe('fondos-paralelas')
    expect(bloque(r, 'otra-palanca')?.candidatas).toEqual(['fondos-paralelas'])
  })

  it('un requisito sin cumplir la deja afuera; cumplido en el historial, entra (§6.6)', () => {
    const requisitos: ReadonlyMap<string, readonly RequisitoDeHistorial[]> = new Map([
      [
        'fondos-negativos',
        [{ pide: { ejercicioId: 'apoyo-paralelas', series: 3, cantidad: 30 }, porque: 'Sostenerse antes de bajar.' }],
      ],
    ])
    const base = {
      avances: avancesEn({ empuje: 7 }),
      equipo: TODO,
      catalogo: con('fondos-negativos', 'apoyo-paralelas'),
      requisitosDeHistorial: requisitos,
    }
    const sinApoyo = resolverMix('pecho', 'completa', contexto(base))
    expect(bloque(sinApoyo, 'otra-palanca')?.pasos[0]?.ejercicioId).toBe('flexion-completa')
    const apoyo = sesion(AYER, 10, [['apoyo-paralelas', { series: 3, cantidad: 30 }, [30, 30, 30]]])
    const conApoyo = resolverMix('pecho', 'completa', contexto({ ...base, historial: [apoyo] }))
    expect(bloque(conApoyo, 'otra-palanca')?.pasos[0]?.ejercicioId).toBe('fondos-negativos')
  })

  it('una opción con condición mira el bloque al que apunta: después de un remo, nada de colgarse', () => {
    // Tracción 3 (remo bajo): las opciones de "si fue dominada" no van.
    const r = resolverMix(
      'espalda',
      'completa',
      contexto({ avances: avancesEn({ traccion: 3 }), equipo: TODO, catalogo: con('remo-australiano-supino', 'remo-marco-puerta') }),
    )
    // El supino (≈ 2) es "si fue dominada"; el marco (≈ 1) va siempre.
    expect(bloque(r, 'otro-plano')?.pasos[0]?.ejercicioId).toBe('remo-marco-puerta')
    const colgado = resolverMix(
      'espalda',
      'completa',
      contexto({ avances: avancesEn({ traccion: 5 }), equipo: TODO, catalogo: con('remo-australiano-supino') }),
    )
    expect(bloque(colgado, 'otro-plano')?.candidatas).toEqual(['remo-australiano-bajo', 'remo-australiano-pies-elevados'])
  })
})

// ─── La dosis ───────────────────────────────────────────────────────────

describe('la dosis de los fijos sigue la doble progresión (§5.6 B8)', () => {
  // Brazos con empuje 8: la diamante (eslabón 7) es la variante del bloque 2.
  const diamante = (historial: Sesion[], version: VersionDeMix = 'completa') =>
    bloque(resolverMix('brazos', version, contexto({ avances: avancesEn({ empuje: 8 }), historial })), 'empuje-triceps')!
      .pasos[0]!
  const vez = (fecha: string, cantidad: number, logrado: number[], extra: Partial<RegistroEjercicio> = {}) =>
    sesion(fecha, 10, [['flexion-diamante', { series: logrado.length, cantidad }, logrado, extra]])

  it('sin historial, lo bajo de la ventana', () => {
    expect(diamante([])).toMatchObject({ clase: 'fijo', fijo: true, objetivo: { series: 3, cantidad: 5 } })
  })

  it('si cada serie llegó, sube el incremento; si no, repite', () => {
    expect(diamante([vez(AYER, 8, [8, 8, 8])]).objetivo).toEqual({ series: 3, cantidad: 9 })
    expect(diamante([vez(AYER, 8, [8, 8, 6])]).objetivo).toEqual({ series: 3, cantidad: 8 })
  })

  it('siempre dentro de la ventana: no pasa del techo ni queda debajo del piso', () => {
    expect(diamante([vez(AYER, 12, [12, 12, 12])]).objetivo.cantidad).toBe(12)
    expect(diamante([vez(AYER, 3, [3, 3])]).objetivo.cantidad).toBe(5)
    // Un fijo de una rutina con 14, que la persona escribió por encima del
    // techo: en su rutina se respeta (`objetivoDelFijo` no lo recorta), en el
    // mix no.
    expect(diamante([vez(AYER, 14, [14, 14, 14])]).objetivo.cantidad).toBe(12)
  })

  it('mira la última vez, sin la entrada en calor', () => {
    const historial = [vez(ANTEAYER, 8, [8, 8, 8]), vez(AYER, 10, [10, 10, 10], { calentamiento: true })]
    expect(diamante(historial).objetivo.cantidad).toBe(9)
    expect(diamante([vez(ANTEAYER, 10, [10, 10, 10]), vez(AYER, 8, [8, 8, 7])]).objetivo.cantidad).toBe(8)
  })

  it('Corto: 2 series; Liviano: 2 series y lo bajo de la ventana', () => {
    expect(diamante([vez(AYER, 8, [8, 8, 8])], 'corta').objetivo).toEqual({ series: 2, cantidad: 9 })
    expect(diamante([vez(AYER, 8, [8, 8, 8])], 'liviana').objetivo).toEqual({ series: 2, cantidad: 5 })
  })

  it('la última vez es la de objetivoDelFijo: un Liviano o el Reloj no la hacen retroceder', () => {
    // Con su propia cuenta, el mix tomaba el Liviano de ayer (5 cumplidas) y
    // proponía 6: la variante bajaba por haber hecho la versión liviana.
    const completa = vez(ANTEAYER, 8, [8, 8, 8])
    const liviana = sesion(AYER, 10, [['flexion-diamante', { series: 2, cantidad: 5 }, [5, 5]]], { tipo: 'corta' })
    const tabata = vez(AYER, 5, [5, 5, 5], { reloj: true })
    expect(diamante([completa, liviana]).objetivo).toEqual({ series: 3, cantidad: 9 })
    expect(diamante([completa, tabata]).objetivo).toEqual({ series: 3, cantidad: 9 })
    // Y dice lo mismo que el fijo de una rutina con el mismo historial.
    const historial = [completa, liviana, tabata]
    expect(diamante(historial).objetivo).toEqual(
      objetivoDelFijo({ series: 3 }, POR_ID.get('flexion-diamante')!, historial),
    )
  })
})

// ─── La cadena ──────────────────────────────────────────────────────────

describe('los bloques de cadena', () => {
  it('llevan tu eslabón con el objetivo del motor, y son los únicos que leen', () => {
    const avances = avancesEn({ empuje: 6 })
    avances.set('empuje', { ejercicioId: 'flexion-completa', objetivoActual: { series: 3, cantidad: 10 } })
    const r = resolverMix('pecho', 'completa', contexto({ avances }))
    expect(bloque(r, 'empuje')?.pasos).toEqual([
      { id: 'empuje', ejercicioId: 'flexion-completa', objetivo: { series: 3, cantidad: 10 }, clase: 'cadena', seccion: 'principal' },
    ])
    expect(r.mueve).toEqual(['empuje'])
  })

  it('sin el equipo de tu eslabón va el de abajo que sí alcanza, como fijo y con su nota', () => {
    // Tracción 6, la dominada asistida, pide barra y banda.
    const r = resolverMix('espalda', 'completa', contexto({ avances: avancesEn({ traccion: 6 }), equipo: CON_BARRA }))
    expect(bloque(r, 'traccion')?.pasos[0]).toMatchObject({ ejercicioId: 'dominada-negativa', clase: 'fijo', fijo: true })
    expect(bloque(r, 'traccion')?.nota).toBe('Sin banda, la tracción queda con dominadas negativas.')
    expect(r.mueve).toEqual([])
  })

  it('sin ningún eslabón al alcance, el bloque se saltea y lo dice', () => {
    const r = resolverMix('espalda', 'completa', contexto({ avances: avancesEn({ traccion: 3 }), equipo: ['nada'] }))
    expect(bloque(r, 'traccion')?.pasos).toEqual([])
    expect(bloque(r, 'traccion')?.nota).toBe('Con tu equipo no hay opción para tracción: este mix la saltea.')
  })

  it('sin avances no hay nada que proponer, y no se dice nada', () => {
    const r = resolverMix('pecho', 'completa', contexto({ avances: new Map() }))
    expect(bloque(r, 'empuje')).toMatchObject({ pasos: [], nota: null })
  })

  it('Piernas: con el nórdico, la bisagra va con 2 series; en Glúteos, con las del motor', () => {
    const ctx = contexto({ avances: avancesEn({ bisagra: 8 }) })
    expect(bloque(resolverMix('piernas', 'completa', ctx), 'bisagra')?.pasos[0]).toMatchObject({
      ejercicioId: 'curl-nordico',
      clase: 'cadena',
      objetivo: { series: 2 },
    })
    expect(bloque(resolverMix('gluteos', 'completa', ctx), 'bisagra')?.pasos[0]?.objetivo.series).toBe(3)
    expect(bloque(resolverMix('piernas', 'completa', contexto({ avances: avancesEn({ bisagra: 7 }) })), 'bisagra')?.pasos[0]?.objetivo.series).toBe(2)
    expect(bloque(resolverMix('piernas', 'completa', contexto({ avances: avancesEn({ bisagra: 6 }) })), 'bisagra')?.pasos[0]?.objetivo.series).toBe(3)
  })

  it('Cuerpo completo alterna piernas y bisagra: va la que hace más que no se hace', () => {
    const cuerpo = (historial: Sesion[]) => bloque(resolverMix('cuerpo', 'completa', contexto({ historial })), 'piernas-o-bisagra')!
    expect(cuerpo([])).toMatchObject({ nombre: 'Piernas', pasos: [{ ejercicioId: 'sentadilla-bulgara' }] })
    const piernasAyer = sesion(AYER, 10, [['zancada', { series: 3, cantidad: 8 }, [8, 8, 8]]])
    expect(cuerpo([piernasAyer])).toMatchObject({ nombre: 'Bisagra', pasos: [{ ejercicioId: 'puente-una-pierna-elevado' }] })
    const bisagraHoy = sesion(HOY, 8, [['puente-una-pierna', { series: 3, cantidad: 8 }, [8, 8, 8]]])
    expect(cuerpo([piernasAyer, bisagraHoy]).nombre).toBe('Piernas')
    // La entrada en calor no cuenta como haberlo hecho.
    const calentando = sesion(AYER, 10, [['zancada', { series: 1, cantidad: 8 }, [8], { calentamiento: true }]])
    expect(cuerpo([calentando]).nombre).toBe('Piernas')
  })
})

describe('tu eslabón como opción de un bloque (§6.3)', () => {
  it('Brazos con la diamante en el 7: el bloque pasa a ser de cadena y mueve el empuje', () => {
    const avances = avancesEn({ empuje: 7 })
    const r = resolverMix('brazos', 'completa', contexto({ avances }))
    expect(bloque(r, 'empuje-triceps')?.pasos[0]).toEqual({
      id: 'empuje-triceps',
      ejercicioId: 'flexion-diamante',
      objetivo: avances.get('empuje')!.objetivoActual,
      clase: 'cadena',
      seccion: 'principal',
    })
    expect(r.mueve).toEqual(['empuje'])
    // En el 8 la diamante es una variante más: no lee.
    expect(resolverMix('brazos', 'completa', contexto({ avances: avancesEn({ empuje: 8 }) })).mueve).toEqual([])
  })

  it('Hombros con la declinada en el 8: el empuje por encima de la cabeza lee el empuje', () => {
    const r = resolverMix('hombros', 'completa', contexto({ avances: avancesEn({ empuje: 8 }) }))
    expect(bloque(r, 'sobre-la-cabeza')?.pasos[0]).toMatchObject({ ejercicioId: 'flexion-declinada', clase: 'cadena' })
    expect(r.mueve).toEqual(['empuje'])
  })

  it('si el mix ya tiene la cadena de ese patrón, va N − 1', () => {
    // Core 3: la plancha con brazo alternado es tu eslabón y el bloque 1 ya la lee.
    const r = resolverMix(
      'core',
      'completa',
      contexto({ avances: avancesEn({ core: 3 }), catalogo: con('bicho-muerto', 'plancha-lateral-rodillas') }),
    )
    expect(bloque(r, 'core')?.pasos[0]).toMatchObject({ ejercicioId: 'plancha-brazo-alternado', clase: 'cadena' })
    expect(bloque(r, 'rotacion')?.pasos[0]).toMatchObject({ ejercicioId: 'plancha', clase: 'volumen', bajada: true })
    expect(r.pasos.filter((p) => p.clase === 'cadena')).toHaveLength(1)
  })

  it('tu eslabón sigue en la fila de su bloque: con lo de antes superado, va N − 1 y no la última superada', () => {
    // Core 3 con banda y un Pallof de prueba (ola 2): la rotación tiene el
    // Pallof (nivel I) y tu eslabón, la plancha con brazo alternado (3). El
    // lateral y el abdomen tienen lo suyo, así no se llevan la bajada antes.
    const catalogo = [...con('bicho-muerto', 'plancha-lateral-rodillas'), accesorio('pallof-banda', 'core', 1, ['banda'])]
    const rotacion = (historial: Sesion[]) =>
      bloque(
        resolverMix('core', 'completa', contexto({ avances: avancesEn({ core: 3 }), equipo: CON_BANDA, catalogo, historial })),
        'rotacion',
      )!
    expect(rotacion([]).pasos[0]).toMatchObject({ ejercicioId: 'pallof-banda', clase: 'fijo' })
    // Tu eslabón no figura entre las candidatas: ya está en el bloque de cadena.
    expect(rotacion([]).candidatas).toEqual(['pallof-banda'])
    const techo = (fecha: string) => sesion(fecha, 10, [['pallof-banda', { series: 2, cantidad: 12 }, [12, 12]]])
    expect(rotacion([techo(ANTEAYER), techo(AYER)]).pasos[0]).toMatchObject({
      ejercicioId: 'plancha',
      clase: 'volumen',
      bajada: true,
    })
  })

  it('Glúteos con la búlgara en el 5: el bloque a una pierna lee piernas', () => {
    const r = resolverMix('gluteos', 'completa', contexto({ avances: avancesEn({ piernas: 5, bisagra: 4 }) }))
    expect(bloque(r, 'una-pierna')?.pasos[0]).toMatchObject({ ejercicioId: 'sentadilla-bulgara', clase: 'cadena' })
    expect(r.mueve).toEqual(['bisagra', 'piernas'])
  })
})

// ─── La entrada ─────────────────────────────────────────────────────────

describe('la entrada', () => {
  const ctx = contexto({ avances: avancesEn({ empuje: 6, traccion: 5, piernas: 4, core: 5, bisagra: 5 }), equipo: CON_BARRA })
  const entrada = (s: Sector, extra: Partial<ContextoDelMix> = {}, version: VersionDeMix = 'completa') =>
    bloque(resolverMix(s, version, { ...ctx, ...extra }), 'entrada')!.pasos

  it('es la de §6.3 en cada mix, con lo que la biblioteca de hoy tiene', () => {
    const ids = (s: Sector) => entrada(s).map((p) => p.ejercicioId)
    expect(ids('pecho')).toEqual(['munecas-cuatro-patas', 'flexion-rodillas'])
    expect(ids('espalda')).toEqual(['pasaje-hombros'])
    expect(ids('hombros')).toEqual(['munecas-cuatro-patas', 'pasaje-hombros'])
    expect(ids('brazos')).toEqual(['munecas-cuatro-patas', 'pasaje-hombros'])
    expect(ids('core')).toEqual(['gato-vaca', 'perro-cobra', 'elevacion-rodillas-suelo'])
    expect(ids('piernas')).toEqual(['rodilla-pared', 'sentadilla-profunda-sostenida', 'zancada-rotacion'])
    expect(ids('gluteos')).toEqual(['cadera-90-90', 'zancada-rotacion', 'bisagra-una-pierna'])
    expect(ids('cuerpo')).toEqual([
      'gato-vaca',
      'zancada-rotacion',
      'pasaje-hombros',
      'perro-cobra',
      'remo-australiano-pies-elevados',
    ])
  })

  it('la movilidad va con la dosis de su ficha; la serie fácil, una del eslabón anterior a lo bajo de su ventana', () => {
    const pecho = entrada('pecho')
    expect(pecho[0]).toEqual({
      id: 'entrada-munecas-cuatro-patas',
      ejercicioId: 'munecas-cuatro-patas',
      objetivo: { series: 2, cantidad: 10 },
      clase: 'movilidad',
      seccion: 'entrada',
    })
    expect(pecho[1]).toEqual({
      id: 'entrada-serie-facil',
      ejercicioId: 'flexion-rodillas',
      objetivo: { series: 1, cantidad: 8 },
      clase: 'fijo',
      seccion: 'entrada',
      fijo: true,
      calentamiento: true,
    })
  })

  it('con la ola 1: la flexión escapular en Pecho, y en Espalda la activación según el equipo', () => {
    const catalogo = con('flexion-escapular', 'ytw-piso', 'dominada-escapular', 'aperturas-banda')
    expect(entrada('pecho', { catalogo }).map((p) => `${p.ejercicioId} ${p.objetivo.series}×${p.objetivo.cantidad}`)).toEqual([
      'munecas-cuatro-patas 2×10',
      'flexion-escapular 1×10',
      'flexion-rodillas 1×8',
    ])
    const activacion = (equipo: readonly Equipo[]) =>
      entrada('espalda', { catalogo, equipo }).map((p) => `${p.ejercicioId} ${p.objetivo.series}×${p.objetivo.cantidad}`)
    expect(activacion(CASA)).toEqual(['pasaje-hombros 1×8', 'ytw-piso 1×6'])
    expect(activacion(CON_BARRA)).toEqual(['pasaje-hombros 1×8', 'dominada-escapular 1×8'])
    expect(activacion(TODO)).toEqual(['pasaje-hombros 1×8', 'aperturas-banda 1×12'])
    for (const paso of entrada('espalda', { catalogo, equipo: CASA }).slice(1)) {
      expect(paso).toMatchObject({ clase: 'fijo', fijo: true, calentamiento: true, seccion: 'entrada' })
    }
  })

  it('en el eslabón 1 no hay serie fácil: no hay eslabón anterior', () => {
    expect(entrada('pecho', { avances: avancesEn(parejo(1)) }).map((p) => p.ejercicioId)).toEqual(['munecas-cuatro-patas'])
  })

  it('Corto y Liviano la conservan igual; el interruptor la saca y no toca el trabajo', () => {
    for (const sector of SECTORES) {
      const completa = resolverMix(sector, 'completa', ctx)
      for (const version of ['corta', 'liviana'] as const) {
        expect(bloque(resolverMix(sector, version, ctx), 'entrada')?.pasos, `${sector} ${version}`).toEqual(
          bloque(completa, 'entrada')?.pasos,
        )
      }
      const apagada = resolverMix(sector, 'completa', { ...ctx, entrada: false })
      expect(bloque(apagada, 'entrada')?.pasos, sector).toEqual([])
      expect(trabajo(apagada), sector).toEqual(trabajo(completa))
    }
  })

  it('nunca lleva un estiramiento de después, en ningún mix ni versión', () => {
    for (const { nombre, r } of matriz()) {
      for (const paso of r.pasos.filter((p) => p.seccion === 'entrada')) {
        expect(MOVILIDAD_POR_ID.get(paso.ejercicioId)?.despues, `${nombre}: ${paso.ejercicioId}`).toBeUndefined()
      }
    }
  })

  it('la entrada no suma series ni lee', () => {
    for (const { nombre, r } of matriz()) {
      for (const paso of r.pasos.filter((p) => p.seccion === 'entrada')) {
        expect(paso.clase === 'movilidad' || paso.calentamiento === true, nombre).toBe(true)
        expect(paso.clase, nombre).not.toBe('cadena')
      }
    }
  })
})

// ─── Las versiones ──────────────────────────────────────────────────────

describe('las versiones (§5.6 F)', () => {
  const explosiva = variante('flexion-explosiva', 'empuje', 7)
  const ctx = contexto({
    avances: avancesEn({ empuje: 7, traccion: 5, piernas: 4, core: 5, bisagra: 5 }),
    equipo: TODO,
    catalogo: [...EJERCICIOS, explosiva, ...OLA_1.filter((e) => ['colgado-activo', 'copenhague-corta'].includes(e.id))],
  })

  it('Completo lleva los opcionales y, donde la tabla lo tiene, el Cierre; Corto saca los opcionales; Liviano los lleva', () => {
    const opcionales = (s: Sector, v: VersionDeMix) =>
      resolverMix(s, v, ctx).bloques.filter((b) => b.opcional && b.pasos.length > 0).map((b) => b.id)
    expect(opcionales('pecho', 'completa')).toEqual(['explosivo'])
    expect(opcionales('pecho', 'corta')).toEqual([])
    expect(opcionales('pecho', 'liviana')).toEqual(['explosivo'])
    expect(opcionales('espalda', 'completa')).toEqual(['agarre'])
    expect(opcionales('espalda', 'corta')).toEqual([])
    expect(opcionales('piernas', 'completa')).toEqual(['aductores'])
    expect(opcionales('piernas', 'corta')).toEqual([])
    for (const s of SECTORES) {
      // La serie de cierre es el bloque opcional Cierre (§4.14), y solo
      // Pecho lo tiene en su tabla: ningún otro mix suma una serie que el
      // Sector no muestra.
      const completo = resolverMix(s, 'completa', ctx)
      expect(completo.cierre, s).toBe(s === 'pecho')
      expect(completo.cierre, s).toBe(completo.bloques.some((b) => b.clase === 'cierre'))
      expect(resolverMix(s, 'corta', ctx).cierre, s).toBe(false)
      expect(resolverMix(s, 'liviana', ctx).cierre, s).toBe(false)
      expect(resolverMix(s, 'corta', ctx).bloques.some((b) => b.opcional), s).toBe(false)
    }
    expect(bloque(resolverMix('pecho', 'completa', ctx), 'cierre')).toBeDefined()
    expect(MIXES.filter((m) => m.bloques.some((b) => b.clase === 'cierre')).map((m) => m.sector)).toEqual(['pecho'])
  })

  it('Corto: 2 series en variantes y accesorios, y la cadena con la dosis del motor, que lee', () => {
    for (const sector of SECTORES) {
      const corta = resolverMix(sector, 'corta', ctx)
      for (const paso of trabajo(corta)) {
        if (paso.clase === 'cadena') {
          const avance = [...ctx.avances.values()].find((x) => x.ejercicioId === paso.ejercicioId)!
          const tope = sector === 'piernas' && paso.ejercicioId.startsWith('curl-nordico') ? 2 : avance.objetivoActual.series
          expect(paso.objetivo, `${sector}: ${paso.ejercicioId}`).toEqual({ ...avance.objetivoActual, series: tope })
        } else {
          expect(paso.objetivo.series, `${sector}: ${paso.ejercicioId}`).toBe(2)
        }
      }
      expect(corta.mueve, sector).toEqual(resolverMix(sector, 'completa', ctx).mueve)
    }
  })

  it('Liviano: 2 series en todo, con lo bajo de la ventana como techo, y no lee nada', () => {
    const catalogo = new Map(ctx.catalogo!.map((e) => [e.id, e]))
    for (const sector of SECTORES) {
      const liviana = resolverMix(sector, 'liviana', ctx)
      expect(liviana.mueve, sector).toEqual([])
      for (const paso of trabajo(liviana)) {
        const ficha = catalogo.get(paso.ejercicioId)!
        expect(paso.objetivo.series, `${sector}: ${paso.ejercicioId}`).toBe(2)
        expect(paso.objetivo.cantidad, `${sector}: ${paso.ejercicioId}`).toBeLessThanOrEqual(ficha.ventana.min)
      }
    }
  })

  it('Liviano baja la cadena a la cantidad más baja entre la de hoy y lo bajo de la ventana', () => {
    const avances = avancesEn({ empuje: 6 })
    avances.set('empuje', { ejercicioId: 'flexion-completa', objetivoActual: { series: 3, cantidad: 4 } })
    const r = resolverMix('pecho', 'liviana', contexto({ avances }))
    expect(bloque(r, 'empuje')?.pasos[0]?.objetivo).toEqual({ series: 2, cantidad: 4 })
    avances.set('empuje', { ejercicioId: 'flexion-completa', objetivoActual: { series: 3, cantidad: 10 } })
    const otra = resolverMix('pecho', 'liviana', contexto({ avances }))
    expect(bloque(otra, 'empuje')?.pasos[0]?.objetivo).toEqual({ series: 2, cantidad: 5 })
  })
})

// ─── Las cuentas ────────────────────────────────────────────────────────

describe('minutos, series y mueve', () => {
  it('los minutos salen de minutosDeSesion con los pasos de fuerza', () => {
    for (const { nombre, r, ctx } of matriz()) {
      const catalogo = new Map((ctx.catalogo ?? EJERCICIOS).map((e) => [e.id, e]))
      const esperado = minutosDeSesion(
        r.pasos
          .filter((p) => p.clase !== 'movilidad')
          .map((p) => ({
            ejercicio: catalogo.get(p.ejercicioId)!,
            objetivo: p.objetivo,
            ...(p.descansoSegundos !== undefined ? { descansoSegundos: p.descansoSegundos } : {}),
          })),
      )
      expect(r.minutos, nombre).toBe(esperado)
    }
  })

  it('las series son las de trabajo, y la cifra de la zona nunca pasa de ellas', () => {
    for (const { nombre, sector, r } of matriz()) {
      expect(r.series, nombre).toBe(trabajo(r).reduce((s, p) => s + p.objetivo.series, 0))
      if (sector === 'cuerpo') continue
      // La sesión que sale de hacer el mix tal cual, con su entrada.
      const hecha = sesion(
        HOY,
        10,
        r.pasos
          .filter((p) => p.clase !== 'movilidad')
          .map((p): Registro => [
            p.ejercicioId,
            p.objetivo,
            Array.from({ length: p.objetivo.series }, () => p.objetivo.cantidad),
            p.calentamiento ? { calentamiento: true } : {},
          ]),
      )
      expect(seriesDeZona(sector as Zona, [hecha], HOY, 1), nombre).toBeLessThanOrEqual(r.series)
    }
  })

  it('mueve son las cadenas de sus pasos cadena, una vez cada una', () => {
    for (const { nombre, version, r } of matriz()) {
      const deSusPasos = [
        ...new Set(
          r.pasos.filter((p) => p.clase === 'cadena').map((p) => CADENAS.find((c) => c.ejercicios.includes(p.ejercicioId))!.patron),
        ),
      ]
      expect(r.mueve, nombre).toEqual(version === 'liviana' ? [] : deSusPasos)
    }
  })

  it('una cadena que ya se leyó hoy no se promete: el paso queda y suma volumen', () => {
    const decision = (patron: Patron, movimiento: string): DecisionGuardada => ({
      patron,
      movimiento,
      explicacion: '',
      cambioDeNivel: false,
    })
    const leida = sesion(HOY, 9, [['flexion-completa', { series: 3, cantidad: 8 }, [8, 8, 8]]], {
      decisiones: [decision('empuje', 'sostiene')],
    })
    const r = resolverMix('pecho', 'completa', contexto({ historial: [leida] }))
    expect(r.mueve).toEqual([])
    expect(bloque(r, 'empuje')?.pasos[0]?.clase).toBe('cadena')
    const neutra = { ...leida, decisiones: [decision('empuje', 'neutra')] }
    expect(resolverMix('pecho', 'completa', contexto({ historial: [neutra] })).mueve).toEqual(['empuje'])
    const deAyer = { ...leida, fecha: AYER, finalizadaEn: a(AYER, 9) }
    expect(resolverMix('pecho', 'completa', contexto({ historial: [deAyer] })).mueve).toEqual(['empuje'])
  })
})

// ─── Lo que la semana dejó atrás ────────────────────────────────────────

describe('lo que la semana dejó atrás (Cuerpo completo)', () => {
  const tresDias = (ids: string[]) =>
    ['2026-10-19', ANTEAYER, AYER].map((f) =>
      sesion(f, 10, ids.map((id): Registro => [id, { series: 3, cantidad: 8 }, [8, 8, 8]])),
    )

  it('sin plan, el músculo de loQueFaltaSinPlan con algo que lo tenga de principal', () => {
    const historial = tresDias(['flexion-completa', 'remo-australiano-bajo', 'sentadilla-completa', 'plancha'])
    const falta = loQueFaltaSinPlan(historial, CASA, HOY)
    expect(falta).toMatchObject({ clase: 'flojo', musculo: 'oblicuos' })
    const r = resolverMix('cuerpo', 'completa', contexto({ historial }))
    const paso = bloque(r, 'semana')!.pasos[0]!
    expect(paso).toMatchObject({ ejercicioId: 'plancha-brazo-alternado', clase: 'fijo', objetivo: { series: 2 } })
    expect(APORTE[paso.ejercicioId]?.oblicuos).toBe(1)
  })

  it('con plan, usa loQueFalta: el patrón que la rutina no pide', () => {
    const historial = tresDias(['flexion-completa', 'remo-australiano-bajo'])
    const minima = RUTINAS.find((r) => r.id === 'minima')!
    const r = resolverMix('cuerpo', 'completa', contexto({ historial, plan: minima }))
    const paso = bloque(r, 'semana')!.pasos[0]!
    expect(APORTE[paso.ejercicioId]?.cuadriceps).toBe(1)
    // Tu eslabón de piernas (5) es de la banda II y lo lee el bloque 3: va
    // el de cuádriceps de esa banda que queda por debajo, la zancada (4).
    expect(paso.ejercicioId).toBe('zancada')
    expect(bloque(r, 'piernas-o-bisagra')?.pasos[0]?.ejercicioId).toBe('sentadilla-bulgara')
  })

  it('con la semana pareja, o sin con qué decirlo, no agrega nada ni dice nada', () => {
    const sinDatos = resolverMix('cuerpo', 'completa', contexto({ historial: tresDias(['flexion-completa']).slice(0, 2) }))
    expect(bloque(sinDatos, 'semana')).toMatchObject({ pasos: [], nota: null })
    const todo = tresDias([
      'flexion-una-mano',
      'remo-australiano-bajo',
      'sentadilla-completa',
      'puente-una-pierna',
      'plancha-brazo-alternado',
      'elevacion-piernas-suelo',
      'flexion-diamante',
      'dominada-negativa',
    ])
    const falta = loQueFaltaSinPlan(todo, CASA, HOY)
    if (falta.clase === 'parejo') {
      expect(bloque(resolverMix('cuerpo', 'completa', contexto({ historial: todo })), 'semana')).toMatchObject({ pasos: [], nota: null })
    }
  })
})

// ─── Las notas ──────────────────────────────────────────────────────────

describe('las notas', () => {
  it('son cortas, informan y no dicen nada de lo que no se dice', () => {
    const todas = new Set<string>()
    for (const { r } of matriz(con(...OLA_1.map((e) => e.id)))) for (const n of r.notas) todas.add(n)
    for (const { r } of matriz()) for (const n of r.notas) todas.add(n)
    expect(todas.size).toBeGreaterThan(0)
    for (const nota of todas) {
      expect(nota.length, nota).toBeLessThanOrEqual(140)
      expect(nota, nota).not.toContain('!')
      expect(loProhibido(nota), nota).toBeNull()
      expect(nota, nota).toMatch(/^[A-ZÁÉÍÓÚÑ].*\.$/)
    }
  })

  it('la nota de equipo nombra solo lo que cambiaría la elección (§7.7)', () => {
    // Hombro de costado: con banda iría la elevación lateral.
    const r = resolverMix('hombros', 'completa', contexto({ catalogo: con('empuje-lateral-pared', 'elevacion-lateral-banda') }))
    expect(bloque(r, 'costado')?.pasos[0]?.ejercicioId).toBe('empuje-lateral-pared')
    expect(bloque(r, 'costado')?.nota).toBe('Sin banda, el hombro de costado queda con empuje lateral contra la pared.')
    // Con banda no hay nada que decir.
    const conBanda = resolverMix('hombros', 'completa', contexto({ equipo: CON_BANDA, catalogo: con('empuje-lateral-pared', 'elevacion-lateral-banda') }))
    expect(bloque(conBanda, 'costado')).toMatchObject({ nota: null, pasos: [{ ejercicioId: 'elevacion-lateral-banda' }] })
    // Si con todo el equipo iría lo mismo, tampoco.
    const igual = resolverMix('hombros', 'completa', contexto({ catalogo: con('empuje-lateral-pared') }))
    expect(bloque(igual, 'costado')?.nota).toBeNull()
  })

  it('un bloque sin ninguna opción con tu equipo se saltea y lo dice como §7.7', () => {
    const r = resolverMix('espalda', 'completa', contexto({ catalogo: con('colgado-activo') }))
    expect(bloque(r, 'agarre')).toMatchObject({
      pasos: [],
      nota: 'Con tu equipo no hay opción para agarre: este mix lo saltea.',
    })
  })

  it('la más cercana por debajo, si es por equipo, también lo dice', () => {
    const r = resolverMix(
      'pecho',
      'completa',
      contexto({ avances: avancesEn({ empuje: 10 }), catalogo: con('flexion-pausa', 'fondos-paralelas') }),
    )
    expect(bloque(r, 'otra-palanca')?.pasos[0]?.ejercicioId).toBe('flexion-pausa')
    expect(bloque(r, 'otra-palanca')?.nota).toBe('Sin paralelas, el pecho con otra palanca queda con flexion pausa.')
  })

  it('concuerda en número: los aductores y el hombro de adelante y el serrato "quedan"', () => {
    const r = resolverMix(
      'hombros',
      'completa',
      contexto({ avances: avancesEn({ empuje: 1 }), catalogo: con('flexion-escapular', 'apoyo-paralelas'), equipo: CASA }),
    )
    // Con paralelas iría el apoyo (por id, antes que la flexión escapular).
    expect(bloque(r, 'adelante-serrato')?.nota).toBe(
      'Sin paralelas, el hombro de adelante y el serrato quedan con flexion escapular.',
    )
  })
})

// ─── mixArmable ─────────────────────────────────────────────────────────

describe('mixArmable dice lo mismo que resolverMix', () => {
  /** Si salió el bloque sin el cual el mix no es el de su zona (el de Cuerpo completo, todos). */
  const armado = (sector: Sector, r: MixResuelto) => {
    const centrales = r.bloques.filter((b) => MIX_POR_SECTOR[sector].bloques.find((x) => x.id === b.id)?.central)
    return sector === 'cuerpo' ? centrales.every((b) => b.pasos.length > 0) : centrales.some((b) => b.pasos.length > 0)
  }

  it('en cada sector, con cada perfil de equipoDe y desde el eslabón 2', () => {
    const distintos: string[] = []
    for (const sector of SECTORES) {
      for (const [perfil, equipo] of PERFILES) {
        for (const [nivel, niveles] of [...NIVELES, ['eslabón 5', parejo(5)] as const]) {
          const r = resolverMix(sector, 'completa', contexto({ avances: avancesEn(niveles), equipo }))
          if (mixArmable(sector, equipo) !== armado(sector, r)) distintos.push(`${sector} · ${perfil} · ${nivel}`)
        }
      }
    }
    expect(distintos).toEqual([])
  })

  it('en el eslabón 1 solo Hombros y Brazos quedan sin su bloque central; con la ola 1, solo Hombros sin discos', () => {
    // mixArmable no mira el nivel; resolverMix nunca propone algo más difícil
    // que tu eslabón. Sin la ola 1, en el eslabón 1 de empuje y tracción no hay
    // nada para el primer bloque de Hombros ni de Brazos. Con la ola 1 (de
    // prueba), Brazos sí; Hombros no, porque su primera opción por encima de
    // la cabeza sin discos (`flexion-pica-inclinada`) equivale al empuje 4 y
    // antes del eslabón 1 no hay bajada. Con discos va el press militar, que
    // es de cualquier nivel. Desde el eslabón 2 la bajada lo cubre.
    for (const [, equipo] of PERFILES) {
      const distintos = SECTORES.filter((s) => {
        const r = resolverMix(s, 'completa', contexto({ avances: avancesEn(parejo(1)), equipo }))
        return mixArmable(s, equipo) !== armado(s, r)
      })
      expect(distintos.every((s) => s === 'hombros' || s === 'brazos'), distintos.join(', ')).toBe(true)
      const conOla1 = SECTORES.filter((s) => {
        const r = resolverMix(s, 'completa', contexto({ avances: avancesEn(parejo(1)), equipo, catalogo: con(...OLA_1.map((e) => e.id)) }))
        return mixArmable(s, equipo) !== armado(s, r)
      })
      expect(conOla1).toEqual(equipo.includes('discos') ? [] : ['hombros'])
    }
  })
})

// ─── La molestia en las candidatas (§6.3) ───────────────────────────────

describe('las candidatas no cargan una cadena marcada en Molestia (§6.3)', () => {
  /** La regla de `fijoConMolestia`: su patrón o el de su `equivale`. */
  const cargaUna = (e: Ejercicio, molestias: ReadonlySet<Patron>) =>
    molestias.has(e.patron) || (e.equivale !== undefined && molestias.has(e.equivale.patron))
  const elegibles = (r: MixResuelto) =>
    r.bloques.filter((b) => b.clase === 'variante' || b.clase === 'accesorio' || b.clase === 'semana')
  const PATRONES: readonly Patron[] = ['empuje', 'traccion', 'piernas', 'core', 'bisagra']
  const catalogo = con(...OLA_1.map((e) => e.id))
  const fichaDe = (id: string) => catalogo.find((e) => e.id === id)!

  it('Espalda con molestia en tracción no elige ni ofrece un tirón: el bloque se saltea y la nota dice por qué', () => {
    // El caso del hallazgo: tracción en la dominada asistida, sin banda.
    const ctx = contexto({
      avances: avancesEn({ traccion: CADENAS.find((c) => c.patron === 'traccion')!.ejercicios.indexOf('dominada-asistida') + 1 }),
      equipo: equipoDe({}),
    })
    const sin = resolverMix('espalda', 'completa', ctx)
    expect(bloque(sin, 'otro-plano')?.pasos[0]?.ejercicioId).toBe('remo-australiano-pies-elevados')
    expect(bloque(sin, 'otro-plano')?.candidatas).toEqual(['remo-australiano-pies-elevados'])

    const con = resolverMix('espalda', 'completa', { ...ctx, molestias: new Set<Patron>(['traccion']) })
    // Sin candidatas, el eslabón anterior es la dominada negativa que ya
    // puso el bloque de tracción: se saltea, y la razón es la molestia.
    expect(bloque(con, 'otro-plano')).toMatchObject({
      pasos: [],
      candidatas: [],
      nota: 'Molestia en tracción: hoy este mix saltea el tirón en el otro plano.',
    })
    // Lo de cadena no se baja acá: eso es de `pasosConMolestia`.
    expect(bloque(con, 'traccion')?.pasos).toEqual(bloque(sin, 'traccion')?.pasos)
  })

  it('un bloque opcional que solo tenía opciones de esa cadena dice la molestia y no "con tu nivel"', () => {
    const ctx = contexto({ equipo: TODO, catalogo: con('colgado-activo', 'caminata-granjero') })
    expect(bloque(resolverMix('espalda', 'completa', ctx), 'agarre')?.pasos).toHaveLength(1)
    const r = resolverMix('espalda', 'completa', { ...ctx, molestias: new Set<Patron>(['traccion']) })
    expect(bloque(r, 'agarre')).toMatchObject({
      pasos: [],
      candidatas: [],
      nota: 'Molestia en tracción: hoy este mix saltea el agarre.',
    })
  })

  it('un bloque obligatorio sin candidatas va al eslabón anterior, que es volumen', () => {
    // Pecho en el empuje 6: la única "otra palanca" es la flexión con pausa.
    const ctx = contexto({ avances: avancesEn({ empuje: 6 }), catalogo: con('flexion-pausa') })
    expect(bloque(resolverMix('pecho', 'completa', ctx), 'otra-palanca')?.pasos[0]).toMatchObject({
      ejercicioId: 'flexion-pausa',
      clase: 'fijo',
    })
    const r = resolverMix('pecho', 'completa', { ...ctx, molestias: new Set<Patron>(['empuje']) })
    const empuje = CADENAS.find((c) => c.patron === 'empuje')!.ejercicios
    expect(bloque(r, 'otra-palanca')).toMatchObject({
      pasos: [{ ejercicioId: empuje[4], clase: 'volumen', bajada: true }],
      candidatas: [],
    })
  })

  it('en ningún mix, perfil, nivel ni versión una candidata o un elegido carga la cadena con molestia', () => {
    const malos: string[] = []
    for (const patron of PATRONES) {
      const molestias = new Set<Patron>([patron])
      for (const { nombre, sector, version, ctx } of matriz(catalogo)) {
        const r = resolverMix(sector, version, { ...ctx, molestias })
        for (const b of elegibles(r)) {
          for (const id of b.candidatas) {
            if (cargaUna(fichaDe(id), molestias)) malos.push(`${nombre} · ${patron} · ${b.id} ofrece ${id}`)
          }
          for (const p of b.pasos) {
            // El eslabón anterior es la regla cuando no queda ninguna, y es
            // volumen: `pasosConMolestia` lo saltea en la sesión.
            if (p.clase === 'volumen' && p.bajada) continue
            if (cargaUna(fichaDe(p.ejercicioId), molestias)) malos.push(`${nombre} · ${patron} · ${b.id} elige ${p.ejercicioId}`)
          }
        }
        for (const nota of r.notas) {
          if (nota.length > 140 || nota.includes('!') || loProhibido(nota) !== null || !/^[A-ZÁÉÍÓÚÑ].*\.$/.test(nota)) {
            malos.push(`${nombre} · ${patron} · nota: ${nota}`)
          }
        }
      }
    }
    expect(malos).toEqual([])
  })

  it('sin molestias, o con un conjunto vacío, el mix es el de siempre', () => {
    for (const { nombre, sector, version, ctx, r } of matriz(catalogo)) {
      expect(resolverMix(sector, version, { ...ctx, molestias: new Set() }), nombre).toEqual(r)
    }
  })
})

// ─── Si un mix tiene algo que hacer ─────────────────────────────────────

describe('mixesConTrabajo: si el mix de hoy tiene trabajo', () => {
  const conDiscos: readonly Equipo[] = [...equipoDe({}), 'discos']

  it('la entrada sola no es trabajo', () => {
    expect(tieneTrabajo([])).toBe(false)
    expect(
      tieneTrabajo([
        { id: 'entrada-a', ejercicioId: 'gato-vaca', objetivo: { series: 1, cantidad: 8 }, clase: 'movilidad', seccion: 'entrada' },
        { id: 'entrada-b', ejercicioId: 'flexion-pared', objetivo: { series: 1, cantidad: 8 }, clase: 'fijo', seccion: 'entrada', calentamiento: true },
      ]),
    ).toBe(false)
    expect(tieneTrabajo([{ id: 'x', ejercicioId: 'flexion-pared', objetivo: { series: 3, cantidad: 8 }, clase: 'fijo', seccion: 'principal' }])).toBe(true)
  })

  it('en el eslabón 1, sin discos, Hombros y Brazos son la entrada sola; con discos o desde el eslabón 2, no', () => {
    const vacios = (niveles: Niveles, equipo: readonly Equipo[]) => {
      const hay = mixesConTrabajo(contexto({ avances: avancesEn(niveles), equipo }))
      return SECTORES.filter((s) => !hay(s))
    }
    expect(vacios(parejo(1), equipoDe({}))).toEqual(['hombros', 'brazos'])
    expect(vacios(parejo(1), CASA)).toEqual(['hombros', 'brazos'])
    expect(vacios(parejo(1), conDiscos)).toEqual([])
    expect(vacios(parejo(2), equipoDe({}))).toEqual([])
  })

  it('dice lo mismo que resolverMix en cada sector, perfil, nivel y versión', () => {
    for (const { nombre, sector, version, ctx, r } of matriz()) {
      expect(mixesConTrabajo(ctx)(sector, version), nombre).toBe(tieneTrabajo(r.pasos))
    }
  })

  it('con molestia cuenta lo que queda después de pasosConMolestia', () => {
    // En el eslabón 1 de empuje, el paso de cadena de Pecho se saltea con la
    // molestia, y lo demás de Pecho también carga el empuje.
    const ctx = contexto({ avances: avancesEn(parejo(1)), equipo: equipoDe({}) })
    expect(tieneTrabajo(resolverMix('pecho', 'completa', ctx).pasos)).toBe(true)
    const conMolestia = { ...ctx, molestias: new Set<Patron>(['empuje']) }
    expect(tieneTrabajo(resolverMix('pecho', 'completa', conMolestia).pasos)).toBe(true)
    expect(mixesConTrabajo(conMolestia)('pecho')).toBe(false)
    expect(mixesConTrabajo(ctx)('pecho')).toBe(true)
  })
})
