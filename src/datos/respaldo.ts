/**
 * El respaldo que ocurre solo.
 *
 * Un botón de "Exportar" en Ajustes no es un respaldo: es una tarea que le
 * estás delegando a alguien que abrió la app para entrenar, no para
 * administrar archivos. Nadie lo toca, y el día que hace falta no está.
 *
 * Así que acá hay dos cosas distintas:
 *
 * - Una **copia automática** al terminar cada sesión, guardada en el sistema
 *   de archivos privado del origen. Rota tres archivos y no pide permiso ni
 *   avisa nada.
 * - El **estado real de persistencia**, para poder decirle a la persona la
 *   verdad en Ajustes. Y la verdad tiene un matiz importante: en Safari
 *   `persist()` no es un pedido sino una consulta, y devuelve `false` mientras
 *   el sitio no esté instalado. Lo que de verdad protege los datos en iPhone
 *   es agregar la app a la pantalla de inicio.
 */

import { exportarTodo, validarRespaldo, type Respaldo } from './repositorio'

/** Cuántas copias automáticas se conservan antes de pisar la más vieja. */
const COPIAS = 3

const CARPETA = 'respaldos'

type Directorio = {
  getDirectoryHandle(nombre: string, opciones?: { create?: boolean }): Promise<Directorio>
  getFileHandle(nombre: string, opciones?: { create?: boolean }): Promise<FileHandle>
  removeEntry(nombre: string): Promise<void>
  keys(): AsyncIterableIterator<string>
}

type FileHandle = {
  createWritable(): Promise<{ write(dato: string): Promise<void>; close(): Promise<void> }>
  getFile(): Promise<File>
}

async function carpeta(): Promise<Directorio | null> {
  try {
    const raiz = (navigator.storage as unknown as { getDirectory?: () => Promise<Directorio> })
      ?.getDirectory
    if (!raiz) return null
    const base = await raiz.call(navigator.storage)
    return await base.getDirectoryHandle(CARPETA, { create: true })
  } catch {
    // Navegador sin sistema de archivos privado, modo privado, cuota agotada.
    // Ninguna es motivo para romper el cierre de una sesión.
    return null
  }
}

/**
 * Guarda una copia con la fecha de hoy y borra las más viejas.
 *
 * Se llama al cerrar cada sesión y nunca lanza: si falla, la app sigue
 * andando exactamente igual. Un respaldo que puede romper el flujo principal
 * es peor que no tener respaldo.
 */
export async function respaldarEnSilencio(): Promise<boolean> {
  try {
    const dir = await carpeta()
    if (!dir) return false

    const datos = await exportarTodo()
    const nombre = `lyrafit-${datos.exportadoEn.slice(0, 10)}.json`

    const archivo = await dir.getFileHandle(nombre, { create: true })
    const escritor = await archivo.createWritable()
    await escritor.write(JSON.stringify(datos))
    await escritor.close()

    const nombres: string[] = []
    for await (const clave of dir.keys()) nombres.push(clave)
    nombres.sort()
    for (const viejo of nombres.slice(0, Math.max(0, nombres.length - COPIAS))) {
      await dir.removeEntry(viejo).catch(() => {})
    }

    return true
  } catch {
    return false
  }
}

/** Las copias automáticas que hay guardadas, de la más nueva a la más vieja. */
export async function copiasGuardadas(): Promise<{ nombre: string; bytes: number }[]> {
  try {
    const dir = await carpeta()
    if (!dir) return []

    const nombres: string[] = []
    for await (const clave of dir.keys()) nombres.push(clave)

    const copias = await Promise.all(
      nombres.sort().reverse().map(async (nombre) => {
        const archivo = await (await dir.getFileHandle(nombre)).getFile()
        return { nombre, bytes: archivo.size }
      }),
    )
    return copias
  } catch {
    return []
  }
}

/** Recupera una copia automática por su nombre. */
export async function leerCopia(nombre: string): Promise<Respaldo | null> {
  try {
    const dir = await carpeta()
    if (!dir) return null
    const archivo = await (await dir.getFileHandle(nombre)).getFile()
    return validarRespaldo(JSON.parse(await archivo.text()))
  } catch {
    return null
  }
}

export interface EstadoDeAlmacenamiento {
  /** El navegador se comprometió a no borrar los datos por falta de espacio. */
  persistente: boolean
  /** La app está instalada en la pantalla de inicio. */
  instalada: boolean
  /** Cuántos bytes ocupa la base, si el navegador lo sabe. */
  usado: number | null
  /** Si hay copias automáticas funcionando. */
  copias: number
}

export async function estadoDeAlmacenamiento(): Promise<EstadoDeAlmacenamiento> {
  let persistente = false
  let usado: number | null = null

  try {
    persistente = (await navigator.storage?.persisted?.()) ?? false
    usado = (await navigator.storage?.estimate?.())?.usage ?? null
  } catch {
    // Algunos navegadores tiran al preguntar. No es motivo para no responder.
  }

  const instalada =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  return { persistente, instalada, usado, copias: (await copiasGuardadas()).length }
}

/**
 * Le pide al navegador que no borre la base.
 *
 * Se concede solo en algunos casos —app instalada, uso frecuente, marcador— y
 * en Safari directamente es una consulta y no un pedido. Así que esto es un
 * intento, no una garantía, y por eso existe todo lo demás de este archivo.
 */
export async function pedirPersistencia(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
