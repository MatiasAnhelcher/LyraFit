/**
 * El chequeo diario.
 *
 * Tres preguntas, una pantalla, sin scroll y sin botón de "siguiente". Las
 * tres orientadas para que 5 sea lo mejor: mezclar direcciones obliga a
 * invertir mentalmente y produce errores de carga.
 *
 * "Hoy no" está siempre a la vista y no rompe nada. Suena contraintuitivo,
 * pero quien puede saltar responde más veces en el largo plazo que quien
 * arrastra una racha de registro.
 *
 * Y lo más importante: esto casi nunca cambia el entrenamiento. Solo cuando
 * algo se sostiene dos de tres días. El resto del tiempo la app se queda
 * callada, que es lo que hace que valga la pena cuando habla.
 *
 * La excepción es la molestia, que cambia el plan ese mismo día. Se pregunta
 * siempre, con los músculos doloridos o sin dolor: antes aparecía solo con
 * los músculos marcados como doloridos, y quien tenía los músculos bien y el
 * codo avisando no tenía dónde decirlo. Y se puede avisar también sin pasar
 * por acá, desde Hoy, con el chequeo apagado.
 */

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ENTRADAS_MINIMAS, leerEstado } from '@/dominio/estado'
import type { Patron } from '@/dominio/tipos'
import { fechaISO, guardarEstado, leerEstados } from '@/datos/repositorio'
import { useVolver } from '@/componentes/movimiento'
import { Accion, AccionQuieta, Cargando, Regleta, Rotulo, Segmento } from '@/componentes/ui'
import { ElegirMolestia, LO_QUE_PASA_CON_LA_MOLESTIA } from '@/componentes/molestia'

const ITEMS = [
  {
    clave: 'sueno' as const,
    pregunta: '¿Cómo dormiste anoche?',
    opciones: ['Muy mal', 'Mal', 'Más o menos', 'Bien', 'Muy bien'],
  },
  {
    clave: 'energia' as const,
    pregunta: '¿Cómo está tu energía hoy?',
    // "Con poca energía" y no "Cansado": la app no sabe el género de nadie.
    // Tiene que ser idéntica a la escala de las preguntas del final (`Entrenar`).
    opciones: ['En el piso', 'Con poca energía', 'Normal', 'Con energía', 'A pleno'],
  },
  {
    clave: 'musculos' as const,
    pregunta: '¿Cómo andan tus músculos?',
    opciones: ['Muy doloridos', 'Doloridos', 'Cargados', 'Casi bien', 'Sin dolor'],
  },
]

export function Estado() {
  const volver = useVolver()
  const historial = useLiveQuery(leerEstados, [])
  // El de hoy sale del historial, que ya lo trae: una lectura sola llega
  // antes que dos, y el pasaje la espera.
  const deHoy = historial?.find((e) => e.fecha === fechaISO())

  const [valores, setValores] = useState<Record<string, number>>({})
  const [molestia, setMolestia] = useState<Patron | 'ninguna' | null>(null)
  const [guardando, setGuardando] = useState(false)

  const actual = { ...Object.fromEntries(Object.entries(deHoy ?? {})), ...valores } as Record<
    string,
    number
  >
  const completo = ITEMS.every((i) => actual[i.clave] !== undefined)
  // La molestia que ya estaba avisada hoy —desde Hoy, con el chequeo apagado—
  // arranca elegida. Si no, guardar el chequeo la borraría sin que nadie lo
  // pidiera.
  const molestiaElegida = molestia ?? deHoy?.molestia ?? null

  // La placa hasta tener el historial, como el resto de las pantallas: si
  // llegaba con el pasaje andando, lo elegido hoy y el aviso de la línea de
  // base aparecían en pleno movimiento, y ese render era un cuadro largo.
  if (!historial) return <Cargando filas={5} />

  const lectura = leerEstado(historial, fechaISO())

  async function guardar() {
    setGuardando(true)
    try {
      await guardarEstado({
        fecha: fechaISO(),
        sueno: actual.sueno ?? 3,
        energia: actual.energia ?? 3,
        musculos: actual.musculos ?? 3,
        ...(molestiaElegida && molestiaElegida !== 'ninguna' ? { molestia: molestiaElegida } : {}),
      })
    } catch (error) {
      setGuardando(false)
      throw error
    }
    // "Guardando…" se queda hasta irse: la foto vieja del pasaje se saca un
    // cuadro después, y un "Listo" que reaparece en ese cuadro parpadea.
    volver('/')
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1">
        <Rotulo>¿CÓMO VENÍS HOY?</Rotulo>

        {ITEMS.map((item) => (
          <section key={item.clave} className="mt-7">
            <p className="nombre">{item.pregunta}</p>
            <Regleta className="mt-3" etiqueta={item.pregunta}>
              {item.opciones.map((etiqueta, i) => {
                const valor = i + 1
                const elegido = actual[item.clave] === valor
                return (
                  <Segmento
                    key={valor}
                    elegido={elegido}
                    onClick={() => setValores((v) => ({ ...v, [item.clave]: valor }))}
                  >
                    {etiqueta}
                  </Segmento>
                )
              })}
            </Regleta>
          </section>
        ))}

        <section className="mt-8">
          <p className="nombre">¿Te molesta algo en un lugar puntual?</p>
          <p className="mt-1 text-xs text-[var(--color-glosa)]">
            El dolor muscular repartido es parte de entrenar. Una molestia en un lugar concreto es
            otra cosa. {LO_QUE_PASA_CON_LA_MOLESTIA}
          </p>
          <ElegirMolestia valor={molestiaElegida} onElegir={setMolestia} ninguna="No" />
        </section>

        {!lectura.confiable && lectura.faltan > 0 && (
          <p className="mt-8 max-w-[38ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            Te {lectura.faltan === 1 ? 'falta' : 'faltan'} {lectura.faltan} de {ENTRADAS_MINIMAS}{' '}
            registros para tener tu línea de base. Hasta entonces la app no va a interpretar nada:
            con menos datos, cualquier lectura sería ruido con cara de señal.
          </p>
        )}
      </main>

      <div className="mt-8 flex flex-col gap-3">
        <Accion deshabilitado={!completo || guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Listo'}
        </Accion>
        <AccionQuieta onClick={() => volver('/')}>Hoy no</AccionQuieta>
      </div>
    </div>
  )
}
