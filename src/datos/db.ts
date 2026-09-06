/**
 * La base de datos local.
 *
 * La app es *local-first*: la fuente de verdad está en tu dispositivo, en
 * IndexedDB, y por eso funciona en un parque sin señal igual que en tu casa.
 * No es una limitación, es una decisión de diseño — una app de entrenamiento
 * que necesita internet para anotar una serie es una app que vas a dejar de
 * usar el primer día que la barra esté lejos del wifi.
 *
 * Cada escritura deja además una marca en `pendientes`. Hoy nadie las lee: es
 * la costura por donde va a entrar la sincronización entre dispositivos sin
 * tener que reescribir la app. Está explicado en el README.
 */

import Dexie, { type Table } from 'dexie'
import type { Avance, Patron, Preferencias, Sesion } from '@/dominio/tipos'
import { RUTINA_POR_DEFECTO } from '@/dominio/rutinas'

/** Una escritura a la espera de viajar al servidor, cuando exista un servidor. */
export interface Pendiente {
  id?: number
  tabla: 'sesiones' | 'avances' | 'preferencias'
  clave: string
  operacion: 'guardar' | 'borrar'
  creadoEn: number
}

export class BasePalanca extends Dexie {
  sesiones!: Table<Sesion, string>
  avances!: Table<Avance, Patron>
  preferencias!: Table<Preferencias, string>
  pendientes!: Table<Pendiente, number>

  constructor() {
    super('palanca')

    // Cada versión es una migración. Nunca se edita una versión ya publicada:
    // se agrega la siguiente. Así la base de alguien que ya venía usando la
    // app se actualiza sola en vez de romperse.
    this.version(1).stores({
      sesiones: 'id, fecha, finalizadaEn',
      avances: 'patron, actualizadoEn',
      preferencias: 'id',
      pendientes: '++id, creadoEn',
    })
  }
}

export const db = new BasePalanca()

export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  id: 'unico',
  rutinaActivaId: RUTINA_POR_DEFECTO,
  sonidoDescanso: true,
  tema: 'sistema',
}

/** Registra la escritura en la cola de sincronización. */
export async function marcarPendiente(
  tabla: Pendiente['tabla'],
  clave: string,
  operacion: Pendiente['operacion'] = 'guardar',
): Promise<void> {
  await db.pendientes.add({ tabla, clave, operacion, creadoEn: Date.now() })
}
