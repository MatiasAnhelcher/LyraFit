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

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { POR_ID, NOMBRE_PATRON, cadenaDe } from '@/dominio/biblioteca'
import { proximoHitoDeCadena, proyectar } from '@/dominio/progresion'
import { ubicarDesdeElAlta, ultimoSinBarra } from '@/dominio/apertura'
import { RUTINAS } from '@/dominio/rutinas'
import type { Avance, Patron } from '@/dominio/tipos'
import { guardarPreferencias, saltearElAlta, ubicarDesdePrueba } from '@/datos/repositorio'
import { Accion, AccionQuieta, Glifo, MarcaRadio, Regleta, Rotulo, Segmento, unidad } from '@/componentes/ui'
import { usePasoConPasaje } from '@/componentes/movimiento'

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
    // Sin `sinBarra`, y no es un olvido: la plancha no cuelga, así que se hace
    // igual con barra o sin ella. Lo que tiene que mirar el equipo es la
    // UBICACIÓN, y eso lo hace el dominio: desde la plancha nunca se cae en un
    // eslabón colgado (`techoDeUbicacion`). Antes, 90 segundos te mandaban a
    // las elevaciones de piernas colgado aunque hubieras dicho que no tenías
    // barra.
    patron: 'core',
    ejercicioId: 'plancha',
    pregunta: '¿Cuántos segundos aguantás la plancha?',
    ayuda: 'Apoyado en los antebrazos, con el cuerpo en una línea. Se corta cuando la cadera se hunde.',
    regleta: [0, 10, 20, 30, 45, 60, 90, 120],
  },
]

type Paso = 'propuesta' | 'equipo' | 'pruebas' | 'plan' | 'dias'

/**
 * Lo que el alta tiene que decir al abrirse, una sola vez.
 *
 * Existe por "Borrar todos mis datos": la base vacía manda al alta en el acto,
 * así que el "Listo" no llegaba a verse en Ajustes. Es memoria de módulo y no
 * el `state` de la navegación porque la redirección del portero llega después
 * y se lo pisa — medido por `datos.mjs`—. Se escribe solo cuando el borrado
 * terminó bien.
 */
let avisoAlEntrar: string | null = null

export function avisarEnElAlta(texto: string): void {
  avisoAlEntrar = texto
}

export function Alta() {
  const navegar = useNavigate()
  // Se lee al montar y se olvida después, para que no vuelva a aparecer.
  const [aviso] = useState(() => avisoAlEntrar)
  useEffect(() => {
    avisoAlEntrar = null
  }, [])
  const [paso, setPaso] = useState<Paso>('propuesta')
  const [tieneBarra, setTieneBarra] = useState(true)
  const [indice, setIndice] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<Patron, number>>({
    empuje: 0,
    traccion: 0,
    piernas: 0,
    core: 0,
    // La bisagra no se prueba en el alta: el alta tiene un tope duro de ocho
    // pantallas escrito en su propio encabezado, y ya está en ocho. Además
    // arrancar el puente de glúteos desde el primer eslabón es lo correcto
    // para cualquiera — no hay nadie para quien sea demasiado fácil de una
    // forma que importe, y el final de esta cadena es el curl nórdico, donde
    // entrar de más es la única forma de lastimarse.
    bisagra: 0,
  })
  const [guardando, setGuardando] = useState(false)

  // Cada paso entra de costado, hacia adelante o hacia atrás, como pasar una
  // hoja. Los pasos no navegan —es una sola ruta—, así que el pasaje envuelve
  // el cambio de estado y no una navegación.
  const pasar = usePasoConPasaje()
  const adelante = (cambiar: () => void) => pasar('paso-adelante', cambiar)
  const atras = (cambiar: () => void) => pasar('paso-atras', cambiar)

  function pruebaDe(p: Prueba): string {
    return !tieneBarra && p.sinBarra ? p.sinBarra : p.ejercicioId
  }

  const pruebas = PRUEBAS.map((p) => ({
    patron: p.patron,
    ejercicioId: pruebaDe(p),
    logrado: respuestas[p.patron],
  }))

  // La misma cuenta que se guarda al terminar, con los mismos techos: el plan
  // que se muestra es el de mañana, no una vista previa de otra cosa.
  const ubicaciones = ubicarDesdeElAlta(pruebas, tieneBarra, 0).map((avance) => ({
    patron: avance.patron,
    avance,
  }))

  async function terminar(rutinaActivaId: string) {
    setGuardando(true)
    try {
      await ubicarDesdePrueba(pruebas, tieneBarra)
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
      await saltearElAlta(tieneBarra)
      navegar('/', { replace: true })
    } finally {
      setGuardando(false)
    }
  }

  // Las acciones van en cajas con borde y radio, no a sangre: abajo llevan el
  // mismo aire que el pie del cierre, 16 por encima del canto y del área
  // segura, para que la caja se vea entera y no cortada por el borde. Es el
  // `main` de la pantalla, como en las que tienen barra: es lo que el pasaje
  // de paso deja inerte mientras se mueve.
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      {paso === 'propuesta' && (
        <Propuesta
          aviso={aviso}
          onSeguir={() => adelante(() => setPaso('equipo'))}
          onSaltear={() => void saltear()}
        />
      )}

      {paso === 'equipo' && (
        <Equipo
          onElegir={(barra) =>
            adelante(() => {
              setTieneBarra(barra)
              setPaso('pruebas')
            })
          }
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
          onSeguir={() =>
            adelante(() => {
              if (indice + 1 < PRUEBAS.length) setIndice(indice + 1)
              else setPaso('plan')
            })
          }
          onVolver={() => atras(() => (indice === 0 ? setPaso('equipo') : setIndice(indice - 1)))}
        />
      )}

      {paso === 'plan' && (
        <Plan
          ubicaciones={ubicaciones}
          tieneBarra={tieneBarra}
          onSeguir={() => adelante(() => setPaso('dias'))}
        />
      )}

      {paso === 'dias' && <Dias guardando={guardando} onElegir={(id) => void terminar(id)} />}
    </main>
  )
}

function Propuesta({
  aviso,
  onSeguir,
  onSaltear,
}: {
  aviso: string | null
  onSeguir: () => void
  onSaltear: () => void
}) {
  return (
    <>
      <div className="flex flex-1 flex-col justify-center">
        {aviso && (
          <p
            className="mb-8 max-w-[40ch] text-sm leading-relaxed text-[var(--color-glosa)]"
            role="status"
          >
            {aviso}
          </p>
        )}
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

      <div className="mt-10 flex flex-col gap-3">
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
          de verdad el plan: sin eso, la cadena de tracción arranca con remo bajo una mesa
          y el plan no te pide nada colgado.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-3">
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

            El más y el menos siguen estando, para el que hace veintitrés.
            Siete u ocho valores no dan 48 por celda en una fila: van en dos
            filas parejas, que es lo que hace sola la regleta. */}
        <Regleta className="mt-6" etiqueta={ejercicio.medida === 'segundos' ? 'Segundos' : 'Repeticiones'}>
          {regleta.map((n) => (
            <Segmento key={n} elegido={valor === n} onClick={() => onCambiar(n)} cifra>
              {n}
            </Segmento>
          ))}
        </Regleta>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => onCambiar(valor - paso)}
            className="paso h-12 w-12 text-xl"
            aria-label="Restar"
          >
            −
          </button>
          <button
            onClick={() => onCambiar(valor + paso)}
            className="paso h-12 w-12 text-xl"
            aria-label="Sumar"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3">
        <Accion onClick={onSeguir}>{numero === total ? 'Ver mi plan' : 'Siguiente'}</Accion>
        <AccionQuieta onClick={onVolver}>Volver</AccionQuieta>
      </div>
    </>
  )
}

function Plan({
  ubicaciones,
  tieneBarra,
  onSeguir,
}: {
  ubicaciones: { patron: Patron; avance: Avance }[]
  tieneBarra: boolean
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

  // Sin barra, hasta dónde llega cada cadena que en algún momento cuelga. Es
  // la alternativa dicha en voz alta: el plan no se corta en silencio el día
  // que toca colgarse, se sabe desde hoy y se sabe cómo se abre.
  const hastaSinBarra = tieneBarra
    ? []
    : ubicaciones.flatMap(({ patron }) => {
        const tope = ultimoSinBarra(cadenaDe(patron))
        return tope ? [{ patron, tope }] : []
      })

  return (
    <>
      <div className="flex-1">
        <h1 className="text-3xl font-bold leading-tight tracking-tight">Tu punto de partida</h1>
        <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
          Sale de lo que acabás de responder. Si algo quedó fácil o difícil, la app lo
          corrige sola en un par de días de práctica.
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

        {hastaSinBarra.length > 0 && (
          <p className="mt-6 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            Sin barra,{' '}
            {hastaSinBarra.map(({ patron, tope }, i) => (
              <span key={patron}>
                {i === 0 ? '' : i === hastaSinBarra.length - 1 ? ' y ' : ', '}
                {NOMBRE_PATRON[patron].toLowerCase()} {i === 0 ? 'llega hasta' : 'hasta'}{' '}
                <span className="font-semibold text-[var(--color-tinta)]">{tope.nombre}</span>
              </span>
            ))}
            . Lo que sigue se hace colgado: si conseguís una barra, marcalo en Ajustes y{' '}
            {hastaSinBarra.length === 1 ? 'esa cadena sigue' : 'esas cadenas siguen'}.
          </p>
        )}

        {sesiones !== null && siguiente && (
          <p className="mt-6 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            Tu próximo eslabón de empuje es{' '}
            <span className="font-semibold text-[var(--color-tinta)]">{siguiente.nombre}</span>:{' '}
            {sesiones === 1 ? 'un' : 'unos'}{' '}
            <span className="cifra font-semibold text-[var(--color-tinta)]">{sesiones}</span>{' '}
            {sesiones === 1 ? 'día' : 'días'} de práctica si sale todo bien. Al final de esa
            cadena está {meta.nombre.toLowerCase()},
            y eso lleva años. La app no te va a apurar para llegar.
          </p>
        )}
      </div>

      <div className="mt-10">
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
          Elegí lo que puedas sostener en una semana mala, no en una buena. Se cambia cuando
          quieras.
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
                <span className="canal">
                  <MarcaRadio elegida={false} />
                </span>
                <span className="min-w-0">
                  <span className="nombre block">{rutina.nombre}</span>
                  <span className="mt-0.5 block texto-glosa">
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
