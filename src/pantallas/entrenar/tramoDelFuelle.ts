import type { PasoDeFuelle } from '@/dominio/metabolico'

/**
 * Lo que dice la pantalla del fuelle en cada tramo: el rótulo de arriba y la
 * ráfaga que se nombra en el centro.
 *
 * En AHORA es la ráfaga en curso, y cuenta. En AFLOJÁ la recién hecha ya
 * quedó atrás —está anotada—, así que no cuenta y la que se nombra es la que
 * viene: antes de la última, la pausa decía "QUEDAN 2" con una sola por
 * hacer, y debajo el nombre de una que ya estaba hecha. Así el rótulo y el
 * nombre cambian al terminar la ráfaga, y la pausa ya muestra lo que sigue.
 *
 * La última ráfaga no tiene pausa (`bloqueDeFuelle`), así que en AFLOJÁ
 * siempre hay una siguiente.
 */
export function tramoDelFuelle(pasos: readonly PasoDeFuelle[], indice: number, pausando: boolean) {
  const quedan = pasos.length - indice - (pausando ? 1 : 0)
  return {
    rotulo: `EL FUELLE · ${quedan === 1 ? 'LA ÚLTIMA' : `QUEDAN ${quedan}`}`,
    rafaga: ((pausando ? pasos[indice + 1] : undefined) ?? pasos[indice])?.rafaga,
  }
}
