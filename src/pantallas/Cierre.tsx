/**
 * El cierre.
 *
 * Por la regla del pico y el final, lo que una persona recuerda de una sesión
 * —y lo que predice si va a haber otra— depende mucho más del final que del
 * promedio. Así que esta es, medida por impacto, la pantalla más importante de
 * la app. Antes era una lista de tarjetas.
 *
 * Cómo está construida, y por qué en ese orden:
 *
 * 1. **Una regla se imprime, y después setecientos milisegundos de nada.** Ese
 *    silencio es el diseño: es lo que hace que lo que viene se sienta dicho y
 *    no gritado.
 * 2. **El número de sesión, enorme.** Lo más grande de la pantalla es quién
 *    sos, no qué hiciste. "Sesión 047" pesa más que "+2 repeticiones" porque
 *    habla de identidad, que es de los predictores más fuertes de que alguien
 *    siga entrenando dentro de un año.
 * 3. **La línea llega al nodo y recién ahí se enciende la estrella.** Cuando
 *    hubo cambio de eslabón, el movimiento se ve: queda la huella de dónde
 *    estabas y la luz aparece donde estás.
 * 4. **El motor explica lo que decidió, en cursiva y con su regla firmada.**
 *
 * Nada de confeti, monedas ni insignias. Las recompensas tangibles y esperadas
 * socavan la motivación intrínseca; el feedback informativo sobre la propia
 * competencia la construye. Si esto celebra, celebra con un dato.
 */

import { useEffect, useState } from 'react'
import { NOMBRE_PATRON, buscarEjercicio } from '@/dominio/biblioteca'
import { seriesDeSesion } from '@/dominio/estadisticas'
import { esHito } from '@/dominio/adherencia'
import type { ResumenSesion } from '@/datos/repositorio'
import { comoReloj } from '@/hooks/useTemporizador'
import { Carta } from '@/componentes/carta'
import { sonar, tocar } from '@/respuesta'
import { AccionQuieta, Glosa, Rotulo } from '@/componentes/ui'
import { Lyra } from '@/componentes/lyra'
import { fraseDe } from '@/dominio/frases'

/** La regla que aplicó el motor, para firmar la decisión. */
const REGLA: Record<string, string> = {
  'nivel-arriba': 'Regla · techo de la ventana sostenido',
  'nivel-abajo': 'Regla · señal por debajo del piso',
  subida: 'Regla · objetivo cumplido',
  bajada: 'Regla · objetivo por encima de lo posible',
  sostiene: 'Regla · consolidando',
  neutra: 'Regla · sesión fuera de la progresión',
}

export function Cierre({
  resumen,
  duracion,
  alSalir,
}: {
  resumen: ResumenSesion
  duracion: number
  alSalir: () => void
}) {
  const { sesion, decisiones, numeroDeSesion } = resumen
  const series = seriesDeSesion(sesion)
  const huboSalto = decisiones.some((d) => d.decision.cambioDeNivel)
  const hito = esHito(numeroDeSesion)

  /**
   * Lo que Lyra dice al cerrar, según cómo fue.
   *
   * Los tres momentos que usa acá —reencuadre, esfuerzo y cierre— no los usa
   * `Hoy`, que habla de abrir, volver, descansar y constancia. Por eso las dos
   * pantallas no necesitan compartir la memoria de lo dicho: no se pisan.
   *
   * El reencuadre entra justo cuando el motor bajó el objetivo, que es el único
   * momento en que esta app puede sonar a reproche sin querer. Ahí una línea
   * que separe la conducta de la identidad no es decoración: es lo que evita
   * que alguien lea "bajaste de eslabón" como "no servís para esto".
   */
  const bajo = decisiones.some(
    (d) => d.decision.movimiento === 'bajada' || d.decision.movimiento === 'nivel-abajo',
  )
  const [azar] = useState(() => Math.random())
  const dijo = fraseDe(bajo ? 'reencuadre' : huboSalto ? 'esfuerzo' : 'cierre', azar)

  /**
   * Suena una sola cosa, y casi nunca.
   *
   * El salto de eslabón manda sobre el hito porque es lo que la app promete.
   * Ojo con la frecuencia, que es contraintuitiva: medido sobre el motor real,
   * el salto cae en el 35-40% de los cierres —las cuatro cadenas arrancan
   * juntas y se agrupan—, no una vez cada seis semanas. Un día común no suena
   * nada, y eso es lo que hace que estos dos se escuchen.
   *
   * El retardo alinea el sonido con el momento en que la línea llega al nodo y
   * la estrella se enciende: los tres canales convergen en un solo instante.
   */
  useEffect(() => {
    if (!huboSalto && !hito) return
    const cual = huboSalto ? 'nivel' : 'hito'
    const espera = huboSalto ? 1460 : 1700
    const id = window.setTimeout(() => {
      sonar(cual)
      tocar(cual)
    }, espera)
    return () => window.clearTimeout(id)
  }, [huboSalto, hito])

  /** Dónde estaba cada patrón antes de esta sesión, para dibujar la huella. */
  const huellas = new Map(
    sesion.registros.map((r) => {
      const e = buscarEjercicio(r.ejercicioId)
      return [e?.patron ?? 'empuje', r.ejercicioId] as const
    }),
  )

  const filas = decisiones.map(({ patron, decision }) => ({
    patron,
    avance: decision.avance,
    ...(decision.cambioDeNivel && huellas.get(patron)
      ? { huella: huellas.get(patron)! }
      : {}),
  }))

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-12">
        {/* La regla se imprime. Después, silencio. */}
        <div className="anim-regla h-px w-full bg-[var(--color-regla-fuerte)]" />

        <div className="revelar revelar--1 mt-8">
          <Rotulo>{hito ? 'SESIÓN REDONDA' : 'SESIÓN'}</Rotulo>
          <p className="cifra-identidad mt-2">{String(numeroDeSesion).padStart(3, '0')}</p>
          <p className="mt-2 text-sm text-[var(--color-glosa)]">
            {comoReloj(duracion)} · {series} {series === 1 ? 'serie' : 'series'}
            {sesion.tipo === 'corta' && ' · sesión corta'}
            {sesion.tipo === 'vuelta' && ' · sesión de vuelta'}
          </p>
        </div>

        {filas.length > 0 && (
          <div className="mt-8">
            <Carta filas={filas} animar={huboSalto} />
          </div>
        )}

        <div className="revelar revelar--2 mt-8 space-y-6">
          {decisiones.map(({ patron, decision }) => (
            <div key={patron}>
              <Rotulo className="mb-2">{NOMBRE_PATRON[patron].toUpperCase()}</Rotulo>
              <Glosa
                cita={REGLA[decision.movimiento] ?? 'Regla del motor'}
                {...(decision.movimiento === 'bajada' || decision.movimiento === 'nivel-abajo'
                  ? { tono: 'ambar' as const }
                  : {})}
              >
                {decision.explicacion}
              </Glosa>
            </div>
          ))}

          {decisiones.length === 0 && (
            <Glosa cita="Regla · progresión sin cambios">
              La sesión quedó registrada. Como no completaste los ejercicios que tocaban, el plan
              se mantiene igual.
            </Glosa>
          )}
        </div>

        {/* Lyra, al final y DESPUÉS de lo que decidió el motor.
         *
         * El orden es la regla entera: primero el dato —qué cambió y por qué—,
         * y recién después la voz. §9 no prohíbe que la app hable; prohíbe que
         * lo que dice OCUPE EL LUGAR de un dato sobre el desempeño propio. Acá
         * no puede ocuparlo: llega cuando el dato ya se dijo.
         *
         * Y llega justo en el final de la sesión, que por la regla del pico y
         * el final es el momento que se lleva puesto el recuerdo de todo lo
         * demás. Si Lyra va a hablar una vez por sesión, es acá. */}
        {dijo && (
          <div className="revelar revelar--3 mt-10 flex items-start gap-3">
            <Lyra tamano={56} expresion={dijo.expresion} className="shrink-0" />
            <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-[var(--color-glosa)]">
              {dijo.texto}
            </p>
          </div>
        )}

        {hito && (
          <p className="revelar revelar--3 mt-8 max-w-[36ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            Sesión {numeroDeSesion}. Ese número no baja nunca, aunque falten semanas: es lo único
            de la app que solo puede subir.
          </p>
        )}
      </main>

      <div className="revelar revelar--4 mt-10">
        <AccionQuieta onClick={alSalir}>Listo</AccionQuieta>
      </div>
    </div>
  )
}
