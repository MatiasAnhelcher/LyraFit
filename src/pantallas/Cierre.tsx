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
 * 3. **El relleno entra y recién ahí se posa la estrella.** Cuando hubo
 *    cambio de eslabón, el movimiento se ve: se llena el eslabón nuevo, o el
 *    que acabás de dominar si el nuevo arranca en su piso, y queda la huella
 *    de dónde estabas cuando no cae debajo de la estrella. La cadena que
 *    saltó se abre; las demás quedan en su fila chica.
 * 4. **El motor explica lo que decidió, en cursiva y con su regla firmada.**
 *
 * Nada de confeti, monedas ni insignias. Las recompensas tangibles y esperadas
 * socavan la motivación intrínseca; el feedback informativo sobre la propia
 * competencia la construye. Si esto celebra, celebra con un dato.
 */

import { useEffect, useRef, useState } from 'react'
import { NOMBRE_PATRON } from '@/dominio/biblioteca'
import { seriesDeSesion } from '@/dominio/estadisticas'
import { esHito } from '@/dominio/adherencia'
import { diaLocal } from '@/dominio/borrador'
import { lineaSinCadenas, lineaYaLeida } from '@/dominio/lineas'
import type { ResumenSesion } from '@/datos/repositorio'
import { comoReloj } from '@/hooks/useTemporizador'
import { FilaDeCadenaChica, FilaDeSalto } from '@/componentes/filaDeCadena'
import { enCadena } from '@/componentes/enCadena'
import { sonar, tocar } from '@/respuesta'
import { AccionQuieta, Glosa, Rotulo } from '@/componentes/ui'
import { Lyra } from '@/componentes/lyra'
import { fraseDe } from '@/dominio/frases'

/** La regla que aplicó el motor, para firmar la decisión. */
const REGLA: Record<string, string> = {
  'nivel-arriba': 'Regla · techo de la ventana sostenido',
  'nivel-abajo': 'Regla · señal por debajo del piso',
  subida: 'Regla · señal por encima de la vara de subir',
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
  const { sesion, decisiones, numeroDeSesion, pasosDeCadena } = resumen
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
  // Con el número de esta sesión, para que "una sesión más" no salga en la 001.
  const dijo = fraseDe(
    bajo ? 'reencuadre' : huboSalto ? 'esfuerzo' : 'cierre',
    azar,
    [],
    { sesiones: numeroDeSesion },
  )

  /**
   * Suena una sola cosa, y casi nunca.
   *
   * El salto de eslabón manda sobre el hito porque es lo que la app promete.
   * Ojo con la frecuencia, que es contraintuitiva: medido sobre el motor real,
   * el salto cae en el 35-40% de los cierres —las cuatro cadenas arrancan
   * juntas y se agrupan—, no una vez cada seis semanas. Un día común no suena
   * nada, y eso es lo que hace que estos dos se escuchen.
   *
   * El retardo alinea el sonido con el momento en que el relleno llega y la
   * estrella se posa: los tres canales convergen en un solo instante. Si la
   * persona terminó la coreografía antes, suena en el acto.
   */
  const [terminada, setTerminada] = useState(false)
  const sono = useRef(false)
  useEffect(() => {
    if ((!huboSalto && !hito) || sono.current) return
    const cual = huboSalto ? 'nivel' : 'hito'
    const espera = terminada ? 0 : huboSalto ? 1460 : 1700
    const id = window.setTimeout(() => {
      sono.current = true
      sonar(cual)
      tocar(cual)
    }, espera)
    return () => window.clearTimeout(id)
  }, [huboSalto, hito, terminada])

  /**
   * Tocar la pantalla pasados 500 ms termina la coreografía: quien ya la vio
   * veinte veces no tiene por qué esperar cuatro segundos a "Listo". Antes de
   * los 500 ms no, para que el toque que cerró la sesión no se la saltee.
   */
  const [montada] = useState(() => performance.now())
  const terminar = () => {
    if (!terminada && performance.now() - montada > 500) setTerminada(true)
  }

  /**
   * Las cadenas que ya se habían leído ese día van juntas, en una sola línea con
   * la hora de cada una: cuatro glosas iguales una abajo de la otra repetirían
   * cuatro veces lo mismo. Y van después de lo que decidió esta sesión.
   */
  const leidasHoy = decisiones.flatMap(({ patron, decision }) =>
    decision.motivo === 'ya-leida-hoy' && decision.leidaA !== undefined
      ? [{ patron, hora: decision.leidaA }]
      : [],
  )
  const deEstaSesion = decisiones.filter(({ decision }) => decision.motivo !== 'ya-leida-hoy')
  // "hoy" solo si la sesión es del día en que cerró: una que arrancó a las
  // 23:40 y cerró a las 00:05 es del día de antes, igual que en el motor.
  const yaLeidas = lineaYaLeida(leidasHoy, {
    esHoy: sesion.fecha === diaLocal(sesion.finalizadaEn),
  })
  // Sin decisiones, la razón verdadera y solo si es cierta: si la sesión
  // tenía pasos de cadena y no se hicieron, no hubo nada que leer y del plan
  // no se dice nada.
  const sinCadenas =
    decisiones.length === 0 ? lineaSinCadenas({ tipo: sesion.tipo, pasosDeCadena }) : null

  return (
    <div
      className="flex min-h-dvh flex-col"
      onPointerDown={terminar}
      data-terminada={terminada ? '' : undefined}
    >
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

        {decisiones.length > 0 && (
          <div className="placa placa-cadenas mt-8">
            {decisiones.map(({ patron, decision, antes }) =>
              decision.cambioDeNivel ? (
                // La huella sale del avance que el motor evaluó, no del
                // objetivo del registro: en un día ámbar ese viene recortado.
                <FilaDeSalto key={patron} avance={decision.avance} antes={enCadena(antes)} />
              ) : (
                <FilaDeCadenaChica key={patron} avance={decision.avance} />
              ),
            )}
          </div>
        )}

        <div className="revelar revelar--2 mt-8 space-y-6">
          {deEstaSesion.map(({ patron, decision }) => (
            <div key={patron}>
              <Rotulo className="mb-2">{NOMBRE_PATRON[patron].toUpperCase()}</Rotulo>
              <Glosa
                cita={
                  decision.motivo === 'protegida'
                    ? 'Regla · lectura protegida'
                    : decision.motivo === 'meseta'
                      ? 'Regla · varios días con el mismo objetivo'
                      : (REGLA[decision.movimiento] ?? 'Regla del motor')
                }
                {...(decision.movimiento === 'bajada' || decision.movimiento === 'nivel-abajo'
                  ? { tono: 'ambar' as const }
                  : {})}
              >
                {decision.explicacion}
              </Glosa>
            </div>
          ))}

          {yaLeidas && <Glosa cita="Regla · una lectura por día">{yaLeidas}</Glosa>}

          {sinCadenas && <Glosa cita="Regla · progresión sin cambios">{sinCadenas}</Glosa>}
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

      <div className="revelar revelar--4 mx-auto w-full max-w-lg px-4 mt-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <AccionQuieta onClick={alSalir}>Listo</AccionQuieta>
      </div>
    </div>
  )
}
