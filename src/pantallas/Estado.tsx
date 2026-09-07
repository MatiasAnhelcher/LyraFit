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
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NOMBRE_PATRON } from '@/dominio/biblioteca'
import { ENTRADAS_MINIMAS, leerEstado } from '@/dominio/estado'
import type { Patron } from '@/dominio/tipos'
import { fechaISO, guardarEstado, leerEstadoDeHoy, leerEstados } from '@/datos/repositorio'
import { Accion, AccionQuieta, Rotulo } from '@/componentes/ui'

const ITEMS = [
  {
    clave: 'sueno' as const,
    pregunta: '¿Cómo dormiste anoche?',
    opciones: ['Muy mal', 'Mal', 'Más o menos', 'Bien', 'Muy bien'],
  },
  {
    clave: 'energia' as const,
    pregunta: '¿Cómo está tu energía hoy?',
    opciones: ['En el piso', 'Cansado', 'Normal', 'Con energía', 'A pleno'],
  },
  {
    clave: 'musculos' as const,
    pregunta: '¿Cómo andan tus músculos?',
    opciones: ['Muy doloridos', 'Doloridos', 'Cargados', 'Casi bien', 'Sin dolor'],
  },
]

const PATRONES: Patron[] = ['empuje', 'traccion', 'piernas', 'core']

export function Estado() {
  const navegar = useNavigate()
  const historial = useLiveQuery(leerEstados, [])
  const deHoy = useLiveQuery(leerEstadoDeHoy, [])

  const [valores, setValores] = useState<Record<string, number>>({})
  const [molestia, setMolestia] = useState<Patron | 'ninguna' | null>(null)
  const [guardando, setGuardando] = useState(false)

  const actual = { ...Object.fromEntries(Object.entries(deHoy ?? {})), ...valores } as Record<
    string,
    number
  >
  const completo = ITEMS.every((i) => actual[i.clave] !== undefined)
  const duele = (actual.musculos ?? 5) <= 2

  const lectura = historial ? leerEstado(historial, fechaISO()) : null

  async function guardar() {
    setGuardando(true)
    try {
      await guardarEstado({
        fecha: fechaISO(),
        sueno: actual.sueno ?? 3,
        energia: actual.energia ?? 3,
        musculos: actual.musculos ?? 3,
        ...(molestia && molestia !== 'ninguna' ? { molestia } : {}),
      })
      navegar('/', { replace: true })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1">
        <Rotulo>¿CÓMO VENÍS HOY?</Rotulo>

        {ITEMS.map((item) => (
          <section key={item.clave} className="mt-7">
            <p className="nombre">{item.pregunta}</p>
            <div className="mt-3 flex gap-px">
              {item.opciones.map((etiqueta, i) => {
                const valor = i + 1
                const elegido = actual[item.clave] === valor
                return (
                  <button
                    key={valor}
                    onClick={() => setValores((v) => ({ ...v, [item.clave]: valor }))}
                    className="flex-1 px-1 py-3 text-[0.6875rem] leading-tight"
                    style={{
                      border: '1px solid var(--color-regla)',
                      backgroundColor: elegido ? 'var(--color-vega)' : 'transparent',
                      color: elegido ? '#fff' : 'var(--color-glosa)',
                    }}
                  >
                    {etiqueta}
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        {duele && (
          <section className="mt-8">
            <p className="nombre">¿Es parejo o hay una zona puntual?</p>
            <p className="mt-1 text-xs text-[var(--color-glosa)]">
              El dolor muscular repartido es parte de entrenar. Una molestia en un lugar concreto
              es otra cosa, y ahí la app deja de empujar esa cadena.
            </p>
            <div className="mt-3 flex flex-wrap gap-px">
              <button
                onClick={() => setMolestia('ninguna')}
                className="px-3 py-3 text-[0.6875rem]"
                style={{
                  border: '1px solid var(--color-regla)',
                  backgroundColor: molestia === 'ninguna' ? 'var(--color-vega)' : 'transparent',
                  color: molestia === 'ninguna' ? '#fff' : 'var(--color-glosa)',
                }}
              >
                Parejo
              </button>
              {PATRONES.map((p) => (
                <button
                  key={p}
                  onClick={() => setMolestia(p)}
                  className="px-3 py-3 text-[0.6875rem]"
                  style={{
                    border: '1px solid var(--color-regla)',
                    backgroundColor: molestia === p ? 'var(--color-ambar)' : 'transparent',
                    color: molestia === p ? '#100f0d' : 'var(--color-glosa)',
                  }}
                >
                  {NOMBRE_PATRON[p]}
                </button>
              ))}
            </div>
          </section>
        )}

        {lectura && !lectura.confiable && lectura.faltan > 0 && (
          <p className="mt-8 max-w-[38ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            Te {lectura.faltan === 1 ? 'falta' : 'faltan'} {lectura.faltan} de {ENTRADAS_MINIMAS}{' '}
            registros para tener tu línea de base. Hasta entonces la app no va a interpretar nada:
            con menos datos, cualquier lectura sería ruido con cara de señal.
          </p>
        )}
      </main>

      <div className="mt-8">
        <Accion deshabilitado={!completo || guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Listo'}
        </Accion>
        <AccionQuieta onClick={() => navegar('/', { replace: true })}>Hoy no</AccionQuieta>
      </div>
    </div>
  )
}
