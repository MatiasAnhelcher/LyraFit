/**
 * Las pantallas de Entrenar que no son la sesión: lo que se ve mientras se
 * prepara, o cuando hay algo que decidir o decir antes de arrancar.
 *
 * Todas llevan `.pantalla-esfuerzo`: siguen siendo Entrenar, con su noche,
 * su letra y sus toques de 56, y el pasaje desde Hoy no cambia de piel a
 * mitad de camino.
 */

import { Lyra } from '@/componentes/lyra'
import { SesionSinCerrar } from '@/componentes/sinCerrar'
import { AccionQuieta, BotonSalir, Rotulo } from '@/componentes/ui'
import { lineaDeMolestia, type CambioPorMolestia } from '@/dominio/molestia'
import type { Patron, SesionEnCurso } from '@/dominio/tipos'
import { Armazon } from './Armazon'

/**
 * Mientras la base contesta y no vino un plan de Hoy. Quieto y sin `main`:
 * el foco espera a que haya uno, y enfocar en este hueco lo dejaría en
 * `<body>` (`useTituloYFoco`).
 */
export function Preparando() {
  return (
    <div className="pantalla-esfuerzo flex h-svh items-center justify-center">
      <Rotulo>PREPARANDO LA SESIÓN…</Rotulo>
    </div>
  )
}

/** Solo la salida: lo de arriba de las pantallas que no son una serie. */
function SoloLaSalida({ onSalir }: { onSalir: () => void }) {
  return (
    <header className="encabezado-esfuerzo">
      <div className="encabezado-esfuerzo-fila">
        <BotonSalir onClick={onSalir} />
      </div>
    </header>
  )
}

/**
 * Un borrador vencido con trabajo adentro, para quien llegó directo sin
 * pasar por Hoy: la misma placa de Hoy, y nada arranca hasta decidir. Arrancar
 * escribiría el borrador nuevo encima del viejo, que es perderlo sin que nadie
 * lo vea.
 */
export function SinCerrarAlEntrar({
  borrador,
  hoy,
  onSalir,
  alGuardar,
  alDescartar,
}: {
  borrador: SesionEnCurso
  hoy: string
  onSalir: () => void
  alGuardar: () => Promise<void>
  alDescartar: () => Promise<void>
}) {
  return (
    <Armazon encabezado={<SoloLaSalida onSalir={onSalir} />}>
      <div className="my-auto">
        <SesionSinCerrar borrador={borrador} hoy={hoy} alGuardar={alGuardar} alDescartar={alDescartar} />
      </div>
    </Armazon>
  )
}

/**
 * Otra pantalla ya guardó esta sesión, con lo que tenía su borrador: la Ficha
 * al cambiar de nivel, o "Guardarla" en otra pestaña. Seguir acá sería anotar
 * series que no van a ningún lado, o guardarlas dos veces.
 *
 * Sin `role="status"`: la región viva de Entrenar es una sola, y una que se
 * monta con su texto no anuncia nada. Lo que lo dice es el foco, que llega al
 * rótulo como en cualquier estado nuevo de la sesión.
 */
export function YaGuardada({ onIrAHoy }: { onIrAHoy: () => void }) {
  return (
    <div className="pantalla-esfuerzo mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center px-4">
      <section data-prueba="sesion-ya-guardada">
        <p className="rotulo" data-foco>
          SESIÓN GUARDADA
        </p>
        <p className="mt-3 max-w-[40ch] leading-relaxed">Esta sesión ya se guardó desde otra pantalla.</p>
        <p className="texto-chico mt-2 max-w-[40ch]">
          Está en tu historial con lo que se había anotado hasta ese momento.
        </p>
      </section>
      <button type="button" onClick={onIrAHoy} className="boton-contorno boton-contorno-fuerte mt-6 self-start">
        Ir a Hoy
      </button>
    </div>
  )
}

/**
 * Un plan vacío por la molestia no es una sesión que todavía carga.
 *
 * Pasa cuando todo lo que la rutina pedía hoy es de la cadena que avisó y
 * esa cadena está en su primer eslabón —o lo demás necesita una barra que no
 * hay—. Sin esto la pantalla se quedaba en "preparando" para siempre: se
 * dice lo que pasó y se ofrece volver.
 */
export function SinEjercicios({
  avisos,
  onVolver,
}: {
  avisos: { patron: Patron; cambio: CambioPorMolestia }[]
  onVolver: () => void
}) {
  return (
    <Armazon
      encabezado={null}
      pie={
        <div className="pie-quieto">
          <AccionQuieta onClick={onVolver}>Volver</AccionQuieta>
        </div>
      }
    >
      <div className="my-auto">
        <Lyra tamano={44} expresion="calma" interactiva={false} />
        <Rotulo className="mt-4">HOY</Rotulo>
        {avisos.map((aviso) => (
          <p key={aviso.patron} className="mt-3 max-w-[34ch] text-lg leading-snug" data-prueba="linea-molestia">
            {lineaDeMolestia(aviso)}
          </p>
        ))}
        <p className="texto-glosa mt-4 max-w-[36ch]">Sin esa cadena, la sesión de hoy se queda sin ejercicios.</p>
      </div>
    </Armazon>
  )
}
