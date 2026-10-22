import { rotuloDeLoQueViene, textoDeLoQueViene, type LoQueViene } from '@/dominio/siguiente'

/**
 * El ejercicio completo: qué viene.
 *
 * Esta pantalla decía "ejercicio completo" y nada más, y es el instante
 * exacto en que se pierde el hilo: la transición entre ejercicios no tiene
 * descanso —`anotar` solo lo arranca si queda otra serie—, así que cambiaba
 * el título y había que leerlo. El nombre de lo que viene va acá, que es
 * donde la mirada ya está, y la acción de abajo NO cambia de etiqueta:
 * "Siguiente ejercicio" y "Terminar" los tocan tres portones por nombre.
 *
 * Sin `aria-live` y sin "Deshacer": lo que viene lo dice la región viva de
 * la sesión al anotar la última serie (una región que se monta con su texto
 * no anuncia nada), y deshacer está en el encabezado, en el mismo lugar que
 * en la serie y el descanso.
 */
export function Completo({ viene }: { viene: LoQueViene | null }) {
  return (
    <section className="ejercicio-completo">
      <p className="rotulo" data-foco>
        EJERCICIO COMPLETO
      </p>
      {viene && (
        <div className="mt-6">
          <p className="rotulo">{rotuloDeLoQueViene(viene)}</p>
          <p className="lo-que-viene" data-prueba="lo-que-viene">
            {textoDeLoQueViene(viene)}
          </p>
        </div>
      )}
    </section>
  )
}
