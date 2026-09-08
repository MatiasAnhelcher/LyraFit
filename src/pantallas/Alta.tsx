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
 *
 * ## Los toques que costaba
 *
 * Cada respuesta se cargaba con un más y un menos de a uno. Veinticinco
 * sentadillas eran veinticinco toques, y eso pasaba en la primera pantalla que
 * ve alguien que todavía no le debe nada a la app. Ahora hay una regleta de
 * valores por prueba —números redondos elegidos a mano, no una escala
 * derivada— y el más y el menos quedan para ajustar. La respuesta típica pasó
 * de veinticinco toques a uno.
 *
 * ## Y por qué está en el mismo sistema que el resto
 *
 * Era la única pantalla que había quedado con el lenguaje viejo: tarjetas con
 * borde redondeado, botones flotantes, un color distinto por patrón usado como
 * relleno. O sea que lo primero que veía cualquiera era una app y lo segundo
 * era otra. Ahora usa el mismo registro reglado, el mismo glifo de patrón y la
 * misma barra de acción contra el canto que las otras seis pantallas.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { POR_ID, NOMBRE_PATRON, cadenaDe } from '@/dominio/biblioteca'
import { proximoHitoDeCadena, proyectar, ubicarEnCadena } from '@/dominio/progresion'
import { RUTINAS } from '@/dominio/rutinas'
import type { Patron } from '@/dominio/tipos'
import { guardarPreferencias, ubicarDesdePrueba } from '@/datos/repositorio'
import { Accion, AccionQuieta, Glifo, Rotulo, unidad } from '@/componentes/ui'

interface Prueba {
  patron: Patron
  /** El ejercicio con el que se mide, y contra el que se calibra la cadena. */
  ejercicioId: string
  pregunta: string
  ayuda: string
  /** Ejercicio alternativo para quien no tiene barra. */
  sinBarra?: string
  /**
   * La regleta: los valores que se ofrecen de un toque.
   *
   * Están escritos a mano y no derivados de la ventana del ejercicio, a
   * propósito. Son las respuestas reales que da la gente, y su forma es
   * distinta en cada prueba: casi nadie hace dominadas y mucha gente hace
   * cuarenta sentadillas. Una escala derivada sería más elegante y peor.
   *
   * El cero está siempre primero porque es una respuesta digna y frecuente, y
   * porque es la que más necesita que no cueste nada darla.
   */
  regleta: number[]
  /** El de la variante sin barra, que tiene otra escala. */
  regletaSinBarra?: number[]
}

const PRUEBAS: Prueba[] = [
  {
    patron: 'empuje',
    ejercicioId: 'flexion-completa',
    pregunta: '¿Cuántas flexiones completas hacés seguidas?',
    ayuda: 'Con el cuerpo derecho y bajando hasta que el pecho casi toque el piso. Si no llegás a ninguna, poné cero.',
    regleta: [0, 1, 3, 5, 8, 12, 20, 30],
  },
  {
    patron: 'traccion',
    ejercicioId: 'dominada-completa',
    sinBarra: 'remo-australiano-bajo',
    pregunta: '¿Cuántas dominadas hacés seguidas?',
    ayuda: 'Desde los brazos estirados hasta pasar la pera. Sin impulso de piernas.',
    regleta: [0, 1, 2, 3, 5, 8, 12],
    regletaSinBarra: [0, 3, 5, 8, 12, 20],
  },
  {
    patron: 'piernas',
    ejercicioId: 'sentadilla-completa',
    pregunta: '¿Cuántas sentadillas hacés seguidas?',
    ayuda: 'Bajando hasta que los muslos queden paralelos al piso, con los talones apoyados.',
    regleta: [0, 5, 10, 15, 25, 40, 60],
  },
  {
    patron: 'core',
    ejercicioId: 'plancha',
    pregunta: '¿Cuántos segundos aguantás la plancha?',
    ayuda: 'Apoyado en los antebrazos, con el cuerpo en una línea. Se corta cuando la cadera se hunde.',
    regleta: [0, 10, 20, 30, 45, 60, 90, 120],
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
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-10">
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
        <Rotulo>LYRAFIT</Rotulo>
        <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight">
          La app decide qué te toca. Vos anotás lo que hiciste.
        </h1>
        <p className="mt-5 leading-relaxed text-[var(--color-glosa)]">
          Cuatro cadenas de progresión, de la flexión en la pared a la flexión a una mano.
          Cada vez que entrenás, la regla que decide el próximo objetivo se te muestra
          escrita.
        </p>
        <p className="mt-4 leading-relaxed text-[var(--color-glosa)]">
          Sin cuenta, sin suscripción y sin servidor: tus datos no salen de este teléfono.
        </p>
      </div>

      <div className="mt-10 -mx-4">
        <Accion onClick={onSeguir}>Empezar</Accion>
        <AccionQuieta onClick={onSaltear}>Prefiero arrancar desde cero</AccionQuieta>
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
        <p className="mt-3 leading-relaxed text-[var(--color-glosa)]">
          Una barra de dominadas, unas anillas, o una rama firme. Es lo único que cambia
          de verdad el plan: sin eso, la cadena de tracción arranca con remo bajo una mesa.
        </p>
      </div>

      <div className="mt-10 -mx-4">
        <Accion onClick={() => onElegir(true)}>Sí, tengo barra</Accion>
        <AccionQuieta onClick={() => onElegir(false)}>No, por ahora no</AccionQuieta>
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
  const paso = ejercicio.medida === 'segundos' ? 5 : 1
  const regleta =
    prueba.sinBarra && ejercicioId === prueba.sinBarra && prueba.regletaSinBarra
      ? prueba.regletaSinBarra
      : prueba.regleta

  return (
    <>
      <div className="flex gap-px">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-0.5 flex-1"
            style={{
              backgroundColor: i < numero ? 'var(--color-vega)' : 'var(--color-regla)',
              opacity: i < numero - 1 ? 0.5 : 1,
            }}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <Rotulo>{NOMBRE_PATRON[prueba.patron].toUpperCase()}</Rotulo>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">
          {prueba.sinBarra && ejercicioId === prueba.sinBarra
            ? `¿Cuántos ${ejercicio.nombre.toLowerCase()} hacés seguidos?`
            : prueba.pregunta}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-glosa)]">{prueba.ayuda}</p>

        <p className="cifra mt-8 text-center text-6xl font-bold tabular-nums">
          {valor}
          {ejercicio.medida === 'segundos' && <span className="unidad">s</span>}
        </p>
        <p className="rotulo mt-2 text-center">
          {ejercicio.medida === 'segundos' ? 'segundos' : 'repeticiones'}
        </p>

        {/* La regleta.
            Antes esto era solo un más y un menos de a uno, y veinticinco
            sentadillas costaban veinticinco toques en la primera pantalla que
            alguien ve. Los valores están escritos a mano por prueba porque la
            forma de las respuestas es distinta en cada una: casi nadie hace
            dominadas y mucha gente hace cuarenta sentadillas.

            El más y el menos siguen estando, para el que hace veintitrés. */}
        <div
          className="mt-6 grid gap-px"
          style={{
            // Dos filas parejas, siempre. Con `flex-wrap` los que sobraban
            // quedaban centrados abajo como huérfanos y la regleta se leía
            // como un accidente en vez de como un teclado.
            gridTemplateColumns: `repeat(${Math.ceil(regleta.length / 2)}, minmax(0, 1fr))`,
          }}
        >
          {regleta.map((n) => (
            <button
              key={n}
              onClick={() => onCambiar(n)}
              className="cifra h-12 text-base tabular-nums"
              style={{
                border: '1px solid var(--color-regla)',
                backgroundColor: valor === n ? 'var(--color-vega)' : 'transparent',
                color: valor === n ? '#fff' : 'var(--color-glosa)',
              }}
              aria-pressed={valor === n}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => onCambiar(valor - paso)}
            className="cifra flex h-12 w-12 items-center justify-center text-xl"
            style={{ border: '1px solid var(--color-regla)' }}
            aria-label="Restar"
          >
            −
          </button>
          <button
            onClick={() => onCambiar(valor + paso)}
            className="cifra flex h-12 w-12 items-center justify-center text-xl"
            style={{ border: '1px solid var(--color-regla)' }}
            aria-label="Sumar"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-10 -mx-4">
        <Accion onClick={onSeguir}>{numero === total ? 'Ver mi plan' : 'Siguiente'}</Accion>
        <AccionQuieta onClick={onVolver}>Volver</AccionQuieta>
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
        <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
          Sale de lo que acabás de responder. Si algo quedó fácil o difícil, la app lo
          corrige sola en dos sesiones.
        </p>

        {/* La misma fila reglada que se va a ver en Hoy todos los días. Es a
            propósito: el plan que sale del alta no es una vista previa de otra
            cosa, es literalmente la pantalla de mañana. */}
        <div className="registro mt-6">
          {ubicaciones.map(({ patron, avance }) => {
            const ejercicio = POR_ID.get(avance.ejercicioId)!
            const cadenaPatron = cadenaDe(patron)
            const posicion = cadenaPatron.ejercicios.indexOf(ejercicio.id) + 1

            return (
              <div key={patron}>
                <span className="canal">
                  <Glifo patron={patron} />
                </span>
                <span className="min-w-0">
                  <span className="nombre block truncate">{ejercicio.nombre}</span>
                  <span className="rotulo mt-0.5 block">
                    {NOMBRE_PATRON[patron]} · {posicion}/{cadenaPatron.ejercicios.length}
                  </span>
                </span>
                <span className="cifra-fila">
                  {avance.objetivoActual.series}
                  <span className="por">×</span>
                  {unidad(ejercicio.medida, avance.objetivoActual.cantidad)}
                </span>
              </div>
            )
          })}
        </div>

        {sesiones !== null && siguiente && (
          <p className="mt-6 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            Tu próximo eslabón de empuje es{' '}
            <span className="font-semibold text-[var(--color-tinta)]">{siguiente.nombre}</span>: unas{' '}
            <span className="cifra font-semibold text-[var(--color-tinta)]">{sesiones}</span>{' '}
            sesiones si sale todo bien. Al final de esa cadena está {meta.nombre.toLowerCase()},
            y eso lleva años. La app no te va a apurar para llegar.
          </p>
        )}
      </div>

      <div className="mt-10 -mx-4">
        <Accion onClick={onSeguir}>Seguir</Accion>
      </div>
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
        <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
          Elegí lo que vas a poder sostener en una semana mala, no en una buena. Se cambia
          cuando quieras.
        </p>

        <div className="registro mt-6">
          {[...RUTINAS]
            .sort((a, b) => a.dias.length - b.dias.length)
            .map((rutina) => (
              <button
                key={rutina.id}
                onClick={() => onElegir(rutina.id)}
                disabled={guardando}
                className="fila-pulsable disabled:opacity-60"
              >
                <span className="canal">◇</span>
                <span className="min-w-0">
                  <span className="nombre block">{rutina.nombre}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-glosa)]">
                    {rutina.descripcion}
                  </span>
                </span>
                <span className="cifra-fila">{rutina.dias.length}</span>
              </button>
            ))}
        </div>
      </div>
    </>
  )
}
