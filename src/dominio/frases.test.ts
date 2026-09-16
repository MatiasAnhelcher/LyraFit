import { describe, expect, it } from 'vitest'
import {
  CUANTAS,
  FRASES,
  LARGO_MAXIMO,
  MEMORIA,
  TODAS,
  dichoDelDescanso,
  fraseDe,
  recordar,
  type Momento,
} from './frases'

/**
 * Que la voz de Lyra no se convierta en un cartel.
 *
 * §9 del documento de estrategia prohíbe las frases motivacionales, y tiene
 * razón sobre un tipo puntual: la que promete un resultado, la que elogia a la
 * persona en vez de a la conducta, y la que aparece en lugar de un dato. Este
 * banco entra igual, pero con esas tres cosas prohibidas **por test** y no por
 * buena intención — que es la única forma de que sigan prohibidas dentro de
 * seis meses, cuando alguien agregue la frase número trescientos uno.
 *
 * Un test de contenido es raro y acá se justifica: el contenido ES la función.
 */

const MOMENTOS: Momento[] = [
  'abrir',
  'esfuerzo',
  'reencuadre',
  'constancia',
  'cierre',
  'descanso',
  'vuelta',
  'techo',
  'duda',
  'cuerpo',
  'largo',
  'aliento',
  'ultima',
  'final',
]

describe('el banco de frases', () => {
  it('tiene exactamente las que dice tener', () => {
    // Escrito a mano y no calculado, igual que la lista de dibujos pendientes:
    // así sacar o agregar una sin querer falla, en vez de adaptarse en silencio.
    expect(TODAS.length).toBe(CUANTAS)
  })

  it('no repite ninguna', () => {
    const vistas = new Map<string, number>()
    for (const linea of TODAS) vistas.set(linea, (vistas.get(linea) ?? 0) + 1)
    const repetidas = [...vistas].filter(([, n]) => n > 1).map(([l]) => l)
    expect(repetidas, 'frases duplicadas').toEqual([])
  })

  it('cubre los once momentos, y ninguno queda flaco', () => {
    for (const momento of MOMENTOS) {
      const grupo = FRASES.find((g) => g.momento === momento)
      expect(grupo, `falta el momento ${momento}`).toBeDefined()
      // Con menos de veinte, el buffer anti-repetición se queda sin candidatas
      // y Lyra empieza a repetirse en una semana de uso normal.
      expect(grupo!.lineas.length, `${momento} tiene pocas`).toBeGreaterThanOrEqual(20)
    }
    expect(FRASES.length).toBe(MOMENTOS.length)
  })

  it('todas se leen de reojo', () => {
    for (const linea of TODAS) {
      expect(linea.length, `demasiado larga: "${linea}"`).toBeLessThanOrEqual(LARGO_MAXIMO)
      expect(linea.trim(), 'hay una vacía').not.toBe('')
    }
  })

  it('todas terminan cerradas', () => {
    for (const linea of TODAS) {
      expect(/[.?!]$/.test(linea.trim()), `sin cerrar: "${linea}"`).toBe(true)
    }
  })
})

describe('las cuatro reglas, que son el punto', () => {
  it('ninguna promete un resultado', () => {
    // El motor es lo único que proyecta en esta app, y proyecta con una cuenta.
    // Una promesa de una mascota no se puede cumplir ni verificar, y cuando no
    // se cumple se lleva puesta la credibilidad de lo que sí es cierto.
    const promesas = [
      /\bvas a (lograr|conseguir|poder|tener|llegar)\b/i,
      /\bvas a estar\b/i,
      /\bgarantiz/i,
      /\ben (un|dos|tres|seis) (mes|meses|semanas?)\b/i,
      /\bte lo prometo\b/i,
      /\bseguro que\b/i,
    ]
    for (const linea of TODAS) {
      for (const patron of promesas) {
        expect(patron.test(linea), `promete un resultado: "${linea}"`).toBe(false)
      }
    }
  })

  it('ninguna culpa, avergüenza ni mete urgencia', () => {
    const feas = [
      /\bno aflojes\b/i,
      /\bsin excusas?\b/i,
      /\bvago\b|\bvaga\b/i,
      /\bperdiste la racha\b/i,
      /\bracha\b/i, // no existe en esta app, y nombrarla la resucitaría
      /\búltima oportunidad\b/i,
      /\bte vas a arrepentir\b/i,
      /\bnadie más\b.*\bque vos\b/i,
      /\bdeberías\b/i,
      /\b(es|fue|por) tu culpa\b/i,
      /\bculpable\b/i,
      /\bfracas/i,
      /\bdébil\b/i,
    ]
    for (const linea of TODAS) {
      for (const patron of feas) {
        expect(patron.test(linea), `culpa o aprieta: "${linea}"`).toBe(false)
      }
    }
  })

  it('ninguna compara con otra gente', () => {
    // La comparación social es la forma más rápida de que una frase deje de
    // hablar del esfuerzo propio, que es lo único controlable.
    const comparaciones = [/\bmejor que (los|el|la|las)\b/i, /\bel resto de\b/i, /\bganale a\b/i]
    for (const linea of TODAS) {
      for (const patron of comparaciones) {
        expect(patron.test(linea), `compara: "${linea}"`).toBe(false)
      }
    }
  })

  it('ninguna inventa un número', () => {
    // Si hay una cifra que decir sobre el entrenamiento, la dice el motor, que
    // la calculó. Una mascota que tira números es una mascota que miente.
    const cifras = [
      /\b\d+\s*(kilos?|kg|repeticiones|series|calorías|cal)\b/i,
      /\b\d+\s*%/,
    ]
    for (const linea of TODAS) {
      for (const patron of cifras) {
        expect(patron.test(linea), `tira un número: "${linea}"`).toBe(false)
      }
    }
  })

  it('ninguna habla de calorías ni de cómo te ves', () => {
    // §9: nada de conteo de calorías. Y el encuadre de la app es capacidad, no
    // estética — "entreno hoy para no depender de nadie a los ochenta".
    const prohibidas = [/\bcalorías?\b/i, /\bquemar\b/i, /\badelgaz/i, /\bbajar de peso\b/i, /\babdominales marcados\b/i, /\bverano\b/i]
    for (const linea of TODAS) {
      for (const patron of prohibidas) {
        expect(patron.test(linea), `encuadre estético o calórico: "${linea}"`).toBe(false)
      }
    }
  })

  it('habla de vos, en voseo, sin tutear', () => {
    // La app entera está en rioplatense. Un "tú puedes" suelto rompe la voz más
    // que cualquier error de diseño.
    const tuteo = [/\btú\b/i, /\bpuedes\b/i, /\btienes\b/i, /\bharás\b/i, /\bdebes\b/i, /\btu puedes\b/i]
    for (const linea of TODAS) {
      for (const patron of tuteo) {
        expect(patron.test(linea), `tutea: "${linea}"`).toBe(false)
      }
    }
  })
})

describe('elegir una frase', () => {
  it('siempre devuelve algo para cualquier momento y cualquier azar', () => {
    for (const momento of MOMENTOS) {
      for (const azar of [0, 0.001, 0.25, 0.5, 0.75, 0.999, 1]) {
        const elegida = fraseDe(momento, azar)
        expect(elegida, `${momento} con azar ${azar}`).not.toBeNull()
        expect(elegida!.texto.length).toBeGreaterThan(0)
      }
    }
  })

  it('el azar recorre el grupo entero', () => {
    // Si la aritmética del índice estuviera mal —un off-by-one, un módulo de
    // más— habría frases inalcanzables: estarían escritas y no las vería nadie.
    for (const grupo of FRASES) {
      const salieron = new Set<string>()
      const pasos = grupo.lineas.length * 4
      for (let i = 0; i < pasos; i++) {
        salieron.add(fraseDe(grupo.momento, i / pasos)!.texto)
      }
      expect(salieron.size, `${grupo.momento}: hay frases inalcanzables`).toBe(
        grupo.lineas.length,
      )
    }
  })

  it('no repite lo que ya dijo', () => {
    for (const grupo of FRASES) {
      let dichas: string[] = []
      const salidas: string[] = []
      for (let i = 0; i < 15; i++) {
        const elegida = fraseDe(grupo.momento, (i * 0.37) % 1, dichas)!
        salidas.push(elegida.texto)
        dichas = recordar(dichas, elegida.texto)
      }
      expect(new Set(salidas).size, `${grupo.momento} repitió`).toBe(salidas.length)
    }
  })

  it('cuando se agotan, repite en vez de callarse', () => {
    // Quedarse sin frase sería una pantalla con un hueco. Preferible repetir.
    const grupo = FRASES[0]!
    const todas = [...grupo.lineas]
    const elegida = fraseDe(grupo.momento, 0.5, todas)
    expect(elegida).not.toBeNull()
    expect(grupo.lineas).toContain(elegida!.texto)
  })

  it('un momento que no existe devuelve null en vez de romper', () => {
    expect(fraseDe('inventado' as Momento, 0.5)).toBeNull()
  })

  it('la expresión de la cara viene con la frase', () => {
    for (const grupo of FRASES) {
      expect(fraseDe(grupo.momento, 0.5)!.expresion).toBe(grupo.expresion)
    }
  })
})

describe('la memoria de lo dicho', () => {
  it('pone lo último adelante y no duplica', () => {
    const memoria = recordar(recordar(['b'], 'a'), 'b')
    expect(memoria).toEqual(['b', 'a'])
  })

  it('no crece sin límite', () => {
    let memoria: string[] = []
    for (let i = 0; i < MEMORIA * 3; i++) memoria = recordar(memoria, `frase ${i}`)
    expect(memoria.length).toBe(MEMORIA)
    expect(memoria[0]).toBe(`frase ${MEMORIA * 3 - 1}`)
  })
})

describe('lo que Lyra dice en el descanso', () => {
  const base = { tecnica: ['Codos pegados.', 'Cuerpo en línea.'], faltan: 2, indice: 0, total: 4, azar: 0.5 }
  /** Los azares que hay que probar: un descanso real puede traer cualquiera. */
  const AZARES = [0, 0.01, 0.25, 0.5, 0.75, 0.99, 0.999999]

  it('nunca deja un descanso mudo, en ninguna posición de la sesión', () => {
    for (const total of [2, 3, 4, 5]) {
      for (let indice = 0; indice < total; indice++) {
        for (const faltan of [1, 2, 3]) {
          for (const azar of AZARES) {
            const dicho = dichoDelDescanso({ ...base, faltan, indice, total, azar })
            expect(dicho, `total=${total} indice=${indice} faltan=${faltan} azar=${azar}`).not.toBeNull()
            expect(dicho!.texto.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('tampoco se queda mudo si el ejercicio no tuviera técnica escrita', () => {
    // Hoy todos la tienen, pero el que agregue el ejercicio cuarenta y ocho no
    // se va a acordar, y un descanso en blanco no avisa: se ve como un hueco.
    for (const azar of AZARES) {
      const dicho = dichoDelDescanso({ ...base, tecnica: [], azar })
      expect(dicho).not.toBeNull()
      expect(dicho!.texto.length).toBeGreaterThan(0)
    }
  })

  it('con una sola serie por delante habla de esa última', () => {
    const grupo = FRASES.find((g) => g.momento === 'ultima')!
    for (const azar of AZARES) {
      const dicho = dichoDelDescanso({ ...base, faltan: 1, azar })
      expect(grupo.lineas).toContain(dicho!.texto)
    }
  })

  it('en el último ejercicio habla del final, aunque falten series', () => {
    const grupo = FRASES.find((g) => g.momento === 'final')!
    for (const azar of AZARES) {
      const dicho = dichoDelDescanso({ ...base, faltan: 2, indice: 3, total: 4, azar })
      expect(grupo.lineas).toContain(dicho!.texto)
    }
  })

  it('la técnica es de la primera mitad y el aliento de la segunda', () => {
    const aliento = FRASES.find((g) => g.momento === 'aliento')!
    // Sesión de cuatro: técnica en el primero y el segundo, aliento en el
    // tercero. El cuarto es el último y ya habla del final.
    for (const azar of AZARES) {
      expect(base.tecnica).toContain(dichoDelDescanso({ ...base, indice: 0, azar })!.texto)
      expect(base.tecnica).toContain(dichoDelDescanso({ ...base, indice: 1, azar })!.texto)
      expect(aliento.lineas).toContain(dichoDelDescanso({ ...base, indice: 2, azar })!.texto)
    }
  })

  it('el aliento existe también en una sesión de tres ejercicios', () => {
    // Con la regla vieja —"la segunda mitad"— una sesión de tres caía entera
    // del lado de la técnica y el banco de aliento no se veía nunca.
    const aliento = FRASES.find((g) => g.momento === 'aliento')!
    for (const azar of AZARES) {
      expect(base.tecnica).toContain(dichoDelDescanso({ ...base, indice: 0, total: 3, azar })!.texto)
      expect(aliento.lineas).toContain(dichoDelDescanso({ ...base, indice: 1, total: 3, azar })!.texto)
    }
  })

  it('la técnica rota con el azar y no se queda siempre en la misma', () => {
    // Es el defecto que tenía: rotaba por la serie que va, que en el único
    // descanso con técnica vale uno siempre, así que de las cuatro
    // indicaciones de un ejercicio se veía una sola, para siempre.
    const tecnica = ['uno', 'dos', 'tres', 'cuatro']
    const vistas = new Set(
      AZARES.map((azar) => dichoDelDescanso({ ...base, tecnica, azar })!.texto),
    )
    expect(vistas).toEqual(new Set(tecnica))
  })

  it('es pura: el mismo descanso dice siempre lo mismo', () => {
    const uno = dichoDelDescanso({ ...base, azar: 0.37 })
    const otro = dichoDelDescanso({ ...base, azar: 0.37 })
    expect(uno).toEqual(otro)
  })
})
