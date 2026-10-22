import { describe, expect, it } from 'vitest'
import { EJERCICIOS } from './biblioteca'
import { RAFAGAS } from './metabolico'
import {
  MOVILIDAD,
  MOVILIDAD_POR_ID,
  MOVILIDAD_POR_SECTOR,
  PARA_QUE_SIRVE,
  buscarMovilidad,
  esFichaDeMovilidad,
  movilidadDe,
  movilidadParaEntrada,
  type FichaMovilidad,
} from './movilidad'
import { loProhibido } from './palabras'
import type { Equipo, Sector } from './tipos'

/**
 * Que las doce fichas sean las de `catalogo.md` y que la movilidad de cada
 * zona sea la de §6.4.
 *
 * Lo que puede salir mal acá no se ve en una pantalla hasta que alguien lo
 * hace: un estiramiento sostenido en la entrada en calor de un mix, una zona
 * que arranca una movilidad vacía, un id que pisa el de un ejercicio y hace
 * que el historial confunda una cosa con la otra. Por eso las tablas van
 * escritas a mano y no calculadas: si alguien cambia un dato, la que falla es
 * la línea de ese dato.
 */

const SECTORES: Sector[] = [
  'pecho',
  'espalda',
  'hombros',
  'brazos',
  'core',
  'piernas',
  'gluteos',
  'cuerpo',
]

const nombres = (fichas: readonly FichaMovilidad[]) => fichas.map((f) => f.nombre)

/** La dosis como la escribe `catalogo.md`, para comparar contra la tabla. */
const dicha = (f: FichaMovilidad) => {
  const unidad = f.medida === 'segundos' ? ' s' : ''
  const lado = f.porLado ? ' por lado' : ''
  return `${f.dosis.series} × ${f.dosis.cantidad}${unidad}${lado}`
}

/** Todo lo que una ficha le dice a la persona. */
const textos = (f: FichaMovilidad) => [f.nombre, f.zona, f.conviene, f.tecnica, f.error]

/** Para `it.each`: el id en el título y la ficha en el cuerpo. */
const CADA_FICHA = MOVILIDAD.map((f) => [f.id, f] as const)

describe('las doce fichas de catalogo.md', () => {
  it('son doce, con los ids de §6.1 y en el orden M1 a M12', () => {
    expect(MOVILIDAD.map((f) => f.id)).toEqual([
      'munecas-cuatro-patas',
      'gato-vaca',
      'libro-abierto',
      'zancada-rotacion',
      'sentadilla-profunda-sostenida',
      'rodilla-pared',
      'pasaje-hombros',
      'cadera-90-90',
      'flexor-cadera-arrodillado',
      'pectoral-marco',
      'perro-cobra',
      'isquios-toalla',
    ])
  })

  it('cada id es único, en kebab-case y está en el índice', () => {
    const ids = MOVILIDAD.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(MOVILIDAD_POR_ID.get(id)?.id).toBe(id)
    }
    expect(MOVILIDAD_POR_ID.size).toBe(12)
  })

  it('ningún id pisa el de un ejercicio de fuerza ni el de una ráfaga', () => {
    // Comparten `PasoDeRutina.ejercicioId` y el catálogo: si un id fuera de
    // las dos colecciones, una sesión de movilidad se leería como fuerza.
    const deFuerza = new Set(EJERCICIOS.map((e) => e.id))
    const deRafaga = new Set(RAFAGAS.map((r) => r.id))
    for (const { id } of MOVILIDAD) {
      expect(deFuerza.has(id), id).toBe(false)
      expect(deRafaga.has(id), id).toBe(false)
    }
  })

  it('cada nombre es único', () => {
    const todos = nombres(MOVILIDAD)
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('esFichaDeMovilidad y buscarMovilidad distinguen las fichas de los ejercicios', () => {
    for (const { id } of MOVILIDAD) {
      expect(esFichaDeMovilidad(id), id).toBe(true)
      expect(buscarMovilidad(id)?.id).toBe(id)
    }
    for (const { id } of EJERCICIOS) expect(esFichaDeMovilidad(id), id).toBe(false)
    expect(buscarMovilidad('no-existe')).toBeUndefined()
  })
})

describe('la dosis', () => {
  it('da esta tabla exacta: lo más bajo de cada rango de catalogo.md', () => {
    expect(Object.fromEntries(MOVILIDAD.map((f) => [f.id, dicha(f)]))).toEqual({
      'munecas-cuatro-patas': '2 × 10',
      'gato-vaca': '1 × 8',
      'libro-abierto': '1 × 6 por lado',
      'zancada-rotacion': '1 × 4 por lado',
      'sentadilla-profunda-sostenida': '2 × 20 s',
      'rodilla-pared': '1 × 10 por lado',
      'pasaje-hombros': '1 × 8',
      'cadera-90-90': '1 × 6',
      'flexor-cadera-arrodillado': '2 × 30 s por lado',
      'pectoral-marco': '2 × 30 s por lado',
      'perro-cobra': '1 × 6',
      'isquios-toalla': '2 × 30 s por lado',
    })
  })

  it('coincide con lo que escriben las entradas de los mixes en catalogo.md §3', () => {
    // Piernas: "Rodilla a la pared 10 por lado; sentadilla profunda 2 × 20 s;
    // zancada con rotación 4 por lado". Espalda: "Pasaje de hombros 1 × 8".
    expect(dicha(buscarMovilidad('rodilla-pared')!)).toBe('1 × 10 por lado')
    expect(dicha(buscarMovilidad('sentadilla-profunda-sostenida')!)).toBe('2 × 20 s')
    expect(dicha(buscarMovilidad('zancada-rotacion')!)).toBe('1 × 4 por lado')
    expect(dicha(buscarMovilidad('pasaje-hombros')!)).toBe('1 × 8')
  })

  it.each(CADA_FICHA)('%s tiene una dosis que se puede correr', (_id, f) => {
    // Enteros, porque la sesión los cuenta de a uno y `RegistroMovilidad`
    // guarda una cifra por serie. Y con los techos de las fichas de fuerza:
    // 15 repeticiones o 30 segundos.
    expect(Number.isInteger(f.dosis.series)).toBe(true)
    expect(Number.isInteger(f.dosis.cantidad)).toBe(true)
    expect(f.dosis.series).toBeGreaterThanOrEqual(1)
    expect(f.dosis.series).toBeLessThanOrEqual(3)
    if (f.medida === 'segundos') {
      expect(f.dosis.cantidad).toBeGreaterThanOrEqual(20)
      expect(f.dosis.cantidad).toBeLessThanOrEqual(30)
    } else {
      expect(f.dosis.cantidad).toBeGreaterThanOrEqual(4)
      expect(f.dosis.cantidad).toBeLessThanOrEqual(15)
    }
  })

  it('los estiramientos de después se sostienen: van en segundos', () => {
    for (const f of MOVILIDAD.filter((f) => f.despues)) expect(f.medida, f.id).toBe('segundos')
  })
})

describe('la movilidad de cada zona (§6.4)', () => {
  it('es la tabla de §6.4, tal cual y en su orden', () => {
    const tabla = Object.fromEntries(SECTORES.map((s) => [s, nombres(movilidadDe(s))]))
    expect(tabla).toEqual({
      pecho: [
        'Muñecas en cuatro patas',
        'Pectoral en el marco de la puerta',
        'Perro boca abajo a cobra',
      ],
      espalda: ['Gato y vaca', 'Libro abierto', 'Pasaje de hombros con toalla'],
      hombros: ['Muñecas en cuatro patas', 'Pasaje de hombros con toalla', 'Libro abierto'],
      brazos: [
        'Muñecas en cuatro patas',
        'Pasaje de hombros con toalla',
        'Pectoral en el marco de la puerta',
      ],
      core: ['Gato y vaca', 'Perro boca abajo a cobra', 'Flexor de cadera arrodillado'],
      piernas: ['Rodilla a la pared', 'Sentadilla profunda sostenida', 'Zancada con rotación'],
      gluteos: ['Cadera 90/90', 'Zancada con rotación', 'Flexor de cadera arrodillado'],
      cuerpo: [
        'Gato y vaca',
        'Zancada con rotación',
        'Pasaje de hombros con toalla',
        'Perro boca abajo a cobra',
      ],
    })
  })

  it.each(SECTORES)('%s: cada id es una ficha que existe, sin repetir', (sector) => {
    const ids = MOVILIDAD_POR_SECTOR[sector]
    expect(ids.length).toBeGreaterThanOrEqual(3)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(MOVILIDAD_POR_ID.has(id), `${sector}: ${id}`).toBe(true)
    // Ninguna se pierde al resolver: la sesión tiene tantas fichas como ids.
    expect(movilidadDe(sector)).toHaveLength(ids.length)
  })

  it('las ocho zonas tienen su fila y no hay otras', () => {
    expect(Object.keys(MOVILIDAD_POR_SECTOR).sort()).toEqual([...SECTORES].sort())
  })

  it("'todo' es la fila de todo el cuerpo, la misma que cuerpo", () => {
    expect(movilidadDe('todo')).toEqual(movilidadDe('cuerpo'))
  })

  it('la sesión de una zona lleva también los estiramientos de después', () => {
    expect(movilidadDe('pecho').map((f) => f.id)).toContain('pectoral-marco')
    expect(movilidadDe('core').map((f) => f.id)).toContain('flexor-cadera-arrodillado')
  })

  it('isquios con toalla es la única ficha que la tabla no pone en ninguna zona', () => {
    // La tabla de §6.4 la deja afuera; se llega desde el catálogo y desde el
    // Final de una rutina. Si alguien la suma a una fila, esta línea cambia.
    const enAlgunaZona = new Set(SECTORES.flatMap((s) => MOVILIDAD_POR_SECTOR[s]))
    expect(MOVILIDAD.filter((f) => !enAlgunaZona.has(f.id)).map((f) => f.id)).toEqual([
      'isquios-toalla',
    ])
  })

  it('una zona que no existe da una movilidad vacía, sin romper', () => {
    const inventada = 'rodillas' as Sector
    expect(movilidadDe(inventada)).toEqual([])
    expect(movilidadDe('toString' as Sector)).toEqual([])
    expect(movilidadParaEntrada([inventada, 'pecho']).map((f) => f.id)).toEqual([
      'munecas-cuatro-patas',
      'perro-cobra',
    ])
  })

  it('lo que devuelve es una copia: tocarlo no cambia la tabla', () => {
    const sesion = movilidadDe('pecho')
    sesion.pop()
    expect(movilidadDe('pecho')).toHaveLength(3)
  })
})

describe('las zonas de cada ficha', () => {
  it.each(CADA_FICHA)('%s: zonas que existen, sin repetir', (_id, f) => {
    expect(f.cuando.length).toBeGreaterThanOrEqual(1)
    expect(new Set(f.cuando).size).toBe(f.cuando.length)
    for (const s of f.cuando) expect(SECTORES).toContain(s)
  })

  it('una ficha que la tabla pone en una zona va con esa zona', () => {
    // `cuando` puede tener más zonas que la tabla, nunca menos: si la sesión
    // de Brazos la lleva, al buscar por Brazos tiene que aparecer.
    for (const sector of SECTORES) {
      for (const ficha of movilidadDe(sector)) {
        expect(ficha.cuando, `${ficha.id} en ${sector}`).toContain(sector)
      }
    }
  })
})

describe('antes y después', () => {
  it('después son exactamente los tres estiramientos de §6.4', () => {
    expect(MOVILIDAD.filter((f) => f.despues).map((f) => f.id)).toEqual([
      'flexor-cadera-arrodillado',
      'pectoral-marco',
      'isquios-toalla',
    ])
  })

  it.each(SECTORES)('%s: la entrada es su fila sin los de después, en su orden', (sector) => {
    const esperada = movilidadDe(sector).filter((f) => !f.despues)
    const entrada = movilidadParaEntrada([sector])
    expect(entrada).toEqual(esperada)
    expect(entrada.length).toBeGreaterThanOrEqual(2)
    expect(entrada.some((f) => f.despues)).toBe(false)
  })

  it('ninguna combinación de zonas mete un estiramiento de después en la entrada', () => {
    // Las 255 combinaciones no vacías de las ocho zonas: el Constructor suma
    // la movilidad de todas las zonas que trabaja la rutina.
    for (let mascara = 1; mascara < 1 << SECTORES.length; mascara++) {
      const zonas = SECTORES.filter((_, i) => mascara & (1 << i))
      const entrada = movilidadParaEntrada(zonas)
      expect(entrada.some((f) => f.despues), zonas.join(', ')).toBe(false)
      const ids = entrada.map((f) => f.id)
      expect(new Set(ids).size, zonas.join(', ')).toBe(ids.length)
    }
  })

  it('con varias zonas suma sin repetir, en el orden de las zonas', () => {
    expect(movilidadParaEntrada(['pecho', 'hombros']).map((f) => f.id)).toEqual([
      'munecas-cuatro-patas',
      'perro-cobra',
      'pasaje-hombros',
      'libro-abierto',
    ])
  })

  it('sin zonas, no hay entrada', () => {
    expect(movilidadParaEntrada([])).toEqual([])
  })
})

describe('lo que dicen las fichas', () => {
  it('nada de PROHIBIDAS, en ninguna ficha ni en la frase de para qué sirve', () => {
    for (const f of MOVILIDAD) {
      for (const texto of textos(f)) expect(loProhibido(texto), `${f.id}: ${texto}`).toBeNull()
    }
    expect(loProhibido(PARA_QUE_SIRVE)).toBeNull()
  })

  it('nunca dice que previene lesiones', () => {
    // Lo mismo que busca el portón del catálogo: estirar no lo mostró.
    for (const texto of [...MOVILIDAD.flatMap(textos), PARA_QUE_SIRVE]) {
      expect(texto, texto).not.toMatch(/previen|lesi/i)
    }
    expect(PARA_QUE_SIRVE).toBe('Para moverte con comodidad y llegar al recorrido.')
  })

  it('sin signos de exclamación', () => {
    for (const texto of MOVILIDAD.flatMap(textos)) expect(texto, texto).not.toMatch(/[!¡]/)
  })

  it('la persona no es sujeto de un adjetivo con género', () => {
    // §7.1: ni cansado, ni listo, ni preparado, ni seguro, ni solo. El "o
    // solo" de catalogo.md va como "o aparte".
    const conGenero = /(?<![\p{L}\p{N}])(cansad|list|preparad|segur|sol)[oa]s?(?![\p{L}\p{N}])/iu
    for (const texto of MOVILIDAD.flatMap(textos)) expect(texto, texto).not.toMatch(conGenero)
  })

  it.each(CADA_FICHA)('%s: los textos están completos', (_id, f) => {
    expect(f.zona.length).toBeGreaterThan(3)
    expect(f.zona).toMatch(/^\p{Lu}/u)
    expect(f.conviene).toMatch(/^\p{Lu}.*\.$/u)
    expect(f.conviene.length).toBeLessThanOrEqual(140)
    expect(f.tecnica).toMatch(/^\p{Lu}.*\.$/u)
    expect(f.tecnica.length).toBeGreaterThan(60)
    expect(f.error).toMatch(/^\p{Lu}.*\.$/u)
  })

  it('un estiramiento de después dice después en cuándo conviene, y los otros no', () => {
    for (const f of MOVILIDAD) {
      expect(f.conviene.startsWith('Después'), f.id).toBe(f.despues === true)
    }
  })
})

describe('el equipo', () => {
  it('cada ficha dice lo que pide, y todo se da por tenido', () => {
    // Los de §6.5. Ninguna ficha de movilidad queda afuera por equipo.
    const dados: Equipo[] = ['nada', 'silla', 'pared', 'marco', 'toalla', 'objetos', 'barra-baja']
    for (const f of MOVILIDAD) {
      expect(f.equipo.length, f.id).toBeGreaterThanOrEqual(1)
      for (const e of f.equipo) expect(dados, `${f.id}: ${e}`).toContain(e)
    }
  })

  it('el marco y la toalla están donde la técnica los pide', () => {
    expect(buscarMovilidad('pectoral-marco')!.equipo).toEqual(['marco'])
    expect(buscarMovilidad('pasaje-hombros')!.equipo).toEqual(['toalla'])
    expect(buscarMovilidad('isquios-toalla')!.equipo).toEqual(['toalla'])
    expect(buscarMovilidad('rodilla-pared')!.equipo).toEqual(['pared'])
  })
})
