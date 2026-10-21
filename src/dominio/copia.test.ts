/**
 * La copia de seguridad, fila por fila.
 *
 * Restaurar reemplaza la única copia de los datos que existe. Antes se miraba
 * la cáscara —la versión y que hubiera dos listas— y un archivo con una sesión
 * sin registros pasaba, decía "Listo" y dejaba Hoy y Progreso en blanco para
 * siempre. Acá está, para cada tabla, que una fila rota rechace el archivo
 * entero y diga cuál; que una copia vieja de verdad siga entrando; y que el
 * resumen que se muestra antes de confirmar cuente lo que hay.
 */

import { describe, expect, it } from 'vitest'
import {
  avisoDeRestaurada,
  cuantasSesiones,
  detalleDelResumen,
  fechaCorta,
  fraseDelReemplazo,
  resumenDeCopia,
  revisarCopia,
  type ResumenDeCopia,
} from './copia'

const sesion = (id: string, fecha: string) => ({
  id,
  fecha,
  finalizadaEn: 1_760_000_000_000,
  duracionSegundos: 1800,
  tipo: 'plan',
  registros: [
    {
      ejercicioId: 'dominada',
      objetivo: { series: 3, cantidad: 5 },
      series: [{ logrado: 5, predicho: 6 }, { logrado: 4, kg: 5 }, { logrado: 4, cierre: true }],
    },
  ],
  decisiones: [
    { patron: 'traccion', movimiento: 'mantener', explicacion: 'Seguís acá.', cambioDeNivel: false },
  ],
})

const avance = {
  patron: 'traccion',
  ejercicioId: 'dominada',
  objetivoActual: { series: 3, cantidad: 5 },
  senal: 1,
  sesionesEnObjetivo: 2,
  graciaRestante: 0,
  actualizadoEn: 1,
}

function copia(cambios: Record<string, unknown> = {}) {
  return {
    version: 3,
    exportadoEn: '2026-10-03T15:00:00.000Z',
    sesiones: [sesion('a', '2026-09-01'), sesion('b', '2026-10-03')],
    avances: [avance],
    estados: [{ fecha: '2026-09-15', sueno: 4, energia: 3, musculos: 5, actualizadoEn: 1 }],
    preferencias: { id: 'unico', rutinaActivaId: 'cuerpo-completo', altaCompletadaEn: 1 },
    diario: [{ fecha: '2026-08-30', sueno: '7-8', porcionesDeProteina: 4, actualizadoEn: 1 }],
    ...cambios,
  }
}

/** El problema, o falla el test si la copia pasó. */
function problemaDe(dato: unknown): string {
  const r = revisarCopia(dato)
  if (!('problema' in r)) throw new Error('la copia pasó y tenía que rechazarse')
  return r.problema
}

describe('una copia sana entra entera', () => {
  it('trae lo mismo que tenía, en la forma de hoy', () => {
    const r = revisarCopia(copia())
    if ('problema' in r) throw new Error(r.problema)
    expect(r.copia.version).toBe(3)
    expect(r.copia.sesiones).toHaveLength(2)
    expect(r.copia.sesiones[0]!.registros[0]!.series).toHaveLength(3)
    expect(r.copia.avances).toEqual([avance])
  })

  it('la hora de acostarse contestada vuelve con su marca', () => {
    // Sin la marca, al restaurar la copia la hora pasaría por una de las
    // 23:00 que la app inventaba y dejaría de usarse.
    const dia = { fecha: '2026-08-30', horaDeDormir: 60, horaDeDormirContestada: true, actualizadoEn: 1 }
    const r = revisarCopia(copia({ diario: [dia] }))
    if ('problema' in r) throw new Error(r.problema)
    expect(r.copia.diario).toEqual([dia])
  })

  it('lo que no conoce lo deja pasar: un campo nuevo no vuelve rota una fila', () => {
    const conAlgoNuevo = { ...sesion('a', '2026-09-01'), algoDelFuturo: { x: 1 } }
    const r = revisarCopia(copia({ sesiones: [conAlgoNuevo] }))
    if ('problema' in r) throw new Error(r.problema)
    expect(r.copia.sesiones[0]).toMatchObject({ algoDelFuturo: { x: 1 } })
  })

  it('una v1 de verdad entra: tipo de sesión por defecto y niveles traducidos al motor de hoy', () => {
    // La traducción es la misma que hace la migración v2 de la base.
    const viejo = (exitos: number, fallos: number, patron: string) => {
      const { senal, sesionesEnObjetivo, graciaRestante, ...resto } = avance
      void senal
      void sesionesEnObjetivo
      void graciaRestante
      return { ...resto, patron, rachaExitos: exitos, rachaFallos: fallos }
    }
    const { tipo, ...sinTipo } = sesion('a', '2026-01-05')
    void tipo
    const r = revisarCopia({
      version: 1,
      exportadoEn: '2026-01-05T15:00:00.000Z',
      sesiones: [sinTipo],
      avances: [viejo(0, 2, 'traccion'), viejo(3, 0, 'empuje'), viejo(0, 0, 'core')],
      preferencias: { id: 'unico', rutinaActivaId: 'cuerpo-completo' },
    })
    if ('problema' in r) throw new Error(r.problema)
    expect(r.copia.sesiones[0]!.tipo).toBe('plan')
    expect(r.copia.estados).toEqual([])
    expect(r.copia.diario).toEqual([])
    expect(r.copia.avances.map((a) => a.senal)).toEqual([0.8, 1, 0.95])
    expect(r.copia.avances[0]).not.toHaveProperty('rachaFallos')
    expect(r.copia.avances[0]!.sesionesEnObjetivo).toBe(0)
  })
})

describe('el movimiento reducido viaja en la copia', () => {
  it('una copia que lo trae lo restaura tal cual', () => {
    for (const movimiento of ['reducido', 'completo', 'sistema'] as const) {
      const r = revisarCopia(
        copia({ preferencias: { id: 'unico', rutinaActivaId: 'cuerpo-completo', movimiento } }),
      )
      if ('problema' in r) throw new Error(r.problema)
      expect(r.copia.preferencias.movimiento).toBe(movimiento)
    }
  })

  it('una copia de antes del interruptor se lee como seguir al teléfono', () => {
    const r = revisarCopia(copia())
    if ('problema' in r) throw new Error(r.problema)
    expect(copia().preferencias).not.toHaveProperty('movimiento')
    expect(r.copia.preferencias.movimiento).toBe('sistema')
  })

  it('un valor que no se entiende no rompe la copia: vuelve a seguir al teléfono', () => {
    const r = revisarCopia(
      copia({ preferencias: { id: 'unico', rutinaActivaId: 'cuerpo-completo', movimiento: 'quieto' } }),
    )
    if ('problema' in r) throw new Error(r.problema)
    expect(r.copia.preferencias.movimiento).toBe('sistema')
    expect(r.copia.preferencias.rutinaActivaId).toBe('cuerpo-completo')
  })
})

describe('una sola fila rota rechaza el archivo, y dice cuál', () => {
  it('la sesión sin registros, que dejaba Hoy en blanco para siempre', () => {
    const { registros, ...sinRegistros } = sesion('b', '2026-10-03')
    void registros
    const problema = problemaDe(copia({ sesiones: [sesion('a', '2026-09-01'), sinRegistros] }))
    expect(problema).toContain('La sesión 2')
    expect(problema).toContain('ejercicios')
  })

  it('una sesión sin fecha válida, sin cierre o con un tipo que no existe', () => {
    expect(problemaDe(copia({ sesiones: [{ ...sesion('a', '2026-09-01'), fecha: '2026-13-01' }] })))
      .toContain('fecha')
    const { finalizadaEn, ...sinCierre } = sesion('a', '2026-09-01')
    void finalizadaEn
    expect(problemaDe(copia({ sesiones: [sinCierre] }))).toContain('cuándo se cerró')
    expect(problemaDe(copia({ sesiones: [{ ...sesion('a', '2026-09-01'), tipo: 'magia' }] })))
      .toContain('tipo')
  })

  it('una serie sin número', () => {
    const rota = sesion('a', '2026-09-01')
    rota.registros[0]!.series[1] = { logrado: 'cuatro' as unknown as number, kg: 5 }
    expect(problemaDe(copia({ sesiones: [rota] }))).toContain('serie del ejercicio 1')
  })

  it('un ejercicio sin objetivo', () => {
    const rota = { ...sesion('a', '2026-09-01'), registros: [{ ejercicioId: 'x', series: [] }] }
    expect(problemaDe(copia({ sesiones: [rota] }))).toContain('objetivo')
  })

  it('un nivel de una cadena que no existe, o sin los números del motor', () => {
    expect(problemaDe(copia({ avances: [{ ...avance, patron: 'brazos' }] }))).toContain('El nivel 1')
    const { senal, ...sinSenal } = avance
    void senal
    expect(problemaDe(copia({ avances: [sinSenal] }))).toContain('motor')
  })

  it('un chequeo o un día del diario rotos', () => {
    expect(problemaDe(copia({ estados: [{ fecha: '2026-09-15', sueno: 4 }] }))).toContain(
      'El chequeo 1',
    )
    expect(problemaDe(copia({ diario: [{ fecha: 'ayer', actualizadoEn: 1 }] }))).toContain(
      'El día 1 del diario',
    )
    expect(
      problemaDe(copia({ diario: [{ fecha: '2026-08-30', creatina: 'sí', actualizadoEn: 1 }] })),
    ).toContain('sí o no')
    // La marca de "esta hora la contestó la persona" es lo que separa una
    // respuesta de las 23:00 que la app inventaba: rota, no puede entrar.
    expect(
      problemaDe(
        copia({ diario: [{ fecha: '2026-08-30', horaDeDormir: 60, horaDeDormirContestada: 'sí', actualizadoEn: 1 }] }),
      ),
    ).toContain('sí o no')
  })

  it('una molestia avisada con el chequeo apagado no rompe la copia', () => {
    // Es la fila que escribe `guardarMolestiaDeHoy` sin chequeo: la molestia
    // sola. Rechazarla dejaba sin poder restaurar su copia a quien avisó.
    const sola = { fecha: '2026-09-20', molestia: 'traccion', actualizadoEn: 1 }
    const r = revisarCopia(copia({ estados: [sola] }))
    if ('problema' in r) throw new Error(r.problema)
    expect(r.copia.estados).toEqual([sola])

    // Pero sin respuestas y sin molestia, o con respuestas a medias, sigue rota.
    expect(problemaDe(copia({ estados: [{ fecha: '2026-09-20', actualizadoEn: 1 }] }))).toContain(
      'tres respuestas',
    )
    expect(
      problemaDe(copia({ estados: [{ fecha: '2026-09-20', sueno: 4, molestia: 'traccion' }] })),
    ).toContain('tres respuestas')
    expect(
      problemaDe(copia({ estados: [{ fecha: '2026-09-20', molestia: 'muñeca' }] })),
    ).toContain('El chequeo 1')
  })

  it('sin preferencias no entra: mandaría al alta, que pisa los niveles restaurados', () => {
    expect(problemaDe(copia({ preferencias: undefined }))).toContain('preferencias')
    expect(problemaDe(copia({ preferencias: { id: 'otro' } }))).toContain('preferencias')
  })

  it('dos filas con la misma clave se pisarían: el resumen contaría de más', () => {
    expect(problemaDe(copia({ sesiones: [sesion('a', '2026-09-01'), sesion('a', '2026-09-02')] })))
      .toContain('mismo identificador')
  })

  it('sin la fecha en que se hizo, o sin listas, no es una copia', () => {
    expect(problemaDe(copia({ exportadoEn: undefined }))).toContain('fecha en que se hizo')
    expect(problemaDe(copia({ estados: 'nada' }))).toContain('chequeo diario')
    expect(problemaDe({ version: 3 })).toContain('sesiones o los avances')
    expect(problemaDe(copia({ version: 9 }))).toContain('versión')
  })
})

describe('el resumen antes de confirmar', () => {
  it('cuenta cada cosa y va del primer al último día con algo guardado', () => {
    const r = revisarCopia(copia())
    if ('problema' in r) throw new Error(r.problema)
    expect(resumenDeCopia(r.copia)).toEqual({
      sesiones: 2,
      diario: 1,
      chequeos: 1,
      desde: '2026-08-30',
      hasta: '2026-10-03',
    })
  })

  it('una molestia avisada sola no se cuenta como chequeo, pero su día sí está', () => {
    const r = revisarCopia(
      copia({
        estados: [
          { fecha: '2026-09-15', sueno: 4, energia: 3, musculos: 5, actualizadoEn: 1 },
          { fecha: '2026-10-05', molestia: 'core', actualizadoEn: 1 },
        ],
      }),
    )
    if ('problema' in r) throw new Error(r.problema)
    expect(resumenDeCopia(r.copia)).toMatchObject({ chequeos: 1, hasta: '2026-10-05' })
  })

  it('una base vacía no tiene rango', () => {
    expect(resumenDeCopia({ sesiones: [], estados: [], diario: [] })).toEqual({
      sesiones: 0,
      diario: 0,
      chequeos: 0,
      desde: null,
      hasta: null,
    })
  })

  const resumen = (cambios: Partial<ResumenDeCopia>): ResumenDeCopia => ({
    sesiones: 0,
    diario: 0,
    chequeos: 0,
    desde: null,
    hasta: null,
    ...cambios,
  })

  it('el renglón chico dice de cuándo a cuándo y lo demás que trae', () => {
    expect(
      detalleDelResumen(resumen({ desde: '2026-09-01', hasta: '2026-10-03', diario: 20, chequeos: 1 })),
    ).toBe('del 1/9/2026 al 3/10/2026 · 20 días del diario · 1 chequeo')
    expect(detalleDelResumen(resumen({ desde: '2026-09-01', hasta: '2026-09-01' }))).toBe(
      'del 1/9/2026',
    )
    expect(detalleDelResumen(resumen({}))).toBe('sin nada anotado')
  })

  it('la frase pone primero lo que se pierde', () => {
    expect(fraseDelReemplazo(resumen({ sesiones: 12 }), resumen({ sesiones: 34 }))).toBe(
      'Vas a reemplazar 34 sesiones por 12.',
    )
    expect(fraseDelReemplazo(resumen({ sesiones: 0 }), resumen({ sesiones: 1 }))).toBe(
      'Vas a reemplazar 1 sesión por 0.',
    )
    expect(fraseDelReemplazo(resumen({ sesiones: 1 }), resumen({ sesiones: 0 }))).toBe(
      'Hoy no tenés sesiones guardadas. El archivo trae 1 sesión.',
    )
  })

  it('las fechas como se escriben acá', () => {
    expect(fechaCorta('2026-09-01')).toBe('1/9/2026')
    expect(cuantasSesiones(1)).toBe('1 sesión')
    expect(cuantasSesiones(2)).toBe('2 sesiones')
  })

  it('el aviso de después concuerda con el número, también con una sola', () => {
    expect(avisoDeRestaurada(1, true)).toBe(
      'Listo: 1 sesión restaurada. Lo que tenías quedó en una copia automática.',
    )
    expect(avisoDeRestaurada(12, false)).toBe('Listo: 12 sesiones restauradas.')
    expect(avisoDeRestaurada(0, false)).toBe('Listo: 0 sesiones restauradas.')
  })
})
