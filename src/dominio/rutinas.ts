/**
 * Rutinas: qué patrones se trabajan cada día.
 *
 * La rutina define el molde; el motor de progresión define la carga. Por eso
 * una rutina no menciona ningún ejercicio puntual: dice "hoy toca empuje" y el
 * ejercicio exacto sale del avance que tengas en esa cadena.
 */

import type { Rutina } from './tipos'

export const RUTINAS: Rutina[] = [
  {
    id: 'cuerpo-completo',
    nombre: 'Cuerpo completo',
    descripcion:
      'Tres días por semana, los cuatro patrones en cada sesión. Es la mejor opción para arrancar y la que más cuesta abandonar: si perdés un día, el resto de la semana lo compensa.',
    dias: [1, 3, 5],
    bloques: [
      { patron: 'traccion', nota: 'Primero lo que más cuesta, con el cuerpo entero.' },
      { patron: 'empuje' },
      { patron: 'piernas' },
      { patron: 'core', nota: 'Al final: si lo hacés antes, te sabotea el resto.' },
    ],
  },
  {
    id: 'empuje-traccion',
    nombre: 'Empuje y tracción',
    descripcion:
      'Cuatro días alternando la mitad de arriba del cuerpo. Más volumen por patrón y más descanso entre sesiones parecidas.',
    dias: [1, 2, 4, 5],
    bloques: [
      { patron: 'empuje' },
      { patron: 'traccion' },
      { patron: 'core' },
    ],
  },
  {
    id: 'densa-cinco',
    nombre: 'Densa, cinco días',
    descripcion:
      'Tres días de fuerza con el fuelle metido en los descansos y dos días de acondicionamiento en el medio. Es la forma de entrenar cinco días sin quedarse sin recuperación: los días de fuelle no le piden fuerza a ninguna cadena, así que el motor no los lee.',
    dias: [1, 2, 3, 4, 5],
    diasDeFuelle: [2, 4],
    bloques: [
      { patron: 'traccion', nota: 'Primero lo que más cuesta, con el cuerpo entero.' },
      { patron: 'empuje' },
      { patron: 'piernas' },
      { patron: 'core', nota: 'Al final: si lo hacés antes, te sabotea el resto.' },
    ],
  },
  {
    id: 'minima',
    nombre: 'La mínima',
    descripcion:
      'Dos días, dos patrones. Para las semanas complicadas. Menos que esto ya no sostiene el progreso, pero sostiene el hábito, que es lo que importa cuando el trabajo aprieta.',
    dias: [2, 5],
    bloques: [{ patron: 'traccion' }, { patron: 'empuje' }],
  },
]

export const RUTINA_POR_ID = new Map(RUTINAS.map((r) => [r.id, r]))

export const RUTINA_POR_DEFECTO = 'cuerpo-completo'

export const NOMBRE_DIA: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
}

export const DIA_CORTO: Record<number, string> = {
  1: 'L',
  2: 'M',
  3: 'M',
  4: 'J',
  5: 'V',
  6: 'S',
  7: 'D',
}

/** Día de la semana en formato 1–7 (lunes a domingo), no el 0–6 de JavaScript. */
export function diaDeLaSemana(fecha: Date): number {
  const dia = fecha.getDay()
  return dia === 0 ? 7 : dia
}

export function tocaEntrenar(rutina: Rutina, fecha: Date): boolean {
  return rutina.dias.includes(diaDeLaSemana(fecha))
}

/** Qué clase de día es hoy en esta rutina. */
export type ClaseDeDia = 'fuerza' | 'fuelle' | 'descanso'

/**
 * Fuerza, fuelle o descanso.
 *
 * Existe para que las pantallas no tengan que cruzar `dias` con `diasDeFuelle`
 * cada una por su cuenta: son dos listas y cruzarlas mal —un día de fuelle que
 * no está en `dias`— daría un día que la app anuncia y no sabe abrir. Acá el
 * cruce se hace una vez y hay un test que comprueba que ninguna rutina declare
 * un día de fuelle fuera de sus días.
 */
export function claseDeDia(rutina: Rutina, fecha: Date): ClaseDeDia {
  const dia = diaDeLaSemana(fecha)
  if (!rutina.dias.includes(dia)) return 'descanso'
  return rutina.diasDeFuelle?.includes(dia) ? 'fuelle' : 'fuerza'
}

/** El próximo día de entrenamiento a partir de una fecha, sin contarla. */
export function proximoDia(rutina: Rutina, desde: Date): Date | null {
  if (rutina.dias.length === 0) return null

  for (let salto = 1; salto <= 7; salto++) {
    const candidato = new Date(desde)
    candidato.setDate(candidato.getDate() + salto)
    if (tocaEntrenar(rutina, candidato)) return candidato
  }
  return null
}
