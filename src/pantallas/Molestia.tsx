/**
 * Avisar una molestia.
 *
 * Existe porque el único lugar para decir "me molesta la muñeca" era el
 * chequeo diario, y el chequeo viene apagado de fábrica: para casi todo el
 * mundo, el canal de seguridad de la app no existía. Esto es una pregunta
 * sola, a un toque desde Hoy, con el chequeo prendido o apagado y con los
 * músculos como estén.
 *
 * Pregunta dónde, nunca por qué: la app no diagnostica. Y no cobra nada por
 * avisar —ni un eslabón ni un reto—, porque si avisar castiga, la gente deja
 * de avisar.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Patron } from '@/dominio/tipos'
import { guardarMolestiaDeHoy, leerEstadoDeHoy } from '@/datos/repositorio'
import { useVolver } from '@/componentes/movimiento'
import { Accion, AccionQuieta, Rotulo } from '@/componentes/ui'
import { ElegirMolestia, LO_QUE_PASA_CON_LA_MOLESTIA } from '@/componentes/molestia'

export function Molestia() {
  const volverAHoy = useVolver()
  const deHoy = useLiveQuery(leerEstadoDeHoy, [])
  const [elegida, setElegida] = useState<Patron | 'ninguna' | null>(null)
  const [guardando, setGuardando] = useState(false)

  const avisada = deHoy?.molestia ?? null
  // Lo que se ve elegido: lo que tocó recién o, si no tocó nada, lo que ya
  // había avisado hoy.
  const valor = elegida ?? avisada
  const volver = () => volverAHoy('/')

  async function guardar() {
    if (!elegida) return volver()
    setGuardando(true)
    try {
      await guardarMolestiaDeHoy(elegida === 'ninguna' ? null : elegida)
    } catch (error) {
      setGuardando(false)
      throw error
    }
    // Como en el chequeo: "Guardando…" se queda hasta irse, para que la foto
    // vieja del pasaje no lo agarre volviendo a decir "Listo".
    volver()
  }

  // Sin `min-h-dvh`, a diferencia del chequeo: acá hay una sola pregunta, y
  // empujar las acciones al fondo las dejaba debajo de la barra de navegación
  // en un teléfono de 360×640. Pegadas a la pregunta se ven sin scrollear.
  return (
    <div>
      <main>
        <Rotulo>¿TE MOLESTA ALGO?</Rotulo>

        <section className="mt-7">
          <p className="nombre">¿Qué cadena la carga?</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-glosa)]">
            {LO_QUE_PASA_CON_LA_MOLESTIA}
          </p>
          {/* "Ya no" aparece solo si hoy ya había una: retirar algo que no
              estaba no tiene sentido, y sin molestia alcanza con no tocar
              nada. */}
          <ElegirMolestia valor={valor} onElegir={setElegida} ninguna={avisada ? 'Ya no' : null} />
        </section>
      </main>

      <div className="mt-8 flex flex-col gap-3">
        <Accion deshabilitado={!valor || guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Listo'}
        </Accion>
        <AccionQuieta onClick={volver}>Volver</AccionQuieta>
      </div>
    </div>
  )
}
