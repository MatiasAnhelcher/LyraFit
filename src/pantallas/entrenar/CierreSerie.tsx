import type { ReactNode } from 'react'
import { Accion, AccionQuieta } from '@/componentes/ui'
import { Armazon } from './Armazon'

/**
 * La serie de cierre.
 *
 * Nunca cuenta para fallo y siempre se puede saltear. Está para que la sesión
 * termine en una nota que se pueda sostener, no en el punto más duro.
 *
 * Va en el mismo armazón que la serie, con el mismo encabezado: sigue siendo
 * la sesión, con su cronómetro y su salida.
 */
export function SerieDeCierre({
  encabezado,
  nombre,
  cantidad,
  medida,
  onHecho,
  onSaltear,
}: {
  encabezado: ReactNode
  nombre: string
  cantidad: number
  medida: 'repeticiones' | 'segundos'
  onHecho: () => void
  onSaltear: () => void
}) {
  return (
    <Armazon
      encabezado={encabezado}
      pie={
        <Accion esfuerzo onClick={onHecho}>
          Listo
        </Accion>
      }
    >
      <p className="rotulo">CIERRE</p>
      <h1 className="titulo-ejercicio" data-prueba="titulo-ejercicio" data-foco>
        {nombre}
      </h1>
      <p className="cifra-esfuerzo mt-6">
        {cantidad}
        {medida === 'segundos' && <span className="unidad">s</span>}
      </p>
      <p className="explicacion-esfuerzo">
        Una serie fácil para terminar. No cuenta para la progresión y no se puede fallar: está
        para que te vayas con la sensación de que podías más, que es lo que hace que vuelvas.
      </p>
      <div className="secundaria-esfuerzo">
        <AccionQuieta onClick={onSaltear}>Saltear el cierre</AccionQuieta>
      </div>
    </Armazon>
  )
}
