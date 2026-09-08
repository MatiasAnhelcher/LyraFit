import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NOMBRE_PATRON, POR_ID, buscarEjercicio, cadenaDe } from '@/dominio/biblioteca'
import { historicoDeEjercicio, recordDe } from '@/dominio/estadisticas'
import { proyectar } from '@/dominio/progresion'
import { fijarNivel, leerAvances, leerSesiones } from '@/datos/repositorio'
import { Accion, AccionQuieta, Cargando, Glifo, Objetivo, Rotulo, nombreUnidad } from '@/componentes/ui'

/**
 * La ficha de un ejercicio.
 *
 * La técnica y los errores comunes son el contenido más valioso de la app y el
 * más barato de mantener: resuelven la mayor parte del problema que las apps
 * con visión por computadora intentan resolver con años de trabajo y una
 * cámara apuntándote mientras hacés flexiones en el living.
 *
 * Y arriba de todo eso hay una sola línea que dice a qué distancia estás de
 * este ejercicio. Sin ella la biblioteca es un catálogo: treinta y nueve
 * ejercicios que existen, todos igual de lejos. Con ella es un mapa de tu
 * propio futuro, que es otra cosa y es la que engancha.
 */
export function FichaEjercicio() {
  const { id } = useParams()
  const ejercicio = id ? buscarEjercicio(id) : undefined
  const avances = useLiveQuery(leerAvances, [])
  const sesiones = useLiveQuery(() => leerSesiones(), [])

  if (!ejercicio) {
    return (
      <>
        <Rotulo>NO ENCONTRADO</Rotulo>
        <p className="mt-3 text-sm text-[var(--color-glosa)]">
          Ese ejercicio no está en la biblioteca.{' '}
          <Link to="/biblioteca" className="underline underline-offset-4">
            Volver
          </Link>
          .
        </p>
      </>
    )
  }

  if (!avances || !sesiones) return <Cargando filas={5} />

  const cadena = cadenaDe(ejercicio.patron)
  const posicion = cadena.ejercicios.indexOf(ejercicio.id)
  const avance = avances.get(ejercicio.patron)
  const esActual = avance?.ejercicioId === ejercicio.id
  const record = recordDe(sesiones, ejercicio.id)
  const historico = historicoDeEjercicio(sesiones, ejercicio.id)
  const anterior = posicion > 0 ? POR_ID.get(cadena.ejercicios[posicion - 1]!) : undefined
  const siguiente = POR_ID.get(cadena.ejercicios[posicion + 1] ?? '')

  /**
   * A qué distancia estás de este ejercicio.
   *
   * Las sesiones se cuentan SOLO para el eslabón que viene. Es la misma regla
   * que el alta ya había aprendido y que acá me volvió a morder: `proyectar`
   * corre el motor contra alguien que cumple siempre, así que desde flexiones
   * declinadas da dieciséis sesiones hasta la flexión a una mano. La cuenta es
   * exacta y la frase es una mentira — nadie hace ese camino en seis semanas—,
   * y una promesa que no se cree hace más daño que no dar ninguna.
   *
   * Para todo lo demás se cuenta en eslabones. Es igual de cierto, da la misma
   * sensación de escala y no le pide a nadie que le crea algo increíble.
   */
  const posicionActual = avance ? cadena.ejercicios.indexOf(avance.ejercicioId) : -1
  const eslabonesDeDistancia = posicionActual >= 0 ? posicion - posicionActual : null
  const sesionesHasta =
    avance && eslabonesDeDistancia === 1
      ? proyectar(avance, { cadena, ejercicios: POR_ID }, ejercicio.id)
      : null

  return (
    <>
      <div className="flex items-center gap-2">
        <Glifo patron={ejercicio.patron} />
        <Rotulo>
          {NOMBRE_PATRON[ejercicio.patron].toUpperCase()} · {posicion + 1} DE{' '}
          {cadena.ejercicios.length}
        </Rotulo>
      </div>
      <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">{ejercicio.nombre}</h1>
      <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
        {ejercicio.resumen}
      </p>

      {eslabonesDeDistancia !== null && !esActual && (
        <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
          {eslabonesDeDistancia < 0 ? (
            <>
              Ya pasaste por acá:{' '}
              <span className="text-[var(--color-tinta)]">
                {-eslabonesDeDistancia === 1
                  ? 'está un eslabón atrás'
                  : `está ${-eslabonesDeDistancia} eslabones atrás`}
              </span>
              .
            </>
          ) : sesionesHasta !== null ? (
            <>
              Estás a{' '}
              <span className="cifra text-[var(--color-tinta)]">{sesionesHasta}</span>{' '}
              {sesionesHasta === 1 ? 'sesión' : 'sesiones'} de acá, si sale todo bien. No es
              una promesa: es la misma cuenta que va a hacer el motor mañana.
            </>
          ) : (
            <>
              Está{' '}
              <span className="text-[var(--color-tinta)]">
                {eslabonesDeDistancia === 1
                  ? 'un eslabón'
                  : `${eslabonesDeDistancia} eslabones`}
              </span>{' '}
              más adelante en la cadena.
            </>
          )}
        </p>
      )}

      <div className="registro mt-6">
        <div>
          <span className="canal">↔</span>
          <span className="nombre">Ventana de trabajo</span>
          <span className="cifra-fila">
            {ejercicio.ventana.min}–{ejercicio.ventana.max}
            {ejercicio.medida === 'segundos' && <span className="unidad">s</span>}
          </span>
        </div>
        <div>
          <span className="canal">◇</span>
          <span className="nombre">Se domina con</span>
          <Objetivo
            series={ejercicio.series}
            cantidad={ejercicio.ventana.max}
            medida={ejercicio.medida}
          />
        </div>
        <div>
          <span className="canal">◷</span>
          <span className="nombre">Descanso entre series</span>
          <span className="cifra-fila">
            {ejercicio.descansoSegundos}
            <span className="unidad">s</span>
          </span>
        </div>
        {record > 0 && (
          <div>
            <span className="canal">★</span>
            <span className="min-w-0">
              <span className="nombre block">Tu mejor serie</span>
              <span className="rotulo mt-0.5 block">
                en {historico.length} {historico.length === 1 ? 'sesión' : 'sesiones'}
              </span>
            </span>
            <span className="cifra-fila">
              {record}
              {ejercicio.medida === 'segundos' && <span className="unidad">s</span>}
            </span>
          </div>
        )}
      </div>

      <section className="mt-8">
        <Rotulo>CÓMO SE HACE</Rotulo>
        <ol className="registro mt-3">
          {ejercicio.tecnica.map((paso, i) => (
            <li key={i}>
              <span className="canal">{i + 1}</span>
              <span className="text-sm leading-relaxed">{paso}</span>
              <span />
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <Rotulo>LO QUE SALE MAL</Rotulo>
        <ul className="registro mt-3">
          {ejercicio.erroresComunes.map((error, i) => (
            <li key={i}>
              <span className="canal">✕</span>
              <span className="text-sm leading-relaxed text-[var(--color-glosa)]">{error}</span>
              <span />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <Rotulo>EN LA CADENA</Rotulo>
        <div className="registro mt-3">
          {anterior && (
            <Link to={`/biblioteca/${anterior.id}`} className="fila-pulsable">
              <span className="canal">←</span>
              <span className="min-w-0">
                <span className="rotulo block">ANTES</span>
                <span className="nombre mt-0.5 block truncate">{anterior.nombre}</span>
              </span>
              <span />
            </Link>
          )}
          {siguiente && (
            <Link to={`/biblioteca/${siguiente.id}`} className="fila-pulsable">
              <span className="canal">→</span>
              <span className="min-w-0">
                <span className="rotulo block">DESPUÉS</span>
                <span className="nombre mt-0.5 block truncate">{siguiente.nombre}</span>
              </span>
              <span />
            </Link>
          )}
        </div>
      </section>

      {!esActual && (
        <div className="mt-8 -mx-4">
          <AccionQuieta onClick={() => void fijarNivel(ejercicio.patron, ejercicio.id)}>
            Empezar la cadena de {NOMBRE_PATRON[ejercicio.patron].toLowerCase()} acá
          </AccionQuieta>
          <p className="mt-3 px-4 text-xs leading-relaxed text-[var(--color-glosa)]">
            El motor decide solo, pero vos mandás. Si te ubicó en un ejercicio que no corresponde,
            corregilo desde acá: arranca en {ejercicio.ventana.min}{' '}
            {nombreUnidad(ejercicio.medida)} por serie.
          </p>
        </div>
      )}

      {esActual && (
        <div className="mt-8 -mx-4">
          <Accion className="pointer-events-none opacity-60">Estás acá</Accion>
        </div>
      )}
    </>
  )
}
