import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NOMBRE_PATRON, POR_ID, buscarEjercicio, cadenaDe } from '@/dominio/biblioteca'
import { historicoDeEjercicio, recordDe } from '@/dominio/estadisticas'
import { proyectar, requisitoDicho } from '@/dominio/progresion'
import { eslabonesCerrados } from '@/dominio/apertura'
import { POSTURAS } from '@/dominio/posturas'
import { FiguraEjercicio } from '@/componentes/figura'
import { CuerpoDoble } from '@/componentes/cuerpo'
import { APORTE, NOMBRE_MUSCULO, PISO_DE_DOSIS, type Aporte, type Musculo } from '@/dominio/musculos'
import { fijarNivel, leerAvances, leerPreferencias, leerSesiones } from '@/datos/repositorio'
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
  const preferencias = useLiveQuery(leerPreferencias, [])

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

  if (!avances || !sesiones || !preferencias) return <Cargando filas={5} />

  const cadena = cadenaDe(ejercicio.patron)
  const posicion = cadena.ejercicios.indexOf(ejercicio.id)
  const avance = avances.get(ejercicio.patron)
  const esActual = avance?.ejercicioId === ejercicio.id
  const record = recordDe(sesiones, ejercicio.id)
  const historico = historicoDeEjercicio(sesiones, ejercicio.id)
  /**
   * El vector muscular, partido en primarios y secundarios.
   *
   * El corte es `PISO_DE_DOSIS`, el mismo 0,5 que usa el resto del dominio
   * para decidir qué cuenta como dosis de verdad. Los estabilizadores (0,25)
   * se dibujan —insinuados, a 0,17 de tinta— pero no se nombran: el propio
   * dominio declara que un 0,25 NO es una dosis, y listarlos haría parecer
   * que una plancha entrena diez músculos.
   */
  const vector = APORTE[ejercicio.id]
  const porAporte = vector
    ? (Object.entries(vector) as [Musculo, Aporte][]).sort((a, b) => b[1] - a[1])
    : []
  const primarios = porAporte.filter(([, a]) => a >= 1)
  const secundarios = porAporte.filter(([, a]) => a >= PISO_DE_DOSIS && a < 1)

  /*
   * ESTE EJERCICIO, ¿ES UN ESLABÓN?
   *
   * Los de la barra cargable no están en ninguna cadena, y sin esta pregunta
   * la ficha decía cuatro cosas falsas sobre ellos, porque `indexOf` devuelve
   * -1 y -1 se propaga como si fuera un lugar:
   *
   *   · «EMPUJE · 0 DE 11» — un lugar que no ocupa.
   *   · «Ya pasaste por acá: está 8 eslabones atrás» — de una cadena en la
   *     que no está.
   *   · «EN LA CADENA → DESPUÉS: flexiones en la pared» — porque
   *     `ejercicios[-1 + 1]` es el primero de todos.
   *   · Y el peor: «Empezar la cadena de empuje acá», que al tocarlo le
   *     escribe al avance de empuje un ejercicioId que no está en la cadena
   *     de empuje. Eso no es un texto raro: es la base corrompida, y la app
   *     se queda sin poder resolver el eslabón actual.
   *
   * Las cuatro salían del mismo -1 y se arreglan de una.
   */
  const esEslabon = posicion >= 0

  const anterior = posicion > 0 ? POR_ID.get(cadena.ejercicios[posicion - 1]!) : undefined
  const siguiente = esEslabon ? POR_ID.get(cadena.ejercicios[posicion + 1] ?? '') : undefined

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
   *
   * Y con los eslabones cerrados que mira el motor: si este no se abre
   * cumpliendo —sin barra, o la palanca frontal sin dominadas—, contar
   * sesiones hasta acá sería la misma promesa falsa.
   */
  const posicionActual = avance ? cadena.ejercicios.indexOf(avance.ejercicioId) : -1
  const eslabonesDeDistancia =
    esEslabon && posicionActual >= 0 ? posicion - posicionActual : null
  const cerrados = eslabonesCerrados(cadena, avances, preferencias.tieneBarra !== false)
  const sesionesHasta =
    avance && eslabonesDeDistancia === 1
      ? proyectar(avance, { cadena, ejercicios: POR_ID, cerrados }, ejercicio.id)
      : null
  /**
   * Y si está cerrado, qué lo abre. Es la pregunta con la que alguien entra a
   * la ficha de la palanca frontal: sin esto la ficha decía "un eslabón más
   * adelante" y nada más, y el motor, mientras tanto, decía que falta algo
   * que en ningún lado se veía. Es la misma frase que usa el motor.
   */
  const cierre =
    eslabonesDeDistancia !== null && eslabonesDeDistancia > 0
      ? cerrados.get(ejercicio.id)
      : undefined
  const queLoAbre =
    cierre?.motivo === 'requisito'
      ? `Se abre cuando llegues a ${requisitoDicho(cierre.requisito, cierre.minimo)}.`
      : cierre?.motivo === 'sin-barra'
        ? 'Se hace colgado: si conseguís una barra, marcalo en Ajustes.'
        : null

  return (
    <>
      <div className="flex items-center gap-2">
        <Glifo patron={ejercicio.patron} />
        <Rotulo>
          {NOMBRE_PATRON[ejercicio.patron].toUpperCase()}
          {esEslabon ? ` · ${posicion + 1} DE ${cadena.ejercicios.length}` : ' · CON BARRA'}
        </Rotulo>
      </div>
      <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">{ejercicio.nombre}</h1>
      {/* El dibujo va arriba de todo el texto, y no ilustrando la técnica más
          abajo. Es lo primero que contesta la pregunta con la que alguien entra
          acá —"¿qué forma tiene esto?"— y contestarla primero hace que los
          cuatro pasos de abajo se lean sobre algo, en vez de en el aire. */}
      {POSTURAS[ejercicio.id] && (
        <FiguraEjercicio figura={POSTURAS[ejercicio.id]!} className="mt-4" />
      )}

      <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
        {ejercicio.resumen}
      </p>
      {POSTURAS[ejercicio.id] && (
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[var(--color-tinta)]">
          {POSTURAS[ejercicio.id]!.gesto}
        </p>
      )}

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
          {queLoAbre && (
            <>
              {' '}
              <span className="text-[var(--color-tinta)]" data-prueba="que-lo-abre">
                {queLoAbre}
              </span>
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

      {/*
        EL MAPA MUSCULAR.

        Estuvo terminado y testeado durante semanas sin que lo importara
        ninguna pantalla, que es la forma más cara de no tener algo. Va acá
        porque es donde contesta la pregunta que de verdad se hace frente a un
        ejercicio nuevo: "¿esto para qué me sirve?".

        Las dos vistas juntas y no una: de frente no se ve el dorsal y de
        espaldas no se ve el pectoral, así que una sola vista hace que media
        biblioteca parezca no entrenar nada.
      */}
      {vector && (
        <section className="mt-8">
          <Rotulo>DÓNDE SE SIENTE</Rotulo>
          <div className="mt-3 flex items-start gap-5">
            <CuerpoDoble vector={vector} className="h-44 shrink-0" />
            <ul className="min-w-0 flex-1 pt-1">
              {primarios.map(([m]) => (
                <li key={m} className="nombre leading-relaxed">
                  {NOMBRE_MUSCULO[m]}
                </li>
              ))}
              {secundarios.length > 0 && (
                <li className="mt-2 text-sm leading-relaxed text-[var(--color-glosa)]">
                  {/* Los secundarios en glosa y en una sola línea: son parte
                      del dibujo a media tinta, y repetirlos en lista de igual
                      jerarquía borraría la diferencia que el dibujo hace. */}
                  y algo de {secundarios.map(([m]) => NOMBRE_MUSCULO[m].toLowerCase()).join(', ')}
                </li>
              )}
            </ul>
          </div>
        </section>
      )}

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

      {!esEslabon && (
        <section className="mt-8">
          <Rotulo>CÓMO SE PROGRESA ACÁ</Rotulo>
          <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-[var(--color-glosa)]">
            Este no es un eslabón de ninguna cadena, y no es un olvido: una
            cadena progresa por palanca —el mismo gesto con cada vez menos
            ayuda— y esto progresa por peso.{' '}
            <span className="text-[var(--color-tinta)]">
              Cuando llegás al techo de la ventana en todas las series, subís un
              disco y volvés al piso.
            </span>{' '}
            Es la misma doble progresión, con el peso en vez de la palanca.
          </p>
          <p className="mt-3 max-w-[42ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            La app te guarda los kilos y te los pone delante la próxima vez,
            pero acá no mueve nada sola: el que decide cuándo subir sos vos.
          </p>
        </section>
      )}

      {esEslabon && (
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
      )}

      {/* Y el botón de fijar el eslabón SOLO si es un eslabón. Con un ejercicio
          de barra escribiría en el avance del patrón un id que no está en su
          cadena, y a partir de ahí la app no puede resolver dónde estás: es
          corrupción de datos, no un texto raro. */}
      {!esActual && esEslabon && (
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
