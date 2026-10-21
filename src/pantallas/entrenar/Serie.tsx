import { NOMBRE_PATRON } from '@/dominio/biblioteca'
import { lineaDeMolestia, type CambioPorMolestia } from '@/dominio/molestia'
import { haceCuanto } from '@/dominio/estadisticas'
import type { Medida, Patron, Serie as SerieHecha } from '@/dominio/tipos'
import { Rotulo, nombreUnidad } from '@/componentes/ui'
import { BotonComoSeHace } from './ComoSeHace'
import type { PasoDelPlan } from './usePlanDeLaSesion'

/**
 * El ejercicio en curso: qué es, qué está en juego hoy y los casilleros de
 * sus series.
 *
 * Es lo de arriba de la serie, del descanso y del ejercicio completo: lo que
 * cambia abajo es el momento, y esto se queda quieto en su lugar para que el
 * hilo no se pierda entre una pantalla y la otra.
 */
export function ElEjercicio({
  paso,
  series,
  enCurso,
  avisos,
  onComoSeHace,
}: {
  paso: PasoDelPlan
  /** Las series ya anotadas de este ejercicio. */
  series: SerieHecha[]
  /** Qué ejercicio del plan está en curso, empezando en cero. */
  enCurso: number
  /** Lo que la molestia de hoy le cambió a la sesión. */
  avisos: { patron: Patron; cambio: CambioPorMolestia }[]
  onComoSeHace: () => void
}) {
  const { ejercicio, objetivo, antes, abre, porMolestia } = paso
  return (
    <>
      <Rotulo>
        {NOMBRE_PATRON[ejercicio.patron].toUpperCase()} · SERIE {Math.min(series.length + 1, objetivo.series)} DE{' '}
        {objetivo.series}
      </Rotulo>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h1
          className="text-3xl font-bold leading-tight tracking-tight"
          data-prueba="titulo-ejercicio"
        >
          {ejercicio.nombre}
        </h1>
        <BotonComoSeHace onAbrir={onComoSeHace} />
      </div>

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
      {abre && (
        <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-[var(--color-glosa)]">
          Si cerrás esta sesión, pasás a{' '}
          <span className="text-[var(--color-tinta)]">{abre.nombre.toLowerCase()}</span>.
        </p>
      )}

      {/* La molestia, dicha donde cambia algo. La cadena bajada lo dice en
          su propio ejercicio; la salteada no tiene ejercicio donde decirlo,
          así que va en el primero, que es donde la persona está mirando
          cuando la sesión arranca. Una línea, con el motivo y sin retar:
          avisar fue lo correcto. Mismo tono que la víspera, por lo mismo. */}
      {porMolestia && (
        <p
          className="mt-2 max-w-[34ch] text-sm leading-relaxed text-[var(--color-glosa)]"
          data-prueba="linea-molestia"
        >
          {lineaDeMolestia({ patron: ejercicio.patron, cambio: 'baja' })}
        </p>
      )}
      {enCurso === 0 &&
        avisos
          .filter((aviso) => aviso.cambio === 'saltea')
          .map((aviso) => (
            <p
              key={aviso.patron}
              className="mt-2 max-w-[34ch] text-sm leading-relaxed text-[var(--color-glosa)]"
              data-prueba="linea-molestia"
            >
              {lineaDeMolestia(aviso)}
            </p>
          ))}

      {/* Los casilleros, con la vara adentro.
          Un casillero vacío no dice nada; un casillero con el número de la
          vez pasada dice exactamente qué hay que hacer, y lo dice con un dato
          que puso la propia persona. Cuando la serie se anota, el número de
          hoy lo tapa: la comparación importa antes, no después. */}
      <ul className="mt-6 flex gap-2" aria-label="Series de este ejercicio">
        {Array.from({ length: objetivo.series }).map((_, i) => {
          const serie = series[i]
          const activa = i === series.length
          const vara = antes?.logros[i]
          return (
            <li
              key={i}
              className="cifra relative flex h-14 flex-1 items-center justify-center text-lg"
              style={{
                border: `1px ${activa && !serie ? 'dashed' : 'solid'} ${
                  serie || activa ? 'var(--color-vega)' : 'var(--color-regla)'
                }`,
                color: serie ? 'var(--color-tinta)' : 'var(--color-glosa)',
              }}
              aria-label={
                serie
                  ? `Serie ${i + 1}: ${serie.logrado}`
                  : vara !== undefined
                    ? `Serie ${i + 1}, sin hacer. La vez pasada: ${vara}`
                    : `Serie ${i + 1}, sin hacer`
              }
            >
              {serie ? serie.logrado : vara !== undefined ? <span className="vara">{vara}</span> : '·'}
            </li>
          )
        })}
      </ul>

      {antes && (
        <p className="rotulo mt-2 text-right">
          {antes.hace === 0 ? 'hoy, más temprano' : `la vez pasada, ${haceCuanto(antes.hace)}`}
        </p>
      )}
    </>
  )
}

/** La serie: cuántas, con los pasos para corregir el número y, si hay barra, los kilos. */
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
  hayAnotadas,
  onDeshacer,
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
  /** Si ya hay una serie de este ejercicio para deshacer. */
  hayAnotadas: boolean
  onDeshacer: () => void
}) {
  return (
    <section className="flex flex-1 flex-col justify-center pb-8">
      {/* La pregunta dice en qué momento estás.
          Antes decía "¿Cuántas te salen ahora?" y abajo el botón decía
          "Anotar serie": la misma pantalla preguntaba por lo que iba a
          pasar y guardaba lo que había pasado. De ahí salía el cero
          eterno de la calibración. Ahora son dos preguntas distintas
          porque son dos momentos distintos. */}
      <p className="text-center text-sm text-[var(--color-glosa)]">
        {tocaPredecir
          ? '¿Cuántas te salen ahora?'
          : predicho !== null
            ? '¿Cuántas hiciste?'
            : `${nombreUnidad(medida)} de esta serie`}
      </p>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          onClick={() => onCambiar(Math.max(0, propuesto - salto))}
          className="paso h-16 w-16 text-3xl"
          aria-label="Restar"
        >
          −
        </button>
        <p className="cifra w-32 text-center text-7xl" data-prueba="repeticiones">
          {propuesto}
        </p>
        <button
          onClick={() => onCambiar(propuesto + salto)}
          className="paso h-16 w-16 text-3xl"
          aria-label="Sumar"
        >
          +
        </button>
      </div>

      {/* Los discos. Cerrado por defecto: la inmensa mayoría de los
          ejercicios de esta app se hacen con el cuerpo y una fila de
          kilos en todos sería mobiliario.

          Los rótulos dicen "peso" y no "sumar" o "restar" a propósito:
          `rescate.mjs` busca los botones de repeticiones por nombre y
          sin `exact`, así que un aria-label con esas palabras le parte
          el portón por ambigüedad. Y el número va en `w-20` y no en
          `w-32` por lo mismo: el portón lee `main p.cifra.w-32` para
          sacar las repeticiones. */}
      {puedeCargar &&
        (kg > 0 ? (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => onPonerKg(Math.max(0, Number((kg - pasoDeDisco).toFixed(2))))}
              className="paso h-10 w-10"
              aria-label="Menos peso"
            >
              −
            </button>
            <span className="cifra w-20 text-center text-lg" data-prueba="kilos">
              {kg} kg
            </span>
            <button
              onClick={() => onPonerKg(Math.min(tope, Number((kg + pasoDeDisco).toFixed(2))))}
              className="paso h-10 w-10"
              aria-label="Más peso"
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={() => onPonerKg(pasoDeDisco)}
            className="rotulo mt-5 block w-full text-center underline underline-offset-4"
          >
            Con discos
          </button>
        ))}

      {hayAnotadas && (
        <button
          onClick={onDeshacer}
          className="mt-6 text-center text-sm text-[var(--color-glosa)] underline underline-offset-4"
        >
          Deshacer la última
        </button>
      )}
    </section>
  )
}
