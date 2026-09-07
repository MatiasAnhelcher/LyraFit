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
import {
  MESETA,
  avanceInicial,
  logradoTipico,
  rendimientoDeSesion,
  siguienteAvance,
} from './progresion'
import type { Avance, Ejercicio, Patron, Serie } from './tipos'

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
 */
function simular(
  patron: Patron,
  capacidad: (e: Ejercicio) => number,
  sesiones: number,
): Paso[] {
  const cadena = cadenaDe(patron)
  const ctx = { cadena, ejercicios: POR_ID }
  let avance: Avance = avanceInicial(cadena, POR_ID, 0)
  const traza: Paso[] = []

  for (let i = 1; i <= sesiones; i++) {
    const ejercicio = POR_ID.get(avance.ejercicioId)!
    const objetivo = avance.objetivoActual
    const logrado = Math.max(0, Math.min(capacidad(ejercicio), objetivo.cantidad))
    const series: Serie[] = Array.from({ length: objetivo.series }, () => ({ logrado }))

    const decision = siguienteAvance(
      avance,
      {
        rendimiento: rendimientoDeSesion(objetivo, series),
        tipico: logradoTipico(series),
      },
      ctx,
      i,
    )

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
