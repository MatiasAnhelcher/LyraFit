import { describe, expect, it } from 'vitest'
import { sumarDias } from './adherencia'
import { ANCHO, ESPALDA, FRENTE } from './anatomia'
import { CADENAS, EJERCICIOS, POR_ID } from './biblioteca'
import { DADOS_POR_TENIDOS, alcanza, equipoDe } from './equipo'
import { mixesConTrabajo } from './mixes'
import { APORTE, NOMBRE_MUSCULO, PISO_DE_DOSIS, type Musculo } from './musculos'
import {
  ANCLAS,
  NOMBRE_SECTOR,
  PRINCIPALES,
  SECTORES,
  SECUNDARIOS,
  UMBRAL_DE_ZONA,
  ZONAS,
  ZONAS_DE_LA_VISTA,
  diasPorZona,
  ejerciciosDeZona,
  esSector,
  mixArmable,
  seriesDeZona,
  sugerirZona,
  ultimaVezDeZona,
  zonaSinSeries,
  type MixConTrabajo,
  type Vista,
  type Zona,
} from './sectores'
import type { Avance, Equipo, Patron, RegistroEjercicio, Sector, Sesion } from './tipos'

/**
 * Las zonas son la puerta de Entrenar, y cada número que muestran sale de
 * acá. Lo que más importa probar es lo que se puede romper sin que nadie lo
 * note: que la cifra de una zona empiece a sumar en vez de tomar el máximo,
 * que un día flojo cuente como un día de la zona, o que la sugerencia cambie
 * de desempate.
 */

const HOY = '2026-10-21'

/** Un instante de ese día, en la hora local de quien corre el test. */
const a = (fecha: string, h: number, m = 0) =>
  new Date(`${fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime()

type Registro = [ejercicioId: string, series: number, extra?: Partial<RegistroEjercicio>]

let siguiente = 0
function sesion(fecha: string, registros: Registro[], extra: Partial<Sesion> = {}): Sesion {
  siguiente++
  return {
    id: `s${siguiente}`,
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

const movilidad = (fecha: string): Sesion =>
  sesion(fecha, [], {
    tipo: 'fuelle',
    origen: { clase: 'movilidad', sector: 'pecho', nombre: 'Movilidad de pecho' },
    movilidad: [{ ejercicioId: 'gato-vaca', logrado: [10, 10] }],
  })

describe('las zonas y sus nombres', () => {
  it('van en el orden de la especificación, con el cuerpo completo al final', () => {
    expect([...SECTORES]).toEqual([
      'pecho',
      'espalda',
      'hombros',
      'brazos',
      'core',
      'piernas',
      'gluteos',
      'cuerpo',
    ])
    expect([...ZONAS]).toEqual(SECTORES.filter((s) => s !== 'cuerpo'))
  })

  it('cada sector tiene su nombre', () => {
    expect(SECTORES.map((s) => NOMBRE_SECTOR[s])).toEqual([
      'Pecho',
      'Espalda',
      'Hombros',
      'Brazos',
      'Core',
      'Piernas',
      'Glúteos',
      'Cuerpo completo',
    ])
  })

  it('reconoce un sector que viene de la URL, y nada más', () => {
    expect(esSector('gluteos')).toBe(true)
    expect(esSector('cuerpo')).toBe(true)
    expect(esSector('brazo')).toBe(false)
    expect(esSector('Pecho')).toBe(false)
    expect(esSector(undefined)).toBe(false)
  })
})

describe('principales y secundarios', () => {
  const dibujados = new Set<string>([...Object.keys(FRENTE), ...Object.keys(ESPALDA)])

  it('los veinte músculos de la matriz están en alguna zona', () => {
    const enZonas = new Set(ZONAS.flatMap((z) => [...PRINCIPALES[z], ...SECUNDARIOS[z]]))
    const sueltos = (Object.keys(NOMBRE_MUSCULO) as Musculo[]).filter((m) => !enZonas.has(m))
    expect(sueltos, `sin zona: ${sueltos.join(', ')}`).toEqual([])
  })

  it('ningún músculo es principal y secundario de la misma zona, ni se repite', () => {
    for (const zona of ZONAS) {
      const todos = [...PRINCIPALES[zona], ...SECUNDARIOS[zona]]
      expect(new Set(todos).size, zona).toBe(todos.length)
      expect(PRINCIPALES[zona].length, zona).toBeGreaterThan(0)
    }
  })

  it('cada principal está dibujado y recibe dosis de algún ejercicio', () => {
    for (const zona of ZONAS) {
      for (const musculo of PRINCIPALES[zona]) {
        expect(dibujados.has(musculo), `${zona}: ${musculo} sin dibujar`).toBe(true)
        const conDosis = Object.values(APORTE).some((v) => (v[musculo] ?? 0) >= PISO_DE_DOSIS)
        expect(conDosis, `${zona}: ${musculo} no lo carga nada`).toBe(true)
      }
    }
  })
})

describe('las anclas del mapa', () => {
  const vistas: Vista[] = ['frente', 'espalda']

  it('cada zona está en alguna vista, y cada zona de una vista tiene su ancla', () => {
    const enAlguna = new Set(
      vistas.flatMap((v) => [...ZONAS_DE_LA_VISTA[v].izquierda, ...ZONAS_DE_LA_VISTA[v].derecha]),
    )
    expect([...enAlguna].sort()).toEqual([...ZONAS].sort())
    for (const vista of vistas) {
      for (const lado of ['izquierda', 'derecha'] as const) {
        for (const zona of ZONAS_DE_LA_VISTA[vista][lado]) {
          expect(ANCLAS[vista][zona]?.lado, `${vista} · ${zona}`).toBe(lado)
        }
      }
    }
  })

  it('el punto cae adentro de la caja de un principal de la zona dibujado en esa vista', () => {
    for (const vista of vistas) {
      const dibujo = vista === 'frente' ? FRENTE : ESPALDA
      for (const [zona, ancla] of Object.entries(ANCLAS[vista])) {
        expect(PRINCIPALES[zona as keyof typeof PRINCIPALES]).toContain(ancla.musculo)
        const trazo = dibujo[ancla.musculo]
        expect(trazo, `${vista} · ${zona}`).toBeDefined()
        const numeros = (trazo!.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
        const xs = numeros.filter((_, i) => i % 2 === 0)
        const ys = numeros.filter((_, i) => i % 2 === 1)
        // Del lado izquierdo el músculo está en espejo.
        const x = ancla.lado === 'izquierda' ? ANCHO - ancla.x : ancla.x
        expect(x, `${vista} · ${zona}`).toBeGreaterThanOrEqual(Math.min(...xs))
        expect(x, `${vista} · ${zona}`).toBeLessThanOrEqual(Math.max(...xs))
        expect(ancla.y, `${vista} · ${zona}`).toBeGreaterThanOrEqual(Math.min(...ys))
        expect(ancla.y, `${vista} · ${zona}`).toBeLessThanOrEqual(Math.max(...ys))
      }
    }
  })

  it('cada ancla queda en la mitad del cuerpo de su botón', () => {
    for (const vista of vistas) {
      for (const [zona, ancla] of Object.entries(ANCLAS[vista])) {
        if (ancla.lado === 'izquierda') expect(ancla.x, zona).toBeLessThan(ANCHO / 2)
        else expect(ancla.x, zona).toBeGreaterThan(ANCHO / 2)
      }
    }
  })
})

describe('seriesDeZona', () => {
  it('toma el máximo entre los principales y no la suma', () => {
    // El remo carga dorsal y media espalda a 1: sumados serían seis series de
    // espalda, y la persona hizo tres.
    const remo = [sesion(HOY, [['remo-australiano-medio', 3]])]
    expect(seriesDeZona('espalda', remo, HOY)).toBe(3)

    // Brazos con tres de diamante (tríceps) y tres de curl (bíceps): tres, no seis.
    const brazos = [sesion(HOY, [['flexion-diamante', 3], ['curl-barra', 3]])]
    expect(seriesDeZona('brazos', brazos, HOY)).toBe(3)
  })

  it('los secundarios de la zona no suman a su cifra', () => {
    // La flexión carga hombro de adelante y tríceps a 0,5, que son secundarios
    // de Pecho: Pecho dice tres, no seis.
    const historial = [sesion(HOY, [['flexion-completa', 3]])]
    expect(seriesDeZona('pecho', historial, HOY)).toBe(3)
  })

  it('un 0,25 no es dosis y un 0,5 vale media serie', () => {
    expect(seriesDeZona('gluteos', [sesion(HOY, [['flexion-completa', 3]])], HOY)).toBe(0)
    expect(seriesDeZona('gluteos', [sesion(HOY, [['sentadilla-completa', 3]])], HOY)).toBe(1.5)
  })

  it('suma todas las sesiones de la ventana', () => {
    const historial = [
      sesion(HOY, [['flexion-completa', 3]]),
      sesion(HOY, [['flexion-diamante', 3]]),
      sesion(sumarDias(HOY, -2), [['flexion-rodillas', 4]]),
    ]
    expect(seriesDeZona('pecho', historial, HOY)).toBe(10)
  })

  it('siete días que terminan hoy: el séptimo hacia atrás ya queda afuera', () => {
    const historial = [
      sesion(HOY, [['flexion-completa', 3]]),
      sesion(sumarDias(HOY, -6), [['flexion-completa', 2]]),
      sesion(sumarDias(HOY, -7), [['flexion-completa', 5]]),
      sesion(sumarDias(HOY, 1), [['flexion-completa', 4]]),
    ]
    expect(seriesDeZona('pecho', historial, HOY)).toBe(5)
  })

  it('para un día solo, la ventana es de un día', () => {
    const ayer = sumarDias(HOY, -1)
    const historial = [sesion(HOY, [['plancha', 3]]), sesion(ayer, [['plancha', 2]])]
    expect(seriesDeZona('core', historial, ayer, 1)).toBe(2)
    expect(seriesDeZona('core', historial, HOY, 1)).toBe(3)
  })

  it('la entrada en calor y la movilidad no suman', () => {
    const historial = [
      sesion(HOY, [
        ['flexion-rodillas', 1, { calentamiento: true }],
        ['flexion-completa', 3],
      ]),
      // Una movilidad con registros no existe, pero si existiera tampoco sumaría.
      sesion(HOY, [['flexion-completa', 3]], {
        tipo: 'fuelle',
        origen: { clase: 'movilidad', sector: 'pecho', nombre: 'Movilidad de pecho' },
      }),
    ]
    expect(seriesDeZona('pecho', historial, HOY)).toBe(3)
  })

  it('la serie de cierre y la bajada son trabajo, como en el mapa', () => {
    const historial = [
      sesion(HOY, [
        ['flexion-completa', 3],
        ['flexion-rodillas', 2, { bajada: true }],
      ]),
    ]
    historial[0]!.registros[0]!.series.push({ logrado: 6, cierre: true })
    expect(seriesDeZona('pecho', historial, HOY)).toBe(6)
  })

  it('un ejercicio que la app ya no tiene no suma ni rompe', () => {
    expect(seriesDeZona('pecho', [sesion(HOY, [['flexion-que-no-existe', 3]])], HOY)).toBe(0)
    expect(seriesDeZona('pecho', [], HOY)).toBe(0)
  })
})

describe('un día con zona', () => {
  it('pide 2 series fraccionales o más en un principal', () => {
    expect(UMBRAL_DE_ZONA).toBe(2)
    // Tres sentadillas: cuádriceps 3, glúteo mayor 1,5. Es un día de piernas
    // y no de glúteos.
    const tres = diasPorZona([sesion(HOY, [['sentadilla-completa', 3]])], HOY)
    expect(tres.piernas).toBe(1)
    expect(tres.gluteos).toBe(0)
    // Con cuatro, el glúteo llega a 2.
    const cuatro = diasPorZona([sesion(HOY, [['sentadilla-completa', 4]])], HOY)
    expect(cuatro.gluteos).toBe(1)
  })

  it('una serie suelta no hace un día, y dos en sesiones distintas del mismo día sí', () => {
    const una = diasPorZona([sesion(HOY, [['plancha', 1]])], HOY)
    expect(una.core).toBe(0)
    const dos = diasPorZona([sesion(HOY, [['plancha', 1]]), sesion(HOY, [['plancha', 1]])], HOY)
    expect(dos.core).toBe(1)
  })

  it('tres sesiones en un día son un día', () => {
    const historial = [9, 13, 19].map((h) =>
      sesion(HOY, [['flexion-completa', 3]], { finalizadaEn: a(HOY, h) }),
    )
    const dias = diasPorZona(historial, HOY)
    expect(dias.pecho).toBe(1)
    expect(dias.cuerpo).toBe(1)
  })

  it('cuenta los días de la ventana y nada de afuera', () => {
    const historial = [
      sesion(HOY, [['remo-australiano-bajo', 3]]),
      sesion(sumarDias(HOY, -3), [['remo-australiano-bajo', 3]]),
      sesion(sumarDias(HOY, -6), [['remo-australiano-bajo', 3]]),
      sesion(sumarDias(HOY, -7), [['remo-australiano-bajo', 3]]),
    ]
    expect(diasPorZona(historial, HOY).espalda).toBe(3)
    expect(diasPorZona(historial, HOY, 28).espalda).toBe(4)
  })

  it('el cuerpo completo cuenta los días con sesión, y la movilidad no es sesión', () => {
    const historial = [
      sesion(HOY, [['flexion-completa', 3]]),
      // Un tabata es una sesión, aunque no llegue a ninguna zona.
      sesion(sumarDias(HOY, -1), [['flexion-completa', 1, { reloj: true }]], { tipo: 'reloj' }),
      movilidad(sumarDias(HOY, -2)),
    ]
    const dias = diasPorZona(historial, HOY)
    expect(dias.cuerpo).toBe(2)
    expect(dias.pecho).toBe(1)
  })

  it('sin historial, todo en cero', () => {
    expect(Object.values(diasPorZona([], HOY)).every((n) => n === 0)).toBe(true)
    expect(Object.keys(diasPorZona([], HOY)).sort()).toEqual([...SECTORES].sort())
  })
})

describe('ultimaVezDeZona', () => {
  it('sin nada de esa zona, null', () => {
    expect(ultimaVezDeZona('pecho', [])).toBeNull()
    expect(ultimaVezDeZona('piernas', [sesion(HOY, [['flexion-completa', 3]])])).toBeNull()
  })

  it('el último día de la zona, con la última sesión de ese día que la cargó', () => {
    const temprano = sesion(HOY, [['flexion-completa', 3]], { finalizadaEn: a(HOY, 9, 10) })
    const tarde = sesion(HOY, [['flexion-diamante', 3]], { finalizadaEn: a(HOY, 19, 5) })
    const noche = sesion(HOY, [['sentadilla-completa', 3]], { finalizadaEn: a(HOY, 21) })
    const ayer = sesion(sumarDias(HOY, -1), [['flexion-completa', 3]])
    const ultima = ultimaVezDeZona('pecho', [ayer, tarde, noche, temprano])
    expect(ultima?.fecha).toBe(HOY)
    expect(ultima?.sesion.id).toBe(tarde.id)
  })

  it('un día flojo no cuenta como última vez: manda la misma regla que la baldosa', () => {
    const viernes = sumarDias(HOY, -5)
    const historial = [
      sesion(viernes, [['puente-gluteos', 3]]),
      sesion(HOY, [['sentadilla-completa', 3]]),
    ]
    expect(ultimaVezDeZona('gluteos', historial)?.fecha).toBe(viernes)
  })

  it('la movilidad no es la última vez de nada', () => {
    const historial = [sesion(sumarDias(HOY, -2), [['plancha', 3]]), movilidad(HOY)]
    expect(ultimaVezDeZona('core', historial)?.fecha).toBe(sumarDias(HOY, -2))
  })
})

describe('ejerciciosDeZona', () => {
  const ids = (lista: { id: string }[]) => lista.map((e) => e.id)

  it('Pecho trae las flexiones de pectoral y los de tríceps, y no los remos', () => {
    const pecho = ids(ejerciciosDeZona('pecho'))
    for (const id of ['flexion-pared', 'flexion-completa', 'flexion-una-mano', 'extension-triceps-barra']) {
      expect(pecho, id).toContain(id)
    }
    expect(pecho).not.toContain('remo-australiano-alto')
  })

  it('Brazos va por el principal de la ficha: una flexión común no es de brazos', () => {
    const brazos = ids(ejerciciosDeZona('brazos'))
    expect(brazos).toContain('flexion-diamante')
    expect(brazos).toContain('curl-barra')
    expect(brazos).not.toContain('flexion-completa')
    expect(brazos).not.toContain('remo-australiano-medio')
  })

  it('con equipo, solo lo que se alcanza', () => {
    const casa = DADOS_POR_TENIDOS
    for (const zona of ZONAS) {
      const conCasa = ejerciciosDeZona(zona, casa)
      expect(conCasa.every((e) => alcanza(e, casa)), zona).toBe(true)
      expect(ids(conCasa), zona).toEqual(
        ids(ejerciciosDeZona(zona)).filter((id) => conCasa.some((e) => e.id === id)),
      )
    }
    expect(ids(ejerciciosDeZona('pecho', casa))).not.toContain('extension-triceps-barra')
  })

  it('ningún ejercicio de la biblioteca queda sin zona', () => {
    const conZona = new Set(ZONAS.flatMap((z) => ids(ejerciciosDeZona(z))))
    const sueltos = EJERCICIOS.filter((e) => !conZona.has(e.id)).map((e) => e.id)
    expect(sueltos).toEqual([])
  })

  it('van en el orden de la biblioteca', () => {
    const orden = ids(EJERCICIOS)
    for (const zona of ZONAS) {
      const suyos = ids(ejerciciosDeZona(zona))
      expect(suyos, zona).toEqual([...suyos].sort((x, y) => orden.indexOf(x) - orden.indexOf(y)))
    }
  })
})

describe('mixArmable', () => {
  it('con lo dado por tenido se arman los ocho', () => {
    for (const sector of SECTORES) expect(mixArmable(sector, DADOS_POR_TENIDOS), sector).toBe(true)
  })

  it('con solo el piso, Espalda y Cuerpo completo no: toda la tracción pide algo de dónde tirar', () => {
    expect(mixArmable('espalda', ['nada'])).toBe(false)
    expect(mixArmable('cuerpo', ['nada'])).toBe(false)
    for (const zona of ['pecho', 'hombros', 'brazos', 'core', 'piernas', 'gluteos'] as const) {
      expect(mixArmable(zona, ['nada']), zona).toBe(true)
    }
  })

  it('con el piso y una barra, la espalda vuelve', () => {
    expect(mixArmable('espalda', ['nada', 'barra'])).toBe(true)
    expect(mixArmable('cuerpo', ['nada', 'barra'])).toBe(true)
  })
})

describe('sugerirZona', () => {
  const equipo = equipoDe({})

  it('el primer día va el cuerpo completo', () => {
    expect(sugerirZona([], HOY, equipo)).toBe('cuerpo')
  })

  it('una movilidad sola no saca del primer día', () => {
    expect(sugerirZona([movilidad(sumarDias(HOY, -1))], HOY, equipo)).toBe('cuerpo')
  })

  it('la zona con menos series en 7 días; en un empate, la primera de SECTORES', () => {
    // Una flexión deja Pecho en 3 y algo en Hombros, Brazos y Core. Espalda,
    // Piernas y Glúteos quedan en cero: gana Espalda por el orden.
    const flexiones = [sesion(sumarDias(HOY, -1), [['flexion-completa', 3]])]
    expect(sugerirZona(flexiones, HOY, equipo)).toBe('espalda')

    // Con espalda hecha, el empate en cero queda entre Piernas y Glúteos.
    const conRemo = [...flexiones, sesion(HOY, [['remo-australiano-medio', 3]])]
    expect(sugerirZona(conRemo, HOY, equipo)).toBe('piernas')
  })

  it('mira las series y no los días', () => {
    // Glúteos tuvo dos días con poco y Core uno con mucho; todo lo demás, más.
    const hace = (n: number) => sumarDias(HOY, -n)
    const historial = [
      sesion(hace(1), [
        ['flexion-pared', 10],
        ['flexion-pseudoplancha', 10],
        ['remo-australiano-medio', 10],
        ['curl-barra', 10],
        ['sentadilla-completa', 10],
      ]),
      sesion(hace(2), [['plancha', 6]]),
      sesion(hace(3), [['puente-gluteos', 2]]),
      sesion(hace(4), [['puente-gluteos', 2]]),
    ]
    // Glúteos: 2 + 2 del puente y 5 de las sentadillas, 9. Core: 6 de la
    // plancha y 5 de la pseudo plancha, 11.
    expect(seriesDeZona('gluteos', historial, HOY)).toBe(9)
    expect(seriesDeZona('core', historial, HOY)).toBe(11)
    for (const zona of ['pecho', 'espalda', 'hombros', 'brazos', 'piernas'] as const) {
      expect(seriesDeZona(zona, historial, HOY), zona).toBeGreaterThan(9)
    }
    expect(diasPorZona(historial, HOY).gluteos).toBeGreaterThan(diasPorZona(historial, HOY).core)
    expect(sugerirZona(historial, HOY, equipo)).toBe('gluteos')
  })

  it('lo de hace siete días o más ya no cuenta', () => {
    const historial = [
      sesion(sumarDias(HOY, -1), [['flexion-completa', 3]]),
      sesion(sumarDias(HOY, -7), [['remo-australiano-medio', 10]]),
    ]
    expect(sugerirZona(historial, HOY, equipo)).toBe('espalda')
  })

  it('deja afuera lo que no se puede armar con tu equipo', () => {
    const flexiones = [sesion(sumarDias(HOY, -1), [['flexion-completa', 3]])]
    expect(sugerirZona(flexiones, HOY, ['nada'])).toBe('piernas')
  })

  it('con excepto, nunca sugiere ese sector', () => {
    const flexiones = [sesion(sumarDias(HOY, -1), [['flexion-completa', 3]])]
    expect(sugerirZona(flexiones, HOY, equipo, 'espalda')).toBe('piernas')
    // El primer día, sin el cuerpo completo, queda el orden de siempre.
    expect(sugerirZona([], HOY, equipo, 'cuerpo')).toBe('pecho')
  })

  it('fuera del primer día no sugiere nunca el cuerpo completo', () => {
    const historial = [
      sesion(sumarDias(HOY, -1), [
        ['flexion-completa', 3],
        ['remo-australiano-medio', 3],
        ['sentadilla-completa', 4],
        ['puente-gluteos', 3],
        ['plancha', 3],
        ['flexion-pseudoplancha', 3],
        ['curl-barra', 3],
      ]),
    ]
    expect(ZONAS).toContain(sugerirZona(historial, HOY, equipo))
  })
})

describe('sugerirZona con conTrabajo: nunca un mix vacío', () => {
  const equipo = equipoDe({})
  const conDiscos: readonly Equipo[] = [...equipo, 'discos']
  const ayer = sumarDias(HOY, -1)

  /** El mismo eslabón en las cinco cadenas, con el objetivo en lo bajo de la ventana. */
  function avancesEn(n: number): Map<Patron, Pick<Avance, 'ejercicioId' | 'objetivoActual'>> {
    const avances = new Map<Patron, Pick<Avance, 'ejercicioId' | 'objetivoActual'>>()
    for (const cadena of CADENAS) {
      const id = cadena.ejercicios[Math.min(n, cadena.ejercicios.length) - 1]!
      avances.set(cadena.patron, { ejercicioId: id, objetivoActual: { series: 3, cantidad: POR_ID.get(id)!.ventana.min } })
    }
    return avances
  }
  const enElEslabon = (n: number, conEsto: readonly Equipo[] = equipo): MixConTrabajo =>
    mixesConTrabajo({ avances: avancesEn(n), equipo: conEsto, historial: [], hoy: HOY })

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
  /** Sin nada, cada zona sola, y todas menos una: así cada zona es la menos trabajada en alguno. */
  const HISTORIALES: readonly Sesion[][] = [
    [],
    ...ZONAS.map((zona) => [sesion(ayer, [[DE_LA_ZONA[zona], 3]])]),
    ...ZONAS.map((zona) => [
      sesion(
        ayer,
        ZONAS.filter((z) => z !== zona).map((z): Registro => [DE_LA_ZONA[z], 3]),
      ),
    ]),
  ]
  const EXCEPTOS: readonly (Sector | undefined)[] = [undefined, ...SECTORES]

  /** Todo lo que sugiere en cada historial y con cada `excepto`. */
  const sugeridas = (conEsto: readonly Equipo[], conTrabajo?: MixConTrabajo) =>
    HISTORIALES.flatMap((historial) => EXCEPTOS.map((excepto) => sugerirZona(historial, HOY, conEsto, excepto, conTrabajo)))

  it('en el eslabón 1, sin discos, nunca Hombros ni Brazos, que serían la entrada sola', () => {
    const hay = enElEslabon(1)
    expect(hay('hombros')).toBe(false)
    expect(hay('brazos')).toBe(false)
    // Sin conTrabajo sí aparecen: es lo que había que arreglar.
    const antes = sugeridas(equipo)
    expect(antes).toContain('hombros')
    expect(antes).toContain('brazos')

    const ahora = sugeridas(equipo, hay)
    expect(ahora).not.toContain('hombros')
    expect(ahora).not.toContain('brazos')
    // Y lo que sugiere siempre tiene algo que hacer.
    for (const sector of ahora) expect(hay(sector), sector).toBe(true)
  })

  it('con discos, o desde el eslabón 2, Hombros y Brazos vuelven', () => {
    for (const [conEsto, hay] of [
      [conDiscos, enElEslabon(1, conDiscos)],
      [equipo, enElEslabon(2)],
    ] as const) {
      const ahora = sugeridas(conEsto, hay)
      expect(ahora).toContain('hombros')
      expect(ahora).toContain('brazos')
    }
  })

  it('el primer día sigue siendo el cuerpo completo, si tiene trabajo', () => {
    expect(sugerirZona([], HOY, equipo, undefined, enElEslabon(1))).toBe('cuerpo')
    // Sin trabajo en el cuerpo completo, se busca entre las zonas, y si
    // nada tiene, queda el cuerpo completo para que quien llama lo pregunte.
    expect(sugerirZona([], HOY, equipo, undefined, (s) => s !== 'cuerpo')).toBe('pecho')
    expect(sugerirZona([], HOY, equipo, undefined, () => false)).toBe('cuerpo')
  })

  it('si todo tiene trabajo, sugiere lo mismo que sin conTrabajo', () => {
    expect(sugeridas(equipo, () => true)).toEqual(sugeridas(equipo))
    expect(sugeridas(equipo, enElEslabon(5))).toEqual(sugeridas(equipo))
  })
})

describe('zonaSinSeries', () => {
  it('sin historial, ninguna zona tiene series, y el cuerpo completo tampoco', () => {
    for (const sector of SECTORES) expect(zonaSinSeries(sector, []), sector).toBe(true)
  })

  it('1,5 series de hombro de adelante no hacen un día de Hombros, pero son series', () => {
    // Tres flexiones: medio aporte al deltoide anterior en cada una.
    const historial = [sesion(sumarDias(HOY, -2), [['flexion-completa', 3]])]
    expect(seriesDeZona('hombros', historial, HOY)).toBe(1.5)
    expect(ultimaVezDeZona('hombros', historial)).toBeNull()
    // "Hombros: no hay sesiones anotadas todavía." sería falso.
    expect(zonaSinSeries('hombros', historial)).toBe(false)
    expect(zonaSinSeries('pecho', historial)).toBe(false)
    expect(zonaSinSeries('piernas', historial)).toBe(true)
    // El 0,25 de glúteo de la flexión no es dosis.
    expect(zonaSinSeries('gluteos', historial)).toBe(true)
    expect(zonaSinSeries('cuerpo', historial)).toBe(false)
  })

  it('la movilidad y la entrada en calor no son series de nada', () => {
    const historial = [movilidad(HOY), sesion(HOY, [['flexion-completa', 2, { calentamiento: true }]])]
    for (const sector of SECTORES) expect(zonaSinSeries(sector, historial), sector).toBe(true)
  })

  it('no tiene ventana: lo de hace dos meses sigue contando, como en ultimaVezDeZona', () => {
    const historial = [sesion(sumarDias(HOY, -60), [['plancha', 1]])]
    expect(seriesDeZona('core', historial, HOY)).toBe(0)
    expect(zonaSinSeries('core', historial)).toBe(false)
  })

  it('con una última vez, nunca dice que no hay series', () => {
    const historiales = [
      [sesion(HOY, [['flexion-completa', 3]])],
      [sesion(sumarDias(HOY, -5), [['puente-gluteos', 3]]), sesion(HOY, [['sentadilla-completa', 3]])],
      [sesion(sumarDias(HOY, -40), [['remo-australiano-medio', 4], ['plancha', 1]]), movilidad(HOY)],
    ]
    for (const historial of historiales) {
      for (const zona of ZONAS) {
        if (ultimaVezDeZona(zona, historial) !== null) expect(zonaSinSeries(zona, historial), zona).toBe(false)
      }
    }
  })
})
