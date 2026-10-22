/**
 * Cómo se hace: el dibujo y la técnica, encima de lo que estés haciendo.
 *
 * Existe por una queja concreta y justa: la app te manda a hacer "flexiones
 * pseudo plancha" y la única explicación vive en la ficha del ejercicio, o sea
 * afuera de la sesión. Nadie sale de la sesión con el pulso a ciento cuarenta
 * para leer una ficha, y si saliera, hasta hace poco perdía la sesión.
 *
 * Por eso esto se abre ENCIMA y no navega a ningún lado: es la misma pantalla
 * con algo adelante. Se cierra y seguís exactamente donde estabas, porque nunca
 * te fuiste.
 *
 * Es la hoja completa del sistema (§5.8): a pantalla entera, en papel y en
 * seco —en el esfuerzo no entra nada deslizándose—, con el foco adentro
 * mientras está abierta, Escape para cerrarla y el foco de vuelta en el botón
 * que la abrió. Eso lo hace `Hoja`; antes era un diálogo escrito a mano que
 * dejaba el foco en la sesión de abajo.
 *
 * El orden de adentro no es casual. Primero el dibujo, que contesta "qué forma
 * tiene esto" en un segundo; después el gesto en una línea; después los pasos,
 * que son el detalle que el dibujo no puede dar —agarre, separación de manos,
 * rotación—; y al final los errores, que solo sirven cuando ya entendiste el
 * movimiento. Al revés no se lee: una lista de errores de algo que todavía no
 * sabés hacer es ruido.
 */

import type { Ejercicio } from '@/dominio/tipos'
import { POSTURAS } from '@/dominio/posturas'
import { FiguraEjercicio } from './figura'
import { AccionQuieta, Hoja, Rotulo, Simbolo } from './ui'

export function ComoSeHace({ ejercicio, alCerrar }: { ejercicio: Ejercicio; alCerrar: () => void }) {
  const figura = POSTURAS[ejercicio.id]

  return (
    <Hoja completa etiqueta={`Cómo se hace: ${ejercicio.nombre}`} onCerrar={alCerrar} className="hoja-como-se-hace">
      {(cerrar) => (
        <>
          {/* El cuerpo scrollea y el pie no: "Volver a la serie" queda a la
              vista con la técnica más larga, y nada pasa por detrás de él. */}
          <div className="hoja-cuerpo">
            <div className="mx-auto w-full max-w-lg">
              <Rotulo>CÓMO SE HACE</Rotulo>
              <h2 className="titulo-ejercicio">{ejercicio.nombre}</h2>

              {figura && (
                <>
                  {/* Quieta y con las dos posturas: esto se abre en medio del
                      esfuerzo, donde nada se mueve. La figura lo sabría sola,
                      pero acá no hay otro caso y se escribe para que se lea. */}
                  <FiguraEjercicio figura={figura} postura="ambas-quietas" className="mt-4" />
                  <p className="explicacion-esfuerzo">{figura.gesto}</p>
                </>
              )}

              <ol className="registro mt-6">
                {ejercicio.tecnica.map((paso, i) => (
                  <li key={i}>
                    <span className="canal">{i + 1}</span>
                    <span className="text-sm leading-relaxed">{paso}</span>
                    <span />
                  </li>
                ))}
              </ol>

              <Rotulo className="mt-8">LO QUE SALE MAL</Rotulo>
              <ul className="registro mt-3">
                {ejercicio.erroresComunes.map((error, i) => (
                  <li key={i}>
                    <span className="canal">
                      <Simbolo nombre="cruz" />
                    </span>
                    <span className="text-sm leading-relaxed text-[var(--color-glosa)]">{error}</span>
                    <span />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="hoja-pie">
            <div className="mx-auto w-full max-w-lg">
              <AccionQuieta onClick={cerrar}>Volver a la serie</AccionQuieta>
            </div>
          </div>
        </>
      )}
    </Hoja>
  )
}
