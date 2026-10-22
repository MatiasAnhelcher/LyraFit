import { useEffect, useRef } from 'react'
import { Glifo, Rotulo } from '@/componentes/ui'
import { NOMBRE_PATRON } from '@/dominio/biblioteca'
import { lineaDeMolestia, type CambioPorMolestia } from '@/dominio/molestia'
import { haceCuanto } from '@/dominio/estadisticas'
import type { Medida, Patron, Serie as SerieHecha } from '@/dominio/tipos'
import { BotonComoSeHace } from './ComoSeHace'
import { MarcaDelPaso, NodosDeLaSerie } from './Nodos'
import type { PasoDelPlan } from './usePlanDeLaSesion'

/**
 * El ejercicio en curso: qué es, qué está en juego hoy y los nodos de sus
 * series.
 *
 * Es lo de arriba de la serie, del descanso y del ejercicio completo: lo que
 * cambia abajo es el momento, y esto se queda quieto en su lugar para que el
 * hilo no se pierda entre una pantalla y la otra. En el descanso va sin la
 * víspera, la molestia y "la vez pasada": el arco y la técnica necesitan ese
 * alto, y lo que dicen ya se leyó en la serie.
 */
export function ElEjercicio({
  paso,
  series,
  enCurso,
  avisos,
  pasoDeLaSerie,
  enDescanso,
  focoEnElTitulo,
  onComoSeHace,
}: {
  paso: PasoDelPlan
  /** Las series ya anotadas de este ejercicio. */
  series: SerieHecha[]
  /** Qué ejercicio del plan está en curso, empezando en cero. */
  enCurso: number
  /** Lo que la molestia de hoy le cambió a la sesión. */
  avisos: { patron: Patron; cambio: CambioPorMolestia }[]
  /** 1 mientras se predice la serie de ahora; 2 mientras se hace y se anota. */
  pasoDeLaSerie: 1 | 2
  enDescanso: boolean
  /** Si el título es el encabezado de este estado, adonde va el foco al llegar. */
  focoEnElTitulo: boolean
  onComoSeHace: () => void
}) {
  const { ejercicio, objetivo, antes, abre, porMolestia } = paso
  const salteadas = enCurso === 0 ? avisos.filter((aviso) => aviso.cambio === 'saltea') : []
  return (
    <>
      {/* El primer `main p.rotulo`, con el glifo de la cadena adelante. Lo
          buscan los portones por su `data-prueba` y no por ser el primero.
          Si no entra en un renglón —a 320, o con la letra grande— se corta
          en el punto y no adentro de "SERIE 2 DE 3", que partido no se lee. */}
      <div className="fila-patron">
        <p className="rotulo linea-patron" data-prueba="linea-patron">
          <Glifo patron={ejercicio.patron} />
          <span>
            <span className="whitespace-nowrap">{`${NOMBRE_PATRON[ejercicio.patron].toUpperCase()} ·`}</span>{' '}
            <span className="whitespace-nowrap">
              {`SERIE ${Math.min(series.length + 1, objetivo.series)} DE ${objetivo.series}`}
            </span>
          </span>
        </p>
        <BotonComoSeHace onAbrir={onComoSeHace} />
      </div>

      {/* El nombre entero va también en el `aria-label`: apretada la
          pantalla, el título se recorta a un renglón y el lector lo sigue
          diciendo completo. */}
      <h1
        className="titulo-ejercicio"
        data-prueba="titulo-ejercicio"
        aria-label={ejercicio.nombre}
        data-foco={focoEnElTitulo || undefined}
      >
        {ejercicio.nombre}
      </h1>

      {/* La víspera, adentro de la sesión: lo que está en juego hoy en esta
          cadena. Es una sola línea y aparece muy poco —solo cuando falta
          exactamente una sesión— porque una anticipación permanente deja de
          ser una anticipación. Y no dice "esta serie": el motor decide al
          cerrar la sesión, no al anotar una serie, y decirlo de otra forma
          sería prometer algo que la app no controla.

          Va en texto normal y no en rótulo: un rótulo en versalitas espaciadas
          es para dos palabras, y una frase entera ahí se lee como un segundo
          título gritándole al nombre del ejercicio. Tampoco va en `.glosa`:
          esta pantalla apaga la voz del motor a propósito, y eso es una
          decisión de diseño, no un descuido que haya que esquivar. */}
      {!enDescanso && abre && (
        <p className="linea-esfuerzo vispera">
          Si cerrás esta sesión, pasás a <span>{abre.nombre.toLowerCase()}</span>.
        </p>
      )}

      {/* La molestia, dicha donde cambia algo. La cadena bajada lo dice en
          su propio ejercicio; la salteada no tiene ejercicio donde decirlo,
          así que va en el primero, que es donde la persona está mirando
          cuando la sesión arranca. Una línea, con el motivo y sin retar:
          avisar fue lo correcto. Mismo tono que la víspera, por lo mismo. */}
      {!enDescanso && porMolestia && (
        <p className="linea-esfuerzo" data-prueba="linea-molestia">
          {lineaDeMolestia({ patron: ejercicio.patron, cambio: 'baja' })}
        </p>
      )}
      {!enDescanso &&
        salteadas.map((aviso) => (
          <p key={aviso.patron} className="linea-esfuerzo" data-prueba="linea-molestia">
            {lineaDeMolestia(aviso)}
          </p>
        ))}

      <NodosDeLaSerie
        total={objetivo.series}
        series={series}
        varas={antes?.logros}
        patron={ejercicio.patron}
        paso={pasoDeLaSerie}
      />

      {!enDescanso && antes && (
        <Rotulo className="vez-pasada">
          {antes.hace === 0 ? 'hoy, más temprano' : `la vez pasada, ${haceCuanto(antes.hace)}`}
        </Rotulo>
      )}
    </>
  )
}

/**
 * La serie: la pregunta del momento, el número con sus pasos y, si hay
 * barra, los kilos.
 *
 * La pregunta dice en qué momento estás. Antes decía "¿Cuántas te salen
 * ahora?" y abajo el botón decía "Anotar serie": la misma pantalla preguntaba
 * por lo que iba a pasar y guardaba lo que había pasado. De ahí salía el cero
 * eterno de la calibración. Son dos preguntas porque son dos momentos.
 */
export function Serie({
  tocaPredecir,
  predicho,
  medida,
  propuesto,
  salto,
  onCambiar,
  puedeCargar,
  kg,
  tope,
  pasoDeDisco,
  onPonerKg,
}: {
  /** Si es el momento de predecir: la primera serie del ejercicio, antes de hacerla. */
  tocaPredecir: boolean
  /** La predicción ya cerrada de esta serie, o null si no tiene. */
  predicho: number | null
  medida: Medida
  /** El número puesto: lo que se tocó, o el objetivo. */
  propuesto: number
  /** De a cuánto cambian los pasos: 1 repetición o 5 segundos. */
  salto: number
  onCambiar: (n: number) => void
  /** Si hay con qué cargar: el peso del cuerpo y una barra. */
  puedeCargar: boolean
  kg: number
  tope: number
  pasoDeDisco: number
  onPonerKg: (kg: number) => void
}) {
  // "Con discos" se va cuando aparecen los kilos, y el foco se iría con él
  // a `<body>`: pasa a "Más peso", que es lo que se toca después.
  const masPeso = useRef<HTMLButtonElement>(null)
  const pidioDiscos = useRef(false)
  useEffect(() => {
    if (kg > 0 && pidioDiscos.current) masPeso.current?.focus()
    pidioDiscos.current = false
  }, [kg])

  return (
    <section className="flex flex-col">
      <p className="pregunta-serie">
        {(tocaPredecir || predicho !== null) && <MarcaDelPaso paso={tocaPredecir ? 1 : 2} />}
        {tocaPredecir
          ? '¿Cuántas te salen ahora?'
          : predicho !== null
            ? '¿Cuántas hiciste?'
            : medida === 'segundos'
              ? 'Segundos de esta serie'
              : 'Repeticiones de esta serie'}
      </p>

      <div className="numero-serie" data-medir="numero">
        <button
          type="button"
          onClick={() => onCambiar(Math.max(0, propuesto - salto))}
          className="paso"
          aria-label="Restar"
        >
          −
        </button>
        <p className="cifra-esfuerzo" data-prueba="repeticiones">
          {propuesto}
        </p>
        <button type="button" onClick={() => onCambiar(propuesto + salto)} className="paso" aria-label="Sumar">
          +
        </button>
      </div>

      {/* Lo que dijiste, debajo de lo que hiciste: el número viene
          precargado con la predicción, así que acertar cuesta cero toques, y
          si lo corregís sigue a la vista con cuánto habías dicho. */}
      {!tocaPredecir && predicho !== null && <p className="dijiste">Dijiste {predicho}</p>}

      {/* Los discos. Cerrado por defecto: la inmensa mayoría de los
          ejercicios de esta app se hacen con el cuerpo y una fila de
          kilos en todos sería mobiliario.

          Los rótulos dicen "peso" y no "sumar" o "restar" a propósito:
          `rescate.mjs` busca los botones de repeticiones por nombre y
          sin `exact`, así que un aria-label con esas palabras le parte
          el portón por ambigüedad. */}
      {puedeCargar &&
        (kg > 0 ? (
          <div className="fila-kilos" data-medir="kilos">
            <button
              type="button"
              onClick={() => onPonerKg(Math.max(0, Number((kg - pasoDeDisco).toFixed(2))))}
              className="paso"
              aria-label="Menos peso"
            >
              −
            </button>
            <span className="kilos" data-prueba="kilos">
              {kg} kg
            </span>
            <button
              type="button"
              ref={masPeso}
              onClick={() => onPonerKg(Math.min(tope, Number((kg + pasoDeDisco).toFixed(2))))}
              className="paso"
              aria-label="Más peso"
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              pidioDiscos.current = true
              onPonerKg(pasoDeDisco)
            }}
            className="boton-contorno con-discos"
            data-medir="kilos"
          >
            Con discos
          </button>
        ))}
    </section>
  )
}
