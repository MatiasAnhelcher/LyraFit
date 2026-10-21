import { useEffect, useRef, useState } from 'react'
import { Arco } from '@/componentes/arco'
import { AccionQuieta, Rotulo } from '@/componentes/ui'
import { useTemporizador } from '@/hooks/useTemporizador'
import { sonar, tocar } from '@/respuesta'
import type { PasoDeFuelle } from '@/dominio/metabolico'
import type { RegistroRafaga } from '@/dominio/tipos'

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
  const quedan = pasos.length - indice

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-3">
        <Rotulo>EL FUELLE · {quedan === 1 ? 'LA ÚLTIMA' : `QUEDAN ${quedan}`}</Rotulo>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center pb-8">
        <Rotulo>{pausando ? 'AFLOJÁ' : 'AHORA'}</Rotulo>
        <div className="mt-3">
          <Arco restante={reloj.restante} total={total} />
        </div>
        <p className="mt-6 text-center text-lg font-semibold" data-prueba="nombre-rafaga">
          {paso.rafaga.nombre}
        </p>
        {!pausando && (
          <p className="mt-2 max-w-[32ch] text-center text-sm leading-relaxed text-[var(--color-glosa)]">
            {paso.rafaga.gesto}
          </p>
        )}
      </section>

      <div className="mt-auto">
        <AccionQuieta onClick={onSaltear}>Cortar el fuelle</AccionQuieta>
      </div>
    </div>
  )
}
