import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { borrarTodo } from '@/datos/repositorio'
import { Accion, AccionQuieta } from '@/componentes/ui'
import { avisarEnElAlta } from '../Alta'

/** La salida de todo: borrar lo que la app guarda en este teléfono, confirmándolo antes. */
export function BorrarTodo() {
  const navegar = useNavigate()
  const [confirmando, setConfirmando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [errorAlBorrar, setErrorAlBorrar] = useState<string | null>(null)

  /**
   * Borrar todo, y decir "Listo" recién cuando es cierto.
   *
   * Antes se llamaba sin esperar y el "Listo. No quedó nada." salía en el
   * acto, aunque la carpeta de copias automáticas —con el historial adentro—
   * no se tocaba nunca. Ahora se espera todo. Si sale bien, la base vacía
   * manda al alta, y el "Listo" se dice allá; si algo falla, se dice acá.
   */
  async function borrarDeVerdad() {
    setBorrando(true)
    setErrorAlBorrar(null)
    try {
      await borrarTodo()
      avisarEnElAlta('Listo. Se borró todo lo que la app guardaba en este teléfono.')
      navegar('/alta', { replace: true })
    } catch {
      setErrorAlBorrar('No se pudo borrar todo. Probá de nuevo.')
    } finally {
      setBorrando(false)
    }
  }

  if (!confirmando) {
    return (
      <button
        onClick={() => setConfirmando(true)}
        className="text-sm text-[var(--color-destructivo)] underline underline-offset-4"
      >
        Borrar todos mis datos
      </button>
    )
  }

  return (
    <div>
      <p className="max-w-[40ch] text-sm leading-relaxed">
        Esto borra tu historial, tu diario, tu peso y las copias automáticas de este
        teléfono. No se puede deshacer.
      </p>
      <p className="mt-2 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
        Las copias que descargaste o compartiste no las puede borrar la app: están donde las
        guardaste.
      </p>
      {errorAlBorrar && (
        <p role="alert" className="mt-3 max-w-[40ch] text-sm text-[var(--color-destructivo)]">
          {errorAlBorrar}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3">
        <Accion tono="destructivo" deshabilitado={borrando} onClick={() => void borrarDeVerdad()}>
          {borrando ? 'Borrando…' : 'Sí, borrar todo'}
        </Accion>
        <AccionQuieta
          deshabilitado={borrando}
          onClick={() => {
            setConfirmando(false)
            setErrorAlBorrar(null)
          }}
        >
          Mejor no
        </AccionQuieta>
      </div>
    </div>
  )
}
