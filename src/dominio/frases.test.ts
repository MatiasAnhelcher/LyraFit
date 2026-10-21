import { describe, expect, it } from 'vitest'
import {
  CUANTAS,
  DESDE_SESIONES,
  FRASES,
  LARGO_MAXIMO,
  MEMORIA,
  TODAS,
  dichoDelDescanso,
  fraseDe,
  recordar,
  type Momento,
} from './frases'
import { loProhibido } from './palabras'

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

  it('cubre los catorce momentos, y ninguno queda flaco', () => {
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
  it('ninguna promete, culpa, aprieta ni reta', () => {
    // El motor es lo único que proyecta en esta app, y proyecta con una cuenta.
    // Una promesa de una mascota no se puede cumplir ni verificar, y cuando no
    // se cumple se lleva puesta la credibilidad de lo que sí es cierto. La
    // culpa, la urgencia y el reto (racha, "deberías", "te pasaste") no existen
    // en esta app, y nombrarlos los resucitaría. La lista es una sola para
    // toda la app y vive en `palabras.ts`: los portones leen la misma.
    for (const linea of TODAS) {
      expect(loProhibido(linea), `"${linea}"`).toBeNull()
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

  /*
   * Las reglas de la revisión del 20 de octubre de 2026.
   *
   * Las de arriba buscaban expresiones puntuales y por eso dejaron pasar
   * "Un mes de esto se nota" (no dice "en un mes"), "Cuarenta minutos" (no
   * tiene dígitos) y "Cuando el cuerpo dice basta y seguís un poco más", que
   * salía en el cierre de cada salto de eslabón. Corren sobre TODAS las frases,
   * también las de los bancos que hoy ninguna pantalla pide: activar uno no
   * puede ser la forma de que vuelva una frase que acá ya se sacó.
   *
   * Las excepciones van con su motivo, igual que `CUANTAS`, para que nada se
   * adapte en silencio.
   */
  const PERMITIDAS = new Map([
    ['Siete minutos también cuentan.', 'es la sesión corta real, no una cifra inventada'],
    ['Diez minutos de esto valen más que una hora de planearlo.', 'retórica: no describe a la persona'],
    ['Si en diez minutos seguís sin querer, cortá.', 'es una salida, no una cifra sobre la persona'],
  ])
  const REGLAS: Record<string, RegExp[]> = {
    'obliga o reta': [
      /(?:^|[.!?]\s+)tenés que\b/i,
      /\blo que no podés\b/i,
      /\bexigite\b/i,
      /\bcortala\b/i,
      /\bla peor sesión es la que no\b/i,
    ],
    'empuja más allá del límite': [
      /\bdice basta\b/i,
      /\bno paraste\b/i,
      /\bque no tenías\b/i,
      /\bdale todo\b/i,
      /\bya no querías\b/i,
      // "Aguantá un poquito más" en el último ejercicio, justo donde la app
      // armó un final suave. Sin `\b` al final: la á no es letra sin `u`.
      /\baguant[aá]/i,
      /\bempuj[oó]n/i,
    ],
    'promete, también en futuro corto': [
      /\bte va a (salir|cambiar|parecer)\b/i,
      /\bva a (ser|parecer)\b/i,
      /\bno vas a reconocer\b/i,
      /\bsiempre sale\b/i,
      /\b(viene|llega) solo\b/i,
      /\bte cambia el cuerpo\b/i,
    ],
    'inventa una cifra, también escrita con letras': [
      /\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|diez|quince|veinte|treinta|cuarenta|cien|doscientos)\s+(mes|meses|semanas?|años?|minutos|horas|kilos?|anteriores|cosas)\b/i,
      /\bmedia hora\b/i,
    ],
    'compara con otra gente': [/\bmucha gente\b/i, /\bcasi nadie\b/i, /\beso es lo raro\b/i],
    'afirma una causa que nadie midió': [
      /\bdormiste mal\b/i,
      /\bestás cansad[oa]\b/i,
      /\bdonde estabas\b/i,
      /\bcon la técnica puesta\b/i,
    ],
    // La app no pregunta el género, y está bien que no lo haga. Entonces Lyra
    // no puede suponerlo, ni para un lado ni para el otro: "con calma" en vez
    // de "tranquilo" o "tranquila", "qué bueno verte" en vez de "bienvenido".
    'le supone un género a la persona': [
      /\btranquil[oa]\b/i,
      /\bbienvenid[oa]\b/i,
      /\bcansad[oa]\b/i,
      /\bvestid[oa]\b/i,
      /\b(terminaste|seguís|te sentís|estás) enter[oa]\b/i,
      /\bestás (list[oa]|preparad[oa]|sol[oa])\b/i,
      /\b(el|la) que empezó\b/i,
      /\bestar quiet[oa]\b/i,
    ],
  }
  for (const [regla, patrones] of Object.entries(REGLAS)) {
    it(`ninguna ${regla}`, () => {
      for (const linea of TODAS) {
        if (PERMITIDAS.has(linea)) continue
        for (const p of patrones) expect(p.test(linea), `${regla}: "${linea}"`).toBe(false)
      }
    })
  }

  it('ninguna pone un rótulo de persona', () => {
    // La regla 2 —lo que hiciste, no lo que sos— era la única de las cuatro
    // sin test, y por eso salía "Ya sos alguien que entrena" después de la
    // primera sesión. La identidad la cuenta el número de sesiones, que es un
    // dato; una frase al azar no le pone un rótulo a nadie. Patrones de la
    // revisión de adherencia de octubre de 2026, que no marcan "No fallaste
    // vos" ni "Menos repeticiones no es menos vos".
    const rotulos = [
      /\bsos (alguien|una persona|constante|disciplinad)/i,
      /\bya no sos\b/i,
      /\bsos (el|la) que\b/i,
    ]
    for (const linea of TODAS) {
      for (const p of rotulos) expect(p.test(linea), `rótulo de persona: "${linea}"`).toBe(false)
    }
  })

  it('las excepciones existen: una permitida que ya no está no protege nada', () => {
    for (const linea of PERMITIDAS.keys()) expect(TODAS, linea).toContain(linea)
  })

  it('ninguna habla de la comida como dieta, castigo o moral', () => {
    // La lista de lo que el diario no dice nunca, de la revisión de nutrición
    // de octubre de 2026, vale también para Lyra. "Hoy comer bien es tu
    // entrenamiento" estaba en el banco del descanso: "bien" y "mal" le ponen
    // moral a la comida, y a quien la comida le hace mal eso le pesa.
    const prohibidas = [
      /\bkcal\b/i,
      /\bdéficit\b/i,
      /\bquemar grasa\b/i,
      /\blimpi[oa]s?\b/i,
      /\bte pasaste\b/i,
      // Sin `\b` al final: en una expresión sin `u`, la ó no es letra y el
      // borde nunca se cumpliría.
      /\bte faltó/i,
      /\btrampa\b/i,
      /\bdetox\b/i,
      /\binflamatori/i,
      /\bBCAA\b/i,
      /\bquemador/i,
      /\bcolágeno\b/i,
      /\bayuno\b/i,
      /% de grasa/i,
      /\bIMC\b/,
      /\bcomer (bien|mal)\b/i,
    ]
    for (const linea of TODAS) {
      for (const patron of prohibidas) {
        expect(patron.test(linea), `comida con moral o dieta: "${linea}"`).toBe(false)
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
  // Con historia de sobra, para que las que piden sesiones también cuenten:
  // estos tests miden el azar y la memoria, no las condiciones.
  const CON_HISTORIA = 1000

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
        salieron.add(fraseDe(grupo.momento, i / pasos, [], CON_HISTORIA)!.texto)
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
        const elegida = fraseDe(grupo.momento, (i * 0.37) % 1, dichas, CON_HISTORIA)!
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

describe('las frases que piden historia', () => {
  /** Todas las que pueden salir en un momento, recorriendo el azar entero. */
  function alcanzables(momento: Momento, sesiones: number): Set<string> {
    const salieron = new Set<string>()
    const pasos = 400
    for (let i = 0; i < pasos; i++) salieron.add(fraseDe(momento, i / pasos, [], sesiones)!.texto)
    return salieron
  }

  it('cada condición apunta a una frase que existe', () => {
    // Si alguien reescribe la frase y no la condición, la condición deja de
    // aplicarse sin avisar y la frase vuelve a salir el primer día.
    for (const [linea, desde] of DESDE_SESIONES) {
      expect(TODAS, linea).toContain(linea)
      expect(desde, linea).toBeGreaterThan(0)
    }
  })

  it('no sale antes de tiempo, y a partir de su número sí', () => {
    for (const grupo of FRASES) {
      for (const linea of grupo.lineas) {
        const desde = DESDE_SESIONES.get(linea)
        if (desde === undefined) continue
        expect(alcanzables(grupo.momento, desde - 1).has(linea), `${linea} con ${desde - 1}`).toBe(false)
        expect(alcanzables(grupo.momento, desde).has(linea), `${linea} con ${desde}`).toBe(true)
      }
    }
  })

  it('el primer día, ninguna habla de una vez anterior', () => {
    // Lo que puede salir con cero sesiones: Hoy al abrir y en un día de
    // descanso. El cierre y la constancia salen con una sesión como mínimo,
    // la que se acaba de hacer, así que ahí "anterior" quiere decir otra.
    const HABLA_DE_ANTES = [
      /\botra vez\b/i,
      /\bde nuevo\b/i,
      /\botra más\b/i,
      /\buna sesión más\b/i,
      /\bllevás\b/i,
      /\blas que ya hiciste\b/i,
      /\banteriores\b/i,
      /\bvolviste\b/i,
      /\bsumaste otra\b/i,
      /\botro ladrillo\b/i,
      /\botra vuelta\b/i,
      /\btermine lo que empezaste\b/i,
    ]
    const casos: [Momento, number][] = [
      ['abrir', 0],
      ['descanso', 0],
      ['esfuerzo', 1],
      ['reencuadre', 1],
      ['cierre', 1],
      ['constancia', 1],
    ]
    for (const [momento, sesiones] of casos) {
      for (const linea of alcanzables(momento, sesiones)) {
        for (const p of HABLA_DE_ANTES) {
          expect(p.test(linea), `${momento} con ${sesiones}: "${linea}"`).toBe(false)
        }
      }
    }
  })

  it('lo que habla de costumbre no sale antes de diez sesiones', () => {
    // "Semana tras semana, ahí seguís" después de la primera sesión es Lyra
    // desmintiendo el 001 que la pantalla tiene arriba. Diez es el número de
    // "llevás más de las que creías".
    const HABLA_DE_COSTUMBRE = [
      /\bcostumbre\b/i,
      /\bsemana tras semana\b/i,
      /\bse te está haciendo\b/i,
      /\bdejó de ser un intento\b/i,
      /\bllevás más\b/i,
    ]
    for (const grupo of FRASES) {
      for (const linea of alcanzables(grupo.momento, 9)) {
        for (const p of HABLA_DE_COSTUMBRE) {
          expect(p.test(linea), `${grupo.momento} con 9: "${linea}"`).toBe(false)
        }
      }
    }
  })

  it('sin decir cuántas sesiones hay, no sale ninguna condicionada', () => {
    // El valor por defecto es el prudente: una pantalla que se olvida de
    // pasarlo pierde frases, no dice una falsa.
    for (const grupo of FRASES) {
      const pasos = grupo.lineas.length * 4
      for (let i = 0; i < pasos; i++) {
        const texto = fraseDe(grupo.momento, i / pasos)!.texto
        expect(DESDE_SESIONES.has(texto), texto).toBe(false)
      }
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

  it('en una sesión densa el banco del final también se alcanza', () => {
    // El test de arriba usaba `{faltan: 2, indice: 3, total: 4}`, una
    // combinación que en una sesión densa NO PUEDE OCURRIR: el plan denso es
    // [duro, bajada, duro, bajada…], la última entrada es una bajada de dos
    // series, y su único descanso tiene siempre una serie por delante. O sea
    // que daba confianza falsa: la rama pasaba el test y no se veía nunca.
    const grupo = FRASES.find((g) => g.momento === 'final')!
    const ULTIMA_ENTRADA_DENSA = { faltan: 1, indice: 7, total: 8 }
    for (const azar of AZARES) {
      const dicho = dichoDelDescanso({ ...base, ...ULTIMA_ENTRADA_DENSA, azar })
      expect(grupo.lineas, `azar=${azar}`).toContain(dicho!.texto)
    }
  })

  it('la última serie de un ejercicio del medio sigue hablando de esa serie', () => {
    // El arreglo no puede llevarse puesto el caso común: en cualquier ejercicio
    // que no sea el último, una serie por delante sigue siendo "queda una".
    const grupo = FRASES.find((g) => g.momento === 'ultima')!
    for (const azar of AZARES) {
      const dicho = dichoDelDescanso({ ...base, faltan: 1, indice: 1, total: 8, azar })
      expect(grupo.lineas, `azar=${azar}`).toContain(dicho!.texto)
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
