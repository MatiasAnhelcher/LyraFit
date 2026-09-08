/**
 * Las posturas de cada ejercicio.
 *
 * Catorce números y una línea de texto por ejercicio. La convención está en
 * `figuras.ts` y conviene tenerla presente para leer esto: los ángulos son
 * absolutos y en grados, **0 apunta a la derecha y 90 hacia arriba**, y la
 * persona siempre mira a la derecha.
 *
 * Dos cosas que se aprenden dibujando y ahorran horas:
 *
 * - **El cuerpo tumbado no es horizontal.** En una plancha los hombros quedan a
 *   la altura del brazo sobre el piso y los tobillos casi tocándolo, así que la
 *   línea del cuerpo está inclinada unos veinte grados. Dibujarla en cero deja
 *   los pies flotando y se nota enseguida.
 * - **La cadera va detrás del tobillo en cualquier sentadilla.** Como la
 *   persona mira a la derecha, "atrás" es la izquierda: el tobillo termina con
 *   una x mayor que la cadera.
 */

import type { Figura } from './figuras'

/**
 * La inclinación de un cuerpo sostenido por los brazos.
 *
 * Sale de la geometría, no del ojo: con los hombros a la altura de un brazo
 * estirado sobre el piso y los tobillos a la altura de un pie, la línea que une
 * hombro y tobillo queda a unos veinte grados. Está acá con nombre porque se
 * repite en las once flexiones y en las dos planchas, y porque cuando algo se
 * repite once veces conviene que se pueda cambiar en un solo lugar.
 */
const TUMBADO = 19
/** El mismo cuerpo, mirando en la dirección contraria: hacia los pies. */
const HACIA_LOS_PIES = 180 + TUMBADO

export const POSTURAS: Record<string, Figura> = {
  // ─── Empuje ────────────────────────────────────────────────────────────
  'flexion-completa': {
    escena: 'piso',
    apoyo: 'manos',
    gesto: 'El cuerpo baja entero, en una sola línea, doblando los codos hacia atrás.',
    inicio: {
      torso: TUMBADO,
      cuello: TUMBADO,
      brazo: -90,
      antebrazo: -90,
      muslo: HACIA_LOS_PIES,
      pantorrilla: HACIA_LOS_PIES,
      pie: -78,
    },
    fin: {
      // Abajo el cuerpo queda MÁS horizontal, no igual. El hombro baja ocho
      // unidades y los pies no se mueven, así que la línea del cuerpo se
      // acuesta: dibujarla con la misma inclinación que arriba hunde los pies
      // debajo del piso, que es exactamente lo que pasaba.
      torso: 11,
      cuello: 11,
      // El hombro se adelanta sobre la mano: el brazo apunta hacia adelante y
      // el antebrazo vuelve hacia atrás, que es el codo pegado al cuerpo del
      // que habla la técnica.
      brazo: -28,
      antebrazo: -128,
      muslo: 180 + 11,
      pantorrilla: 180 + 11,
      pie: -60,
    },
  },

  // ─── Tracción ──────────────────────────────────────────────────────────
  'dominada-completa': {
    escena: 'barra',
    apoyo: 'colgado',
    gesto: 'El cuerpo sube entero hasta que la pera pasa la barra. Las manos no se mueven.',
    inicio: {
      torso: 90,
      cuello: 90,
      // El brazo va un pelo adelante del torso a propósito. Geométricamente
      // colgado queda casi encima, pero dibujado encima se lee como una sola
      // línea vertical y no como alguien colgando de las manos.
      brazo: 84,
      antebrazo: 96,
      muslo: -92,
      pantorrilla: -88,
      pie: -70,
    },
    fin: {
      torso: 90,
      cuello: 90,
      // Arriba el codo queda abajo y adelante del hombro, y el antebrazo
      // vuelve hacia la barra, que no se movió de lugar.
      brazo: -58,
      antebrazo: 128,
      muslo: -95,
      pantorrilla: -80,
      pie: -70,
    },
  },

  // ─── Piernas ───────────────────────────────────────────────────────────
  'sentadilla-completa': {
    escena: 'piso',
    apoyo: 'pies',
    gesto: 'La cadera va atrás y abajo hasta que el muslo queda paralelo al piso.',
    inicio: {
      torso: 90,
      cuello: 90,
      brazo: -84,
      antebrazo: -84,
      muslo: -90,
      pantorrilla: -90,
      pie: 0,
    },
    fin: {
      // El tronco se inclina adelante para compensar la cadera que fue atrás.
      torso: 62,
      cuello: 72,
      // Los brazos se estiran al frente: es lo que hace la gente sola, y ayuda.
      brazo: 6,
      antebrazo: 6,
      // El muslo casi horizontal y la tibia inclinada: la cadera termina
      // detrás del tobillo, que es lo que distingue una sentadilla de una
      // flexión de rodillas parada.
      muslo: -12,
      pantorrilla: -118,
      pie: 0,
    },
  },

  // ─── Core ──────────────────────────────────────────────────────────────
  plancha: {
    escena: 'piso',
    apoyo: 'antebrazos',
    gesto: 'No hay recorrido: la línea de talones a cabeza se sostiene sin que la cadera se hunda.',
    inicio: {
      torso: 14,
      cuello: 14,
      // Sobre los antebrazos: el brazo baja del hombro y el antebrazo apoya
      // hacia adelante, casi horizontal.
      brazo: -96,
      antebrazo: -4,
      muslo: 180 + 14,
      pantorrilla: 180 + 14,
      pie: -74,
    },
    // Un isométrico no se mueve, y dibujarlo moviéndose sería mentir. Lo que
    // se muestra es el error que arruina el ejercicio: la cadera que se hunde.
    fin: {
      torso: 24,
      cuello: 20,
      brazo: -96,
      antebrazo: -4,
      muslo: 180 + 6,
      pantorrilla: 180 + 6,
      pie: -74,
    },
  },
}
