/**
 * El arco que se vacía.
 *
 * Es la animación 5 del sistema visual y la única que representa tiempo real,
 * por eso es lineal: si acelerara, mentiría.
 *
 * Vivía adentro de `Entrenar.tsx` con un comentario que avisaba del riesgo
 * —"duplicar el SVG habría sido la forma más fácil de que una de las dos
 * dejara de ser lineal sin que nadie se diera cuenta"— y cuando apareció una
 * tercera pantalla que lo necesita, el reloj, se mudó acá. **No es una
 * animación nueva: es la misma, y ahora hay un solo lugar donde puede dejar de
 * serlo.**
 *
 * El trazo se mide en píxeles y no en unidades del dibujo: el círculo no lleva
 * `viewBox` y su radio es un porcentaje del lado (§5.8: 2 px la pista y 4 lo
 * que queda). Con un `viewBox` el trazo crecía con el arco —uno de 204 px
 * tenía casi el doble de grosor que uno de 119—, y `vector-effect:
 * non-scaling-stroke`, que es lo que existe para eso, desarma la cuenta del
 * `pathLength` en Chromium: medido, el tramo dibujado dejaba de ser lo que
 * falta.
 */

import { comoReloj } from '@/hooks/useTemporizador'

export function Arco({
  restante,
  total,
  lado = 'fijo',
  etiqueta,
  conTotal = false,
  apagado = false,
  avisa = true,
}: {
  restante: number
  total: number
  /**
   * De dónde sale el lado. Con `container-type: size` el contenido no le da
   * alto a la caja, así que el lado siempre se dice:
   * - `fila`: el alto de la fila flexible del descanso, hasta 12rem (§7.4.1);
   * - `ancho`: el ancho disponible, hasta 12rem (el fuelle);
   * - `fijo`: 176 px, el `h-44` que el reloj tuvo siempre, hasta que P7 le
   *   dé los suyos (§5.8: `min(100%, 12rem)` en PREPARATE y 160 px en AHORA,
   *   AFLOJÁ y EMOM).
   */
  lado?: 'fila' | 'ancho' | 'fijo'
  /**
   * El nombre del temporizador para un lector. Con nombre, la caja es un
   * `role="timer"`, que no se anuncia solo cada segundo: quien quiera saber
   * cuánto falta, lo pregunta.
   */
  etiqueta?: string
  /** "de 2:00" debajo de la cifra: el total contra el que mide el arco, con lo sumado. */
  conTotal?: boolean
  /** El trazo en glosa: el AFLOJÁ del fuelle. No es la única señal: cambia la palabra. */
  apagado?: boolean
  /**
   * Los últimos tres segundos en menta (§5.8). El color va junto con el
   * earcon `aviso` y la vibración `antes`, que los dispara quien lleva el
   * reloj: `false` para un reloj que no los dispara, así el color no llega
   * solo. Le gana al glosa de `apagado`.
   */
  avisa?: boolean
}) {
  const ultimos = avisa && restante > 0 && restante <= 3
  // El trazo se mueve siempre con su segundo lineal, también cuando sube con
  // "+30 s" o con un tramo nuevo: crece de vuelta, y ese movimiento es
  // información (§5.8). Nunca pasa del círculo entero, porque mide contra el
  // total con lo sumado.
  const resto = Math.min(1, Math.max(0, restante / Math.max(total, 1)))

  return (
    <div
      className="arco"
      data-lado={lado}
      data-ultimos={ultimos}
      data-apagado={apagado || undefined}
      role={etiqueta ? 'timer' : undefined}
      aria-label={etiqueta}
    >
      <svg aria-hidden="true" focusable="false">
        <circle className="arco-descanso-fondo" />
        <circle
          className="arco-descanso"
          pathLength={1}
          style={{ ['--resto' as string]: String(resto) }}
        />
      </svg>
      <p className="arco-cifra" data-prueba="reloj">
        {comoReloj(restante)}
      </p>
      {conTotal && <p className="arco-total">de {comoReloj(total)}</p>}
    </div>
  )
}
