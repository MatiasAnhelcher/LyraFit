/**
 * El número de sesión del Cierre, contado como el contador de vida.
 *
 * `numeroDeSesion` sale de `cerrarSesion`, que vive entre la base y el motor,
 * y no tiene una función pura propia: es una cuenta dentro de la transacción.
 * Por eso se prueba corriendo el `cerrarSesion` de verdad sobre una base en
 * memoria con la forma mínima que usa un cierre. Lo que importa es que una
 * movilidad de cinco minutos no corra el número (§5.6 A): si lo corriera, el
 * Cierre de la sesión siguiente diría "Sesión 13" cuando la persona entrenó
 * 12 veces, y un hito podría festejarse con un número que no es verdad.
 *
 * Lo demás del cierre —la transacción, el borrador, la copia— lo prueban
 * `datos.mjs` y `rescate.mjs` contra una base real en el navegador.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrigenDeSesion, Sesion, SesionEnCurso } from '@/dominio/tipos'
import { cerrarSesion } from './repositorio'

/** La base en memoria: solo las filas que un cierre lee o escribe. */
const base = vi.hoisted(() => ({
  sesiones: new Map<string, unknown>(),
  curso: new Map<string, unknown>(),
}))

vi.mock('./db', async (importOriginal) => {
  const real = await importOriginal<typeof import('./db')>()
  const porCierre = () =>
    [...base.sesiones.values()].sort(
      (x, y) => (y as Sesion).finalizadaEn - (x as Sesion).finalizadaEn,
    )
  const db = {
    transaction: async (_modo: string, _tablas: unknown, hacer: () => Promise<unknown>) => hacer(),
    sesiones: {
      get: async (id: string) => base.sesiones.get(id),
      put: async (s: Sesion) => {
        base.sesiones.set(s.id, s)
      },
      orderBy: () => ({
        reverse: () => ({
          toArray: async () => porCierre(),
          limit: (n: number) => ({ toArray: async () => porCierre().slice(0, n) }),
        }),
      }),
    },
    avances: { toArray: async () => [], put: async () => undefined },
    estados: { orderBy: () => ({ toArray: async () => [] }) },
    preferencias: { get: async () => undefined },
    curso: {
      get: async (clave: string) => base.curso.get(clave),
      delete: async (clave: string) => {
        base.curso.delete(clave)
      },
    },
    pendientes: { add: async () => 1 },
  }
  return { ...real, db, marcarPendiente: async () => undefined }
})

const DIA = '2026-10-21'
let siguiente = 0

/** Una sesión ya guardada, con el origen que se le dé (o ninguno, como una vieja). */
function guardada(origen?: OrigenDeSesion): Sesion {
  siguiente += 1
  const s: Sesion = {
    id: `vieja-${siguiente}`,
    fecha: DIA,
    finalizadaEn: siguiente * 1000,
    duracionSegundos: 600,
    registros: [],
    tipo: origen?.clase === 'movilidad' ? 'fuelle' : 'plan',
    ...(origen ? { origen } : {}),
  }
  base.sesiones.set(s.id, s)
  return s
}

const MOVILIDAD: OrigenDeSesion = { clase: 'movilidad', sector: 'pecho', nombre: 'Movilidad de pecho' }
const MIX: OrigenDeSesion = { clase: 'mix', sector: 'brazos', nombre: 'Brazos', version: 'completa' }

/** El borrador de una sesión que está por cerrarse, con su origen. */
function borrador(idDeLaSesion: string, origen: OrigenDeSesion): SesionEnCurso {
  return {
    id: 'actual',
    arrancadaEn: 0,
    duracionAcumulada: 300,
    actualizadoEn: 0,
    corta: false,
    indice: 0,
    etapa: 'preguntas',
    hechas: {},
    dia: DIA,
    origen,
    idDeLaSesion,
  }
}

/** Cierra la sesión del borrador, como lo hace Entrenar al terminar. */
async function cerrarConOrigen(origen: OrigenDeSesion) {
  siguiente += 1
  const id = `nueva-${siguiente}`
  base.curso.set('actual', borrador(id, origen))
  return cerrarSesion({
    registros: [],
    duracionSegundos: 300,
    tipo: origen.clase === 'movilidad' ? 'fuelle' : 'plan',
    fecha: DIA,
    cierraElBorrador: true,
    idDeLaSesion: id,
  })
}

beforeEach(() => {
  base.sesiones.clear()
  base.curso.clear()
})

describe('numeroDeSesion no cuenta la movilidad', () => {
  it('sin movilidades es el largo del historial más esta', async () => {
    guardada()
    guardada(MIX)
    const r = await cerrarSesion({ registros: [], duracionSegundos: 600, fecha: DIA })
    expect(r.numeroDeSesion).toBe(3)
  })

  it('una movilidad en el historial no corre el número de la siguiente', async () => {
    guardada()
    guardada(MOVILIDAD)
    guardada(MIX)
    guardada(MOVILIDAD)
    const r = await cerrarConOrigen(MIX)
    // Dos que contaron antes, y esta.
    expect(r.numeroDeSesion).toBe(3)
    expect(r.sesion.origen).toEqual(MIX)
  })

  it('cerrar una movilidad no suma: queda el número de la última que contó', async () => {
    guardada()
    guardada(MIX)
    const r = await cerrarConOrigen(MOVILIDAD)
    expect(r.sesion.origen?.clase).toBe('movilidad')
    expect(r.numeroDeSesion).toBe(2)
    // La movilidad se guardó igual: está en el historial, pero no es sesión.
    expect(base.sesiones.has(r.sesion.id)).toBe(true)
    // Y la sesión que viene después sigue la cuenta sin ella.
    const despues = await cerrarConOrigen(MIX)
    expect(despues.numeroDeSesion).toBe(3)
  })

  it('una sesión vieja sin origen cuenta, como siempre contó', async () => {
    guardada()
    guardada()
    guardada()
    const r = await cerrarSesion({ registros: [], duracionSegundos: 600, fecha: DIA })
    expect(r.numeroDeSesion).toBe(4)
  })
})
