import { describe, expect, it } from 'vitest'
import { ejercicioDelBloque } from './bajada'
import { CADENAS, EJERCICIOS, NOMBRE_PATRON, POR_ID, cadenaDe } from './biblioteca'
import { registrosDeLaSesion } from './borrador'
import { cadenasCongeladas, contestoElChequeo, leerEstado } from './estado'
import { curvaDeFuerza } from './estadisticas'
import { RAFAGAS, bloqueDeFuelle, rafagaDelDescanso } from './metabolico'
import {
  SERIES_CON_MOLESTIA,
  avisosDeMolestia,
  bloqueConMolestia,
  fueraDeLaMolestia,
  lineaDeMolestia,
  molestiasDeHoy,
  molestiasDeLaSesion,
  pasosConMolestia,
} from './molestia'
import { siguienteAvance } from './progresion'
import { RUTINAS } from './rutinas'
import type {
  Avance,
  BloqueRutina,
  Ejercicio,
  Estado,
  PasoDelBorrador,
  Patron,
  Sesion,
} from './tipos'

/**
 * Que avisar una molestia cambie el plan, y nada más que el plan.
 *
 * Lo que se verifica es lo que la persona no puede ver desde afuera: que la
 * cadena que avisó no se cargue igual por un costado —un accesorio, el
 * volumen, una ráfaga—, que avisar no le cueste un eslabón ni se lo regale, y
 * que todo eso pase con el chequeo diario apagado, que es como viene la app.
 */

const PATRONES: Patron[] = ['empuje', 'traccion', 'piernas', 'core', 'bisagra']
const HOY = '2026-10-20'

/** Un avance parado en un eslabón cualquiera de su cadena. */
function avanceEn(patron: Patron, ejercicioId: string): Avance {
  const ejercicio = POR_ID.get(ejercicioId)!
  return {
    patron,
    ejercicioId,
    objetivoActual: { series: ejercicio.series, cantidad: ejercicio.ventana.min },
    senal: 1,
    sesionesEnObjetivo: 0,
    graciaRestante: 0,
    actualizadoEn: 0,
  }
}

/** La fila que deja avisar una molestia con el chequeo apagado: nada más que eso. */
function soloMolestia(molestia: Patron, fecha = HOY): Estado {
  return { fecha, molestia, actualizadoEn: 1 }
}

/** El bloque del motor de un patrón, resuelto como lo resuelven las pantallas. */
function bloqueDelMotor(avance: Avance, bloque: BloqueRutina = { patron: avance.patron }) {
  return ejercicioDelBloque(bloque, avance, POR_ID, cadenaDe(bloque.patron), {
    tieneBarraCargable: true,
  })
}

describe('de dónde sale la molestia de hoy', () => {
  it('de la fila de hoy aunque no tenga el chequeo: así queda con el chequeo apagado', () => {
    const fila = soloMolestia('bisagra')
    expect(contestoElChequeo(fila)).toBe(false)
    expect([...molestiasDeHoy([fila], HOY)]).toEqual(['bisagra'])
  })

  it('y de la del chequeo entero, igual', () => {
    const fila: Estado = {
      fecha: HOY,
      sueno: 4,
      energia: 4,
      musculos: 5,
      molestia: 'traccion',
      actualizadoEn: 1,
    }
    expect([...molestiasDeHoy([fila], HOY)]).toEqual(['traccion'])
  })

  it('la de ayer no cambia el plan de hoy', () => {
    expect(molestiasDeHoy([soloMolestia('empuje', '2026-10-19')], HOY).size).toBe(0)
  })

  it('sin molestia no hay nada', () => {
    const fila: Estado = { fecha: HOY, sueno: 2, energia: 3, musculos: 1, actualizadoEn: 1 }
    expect(molestiasDeHoy([fila], HOY).size).toBe(0)
    expect(molestiasDeHoy([], HOY).size).toBe(0)
  })

  it('retirada a mitad de la sesión, la del borrador sigue valiendo para esa sesión', () => {
    // "Ya no" después de anotar series en el eslabón de abajo borra la fila de
    // hoy. Si la sesión se rearmara sin la molestia, volvería el eslabón de
    // siempre y esas series quedarían fuera de lo que se guarda al cerrar.
    expect([...molestiasDeLaSesion([], HOY, ['traccion'])]).toEqual(['traccion'])
    // Y una que se avisa a mitad de camino se suma a la que ya traía.
    expect(molestiasDeLaSesion([soloMolestia('bisagra')], HOY, ['traccion'])).toEqual(
      new Set(['bisagra', 'traccion']),
    )
    // Una sesión nueva, sin borrador, es la molestia de hoy y nada más.
    expect(molestiasDeLaSesion([soloMolestia('empuje')], HOY)).toEqual(new Set(['empuje']))
    expect(molestiasDeLaSesion([], HOY).size).toBe(0)
  })

  it('una sesión que cruzó la medianoche suma la molestia que se avisa después', () => {
    // La sesión es del 19 (su día manda en todo lo demás), pero avisar una
    // molestia pasada la medianoche la escribe en la fila del 20. Si la
    // sesión mirara solo la del 19, Hoy anunciaría la cadena bajada y la
    // sesión retomada la pediría entera.
    const AYER = '2026-10-19'
    const delDia = soloMolestia('core', AYER)
    const nueva = soloMolestia('traccion', HOY)
    expect(molestiasDeLaSesion([delDia, nueva], AYER, [], HOY)).toEqual(
      new Set(['core', 'traccion']),
    )
    // La del día de la sesión sigue valiendo aunque el reloj ya esté en otro.
    expect(molestiasDeLaSesion([delDia], AYER, [], HOY)).toEqual(new Set(['core']))
    // Una fila que no es ni la del día de la sesión ni la de hoy no entra.
    expect(molestiasDeLaSesion([soloMolestia('empuje', '2026-10-18')], AYER, [], HOY).size).toBe(0)
    // Sin reloj aparte, es el día de la sesión y nada más, como antes.
    expect(molestiasDeLaSesion([delDia, nueva], AYER)).toEqual(new Set(['core']))
  })
})

describe('la cadena con molestia baja un eslabón o se saltea', () => {
  it('en cada eslabón de las cinco cadenas, la bisagra incluida', () => {
    for (const patron of PATRONES) {
      const cadena = cadenaDe(patron)
      cadena.ejercicios.forEach((id, posicion) => {
        const resuelto = bloqueDelMotor(avanceEn(patron, id))!
        const hoy = bloqueConMolestia(resuelto, new Set([patron]), POR_ID, cadena)

        if (posicion === 0) {
          expect(hoy.cambio, `${id} es el primero: no hay dónde bajar`).toBe('saltea')
          return
        }
        expect(hoy.cambio, id).toBe('baja')
        if (hoy.cambio !== 'baja') return
        const anterior = POR_ID.get(cadena.ejercicios[posicion - 1]!)!
        expect(hoy.ejercicio.id, id).toBe(anterior.id)
        expect(hoy.ejercicio.patron).toBe(patron)
        expect(hoy.ejercicio.ccr, `${id} → ${anterior.id}`).toBeLessThanOrEqual(
          resuelto.ejercicio.ccr,
        )
        expect(hoy.objetivo.series).toBeLessThanOrEqual(SERIES_CON_MOLESTIA)
        expect(hoy.objetivo.cantidad).toBe(anterior.ventana.min)
        // Con la zona avisando no se le pone peso encima.
        expect(hoy.objetivo.kg).toBeUndefined()
        expect(hoy.accesorio).toBe(false)
      })
    }
  })

  it('una molestia en otra cadena no toca nada', () => {
    for (const patron of PATRONES) {
      const avance = avanceEn(patron, cadenaDe(patron).ejercicios[2]!)
      const resuelto = bloqueDelMotor(avance)!
      for (const otra of PATRONES.filter((p) => p !== patron)) {
        const hoy = bloqueConMolestia(resuelto, new Set([otra]), POR_ID, cadenaDe(patron))
        expect(hoy, `${patron} con molestia en ${otra}`).toEqual({ ...resuelto, cambio: null })
      }
      expect(bloqueConMolestia(resuelto, new Set(), POR_ID, cadenaDe(patron)).cambio).toBeNull()
    }
  })

  it('el volumen y los accesorios de esa cadena se saltean', () => {
    // Son más carga sobre la misma zona. El volumen, además, ya ES el eslabón
    // de abajo: dejarlo sería cargar dos veces lo que tenía que bajar una.
    const traccion = avanceEn('traccion', cadenaDe('traccion').ejercicios[4]!)
    const volumen = bloqueDelMotor(traccion, { patron: 'traccion', volumen: true })!
    const curl = bloqueDelMotor(traccion, { patron: 'traccion', ejercicioId: 'curl-barra' })!
    const rumano = bloqueDelMotor(avanceEn('bisagra', cadenaDe('bisagra').ejercicios[2]!), {
      patron: 'bisagra',
      ejercicioId: 'peso-muerto-rumano',
    })!
    const con = (resuelto: typeof curl, molestia: Patron, patron: Patron) =>
      bloqueConMolestia(resuelto, new Set([molestia]), POR_ID, cadenaDe(patron)).cambio
    expect(con(volumen, 'traccion', 'traccion')).toBe('saltea')
    expect(con(curl, 'traccion', 'traccion')).toBe('saltea')
    expect(con(rumano, 'bisagra', 'bisagra')).toBe('saltea')
    // Y el de otra cadena sigue en pie.
    expect(con(curl, 'empuje', 'traccion')).toBeNull()
  })

  it('lo que ya tiene series anotadas en la sesión no se cambia a mitad de camino', () => {
    // Si se cambiara, las series quedarían fuera del plan y el cierre no las
    // guardaría: perder trabajo en silencio es peor que cualquier otra cosa.
    const avance = avanceEn('empuje', cadenaDe('empuje').ejercicios[3]!)
    const resuelto = bloqueDelMotor(avance)!
    const hoy = bloqueConMolestia(resuelto, new Set(['empuje']), POR_ID, cadenaDe('empuje'), {
      yaEmpezado: true,
    })
    expect(hoy).toEqual({ ...resuelto, cambio: null })
  })

  it('en ninguna rutina la cadena con molestia queda cargada en su eslabón de siempre', () => {
    // El recorrido entero que hacen las pantallas, con cada rutina, cada
    // molestia y cada patrón que puede tocar ese día (los bloques que alternan,
    // en sus dos lados). Lo único de esa cadena que puede quedar es el eslabón
    // de abajo, con dos series.
    for (const nivel of [0, 3]) {
      const avances = new Map(
        CADENAS.map((c) => [c.patron, avanceEn(c.patron, c.ejercicios[nivel]!)]),
      )
      for (const rutina of RUTINAS) {
        for (const molestia of PATRONES) {
          const molestias = new Set([molestia])
          const bloques = rutina.bloques.flatMap((b) =>
            b.alterna ? [b, { ...b, patron: b.alterna }] : [b],
          )
          for (const bloque of bloques) {
            const avance = avances.get(bloque.patron)!
            const resuelto = ejercicioDelBloque(bloque, avance, POR_ID, cadenaDe(bloque.patron), {
              tieneBarraCargable: true,
            })
            if (!resuelto) continue
            const hoy = bloqueConMolestia(resuelto, molestias, POR_ID, cadenaDe(bloque.patron))
            if (hoy.cambio === 'saltea') continue
            if (hoy.ejercicio.patron !== molestia) continue
            const donde = `${rutina.id}, bloque de ${bloque.patron}, molestia en ${molestia}`
            expect(hoy.cambio, donde).toBe('baja')
            expect(hoy.ejercicio.id, donde).not.toBe(avance.ejercicioId)
            expect(hoy.objetivo.series, donde).toBeLessThanOrEqual(SERIES_CON_MOLESTIA)
          }
        }
      }
    }
  })
})

describe('el motor no se entera', () => {
  it('el eslabón de abajo nunca es el ejercicio del avance', () => {
    // `cerrarSesion` solo progresa un patrón "si se entrenó el ejercicio que
    // tocaba". Que el bajado sea otro ejercicio es lo que deja quieto al motor:
    // ni fallo por hacer menos, ni progreso por hacer fácil lo de abajo. Si un
    // día esto dejara de ser cierto, avisar una molestia empezaría a costar o
    // a regalar eslabones.
    for (const patron of PATRONES) {
      for (const id of cadenaDe(patron).ejercicios) {
        const avance = avanceEn(patron, id)
        const resuelto = bloqueDelMotor(avance)!
        const hoy = bloqueConMolestia(resuelto, new Set([patron]), POR_ID, cadenaDe(patron))
        if (hoy.cambio !== 'baja') continue
        expect(hoy.ejercicio.id, id).not.toBe(avance.ejercicioId)
      }
    }
  })

  it('con la molestia sola la cadena queda congelada: ni el ejercicio de siempre la movería', () => {
    // La red de abajo: si por algún camino se anotara el ejercicio del avance
    // —una sesión que ya venía empezada—, la sesión es neutra para esa cadena
    // y el motor devuelve el avance tal cual estaba.
    for (const patron of PATRONES) {
      expect(cadenasCongeladas([soloMolestia(patron)], HOY).has(patron), patron).toBe(true)
      const avance = avanceEn(patron, cadenaDe(patron).ejercicios[2]!)
      const decision = siguienteAvance(
        avance,
        { rendimiento: 1.4, tipico: 30, neutra: true },
        { cadena: cadenaDe(patron), ejercicios: POR_ID },
        avance.actualizadoEn,
      )
      expect(decision.movimiento).toBe('neutra')
      expect(decision.cambioDeNivel).toBe(false)
      expect(decision.avance).toEqual(avance)
    }
  })

  it('el día del eslabón bajado no hunde la curva de fuerza', () => {
    // El registro bajado se guarda marcado como bajada, igual que el volumen:
    // hacer el eslabón de abajo no es haber perdido fuerza, y la curva no
    // puede dibujarlo como un pozo.
    const patron: Patron = 'traccion'
    const cadena = cadenaDe(patron)
    const avance = avanceEn(patron, cadena.ejercicios[4]!)
    const hoy = bloqueConMolestia(bloqueDelMotor(avance)!, new Set([patron]), POR_ID, cadena)
    if (hoy.cambio !== 'baja') throw new Error('tenía que bajar')
    const sesion: Sesion = {
      id: 's',
      fecha: HOY,
      finalizadaEn: 1,
      duracionSegundos: 900,
      tipo: 'plan',
      registros: [
        {
          ejercicioId: hoy.ejercicio.id,
          objetivo: hoy.objetivo,
          bajada: true,
          series: Array.from({ length: hoy.objetivo.series }, () => ({
            logrado: hoy.objetivo.cantidad,
          })),
        },
      ],
    }
    expect(curvaDeFuerza([sesion], patron)).toEqual([])
  })
})

describe('funciona con el chequeo apagado', () => {
  it('una fila con la molestia sola baja la cadena, sin línea de base y sin índice', () => {
    // Es el caso de fábrica: nunca nadie contestó el chequeo. No hace falta
    // ninguna entrada previa ni ningún dato inventado para que el plan cambie.
    for (const patron of PATRONES) {
      const estados = [soloMolestia(patron)]
      const lectura = leerEstado(estados, HOY)
      expect(lectura.entradas).toBe(0)
      expect(lectura.molestia).toBe(patron)

      const cadena = cadenaDe(patron)
      const avance = avanceEn(patron, cadena.ejercicios[1]!)
      const molestias = molestiasDeHoy(estados, HOY)
      const hoy = bloqueConMolestia(bloqueDelMotor(avance)!, molestias, POR_ID, cadena)
      expect(hoy.cambio, patron).toBe('baja')
    }
  })
})

describe('las ráfagas no cargan la cadena con molestia', () => {
  it('ni en el descanso ni en el bloque, para cada cadena', () => {
    const equipo = { puedeSaltar: true, tieneEscalon: true }
    for (const molestia of PATRONES) {
      const evitar = molestiasDeHoy([soloMolestia(molestia)], HOY)
      for (const viene of PATRONES) {
        for (let indice = 0; indice < RAFAGAS.length * 2; indice++) {
          const elegida = rafagaDelDescanso({
            descansoSegundos: 150,
            patronQueViene: viene,
            equipo,
            densidad: 'fuerte',
            indice,
            evitar,
          })
          if (elegida) expect(elegida.rafaga.carga, elegida.rafaga.id).not.toContain(molestia)
        }
      }
      for (const paso of bloqueDeFuelle(12, equipo, 'fuerte', evitar)) {
        expect(paso.rafaga.carga, paso.rafaga.id).not.toContain(molestia)
      }
    }
  })

  it('con la bisagra avisando, antes de un curl nórdico no salta nada', () => {
    const evitar = new Set<Patron>(['bisagra'])
    const salen = new Set<string>()
    for (let indice = 0; indice < RAFAGAS.length * 2; indice++) {
      const elegida = rafagaDelDescanso({
        descansoSegundos: 150,
        patronQueViene: 'core',
        equipo: { puedeSaltar: true, tieneEscalon: true },
        densidad: 'fuerte',
        indice,
        evitar,
      })
      if (elegida) salen.add(elegida.rafaga.id)
    }
    expect(salen.has('burpee')).toBe(false)
    expect(salen.has('salto-sentadilla')).toBe(false)
    expect(salen.has('paso-al-cajon')).toBe(false)
  })
})

describe('lo que se dice', () => {
  it('una vez por cadena, y si bajó, se dice que bajó', () => {
    expect(
      avisosDeMolestia([
        { patron: 'traccion', cambio: 'baja' },
        { patron: 'traccion', cambio: 'saltea' },
        { patron: 'bisagra', cambio: 'saltea' },
        { patron: 'bisagra', cambio: 'saltea' },
      ]),
    ).toEqual([
      { patron: 'traccion', cambio: 'baja' },
      { patron: 'bisagra', cambio: 'saltea' },
    ])
    // El orden de los bloques no cambia lo que se dice.
    expect(
      avisosDeMolestia([
        { patron: 'empuje', cambio: 'saltea' },
        { patron: 'empuje', cambio: 'baja' },
      ]),
    ).toEqual([{ patron: 'empuje', cambio: 'baja' }])
  })

  it('"no cargamos" no se dice de una cadena que quedó en el plan', () => {
    // El volumen se salteó, pero el eslabón de siempre siguió porque ya tenía
    // series anotadas: decir "hoy no cargamos empuje" sería falso.
    expect(avisosDeMolestia([{ patron: 'empuje', cambio: 'saltea' }], ['empuje', 'core'])).toEqual(
      [],
    )
    expect(avisosDeMolestia([{ patron: 'empuje', cambio: 'saltea' }], ['core'])).toEqual([
      { patron: 'empuje', cambio: 'saltea' },
    ])
    // El que bajó se dice siempre: el bajado ES lo que quedó en el plan.
    expect(avisosDeMolestia([{ patron: 'empuje', cambio: 'baja' }], ['empuje'])).toEqual([
      { patron: 'empuje', cambio: 'baja' },
    ])
  })

  it('una línea corta, con el motivo, sin retar y sin diagnosticar', () => {
    expect(lineaDeMolestia({ patron: 'traccion', cambio: 'saltea' })).toBe(
      'Hoy no cargamos tracción: avisaste una molestia.',
    )
    expect(lineaDeMolestia({ patron: 'traccion', cambio: 'baja' })).toBe(
      'Hoy bajamos un eslabón en tracción: avisaste una molestia.',
    )
    const prohibidas = /lesi|tendin|desgarr|no es nada|dale igual|deberías|te pasaste/i
    for (const patron of PATRONES) {
      for (const cambio of ['baja', 'saltea'] as const) {
        const linea = lineaDeMolestia({ patron, cambio })
        expect(linea).toContain(NOMBRE_PATRON[patron].toLowerCase())
        expect(linea).toContain('avisaste una molestia')
        expect(linea).not.toMatch(prohibidas)
        expect(linea.length, linea).toBeLessThanOrEqual(70)
      }
    }
  })
})

describe('la serie de cierre', () => {
  it('no cae sobre la cadena con molestia mientras haya otra cosa', () => {
    const entradas = (['empuje', 'traccion', 'bisagra'] as const).map((patron) => ({
      ejercicio: POR_ID.get(cadenaDe(patron).ejercicios[0]!)!,
    }))
    const molestia = entradas[0]!.ejercicio.patron
    const libres = fueraDeLaMolestia(entradas, new Set([molestia]))
    expect(libres.length).toBe(entradas.length - 1)
    expect(libres.every((e) => e.ejercicio.patron !== molestia)).toBe(true)
  })

  it('si no queda otra cosa, usa lo que hay: el cierre se puede saltear', () => {
    const entradas = [{ ejercicio: POR_ID.get(cadenaDe('core').ejercicios[0]!)! }]
    expect(fueraDeLaMolestia(entradas, new Set(['core']))).toEqual(entradas)
  })
})

/**
 * La molestia en lo que se arma con pasos: rutinas propias, mixes, un
 * ejercicio solo y lo que falta de una sesión en curso.
 *
 * La regla es la del plan, y lo que se prueba es que no tenga agujeros por
 * donde la cadena con molestia se cargue igual: un paso fijo con tu eslabón,
 * una variante que no está en ninguna cadena, un accesorio que nadie marcó
 * como bajada. Y que "Dejarlo como lo armé" devuelva lo que la persona eligió,
 * sin tocar lo que pone el motor.
 */
describe('la molestia en una sesión armada con pasos', () => {
  /** Un paso fijo de un ejercicio, con su ventana: como lo arma una rutina. */
  function fijo(ejercicioId: string, id = `p-${ejercicioId}`): PasoDelBorrador {
    const ejercicio = POR_ID.get(ejercicioId) ?? catalogo.get(ejercicioId)!
    return {
      id,
      ejercicioId,
      objetivo: { series: 3, cantidad: ejercicio.ventana.max },
      clase: 'fijo',
      fijo: true,
      seccion: 'principal',
    }
  }

  /** El paso de cadena: el eslabón del avance con el objetivo del motor. */
  function deCadena(ejercicioId: string): PasoDelBorrador {
    const ejercicio = POR_ID.get(ejercicioId)!
    return {
      id: `c-${ejercicio.patron}`,
      ejercicioId,
      objetivo: { series: ejercicio.series, cantidad: ejercicio.ventana.min },
      clase: 'cadena',
      seccion: 'principal',
    }
  }

  /**
   * Una variante de tracción que equivale al remo con pies elevados (el 4),
   * para el ejemplo de la línea: "este paso bajó a remo australiano bajo".
   * El catálogo de hoy no tiene variantes: llegan con la ola 1.
   */
  const pies = POR_ID.get('remo-australiano-pies-elevados')!
  const variante: Ejercicio = {
    ...pies,
    id: 'variante-de-traccion',
    nombre: 'Variante de tracción',
    equivale: { patron: 'traccion', nivel: 4 },
  }
  /** Una variante que equivale al primer eslabón: no tiene dónde bajar. */
  const varianteDelPrimero: Ejercicio = {
    ...POR_ID.get('remo-australiano-alto')!,
    id: 'variante-del-primero',
    nombre: 'Variante del primero',
    nivel: 1,
    equivale: { patron: 'traccion', nivel: 1 },
  }
  /** Un accesorio de tracción, marcado como lo marca la ola 1. */
  const accesorio: Ejercicio = {
    ...POR_ID.get('remo-australiano-alto')!,
    id: 'accesorio-de-traccion',
    nombre: 'Accesorio de tracción',
    nivel: 1,
    accesorio: true,
  }
  const catalogo = new Map(POR_ID)
  for (const e of [variante, varianteDelPrimero, accesorio]) catalogo.set(e.id, e)

  it('sin molestia no cambia nada', () => {
    const pasos = [deCadena('dominada-negativa'), fijo('flexion-completa')]
    expect(pasosConMolestia(pasos, null)).toEqual({ pasos, cambios: [] })
    expect(pasosConMolestia(pasos, new Set())).toEqual({ pasos, cambios: [] })
  })

  it('un paso de cadena pasa por la misma regla que el bloque del plan', () => {
    for (const patron of PATRONES) {
      const cadena = cadenaDe(patron)
      cadena.ejercicios.forEach((id, posicion) => {
        const paso = deCadena(id)
        const { pasos, cambios } = pasosConMolestia([paso], patron)
        const delPlan = bloqueConMolestia(
          { ejercicio: POR_ID.get(id)!, objetivo: paso.objetivo, accesorio: false },
          new Set([patron]),
          POR_ID,
          cadena,
        )
        if (posicion === 0) {
          expect(delPlan.cambio).toBe('saltea')
          expect(pasos, id).toEqual([])
          expect(cambios).toEqual([{ paso: paso.id, patron, cambio: 'saltea', de: id, fijo: false }])
          return
        }
        if (delPlan.cambio !== 'baja') throw new Error(`${id} tenía que bajar`)
        // Lo bajado se guarda como volumen: un eslabón más fácil que no lee.
        expect(pasos, id).toEqual([
          { ...paso, ejercicioId: delPlan.ejercicio.id, objetivo: delPlan.objetivo, bajada: true, clase: 'volumen' },
        ])
        expect(cambios).toEqual([
          { paso: paso.id, patron, cambio: 'baja', de: id, a: delPlan.ejercicio.id, fijo: false },
        ])
      })
    }
  })

  it('un paso de volumen de esa cadena se saltea, como en el plan', () => {
    const volumen: PasoDelBorrador = {
      id: 'v',
      ejercicioId: 'remo-australiano-bajo',
      objetivo: { series: 2, cantidad: 15 },
      bajada: true,
      clase: 'volumen',
    }
    const { pasos, cambios } = pasosConMolestia([volumen], 'traccion')
    expect(pasos).toEqual([])
    expect(cambios).toEqual([
      { paso: 'v', patron: 'traccion', cambio: 'saltea', de: 'remo-australiano-bajo', fijo: false },
    ])
    // Y "Dejarlo como lo armé" no lo devuelve: el volumen lo pone el motor.
    expect(pasosConMolestia([volumen], 'traccion', { fijos: 'como-los-armaste' }).pasos).toEqual([])
  })

  it('un paso fijo con un eslabón recibe la regla del plan: baja al anterior', () => {
    const paso = fijo('dominada-negativa')
    const { pasos, cambios } = pasosConMolestia([paso], 'traccion')
    const anterior = POR_ID.get('remo-australiano-pies-elevados')!
    expect(pasos).toEqual([
      {
        ...paso,
        ejercicioId: anterior.id,
        objetivo: { series: SERIES_CON_MOLESTIA, cantidad: anterior.ventana.min },
        bajada: true,
      },
    ])
    // Sigue siendo fijo: tampoco lee la cadena.
    expect(pasos[0]!.fijo).toBe(true)
    expect(pasos[0]!.clase).toBe('fijo')
    expect(cambios).toEqual([
      { paso: paso.id, patron: 'traccion', cambio: 'baja', de: 'dominada-negativa', a: anterior.id, fijo: true },
    ])
  })

  it('en el primer eslabón no hay dónde bajar y se saltea', () => {
    const paso = fijo('remo-australiano-alto')
    const { pasos, cambios } = pasosConMolestia([paso], 'traccion')
    expect(pasos).toEqual([])
    expect(cambios).toEqual([
      { paso: paso.id, patron: 'traccion', cambio: 'saltea', de: 'remo-australiano-alto', fijo: true },
    ])
  })

  it('una variante baja al eslabón equivale.nivel − 1 de su cadena', () => {
    const paso = fijo(variante.id)
    const { pasos, cambios } = pasosConMolestia([paso], 'traccion', { ejercicios: catalogo })
    const bajo = POR_ID.get('remo-australiano-bajo')!
    expect(cadenaDe('traccion').ejercicios.indexOf(bajo.id) + 1).toBe(variante.equivale!.nivel - 1)
    expect(pasos).toEqual([
      {
        ...paso,
        ejercicioId: bajo.id,
        objetivo: { series: SERIES_CON_MOLESTIA, cantidad: bajo.ventana.min },
        bajada: true,
      },
    ])
    expect(cambios).toEqual([
      { paso: paso.id, patron: 'traccion', cambio: 'baja', de: variante.id, a: bajo.id, fijo: true },
    ])
  })

  it('una variante del primer eslabón no tiene dónde bajar y se saltea', () => {
    const { pasos, cambios } = pasosConMolestia([fijo(varianteDelPrimero.id)], 'traccion', {
      ejercicios: catalogo,
    })
    expect(pasos).toEqual([])
    expect(cambios[0]?.cambio).toBe('saltea')
  })

  it('un accesorio de esa cadena se saltea, también uno con barra que nadie marcó como bajada', () => {
    for (const id of [accesorio.id, 'remo-barra', 'curl-barra']) {
      const { pasos, cambios } = pasosConMolestia([fijo(id)], 'traccion', { ejercicios: catalogo })
      expect(pasos, id).toEqual([])
      expect(cambios, id).toEqual([{ paso: `p-${id}`, patron: 'traccion', cambio: 'saltea', de: id, fijo: true }])
    }
  })

  it('"Dejarlo como lo armé" deja los fijos como estaban, y los de cadena bajan igual', () => {
    const cadena = deCadena('dominada-negativa')
    const pasos = [cadena, fijo('dominada-asistida'), fijo(variante.id), fijo('curl-barra')]
    const resultado = pasosConMolestia(pasos, 'traccion', { fijos: 'como-los-armaste', ejercicios: catalogo })
    expect(resultado.pasos.slice(1)).toEqual(pasos.slice(1))
    expect(resultado.pasos[0]!.ejercicioId).toBe('remo-australiano-pies-elevados')
    expect(resultado.cambios).toEqual([
      {
        paso: cadena.id,
        patron: 'traccion',
        cambio: 'baja',
        de: 'dominada-negativa',
        a: 'remo-australiano-pies-elevados',
        fijo: false,
      },
    ])
  })

  it('por defecto va la regla del plan, que es la conservadora', () => {
    const pasos = [fijo('dominada-asistida')]
    expect(pasosConMolestia(pasos, 'traccion')).toEqual(
      pasosConMolestia(pasos, 'traccion', { fijos: 'regla-del-plan' }),
    )
    expect(pasosConMolestia(pasos, 'traccion').cambios[0]?.cambio).toBe('baja')
  })

  it('lo de otra cadena, la movilidad y un id desconocido quedan como estaban', () => {
    const movilidad: PasoDelBorrador = {
      id: 'm',
      ejercicioId: 'gato-vaca',
      objetivo: { series: 1, cantidad: 10 },
      clase: 'movilidad',
      seccion: 'entrada',
    }
    const desconocido: PasoDelBorrador = { ...fijo('flexion-completa', 'x'), ejercicioId: 'ya-no-existe' }
    const pasos = [fijo('flexion-completa'), deCadena('sentadilla-completa'), movilidad, desconocido]
    expect(pasosConMolestia(pasos, 'traccion')).toEqual({ pasos, cambios: [] })
  })

  it('lo que ya tiene series anotadas no se cambia a mitad de camino', () => {
    // "Me molesta algo" en plena sesión aplica a lo que falta: si cambiara lo
    // empezado, esas series quedarían fuera de lo que se guarda.
    const empezado = fijo('dominada-asistida', 'empezado')
    const falta = fijo('dominada-negativa', 'falta')
    const { pasos, cambios } = pasosConMolestia([empezado, falta], 'traccion', {
      hechas: { empezado: [{ logrado: 5 }] },
    })
    expect(pasos[0]).toBe(empezado)
    expect(pasos[1]!.ejercicioId).toBe('remo-australiano-pies-elevados')
    expect(cambios.map((c) => c.paso)).toEqual(['falta'])
  })

  it('la entrada en calor de esa cadena también baja, y sigue siendo entrada en calor', () => {
    const entrada: PasoDelBorrador = {
      ...fijo('remo-australiano-pies-elevados', 'entrada'),
      objetivo: { series: 1, cantidad: 8 },
      calentamiento: true,
      seccion: 'entrada',
    }
    const { pasos } = pasosConMolestia([entrada], 'traccion')
    expect(pasos[0]).toMatchObject({ ejercicioId: 'remo-australiano-bajo', calentamiento: true })
    expect(pasos[0]!.objetivo.series).toBe(1)
  })

  it('acepta una cadena sola o varias, como las junta molestiasDeLaSesion', () => {
    const pasos = [fijo('dominada-negativa'), fijo('flexion-completa')]
    const varias = pasosConMolestia(pasos, molestiasDeLaSesion([soloMolestia('empuje')], HOY, ['traccion']))
    expect(varias.cambios.map((c) => c.patron).sort()).toEqual(['empuje', 'traccion'])
    expect(pasosConMolestia(pasos, ['traccion']).cambios).toEqual(pasosConMolestia(pasos, 'traccion').cambios)
  })

  it('ningún ejercicio fijo deja cargada su cadena con molestia en su eslabón de siempre', () => {
    // Cada ficha del catálogo, como paso fijo, con molestia en su cadena: o se
    // saltea, o baja a otro ejercicio de esa cadena que pide menos, con dos
    // series como mucho y sin kilos.
    for (const ejercicio of [...EJERCICIOS, variante, varianteDelPrimero, accesorio]) {
      const paso = { ...fijo(ejercicio.id), objetivo: { series: 4, cantidad: 10, kg: 5 } }
      const { pasos, cambios } = pasosConMolestia([paso], ejercicio.patron, { ejercicios: catalogo })
      expect(cambios, ejercicio.id).toHaveLength(1)
      if (cambios[0]!.cambio === 'saltea') {
        expect(pasos, ejercicio.id).toEqual([])
        continue
      }
      const bajado = POR_ID.get(pasos[0]!.ejercicioId)!
      expect(bajado.id, ejercicio.id).not.toBe(ejercicio.id)
      expect(bajado.patron, ejercicio.id).toBe(ejercicio.patron)
      expect(cadenaDe(ejercicio.patron).ejercicios, ejercicio.id).toContain(bajado.id)
      expect(bajado.ccr, ejercicio.id).toBeLessThanOrEqual(ejercicio.ccr)
      expect(pasos[0]!.objetivo, ejercicio.id).toEqual({
        series: SERIES_CON_MOLESTIA,
        cantidad: bajado.ventana.min,
      })
    }
  })

  it('el paso bajado no hunde la curva de fuerza, aunque sea fijo', () => {
    // Desde la reestructura la curva toma los fijos de las rutinas. Un eslabón
    // de abajo con dos series al piso, ese día, no es haber perdido fuerza.
    const { pasos } = pasosConMolestia([fijo('dominada-negativa')], 'traccion')
    const bajado = pasos[0]!
    const hechas = { [bajado.id!]: [{ logrado: bajado.objetivo.cantidad }, { logrado: bajado.objetivo.cantidad }] }
    const sesion: Sesion = {
      id: 's',
      fecha: HOY,
      finalizadaEn: 1,
      duracionSegundos: 900,
      tipo: 'plan',
      registros: registrosDeLaSesion(pasos, hechas),
    }
    expect(sesion.registros[0]).toMatchObject({ bajada: true, fijo: true })
    expect(curvaDeFuerza([sesion], 'traccion')).toEqual([])
  })

  it('es pura: no toca los pasos que recibe', () => {
    const pasos = [deCadena('dominada-negativa'), fijo('dominada-asistida')]
    const copia = structuredClone(pasos)
    pasosConMolestia(pasos, 'traccion')
    expect(pasos).toEqual(copia)
  })

  it('un borrador viejo, sin clase, se lee como lo lee normalizarBorrador', () => {
    // Antes solo había eslabones del motor y bajadas: lo que traía `bajada` es
    // volumen y se saltea; lo demás es el eslabón, y baja.
    const viejo: PasoDelBorrador[] = [
      { ejercicioId: 'dominada-negativa', objetivo: { series: 3, cantidad: 10 } },
      { ejercicioId: 'remo-australiano-bajo', objetivo: { series: 2, cantidad: 15 }, bajada: true },
    ]
    const { pasos, cambios } = pasosConMolestia(viejo, 'traccion')
    expect(pasos.map((p) => p.ejercicioId)).toEqual(['remo-australiano-pies-elevados'])
    expect(cambios.map((c) => [c.paso, c.cambio])).toEqual([
      ['dominada-negativa', 'baja'],
      ['remo-australiano-bajo', 'saltea'],
    ])
  })
})
