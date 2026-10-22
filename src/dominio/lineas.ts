/**
 * Las líneas que salen de un dato.
 *
 * Cada una es una función pura que devuelve el texto, o `null` si falta el
 * dato que la sostiene. Ese `null` es la regla entera: una línea sin dato no
 * se inventa ni se rellena, no aparece. Las reglas de la voz (§7.1 de la
 * reestructura) valen todas acá: primero el dato y nada más, la hora en 24 h,
 * ningún signo de exclamación, nada de `PROHIBIDAS` y 140 caracteres como
 * mucho. `lineas.test.ts` las verifica una por una.
 *
 * No es Lyra: las frases de la mascota están en `frases.ts`, con su banco y su
 * tope de 96. Esto es lo que dice el motor cuando hay algo que decir.
 */

import { NOMBRE_PATRON } from './biblioteca'
import type { Patron, TipoSesion } from './tipos'

/**
 * La llave de las afirmaciones del cuerpo.
 *
 * Toda línea que diga algo de la recuperación, del volumen o del orden lleva
 * una fuente, y la fuente sale recién cuando alguien la confirma contra el
 * trabajo original. Hasta entonces va solo el dato. Prenderla es un cambio de
 * una línea, y apagada ninguna línea de este archivo afirma nada del cuerpo.
 */
export const RECUPERACION_CON_FUENTE = false

/** La hora de un instante como se dice: "9:10", "13:30". Hora local, 24 h. */
export function horaDicha(instante: number): string {
  const fecha = new Date(instante)
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`
}

/** "a las 9:10", y "a la 1:20": la una va en singular. */
function aLaHora(dicha: string): string {
  return dicha.startsWith('1:') ? `a la ${dicha}` : `a las ${dicha}`
}

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** "a", "a y b", "a, b y c". */
function enLista(cosas: readonly string[]): string {
  if (cosas.length <= 1) return cosas[0] ?? ''
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`
}

/** Los nombres de las cadenas en minúscula, en lista: "tracción, empuje y core". */
const cadenas = (patrones: readonly Patron[]) =>
  enLista(patrones.map((p) => NOMBRE_PATRON[p].toLowerCase()))

export interface CadenaLeida {
  patron: Patron
  /** Cuándo se leyó, en milisegundos. */
  hora: number
}

/**
 * Las cadenas que esta sesión no leyó porque ya se habían leído ese día.
 *
 * "Empuje ya se leyó hoy a las 9:10: esta sesión sumó volumen." Con varias a la
 * misma hora van juntas; con horas distintas, cada una con la suya y en el
 * orden en que se leyeron. La hora es lo que hace que no suene a reto: dice
 * cuándo pasó lo que cuenta, no qué está mal con esta.
 *
 * `esHoy` es si el día de la sesión es hoy. Una que arrancó a las 23:40 y
 * cierra a las 00:05 es del día de antes, y "hoy a las 9:10" ya no es cierto:
 * dice "ese día".
 */
export function lineaYaLeida(
  leidas: readonly CadenaLeida[],
  { esHoy }: { esHoy: boolean } = { esHoy: true },
): string | null {
  if (leidas.length === 0) return null

  const grupos: { hora: string; patrones: Patron[] }[] = []
  for (const { patron, hora } of [...leidas].sort((a, b) => a.hora - b.hora)) {
    if (grupos.some((g) => g.patrones.includes(patron))) continue
    const dicha = horaDicha(hora)
    const grupo = grupos.find((g) => g.hora === dicha)
    if (grupo) grupo.patrones.push(patron)
    else grupos.push({ hora: dicha, patrones: [patron] })
  }

  const [primero, ...resto] = grupos
  if (!primero) return null
  const varias = primero.patrones.length > 1
  const verbo = esHoy
    ? `${varias ? 'se leyeron' : 'se leyó'} hoy`
    : `${varias ? 'se habían leído' : 'se había leído'} ese día`
  const cierre = ': esta sesión sumó volumen.'

  if (resto.length === 0) {
    return `${conMayuscula(cadenas(primero.patrones))} ya ${verbo} ${aLaHora(primero.hora)}${cierre}`
  }

  const tramos = [
    `${conMayuscula(cadenas(primero.patrones))} ${verbo} ${aLaHora(primero.hora)}`,
    ...resto.map((g) => `${cadenas(g.patrones)} ${aLaHora(g.hora)}`),
  ]
  // Si un tramo ya trae su propia "y" ("bisagra y core a las 13:30"), los
  // tramos se separan con coma también antes de la última "y": sin eso, "a las
  // 9:10 y bisagra y core a las 13:30" se lee como tres cadenas a una hora.
  const conY = grupos.some((g) => g.patrones.length > 1)
  const unidos = conY
    ? `${tramos.slice(0, -1).join(', ')}, y ${tramos[tramos.length - 1]}`
    : enLista(tramos)
  return `${unidos}${cierre}`
}

/**
 * Una sesión sin pasos que sigan tu nivel: un día de fuelle, o lo que no traía
 * ningún eslabón de una cadena.
 *
 * Es la razón verdadera de que las cadenas no se muevan, y por eso solo sale
 * cuando es cierta. Si la sesión tenía pasos de cadena y no se hicieron, no
 * hubo nada que leer y no se dice nada del plan: nombrar lo que no se hizo es
 * exactamente lo que esta app no hace. El Reloj tampoco: nunca lee, y su final
 * no habla del motor.
 */
export function lineaSinCadenas(sesion: {
  tipo: TipoSesion
  /** Cuántos pasos seguían tu nivel, hechos o no. */
  pasosDeCadena: number
}): string | null {
  if (sesion.pasosDeCadena > 0 || sesion.tipo === 'reloj') return null
  return 'Esta sesión no tenía pasos que sigan tu nivel: tus cadenas quedan como estaban.'
}

/**
 * Los pasos de cadena que se cambiaron por otro ejercicio en la sesión: hecho
 * otro, la cadena no se lee, y se dice por qué.
 */
export function lineaCambiado(patrones: readonly Patron[]): string | null {
  const unicos = [...new Set(patrones)]
  if (unicos.length === 0) return null
  return unicos.length === 1
    ? `${conMayuscula(cadenas(unicos))} queda como estaba: hoy hiciste otro ejercicio.`
    : `${conMayuscula(cadenas(unicos))} quedan como estaban: hoy hiciste otros ejercicios.`
}

/** La versión liviana suma volumen y no lee ninguna cadena, y lo dice. */
export function lineaLiviana(liviana: boolean): string | null {
  return liviana ? 'La versión liviana suma volumen y no mueve tus cadenas.' : null
}

/**
 * Los pasos de cadena que quedaron a medias al guardar una sesión desde
 * afuera: no se leyeron, y por eso no gastaron la lectura del día.
 *
 * "se puede leer hoy" solo si la sesión es de hoy. Una de ayer que se guarda
 * a la mañana no deja nada pendiente para ese día, que ya pasó: decirlo sería
 * prometer algo que no existe.
 */
export function lineaAMedias({
  patrones,
  esHoy,
}: {
  patrones: readonly Patron[]
  /** Si la sesión es del día en que se guarda. */
  esHoy: boolean
}): string | null {
  const unicos = [...new Set(patrones)]
  if (unicos.length === 0) return null
  const varias = unicos.length > 1
  const quedo = varias ? 'quedaron a medias: no se movieron' : 'quedó a medias: no se movió'
  const despues = esHoy ? (varias ? ' y se pueden leer hoy' : ' y se puede leer hoy') : ''
  return `${conMayuscula(cadenas(unicos))} ${quedo}${despues}.`
}
