/**
 * La biblioteca es datos, y los datos también se rompen.
 *
 * Un id mal escrito en una cadena, una ventana invertida o un salto de carga
 * demasiado grande entre dos eslabones no rompen la compilación: rompen el
 * entrenamiento de alguien. Esto los agarra antes.
 */

import { describe, expect, it } from 'vitest'
import { CADENAS, EJERCICIOS, FUERA_DE_CADENA, POR_ID, REQUISITOS, cadenaDe } from './biblioteca'
import { PROHIBIDAS, loProhibido } from './palabras'
import { requisitoDicho } from './progresion'

/**
 * Salto máximo de carga entre dos eslabones consecutivos.
 *
 * Por encima de esto la progresión deja de ser una escalera y pasa a ser un
 * escalón: es donde la gente se lastima el hombro y donde abandona. Los
 * primeros eslabones de cada cadena tienen permitido un salto mayor porque son
 * tan livianos que un cuarenta por ciento de casi nada sigue siendo poco.
 */
const SALTO_MAXIMO = 0.25
const SALTO_MAXIMO_INICIAL = 0.55
const CARGA_LIVIANA = 0.5

describe('integridad de las cadenas', () => {
  it('todos los ids de las cadenas existen', () => {
    for (const cadena of CADENAS) {
      for (const id of cadena.ejercicios) {
        expect(POR_ID.get(id), `${cadena.patron} → ${id}`).toBeDefined()
      }
    }
  })

  it('todos los ejercicios están en su cadena, y en una sola', () => {
    const enCadenas = CADENAS.flatMap((c) => c.ejercicios)
    expect(new Set(enCadenas).size).toBe(enCadenas.length)
    for (const ejercicio of EJERCICIOS) {
      if (FUERA_DE_CADENA.has(ejercicio.id)) continue
      expect(enCadenas, ejercicio.id).toContain(ejercicio.id)
    }
  })

  it('los que están fuera de cadena están DECLARADOS fuera de cadena', () => {
    // Las dos direcciones, que es lo que convierte una excepción en una
    // decisión: ni se puede dejar un ejercicio suelto por descuido, ni la
    // lista puede quedarse vieja cuando uno entre a una cadena.
    const enCadenas = new Set(CADENAS.flatMap((c) => c.ejercicios))
    const sueltos = EJERCICIOS.filter((e) => !enCadenas.has(e.id)).map((e) => e.id)
    expect(sueltos.sort(), 'sueltos y sin declarar').toEqual([...FUERA_DE_CADENA].sort())
    expect(
      [...FUERA_DE_CADENA].filter((id) => enCadenas.has(id)),
      'ya están en una cadena: sacalos de FUERA_DE_CADENA',
    ).toEqual([])
    expect(
      [...FUERA_DE_CADENA].filter((id) => !POR_ID.has(id)),
      'declarados fuera de cadena y no existen',
    ).toEqual([])
  })

  it('cada ejercicio pertenece al patrón de su cadena', () => {
    for (const cadena of CADENAS) {
      for (const id of cadena.ejercicios) {
        expect(POR_ID.get(id)!.patron, id).toBe(cadena.patron)
      }
    }
  })

  it('los niveles van en orden dentro de cada cadena', () => {
    for (const cadena of CADENAS) {
      const niveles = cadena.ejercicios.map((id) => POR_ID.get(id)!.nivel)
      expect(niveles, cadena.patron).toEqual([...niveles].sort((a, b) => a - b))
    }
  })

  it('la carga sube en cada eslabón, sin saltos que lastimen', () => {
    for (const cadena of CADENAS) {
      const ejercicios = cadena.ejercicios.map((id) => POR_ID.get(id)!)
      for (let i = 1; i < ejercicios.length; i++) {
        const previo = ejercicios[i - 1]!
        const actual = ejercicios[i]!
        expect(actual.ccr, `${previo.id} → ${actual.id}`).toBeGreaterThan(previo.ccr)

        const salto = actual.ccr / previo.ccr - 1
        const permitido = previo.ccr < CARGA_LIVIANA ? SALTO_MAXIMO_INICIAL : SALTO_MAXIMO
        expect(salto, `${previo.id} → ${actual.id} salta ${Math.round(salto * 100)}%`)
          .toBeLessThanOrEqual(permitido)
      }
    }
  })
})

describe('la palanca frontal', () => {
  // Estuvieron al revés: la negativa en el nivel 8, con ccr 1,0, y la
  // agrupada en el 9, con 1,15. La propia negativa dice que no se empieza
  // "sin tener firmes la palanca agrupada y las dominadas completas". Se
  // pinean los dos datos que se dieron vuelta, el nivel y la carga, porque
  // los tests genéricos de arriba pasaban igual con el orden equivocado.
  const core = cadenaDe('core').ejercicios
  const agrupada = POR_ID.get('palanca-frontal-agrupada')!
  const negativa = POR_ID.get('palanca-frontal-negativa')!

  it('la agrupada va antes que la negativa, en la cadena y en el nivel', () => {
    expect(core.slice(-3)).toEqual([
      'elevacion-piernas-colgado',
      'palanca-frontal-agrupada',
      'palanca-frontal-negativa',
    ])
    expect(agrupada.nivel).toBe(8)
    expect(negativa.nivel).toBe(9)
  })

  it('la carga relativa sigue el mismo orden', () => {
    expect(agrupada.ccr).toBe(1.0)
    expect(negativa.ccr).toBe(1.15)
    expect(POR_ID.get('elevacion-piernas-colgado')!.ccr).toBeLessThan(agrupada.ccr)
  })

  it('el texto de la negativa pide la agrupada antes, y ahora el orden le hace caso', () => {
    expect(negativa.erroresComunes.join(' ')).toContain('palanca agrupada')
    expect(core.indexOf(agrupada.id)).toBeLessThan(core.indexOf(negativa.id))
  })

  it('las dos piden 3 series de 8 dominadas completas antes de abrirse', () => {
    // El 3×8 del rol de calistenia. Llegar a las dominadas completas no
    // alcanza: se entra con 3 por serie.
    for (const id of [agrupada.id, negativa.id]) {
      expect(REQUISITOS.get(id), id).toEqual({
        patron: 'traccion',
        ejercicioId: 'dominada-completa',
        minimo: { series: 3, cantidad: 8 },
        porque: 'así se cuida el codo',
      })
    }
  })
})

describe('requisitos cruzados', () => {
  it('cada requisito une dos cadenas distintas con eslabones que existen', () => {
    for (const [cerrado, { patron, ejercicioId }] of REQUISITOS) {
      const ejercicio = POR_ID.get(cerrado)
      expect(ejercicio, `${cerrado} no existe`).toBeDefined()
      expect(cadenaDe(ejercicio!.patron).ejercicios, cerrado).toContain(cerrado)
      expect(patron, `${cerrado} pide algo de su propia cadena`).not.toBe(ejercicio!.patron)
      expect(cadenaDe(patron).ejercicios, `${cerrado} pide ${ejercicioId}`).toContain(ejercicioId)
    }
  })

  it('el mínimo es alcanzable en el eslabón pedido y pide más que entrar', () => {
    // Un mínimo por encima del techo de la ventana no se cumpliría nunca en
    // ese eslabón; uno en el piso sería lo mismo que llegar.
    for (const [cerrado, { ejercicioId, minimo }] of REQUISITOS) {
      if (!minimo) continue
      const pedido = POR_ID.get(ejercicioId)!
      expect(minimo.cantidad, cerrado).toBeGreaterThan(pedido.ventana.min)
      expect(minimo.cantidad, cerrado).toBeLessThanOrEqual(pedido.ventana.max)
      expect(minimo.series, cerrado).toBeGreaterThanOrEqual(1)
      expect(minimo.series, cerrado).toBeLessThanOrEqual(pedido.series)
    }
  })

  it('la ficha del eslabón cerrado dice el mismo requisito que el dato', () => {
    // La ficha lo dice en "Lo que sale mal". Si alguien cambia el mínimo y no
    // el texto, la ficha diría una cosa y el motor otra.
    for (const [cerrado, { ejercicioId, minimo }] of REQUISITOS) {
      const texto = POR_ID.get(cerrado)!.erroresComunes.join(' ')
      expect(texto, cerrado).toContain(requisitoDicho(POR_ID.get(ejercicioId)!, minimo))
    }
  })

  it('cada requisito dice por qué existe, en pocas palabras y sin punto', () => {
    for (const [cerrado, { porque }] of REQUISITOS) {
      expect(porque.length, cerrado).toBeGreaterThan(5)
      expect(porque.length, cerrado).toBeLessThanOrEqual(40)
      expect(porque, cerrado).not.toMatch(/\.$/)
    }
  })
})

describe('cada ejercicio está bien formado', () => {
  it.each(EJERCICIOS.map((e) => [e.id, e] as const))('%s', (_id, ejercicio) => {
    expect(ejercicio.ventana.min).toBeGreaterThan(0)
    expect(ejercicio.ventana.max).toBeGreaterThan(ejercicio.ventana.min)
    expect(ejercicio.series).toBeGreaterThanOrEqual(1)
    expect(ejercicio.ccr).toBeGreaterThan(0)
    expect(ejercicio.descansoSegundos).toBeGreaterThanOrEqual(30)
    expect(ejercicio.tecnica.length).toBeGreaterThanOrEqual(3)
    expect(ejercicio.erroresComunes.length).toBeGreaterThanOrEqual(2)
    expect(ejercicio.resumen.length).toBeGreaterThan(20)
  })

  it('los topes son de trabajo, no de resistencia', () => {
    // Ventanas larguísimas convierten la progresión en un test de aguante y
    // dejan a la gente meses en el mismo eslabón sintiendo que no avanza.
    for (const e of EJERCICIOS) {
      const techo = e.medida === 'segundos' ? 30 : 15
      expect(e.ventana.max, e.id).toBeLessThanOrEqual(techo)
    }
  })
})

describe('el vocabulario no promete lo que no puede', () => {
  // Los mecanismos son propios de las fichas: palabras que solo un texto de
  // técnica tentaría a usar. Lo que la app no dice nunca, en ningún lado, es
  // `PROHIBIDAS`, y se lee de `palabras.ts`.
  const MECANISMOS = [
    'bdnf',
    'neuroplasticidad',
    'cortisol',
    'parasimpátic',
    'detox',
    'quema grasa',
    'tonifica',
    'sistema inmune',
    'coherencia cardíaca',
    // Lo que "rinde más" que otra cosa necesita una comparación medida, y las
    // fichas no tienen ninguna: el tempo "rindiendo más que el peso" chocaba
    // con un metaanálisis (Schoenfeld, Ogborn y Krieger 2015) y con la
    // estrategia. Y el pectoral interno no se entrena por separado: el propio
    // mapa muscular lo dice. Revisión de evidencia de octubre de 2026.
    'rinde',
    'tiempo bajo tensión',
    'pectoral interno',
    'interna del pectoral',
  ]

  it('ningún texto de la biblioteca afirma un mecanismo que no se pueda sostener', () => {
    for (const e of EJERCICIOS) {
      const texto = [e.resumen, ...e.tecnica, ...e.erroresComunes].join(' ').toLowerCase()
      for (const palabra of MECANISMOS) {
        expect(texto, `${e.id} dice "${palabra}"`).not.toContain(palabra)
      }
    }
  })

  it('ninguna ficha dice algo de lo que la app no dice nunca', () => {
    // Una ficha se lee con el ejercicio en la mano: "el peso es demasiado"
    // suena a reto aunque hable de la barra, y "sobra peso" dice lo mismo.
    for (const e of EJERCICIOS) {
      for (const texto of [e.nombre, e.resumen, ...e.tecnica, ...e.erroresComunes]) {
        expect(loProhibido(texto), `${e.id}: "${texto}"`).toBeNull()
      }
    }
    expect(PROHIBIDAS.length).toBeGreaterThan(30)
  })
})
