/**
 * Una sesión que quedó sin cerrar, y las dos salidas: guardarla o descartarla.
 *
 * Existe porque el borrador vencía a las seis horas y se borraba solo, sin
 * mostrarse, la próxima vez que se abría Entrenar: doce series en "Antes de
 * cerrar", el teléfono al bolsillo, y a la mañana siguiente Hoy decía
 * "Todavía ninguna". Ahora un borrador con trabajo adentro nunca se borra sin
 * que la persona lo vea y lo decida.
 *
 * Lo usan Hoy, que es donde aparece, y Entrenar, por si alguien llega directo
 * sin pasar por Hoy. Las dos pantallas hacen lo mismo con las respuestas; acá
 * está lo que se ve y lo que se dice cuando algo falla.
 *
 * Los botones son los de contorno, como en el ofrecimiento del fuelle: la
 * barra de acción de Hoy ya es "Empezar", y Vega no se gasta dos veces.
 */

import { useState } from 'react'
import { textoDeSinCerrar } from '@/dominio/borrador'
import type { SesionEnCurso } from '@/dominio/tipos'
import { Rotulo } from './ui'

export function SesionSinCerrar({
  borrador,
  hoy,
  alGuardar,
  alDescartar,
}: {
  borrador: SesionEnCurso
  /** El día de hoy, AAAA-MM-DD, para decir "de ayer" en vez de una fecha. */
  hoy: string
  alGuardar: () => Promise<void>
  alDescartar: () => Promise<void>
}) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function responder(accion: () => Promise<void>, siFalla: string) {
    setOcupado(true)
    setError(null)
    try {
      await accion()
    } catch {
      setError(siFalla)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section data-prueba="sesion-sin-cerrar">
      <Rotulo>SESIÓN SIN CERRAR</Rotulo>
      <p className="mt-3 max-w-[40ch] leading-relaxed">{textoDeSinCerrar(borrador, hoy)}</p>
      <p className="mt-2 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
        Guardarla la suma a tu historial como cualquier otra sesión. Descartarla la borra, y eso
        no se puede deshacer.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          onClick={() =>
            void responder(alGuardar, 'No se pudo guardar. La sesión sigue acá: probá de nuevo.')
          }
          disabled={ocupado}
          className="boton-contorno boton-contorno-fuerte"
        >
          Guardarla
        </button>
        <button
          onClick={() => void responder(alDescartar, 'No se pudo descartar. Probá de nuevo.')}
          disabled={ocupado}
          className="boton-contorno"
        >
          Descartarla
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 max-w-[40ch] text-sm text-[var(--color-ambar)]">
          {error}
        </p>
      )}
    </section>
  )
}
