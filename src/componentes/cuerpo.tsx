/**
 * El cuerpo, de frente y de espalda, con los músculos pintados por cuánto
 * trabajan.
 *
 * ## Por qué dibujado y no una imagen
 *
 * La pregunta era por qué no importamos "una de las millones de imágenes lindas
 * que hay en internet", y hay dos respuestas. La primera es legal: esta app se
 * publica, así que una ilustración encontrada en una búsqueda sería obra ajena
 * distribuida sin licencia. La segunda es mejor: una imagen de banco muestra
 * "los músculos del pecho" en general, y esto muestra **este ejercicio** —
 * cuánto carga cada uno de los dieciocho músculos, con el dato que la app ya
 * tiene en `APORTE`. Eso no se compra.
 *
 * ## Las tres intensidades, que son las tres del dominio
 *
 * No hay una escala nueva: son exactamente `Aporte`, los mismos 1 · 0,5 · 0,25
 * que usa `musculos.ts`. Primario lleno, secundario a media tinta,
 * estabilizador apenas insinuado, y lo que no trabaja queda como el resto del
 * cuerpo. Es la misma regla que el resto del sistema: **lo que falta no está
 * prohibido, está sin iluminar.**
 *
 * Y no hay color nuevo. La silueta usa la regla y el relleno usa la tinta a
 * tres opacidades, que es lo que ya hace el resto de la interfaz. Los cinco
 * colores de gráfico quedan para los gráficos.
 *
 * ## Cómo está dibujado
 *
 * Media persona, y la otra mitad es un espejo. Los músculos son simétricos, así
 * que dibujar los dos lados sería escribir dos veces el mismo path con la
 * garantía de que algún día uno de los dos se corrija y el otro no. El eje está
 * en x = 50 y el espejo es un `scale(-1, 1)` alrededor de ahí.
 *
 * Los que no son simétricos —ninguno por ahora— tendrían que salir del grupo
 * espejado.
 */

import { useId } from 'react'
import type { Aporte, Musculo } from '@/dominio/musculos'
import { ALTO, ANCHO, ESPALDA, FRENTE, SILUETA, TINTA } from '@/dominio/anatomia'

export function Cuerpo({
  vector,
  vista,
  className = '',
}: {
  vector: Partial<Record<Musculo, Aporte>>
  vista: 'frente' | 'espalda'
  className?: string
}) {
  const musculos = vista === 'frente' ? FRENTE : ESPALDA
  /* El recorte que mata la costura del espejo. La silueta se dibuja un poco
     pasada del eje y acá se le corta lo que sobra, así el contorno nunca
     dibuja una línea por el medio de la cabeza. */
  const recorte = useId()

  const mitad = (
    <g>
      {/* La silueta primero, para que los músculos caigan encima. */}
      <path d={SILUETA} className="cuerpo-silueta" />
      {(Object.entries(musculos) as [Musculo, string][]).map(([musculo, d]) => {
        const aporte = vector[musculo]
        if (!aporte) return null
        return (
          <path
            key={musculo}
            d={d}
            className="cuerpo-musculo"
            style={{ opacity: TINTA[aporte] }}
          />
        )
      })}
    </g>
  )

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className={className}
      role="img"
      aria-label={vista === 'frente' ? 'Músculos trabajados, de frente' : 'Músculos trabajados, de espalda'}
    >
      <defs>
        <clipPath id={recorte}>
          <rect x={ANCHO / 2} y={0} width={ANCHO / 2} height={ALTO} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${recorte})`}>{mitad}</g>
      {/* El espejo. Un solo dibujo para los dos lados: ver el comentario de arriba. */}
      <g transform={`translate(${ANCHO}, 0) scale(-1, 1)`}>
        <g clipPath={`url(#${recorte})`}>{mitad}</g>
      </g>
    </svg>
  )
}

/**
 * Las dos vistas juntas, que es como se mira de verdad.
 *
 * Una sola vista siempre miente por omisión: de frente no se ve el dorsal y de
 * espalda no se ve el pectoral, así que una dominada de frente parece que no
 * entrena nada.
 */
export function CuerpoDoble({
  vector,
  className = '',
}: {
  vector: Partial<Record<Musculo, Aporte>>
  className?: string
}) {
  return (
    <div className={`flex items-end justify-center gap-2 ${className}`}>
      <Cuerpo vector={vector} vista="frente" className="h-full w-full max-w-[7rem]" />
      <Cuerpo vector={vector} vista="espalda" className="h-full w-full max-w-[7rem]" />
    </div>
  )
}
