/**
 * Movimiento reducido: qué rige y qué escribe el interruptor.
 *
 * La preferencia del teléfono está escondida en sus ajustes de accesibilidad,
 * así que la app tiene la suya. Pero no la reemplaza: mientras nadie toque el
 * interruptor, la app sigue al teléfono, también si cambia con la app
 * abierta. Por eso lo guardado tiene tres valores y no dos.
 *
 * Son reglas chicas y viven acá, sin DOM, porque las usan tres lugares —el
 * portero que aplica el atributo, el interruptor de Ajustes y la copia de
 * seguridad— y tienen que decir exactamente lo mismo en los tres.
 */

import type { Movimiento } from './tipos'

const VALORES: ReadonlySet<unknown> = new Set<Movimiento>(['sistema', 'reducido', 'completo'])

/**
 * Lo guardado, o `'sistema'` si no hay nada o lo que hay no se entiende.
 *
 * Una base o una copia de antes del interruptor no trae el campo, y eso no
 * es un error: quiere decir que nunca se eligió nada.
 */
export function movimientoGuardado(preferencias: { movimiento?: unknown }): Movimiento {
  return VALORES.has(preferencias.movimiento) ? (preferencias.movimiento as Movimiento) : 'sistema'
}

/** Si rige el movimiento reducido, con lo guardado y lo que pide el teléfono. */
export function rigeReducido(guardado: Movimiento, elTelefonoLoPide: boolean): boolean {
  if (guardado === 'reducido') return true
  if (guardado === 'completo') return false
  return elTelefonoLoPide
}

/**
 * Lo que escribe el interruptor al tocarlo: el valor explícito contrario al
 * que rige, nunca `'sistema'`. El interruptor muestra lo que se ve en la
 * pantalla y no lo guardado, así que tocarlo tiene que cambiar lo que se ve,
 * pida lo que pida el teléfono.
 */
export function movimientoAlTocar(rigeAhora: boolean): Movimiento {
  return rigeAhora ? 'completo' : 'reducido'
}
