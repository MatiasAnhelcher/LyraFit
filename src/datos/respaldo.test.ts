/**
 * El respaldo, que es la única red que tiene el dueño.
 *
 * No hay servidor. El archivo que sale de Ajustes y la copia automática que
 * corre al cerrar cada sesión son la única forma de que sus datos sobrevivan
 * a que Safari desaloje el almacenamiento o a que cambie de teléfono.
 *
 * Estos tests existen porque esa red tenía un agujero y nadie lo vio: la v4
 * de la base agregó la tabla `diario` —comida y sueño— y la interfaz
 * `Respaldo` se quedó en cuatro tablas. Durante todo ese tiempo ninguna copia
 * contuvo una sola fila del diario, en la función cuyo comentario dice ser
 * "la forma de no perderlos nunca, que importa más".
 *
 * La parte de Dexie se verifica aparte, en `respaldo.mjs`, que hace la vuelta
 * entera contra una base real. Acá está lo que se puede medir sin navegador:
 * que una copia vieja entre, y que la forma declarada sea la completa.
 */

import { describe, expect, it } from 'vitest'
import { db } from './db'
import { RespaldoInvalido, validarRespaldo } from './repositorio'

const BASE = {
  version: 2 as const,
  exportadoEn: '2026-03-10T12:00:00.000Z',
  sesiones: [],
  avances: [],
  estados: [],
  preferencias: { id: 'unico' },
}

describe('una copia vieja se puede restaurar', () => {
  it('la v2 entra, y el diario queda vacío en vez de indefinido', () => {
    // Es el caso real de cualquiera que exportó antes de que el diario
    // existiera. Tiene que entrar, y `importarTodo` hace `?? []` sobre esto:
    // si llegara `undefined` el bulkPut explotaría.
    const r = validarRespaldo(BASE)
    expect(r.diario).toEqual([])
    expect(r.version).toBe(3)
  })

  it('la v1 también, que es la más vieja que existió', () => {
    const { estados, ...v1 } = BASE
    void estados
    const r = validarRespaldo({ ...v1, version: 1, sesiones: [{ tipo: undefined }] })
    expect(r.estados).toEqual([])
    expect(r.diario).toEqual([])
    // El tipo de sesión no existía en la v1 y todas eran del plan.
    expect(r.sesiones[0]!.tipo).toBe('plan')
  })

  it('una v3 conserva su diario', () => {
    const dia = { fecha: '2026-03-10', sueno: '7-8' as const, actualizadoEn: 1 }
    const r = validarRespaldo({ ...BASE, version: 3, diario: [dia] })
    expect(r.diario).toEqual([dia])
  })

  it('una versión del futuro se rechaza con una frase que se entiende', () => {
    expect(() => validarRespaldo({ ...BASE, version: 99 })).toThrow(RespaldoInvalido)
  })

  it('un archivo que no es una copia se rechaza', () => {
    expect(() => validarRespaldo(null)).toThrow(RespaldoInvalido)
    expect(() => validarRespaldo({ version: 2 })).toThrow(RespaldoInvalido)
  })
})

describe('la forma del respaldo no se puede quedar corta', () => {
  it('declara una clave por cada tabla que guarda datos del dueño', () => {
    /*
     * El test que habría evitado el agujero, y la razón por la que no es una
     * lista escrita a mano: se compara contra las tablas REALES de Dexie.
     *
     * Quedan afuera dos a propósito y están nombradas: `pendientes` es la
     * cola de sincronización —metadatos de una sincronización que todavía no
     * existe— y `curso` es el borrador de la sesión a medio hacer, que no se
     * restaura nunca porque viene de un plan que la copia no conoce. Si
     * mañana aparece una tabla nueva, este test falla hasta que alguien
     * decida explícitamente de qué lado va.
     */
    const SIN_RESPALDAR = new Set(['pendientes', 'curso'])
    const DECLARADAS = new Set(['sesiones', 'avances', 'estados', 'preferencias', 'diario'])

    // Las tablas de la última versión del esquema, leídas de Dexie y no
    // copiadas: así no hay dos listas que se puedan desincronizar.
    const tablas = db.tables.map((t) => t.name)
    expect(tablas.length).toBeGreaterThan(0)

    const faltan = tablas.filter((t) => !DECLARADAS.has(t) && !SIN_RESPALDAR.has(t))
    expect(
      faltan,
      `tablas sin respaldar y sin declarar como excluidas: ${faltan.join(', ')}`,
    ).toEqual([])

    const sobran = [...DECLARADAS].filter((t) => !tablas.includes(t))
    expect(sobran, `declaradas en el respaldo y sin tabla: ${sobran.join(', ')}`).toEqual([])
  })
})
