/**
 * El alta.
 *
 * Es la pantalla que más gente perdía por no existir. Sin esto, todo el mundo
 * arrancaba en flexiones contra la pared: quien ya hace quince completas abría
 * la app, veía la pared, y no volvía nunca.
 *
 * Tres reglas que la ordenan:
 *
 * - **Se pregunta un dato objetivo, nunca una autoevaluación.** "¿Cuántas
 *   flexiones seguidas hacés?" tiene respuesta; "¿sos principiante?" no la
 *   tiene, porque nadie sabe contra qué compararse.
 * - **La personalización es de verdad, no actuada.** Muchas apps hacen cuarenta
 *   pantallas de preguntas para llegar a un plan que era el mismo desde el
 *   principio. Acá las cuatro respuestas entran en la misma aritmética que usa
 *   el motor, y el plan que sale después es literalmente el que se va a
 *   entrenar mañana.
 * - **Nada de cuenta, mail, pago ni permisos.** El costo de entrar es cero, y
 *   eso es una ventaja estructural que ninguna app con suscripción puede
 *   copiar.
 *
 * Tope duro: ocho pantallas. Un alta que crece "ya que estamos" es un alta que
 * deja de cumplir su función.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { POR_ID, NOMBRE_PATRON, cadenaDe } from '@/dominio/biblioteca'
import { proximoHitoDeCadena, proyectar, ubicarEnCadena } from '@/dominio/progresion'
import { RUTINAS } from '@/dominio/rutinas'
import type { Patron } from '@/dominio/tipos'
import { guardarPreferencias, ubicarDesdePrueba } from '@/datos/repositorio'
import { Boton, COLOR_PATRON, unidad } from '@/componentes/ui'

interface Prueba {
  patron: Patron
  /** El ejercicio con el que se mide, y contra el que se calibra la cadena. */
  ejercicioId: string
  pregunta: string
  ayuda: string
  /** Ejercicio alternativo para quien no tiene barra. */
  sinBarra?: string
}

const PRUEBAS: Prueba[] = [
  {
    patron: 'empuje',
    ejercicioId: 'flexion-completa',
    pregunta: '¿Cuántas flexiones completas hacés seguidas?',
    ayuda: 'Con el cuerpo derecho y bajando hasta que el pecho casi toque el piso. Si no llegás a ninguna, poné cero.',
  },
  {
    patron: 'traccion',
    ejercicioId: 'dominada-completa',
    sinBarra: 'remo-australiano-bajo',
    pregunta: '¿Cuántas dominadas hacés seguidas?',
    ayuda: 'Desde los brazos estirados hasta pasar la pera. Sin impulso de piernas.',
  },
  {
    patron: 'piernas',
    ejercicioId: 'sentadilla-completa',
    pregunta: '¿Cuántas sentadillas hacés seguidas?',
    ayuda: 'Bajando hasta que los muslos queden paralelos al piso, con los talones apoyados.',
  },
  {
    patron: 'core',
    ejercicioId: 'plancha',
    pregunta: '¿Cuántos segundos aguantás la plancha?',
    ayuda: 'Apoyado en los antebrazos, con el cuerpo en una línea. Se corta cuando la cadera se hunde.',
  },
]

type Paso = 'propuesta' | 'equipo' | 'pruebas' | 'plan' | 'dias'

export function Alta() {
  const navegar = useNavigate()
  const [paso, setPaso] = useState<Paso>('propuesta')
  const [tieneBarra, setTieneBarra] = useState(true)
  const [indice, setIndice] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<Patron, number>>({
    empuje: 0,
    traccion: 0,
    piernas: 0,
    core: 0,
  })
  const [guardando, setGuardando] = useState(false)

  function pruebaDe(p: Prueba): string {
    return !tieneBarra && p.sinBarra ? p.sinBarra : p.ejercicioId
  }

  const ubicaciones = PRUEBAS.map((p) => ({
    patron: p.patron,
    avance: ubicarEnCadena(
      cadenaDe(p.patron),
      POR_ID,
      pruebaDe(p),
      respuestas[p.patron],
      0,
    ),
  }))

  async function terminar(rutinaActivaId: string) {
    setGuardando(true)
    try {
      await ubicarDesdePrueba(
        PRUEBAS.map((p) => ({
          patron: p.patron,
          ejercicioId: pruebaDe(p),
          logrado: respuestas[p.patron],
        })),
      )
      await guardarPreferencias({
        rutinaActivaId,
        tieneBarra,
        altaCompletadaEn: Date.now(),
      })
      navegar('/', { replace: true })
    } finally {
      setGuardando(false)
    }
  }

  async function saltear() {
    setGuardando(true)
    try {
      await guardarPreferencias({ altaCompletadaEn: Date.now(), tieneBarra })
      navegar('/', { replace: true })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-10">
      {paso === 'propuesta' && (
        <Propuesta onSeguir={() => setPaso('equipo')} onSaltear={() => void saltear()} />
      )}

      {paso === 'equipo' && (
        <Equipo
          onElegir={(barra) => {
            setTieneBarra(barra)
            setPaso('pruebas')
          }}
        />
      )}

      {paso === 'pruebas' && (
        <Pruebas
          prueba={PRUEBAS[indice]!}
          ejercicioId={pruebaDe(PRUEBAS[indice]!)}
          numero={indice + 1}
          total={PRUEBAS.length}
          valor={respuestas[PRUEBAS[indice]!.patron]}
          onCambiar={(n) =>
            setRespuestas((r) => ({ ...r, [PRUEBAS[indice]!.patron]: Math.max(0, n) }))
          }
          onSeguir={() => {
            if (indice + 1 < PRUEBAS.length) setIndice(indice + 1)
            else setPaso('plan')
          }}
          onVolver={() => (indice === 0 ? setPaso('equipo') : setIndice(indice - 1))}
        />
      )}

      {paso === 'plan' && (
        <Plan ubicaciones={ubicaciones} onSeguir={() => setPaso('dias')} />
      )}

      {paso === 'dias' && <Dias guardando={guardando} onElegir={(id) => void terminar(id)} />}
    </div>
  )
}

function Propuesta({ onSeguir, onSaltear }: { onSeguir: () => void; onSaltear: () => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-acento)]">
          LyraFit
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight">
          La app decide qué te toca. Vos anotás lo que hiciste.
        </h1>
        <p className="mt-5 text-[var(--color-texto-suave)]">
          Cuatro cadenas de progresión, de la flexión en la pared a la flexión a una mano.
          Cada vez que entrenás, la regla que decide el próximo objetivo se te muestra
          escrita.
        </p>
        <p className="mt-4 text-[var(--color-texto-suave)]">
          Sin cuenta, sin suscripción y sin servidor: tus datos no salen de este teléfono.
        </p>
      </div>

      <div className="space-y-3">
        <Boton className="w-full py-4 text-base" onClick={onSeguir}>
          Empezar
        </Boton>
        <button
          onClick={onSaltear}
          className="w-full py-2 text-sm text-[var(--color-texto-suave)] underline underline-offset-4"
        >
          Prefiero arrancar desde cero
        </button>
      </div>
    </>
  )
}

function Equipo({ onElegir }: { onElegir: (tieneBarra: boolean) => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-3xl font-bold leading-tight tracking-tight">
          ¿Tenés dónde colgarte?
        </h1>
        <p className="mt-3 text-[var(--color-texto-suave)]">
          Una barra de dominadas, unas anillas, o una rama firme. Es lo único que cambia
          de verdad el plan: sin eso, la cadena de tracción arranca con remo bajo una mesa.
        </p>
      </div>

      <div className="space-y-3">
        <Boton className="w-full py-4 text-base" onClick={() => onElegir(true)}>
          Sí, tengo barra
        </Boton>
        <Boton
          variante="secundario"
          className="w-full py-4 text-base"
          onClick={() => onElegir(false)}
        >
          No, por ahora no
        </Boton>
      </div>
    </>
  )
}

function Pruebas({
  prueba,
  ejercicioId,
  numero,
  total,
  valor,
  onCambiar,
  onSeguir,
  onVolver,
}: {
  prueba: Prueba
  ejercicioId: string
  numero: number
  total: number
  valor: number
  onCambiar: (n: number) => void
  onSeguir: () => void
  onVolver: () => void
}) {
  const ejercicio = POR_ID.get(ejercicioId)!
  const color = COLOR_PATRON[prueba.patron]
  const paso = ejercicio.medida === 'segundos' ? 5 : 1

  return (
    <>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{
              backgroundColor: i < numero ? color : 'var(--color-superficie-alta)',
              opacity: i < numero - 1 ? 0.45 : 1,
            }}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
          {NOMBRE_PATRON[prueba.patron]}
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">
          {prueba.sinBarra && ejercicioId === prueba.sinBarra
            ? `¿Cuántos ${ejercicio.nombre.toLowerCase()} hacés seguidos?`
            : prueba.pregunta}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-texto-suave)]">{prueba.ayuda}</p>

        <div className="mt-10 flex items-center justify-center gap-6">
          <button
            onClick={() => onCambiar(valor - paso)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-superficie-alta)] text-2xl font-bold"
            aria-label="Restar"
          >
            −
          </button>
          <p className="cifra w-28 text-center text-6xl font-bold tabular-nums" style={{ color }}>
            {valor}
          </p>
          <button
            onClick={() => onCambiar(valor + paso)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-superficie-alta)] text-2xl font-bold"
            aria-label="Sumar"
          >
            +
          </button>
        </div>
        <p className="mt-3 text-center text-xs uppercase tracking-wide text-[var(--color-texto-suave)]">
          {ejercicio.medida === 'segundos' ? 'segundos' : 'repeticiones'}
        </p>
      </div>

      <div className="space-y-3">
        <Boton className="w-full py-4 text-base" onClick={onSeguir}>
          {numero === total ? 'Ver mi plan' : 'Siguiente'}
        </Boton>
        <button
          onClick={onVolver}
          className="w-full py-2 text-sm text-[var(--color-texto-suave)] underline underline-offset-4"
        >
          Volver
        </button>
      </div>
    </>
  )
}

function Plan({
  ubicaciones,
  onSeguir,
}: {
  ubicaciones: { patron: Patron; avance: ReturnType<typeof ubicarEnCadena> }[]
  onSeguir: () => void
}) {
  // La proyección se calcula con el mismo motor que va a decidir mañana, así
  // que no es una promesa de marketing: es aritmética sobre reglas públicas.
  //
  // Y se proyecta al PRÓXIMO eslabón, no al final de la cadena. El número al
  // final es igual de correcto y no se lo cree nadie: "flexión a una mano en
  // treinta y cinco sesiones" suena a mentira aunque sea el piso teórico
  // exacto, y una promesa que no se cree hace más daño que no dar ninguna. El
  // final de la cadena se nombra, que es lo que da la escala, pero sin cifra.
  const empuje = ubicaciones.find((u) => u.patron === 'empuje')
  const cadena = cadenaDe('empuje')
  const contexto = { cadena, ejercicios: POR_ID }
  const siguiente = empuje ? proximoHitoDeCadena(empuje.avance, cadena, POR_ID) : null
  const sesiones =
    empuje && siguiente ? proyectar(empuje.avance, contexto, siguiente.id) : null
  const meta = POR_ID.get(cadena.ejercicios[cadena.ejercicios.length - 1]!)!

  return (
    <>
      <div className="flex-1">
        <h1 className="text-3xl font-bold leading-tight tracking-tight">Tu punto de partida</h1>
        <p className="mt-3 text-sm text-[var(--color-texto-suave)]">
          Sale de lo que acabás de responder. Si algo quedó fácil o difícil, la app lo
          corrige sola en dos sesiones.
        </p>

        <ul className="mt-6 space-y-3">
          {ubicaciones.map(({ patron, avance }) => {
            const ejercicio = POR_ID.get(avance.ejercicioId)!
            const cadenaPatron = cadenaDe(patron)
            const posicion = cadenaPatron.ejercicios.indexOf(ejercicio.id) + 1
            const color = COLOR_PATRON[patron]

            return (
              <li key={patron} className="tarjeta flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
                    {NOMBRE_PATRON[patron]}
                  </p>
                  <p className="mt-1.5 font-semibold leading-tight">{ejercicio.nombre}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-texto-suave)]">
                    Eslabón {posicion} de {cadenaPatron.ejercicios.length}
                  </p>
                </div>
                <p className="cifra shrink-0 text-xl font-bold" style={{ color }}>
                  {avance.objetivoActual.series}×
                  {unidad(ejercicio.medida, avance.objetivoActual.cantidad)}
                </p>
              </li>
            )
          })}
        </ul>

        {sesiones !== null && siguiente && (
          <p className="mt-6 max-w-[42ch] text-sm leading-relaxed text-[var(--color-texto-suave)]">
            Tu próximo eslabón de empuje es{' '}
            <span className="font-semibold text-[var(--color-texto)]">{siguiente.nombre}</span>: unas{' '}
            <span className="cifra font-semibold text-[var(--color-texto)]">{sesiones}</span>{' '}
            sesiones si sale todo bien. Al final de esa cadena está {meta.nombre.toLowerCase()},
            y eso lleva años. La app no te va a apurar para llegar.
          </p>
        )}
      </div>

      <Boton className="mt-8 w-full py-4 text-base" onClick={onSeguir}>
        Seguir
      </Boton>
    </>
  )
}

function Dias({
  guardando,
  onElegir,
}: {
  guardando: boolean
  onElegir: (rutinaId: string) => void
}) {
  return (
    <>
      <div className="flex-1">
        <h1 className="text-3xl font-bold leading-tight tracking-tight">
          ¿Cuántos días por semana?
        </h1>
        <p className="mt-3 text-sm text-[var(--color-texto-suave)]">
          Elegí lo que vas a poder sostener en una semana mala, no en una buena. Se cambia
          cuando quieras.
        </p>

        <ul className="mt-6 space-y-3">
          {[...RUTINAS]
            .sort((a, b) => a.dias.length - b.dias.length)
            .map((rutina) => (
              <li key={rutina.id}>
                <button
                  onClick={() => onElegir(rutina.id)}
                  disabled={guardando}
                  className="tarjeta w-full p-4 text-left transition-colors hover:border-[var(--color-acento)] disabled:opacity-60"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{rutina.nombre}</span>
                    <span className="cifra shrink-0 text-sm text-[var(--color-texto-suave)]">
                      {rutina.dias.length} días
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-texto-suave)]">
                    {rutina.descripcion}
                  </p>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </>
  )
}
