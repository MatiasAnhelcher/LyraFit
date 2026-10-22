import { useEffect, useRef, useState } from 'react'
import { Arco } from '@/componentes/arco'
import { AccionQuieta } from '@/componentes/ui'
import { useTemporizador } from '@/hooks/useTemporizador'
import { sonar, tocar } from '@/respuesta'
import type { PasoDeFuelle } from '@/dominio/metabolico'
import type { RegistroRafaga } from '@/dominio/tipos'
import { tramoDelFuelle } from './tramoDelFuelle'

/**
 * El bloque de fuelle: lo metabólico, al final de la fuerza.
 *
 * Va acá y no entre medio de las series porque es lo único que puede ser
 * exigente sin costarle nada al motor: cuando arranca, ya no queda ninguna
 * serie que medir. Y va ANTES de la serie de cierre, no después, para que la
 * sesión termine igual que terminaba: en algo que se puede sostener.
 *
 * Cada ráfaga se avisa apenas termina, en vez de entregar la lista al final.
 * Es a propósito: si el navegador recicla la pestaña a mitad del bloque, lo que
 * ya se hizo está en el borrador y no se pierde.
 *
 * La pantalla es la del esfuerzo sin series (§7.4.3): el rótulo arriba, la
 * palabra, el arco, el nombre y el gesto en un bloque al centro, y "Cortar el
 * fuelle" en la fila de abajo. En AFLOJÁ el nombre ya es el de la ráfaga que
 * viene (`tramoDelFuelle`), y el gesto no se dibuja pero su lugar queda
 * reservado, así que el arco y el nombre no saltan en cada cambio de tramo:
 * veinte cambios por bloque serían veinte saltos.
 */
export function BloqueDeFuelle({
  pasos,
  onRafaga,
  onListo,
  onSaltear,
}: {
  pasos: PasoDeFuelle[]
  onRafaga: (hecha: RegistroRafaga) => void
  onListo: () => void
  onSaltear: () => void
}) {
  const [indice, setIndice] = useState(0)
  /** Si está en la pausa que sigue a la ráfaga, en vez de en la ráfaga. */
  const [pausando, setPausando] = useState(false)
  const paso = pasos[indice]

  const reloj = useTemporizador(() => {
    const actual = pasos[indice]
    if (!actual) return
    if (!pausando) {
      onRafaga({ rafagaId: actual.rafaga.id, segundos: actual.segundos, despuesDe: null })
      tocar('serie')
      if (actual.descansoSegundos > 0) {
        setPausando(true)
        return
      }
    }
    setPausando(false)
    setIndice((n) => n + 1)
  })

  const { arrancar } = reloj
  useEffect(() => {
    const actual = pasos[indice]
    if (!actual) return
    arrancar(pausando ? actual.descansoSegundos : actual.segundos)
  }, [indice, pausando, pasos, arrancar])

  const terminado = useRef(false)
  useEffect(() => {
    if (indice < pasos.length || terminado.current) return
    terminado.current = true
    sonar('descanso')
    onListo()
  }, [indice, pasos.length, onListo])

  if (!paso) return null

  const total = pausando ? paso.descansoSegundos : paso.segundos
  const { rotulo, rafaga = paso.rafaga } = tramoDelFuelle(pasos, indice, pausando)

  return (
    <div className="pantalla-esfuerzo armazon-esfuerzo">
      <header className="encabezado-fuelle">
        <p className="rotulo">{rotulo}</p>
      </header>

      <main>
        <div className="bloque-fuelle">
          {/* Sigue siendo un rótulo —los portones la leen entre los
              `.rotulo`— pero al tamaño de una palabra que se lee de lejos. */}
          <p className="rotulo palabra-tramo" data-foco>
            {pausando ? 'AFLOJÁ' : 'AHORA'}
          </p>
          <Arco
            restante={reloj.restante}
            total={total}
            lado="ancho"
            etiqueta={pausando ? 'Pausa del fuelle' : 'Ráfaga del fuelle'}
            apagado={pausando}
          />
          <p className="nombre-rafaga" data-prueba="nombre-rafaga">
            {rafaga.nombre}
          </p>
          <p className="gesto-rafaga" data-reservado={pausando || undefined}>
            {rafaga.gesto}
          </p>
        </div>
      </main>

      <div className="pie-quieto">
        <AccionQuieta onClick={onSaltear}>Cortar el fuelle</AccionQuieta>
      </div>
    </div>
  )
}
