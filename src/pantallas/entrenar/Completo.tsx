import { Rotulo } from '@/componentes/ui'
import { rotuloDeLoQueViene, textoDeLoQueViene, type LoQueViene } from '@/dominio/siguiente'

/** El ejercicio completo: qué viene, y la salida por si la última serie se anotó mal. */
export function Completo({
  viene,
  onDeshacer,
}: {
  /** Lo que viene después, o null si es el último y no queda nada. */
  viene: LoQueViene | null
  onDeshacer: () => void
}) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center">
      <Rotulo>EJERCICIO COMPLETO</Rotulo>
      {/* Acá está el agujero que se tapa.
          Esta pantalla decía "ejercicio completo" y nada más, y es el
          instante exacto en que se pierde el hilo: la transición entre
          ejercicios no tiene descanso —`anotar` solo lo arranca si queda
          otra serie— así que cambiaba el título y había que leerlo.

          `aria-live` es gratis y es la respuesta honesta al "sin mirar"
          para quien ya usa lector de pantalla: lo escucha con su voz, su
          idioma y su volumen. Cambia una vez por ejercicio, así que no es
          ruido — sobre el reloj sería un desastre, y por eso no va ahí.

          El botón de abajo NO cambia de etiqueta: "Siguiente ejercicio" y
          "Terminar" los clickean tres portones por nombre. El nombre de
          lo que viene va acá, que además es donde la mirada ya está. */}
      {viene && (
        <div className="mt-6" aria-live="polite">
          <Rotulo>{rotuloDeLoQueViene(viene)}</Rotulo>
          <p
            className="mt-1 max-w-[20ch] text-lg font-semibold leading-tight"
            data-prueba="lo-que-viene"
          >
            {textoDeLoQueViene(viene)}
          </p>
        </div>
      )}
      <button onClick={onDeshacer} className="mt-6 text-sm text-[var(--color-glosa)] underline underline-offset-4">
        Deshacer la última serie
      </button>
    </section>
  )
}
