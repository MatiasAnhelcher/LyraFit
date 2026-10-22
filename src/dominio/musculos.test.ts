import { describe, expect, it } from 'vitest'
import { CADENAS, EJERCICIOS, FUERA_DE_CADENA, POR_ID } from './biblioteca'
import { alcanza, equipoDe } from './equipo'
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
  SEMANA_SIN_PLAN,
  SIN_COBERTURA,
  SIN_PRIMARIO,
  dichoSinDatos,
  loQueFalta,
  loQueFaltaSinPlan,
  musculosAlcanzables,
  principalMasCargado,
  NECESITAN_BARRA_CARGABLE,
  musculosDe,
  musculosDelPatron,
  patronesDe,
  seriesPorMusculo,
  type Aporte,
  type Musculo,
} from './musculos'
import type { Equipo, Patron, Serie, Sesion } from './tipos'

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
/*
 * Los ids de una CADENA, que no es lo mismo que los de un patrón.
 *
 * Antes era `filter(e => e.patron === patron)`, y daba igual porque todo
 * ejercicio estaba en una cadena. Con los de la barra cargable dejó de dar
 * igual: comparten patrón con los eslabones y no comparten la regla —el remo
 * con barra es tracción y no es lat-dominante, la elevación de talones es
 * piernas y no es cuádriceps-dominante—. Filtrar por patrón los metía adentro
 * de reglas escritas para una progresión por palanca.
 *
 * Y después fue "el patrón menos `FUERA_DE_CADENA`", que tampoco alcanza: esa
 * lista es la de la barra con discos, y las variantes y los accesorios de la
 * reestructura tienen patrón, no están en ninguna cadena y no son de la barra
 * con discos. Restarlos de una lista que no los nombra los metía de vuelta en
 * las reglas de los eslabones. La pertenencia a una cadena la dice `CADENAS`,
 * y solo `CADENAS`.
 */
const EN_UNA_CADENA = new Set(CADENAS.flatMap((c) => c.ejercicios))
const deLaCadena = (patron: Patron) => CADENAS.find((c) => c.patron === patron)?.ejercicios ?? []

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
    /*
     * Los cuatro de la barra cargable tienen su propia lista, y no es un
     * agujero en la de arriba: son los que ENSANCHAN cada patrón, que es
     * exactamente para lo que entraron.
     *
     * El press militar mete el empuje vertical en un patrón que hasta hoy era
     * todo horizontal; el remo con barra mete la tracción horizontal cargada;
     * la elevación de talones mete la flexión plantar en un patrón de piernas
     * que era todo cuádriceps. Si compartieran lista con los eslabones, la
     * regla de arriba quedaría tan ancha que no agarraría el error que existe
     * para agarrar — un vector copiado a la cadena equivocada.
     *
     * El deltoide lateral NO está acá: en el press militar es secundario, que
     * es lo correcto. Un press está limitado por el deltoide anterior y el
     * tríceps.
     */
    const PERMITIDOS_CON_BARRA: Record<Patron, Musculo[]> = {
      // El tríceps como primario del empuje ya estaba permitido arriba
      // (flexión diamante, flexión a una mano) y el bíceps como primario de
      // tracción también (dominada a un brazo asistida). Lo que agregan el
      // curl y la extensión no es un músculo nuevo: es ACCESO — los dos
      // ejercicios que los limitaban están casi al final de sus cadenas.
      empuje: ['deltoide-anterior', 'triceps'],
      traccion: ['espalda-media', 'dorsal', 'biceps'],
      piernas: ['gemelo'],
      bisagra: ['gluteo-mayor', 'isquiotibial'],
      core: [],
    }
    for (const ejercicio of EJERCICIOS) {
      // Un eslabón, por `CADENAS`; uno de la barra con discos, por su lista. Lo
      // que no es ninguna de las dos cosas —una variante o un accesorio— no se
      // mide con la regla de otro: falla acá hasta que tenga la suya, con su
      // razón escrita.
      const lista = EN_UNA_CADENA.has(ejercicio.id)
        ? PERMITIDOS[ejercicio.patron]
        : FUERA_DE_CADENA.has(ejercicio.id)
          ? PERMITIDOS_CON_BARRA[ejercicio.patron]
          : undefined
      expect(lista, `${ejercicio.id} no es eslabón ni de la barra con discos`).toBeDefined()
      for (const musculo of primariosDe(ejercicio.id)) {
        expect(lista, `${ejercicio.id} · ${musculo}`).toContain(musculo)
      }
    }
  })

  it('la pertenencia a una cadena sale de CADENAS', () => {
    // Las reglas de los eslabones (el empuje empuja, la tracción no da
    // empuje…) recorren exactamente los ids de cada cadena, en su orden.
    for (const cadena of CADENAS) {
      expect(deLaCadena(cadena.patron)).toEqual(cadena.ejercicios)
      for (const id of cadena.ejercicios) {
        expect(POR_ID.get(id)?.patron, `${id} está en la cadena de ${cadena.patron}`).toBe(
          cadena.patron,
        )
      }
    }
    // Lo que comparte patrón y no está en la cadena no entra en sus reglas:
    // la barra con discos hoy, las variantes y los accesorios mañana.
    for (const id of FUERA_DE_CADENA) {
      const patron = POR_ID.get(id)!.patron
      expect(deLaCadena(patron), id).not.toContain(id)
      expect(EN_UNA_CADENA.has(id), id).toBe(false)
    }
    expect(EN_UNA_CADENA.size).toBe(47)
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

describe('el principal más cargado, para la prefatiga', () => {
  it('suma las series de antes por su aporte en cada principal', () => {
    // La diamante tiene dos principales, pectoral y tríceps. Cuatro series de
    // flexión completa le dan 4 al pectoral y 2 al tríceps.
    expect(principalMasCargado('flexion-diamante', [reg('flexion-completa', 4)])).toEqual({
      musculo: 'pectoral',
      series: 4,
    })
    // Tres de diamante y cuatro de rodillas son siete de pectoral, de dos
    // ejercicios distintos: los músculos no saben de ejercicios.
    expect(
      principalMasCargado('flexion-completa', [reg('flexion-diamante', 3), reg('flexion-rodillas', 4)]),
    ).toEqual({ musculo: 'pectoral', series: 7 })
  })

  it('el estabilizador no suma, y lo de otro grupo tampoco', () => {
    // La flexión completa toca al glúteo con 0,25: no es dosis de nada.
    expect(principalMasCargado('puente-gluteos', [reg('flexion-completa', 6)])).toBeNull()
    expect(principalMasCargado('flexion-completa', [reg('remo-australiano-medio', 6)])).toBeNull()
    expect(principalMasCargado('flexion-completa', [])).toBeNull()
  })

  it('un ejercicio sin vector no tiene principales', () => {
    expect(principalMasCargado('no-existe', [reg('flexion-completa', 6)])).toBeNull()
  })
})

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

  it('los que necesitan barra cargable son exactamente los que no están en una cadena', () => {
    /*
     * Hoy las dos listas coinciden y no es casualidad: todo lo que progresa
     * por peso necesita una barra con discos, y todo lo que necesita una barra
     * con discos progresa por peso.
     *
     * Son dos listas igual porque responden preguntas distintas
     * —`FUERA_DE_CADENA` es "¿tiene eslabón anterior?" y
     * `NECESITAN_BARRA_CARGABLE` es "¿puedo hacerlo con lo que tengo?"— y la
     * que importa acá es la segunda: al agregar el curl y la extensión me
     * olvidé de esta lista, y el resultado fue que la app daba por entrenable
     * el antebrazo de alguien que no tiene una barra con discos. Lo agarró el
     * test del agarre y por eso este existe.
     */
    expect([...NECESITAN_BARRA_CARGABLE].sort()).toEqual([...FUERA_DE_CADENA].sort())
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

  it('con menos de tres días de práctica no afirma nada', () => {
    const dos = [sesion('2026-09-20', [reg('flexion-completa', 3)]), sesion('2026-09-18', [reg('flexion-completa', 3)])]
    expect(loQueFalta({ ...base, sesiones: dos })).toEqual({ clase: 'sin-datos', dias: 2 })
    expect(MINIMO_PARA_OPINAR).toBe(3)
  })

  it('cuenta días con sesión: tres en una tarde siguen siendo un día', () => {
    const tarde = [9, 13, 19].map((h) =>
      sesion('2026-09-20', [reg('flexion-completa', 3)], {
        id: `tarde-${h}`,
        finalizadaEn: new Date(`2026-09-20T${String(h).padStart(2, '0')}:00:00`).getTime(),
      }),
    )
    expect(loQueFalta({ ...base, sesiones: tarde })).toEqual({ clase: 'sin-datos', dias: 1 })
    // Con un segundo día, todavía no; con el tercero, ya opina.
    const segundo = sesion('2026-09-18', [reg('flexion-completa', 3)])
    expect(loQueFalta({ ...base, sesiones: [...tarde, segundo] }).clase).toBe('sin-datos')
    const tercero = sesion('2026-09-16', [reg('flexion-completa', 3)])
    expect(loQueFalta({ ...base, sesiones: [...tarde, segundo, tercero] }).clase).not.toBe(
      'sin-datos',
    )
  })

  it('cuenta solo los días de estas cuatro semanas, y lo dice en días de práctica', () => {
    // Meses de historial y nada en la ventana: cero días, no "N sesiones".
    const viejas = ['2026-08-01', '2026-07-20', '2026-07-10'].map((fecha) =>
      sesion(fecha, [reg('flexion-completa', 3)], { id: `vieja-${fecha}` }),
    )
    expect(loQueFalta({ ...base, sesiones: viejas })).toEqual({ clase: 'sin-datos', dias: 0 })
    expect(dichoSinDatos(0)).toBe(
      'Sin sesiones en las últimas cuatro semanas, todavía no hay con qué decir que te falte nada.',
    )
    expect(dichoSinDatos(1)).toBe(
      'Con un día de práctica en las últimas cuatro semanas, todavía no hay con qué decir que te falte nada.',
    )
    expect(dichoSinDatos(2)).toMatch(/^Con dos días de práctica /)
    for (let dias = 0; dias < MINIMO_PARA_OPINAR; dias++) {
      expect(dichoSinDatos(dias)).not.toMatch(/sesiones? (todavía|no)|\d+ sesion/)
    }
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

  it('una movilidad no es un día de práctica', () => {
    // Dos días de fuerza y uno de movilidad son dos días con qué opinar: la
    // movilidad no trae series, y con ella el umbral se cumpliría sin datos.
    const dos = [sesion('2026-09-20', [reg('flexion-completa', 3)]), sesion('2026-09-18', [reg('flexion-completa', 3)])]
    const conMovilidad = [...dos, movilidadDe('2026-09-16')]
    expect(loQueFalta({ ...base, sesiones: conMovilidad })).toEqual({ clase: 'sin-datos', dias: 2 })
  })
})

/** Una movilidad: se guarda aparte de los registros y no cuenta como sesión. */
const movilidadDe = (fecha: string): Sesion =>
  sesion(fecha, [], {
    id: `movilidad-${fecha}`,
    tipo: 'fuelle',
    origen: { clase: 'movilidad', sector: 'espalda', nombre: 'Movilidad de espalda' },
    movilidad: [{ ejercicioId: 'gato-vaca', logrado: [10, 10] }],
  })

/**
 * Lo que la semana dejó atrás, sin plan semanal.
 *
 * Es el último bloque del mix de Cuerpo completo para quien entrena sin plan
 * (§6.3). Lo que se puede romper sin que se note: que mire las cuatro semanas
 * y no la última, que proponga un músculo que el equipo no deja trabajar como
 * principal, o que la entrada en calor cuente como trabajo.
 */
describe('lo que la semana dejó atrás, sin plan', () => {
  const HOY_SIN_PLAN = '2026-09-24'
  /** Con lo dado por tenido y la barra de dominadas, sin discos. */
  const EN_CASA = equipoDe({})
  /** Lo mismo, con la barra cargable. */
  const CON_DISCOS = equipoDe({ cargaMaximaKg: 40 })

  /** Los ids del 23 al 18 de septiembre: seis días, todos dentro de la semana. */
  const diasDeLaSemana = ['2026-09-23', '2026-09-22', '2026-09-21', '2026-09-20', '2026-09-19', '2026-09-18']

  /** Una semana pareja de los eslabones, de la misma fixture que `loQueFalta` dice pareja. */
  const PAREJA = [
    'flexion-completa',
    'flexion-declinada',
    'dominada-completa',
    'sentadilla-completa',
    'plancha-brazo-alternado',
    'elevacion-piernas-suelo',
    'puente-una-pierna-elevado',
    'remo-australiano-medio',
  ]
  const semanaPareja = (): Sesion[] =>
    diasDeLaSemana.map((fecha) => sesion(fecha, PAREJA.map((id) => reg(id, 3)), { id: `pareja-${fecha}` }))

  /** Los músculos que algún ejercicio al alcance tiene como principal. */
  const limitables = (equipo: readonly Equipo[]) =>
    new Set(
      EJERCICIOS.filter((e) => alcanza(e, equipo)).flatMap((e) =>
        Object.entries(APORTE[e.id] ?? {})
          .filter(([, aporte]) => aporte === 1)
          .map(([m]) => m as Musculo),
      ),
    )

  it('mira la última semana, la misma de las zonas', () => {
    expect(SEMANA_SIN_PLAN).toBe(7)
  })

  it('con menos de tres días de práctica en las cuatro semanas no afirma nada', () => {
    const dos = [sesion('2026-09-20', [reg('flexion-completa', 3)]), sesion('2026-09-10', [reg('flexion-completa', 3)])]
    expect(loQueFaltaSinPlan(dos, EN_CASA, HOY_SIN_PLAN)).toEqual({ clase: 'sin-datos', dias: 2 })
    // La movilidad no suma un día.
    expect(loQueFaltaSinPlan([...dos, movilidadDe('2026-09-22')], EN_CASA, HOY_SIN_PLAN)).toEqual({
      clase: 'sin-datos',
      dias: 2,
    })
    expect(loQueFaltaSinPlan([], EN_CASA, HOY_SIN_PLAN)).toEqual({ clase: 'sin-datos', dias: 0 })
  })

  it('una semana pareja no agrega nada', () => {
    expect(loQueFaltaSinPlan(semanaPareja(), EN_CASA, HOY_SIN_PLAN)).toEqual({ clase: 'parejo' })
  })

  it('señala lo que la semana dejó en cero, y lo de hace dos semanas no cuenta', () => {
    // Cuatro semanas de core, pero esta semana nada: lo de antes no tapa la
    // semana. Con plan, `loQueFalta` mira las cuatro y no lo vería.
    const sinCoreEstaSemana = diasDeLaSemana.map((fecha) =>
      sesion(
        fecha,
        ['flexion-completa', 'dominada-completa', 'sentadilla-completa', 'puente-una-pierna-elevado'].map((id) =>
          reg(id, 3),
        ),
        { id: `sin-core-${fecha}` },
      ),
    )
    const coreDeAntes = ['2026-09-10', '2026-09-08', '2026-09-03'].map((fecha) =>
      sesion(fecha, [reg('elevacion-piernas-suelo', 6), reg('plancha-brazo-alternado', 6)], {
        id: `core-${fecha}`,
      }),
    )
    const falta = loQueFaltaSinPlan([...sinCoreEstaSemana, ...coreDeAntes], EN_CASA, HOY_SIN_PLAN)
    expect(falta.clase).toBe('flojo')
    if (falta.clase !== 'flojo') return
    expect(falta.series).toBe(0)
    expect(limitables(EN_CASA).has(falta.musculo)).toBe(true)
    expect(NO_SE_PROPONE).not.toContain(falta.musculo)
  })

  it('el equipo decide qué se puede nombrar: el gemelo, solo con discos', () => {
    // El gemelo lo limita un solo ejercicio, la elevación de talones con barra
    // cargable. En casa no hay accesorio que proponerle, así que nombrarlo
    // sería mandar a buscar algo que no hay; con discos, es lo que la semana
    // pareja dejó atrás.
    expect(limitables(EN_CASA).has('gemelo')).toBe(false)
    expect(limitables(CON_DISCOS).has('gemelo')).toBe(true)
    expect(loQueFaltaSinPlan(semanaPareja(), EN_CASA, HOY_SIN_PLAN)).toEqual({ clase: 'parejo' })
    const conDiscos = loQueFaltaSinPlan(semanaPareja(), CON_DISCOS, HOY_SIN_PLAN)
    expect(conDiscos).toEqual({ clase: 'flojo', musculo: 'gemelo', patron: 'piernas', series: 0 })
  })

  it('nunca nombra algo que el equipo no deja trabajar como principal', () => {
    const historias: Sesion[][] = [
      semanaPareja(),
      diasDeLaSemana.map((f) => sesion(f, [reg('flexion-completa', 3)], { id: `f-${f}` })),
      diasDeLaSemana.map((f) => sesion(f, [reg('sentadilla-completa', 3), reg('plancha', 3)], { id: `s-${f}` })),
    ]
    const equipos: readonly Equipo[][] = [EN_CASA, CON_DISCOS, equipoDe({ tieneBarra: false })]
    for (const historia of historias) {
      for (const equipo of equipos) {
        const falta = loQueFaltaSinPlan(historia, equipo, HOY_SIN_PLAN)
        expect(falta.clase).not.toBe('patron-ausente')
        if (falta.clase !== 'flojo') continue
        expect(limitables(equipo).has(falta.musculo), falta.musculo).toBe(true)
        expect(NO_SE_PROPONE).not.toContain(falta.musculo)
      }
    }
  })

  it('la entrada en calor no es trabajo de la semana', () => {
    // Tres series de calentamiento de remo no ponen la espalda al día: si
    // contaran como las de trabajo, el dorsal dejaría de ser lo que quedó
    // atrás (con remo de trabajo, lo que queda atrás son los oblicuos).
    const sinEspalda = diasDeLaSemana.map((fecha) =>
      sesion(fecha, ['flexion-completa', 'sentadilla-completa', 'puente-una-pierna-elevado', 'plancha'].map((id) => reg(id, 3)), {
        id: `sin-espalda-${fecha}`,
      }),
    )
    const antes = loQueFaltaSinPlan(sinEspalda, EN_CASA, HOY_SIN_PLAN)
    expect(antes).toMatchObject({ clase: 'flojo', musculo: 'dorsal', series: 0 })
    const conCalentamiento = sinEspalda.map((s) => ({
      ...s,
      registros: [...s.registros, reg('remo-australiano-medio', 3, { calentamiento: true })],
    }))
    expect(loQueFaltaSinPlan(conCalentamiento, EN_CASA, HOY_SIN_PLAN)).toEqual(antes)
  })

  it('la misma semana da siempre lo mismo', () => {
    const historia = semanaPareja()
    const primera = loQueFaltaSinPlan(historia, CON_DISCOS, HOY_SIN_PLAN)
    expect(loQueFaltaSinPlan([...historia].reverse(), CON_DISCOS, HOY_SIN_PLAN)).toEqual(primera)
    expect(loQueFaltaSinPlan(historia, new Set(CON_DISCOS), HOY_SIN_PLAN)).toEqual(primera)
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
