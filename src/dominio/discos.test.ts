/**
 * El motor proponiendo discos.
 *
 * El agujero que esto tapa, dicho en una línea: en el último eslabón de una
 * cadena el motor sumaba repeticiones PARA SIEMPRE, y pasadas las doce
 * `fraccionDelMaximo` se satura por el tope de Brzycki, así que el índice de
 * carga quedaba congelado. La persona hacía veinte repeticiones de algo que ya
 * dominaba, la curva de fuerza quedaba horizontal y los hechos dejaban de
 * encontrar subidas.
 */

import { describe, expect, it } from 'vitest'
import { POR_ID, cadenaDe } from './biblioteca'
import {
  admiteDiscos,
  logradoTipico,
  pasoDeCarga,
  rendimientoDeSesion,
  siguienteAvance,
} from './progresion'
import type { Avance, Patron, Serie } from './tipos'

const BARRA = { pesoCorporalKg: 75, cargaMaximaKg: 45, pasoDeDiscoKg: 2.5 }

function ejercicio(id: string) {
  const e = POR_ID.get(id)
  if (!e) throw new Error(`falta ${id}`)
  return e
}

/** El último eslabón de una cadena, que es donde esto vive. */
function ultimoDe(patron: Patron) {
  const cadena = cadenaDe(patron)
  return ejercicio(cadena.ejercicios[cadena.ejercicios.length - 1]!)
}

/* `null` y no `undefined` para decir "sin barra": pasar `undefined` a un
   parámetro con valor por defecto dispara el valor por defecto, que es
   justamente la barra. El primer intento de estos tests pasaba `undefined` y
   medía el caso contrario al que decía medir. */
function ctxDe(patron: Patron, barra: typeof BARRA | null = BARRA) {
  return { cadena: cadenaDe(patron), ejercicios: POR_ID, ...(barra ? { barra } : {}) }
}

function avanceEn(
  id: string,
  cantidad: number,
  extra: Partial<Avance> & { kg?: number } = {},
): Avance {
  const e = ejercicio(id)
  const { kg, ...resto } = extra
  return {
    patron: e.patron,
    ejercicioId: id,
    objetivoActual: { series: e.series, cantidad, ...(kg !== undefined ? { kg } : {}) },
    senal: 1,
    // Ya consolidado: si no, el motor sostiene antes de llegar a los discos y
    // el test mediría el sostén y no la carga.
    sesionesEnObjetivo: 9,
    graciaRestante: 0,
    actualizadoEn: 0,
    ...resto,
  }
}

function cumpliendo(avance: Avance, barra: typeof BARRA | null = BARRA) {
  const objetivo = avance.objetivoActual
  const hechas: Serie[] = Array(objetivo.series)
    .fill(0)
    .map(() => ({ logrado: objetivo.cantidad, ...(objetivo.kg ? { kg: objetivo.kg } : {}) }))
  const ejer = ejercicio(avance.ejercicioId)
  const contexto = { ejercicio: ejer, ...(barra ? { pesoCorporalKg: barra.pesoCorporalKg } : {}), objetivo }
  return siguienteAvance(
    avance,
    {
      rendimiento: rendimientoDeSesion(objetivo, hechas, contexto),
      tipico: logradoTipico(hechas, contexto),
    },
    ctxDe(ejer.patron, barra),
  )
}

function fallando(avance: Avance, barra: typeof BARRA | null = BARRA) {
  const objetivo = avance.objetivoActual
  const hechas: Serie[] = Array(objetivo.series)
    .fill(0)
    .map(() => ({
      logrado: Math.max(1, Math.round(objetivo.cantidad * 0.5)),
      ...(objetivo.kg ? { kg: objetivo.kg } : {}),
    }))
  const ejer = ejercicio(avance.ejercicioId)
  const contexto = { ejercicio: ejer, ...(barra ? { pesoCorporalKg: barra.pesoCorporalKg } : {}), objetivo }
  return siguienteAvance(
    { ...avance, senal: 0.4 },
    {
      rendimiento: rendimientoDeSesion(objetivo, hechas, contexto),
      tipico: logradoTipico(hechas, contexto),
    },
    ctxDe(ejer.patron, barra),
  )
}

describe('cuándo admite discos', () => {
  const ultimo = ultimoDe('traccion')

  it('no, mientras una repetición más todavía mueva el índice', () => {
    // Por debajo de las doce, sumar es gratis y mide. Los discos no aportan
    // nada ahí y además cambian el gesto: lo primero es agotar lo barato.
    expect(admiteDiscos(ultimo, 11, BARRA)).toBe(false)
    expect(admiteDiscos(ultimo, 12, BARRA)).toBe(true)
    expect(admiteDiscos(ultimo, 18, BARRA)).toBe(true)
  })

  it('no, sin los tres datos de la barra', () => {
    // Es el interruptor maestro: sin cualquiera de los tres, la app se
    // comporta exactamente como antes de que existieran los kilos.
    expect(admiteDiscos(ultimo, 15, undefined)).toBe(false)
    expect(admiteDiscos(ultimo, 15, { ...BARRA, pesoCorporalKg: 0 })).toBe(false)
    expect(admiteDiscos(ultimo, 15, { ...BARRA, cargaMaximaKg: 0 })).toBe(false)
    expect(admiteDiscos(ultimo, 15, { ...BARRA, pasoDeDiscoKg: 0 })).toBe(false)
  })

  it('no, en los isométricos', () => {
    // Cargarle peso a una plancha cambia el ejercicio, no su intensidad, y el
    // motor no tiene forma de saber si lo que se cargó fue el abdomen o la
    // espalda baja.
    const core = ultimoDe('core')
    if (core.medida === 'segundos') expect(admiteDiscos(core, 60, BARRA)).toBe(false)
  })
})

describe('el paso es el disco, no un porcentaje', () => {
  it('la cadera lleva el doble que los brazos', () => {
    // 2,5 kg en lo que empuja o tracciona con los brazos; 5 en lo que mueve la
    // cadera, porque 2,5 sobre un peso muerto es ruido. Son los dos números
    // que están escritos en `docs/fuerza-con-barra.md`.
    expect(pasoDeCarga(ultimoDe('traccion'), BARRA)).toBe(2.5)
    expect(pasoDeCarga(ultimoDe('empuje'), BARRA)).toBe(2.5)
    expect(pasoDeCarga(ultimoDe('piernas'), BARRA)).toBe(5)
    expect(pasoDeCarga(ultimoDe('bisagra'), BARRA)).toBe(5)
  })

  it('con discos de 5 kg nunca propone un peso que no se puede armar', () => {
    // Una app que propone 1,8 kg a alguien con discos de 2,5 no hace que la
    // persona redondee: hace que deje de creerle al número.
    const gordos = { ...BARRA, pasoDeDiscoKg: 5 }
    expect(pasoDeCarga(ultimoDe('traccion'), gordos) % 5).toBe(0)
    expect(pasoDeCarga(ultimoDe('piernas'), gordos) % 5).toBe(0)
  })
})

describe('subiendo: primero las repeticiones, después los discos', () => {
  const ultimo = ultimoDe('traccion')

  it('con once repeticiones todavía suma repeticiones', () => {
    const d = cumpliendo(avanceEn(ultimo.id, 11))
    expect(d.avance.objetivoActual.kg).toBeUndefined()
    expect(d.avance.objetivoActual.cantidad).toBeGreaterThan(11)
  })

  it('con doce pone el primer disco y vuelve al piso de la ventana', () => {
    const d = cumpliendo(avanceEn(ultimo.id, 12))
    expect(d.avance.objetivoActual.kg).toBe(2.5)
    expect(d.avance.objetivoActual.cantidad).toBe(ultimo.ventana.min)
    expect(d.movimiento).toBe('subida')
    // El ejercicio es el MISMO: no hay eslabón nuevo que celebrar.
    expect(d.cambioDeNivel).toBe(false)
    expect(d.avance.ejercicioId).toBe(ultimo.id)
  })

  it('y después sigue sumando de a un disco', () => {
    const d = cumpliendo(avanceEn(ultimo.id, 12, { kg: 10 }))
    expect(d.avance.objetivoActual.kg).toBe(12.5)
  })

  it('el contador de consolidación se reinicia al cambiar el peso', () => {
    // Sostener veinte kilos tres sesiones no dice nada sobre sostener
    // veintidós: el objetivo es otro.
    const d = cumpliendo(avanceEn(ultimo.id, 12, { kg: 10 }))
    expect(d.avance.sesionesEnObjetivo).toBe(0)
  })

  it('en el tope de la barra lo dice, y no propone un peso que no existe', () => {
    const d = cumpliendo(avanceEn(ultimo.id, 12, { kg: 45 }))
    expect(d.avance.objetivoActual.kg).toBe(45)
    expect(d.explicacion).toContain('45 kg')
    expect(d.explicacion).toMatch(/pausa|despacio/)
    // Como otra forma de hacerlo más difícil, no como algo que "rinde más":
    // eso no tiene fuente y choca con la estrategia.
    expect(d.explicacion).not.toMatch(/rinde/i)
    // Y sigue moviéndose: se suman repeticiones, no se queda mudo.
    expect(d.avance.objetivoActual.cantidad).toBeGreaterThan(12)
  })

  it('sin barra se comporta exactamente como antes', () => {
    const d = cumpliendo(avanceEn(ultimo.id, 15), null)
    expect(d.avance.objetivoActual.kg).toBeUndefined()
    expect(d.avance.objetivoActual.cantidad).toBeGreaterThan(15)
    expect(d.explicacion).toContain('final de la cadena')
  })
})

describe('bajando: primero el peso, y las repeticiones al medio', () => {
  const ultimo = ultimoDe('traccion')
  const medio = Math.round((ultimo.ventana.min + ultimo.ventana.max) / 2)

  it('saca un disco antes de tocar las repeticiones', () => {
    const d = fallando(avanceEn(ultimo.id, ultimo.ventana.max, { kg: 10 }))
    expect(d.avance.objetivoActual.kg).toBe(7.5)
    expect(d.avance.objetivoActual.cantidad).toBe(medio)
  })

  it('las repeticiones van al medio y no al piso', () => {
    // Con el peso ya bajado, mandar también las repeticiones abajo del todo
    // sería bajar dos escalones de una por una sola mala racha.
    const d = fallando(avanceEn(ultimo.id, ultimo.ventana.min, { kg: 10 }))
    expect(d.avance.objetivoActual.cantidad).toBe(medio)
    expect(d.avance.objetivoActual.cantidad).toBeGreaterThan(ultimo.ventana.min)
  })

  it('sacar un disco se REGISTRA como bajada, no como subida', () => {
    /*
     * El campo `movimiento` no es una etiqueta decorativa: `Cierre.tsx` lo mira
     * para decidir si usa la frase de reencuadre, la que existe justamente para
     * que bajar de carga no se lea como "no servís para esto". Y el historial
     * de la sesión lo guarda.
     *
     * `conDiscos` tenía 'subida' escrito adentro y la rama de bajada lo
     * reusaba, así que la app te sacaba peso de la barra y te felicitaba: el
     * único momento que está diseñado para tratarse con cuidado, tratado como
     * su opuesto.
     *
     * Mis tests de esta rama verificaban los kilos y las repeticiones, y no
     * esto. Lo encontró una prueba de refutación de la revisión adversarial.
     */
    const d = fallando(avanceEn(ultimo.id, ultimo.ventana.max, { kg: 10 }))
    expect(d.movimiento).toBe('bajada')
    expect(d.explicacion).toContain('Sacamos')
  })

  it('poner un disco sí es una subida', () => {
    const d = cumpliendo(avanceEn(ultimo.id, 12, { kg: 10 }))
    expect(d.movimiento).toBe('subida')
  })

  it('el último disco deja el ejercicio a peso corporal, no en negativo', () => {
    const d = fallando(avanceEn(ultimo.id, 12, { kg: 2.5 }))
    expect(d.avance.objetivoActual.kg).toBe(0)
    expect(d.explicacion).toContain('peso corporal')
  })
})

describe('la invariante que hace que todo esto sea seguro', () => {
  const ult = ultimoDe('traccion')

  /**
   * Una sesión MEDIANA, con los números puestos a mano y no derivados.
   *
   * Y eso es deliberado, porque derivarlos fue mi error. Mi primer intento
   * armaba las series al 80% del objetivo y dejaba que `rendimientoDeSesion`
   * calculara: con la cantidad en 2 —que es donde `conDiscos` deja el
   * objetivo— el 80% de 2 redondea a 2, o sea una sesión PERFECTA. El test
   * medía el camino de la subida creyendo medir el de la meseta, y pasaba
   * igual con la guarda sacada. Lo verifiqué sacándola dos veces.
   *
   * Un rendimiento de 0,80 sostenido es justo la banda que rompía: queda
   * arriba de BAJA (0,75), así que la rama que saca discos NUNCA corre, y
   * abajo del punto medio de la meseta (0,85), así que a las pocas sesiones
   * el motor decide que el objetivo es optimista y retrocede de eslabón.
   */
  const RENDIMIENTO_MEDIANO = 0.8

  function mediocre(avance: Avance) {
    return siguienteAvance(
      avance,
      { rendimiento: RENDIMIENTO_MEDIANO, tipico: avance.objetivoActual.cantidad },
      ctxDe(ejercicio(avance.ejercicioId).patron),
    )
  }

  it('no se puede salir de un eslabón con discos puestos, FALLANDO', () => {
    let avance = avanceEn(ult.id, 12, { kg: 10 })
    for (let i = 0; i < 15; i++) {
      const d = fallando(avance)
      if (d.avance.ejercicioId !== avance.ejercicioId) {
        expect(avance.objetivoActual.kg ?? 0, 'cambió de eslabón con discos puestos').toBe(0)
        return
      }
      avance = d.avance
    }
    expect.fail('en quince sesiones fallando nunca retrocedió de eslabón')
  })

  it('no se puede salir de un eslabón con discos puestos, EN LA MESETA', () => {
    /*
     * El camino que de verdad rompía. Antes de la guarda, acá el motor
     * retrocedía de eslabón y `cambiarDeNivel` armaba el objetivo nuevo sin
     * `kg`: los 20 kg del dueño desaparecían y la explicación no los
     * mencionaba.
     *
     * El estado de arranque es el que deja `conDiscos` —cantidad en el piso
     * de la ventana, discos puestos—, que es desde donde se mesetea de
     * verdad.
     */
    // Cinco kilos —dos discos— y no veinte. Con veinte el escenario es el
    // mismo pero tarda cerca de cien sesiones: el motor saca un disco, vuelve
    // al medio de la ventana, y baja de a una repetición con tres sesiones de
    // consolidación entre cada paso. Son unas doce sesiones por disco. Lento
    // a propósito —es carga, no repeticiones— pero inviable para un test, y
    // la invariante es la misma con dos discos que con ocho.
    let avance = avanceEn(ult.id, ult.ventana.min, { kg: 5 })
    let retrocedio = false

    /*
     * Sesenta sesiones, y el número sale de la traza y no de la intuición.
     *
     * Con la guarda puesta hacen falta unas doce sesiones por disco, así que
     * dos discos entran holgados y ocho no entrarían. El bucle original era
     * de veinte y terminaba antes de llegar al retroceso: la aserción final
     * —la que exige que el escenario se haya REPRODUCIDO— lo dijo en vez de
     * dejar pasar un test verde que no probaba nada. Esa aserción es la que
     * más vale de este archivo.
     */
    for (let i = 0; i < 60; i++) {
      const antes = avance.objetivoActual.kg ?? 0
      const d = mediocre(avance)
      const despues = d.avance.objetivoActual.kg ?? 0

      if (d.avance.ejercicioId !== avance.ejercicioId) {
        retrocedio = true
        expect(antes, `sesión ${i}: cambió a ${d.avance.ejercicioId} con ${antes} kg puestos`).toBe(0)
        break
      }
      if (despues < antes) {
        expect(d.explicacion, `sesión ${i}: de ${antes} a ${despues} kg sin decirlo`).toMatch(
          /kg|disco|peso corporal/,
        )
      }
      avance = d.avance
    }

    // Y que el escenario de verdad haya llegado hasta el retroceso: si no,
    // este test no estaría probando nada, que es exactamente lo que le pasó
    // a su primera versión.
    expect(retrocedio, 'en veinte sesiones medianas nunca llegó a retroceder: el escenario no se reprodujo').toBe(true)
  })

  it('retroceder con discos saca peso en vez de cambiar de ejercicio', () => {
    const d = fallando(avanceEn(ult.id, ult.ventana.min, { kg: 5 }))
    expect(d.avance.ejercicioId).toBe(ult.id)
    expect(d.avance.objetivoActual.kg).toBe(2.5)
    expect(d.movimiento).toBe('bajada')
  })
})
