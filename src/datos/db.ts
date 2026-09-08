/**
 * La base de datos local.
 *
 * La app es *local-first*: la fuente de verdad está en tu dispositivo, en
 * IndexedDB, y por eso funciona en un parque sin señal igual que en tu casa.
 * No es una limitación, es una decisión de diseño — una app de entrenamiento
 * que necesita internet para anotar una serie es una app que vas a dejar de
 * usar el primer día que la barra esté lejos del wifi.
 *
 * Y como no hay servidor, esto no es *una* copia de tus datos: es la única. De
 * ahí sale el resto del diseño de esta carpeta — el respaldo automático de
 * `respaldo.ts`, el pedido de persistencia al navegador y el aviso en Ajustes
 * cuando ese pedido no alcanza.
 *
 * Cada escritura deja además una marca en `pendientes`. Hoy nadie las lee: es
 * la costura por donde va a entrar la sincronización entre dispositivos sin
 * tener que reescribir la app.
 */

import Dexie, { type Table } from 'dexie'
import type { Avance, Estado, Patron, Preferencias, Sesion, SesionEnCurso } from '@/dominio/tipos'
import { RUTINA_POR_DEFECTO } from '@/dominio/rutinas'

/** Una escritura a la espera de viajar al servidor, cuando exista un servidor. */
export interface Pendiente {
  id?: number
  tabla: 'sesiones' | 'avances' | 'preferencias' | 'estados'
  clave: string
  operacion: 'guardar' | 'borrar'
  creadoEn: number
}

export class BaseLyraFit extends Dexie {
  sesiones!: Table<Sesion, string>
  avances!: Table<Avance, Patron>
  preferencias!: Table<Preferencias, string>
  pendientes!: Table<Pendiente, number>
  estados!: Table<Estado, string>
  curso!: Table<SesionEnCurso, string>

  constructor() {
    super('lyrafit')

    // Cada versión es una migración. Nunca se edita una versión ya publicada:
    // se agrega la siguiente. Así la base de alguien que ya venía usando la
    // app se actualiza sola en vez de romperse.
    this.version(1).stores({
      sesiones: 'id, fecha, finalizadaEn',
      avances: 'patron, actualizadoEn',
      preferencias: 'id',
      pendientes: '++id, creadoEn',
    })

    // v2 — el chequeo diario, y el motor de progresión reescrito.
    //
    // El `Avance` cambió de forma: las dos rachas se reemplazaron por una
    // señal suavizada. Los campos nuevos no van en el índice, así que Dexie no
    // necesita saber de ellos, pero los avances que ya estaban guardados sí
    // hay que traducirlos o el motor arranca leyendo `undefined`.
    this.version(2)
      .stores({
        sesiones: 'id, fecha, finalizadaEn',
        avances: 'patron, actualizadoEn',
        preferencias: 'id',
        pendientes: '++id, creadoEn',
        estados: 'fecha, actualizadoEn',
      })
      .upgrade(async (tx) => {
        await tx
          .table('avances')
          .toCollection()
          .modify((avance: Record<string, unknown>) => {
            // Quien venía cumpliendo arranca con la señal a favor; quien venía
            // fallando, en contra. Es la traducción más fiel posible de dos
            // contadores a una media móvil.
            const exitos = Number(avance.rachaExitos ?? 0)
            const fallos = Number(avance.rachaFallos ?? 0)
            avance.senal = fallos > 0 ? 0.8 : exitos > 0 ? 1 : 0.95
            avance.sesionesEnObjetivo = 0
            avance.graciaRestante = 0
            delete avance.rachaExitos
            delete avance.rachaFallos
          })

        // Las sesiones viejas son todas del plan: es el único tipo que existía.
        await tx
          .table('sesiones')
          .toCollection()
          .modify((sesion: Record<string, unknown>) => {
            sesion.tipo ??= 'plan'
          })
      })

    // v3 — la sesión a medio hacer sobrevive a que el navegador recicle la
    // pestaña. Es una tabla nueva y nada vieja cambia de forma, así que no
    // hace falta migrar nada: `upgrade` sobra y por eso no está.
    this.version(3).stores({
      sesiones: 'id, fecha, finalizadaEn',
      avances: 'patron, actualizadoEn',
      preferencias: 'id',
      pendientes: '++id, creadoEn',
      estados: 'fecha, actualizadoEn',
      curso: 'id',
    })
  }
}

export const db = new BaseLyraFit()

export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  id: 'unico',
  rutinaActivaId: RUTINA_POR_DEFECTO,
  sonidoDescanso: true,
  tema: 'sistema',
  encuadre: 'logrado',
  estadoActivo: false,
  prediccionActiva: true,
}

/** Registra la escritura en la cola de sincronización. */
export async function marcarPendiente(
  tabla: Pendiente['tabla'],
  clave: string,
  operacion: Pendiente['operacion'] = 'guardar',
): Promise<void> {
  await db.pendientes.add({ tabla, clave, operacion, creadoEn: Date.now() })
}
