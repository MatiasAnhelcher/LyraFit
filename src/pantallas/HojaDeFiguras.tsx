import { POSTURAS } from '@/dominio/posturas'
import { CADENAS, POR_ID } from '@/dominio/biblioteca'
import { FiguraEjercicio } from '@/componentes/figura'

/**
 * La hoja de contacto: los treinta y nueve dibujos juntos.
 *
 * Existe porque revisar figuras de a una no sirve. Lo que hay que juzgar en una
 * cadena no es si un dibujo está bien solo, sino si la serie entera se lee como
 * un continuo: de la flexión en la pared a la de una mano el cuerpo tiene que
 * ir acostándose de a poco, y un eslabón fuera de esa progresión salta a la
 * vista acá y es invisible mirándolo aislado.
 *
 * Solo existe en desarrollo. No es una pantalla del producto —nadie entra a la
 * app a ver los treinta y nueve dibujos en una grilla— y ocupar bytes del
 * paquete que se descarga en un teléfono para una herramienta de taller sería
 * cobrarle al usuario mi comodidad.
 */
export function HojaDeFiguras() {
  return (
    <div className="p-3">
      {CADENAS.map((cadena) => (
        <section key={cadena.patron} className="mb-4">
          <p className="rotulo mb-1">{cadena.patron.toUpperCase()}</p>
          <div className="grid grid-cols-4 gap-1">
            {cadena.ejercicios.map((id) => {
              const f = POSTURAS[id]
              return (
                <div key={id} style={{ border: '1px solid var(--color-regla)' }}>
                  <p className="px-1 pt-1 text-[9px] leading-tight">
                    {POR_ID.get(id)?.nombre ?? id}
                    {!f && ' — SIN DIBUJO'}
                  </p>
                  {f && (
                    <div className="flex">
                      <FiguraEjercicio figura={f} animar={false} />
                      <FiguraEjercicio figura={{ ...f, inicio: f.fin }} animar={false} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
