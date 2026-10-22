import { describe, expect, it } from 'vitest'
import { eslabonesCerrados } from './apertura'
import * as biblioteca from './biblioteca'
import { CADENAS, EJERCICIOS, FUERA_DE_CADENA, POR_ID, REQUISITOS, cadenaDe } from './biblioteca'
import {
  AGRUPACIONES,
  BANDAS,
  ITEMS,
  NOMBRE_DE_LOS_REQUISITOS_DE_HISTORIAL,
  NOMBRE_EQUIPO,
  agruparCatalogo,
  apareceEn,
  buscar,
  buscarItem,
  cifraDelCatalogo,
  claseDeEjercicio,
  esAgrupacion,
  filtrarCatalogo,
  hayFiltros,
  itemDeEjercicio,
  leerRequisitosDeHistorial,
  nivelDe,
  requisitoCumplido,
  requisitosDe,
  requisitosSinCumplir,
  textoBuscable,
  vecinos,
  type GrupoDelCatalogo,
  type RequisitoDeHistorial,
} from './catalogo'
import { EQUIPOS, alcanza, equipoDe } from './equipo'
import { IDS_DE_LOS_MIXES, MIXES, resolverMix } from './mixes'
import { MOVILIDAD } from './movilidad'
import { APORTE, MUSCULOS_CUBIERTOS, type Vector } from './musculos'
import { loProhibido } from './palabras'
import { ZONAS, ejerciciosDeZona } from './sectores'
import type {
  Avance,
  Ejercicio,
  Patron,
  PasoDeRutina,
  RegistroEjercicio,
  RutinaPropia,
  Sesion,
} from './tipos'

/**
 * El catálogo es lo que la persona recorre para elegir: lo que no se puede
 * romper sin que nadie lo note es que un ejercicio desaparezca al cambiar de
 * agrupado, que el buscador pida tildes, que un filtro sume donde tenía que
 * combinar, o que un requisito se dé por cumplido sin estarlo. Eso es lo que
 * se prueba acá, con la biblioteca de verdad donde alcanza y con fichas de
 * prueba donde la ola 1 todavía no llegó (variantes y accesorios).
 */

const ids = (items: readonly { id: string }[]) => items.map((i) => i.id)
const idsDe = (grupo: GrupoDelCatalogo | undefined) => (grupo?.filas ?? []).map((f) => f.item.id)
const grupo = (grupos: GrupoDelCatalogo[], clave: string) => grupos.find((g) => g.clave === clave)
const ejercicio = (id: string) => POR_ID.get(id)!

/** Una ficha de fuerza de prueba, con lo mínimo que el tipo pide. */
function ficha(id: string, mas: Partial<Ejercicio> = {}): Ejercicio {
  return {
    id,
    nombre: id,
    patron: 'empuje',
    medida: 'repeticiones',
    nivel: 1,
    resumen: 'Una ficha de prueba para el catálogo.',
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

function avance(patron: Patron, ejercicioId: string, series = 3, cantidad = 8): Avance {
  return {
    patron,
    ejercicioId,
    objetivoActual: { series, cantidad },
    senal: 1,
    sesionesEnObjetivo: 0,
    graciaRestante: 0,
    actualizadoEn: 0,
  }
}

const avances = (...lista: Avance[]) => new Map(lista.map((a) => [a.patron, a]))

type Registro = [ejercicioId: string, logrado: number[], extra?: Partial<RegistroEjercicio>]

let siguiente = 0
/** Una sesión con estos registros: cada uno, el ejercicio y lo logrado en cada serie. */
function sesion(registros: Registro[]): Sesion {
  siguiente++
  return {
    id: `s${siguiente}`,
    fecha: '2026-10-21',
    finalizadaEn: new Date(2026, 9, 21, 10, 0).getTime(),
    duracionSegundos: 1800,
    tipo: 'plan',
    registros: registros.map(([ejercicioId, logrado, mas]) => ({
      ejercicioId,
      objetivo: { series: logrado.length, cantidad: 30 },
      series: logrado.map((l) => ({ logrado: l })),
      ...mas,
    })),
  }
}

describe('los ítems', () => {
  it('son la fuerza en el orden de la biblioteca y después la movilidad en el de catalogo.md', () => {
    expect(ids(ITEMS)).toEqual([...EJERCICIOS.map((e) => e.id), ...MOVILIDAD.map((f) => f.id)])
    expect(ITEMS.filter((i) => i.clase === 'fuerza')).toHaveLength(EJERCICIOS.length)
    expect(ITEMS.filter((i) => i.clase === 'movilidad')).toHaveLength(12)
  })

  it('no repiten un id: fuerza y movilidad conviven en la misma ruta', () => {
    expect(new Set(ids(ITEMS)).size).toBe(ITEMS.length)
  })

  it('cada uno dice qué pide, que es lo que filtran EQUIPO y "Con lo que tengo"', () => {
    for (const item of ITEMS) expect(item.equipo.length, item.id).toBeGreaterThan(0)
  })

  it('se encuentran por id, los dos tipos', () => {
    expect(buscarItem('flexion-completa')?.clase).toBe('fuerza')
    expect(buscarItem('gato-vaca')?.clase).toBe('movilidad')
    expect(buscarItem('no-existe')).toBeUndefined()
  })
})

describe('la cifra del catálogo', () => {
  it('con las dos clases, el total y el desglose', () => {
    expect(cifraDelCatalogo(ITEMS)).toBe(
      `${ITEMS.length} ejercicios · ${EJERCICIOS.length} de fuerza y 12 de movilidad`,
    )
  })

  it('con una sola clase, sin desglose que nombre un cero', () => {
    const remos = buscar('remo', ITEMS)
    expect(cifraDelCatalogo(remos)).toBe(`${remos.length} ejercicios`)
    expect(cifraDelCatalogo(ITEMS.filter((i) => i.clase === 'movilidad'))).toBe('12 ejercicios')
  })

  it('en singular con uno, y null sin ninguno', () => {
    expect(cifraDelCatalogo(ITEMS.slice(0, 1))).toBe('1 ejercicio')
    expect(cifraDelCatalogo([])).toBeNull()
  })

  it('sin PROHIBIDAS ni signos de exclamación', () => {
    for (const items of [ITEMS, ITEMS.slice(0, 1), buscar('remo', ITEMS)]) {
      const cifra = cifraDelCatalogo(items) ?? ''
      expect(loProhibido(cifra)).toBeNull()
      expect(cifra).not.toMatch(/[!¡]/)
    }
  })
})

describe('textoBuscable', () => {
  it('sin tildes, sin diéresis, la eñe como ene y en minúsculas', () => {
    expect(textoBuscable('Flexión')).toBe('flexion')
    expect(textoBuscable('FLEXIÓN')).toBe('flexion')
    expect(textoBuscable('Muñecas')).toBe('munecas')
    expect(textoBuscable('Pingüino')).toBe('pinguino')
  })

  it('da lo mismo con un texto que llegó ya descompuesto', () => {
    expect(textoBuscable('Flexión')).toBe(textoBuscable('Flexión'))
  })

  it('colapsa los espacios de más y recorta las puntas', () => {
    expect(textoBuscable('  Sentadilla   BÚLGARA ')).toBe('sentadilla bulgara')
  })
})

describe('buscar', () => {
  it('sin nada escrito devuelve todo, en una lista nueva', () => {
    const todo = buscar('', ITEMS)
    expect(ids(todo)).toEqual(ids(ITEMS))
    expect(todo).not.toBe(ITEMS)
    expect(buscar('   ', ITEMS)).toHaveLength(ITEMS.length)
  })

  it('sin importar tildes ni mayúsculas', () => {
    const sinTilde = ids(buscar('flexion', ITEMS))
    expect(sinTilde).toContain('flexion-completa')
    expect(ids(buscar('FLEXIÓN', ITEMS))).toEqual(sinTilde)
    expect(ids(buscar('flexión', ITEMS))).toEqual(sinTilde)
    expect(ids(buscar('munecas', ITEMS))).toEqual(['munecas-cuatro-patas'])
  })

  it('"remo" trae los remos y nada que no se llame así', () => {
    const remos = buscar('remo', ITEMS)
    for (const id of [
      'remo-australiano-alto',
      'remo-australiano-medio',
      'remo-australiano-bajo',
      'remo-australiano-pies-elevados',
      'remo-barra',
    ]) {
      expect(ids(remos)).toContain(id)
    }
    for (const item of remos) expect(textoBuscable(item.nombre)).toContain('remo')
  })

  it('cada palabra en cualquier orden, y por alias', () => {
    expect(ids(buscar('bajo remo', ITEMS))).toEqual(['remo-australiano-bajo'])
    const pica = itemDeEjercicio(ficha('pica-de-prueba', { nombre: 'Flexión pica', alias: ['Pike'] }))
    const conPica = [...ITEMS, pica]
    expect(ids(buscar('pike', conPica))).toEqual(['pica-de-prueba'])
    expect(ids(buscar('PIKE flexion', conPica))).toEqual(['pica-de-prueba'])
  })

  it('lo que no está no trae nada', () => {
    expect(buscar('remoo', ITEMS)).toEqual([])
  })

  it('busca rutinas con la misma regla', () => {
    const rutinas = [{ nombre: 'Pecho en casa' }, { nombre: 'Piernas del jueves' }]
    expect(buscar('pecho', rutinas)).toEqual([{ nombre: 'Pecho en casa' }])
    expect(buscar('JUEVES piernas', rutinas)).toEqual([{ nombre: 'Piernas del jueves' }])
  })
})

describe('nivelDe', () => {
  it('el grado, si lo tiene, aunque tenga equivale', () => {
    expect(nivelDe({ id: 'x', grado: 3 })).toBe(3)
    expect(nivelDe({ id: 'x', grado: 1, equivale: { patron: 'empuje', nivel: 9 } })).toBe(1)
  })

  it('en una variante, la banda de su eslabón equivalente', () => {
    expect(nivelDe({ id: 'x', equivale: { patron: 'empuje', nivel: 4 } })).toBe(1)
    expect(nivelDe({ id: 'x', equivale: { patron: 'empuje', nivel: 6 } })).toBe(2)
    expect(nivelDe({ id: 'x', equivale: { patron: 'empuje', nivel: 8 } })).toBe(3)
    expect(nivelDe({ id: 'x', equivale: { patron: 'bisagra', nivel: 5 } })).toBe(2)
    expect(nivelDe({ id: 'x', equivale: { patron: 'bisagra', nivel: 6 } })).toBe(3)
  })

  it('en un eslabón, la banda por su lugar en la cadena: la tabla de catalogo.md §3', () => {
    const porBanda = (patron: Patron) => {
      const cuenta = [0, 0, 0]
      for (const id of cadenaDe(patron).ejercicios) cuenta[nivelDe(ejercicio(id)) - 1]!++
      return cuenta
    }
    expect(porBanda('empuje')).toEqual([4, 3, 4])
    expect(porBanda('traccion')).toEqual([4, 3, 3])
    expect(porBanda('piernas')).toEqual([3, 3, 3])
    expect(porBanda('core')).toEqual([3, 3, 3])
    expect(porBanda('bisagra')).toEqual([3, 2, 3])
  })

  it('en los bordes de cada banda de empuje', () => {
    expect(nivelDe(ejercicio('flexion-inclinada-baja'))).toBe(1)
    expect(nivelDe(ejercicio('flexion-rodillas'))).toBe(2)
    expect(nivelDe(ejercicio('flexion-diamante'))).toBe(2)
    expect(nivelDe(ejercicio('flexion-declinada'))).toBe(3)
  })

  it('cada cadena tiene eslabones en la banda III', () => {
    for (const cadena of CADENAS) {
      expect(BANDAS[cadena.patron].II, cadena.patron).toBeLessThan(cadena.ejercicios.length)
    }
  })

  it('lo que no es eslabón ni variante y no tiene grado, I', () => {
    for (const id of FUERA_DE_CADENA) {
      if (ejercicio(id).grado === undefined) expect(nivelDe(ejercicio(id)), id).toBe(1)
    }
    expect(nivelDe(ficha('accesorio-sin-grado', { accesorio: true }))).toBe(1)
  })
})

describe('la clase de cada ejercicio', () => {
  it('eslabón, variante, con la barra, accesorio o sin cadena', () => {
    const variante = ficha('v', { equivale: { patron: 'empuje', nivel: 6 } })
    expect(claseDeEjercicio(ejercicio('flexion-completa'))).toBe('eslabon')
    expect(claseDeEjercicio(ejercicio('press-militar-barra'))).toBe('con-la-barra')
    expect(claseDeEjercicio(variante)).toBe('variante')
    expect(claseDeEjercicio(ficha('a', { accesorio: true }))).toBe('accesorio')
    expect(claseDeEjercicio(ficha('suelto'))).toBe('sin-cadena')
  })
})

describe('los filtros', () => {
  it('GRUPO trae lo mismo que la lista del Sector, más la movilidad de esa zona', () => {
    for (const zona of ZONAS) {
      const filtrados = filtrarCatalogo(ITEMS, { grupos: [zona] })
      const deFuerza = filtrados.filter((i) => i.clase === 'fuerza')
      const deMovilidad = filtrados.filter((i) => i.clase === 'movilidad')
      expect(ids(deFuerza), zona).toEqual(ids(ejerciciosDeZona(zona)))
      expect(ids(deMovilidad), zona).toEqual(ids(MOVILIDAD.filter((f) => f.cuando.includes(zona))))
    }
  })

  it('dentro de un filtro, las opciones suman: "Espalda o Brazos"', () => {
    const espalda = ids(filtrarCatalogo(ITEMS, { grupos: ['espalda'] }))
    const brazos = ids(filtrarCatalogo(ITEMS, { grupos: ['brazos'] }))
    const juntos = ids(filtrarCatalogo(ITEMS, { grupos: ['espalda', 'brazos'] }))
    expect(new Set(juntos)).toEqual(new Set([...espalda, ...brazos]))
    // Cada zona trae algo que la otra no: el remo es de espalda y no de
    // brazos, la flexión diamante es de brazos (tríceps) y no de espalda.
    expect(espalda).not.toContain('flexion-diamante')
    expect(brazos).not.toContain('remo-australiano-alto')
    expect(juntos).toEqual(expect.arrayContaining(['flexion-diamante', 'remo-australiano-alto']))
    // Y en el orden del catálogo, sin repetir.
    expect(juntos).toEqual(ids(ITEMS).filter((id) => juntos.includes(id)))
  })

  it('entre filtros, se combinan: "Espalda, y además con banda"', () => {
    const conBanda = filtrarCatalogo(ITEMS, { grupos: ['espalda'], equipos: ['banda'] })
    expect(ids(conBanda)).toEqual(['dominada-asistida', 'dominada-asistida-leve'])
  })

  it('una opción de EQUIPO es lo que la usa, no lo que se puede hacer con ella', () => {
    const conBanda = filtrarCatalogo(ITEMS, { equipos: ['banda'] })
    expect(conBanda.length).toBeGreaterThan(0)
    expect(ids(conBanda)).not.toContain('flexion-completa')
    for (const item of conBanda) expect(item.equipo).toContain('banda')
  })

  it('"Con lo que tengo" es lo que alcanza: sin barra, nada colgado', () => {
    const tengo = equipoDe({ tieneBarra: false })
    const filtrados = ids(filtrarCatalogo(ITEMS, { conLoQueTengo: tengo }))
    expect(filtrados).toEqual(ids(ITEMS.filter((i) => alcanza(i, tengo))))
    expect(filtrados).not.toContain('dominada-completa')
    expect(filtrados).not.toContain('dominada-asistida')
    expect(filtrados).toContain('flexion-completa')
    expect(filtrados).toContain('pasaje-hombros')
  })

  it('"Con lo que tengo" acepta el equipo como conjunto, como lo tilda la hoja', () => {
    const tengo = equipoDe({ tieneBarra: false })
    expect(ids(filtrarCatalogo(ITEMS, { conLoQueTengo: new Set(tengo) }))).toEqual(
      ids(filtrarCatalogo(ITEMS, { conLoQueTengo: tengo })),
    )
  })

  it('"Con lo que tengo" y "Banda" suman, porque son opciones del mismo filtro', () => {
    const tengo = equipoDe({ tieneBarra: true })
    const solo = ids(filtrarCatalogo(ITEMS, { conLoQueTengo: tengo }))
    const juntos = ids(filtrarCatalogo(ITEMS, { conLoQueTengo: tengo, equipos: ['banda'] }))
    // Con barra y sin banda, la dominada asistida no alcanza, pero usa banda.
    expect(solo).not.toContain('dominada-asistida')
    expect(juntos).toContain('dominada-asistida')
    expect(juntos).toContain('dominada-completa')
  })

  it('NIVEL deja la fuerza de esas bandas, y la movilidad afuera', () => {
    const uno = filtrarCatalogo(ITEMS, { niveles: [1] })
    expect(uno.length).toBeGreaterThan(0)
    for (const item of uno) {
      expect(item.clase).toBe('fuerza')
      if (item.clase === 'fuerza') expect(nivelDe(item.ejercicio)).toBe(1)
    }
    expect(filtrarCatalogo(ITEMS, { niveles: [1, 2, 3] })).toHaveLength(EJERCICIOS.length)
  })

  it('CADENA trae la escalera y lo que va con ella, sin los de discos ni la movilidad', () => {
    const empuje = ids(filtrarCatalogo(ITEMS, { cadenas: ['empuje'] }))
    for (const id of cadenaDe('empuje').ejercicios) expect(empuje).toContain(id)
    expect(ejercicio('press-militar-barra').patron).toBe('empuje')
    expect(empuje).not.toContain('press-militar-barra')
    expect(empuje.some((id) => MOVILIDAD.some((f) => f.id === id))).toBe(false)
  })

  it('una variante va con la cadena de su equivale y un accesorio con la de su patrón', () => {
    const variante = itemDeEjercicio(
      ficha('variante-de-prueba', { patron: 'empuje', equivale: { patron: 'empuje', nivel: 6 } }),
    )
    const accesorio = itemDeEjercicio(
      ficha('accesorio-de-prueba', { patron: 'core', accesorio: true, grado: 1 }),
    )
    const ambos = [variante, accesorio]
    expect(ids(filtrarCatalogo(ambos, { cadenas: ['empuje'] }))).toEqual(['variante-de-prueba'])
    expect(ids(filtrarCatalogo(ambos, { cadenas: ['core'] }))).toEqual(['accesorio-de-prueba'])
  })

  it('una lista vacía es lo mismo que no tener el filtro', () => {
    const vacios = { grupos: [], equipos: [], conLoQueTengo: [], niveles: [], cadenas: [] }
    expect(filtrarCatalogo(ITEMS, vacios)).toHaveLength(ITEMS.length)
    expect(filtrarCatalogo(ITEMS, {})).toHaveLength(ITEMS.length)
    expect(hayFiltros(vacios)).toBe(false)
    expect(hayFiltros({ conLoQueTengo: new Set() })).toBe(false)
    expect(hayFiltros({ niveles: [2] })).toBe(true)
    expect(hayFiltros({ conLoQueTengo: new Set(['nada']) })).toBe(true)
  })
})

describe('agruparCatalogo', () => {
  const sinAvances = new Map<Patron, Avance>()

  it('por cadena, cada ítem va en un solo grupo: las filas suman lo mismo que la cifra', () => {
    const grupos = agruparCatalogo(ITEMS, 'cadena', sinAvances)
    const filas = grupos.flatMap((g) => idsDe(g))
    expect(filas).toHaveLength(ITEMS.length)
    expect(new Set(filas)).toEqual(new Set(ids(ITEMS)))
  })

  it('por cadena, las cinco escaleras en orden, al final con la barra y la movilidad', () => {
    const grupos = agruparCatalogo(ITEMS, 'cadena', sinAvances)
    expect(grupos.map((g) => g.clave)).toEqual([
      'cadena:empuje',
      'cadena:traccion',
      'cadena:piernas',
      'cadena:core',
      'cadena:bisagra',
      'con-la-barra',
      'movilidad',
    ])
    for (const cadena of CADENAS) {
      const escalera = grupo(grupos, `cadena:${cadena.patron}`)
      expect(idsDe(escalera)).toEqual(cadena.ejercicios)
      expect(escalera?.filas.map((f) => f.eslabon)).toEqual(cadena.ejercicios.map((_, i) => i + 1))
      expect(escalera?.patron).toBe(cadena.patron)
    }
    expect(new Set(idsDe(grupo(grupos, 'con-la-barra')))).toEqual(FUERA_DE_CADENA)
    expect(idsDe(grupo(grupos, 'movilidad'))).toEqual(MOVILIDAD.map((f) => f.id))
  })

  it('una escalera conserva su orden aunque los ítems lleguen desordenados', () => {
    const grupos = agruparCatalogo([...ITEMS].reverse(), 'cadena', sinAvances)
    expect(idsDe(grupo(grupos, 'cadena:core'))).toEqual(cadenaDe('core').ejercicios)
  })

  it('debajo de cada escalera, las variantes por nivel equivalente y después los accesorios', () => {
    const extra = [
      ficha('v-ocho', { equivale: { patron: 'empuje', nivel: 8 } }),
      ficha('a-dos', { accesorio: true, grado: 2 }),
      ficha('v-cinco', { equivale: { patron: 'empuje', nivel: 5 } }),
      ficha('a-uno', { accesorio: true, grado: 1 }),
      ficha('v-traccion', { patron: 'traccion', equivale: { patron: 'traccion', nivel: 3 } }),
      ficha('suelto'),
    ].map(itemDeEjercicio)
    const grupos = agruparCatalogo([...ITEMS, ...extra], 'cadena', sinAvances)
    const tambien = grupo(grupos, 'tambien:empuje')
    expect(tambien?.titulo).toBe('También de empuje')
    expect(idsDe(tambien)).toEqual(['v-cinco', 'v-ocho', 'a-uno', 'a-dos'])
    expect(idsDe(grupo(grupos, 'tambien:traccion'))).toEqual(['v-traccion'])
    expect(idsDe(grupo(grupos, 'sin-cadena'))).toEqual(['suelto'])
    const claves = grupos.map((g) => g.clave)
    expect(claves.indexOf('tambien:empuje')).toBe(claves.indexOf('cadena:empuje') + 1)
    expect(claves.slice(-3)).toEqual(['sin-cadena', 'con-la-barra', 'movilidad'])
  })

  it('marca ESTÁS ACÁ en tu eslabón y YA PASASTE en los de abajo', () => {
    const grupos = agruparCatalogo(ITEMS, 'cadena', avances(avance('empuje', 'flexion-completa')))
    expect(grupo(grupos, 'cadena:empuje')?.filas.map((f) => f.marca)).toEqual([
      'ya-pasaste',
      'ya-pasaste',
      'ya-pasaste',
      'ya-pasaste',
      'ya-pasaste',
      'estas-aca',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ])
    expect(grupo(grupos, 'cadena:traccion')?.filas.every((f) => f.marca === undefined)).toBe(true)
  })

  it('las marcas valen en cualquier agrupado', () => {
    const conAvance = avances(avance('traccion', 'dominada-asistida'))
    const grupos = agruparCatalogo(ITEMS, 'equipo', conAvance)
    const deLaBanda = grupo(grupos, 'equipo:banda')?.filas
    expect(deLaBanda?.find((f) => f.item.id === 'dominada-asistida')?.marca).toBe('estas-aca')
    expect(deLaBanda?.find((f) => f.item.id === 'dominada-asistida-leve')?.marca).toBeUndefined()
    const deLaBarra = grupo(grupos, 'equipo:barra')?.filas
    expect(deLaBarra?.find((f) => f.item.id === 'dominada-negativa')?.marca).toBe('ya-pasaste')
  })

  it('un avance que no está en su cadena no marca nada', () => {
    const raro = avances(avance('empuje', 'remo-australiano-alto'))
    const filas = agruparCatalogo(ITEMS, 'cadena', raro).flatMap((g) => g.filas)
    expect(filas.every((f) => f.marca === undefined)).toBe(true)
  })

  it('por músculo, un ejercicio con dos principales va en los dos', () => {
    const grupos = agruparCatalogo(ITEMS, 'musculo', sinAvances)
    expect(APORTE['flexion-diamante']).toMatchObject({ pectoral: 1, triceps: 1 })
    expect(idsDe(grupo(grupos, 'musculo:pectoral'))).toContain('flexion-diamante')
    expect(idsDe(grupo(grupos, 'musculo:triceps'))).toContain('flexion-diamante')
    expect(idsDe(grupo(grupos, 'musculo:triceps'))).not.toContain('flexion-completa')
  })

  it('por músculo, en el orden de pantalla y con la movilidad aparte, al final', () => {
    const grupos = agruparCatalogo(ITEMS, 'musculo', sinAvances)
    const musculos = grupos
      .filter((g) => g.clave.startsWith('musculo:'))
      .map((g) => g.clave.slice('musculo:'.length))
    expect(musculos).toEqual(MUSCULOS_CUBIERTOS.filter((m) => musculos.includes(m)))
    expect(grupos.at(-1)?.clave).toBe('movilidad')
    expect(grupo(grupos, 'musculo:ninguno')).toBeUndefined()
    for (const g of grupos.slice(0, -1)) {
      expect(g.filas.every((f) => f.item.clase === 'fuerza'), g.clave).toBe(true)
    }
  })

  it('por equipo, un ejercicio con dos equipos va en los dos', () => {
    const grupos = agruparCatalogo(ITEMS, 'equipo', sinAvances)
    expect(idsDe(grupo(grupos, 'equipo:barra'))).toContain('dominada-asistida')
    expect(idsDe(grupo(grupos, 'equipo:banda'))).toContain('dominada-asistida')
    expect(idsDe(grupo(grupos, 'equipo:barra-baja'))).toContain('remo-australiano-pies-elevados')
    expect(idsDe(grupo(grupos, 'equipo:silla'))).toContain('remo-australiano-pies-elevados')
  })

  it('por equipo, en el orden de EQUIPOS, con la movilidad en el suyo y nadie sin grupo', () => {
    const grupos = agruparCatalogo(ITEMS, 'equipo', sinAvances)
    const claves = grupos.map((g) => g.clave)
    const enOrden = EQUIPOS.map((e) => `equipo:${e}`).filter((c) => claves.includes(c))
    expect(claves).toEqual(enOrden)
    expect(idsDe(grupo(grupos, 'equipo:toalla'))).toEqual(
      expect.arrayContaining(['curl-talones-deslizando', 'pasaje-hombros']),
    )
    expect(grupo(grupos, 'equipo:toalla')?.titulo).toBe('Toalla')
    expect(new Set(grupos.flatMap((g) => idsDe(g)))).toEqual(new Set(ids(ITEMS)))
  })

  it('por nivel, I, II y III, y la movilidad aparte', () => {
    const grupos = agruparCatalogo(ITEMS, 'nivel', sinAvances)
    expect(grupos.map((g) => g.clave)).toEqual(['nivel:1', 'nivel:2', 'nivel:3', 'movilidad'])
    expect(grupos.map((g) => g.titulo)).toEqual(['Nivel I', 'Nivel II', 'Nivel III', 'Movilidad'])
    expect(grupos.slice(0, 3).flatMap((g) => idsDe(g))).toHaveLength(EJERCICIOS.length)
    expect(idsDe(grupo(grupos, 'nivel:3'))).toContain('flexion-una-mano')
  })

  it('un grupo sin filas no aparece', () => {
    const conBanda = filtrarCatalogo(ITEMS, { equipos: ['banda'] })
    const claves = (por: 'equipo' | 'cadena') =>
      agruparCatalogo(conBanda, por, sinAvances).map((g) => g.clave)
    expect(claves('equipo')).toEqual(['equipo:barra', 'equipo:banda'])
    expect(claves('cadena')).toEqual(['cadena:traccion'])
    expect(agruparCatalogo([], 'nivel', sinAvances)).toEqual([])
  })

  it('un ejercicio sin el dato de su agrupado va a un grupo que lo dice, no desaparece', () => {
    const sinNada = [itemDeEjercicio(ficha('sin-datos', { equipo: [] }))]
    const porMusculo = agruparCatalogo(sinNada, 'musculo', sinAvances)
    const porEquipo = agruparCatalogo(sinNada, 'equipo', sinAvances)
    expect(idsDe(grupo(porMusculo, 'musculo:ninguno'))).toEqual(['sin-datos'])
    expect(idsDe(grupo(porEquipo, 'equipo:ninguno'))).toEqual(['sin-datos'])
  })

  it('las claves no se repiten dentro de un agrupado', () => {
    for (const por of AGRUPACIONES) {
      const grupos = agruparCatalogo(ITEMS, por, sinAvances)
      expect(new Set(grupos.map((g) => g.clave)).size, por).toBe(grupos.length)
    }
  })
})

describe('las formas de agrupar', () => {
  it('son las cuatro de la regleta, en su orden', () => {
    expect([...AGRUPACIONES]).toEqual(['cadena', 'musculo', 'equipo', 'nivel'])
  })

  it('lo que llega por la URL se valida', () => {
    expect(esAgrupacion('musculo')).toBe(true)
    expect(esAgrupacion('zona')).toBe(false)
    expect(esAgrupacion(undefined)).toBe(false)
  })
})

describe('vecinos', () => {
  it('en un eslabón, el anterior y el siguiente de su cadena', () => {
    expect(vecinos('dominada-completa')).toEqual({
      masFacil: ejercicio('dominada-asistida-leve'),
      masDificil: ejercicio('dominada-arquera'),
    })
  })

  it('en las puntas de una cadena, null de ese lado', () => {
    expect(vecinos('flexion-pared').masFacil).toBeNull()
    expect(vecinos('flexion-pared').masDificil?.id).toBe('flexion-inclinada-alta')
    expect(vecinos('flexion-una-mano').masDificil).toBeNull()
    expect(vecinos('curl-nordico').masDificil).toBeNull()
  })

  it('la movilidad y un id que no existe no tienen', () => {
    expect(vecinos('gato-vaca')).toEqual({ masFacil: null, masDificil: null })
    expect(vecinos('no-existe')).toEqual({ masFacil: null, masDificil: null })
  })

  describe('en una variante, por nivel equivalente', () => {
    const variante = (id: string, nivel: number, patron: Patron = 'empuje') =>
      ficha(id, { patron, equivale: { patron, nivel } })
    const conAporte = (extra: Record<string, Vector>) => ({ ...APORTE, ...extra })

    it('la más cercana de cada lado entre las que comparten un músculo principal', () => {
      const catalogo = [
        ...EJERCICIOS,
        variante('v-pica-baja', 4),
        variante('v-pica', 6),
        variante('v-pica-alta', 8),
        variante('v-fondos', 5),
        variante('v-flexion', 7),
        variante('v-otra-cadena', 7, 'traccion'),
      ]
      const aporte = conAporte({
        'v-pica-baja': { 'deltoide-anterior': 1 },
        'v-pica': { 'deltoide-anterior': 1 },
        'v-pica-alta': { 'deltoide-anterior': 1 },
        'v-fondos': { triceps: 1 },
        'v-flexion': { pectoral: 1 },
        'v-otra-cadena': { 'deltoide-anterior': 1 },
      })
      const { masFacil, masDificil } = vecinos('v-pica', catalogo, aporte)
      expect(masFacil?.id).toBe('v-pica-baja')
      expect(masDificil?.id).toBe('v-pica-alta')
    })

    it('a la misma distancia, la que comparte más músculos y después el id', () => {
      const catalogo = [...EJERCICIOS, variante('v-media', 6), variante('v-a', 8), variante('v-b', 8)]
      const conDos = conAporte({
        'v-media': { 'deltoide-anterior': 1, triceps: 1 },
        'v-a': { 'deltoide-anterior': 1 },
        'v-b': { 'deltoide-anterior': 1, triceps: 1 },
      })
      expect(vecinos('v-media', catalogo, conDos).masDificil?.id).toBe('v-b')
      const conUno = conAporte({
        'v-media': { 'deltoide-anterior': 1 },
        'v-a': { 'deltoide-anterior': 1 },
        'v-b': { 'deltoide-anterior': 1 },
      })
      expect(vecinos('v-media', catalogo, conUno).masDificil?.id).toBe('v-a')
      // Y con el catálogo en otro orden, lo mismo.
      expect(vecinos('v-media', [...catalogo].reverse(), conUno).masDificil?.id).toBe('v-a')
    })

    it('sin ninguna de un lado, el eslabón de al lado de su nivel equivalente', () => {
      const catalogo = [
        ...EJERCICIOS,
        variante('v-sola', 6),
        variante('v-piso', 1),
        variante('v-tope', 11),
      ]
      const aporte = conAporte({
        'v-sola': { 'deltoide-anterior': 1 },
        'v-piso': { serrato: 1 },
        'v-tope': { oblicuos: 1 },
      })
      expect(vecinos('v-sola', catalogo, aporte)).toEqual({
        masFacil: ejercicio('flexion-rodillas'),
        masDificil: ejercicio('flexion-diamante'),
      })
      expect(vecinos('v-piso', catalogo, aporte).masFacil).toBeNull()
      expect(vecinos('v-piso', catalogo, aporte).masDificil?.id).toBe('flexion-inclinada-alta')
      expect(vecinos('v-tope', catalogo, aporte).masDificil).toBeNull()
      expect(vecinos('v-tope', catalogo, aporte).masFacil?.id).toBe('flexion-arquera')
    })
  })

  describe('en un accesorio, el de la banda de al lado para el mismo músculo', () => {
    const accesorio = (id: string, grado: 1 | 2 | 3, patron: Patron = 'piernas') =>
      ficha(id, { patron, accesorio: true, grado })
    const aporte: Record<string, Vector> = {
      ...APORTE,
      'a-uno': { gemelo: 1 },
      'a-dos': { gemelo: 1 },
      'a-tres': { gemelo: 1 },
      'a-pecho': { pectoral: 1 },
      'v-pecho': { pectoral: 1 },
    }

    it('una banda abajo y una arriba', () => {
      const catalogo = [
        ...EJERCICIOS,
        accesorio('a-uno', 1),
        accesorio('a-dos', 2),
        accesorio('a-tres', 3),
      ]
      const { masFacil, masDificil } = vecinos('a-dos', catalogo, aporte)
      // En la banda I compite con la elevación de talones con barra, que
      // también es de gemelo: gana por id.
      expect(masFacil?.id).toBe('a-uno')
      expect(masDificil?.id).toBe('a-tres')
    })

    it('"de al lado" es la más cercana que exista', () => {
      const catalogo = [...EJERCICIOS, accesorio('a-uno', 1), accesorio('a-tres', 3)]
      expect(vecinos('a-uno', catalogo, aporte).masDificil?.id).toBe('a-tres')
    })

    it('no ofrece eslabones ni variantes, aunque carguen el mismo músculo', () => {
      const catalogo = [
        ...EJERCICIOS,
        accesorio('a-pecho', 1, 'empuje'),
        ficha('v-pecho', { equivale: { patron: 'empuje', nivel: 9 } }),
      ]
      expect(vecinos('a-pecho', catalogo, aporte)).toEqual({ masFacil: null, masDificil: null })
    })
  })
})

describe('apareceEn', () => {
  const paso = (id: string, mas: Partial<PasoDeRutina>): PasoDeRutina => ({
    id,
    clase: 'fijo',
    series: 3,
    seccion: 'principal',
    ...mas,
  })
  const rutina = (id: string, nombre: string, pasos: PasoDeRutina[]): RutinaPropia => ({
    id,
    nombre,
    pasos,
    creadaEn: 0,
    actualizadaEn: 0,
  })

  const rutinas = [
    rutina('r1', 'Pecho en casa', [
      paso('p1', { ejercicioId: 'flexion-diamante' }),
      paso('p2', { ejercicioId: 'flexion-diamante', seccion: 'final' }),
    ]),
    rutina('r2', 'Empuje del lunes', [paso('p3', { clase: 'cadena', patron: 'empuje' })]),
    rutina('r3', 'Entrada', [
      paso('p4', { clase: 'movilidad', ejercicioId: 'gato-vaca', seccion: 'entrada' }),
    ]),
    rutina('r4', 'Vacía', []),
  ]

  it('las rutinas con un paso que nombra el ejercicio, una vez cada una', () => {
    expect(apareceEn('flexion-diamante', rutinas, {})).toEqual([
      { clase: 'rutina', rutinaId: 'r1', nombre: 'Pecho en casa' },
    ])
    expect(apareceEn('gato-vaca', rutinas, {})).toEqual([
      { clase: 'rutina', rutinaId: 'r3', nombre: 'Entrada' },
    ])
  })

  it('un paso de cadena no nombra ningún ejercicio: sigue tu nivel', () => {
    expect(apareceEn('flexion-completa', rutinas, IDS_DE_LOS_MIXES)).toEqual([])
  })

  it('los mixes no se pueden dejar afuera sin enterarse: APARECE EN es "los mixes y tus rutinas"', () => {
    // Con un valor por defecto vacío, la llamada de dos argumentos de §5.1
    // compilaba y nunca devolvía un mix. Ahora no compila.
    // @ts-expect-error: falta `mixes`, que es obligatorio.
    const sinMixes = () => apareceEn('gato-vaca', rutinas)
    expect(sinMixes).toBeTypeOf('function')
    // Con las tablas de los mixes, gato y vaca está en la entrada de Core y de
    // Cuerpo completo, y van antes que la rutina.
    expect(apareceEn('gato-vaca', rutinas, IDS_DE_LOS_MIXES)).toEqual([
      { clase: 'mix', sector: 'core' },
      { clase: 'mix', sector: 'cuerpo' },
      { clase: 'rutina', rutinaId: 'r3', nombre: 'Entrada' },
    ])
  })

  it('con los mixes resueltos para la persona, tu eslabón aparece en los mixes cuyo bloque de cadena lo pone', () => {
    const avance = (patron: Patron, ejercicioId: string): Avance => ({
      patron,
      ejercicioId,
      objetivoActual: { series: 3, cantidad: ejercicio(ejercicioId).ventana.min },
      senal: 1,
      sesionesEnObjetivo: 0,
      graciaRestante: 0,
      actualizadoEn: 0,
    })
    const avances = new Map<Patron, Avance>([
      ['empuje', avance('empuje', 'flexion-completa')],
      ['traccion', avance('traccion', 'remo-australiano-medio')],
      ['piernas', avance('piernas', 'sentadilla-completa')],
      ['core', avance('core', 'plancha')],
      ['bisagra', avance('bisagra', 'puente-gluteos-pies-elevados')],
    ])
    const resueltos = Object.fromEntries(
      MIXES.map((m) => [
        m.sector,
        resolverMix(m.sector, 'completa', { avances, equipo: equipoDe({}), historial: [], hoy: '2026-10-21', plan: null })
          .pasos.map((p) => p.ejercicioId),
      ]),
    )
    expect(apareceEn('flexion-completa', [], resueltos)).toEqual([
      { clase: 'mix', sector: 'pecho' },
      { clase: 'mix', sector: 'cuerpo' },
    ])
    // Las tablas solas no lo dicen: un bloque de cadena no nombra un ejercicio.
    expect(apareceEn('flexion-completa', [], IDS_DE_LOS_MIXES)).toEqual([])
  })

  it('los mixes primero, en el orden de los sectores', () => {
    const mixes = {
      brazos: ['flexion-diamante', 'curl-barra'],
      pecho: ['flexion-completa', 'flexion-diamante'],
      espalda: ['remo-australiano-alto'],
    }
    expect(apareceEn('flexion-diamante', rutinas, mixes)).toEqual([
      { clase: 'mix', sector: 'pecho' },
      { clase: 'mix', sector: 'brazos' },
      { clase: 'rutina', rutinaId: 'r1', nombre: 'Pecho en casa' },
    ])
  })

  it('sin ninguno, la lista vacía: la sección no aparece', () => {
    expect(apareceEn('curl-nordico', rutinas, { pecho: ['flexion-completa'] })).toEqual([])
    expect(apareceEn('curl-nordico', [], {})).toEqual([])
    expect(apareceEn('curl-nordico', [], IDS_DE_LOS_MIXES)).toEqual([])
  })
})

describe('requisitoCumplido', () => {
  describe('los de REQUISITOS, contra los avances', () => {
    it('la palanca frontal pide 3 × 8 en la dominada completa, o haberla pasado', () => {
      const cumple = (estos: Map<Patron, Avance>) =>
        requisitoCumplido('palanca-frontal-agrupada', estos, [])
      expect(cumple(avances())).toBe(false)
      expect(cumple(avances(avance('traccion', 'dominada-asistida-leve')))).toBe(false)
      expect(cumple(avances(avance('traccion', 'dominada-completa', 3, 5)))).toBe(false)
      expect(cumple(avances(avance('traccion', 'dominada-completa', 3, 8)))).toBe(true)
      expect(cumple(avances(avance('traccion', 'dominada-arquera', 3, 3)))).toBe(true)
    })

    it('dice lo mismo que apertura.ts en cada caso', () => {
      const posibles: Map<Patron, Avance>[] = [
        avances(),
        ...cadenaDe('traccion').ejercicios.flatMap((id) => [
          avances(avance('traccion', id, 3, 5)),
          avances(avance('traccion', id, 3, 8)),
          avances(avance('traccion', id, 2, 12)),
        ]),
      ]
      for (const [id] of REQUISITOS) {
        for (const estos of posibles) {
          const cerrado = eslabonesCerrados(cadenaDe(ejercicio(id).patron), estos, true).has(id)
          expect(requisitoCumplido(id, estos, []), id).toBe(!cerrado)
        }
      }
    })
  })

  describe('los de historial', () => {
    const pide: RequisitoDeHistorial = {
      pide: { ejercicioId: 'apoyo-de-prueba', series: 3, cantidad: 30 },
      porque: 'para llegar con los hombros firmes',
    }
    const deHistorial = new Map([['fondos-de-prueba', [pide]]])
    const cumplido = (historial: Sesion[]) =>
      requisitoCumplido('fondos-de-prueba', avances(), historial, deHistorial)

    it('3 × 30 s cumple', () => {
      expect(cumplido([sesion([['apoyo-de-prueba', [30, 31, 30]]])])).toBe(true)
    })

    it('2 × 30 s no, ni 3 series con una de 29', () => {
      expect(cumplido([sesion([['apoyo-de-prueba', [30, 30]]])])).toBe(false)
      expect(cumplido([sesion([['apoyo-de-prueba', [30, 29, 30]]])])).toBe(false)
    })

    it('las de calentamiento no cuentan', () => {
      const deCalentamiento: Partial<RegistroEjercicio> = { calentamiento: true }
      expect(cumplido([sesion([['apoyo-de-prueba', [30, 30, 30], deCalentamiento]])])).toBe(false)
      expect(
        cumplido([
          sesion([
            ['apoyo-de-prueba', [30], deCalentamiento],
            ['apoyo-de-prueba', [30, 30]],
          ]),
        ]),
      ).toBe(false)
    })

    it('sin historial no cumple', () => {
      expect(cumplido([])).toBe(false)
      expect(cumplido([sesion([['flexion-completa', [30, 30, 30]]])])).toBe(false)
    })

    it('las series se cuentan por sesión: en dos pasos de la misma sí, en dos sesiones no', () => {
      const enDosPasos = sesion([
        ['apoyo-de-prueba', [30, 30]],
        ['apoyo-de-prueba', [30]],
      ])
      expect(cumplido([enDosPasos])).toBe(true)
      const primera = sesion([['apoyo-de-prueba', [30, 30]]])
      const segunda = sesion([['apoyo-de-prueba', [30]]])
      expect(cumplido([primera, segunda])).toBe(false)
    })

    it('con varios requisitos, hacen falta todos', () => {
      const otro: RequisitoDeHistorial = {
        pide: { ejercicioId: 'pica-de-prueba', series: 3, cantidad: 8 },
        porque: 'para llegar con la técnica',
      }
      const dos = new Map([['vertical-de-prueba', [pide, otro]]])
      const apoyo = sesion([['apoyo-de-prueba', [30, 30, 30]]])
      const pica = sesion([['pica-de-prueba', [8, 8, 8]]])
      expect(requisitoCumplido('vertical-de-prueba', avances(), [apoyo], dos)).toBe(false)
      expect(requisitoCumplido('vertical-de-prueba', avances(), [apoyo, pica], dos)).toBe(true)
      expect(requisitosSinCumplir('vertical-de-prueba', avances(), [apoyo], dos)).toEqual([
        { clase: 'historial', requisito: otro },
      ])
    })

    it('un requisito de avance y uno de historial en el mismo ejercicio: los dos', () => {
      const id = 'palanca-frontal-agrupada'
      const palanca = new Map([[id, [pide]]])
      const firme = avances(avance('traccion', 'dominada-completa', 3, 8))
      const apoyo = sesion([['apoyo-de-prueba', [30, 30, 30]]])
      expect(requisitoCumplido(id, firme, [], palanca)).toBe(false)
      expect(requisitoCumplido(id, avances(), [apoyo], palanca)).toBe(false)
      expect(requisitoCumplido(id, firme, [apoyo], palanca)).toBe(true)
      expect(requisitosDe(id, palanca).map((r) => r.clase)).toEqual(['avance', 'historial'])
    })
  })

  it('un ejercicio sin requisitos los tiene cumplidos', () => {
    expect(requisitoCumplido('flexion-completa', avances(), [])).toBe(true)
    expect(requisitosSinCumplir('flexion-completa', avances(), [])).toEqual([])
    expect(requisitoCumplido('gato-vaca', avances(), [])).toBe(true)
  })

  describe('la lista de la biblioteca', () => {
    const uno: RequisitoDeHistorial = {
      pide: { ejercicioId: 'a', series: 3, cantidad: 30 },
      porque: 'x',
    }
    const otro: RequisitoDeHistorial = {
      pide: { ejercicioId: 'b', series: 3, cantidad: 8 },
      porque: 'y',
    }

    it('se lee de un Map o de un objeto, con uno o varios requisitos por ejercicio', () => {
      expect(leerRequisitosDeHistorial(new Map([['f', uno]]))).toEqual(new Map([['f', [uno]]]))
      expect(leerRequisitosDeHistorial({ f: [uno, otro] })).toEqual(new Map([['f', [uno, otro]]]))
    })

    it('sin lista no hay ninguno, y lo que no tiene la forma no se lee', () => {
      expect(leerRequisitosDeHistorial(undefined).size).toBe(0)
      expect(leerRequisitosDeHistorial(null).size).toBe(0)
      const plano = { f: { ejercicioId: 'a', series: 3, cantidad: 30 } }
      expect(leerRequisitosDeHistorial(plano).size).toBe(0)
      const conTexto = { f: { pide: { ejercicioId: 'a', series: '3', cantidad: 30 }, porque: 'x' } }
      expect(leerRequisitosDeHistorial(conTexto).size).toBe(0)
    })

    it('cada requisito que declara la biblioteca se lee: ninguno se pierde por la forma', () => {
      // Hoy la biblioteca no declara ninguno (los suma la ola 1). El día que
      // los declare, este test es el que avisa si la forma no es la que
      // `requisitoCumplido` sabe leer.
      const declarados: unknown = Reflect.get(biblioteca, NOMBRE_DE_LOS_REQUISITOS_DE_HISTORIAL)
      const crudos =
        declarados instanceof Map
          ? [...declarados.values()]
          : typeof declarados === 'object' && declarados !== null
            ? Object.values(declarados)
            : []
      const cuantos = crudos.reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 1), 0)
      const leidos = leerRequisitosDeHistorial(declarados)
      expect([...leidos.values()].reduce((n, v) => n + v.length, 0)).toBe(cuantos)
      for (const [id, lista] of leidos) {
        expect(requisitosDe(id).filter((r) => r.clase === 'historial')).toHaveLength(lista.length)
      }
    })
  })
})

describe('lo que dice el catálogo', () => {
  it('ningún nombre, equipo ni título de grupo usa PROHIBIDAS ni exclamaciones', () => {
    const textos: string[] = [
      ...ITEMS.map((i) => i.nombre),
      ...Object.values(NOMBRE_EQUIPO),
      ...AGRUPACIONES.flatMap((por) => agruparCatalogo(ITEMS, por, new Map()).map((g) => g.titulo)),
      'Sin cadena',
      'Sin músculo principal',
      'Sin dato de equipo',
    ]
    for (const texto of textos) {
      expect(loProhibido(texto), texto).toBeNull()
      expect(texto).not.toMatch(/[!¡]/)
    }
  })
})
