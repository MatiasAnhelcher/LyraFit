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
 */

import { comoReloj } from '@/hooks/useTemporizador'

export function Arco({ restante, total }: { restante: number; total: number }) {
  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle className="arco-descanso-fondo" cx="50" cy="50" r="46" />
        <circle
          className="arco-descanso"
          cx="50"
          cy="50"
          r="46"
          pathLength={1}
          style={{ ['--resto' as string]: String(Math.max(0, restante / Math.max(total, 1))) }}
        />
      </svg>
      <p className="cifra text-5xl">{comoReloj(restante)}</p>
    </div>
  )
}
