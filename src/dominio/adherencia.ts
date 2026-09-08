/**
 * Adherencia: lo que reemplaza a la racha.
 *
 * La racha de días consecutivos es la mecánica más copiada del mercado y una
 * de las peores para una app de fuerza, por dos razones. La primera es que acá
 * el descanso es parte del programa, así que premiar la actividad diaria es
 * premiar exactamente lo que no hay que hacer. La segunda es más de fondo: una
 * racha tiene una asimetría fea —motiva poco mientras está entera y desmotiva
 * mucho cuando se rompe—, y lo que más daño hace no es perder el número sino
 * la conclusión que la persona saca sobre sí misma.
 *
 * Lo que hay acá en su lugar:
 *
 * - **Adherencia rodante de 28 días**, que nunca vuelve a cero y siempre se
 *   puede recuperar en días.
 * - **Créditos de perdón**, para que faltar sea algo que el sistema ya tenía
 *   previsto y no una falla personal.
 * - **Sesiones de tu vida**, un contador que solo sube. Habla de quién sos, no
 *   de lo que hiciste esta semana.
 * - **Sesión de vuelta**, que le baja la vara a quien vuelve después de faltar.
 *   Bonificar el regreso funciona mucho mejor que castigar la ausencia.
 *
 * Todo se calcula desde el historial. No hay ningún contador guardado que
 * pueda quedar desincronizado con la realidad.
 */

import type { Sesion } from './tipos'

/** Días de la ventana rodante. Cuatro semanas: entra un mes de vida real. */
export const VENTANA_DIAS = 28

/** Tope de créditos de perdón acumulables. */
export const CREDITOS_MAXIMOS = 2

/** Los hitos del contador de sesiones. Nunca se pierden. */
export const HITOS = [10, 25, 50, 100, 200, 365, 500, 1000]

function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

/** Diferencia en días entre dos fechas AAAA-MM-DD. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000)
}

export interface Adherencia {
  /** Sesiones hechas dentro de la ventana. */
  hechas: number
  /** Cuántas correspondían según la meta semanal. */
  meta: number
  /** Créditos de perdón disponibles. */
  creditos: number
  /** Huecos que los créditos tapan, para que la barra no baje por faltar una vez. */
  cubiertos: number
  /** De 0 a 100, contando lo cubierto. */
  porcentaje: number
}

/**
 * La adherencia de las últimas cuatro semanas.
 *
 * Los créditos se ganan por tiempo de uso —una semana activa, un crédito, con
 * tope de dos— y se gastan solos tapando los huecos. No hay que administrarlos
 * ni se muestran como una moneda: es simplemente el margen que el sistema da
 * por descontado, porque nadie entrena cuatro semanas seguidas sin faltar y
 * una app que finja lo contrario está midiendo mal.
 */
export function adherencia(
  sesiones: Sesion[],
  hoy: string,
  metaSemanal: number,
): Adherencia {
  const meta = Math.max(1, Math.round((metaSemanal * VENTANA_DIAS) / 7))

  const dentro = sesiones.filter((s) => {
    const dias = diasEntre(s.fecha, hoy)
    return dias >= 0 && dias < VENTANA_DIAS
  })
  const hechas = new Set(dentro.map((s) => s.fecha)).size

  const semanasActivas = semanasDeUso(sesiones, hoy)
  const creditos = Math.min(CREDITOS_MAXIMOS, Math.floor(semanasActivas))
  const cubiertos = Math.min(creditos, Math.max(0, meta - hechas))

  return {
    hechas,
    meta,
    creditos,
    cubiertos,
    porcentaje: Math.min(100, Math.round(((hechas + cubiertos) / meta) * 100)),
  }
}

/** Cuántas semanas hace que la persona viene usando la app. */
export function semanasDeUso(sesiones: Sesion[], hoy: string): number {
  if (sesiones.length === 0) return 0
  const primera = sesiones.reduce((min, s) => (s.fecha < min ? s.fecha : min), sesiones[0]!.fecha)
  return Math.max(0, diasEntre(primera, hoy) / 7)
}

/** El contador que solo sube. Es el que habla de identidad. */
export function sesionesDeVida(sesiones: Sesion[]): number {
  return sesiones.length
}

/** El próximo hito, y cuánto falta. Devuelve null cuando ya se pasaron todos. */
export function proximoHito(total: number): { hito: number; faltan: number } | null {
  const hito = HITOS.find((h) => h > total)
  return hito === undefined ? null : { hito, faltan: hito - total }
}

/** True si este número de sesión es exactamente un hito. */
export function esHito(total: number): boolean {
  return HITOS.includes(total)
}

/**
 * Cada cuántos días entrena esta persona, según lo que viene haciendo y no
 * según lo que dijo que iba a hacer. Mediana de los últimos diez intervalos.
 */
export function intervaloHabitual(sesiones: Sesion[]): number | null {
  const dias = [...new Set(sesiones.map((s) => s.fecha))].sort().reverse().slice(0, 11)
  if (dias.length < 3) return null

  const intervalos: number[] = []
  for (let i = 1; i < dias.length; i++) {
    intervalos.push(diasEntre(dias[i]!, dias[i - 1]!))
  }
  intervalos.sort((a, b) => a - b)
  const medio = Math.floor(intervalos.length / 2)
  return intervalos.length % 2 === 1
    ? intervalos[medio]!
    : ((intervalos[medio - 1] ?? 0) + (intervalos[medio] ?? 0)) / 2
}

/**
 * El hueco más largo que esta persona hace de forma NORMAL.
 *
 * No es la mediana: es el percentil alto. La diferencia decide si el fin de
 * semana cuenta como una ausencia, y con la rutina por defecto la mediana da
 * la respuesta equivocada — lunes, miércoles y viernes tiene huecos de 2, 2 y
 * 3 días, mediana 2, así que el hueco del fin de semana parecía una falta.
 *
 * El percentil se eligió midiendo las tres rutinas de la app, no a ojo. Tiene
 * que quedar por encima del hueco largo de cada una y por debajo de una
 * ausencia de verdad:
 *
 *     L-M-V        intervalos 2,2,3…   p50→3,0   p85→4,5   p90→4,5
 *     Ma-V         intervalos 3,4…     p50→6,0   p85→6,0   p90→6,0
 *     L-Ma-J-V     intervalos 1,2,1,3… p50→3,0   p85→4,5   p90→4,5
 *     L-M-V con una semana entera sin entrenar   p85→4,5   p90→15,0
 *
 * La mediana deja afuera el hueco del fin de semana en dos de las tres. El
 * percentil 90 se traga la ausencia real y deja de detectar vueltas durante
 * dos semanas. El 85 es el único que acierta en las cuatro filas.
 */
export const PERCENTIL_DEL_HUECO = 0.85

function huecoNormal(intervalos: number[]): number {
  const ordenados = [...intervalos].sort((a, b) => a - b)
  const i = Math.min(ordenados.length - 1, Math.floor(ordenados.length * PERCENTIL_DEL_HUECO))
  return ordenados[i] ?? 0
}

/**
 * ¿Esta sesión es una vuelta después de faltar?
 *
 * El umbral es relativo al hábito de cada uno: faltar cuatro días es una
 * eternidad para quien entrena cinco veces por semana y es normal para quien
 * entrena dos.
 *
 * Y se compara contra el hueco más largo que la persona hace normalmente, no
 * contra su mediana. Medido contra la mediana, la rutina por defecto —lunes,
 * miércoles y viernes— daba "vuelta" TODOS los lunes: mediana 2, umbral 3, y
 * el hueco del fin de semana es exactamente 3. Eso recortaba el objetivo al
 * 70% un día de cada tres y, peor, dejaba de mover la progresión ese día. Un
 * tercio de las sesiones de alguien impecable no contaba para nada.
 */
export function esVuelta(sesiones: Sesion[], hoy: string): boolean {
  const ultima = sesiones.reduce<string | null>(
    (max, s) => (max === null || s.fecha > max ? s.fecha : max),
    null,
  )
  if (ultima === null) return false

  const dias = [...new Set(sesiones.map((s) => s.fecha))].sort().reverse().slice(0, 11)
  if (dias.length < 3) return false

  const intervalos: number[] = []
  for (let i = 1; i < dias.length; i++) intervalos.push(diasEntre(dias[i]!, dias[i - 1]!))

  return diasEntre(ultima, hoy) >= 1.5 * huecoNormal(intervalos)
}

/** Cuánto se recorta el objetivo en una sesión de vuelta. */
export const RECORTE_DE_VUELTA = 0.7

/**
 * Qué tan consistente es el horario de entrenamiento, de 0 a 1.
 *
 * Se calcula sobre la hora de inicio de las últimas diez sesiones, con
 * estadística circular: las 23 y la 1 están a dos horas de distancia, no a
 * veintidós.
 *
 * Nunca se muestra como puntaje. Sería una segunda métrica que se puede
 * reprobar, y además la evidencia dice que la rigidez horaria no ayuda: lo que
 * automatiza una conducta es que la señal sea estable, no que el reloj lo sea.
 * Sirve para dos cosas: elegir a qué hora recordar, y poder decir una sola
 * frase cuando el patrón ya es claro.
 */
export function consistenciaHoraria(sesiones: Sesion[]): number | null {
  const ultimas = [...sesiones]
    .sort((a, b) => b.finalizadaEn - a.finalizadaEn)
    .slice(0, 10)
  if (ultimas.length < 5) return null

  const angulos = ultimas.map((s) => {
    const fecha = new Date(s.finalizadaEn)
    const hora = fecha.getHours() + fecha.getMinutes() / 60
    return (hora * 2 * Math.PI) / 24
  })

  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const c = media(angulos.map(Math.cos))
  const sn = media(angulos.map(Math.sin))
  const r = Math.sqrt(c * c + sn * sn)
  if (r <= 0 || r >= 1) return r >= 1 ? 1 : 0

  const desvioHoras = (Math.sqrt(-2 * Math.log(r)) * 24) / (2 * Math.PI)
  return Math.min(1, Math.max(0, 1 - desvioHoras / 6))
}

/** La hora típica de entrenamiento, para el recordatorio. */
export function horaHabitual(sesiones: Sesion[]): number | null {
  const ultimas = [...sesiones]
    .sort((a, b) => b.finalizadaEn - a.finalizadaEn)
    .slice(0, 10)
  if (ultimas.length < 5) return null

  const angulos = ultimas.map((s) => {
    const fecha = new Date(s.finalizadaEn)
    return ((fecha.getHours() + fecha.getMinutes() / 60) * 2 * Math.PI) / 24
  })
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const angulo = Math.atan2(media(angulos.map(Math.sin)), media(angulos.map(Math.cos)))
  const horas = ((angulo * 24) / (2 * Math.PI) + 24) % 24
  return Math.round(horas * 2) / 2
}

export interface ResumenSemanal {
  /** Lunes de la semana, AAAA-MM-DD. */
  semana: string
  sesiones: number
  minutos: number
  /** Series completadas. */
  series: number
  /** Sesiones en las que se cumplió el objetivo propuesto. */
  cumplidas: number
}

/** El lunes de la semana a la que pertenece una fecha, en hora local. */
export function lunesDe(fechaISO: string): string {
  const fecha = aFecha(fechaISO)
  const dia = fecha.getDay()
  fecha.setDate(fecha.getDate() - (dia === 0 ? 6 : dia - 1))
  const dd = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${dd(fecha.getMonth() + 1)}-${dd(fecha.getDate())}`
}
