/**
 * Cerrar la sesión: guardarla con lo que se anotó y decir si no se pudo.
 *
 * Vive aparte de `Entrenar` por tamaño y porque es una sola cosa: lo que pasa
 * entre "Cerrar la sesión" y el cierre, con sus dos salidas raras —otra
 * pantalla ya la guardó, o la base no contestó—.
 */

import { useMemo, useRef, useState } from 'react'
import { registrosDeLaSesion } from '@/dominio/borrador'
import { vitalidadDeAntes } from '@/dominio/vitalidad'
import type { Estado, PasoDelBorrador, RegistroRafaga, Serie, Sesion, TipoSesion } from '@/dominio/tipos'
import { cerrarSesion, SesionYaGuardada, type ResumenSesion } from '@/datos/repositorio'
import { respaldarEnSilencio } from '@/datos/respaldo'

export interface DatosDelFinal {
  esfuerzo?: number
  animo?: number
  vitalidadPost?: number
}

export function useCerrarLaSesion({
  estados,
  historial,
  dia,
  pasos,
  hechas,
  duracion,
  tipo,
  rafagas,
  esDensa,
  idDeLaSesion,
  cortarDescanso,
  alYaGuardada,
  alCerrar,
}: {
  estados: Estado[] | undefined
  historial: Sesion[] | undefined
  dia: string
  pasos: PasoDelBorrador[]
  hechas: Record<string, Serie[]>
  duracion: number
  tipo: TipoSesion
  rafagas: RegistroRafaga[]
  esDensa: boolean
  idDeLaSesion: string
  cortarDescanso: () => void
  alYaGuardada: () => void
  alCerrar: (resumen: ResumenSesion) => void
}) {
  const [guardando, setGuardando] = useState(false)
  /** Lo que salió mal al cerrar, dicho en la pantalla de las preguntas. */
  const [errorAlCerrar, setErrorAlCerrar] = useState<string | null>(null)
  /**
   * Prendido mientras se cierra la sesión, para que nada vuelva a escribir el
   * borrador. Guardar la sesión refresca el historial, el historial rearma el
   * plan, y el plan dispara el efecto que guarda el borrador: si eso llegaba
   * antes que `resumen`, el borrador que la transacción acababa de borrar
   * volvía a aparecer, y al abrir Entrenar la sesión se cerraba dos veces.
   * Lo encontró `datos.mjs` con la prueba por mutación.
   */
  const cerrando = useRef(false)

  /**
   * La energía de antes no se pregunta: ya la contestaste.
   *
   * Si hoy hiciste el chequeo diario, el ítem de energía ES la medición previa.
   * Preguntarla otra vez al empezar la sesión sería cobrar dos veces por el
   * mismo dato, y el delta de vitalidad no vale un toque extra: vale reusar
   * uno que ya diste.
   *
   * Sin chequeo diario no hay delta, y está bien que no lo haya. Media
   * medición no es media respuesta, es una respuesta inventada. Por lo mismo
   * vale solo en la primera sesión del día (`vitalidadDeAntes`), y mientras
   * el historial carga no se da por hecho que esta es la primera.
   */
  const vitalidadPre = useMemo(
    () =>
      historial &&
      vitalidadDeAntes(estados?.find((e) => e.fecha === dia)?.energia, dia, historial),
    [estados, dia, historial],
  )

  async function terminar(datos: DatosDelFinal) {
    setGuardando(true)
    setErrorAlCerrar(null)
    cerrando.current = true
    cortarDescanso()

    try {
      const cerrada = await cerrarSesion({
        registros: registrosDeLaSesion(pasos, hechas),
        duracionSegundos: duracion,
        tipo,
        ...(rafagas.length > 0 ? { rafagas } : {}),
        ...(esDensa ? { densa: true as const } : {}),
        ...(vitalidadPre !== undefined ? { vitalidadPre } : {}),
        ...datos,
        fecha: dia,
        // El borrador se borra adentro de la misma transacción que guarda la
        // sesión: o quedan las dos cosas hechas o ninguna.
        cierraElBorrador: true,
        idDeLaSesion,
      })
      alCerrar(cerrada)
      // El respaldo ocurre solo, sin avisar y sin poder romper nada.
      void respaldarEnSilencio()
    } catch (error) {
      // Ya la había guardado otra pantalla: no se guarda dos veces, se dice.
      // `cerrando` queda prendido, que no hay borrador que volver a escribir.
      if (error instanceof SesionYaGuardada) {
        alYaGuardada()
        return
      }
      // Antes no había `catch`: el botón dejaba de decir "Guardando…" y no
      // pasaba nada más. Ahora se dice, y no se pierde nada: la transacción
      // no llegó a borrar el borrador, así que la sesión sigue entera acá y
      // también si se cierra la app.
      cerrando.current = false
      setErrorAlCerrar('No se pudo guardar. Tu sesión sigue acá: probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return { guardando, errorAlCerrar, cerrando, terminar }
}
