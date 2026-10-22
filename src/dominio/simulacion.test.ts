/**
 * El test que faltaba.
 *
 * Los tests de `progresion.test.ts` verifican las reglas de a una: dado este
 * avance y este resultado, tiene que salir esta decisión. Eso está bien y no
 * alcanza, porque los dos peores defectos que tuvo este motor no eran reglas
 * mal escritas sino consecuencias de varias reglas correctas actuando juntas a
 * lo largo del tiempo:
 *
 * - una persona que quedaba siempre un poco corta no subía ni bajaba **nunca**,
 *   y recibía la misma frase durante meses;
 * - una persona que cumplía llegaba al último eslabón de una cadena en menos de
 *   cinco semanas, y después no quedaba nada.
 *
 * Ninguno de los dos se ve mirando una decisión. Los dos se ven en trescientos
 * milisegundos si se corre el motor unas decenas de sesiones y se mira qué
 * pasa. Eso es lo que hace este archivo.
 */

import { describe, expect, it } from 'vitest'
import { CADENAS, POR_ID, cadenaDe } from './biblioteca'
import { seAbreHoy } from './anticipacion'
import { sumarDias } from './adherencia'
import {
  CONSOLIDACION,
  MESETA,
  avanceInicial,
  incremento,
  leerLaSesion,
  logradoTipico,
  rendimientoDeSesion,
  siguienteAvance,
} from './progresion'
import type { Avance, Ejercicio, Patron, Serie, Sesion } from './tipos'

interface Paso {
  sesion: number
  ejercicioId: string
  cantidad: number
  logrado: number
  senal: number
  movimiento: string
}

/**
 * Corre el motor `sesiones` veces contra alguien cuya capacidad real está dada
 * por `capacidad`, y devuelve la trayectoria completa.
 *
 * Con `protegida`, todas las lecturas van protegidas (un chequeo flojo, o la
 * prefatiga de una rutina que siempre carga los mismos músculos antes), y la
 * racha de protegidas seguidas se cuenta como la cuenta `leerLaSesion` desde
 * el historial.
 */
function simular(
  patron: Patron,
  capacidad: (e: Ejercicio, sesion: number) => number,
  sesiones: number,
  { protegida = false } = {},
): Paso[] {
  const cadena = cadenaDe(patron)
  const ctx = { cadena, ejercicios: POR_ID }
  let avance: Avance = avanceInicial(cadena, POR_ID, 0)
  const traza: Paso[] = []
  let protegidasSeguidas = 0

  for (let i = 1; i <= sesiones; i++) {
    const ejercicio = POR_ID.get(avance.ejercicioId)!
    const objetivo = avance.objetivoActual
    const logrado = Math.max(0, Math.min(capacidad(ejercicio, i), objetivo.cantidad))
    const series: Serie[] = Array.from({ length: objetivo.series }, () => ({ logrado }))

    const decision = siguienteAvance(
      avance,
      {
        rendimiento: rendimientoDeSesion(objetivo, series),
        tipico: logradoTipico(series),
        ...(protegida ? { protegida, protegidasSeguidas } : {}),
      },
      ctx,
      i,
    )
    protegidasSeguidas = decision.motivo === 'protegida' ? protegidasSeguidas + 1 : 0

    traza.push({
      sesion: i,
      ejercicioId: ejercicio.id,
      cantidad: objetivo.cantidad,
      logrado,
      senal: avance.senal,
      movimiento: decision.movimiento,
    })
    avance = decision.avance
  }

  return traza
}

/** La cantidad máxima de sesiones seguidas con exactamente el mismo objetivo. */
function estancamientoMaximo(traza: Paso[]): number {
  let peor = 0
  let corriendo = 0
  let anterior = ''

  for (const paso of traza) {
    const clave = `${paso.ejercicioId}:${paso.cantidad}`
    corriendo = clave === anterior ? corriendo + 1 : 1
    anterior = clave
    peor = Math.max(peor, corriendo)
  }
  return peor
}

function cambiosDeNivel(traza: Paso[]): number {
  let cambios = 0
  for (let i = 1; i < traza.length; i++) {
    if (traza[i]!.ejercicioId !== traza[i - 1]!.ejercicioId) cambios++
  }
  return cambios
}

/** Capacidad fija por posición en la cadena: cuanto más difícil, menos sale. */
function capacidadHasta(patron: Patron, tope: number) {
  const cadena = cadenaDe(patron)
  return (e: Ejercicio) => {
    const posicion = cadena.ejercicios.indexOf(e.id)
    // Rinde de sobra en los primeros eslabones y cae rápido pasado el tope.
    const distancia = posicion - tope
    if (distancia <= 0) return e.ventana.max + 5
    return Math.max(0, Math.round(e.ventana.min - distancia * 2))
  }
}

describe('el motor nunca se traba', () => {
  it.each(CADENAS.map((c) => c.patron))(
    'en %s, alguien que siempre queda corto igual ve cambios',
    (patron) => {
      // Esta persona hace justo una repetición menos de la que le piden,
      // siempre. Es el caso exacto que dejaba al motor viejo repitiendo la
      // misma frase durante diecisiete semanas.
      const traza = simular(patron, (e) => Math.max(1, e.ventana.min - 1), 60)

      expect(estancamientoMaximo(traza)).toBeLessThanOrEqual(MESETA + 1)
    },
  )

  it.each(CADENAS.map((c) => c.patron))(
    'en %s, nadie se queda clavado tampoco cumpliendo a medias',
    (patron) => {
      const traza = simular(patron, capacidadHasta(patron, 3), 80)
      expect(estancamientoMaximo(traza)).toBeLessThanOrEqual(MESETA + 1)
    },
  )

  // La protección no puede ser una puerta trasera para el mismo defecto: con
  // todas las lecturas protegidas, una floja no contaba nunca y la cadena
  // quedaba con la misma frase para siempre.
  it.each(CADENAS.map((c) => c.patron))(
    'en %s, con todas las lecturas protegidas, alguien que siempre queda corto igual ve cambios',
    (patron) => {
      const traza = simular(patron, (e) => Math.max(1, e.ventana.min - 1), 60, { protegida: true })
      expect(estancamientoMaximo(traza)).toBeLessThanOrEqual(MESETA + 1)
    },
  )

  it.each(CADENAS.map((c) => c.patron))(
    'en %s, con todas protegidas y un día bueno de cada cuatro, el objetivo no sube como un trinquete',
    (patron) => {
      const traza = simular(
        patron,
        (e, sesion) => (sesion % 4 === 0 ? e.ventana.min + 3 : e.ventana.min + 1),
        80,
        { protegida: true },
      )
      expect(estancamientoMaximo(traza)).toBeLessThanOrEqual(MESETA + 1)
    },
  )
})

describe('las cadenas duran', () => {
  it.each(CADENAS.map((c) => [c.patron, c.ejercicios.length] as const))(
    'en %s hacen falta muchas sesiones para llegar al final',
    (patron, niveles) => {
      // Alguien que cumple exactamente lo que la app le pide, siempre.
      const traza = simular(patron, () => Number.MAX_SAFE_INTEGER, 400)
      const ultimo = cadenaDe(patron).ejercicios[niveles - 1]!
      const llegada = traza.findIndex((p) => p.ejercicioId === ultimo)

      expect(llegada).toBeGreaterThan(0)
      // Este es el PISO teórico: alguien que cumple absolutamente todas las
      // sesiones, que no existe. Sirve igual como garantía de que el motor no
      // puede regalar la cadena — antes el mismo escenario llegaba al final de
      // empuje en catorce sesiones, o sea menos de cinco semanas.
      expect(llegada).toBeGreaterThan(45)
      // La garantía que de verdad importa, y que es la que estaba rota: ningún
      // eslabón se regala en menos de seis sesiones.
      expect(llegada / niveles).toBeGreaterThanOrEqual(6)
    },
  )

  it('la flexión a una mano queda lejos hasta para quien no falla nunca', () => {
    const traza = simular('empuje', () => Number.MAX_SAFE_INTEGER, 400)
    const llegada = traza.findIndex((p) => p.ejercicioId === 'flexion-una-mano')
    // A tres sesiones por semana, más de medio año en el mejor caso
    // imaginable, con una persona que no falla una sola sesión. Antes eran
    // cuatro semanas y media.
    expect(llegada / 3).toBeGreaterThan(25)
  })
})

describe('el motor converge donde la persona puede sostener', () => {
  it.each(CADENAS.map((c) => c.patron))('en %s', (patron) => {
    const cadena = cadenaDe(patron)
    const tope = 2
    const traza = simular(patron, capacidadHasta(patron, tope), 120)

    // Termina en un eslabón que puede sostener, no cinco por encima.
    const final = traza[traza.length - 1]!
    const posicionFinal = cadena.ejercicios.indexOf(final.ejercicioId)
    expect(posicionFinal).toBeLessThanOrEqual(tope + 2)

    // Y no rebota: en las últimas cincuenta sesiones se mueve poco de nivel.
    // Probar de nuevo el eslabón siguiente cada tanto está bien: así se
    // descubre que ya se puede. Hacerlo cada dos sesiones es marear.
    expect(cambiosDeNivel(traza.slice(-50))).toBeLessThanOrEqual(8)
  })
})

describe('el registro de una trayectoria real', () => {
  it('un principiante con techo en flexiones completas termina donde corresponde', () => {
    const capacidad: Record<string, number> = {
      'flexion-pared': 40,
      'flexion-inclinada-alta': 30,
      'flexion-inclinada': 25,
      'flexion-inclinada-baja': 20,
      'flexion-rodillas': 16,
      'flexion-completa': 9,
      'flexion-diamante': 4,
      'flexion-declinada': 3,
      'flexion-pseudoplancha': 1,
      'flexion-arquera': 0,
      'flexion-una-mano': 0,
    }
    const traza = simular('empuje', (e) => capacidad[e.id] ?? 0, 90)

    // No se queda trabado en ningún lado.
    expect(estancamientoMaximo(traza)).toBeLessThanOrEqual(MESETA + 1)

    // Y aterriza en un ejercicio que de verdad puede hacer. Con un techo de
    // nueve flexiones completas, el motor no puede dejarlo en arqueras.
    const visitadas = new Set(traza.slice(-25).map((p) => p.ejercicioId))
    for (const id of visitadas) {
      expect(capacidad[id] ?? 0).toBeGreaterThan(0)
    }
  })
})

/**
 * Cada cuánto habla la anticipación.
 *
 * Este archivo existe justamente para las propiedades que solo se ven corriendo
 * el motor, y la frecuencia de la víspera es una de ellas. Importa porque ya
 * hubo un error igual en la otra punta: el earcon del récord se escribió
 * creyendo que iba a sonar unas pocas veces por mes y sonaba en más de la mitad
 * de los pares ejercicio-sesión. Se descubrió midiendo, no leyendo.
 *
 * El aviso solo vale si es raro. Si la app dice "hoy se abre el eslabón
 * siguiente" en una de cada dos sesiones, deja de anticipar nada y se convierte
 * en decoración; peor todavía, se convierte en una promesa que se rompe seguido.
 * Medido hoy da entre 19% y 30% de las sesiones según cómo le vaya a la
 * persona: alrededor de una vez por semana entrenando tres veces. El tope de 40%
 * es el punto donde eso dejaría de ser cierto.
 */
describe('la víspera es rara, y tiene que seguir siéndolo', () => {
  function frecuencia(capacidad: (e: Ejercicio) => number, sesiones = 150): number {
    const avances = new Map<Patron, Avance>(
      CADENAS.map((c) => [c.patron, avanceInicial(c, POR_ID, 0)]),
    )
    let conVispera = 0

    for (let s = 1; s <= sesiones; s++) {
      const anuncia = [...avances.values()].some(
        (a) => seAbreHoy(a, cadenaDe(a.patron), POR_ID, true) !== null,
      )
      if (anuncia) conVispera++

      for (const [patron, avance] of avances) {
        const ejercicio = POR_ID.get(avance.ejercicioId)!
        const objetivo = avance.objetivoActual
        const logrado = Math.max(0, Math.min(capacidad(ejercicio), objetivo.cantidad))
        const series: Serie[] = Array.from({ length: objetivo.series }, () => ({ logrado }))
        avances.set(
          patron,
          siguienteAvance(
            avance,
            { rendimiento: rendimientoDeSesion(objetivo, series), tipico: logradoTipico(series) },
            { cadena: cadenaDe(patron), ejercicios: POR_ID },
            s,
          ).avance,
        )
      }
    }
    return conVispera / sesiones
  }

  const CASOS: [string, (e: Ejercicio) => number][] = [
    ['alguien que cumple siempre', () => Infinity],
    ['alguien que se queda sin nafta en lo difícil', (e) => (e.ccr > 0.6 ? 4 : Infinity)],
    ['alguien que siempre queda una corta', (e) => Math.max(1, e.ventana.max - 1)],
  ]

  for (const [quien, capacidad] of CASOS) {
    it(`no le habla a ${quien} más de una vez cada tres sesiones`, () => {
      expect(frecuencia(capacidad)).toBeLessThan(0.4)
    })
  }

  it('pero tampoco se calla del todo: si nunca hablara, no serviría de nada', () => {
    expect(frecuencia(() => Infinity)).toBeGreaterThan(0.05)
  })
})

/**
 * Cuánto puede costar el fuelle antes de romper la progresión.
 *
 * El fuelle mete trabajo metabólico en los descansos, y la objeción correcta es
 * que eso podría dejar a la persona con menos repeticiones en la serie
 * siguiente. Si pasara, el motor leería esa merma como pérdida de capacidad y
 * bajaría de eslabón a alguien que no perdió nada: le gastó la fuerza tres
 * minutos antes, que no es lo mismo.
 *
 * La pregunta no es "¿podría pasar?" —claro que podría— sino **cuánta merma
 * aguanta el motor**, y eso es medible corriéndolo. Se simula la persona que
 * peor la pasaría: la que llega exactamente al techo de cada ventana, donde
 * cada subida de eslabón se gana por un pelo y cualquier merma se nota.
 *
 * Medido sobre ochenta sesiones, las cuatro cadenas, subidas de eslabón:
 *
 * | merma | empuje | tracción | piernas | core |
 * |-------|--------|----------|---------|------|
 * | 0 %   | 10     | 9        | 8       | 8    |
 * | 10 %  | 8      | 9        | 8       | 8    |
 * | 12 %  | 7      | 9        | 8       | 8    |
 * | 14 %  | 5      | 2        | 3       | 4    |
 * | 18 %  | 0      | 0        | 0       | 0    |
 *
 * O sea: **hay un acantilado, y está entre el 12 % y el 14 %.** Por debajo, el
 * motor absorbe la merma casi entera. Por encima, la progresión se derrumba y a
 * partir del 18 % no queda nada: ochenta sesiones sin subir un solo eslabón.
 *
 * Eso es lo que justifica el piso de recuperación de `metabolico.ts`, y también
 * lo que hay que vigilar: si mañana alguien toca SUBE, BAJA o el peso de la
 * peor serie, el margen se mueve y esta tabla lo dice. Por eso el test no
 * afirma una desigualdad vaga sino los dos bordes del acantilado.
 */
describe('cuánta merma aguanta el motor antes de romperse', () => {
  /** Alguien que llega justo al techo de cada ventana, menos una merma. */
  function alFilo(merma: number) {
    return (e: Ejercicio) => Math.round(e.ventana.max * (1 - merma))
  }

  const subidas = (patron: Patron, merma: number) =>
    simular(patron, alFilo(merma), 80).filter((p) => p.movimiento === 'nivel-arriba').length

  for (const patron of ['empuje', 'traccion', 'piernas', 'core'] as Patron[]) {
    it(`en ${patron} una merma del 12% no le cuesta la progresión`, () => {
      const intacta = subidas(patron, 0)
      expect(intacta, 'sin merma tiene que progresar').toBeGreaterThanOrEqual(8)
      // Del otro lado del acantilado no: conserva al menos siete de cada diez
      // subidas, que es lo que quiere decir "el motor lo absorbe".
      expect(subidas(patron, 0.12)).toBeGreaterThanOrEqual(Math.ceil(intacta * 0.7))
    })

    it(`en ${patron} una merma del 18% la rompe del todo`, () => {
      // No es una advertencia teórica: son ochenta sesiones sin subir un solo
      // eslabón. Si esto alguna vez deja de fallar en cero, el motor cambió de
      // forma y el piso de recuperación hay que recalcularlo.
      expect(subidas(patron, 0.18)).toBe(0)
    })
  }
})

/**
 * Varias sesiones por día.
 *
 * Cada cadena se lee una vez por día, y eso es justo lo que solo se ve
 * corriendo el motor: una regla que deja leer dos veces no rompe ninguna
 * decisión suelta, rompe la trayectoria. Con tres lecturas por día alguien
 * subiría de eslabón en una tarde, o bajaría el objetivo por el cansancio de
 * la segunda sesión.
 *
 * Todo pasa por `leerLaSesion`, que es exactamente lo que corre `cerrarSesion`,
 * con las sesiones guardadas como las guarda la app.
 */
describe('varias sesiones por día', () => {
  /** Lo que el motor decidió en una sesión, para mirar la trayectoria. */
  interface Huella {
    dia: string
    /** La sesión del día: 0 la primera. */
    sesion: number
    patron: Patron
    ejercicioId: string
    cantidad: number
    movimiento: string
    motivo?: string
  }

  const HORAS = ['09:10', '13:30', '19:05']

  /**
   * Entrena `dias` días seguidos, `porDia` sesiones por día, todas las cadenas
   * en cada sesión. `logra` dice cuánto le sale a la persona en la sesión `n`
   * del día; las de después de la primera van en orden inverso, como otra
   * rutina.
   */
  function entrenar(opciones: {
    dias: number
    porDia: number
    logra: (e: Ejercicio, objetivo: number, n: number) => number
    inicio?: Map<Patron, Avance>
  }) {
    const avances = new Map<Patron, Avance>(
      opciones.inicio ?? CADENAS.map((c) => [c.patron, avanceInicial(c, POR_ID, 0)]),
    )
    const historial: Sesion[] = []
    const huellas: Huella[] = []

    for (let d = 0; d < opciones.dias; d++) {
      const dia = sumarDias('2026-11-02', d)
      for (let n = 0; n < opciones.porDia; n++) {
        const orden = n === 0 ? CADENAS : [...CADENAS].reverse()
        const registros = orden.map(({ patron }) => {
          const avance = avances.get(patron)!
          const objetivo = avance.objetivoActual
          const ejercicio = POR_ID.get(avance.ejercicioId)!
          const logrado = Math.max(0, opciones.logra(ejercicio, objetivo.cantidad, n))
          const series: Serie[] = Array.from({ length: objetivo.series }, () => ({ logrado }))
          return { ejercicioId: ejercicio.id, objetivo: { ...objetivo }, series }
        })
        const finalizadaEn = new Date(`${dia}T${HORAS[n % HORAS.length]}:00`).getTime() + n

        const lecturas = leerLaSesion({
          registros,
          avances,
          dia,
          historial,
          neutra: false,
          congeladas: new Set(),
          protegida: false,
          contextoDe: (patron) => ({ cadena: cadenaDe(patron), ejercicios: POR_ID }),
          ahora: finalizadaEn,
        })

        for (const { patron, decision } of lecturas) {
          const antes = avances.get(patron)!
          huellas.push({
            dia,
            sesion: n,
            patron,
            ejercicioId: antes.ejercicioId,
            cantidad: antes.objetivoActual.cantidad,
            movimiento: decision.movimiento,
            ...(decision.motivo ? { motivo: decision.motivo } : {}),
          })
        }
        for (const { patron, decision, guardar } of lecturas) {
          if (guardar) avances.set(patron, decision.avance)
        }
        historial.push({
          id: `${dia}-${n}`,
          fecha: dia,
          finalizadaEn,
          duracionSegundos: 1800,
          tipo: 'plan',
          registros,
          decisiones: lecturas.map(({ patron, decision }) => ({
            patron,
            movimiento: decision.movimiento,
            explicacion: decision.explicacion,
            cambioDeNivel: decision.cambioDeNivel,
            ...(decision.motivo ? { motivo: decision.motivo } : {}),
            ...(decision.leidaA !== undefined ? { leidaA: decision.leidaA } : {}),
          })),
        })
      }
    }
    return { avances, historial, huellas }
  }

  /** Las lecturas de verdad: todo lo que no es "ya se leyó hoy". */
  const leidas = (huellas: Huella[]) => huellas.filter((h) => h.motivo !== 'ya-leida-hoy')

  it('tres sesiones por día durante 30 días dan la misma trayectoria que una', () => {
    // La segunda sale floja y la tercera sobrada: si alguna de las dos se
    // leyera, la trayectoria cambiaría en un sentido o en el otro.
    const logra = (e: Ejercicio, objetivo: number, n: number) =>
      n === 0 ? Math.min(objetivo, e.ventana.max - 1) : n === 1 ? Math.floor(objetivo / 2) : objetivo + 5
    const una = entrenar({ dias: 30, porDia: 1, logra })
    const tres = entrenar({ dias: 30, porDia: 3, logra })

    expect(leidas(tres.huellas)).toEqual(una.huellas)
    // Los avances, idénticos: la fecha incluida, porque las sesiones de después
    // no los escriben.
    expect(tres.avances).toEqual(una.avances)
    // Y las de después de la primera quedaron todas como ya leídas.
    const despues = tres.huellas.filter((h) => h.sesion > 0)
    expect(despues.length).toBe(30 * 2 * CADENAS.length)
    expect(despues.every((h) => h.motivo === 'ya-leida-hoy' && h.movimiento === 'neutra')).toBe(
      true,
    )
  })

  describe('siete días seguidos con lectura', () => {
    // Empuje arranca a un paso del techo de la flexión completa, así el salto
    // de eslabón cae adentro de la semana; las demás cadenas, desde el
    // principio. Quien entrena cumple exactamente lo que le piden, tres veces
    // por día.
    const completa = POR_ID.get('flexion-completa')!
    const inicio = new Map<Patron, Avance>(
      CADENAS.map((c) => [c.patron, avanceInicial(c, POR_ID, 0)]),
    )
    inicio.set('empuje', {
      ...avanceInicial(cadenaDe('empuje'), POR_ID, 0),
      ejercicioId: completa.id,
      objetivoActual: {
        series: completa.series,
        cantidad: completa.ventana.max - incremento(completa.medida, completa.ventana.max),
      },
    })
    const { historial, huellas } = entrenar({
      dias: 7,
      porDia: 3,
      logra: (_e, objetivo) => objetivo,
      inicio,
    })

    it('dan una trayectoria fija', () => {
      const trayectoria = leidas(huellas).map(
        (h) => `${h.dia} ${h.patron} ${h.ejercicioId} ${h.cantidad} ${h.movimiento}`,
      )
      expect(trayectoria).toMatchInlineSnapshot(`
        [
          "2026-11-02 empuje flexion-completa 11 subida",
          "2026-11-02 traccion remo-australiano-alto 8 subida",
          "2026-11-02 piernas sentadilla-banco 10 subida",
          "2026-11-02 core plancha-rodillas 15 subida",
          "2026-11-02 bisagra puente-gluteos 10 subida",
          "2026-11-03 empuje flexion-completa 12 sostiene",
          "2026-11-03 traccion remo-australiano-alto 9 subida",
          "2026-11-03 piernas sentadilla-banco 11 subida",
          "2026-11-03 core plancha-rodillas 18 subida",
          "2026-11-03 bisagra puente-gluteos 11 subida",
          "2026-11-04 empuje flexion-completa 12 sostiene",
          "2026-11-04 traccion remo-australiano-alto 10 subida",
          "2026-11-04 piernas sentadilla-banco 12 subida",
          "2026-11-04 core plancha-rodillas 21 subida",
          "2026-11-04 bisagra puente-gluteos 12 subida",
          "2026-11-05 empuje flexion-completa 12 nivel-arriba",
          "2026-11-05 traccion remo-australiano-alto 11 subida",
          "2026-11-05 piernas sentadilla-banco 13 subida",
          "2026-11-05 core plancha-rodillas 24 subida",
          "2026-11-05 bisagra puente-gluteos 13 subida",
          "2026-11-06 empuje flexion-diamante 9 subida",
          "2026-11-06 traccion remo-australiano-alto 12 subida",
          "2026-11-06 piernas sentadilla-banco 14 subida",
          "2026-11-06 core plancha-rodillas 28 subida",
          "2026-11-06 bisagra puente-gluteos 14 subida",
          "2026-11-07 empuje flexion-diamante 10 subida",
          "2026-11-07 traccion remo-australiano-alto 13 subida",
          "2026-11-07 piernas sentadilla-banco 15 sostiene",
          "2026-11-07 core plancha-rodillas 30 sostiene",
          "2026-11-07 bisagra puente-gluteos 15 sostiene",
          "2026-11-08 empuje flexion-diamante 11 subida",
          "2026-11-08 traccion remo-australiano-alto 14 subida",
          "2026-11-08 piernas sentadilla-banco 15 sostiene",
          "2026-11-08 core plancha-rodillas 30 sostiene",
          "2026-11-08 bisagra puente-gluteos 15 sostiene",
        ]
      `)
    })

    it('una sola decisión no neutra por día y por cadena', () => {
      const porDiaYCadena = new Map<string, number>()
      for (const sesion of historial) {
        for (const d of sesion.decisiones ?? []) {
          if (d.movimiento === 'neutra') continue
          const clave = `${sesion.fecha} ${d.patron}`
          porDiaYCadena.set(clave, (porDiaYCadena.get(clave) ?? 0) + 1)
        }
      }
      expect(porDiaYCadena.size).toBe(7 * CADENAS.length)
      expect([...porDiaYCadena.values()].every((n) => n === 1)).toBe(true)
    })

    it(`ningún cambio de eslabón sin ${CONSOLIDACION} días con lectura en el techo`, () => {
      let saltos = 0
      for (const { patron } of CADENAS) {
        const suyas = leidas(huellas).filter((h) => h.patron === patron)
        suyas.forEach((h, i) => {
          if (h.movimiento !== 'nivel-arriba') return
          saltos++
          const antes = suyas.slice(i - CONSOLIDACION, i)
          expect(antes, `${patron} ${h.dia}`).toHaveLength(CONSOLIDACION)
          const techo = POR_ID.get(h.ejercicioId)!.ventana.max
          for (const previa of antes) {
            expect(previa.ejercicioId).toBe(h.ejercicioId)
            expect(previa.cantidad).toBe(techo)
            expect(previa.dia < h.dia).toBe(true)
          }
          expect(new Set(antes.map((p) => p.dia)).size).toBe(CONSOLIDACION)
        })
      }
      // Sin un salto en la semana, lo de arriba no estaría probando nada.
      expect(saltos).toBeGreaterThan(0)
    })
  })
})
