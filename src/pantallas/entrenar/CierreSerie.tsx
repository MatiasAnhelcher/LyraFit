import { Accion, AccionQuieta, Rotulo } from '@/componentes/ui'

/**
 * La serie de cierre.
 *
 * Nunca cuenta para fallo y siempre se puede saltear. Está para que la sesión
 * termine en una nota que se pueda sostener, no en el punto más duro.
 */
export function SerieDeCierre({
  nombre,
  cantidad,
  medida,
  onHecho,
  onSaltear,
}: {
  nombre: string
  cantidad: number
  medida: 'repeticiones' | 'segundos'
  onHecho: () => void
  onSaltear: () => void
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4">
        <Rotulo>CIERRE</Rotulo>
        <h1
          className="mt-2 text-3xl font-bold leading-tight tracking-tight"
          data-prueba="titulo-ejercicio"
        >
          {nombre}
        </h1>
        <p className="cifra mt-8 text-7xl">
          {cantidad}
          {medida === 'segundos' && <span className="unidad">s</span>}
        </p>
        <p className="mt-6 max-w-[36ch] text-sm leading-relaxed text-[var(--color-glosa)]">
          Una serie fácil para terminar. No cuenta para la progresión y no se puede fallar: está
          para que te vayas con la sensación de que podías más, que es lo que hace que vuelvas.
        </p>
      </main>
      <div className="mt-auto">
        <div className="mx-auto w-full max-w-lg px-4 pb-4">
          <AccionQuieta onClick={onSaltear}>Saltear el cierre</AccionQuieta>
        </div>
        <Accion esfuerzo onClick={onHecho}>
          Listo
        </Accion>
      </div>
    </div>
  )
}
