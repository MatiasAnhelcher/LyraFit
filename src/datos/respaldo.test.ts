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
 * La parte de Dexie se verifica aparte, en `datos.mjs`, que restaura contra
 * una base real y mira que antes se confirme y quede una copia automática.
 * Acá está lo que se puede medir sin navegador: que una copia vieja entre, que
 * una rota no, y que la forma declarada sea la completa. La revisión fila por
 * fila tiene sus casos en `src/dominio/copia.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { PREFERENCIAS_POR_DEFECTO, db } from './db'
import { RespaldoInvalido, validarRespaldo } from './repositorio'
import { ESPERA_DE_LA_COPIA, respaldarPronto } from './respaldo'

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
    // Y las rutinas, que tampoco existían: vacías, no indefinidas.
    expect(r.rutinas).toEqual([])
    expect(r.version).toBe(4)
  })

  it('la v1 también, que es la más vieja que existió', () => {
    const { estados, ...v1 } = BASE
    void estados
    // Una sesión v1 completa, sin el tipo que todavía no existía. La fila
    // tiene que estar entera: desde que la copia se revisa fila por fila, una
    // sesión sin fecha ni ejercicios es una fila rota, no una fila vieja.
    const sesionV1 = {
      id: 'v1',
      fecha: '2026-01-05',
      finalizadaEn: 1,
      duracionSegundos: 600,
      registros: [],
      tipo: undefined,
    }
    const r = validarRespaldo({ ...v1, version: 1, sesiones: [sesionV1] })
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

  it('una sesión sin registros rechaza el archivo entero, diciendo cuál', () => {
    // El caso medido: esta copia pasaba, la app decía "Listo: 1 sesiones
    // restauradas" y Hoy y Progreso quedaban en blanco para siempre.
    const rota = {
      ...BASE,
      sesiones: [{ id: 'x', fecha: '2026-03-10', finalizadaEn: 1, duracionSegundos: 60 }],
    }
    expect(() => validarRespaldo(rota)).toThrow(RespaldoInvalido)
    expect(() => validarRespaldo(rota)).toThrow(/sesión 1/)
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
    const DECLARADAS = new Set(['sesiones', 'avances', 'estados', 'preferencias', 'diario', 'rutinas'])

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

describe('los valores por defecto que encienden funciones', () => {
  it('el paso de disco viene puesto: sin él el motor de carga no existe', () => {
    /*
     * El motor de discos exige peso corporal, tope de barra y paso de disco.
     * Los dos primeros los pide Ajustes con una fila que se ve vacía; el
     * tercero mostraba "2,5" como texto de relleno, con el mismo formato que
     * un valor real.
     *
     * Así que alguien cargaba peso y barra, leía "2,5 kg", no tocaba nada —ya
     * decía lo que quería— y la progresión por carga no se encendía nunca. La
     * función titular de la entrega, muerta por un placeholder que parecía un
     * dato.
     *
     * Este test no cuida un número: cuida que la app no muestre un valor que
     * no tiene guardado.
     */
    expect(PREFERENCIAS_POR_DEFECTO.pasoDeDiscoKg).toBe(2.5)
  })

  it('y los otros dos NO vienen puestos, que también es a propósito', () => {
    // El peso corporal es el interruptor maestro y la app no puede inventarlo:
    // con un peso equivocado, toda la escala de carga del motor miente. Que
    // falte es lo que hace que no se ofrezcan discos hasta que la persona lo
    // diga.
    expect(PREFERENCIAS_POR_DEFECTO.pesoCorporalKg).toBeUndefined()
    expect(PREFERENCIAS_POR_DEFECTO.cargaMaximaKg).toBeUndefined()
  })
})

describe('la copia de cuando cambia algo fuera de una sesión', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /**
   * Un sistema de archivos privado que cuenta cuántas veces se pidió la
   * carpeta: una por copia. La base no está (no hay IndexedDB en los tests),
   * así que la copia falla después de pedirla, que es justo el caso de "una
   * copia que falla no lanza".
   */
  function contarCopias(): { copias: () => number } {
    let pedidas = 0
    const carpeta = {
      getDirectoryHandle: async () => carpeta,
      getFileHandle: async () => {
        throw new Error('sin archivos')
      },
      removeEntry: async () => {},
      keys: async function* () {},
    }
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: async () => {
          pedidas++
          return carpeta
        },
      },
    })
    return { copias: () => pedidas }
  }

  it('varias seguidas hacen una sola copia, después de la espera', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { copias } = contarCopias()
    respaldarPronto()
    respaldarPronto()
    await vi.advanceTimersByTimeAsync(ESPERA_DE_LA_COPIA - 1)
    respaldarPronto()
    expect(copias()).toBe(0)
    await vi.advanceTimersByTimeAsync(ESPERA_DE_LA_COPIA)
    expect(copias()).toBe(1)
  })

  it('una copia que falla no lanza ni deja una promesa rechazada', async () => {
    // Vitest marca la corrida entera como fallida ante una promesa rechazada
    // que nadie atrapa, así que alcanza con que la copia corra y falle.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let intentos = 0
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: async () => {
          intentos++
          throw new Error('cuota agotada')
        },
      },
    })
    expect(() => respaldarPronto()).not.toThrow()
    await vi.advanceTimersByTimeAsync(ESPERA_DE_LA_COPIA)
    expect(intentos).toBe(1)
  })
})
