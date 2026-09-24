import { describe, expect, it } from 'vitest'
import { CADENAS, EJERCICIOS, POR_ID } from './biblioteca'
import { RUTINA_POR_ID } from './rutinas'
import {
  APORTE,
  COBERTURA_FRAGIL,
  MINIMO_PARA_OPINAR,
  MISMO_REPARTO,
  MUSCULOS_CUBIERTOS,
  NECESITAN_BARRA,
  NO_SE_PROPONE,
  NOMBRE_MUSCULO,
  PISO_DE_DOSIS,
  PROPORCION_QUE_PREOCUPA,
  REGIMEN,
  SIN_COBERTURA,
  SIN_PRIMARIO,
  loQueFalta,
  musculosAlcanzables,
  musculosDe,
  musculosDelPatron,
  patronesDe,
  seriesPorMusculo,
  type Aporte,
  type Musculo,
} from './musculos'
import type { Patron, Serie, Sesion } from './tipos'

/**
 * Que la matriz no se degrade.
 *
 * Una tabla de cuarenta y siete vectores escrita a mano se pudre de una forma
 * conocida: alguien agrega un músculo "por las dudas", alguien sube un 0,5 a 1
 * para que un test pase, alguien copia el vector de un ejercicio al de al lado.
 * Estos tests son los fusibles de esos tres caminos.
 *
 * El más valioso es "los sin cobertura no se cuelan": el día que aparezca una
 * progresión de empuje vertical, falla y obliga a mover el deltoide lateral de
 * la lista de huecos a la de cubiertos, y a reescribir lo que la pantalla dice.
 * El hueco no se puede cerrar en silencio.
 */

const VALORES: Aporte[] = [1, 0.5, 0.25]
const TODOS_LOS_MUSCULOS = Object.keys(NOMBRE_MUSCULO) as Musculo[]

const vector = (id: string) => APORTE[id] ?? {}
const entradas = (id: string) => Object.entries(vector(id)) as [Musculo, Aporte][]
const dosisDe = (id: string) => entradas(id).filter(([, a]) => a >= PISO_DE_DOSIS)
const primariosDe = (id: string) => entradas(id).filter(([, a]) => a === 1).map(([m]) => m)
const deLaCadena = (patron: Patron) => EJERCICIOS.filter((e) => e.patron === patron).map((e) => e.id)

describe('la matriz, por dentro', () => {
  it('los cuarenta y siete tienen vector, y ningún vector sobra', () => {
    for (const ejercicio of EJERCICIOS) {
      expect(APORTE[ejercicio.id], `${ejercicio.id} no tiene vector`).toBeDefined()
    }
    for (const id of Object.keys(APORTE)) {
      expect(POR_ID.get(id), `${id} tiene vector y no existe en la biblioteca`).toBeDefined()
    }
  })

  it('ningún vector está vacío, y todos tienen al menos un primario', () => {
    for (const id of Object.keys(APORTE)) {
      expect(entradas(id).length, id).toBeGreaterThan(0)
      expect(primariosDe(id).length, `${id} no tiene ningún músculo primario`).toBeGreaterThan(0)
    }
  })

  it('los valores son solo 1, 0,5 y 0,25', () => {
    // El tipo ya lo garantiza al compilar. El test lo documenta y cubre el día
    // que esto entre por un JSON en vez de por el código.
    for (const id of Object.keys(APORTE)) {
      for (const [musculo, aporte] of entradas(id)) {
        expect(VALORES, `${id} · ${musculo}`).toContain(aporte)
      }
    }
  })

  it('todo músculo cubierto lo carga algún ejercicio con 0,5 o más', () => {
    // Es la regla que decide quién entra a la lista, verificada en vez de
    // prometida.
    for (const musculo of MUSCULOS_CUBIERTOS) {
      const alguno = Object.keys(APORTE).some((id) => (vector(id)[musculo] ?? 0) >= PISO_DE_DOSIS)
      expect(alguno, `${musculo} está en la lista y nadie lo carga`).toBe(true)
    }
  })

  it('cubiertos y sin cobertura parten el conjunto entero, sin superponerse', () => {
    const sin = SIN_COBERTURA.map((x) => x.musculo)
    expect([...MUSCULOS_CUBIERTOS, ...sin].sort()).toEqual([...TODOS_LOS_MUSCULOS].sort())
    expect(MUSCULOS_CUBIERTOS.filter((m) => sin.includes(m))).toEqual([])
  })

  it('los que no tienen cobertura no se cuelan', () => {
    // El fusible más importante del archivo. Hoy son el deltoide lateral —no hay
    // un solo empuje por encima de la cabeza en los cuarenta y siete— y el
    // gemelo —no hay flexión plantar—. El día que alguien agregue fondos o una
    // progresión de vertical, este test falla y obliga a decirlo en la pantalla.
    for (const { musculo } of SIN_COBERTURA) {
      for (const id of Object.keys(APORTE)) {
        expect(vector(id)[musculo] ?? 0, `${id} carga ${musculo}`).toBeLessThan(PISO_DE_DOSIS)
      }
    }
  })

  it('los músculos que ningún ejercicio limita son exactamente los declarados', () => {
    // NO se escribe "todo músculo cubierto tiene un primario", que es FALSO:
    // cinco entran por 0,5 y ninguno limita una serie. Escribirlo forzaría a
    // inflar un 0,5 a 1 para que pase, que es la forma exacta en que estas
    // tablas se degradan. Con el conjunto declarado el fusible corta en las dos
    // direcciones.
    const conPrimario = new Set(Object.keys(APORTE).flatMap(primariosDe))
    const sin = MUSCULOS_CUBIERTOS.filter((m) => !conPrimario.has(m))
    expect(sin.sort()).toEqual([...SIN_PRIMARIO].sort())
  })

  it('la cobertura frágil es exactamente la declarada', () => {
    const cuantos = new Map<Musculo, string[]>()
    for (const id of Object.keys(APORTE)) {
      for (const [musculo] of dosisDe(id)) {
        cuantos.set(musculo, [...(cuantos.get(musculo) ?? []), id])
      }
    }
    const frágiles = [...cuantos.entries()]
      .filter(([, ids]) => ids.length === 1)
      .map(([musculo, ids]) => ({ musculo, unico: ids[0]! }))
    expect(frágiles).toEqual(COBERTURA_FRAGIL)
  })

  it('los grupos con el mismo reparto son exactamente los declarados', () => {
    // Fusible en las dos direcciones: si alguien le agrega un músculo a la
    // sentadilla con pausa y no al pistol, el test le pregunta por qué.
    const porHuella = new Map<string, string[]>()
    for (const id of Object.keys(APORTE)) {
      const huella = JSON.stringify(
        Object.entries(vector(id)).sort(([a], [b]) => a.localeCompare(b)),
      )
      porHuella.set(huella, [...(porHuella.get(huella) ?? []), id])
    }
    const grupos = [...porHuella.values()].filter((g) => g.length > 1).map((g) => [...g].sort())
    expect(grupos.sort()).toEqual(MISMO_REPARTO.map((g) => [...g].sort()).sort())
  })

  it('ningún vector se infla: como mucho tres primarios y suma entre 1,25 y 5', () => {
    // Es el test que se rompe primero cuando alguien empieza a acreditar
    // músculos por cortesía.
    for (const id of Object.keys(APORTE)) {
      const suma = entradas(id).reduce((t, [, a]) => t + a, 0)
      expect(suma, `${id} suma ${suma}`).toBeGreaterThanOrEqual(1.25)
      expect(suma, `${id} suma ${suma}`).toBeLessThanOrEqual(5)
      expect(primariosDe(id).length, `${id}`).toBeLessThanOrEqual(3)
    }
  })

  it('el 0,25 no mete músculos que nadie entrene', () => {
    for (const id of Object.keys(APORTE)) {
      for (const [musculo, aporte] of entradas(id)) {
        if (aporte >= PISO_DE_DOSIS) continue
        const enSerio = Object.keys(APORTE).some((o) => (vector(o)[musculo] ?? 0) >= PISO_DE_DOSIS)
        expect(enSerio, `${musculo} solo aparece como estabilizador`).toBe(true)
      }
    }
  })

  it('el régimen declarado es de ejercicios que existen', () => {
    for (const id of Object.keys(REGIMEN)) {
      expect(POR_ID.get(id), `${id} tiene régimen y no existe`).toBeDefined()
    }
  })

  it('lo que necesita barra existe y es lo que el alta filtra', () => {
    for (const id of NECESITAN_BARRA) {
      expect(POR_ID.get(id), `${id} necesita barra y no existe`).toBeDefined()
    }
    // Las dos cadenas que cuelgan: tracción de la quinta en adelante, y el core
    // de los colgados en adelante. Si aparece un ejercicio nuevo que cuelgue,
    // esta cuenta cambia y hay que decirlo acá.
    expect(NECESITAN_BARRA.size).toBe(10)
  })
})

describe('la matriz, contra la fisiología', () => {
  it('todo primario pertenece al patrón de su cadena', () => {
    // Agarra el error más probable: copiar y pegar un vector en la cadena
    // equivocada.
    const PERMITIDOS: Record<Patron, Musculo[]> = {
      // `oblicuos` está en empuje por la flexión a una mano, y no es un
      // descuido: su propio `resumen` dice que pide "tanto fuerza de pectoral y
      // tríceps como capacidad del core para evitar que el cuerpo rote". La
      // antirrotación es co-limitante ahí, no un extra.
      empuje: ['pectoral', 'deltoide-anterior', 'triceps', 'serrato', 'oblicuos'],
      traccion: ['dorsal', 'espalda-media', 'biceps'],
      piernas: ['cuadriceps'],
      bisagra: ['gluteo-mayor', 'isquiotibial'],
      core: ['recto-abdominal', 'oblicuos', 'psoas', 'dorsal'],
    }
    for (const ejercicio of EJERCICIOS) {
      for (const musculo of primariosDe(ejercicio.id)) {
        expect(PERMITIDOS[ejercicio.patron], `${ejercicio.id} · ${musculo}`).toContain(musculo)
      }
    }
  })

  it('el empuje empuja, y no acredita pierna', () => {
    for (const id of deLaCadena('empuje')) {
      const v = vector(id)
      expect(v.pectoral === 1 || v['deltoide-anterior'] === 1, id).toBe(true)
      expect(v.triceps ?? 0, id).toBeGreaterThanOrEqual(PISO_DE_DOSIS)
      expect(v.cuadriceps, id).toBeUndefined()
      expect(v.isquiotibial, id).toBeUndefined()
    }
  })

  it('la tracción no da cobertura de empuje', () => {
    // Si una cadena de tracción acreditara pectoral o tríceps, el mapa diría
    // que hacés empuje colgándote de una barra.
    for (const id of deLaCadena('traccion')) {
      const v = vector(id)
      expect(v.dorsal, id).toBe(1)
      expect(v.biceps ?? 0, id).toBeGreaterThanOrEqual(PISO_DE_DOSIS)
      expect(v.pectoral, id).toBeUndefined()
      expect(v.triceps, id).toBeUndefined()
    }
  })

  it('en piernas el cuádriceps manda y el isquiotibial nunca es primario', () => {
    // Es la auditoría que hizo nacer la cadena de bisagra, convertida en test:
    // los nueve ejercicios de pierna son dominantes de rodilla, y por eso hizo
    // falta una cadena entera para la mitad de atrás.
    for (const id of deLaCadena('piernas')) {
      expect(vector(id).cuadriceps, id).toBe(1)
      expect(vector(id).isquiotibial ?? 0, id).toBeLessThan(1)
    }
  })

  it('en bisagra manda la cadena de atrás, y el cuádriceps nunca es primario', () => {
    for (const id of deLaCadena('bisagra')) {
      const v = vector(id)
      expect(v['gluteo-mayor'] === 1 || v.isquiotibial === 1, id).toBe(true)
      expect(v.cuadriceps ?? 0, id).toBeLessThan(1)
    }
  })

  it('en core el abdomen es primario en los nueve', () => {
    for (const id of deLaCadena('core')) {
      expect(vector(id)['recto-abdominal'], id).toBe(1)
    }
  })

  it('el flexor de cadera nunca aparece solo en el core', () => {
    // Si el psoas es el limitante real de la elevación de piernas y la app lo
    // presenta como "abdomen", alguien que busca abdomen se lleva flexores de
    // cadera y una lumbar cargada. El mapa nunca puede mostrar volumen de psoas
    // sin su contrapeso de antiextensión.
    //
    // Solo en core: el pistol tiene psoas y no lleva abdomen, y está bien.
    for (const id of deLaCadena('core')) {
      if ((vector(id).psoas ?? 0) < PISO_DE_DOSIS) continue
      expect(vector(id)['recto-abdominal'] ?? 0, id).toBeGreaterThanOrEqual(PISO_DE_DOSIS)
    }
  })

  it('cada cadena cubre lo que su propia descripción promete', () => {
    // El test que evita que la matriz se despegue de la biblioteca: si la
    // descripción dice "isquiotibiales y glúteos", tiene que haberlos.
    const PALABRA: Record<string, Musculo> = {
      pectoral: 'pectoral',
      tríceps: 'triceps',
      bíceps: 'biceps',
      agarre: 'antebrazo',
      cuádriceps: 'cuadriceps',
      isquiotibiales: 'isquiotibial',
      abdomen: 'recto-abdominal',
    }
    for (const cadena of CADENAS) {
      const cubre = new Set(cadena.ejercicios.flatMap(musculosDe))
      for (const [palabra, musculo] of Object.entries(PALABRA)) {
        if (!cadena.descripcion.toLowerCase().includes(palabra)) continue
        expect(cubre.has(musculo), `${cadena.patron} nombra "${palabra}" y no lo cubre`).toBe(true)
      }
    }
  })
})

// ─── Las series efectivas ─────────────────────────────────────────────────

function sesion(fecha: string, registros: Sesion['registros'], extra: Partial<Sesion> = {}): Sesion {
  return {
    id: `${fecha}-${registros.map((r) => r.ejercicioId).join('-')}`,
    fecha,
    finalizadaEn: new Date(`${fecha}T18:00:00`).getTime(),
    duracionSegundos: 1800,
    tipo: 'plan',
    registros,
    ...extra,
  }
}

const reg = (ejercicioId: string, cuantas: number, extra: Record<string, unknown> = {}) => ({
  ejercicioId,
  objetivo: { series: cuantas, cantidad: 10 },
  series: Array.from({ length: cuantas }, () => ({ logrado: 10 }) as Serie),
  ...extra,
})

const HOY = '2026-09-24'

describe('las series efectivas', () => {
  it('suma la serie por el aporte, y solo de 0,5 para arriba', () => {
    // Tres series de flexión completa: pectoral 1 → 3, tríceps 0,5 → 1,5,
    // y el glúteo, que está en 0,25, NO aparece.
    const cuenta = seriesPorMusculo([sesion(HOY, [reg('flexion-completa', 3)])], HOY)
    expect(cuenta.get('pectoral')).toBe(3)
    expect(cuenta.get('triceps')).toBe(1.5)
    expect(cuenta.get('gluteo-mayor')).toBeUndefined()
  })

  it('el estabilizador no le regala cobertura a nadie', () => {
    // Es la decisión que separa un mapa que informa de uno que decora: sin este
    // piso, veinte series de flexiones dirían que entrenaste glúteos.
    const muchas = seriesPorMusculo([sesion(HOY, [reg('flexion-completa', 20)])], HOY)
    expect(muchas.get('gluteo-mayor') ?? 0).toBe(0)
  })

  it('la serie de cierre cuenta, porque es trabajo', () => {
    const conCierre = reg('flexion-completa', 2)
    conCierre.series.push({ logrado: 6, cierre: true })
    expect(seriesPorMusculo([sesion(HOY, [conCierre])], HOY).get('pectoral')).toBe(3)
  })

  it('la bajada cuenta: el motor la saltea, los músculos no', () => {
    const cuenta = seriesPorMusculo(
      [sesion(HOY, [reg('flexion-completa', 3), reg('flexion-inclinada', 2, { bajada: true })])],
      HOY,
    )
    expect(cuenta.get('pectoral')).toBe(5)
  })

  it('las ráfagas no mueven un solo músculo', () => {
    // Contar los burpees como empuje dejaría el pectoral pareciendo servido
    // cuando el trabajo de fuerza no está, que es justo lo que el mapa existe
    // para detectar.
    const densa = sesion(HOY, [], {
      densa: true,
      rafagas: Array.from({ length: 8 }, () => ({
        rafagaId: 'burpee',
        segundos: 45,
        despuesDe: null,
      })),
    })
    expect(seriesPorMusculo([densa], HOY).size).toBe(0)
  })

  it('una serie unilateral es una serie, igual que una bilateral', () => {
    // El cuádriceps de quien hizo tres sentadillas y el de quien hizo tres
    // pistols recibieron tres series cada uno. Contar seis diría que el pistol
    // estimula el doble.
    const bilateral = seriesPorMusculo([sesion(HOY, [reg('sentadilla-completa', 3)])], HOY)
    const unilateral = seriesPorMusculo([sesion(HOY, [reg('pistol-squat', 3)])], HOY)
    expect(unilateral.get('cuadriceps')).toBe(bilateral.get('cuadriceps'))
  })

  it('una serie de plancha vale lo mismo que una de flexiones', () => {
    const plancha = seriesPorMusculo([sesion(HOY, [reg('plancha', 3)])], HOY)
    expect(plancha.get('recto-abdominal')).toBe(3)
  })

  it('fuera de la ventana no suma, y el día 28 ya está afuera', () => {
    const dentro = sesion('2026-08-29', [reg('flexion-completa', 3)]) // 26 días
    const borde = sesion('2026-08-27', [reg('flexion-completa', 3)]) // 28 días
    expect(seriesPorMusculo([dentro], HOY).get('pectoral')).toBe(3)
    expect(seriesPorMusculo([borde], HOY).get('pectoral')).toBeUndefined()
  })

  it('un ejercicio que no está en la biblioteca no rompe nada', () => {
    expect(seriesPorMusculo([sesion(HOY, [reg('inventado', 3)])], HOY).size).toBe(0)
  })
})

describe('lo que se puede entrenar sin barra', () => {
  it('sin barra, el agarre se queda sin un solo ejercicio', () => {
    // Los diez que lo entrenan cuelgan de una. Un mapa que no mire esto le va a
    // recomendar para siempre algo que no puede hacer.
    expect(musculosAlcanzables(true).has('antebrazo')).toBe(true)
    expect(musculosAlcanzables(false).has('antebrazo')).toBe(false)
  })

  it('sin barra igual se puede entrenar la espalda', () => {
    // Los remos australianos no cuelgan: la tracción no desaparece.
    expect(musculosAlcanzables(false).has('dorsal')).toBe(true)
  })
})

// ─── El diagnóstico ───────────────────────────────────────────────────────

const CUERPO_COMPLETO = RUTINA_POR_ID.get('cuerpo-completo')!
const MINIMA = RUTINA_POR_ID.get('minima')!

/** Una semana como la que arma la app, para que el diagnóstico tenga de dónde. */
function semanaDe(ids: string[], cuantas = 4): Sesion[] {
  return ids.flatMap((id, i) =>
    Array.from({ length: cuantas }, (_, n) =>
      sesion(`2026-09-${String(20 - n).padStart(2, '0')}`, [reg(id, 3)], {
        id: `${id}-${i}-${n}`,
      }),
    ),
  )
}

describe('qué te está faltando', () => {
  const base = { hoy: HOY, rutina: CUERPO_COMPLETO, tieneBarra: true }

  it('con menos de tres sesiones no afirma nada', () => {
    const dos = [sesion('2026-09-20', [reg('flexion-completa', 3)]), sesion('2026-09-18', [reg('flexion-completa', 3)])]
    expect(loQueFalta({ ...base, sesiones: dos })).toEqual({ clase: 'sin-datos', sesiones: 2 })
    expect(MINIMO_PARA_OPINAR).toBe(3)
  })

  it('en "La mínima" señala el patrón entero que la rutina no incluye', () => {
    // Es el caso que justifica la pantalla: quien eligió esta rutina no hace
    // piernas, ni core, ni isquiotibiales, y hasta hoy la app no se lo decía.
    const solo = semanaDe(['flexion-completa', 'dominada-completa'])
    const falta = loQueFalta({ ...base, rutina: MINIMA, sesiones: solo })
    expect(falta.clase).toBe('patron-ausente')
    if (falta.clase !== 'patron-ausente') return
    expect(falta.patron).toBe('piernas')
    expect(falta.musculos).toContain('cuadriceps')
    expect(falta.rutinaQueLoCubre).toBe('cuerpo-completo')
  })

  it('el arreglo que propone cubre de verdad el patrón que falta', () => {
    // Si la rutina sugerida no cubriera el hueco, el botón sería una mentira.
    const solo = semanaDe(['flexion-completa', 'dominada-completa'])
    const falta = loQueFalta({ ...base, rutina: MINIMA, sesiones: solo })
    if (falta.clase !== 'patron-ausente') throw new Error('se esperaba patron-ausente')
    const sugerida = RUTINA_POR_ID.get(falta.rutinaQueLoCubre)!
    expect(patronesDe(sugerida).has(falta.patron)).toBe(true)
  })

  it('con una rutina que cubre todo y volumen parejo, no inventa un problema', () => {
    // Un diagnóstico que siempre encuentra algo deja de ser un diagnóstico.
    // Armar esta fixture costó tres intentos, y cada fallo fue información y no
    // un test mal escrito: sin `plancha-brazo-alternado` los oblicuos quedaban
    // en cero, y sin `flexion-declinada` el serrato quedaba a la mitad de todo
    // lo demás. Que una semana pareja sea difícil de armar a mano con esta
    // biblioteca es, en sí, lo que el mapa existe para mostrar.
    const parejo = semanaDe([
      'flexion-completa',
      'flexion-declinada',
      'dominada-completa',
      'sentadilla-completa',
      'plancha-brazo-alternado',
      'elevacion-piernas-suelo',
      'puente-una-pierna-elevado',
      'remo-australiano-medio',
    ])
    expect(loQueFalta({ ...base, sesiones: parejo }).clase).toBe('parejo')
  })

  it('señala el músculo flojo cuando de verdad está atrás', () => {
    // Una rutina que cubre los cinco patrones pero donde el core se saltea:
    // el abdomen queda muy por debajo de la mitad de la mediana.
    const sinCore = semanaDe(
      ['flexion-completa', 'dominada-completa', 'sentadilla-completa', 'puente-una-pierna-elevado'],
      6,
    )
    const falta = loQueFalta({ ...base, sesiones: sinCore })
    expect(falta.clase).toBe('flojo')
    if (falta.clase !== 'flojo') return
    expect(MUSCULOS_CUBIERTOS).toContain(falta.musculo)
    expect(SIN_PRIMARIO).not.toContain(falta.musculo)
    expect(falta.series).toBe(0)
  })

  it('el umbral es la mitad de la mediana, no cualquier diferencia', () => {
    // Sin esto la app señalaría un problema cada vez que alguien se saltea un
    // día, que es la variación normal de una semana.
    expect(PROPORCION_QUE_PREOCUPA).toBe(0.5)
  })

  it('nunca propone el flexor de cadera', () => {
    // "Entrená más los flexores de la cadera" no es un consejo que dé ningún
    // entrenador. El psoas está en el mapa para leerse al lado del abdomen, no
    // como objetivo.
    const sinPsoas = semanaDe(['flexion-completa', 'dominada-completa', 'sentadilla-completa'])
    const falta = loQueFalta({ ...base, sesiones: sinPsoas })
    if (falta.clase === 'flojo') expect(NO_SE_PROPONE).not.toContain(falta.musculo)
  })

  it('nunca propone un músculo que ningún ejercicio entrena de frente', () => {
    // No hay eslabón para "glúteo medio": lo que hay es trabajo unilateral.
    // Proponerlo sería mandar a alguien a buscar algo que no existe.
    for (const sesiones of [semanaDe(['flexion-completa']), semanaDe(['plancha', 'flexion-completa'])]) {
      const falta = loQueFalta({ ...base, sesiones })
      if (falta.clase === 'flojo') expect(SIN_PRIMARIO).not.toContain(falta.musculo)
    }
  })
})

describe('los músculos de cada patrón', () => {
  it('cada patrón entrena algo, y el que se nombra es suyo', () => {
    for (const patron of ['empuje', 'traccion', 'piernas', 'core', 'bisagra'] as Patron[]) {
      expect(musculosDelPatron(patron).length, patron).toBeGreaterThan(0)
    }
  })

  it('los nombres de pantalla están en castellano y sin jerga de gimnasio', () => {
    for (const musculo of TODOS_LOS_MUSCULOS) {
      const nombre = NOMBRE_MUSCULO[musculo]
      expect(nombre.length, musculo).toBeGreaterThan(2)
      expect(nombre, musculo).not.toMatch(/latissimus|rectus|quadriceps|glute[^o]/i)
    }
  })
})
