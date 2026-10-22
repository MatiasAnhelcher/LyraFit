/**
 * Progreso, como un tablero.
 *
 * Placas con cifras grandes y barras de completud que miden algo que el motor
 * usa de verdad. Las líneas que subían y bajaban se fueron (PB, 21/10/2026):
 * Matias las encontró feas, y tenía razón en algo más que el gusto — una línea
 * de cinco colores cruzándose no se lee de un vistazo, y una barra sí.
 *
 * La pieza que justifica la aritmética del motor sigue siendo la fuerza. El
 * registro crudo de repeticiones se desploma cada vez que se cambia de eslabón
 * —pasás de hacer quince a hacer seis— y muestra un retroceso justo en el
 * momento de mayor logro. El índice de carga lo resuelve porque hace
 * comparables dos ejercicios distintos, así que FUERZA POR SEMANA no se
 * desploma cuando subís a un eslabón que se mide igual: entre el techo del
 * viejo y la entrada al nuevo baja como mucho un 3,2 %, y en los primeros
 * saltos de cada cadena sube.
 * Es una estimación y la pantalla lo dice, igual que dice cuándo no traduce
 * bien.
 */

import { useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CADENAS, NOMBRE_PATRON, POR_ID, buscarEjercicio, cadenaDe } from '@/dominio/biblioteca'
import {
  curvaDeFuerza,
  fuerzaPorSemana,
  porSemana,
  totales,
  ultimasSemanas,
  type SemanaDeFuerza,
} from '@/dominio/estadisticas'
import {
  MUSCULOS_CUBIERTOS,
  NOMBRE_MUSCULO,
  SIN_COBERTURA,
  dichoSinDatos,
  loQueFalta,
  musculosAlcanzables,
  patronDe,
  seriesPorMusculo,
  type Aporte,
  type Musculo,
} from '@/dominio/musculos'
import { TINTA } from '@/dominio/anatomia'
import { CONSOLIDACION, indiceDeCarga } from '@/dominio/progresion'
import { eslabonesCerrados } from '@/dominio/apertura'
import { RUTINA_POR_ID, rutinaActiva } from '@/dominio/rutinas'
import { fechaISO, guardarPreferencias, leerPreferencias } from '@/datos/repositorio'
import { calibracion, vitalidad, type Calibracion, type Vitalidad } from '@/dominio/vitalidad'
import { lunesDe, sesionesDeVida } from '@/dominio/adherencia'
import { leerAvances, leerSesiones } from '@/datos/repositorio'
import type { Avance, Patron } from '@/dominio/tipos'
import { BarraDeCadena, LUZ } from '@/componentes/barraDeCadena'
import { enCadena, objetivoCorto, techoCorto, textoDeLaBarra } from '@/componentes/enCadena'
import { CuerpoDoble } from '@/componentes/cuerpo'
import { LinkConPasaje, movimientoReducido, orden } from '@/componentes/movimiento'
import { Cargando, Glifo, Rotulo, Simbolo, Tira, Vacio } from '@/componentes/ui'

const FORMATO_SEMANA = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })
const fechaCorta = (lunes: string) => FORMATO_SEMANA.format(new Date(`${lunes}T12:00:00`)).replace('.', '')

/** Las semanas que se dibujan: las últimas doce, o desde la primera sesión. */
const SEMANAS = 12

/** Alto de las columnas de FUERZA POR SEMANA y de SERIES POR SEMANA. */
const ALTO_FUERZA = 56
const ALTO_SERIES = 80

/** "0,71", "+0,8". En castellano la coma es decimal. */
function coma(n: number, decimales = 2): string {
  return n.toFixed(decimales).replace('.', ',')
}

/**
 * El tablero se enciende una vez por carga de la app. Es de módulo y no de
 * estado porque Progreso se desmonta al irse: la segunda visita del día no
 * anima, que es justamente lo que tiene que pasar.
 */
let yaSeEncendio = false

/**
 * Las medias series existen —un secundario aporta 0,5— y escribir "13,5" sería
 * una precisión que el dato no tiene. Se redondea, y el cero se muestra como
 * cero y no como una raya: que un músculo esté en cero es el dato.
 */
const redondo = (n: number) => String(Math.round(n))

/** "a", "a y b", "a, b y c". El castellano no lleva coma antes de la "y". */
function enLista(cosas: string[], union = 'y'): string {
  if (cosas.length <= 1) return cosas[0] ?? ''
  return `${cosas.slice(0, -1).join(', ')} ${union} ${cosas[cosas.length - 1]}`
}

/** Una oración empieza con mayúscula, aunque arranque con un nombre propio en minúscula. */
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

const medidaDe = (id: string) => POR_ID.get(id)?.medida
const enPalabras = (id: string) => (medidaDe(id) === 'segundos' ? 'segundos' : 'repeticiones')

/**
 * El rótulo de cada columna de SERIES. La de esta semana dice "esta"; la
 * primera y cada cuatro llevan la fecha, siempre que queden a dos columnas de
 * "esta" para no pisarse. Con una sola semana, su fecha.
 */
function rotuloDeSemana(j: number, semanas: string[]): string {
  const ultima = semanas.length - 1
  if (j === ultima) return ultima > 0 ? 'esta' : fechaCorta(semanas[j]!)
  if (j % 4 === 0 && ultima - j >= 2) return fechaCorta(semanas[j]!)
  return ''
}

/**
 * El rótulo de cada columna de FUERZA, que son más angostas que las de SERIES
 * (a 320 con la letra grande avanzan menos de 10 px): solo la primera fecha y
 * "esta". La fecha va recién desde la décima semana: con la más ancha, "30
 * sept", y a 320 con la letra al 125 %, ahí le quedan 10 px hasta "esta". Si
 * el eje es más angosto que eso, la esconde el CSS.
 */
function rotuloDeFuerza(j: number, semanas: string[]): string {
  const ultima = semanas.length - 1
  if (j === ultima) return ultima > 0 ? 'esta' : fechaCorta(semanas[j]!)
  if (j === 0 && ultima >= 9) return fechaCorta(semanas[0]!)
  return ''
}

// ─── TUS CADENAS ─────────────────────────────────────────────────────────

/**
 * `consolida` dice si el motor está contando sesiones en el techo. No lo hace
 * cuando el eslabón que sigue está cerrado —sin barra, o con un requisito sin
 * cumplir—: ahí suma repeticiones arriba del techo, y "2 de 2" anunciaría un
 * cambio que no va a pasar. En el último eslabón sí consolida.
 *
 * Las sesiones que hacen falta son dos, o más si queda gracia: después de un
 * retroceso, o cuando el eslabón nuevo arranca en su techo, el motor sostiene
 * mientras haya gracia aunque ya lleves dos. Cada sesión sostenida suma una y
 * gasta una de gracia, así que la cuenta no se mueve mientras falten. Cuando
 * ya no falta ninguna dice "listo" y deja de contar: el motor puede seguir
 * sosteniendo por un día flojo o por el ánimo, y "5 de 5" diría que hacían
 * falta cinco.
 */
function FilaDeCadena({ avance, k, consolida }: { avance: Avance; k: number; consolida: boolean }) {
  const e = enCadena(avance)
  const sostenidas = avance.sesionesEnObjetivo
  const faltan = Math.max(avance.graciaRestante, CONSOLIDACION - sostenidas, 0)
  const listo = faltan === 0
  const requeridas = listo ? CONSOLIDACION : sostenidas + faltan
  const nombre = NOMBRE_PATRON[avance.patron]
  const pips = e.enTecho && consolida
  const sostenido = listo ? ', techo sostenido' : `, sostenido ${sostenidas} de ${requeridas}`
  const etiqueta = `${textoDeLaBarra(e)}${pips ? sostenido : ''}`

  return (
    <LinkConPasaje
      a={`/biblioteca/${avance.ejercicioId}`}
      direccion="profundo"
      className="fila-cadena fila-pulsable"
      aria-label={etiqueta}
    >
      <div className="fila-cadena-cabeza">
        <Glifo patron={avance.patron} />
        <span className="nombre">{e.ejercicio?.nombre ?? '—'}</span>
        <span className="cuenta-cadena">
          <b>{e.indice + 1}</b> de {e.total}
        </span>
      </div>
      <BarraDeCadena posicion={e} orden={k} />
      <div className="fila-cadena-pie">
        <span className="rotulo">
          {nombre} · {objetivoCorto(e)} · {e.enTecho ? 'en el techo' : `techo ${techoCorto(e)}`}
        </span>
        {pips && (
          <span className="pips" style={{ '--luz': LUZ[avance.patron] } as CSSProperties}>
            <span aria-hidden>
              {Array.from({ length: requeridas }, (_, i) => (
                <i key={i} className={listo || i < sostenidas ? 'lleno' : ''} />
              ))}
            </span>
            <span className="rotulo">
              {listo ? 'listo' : `${sostenidas} de ${requeridas}`}
            </span>
          </span>
        )}
      </div>
    </LinkConPasaje>
  )
}

// ─── FUERZA POR SEMANA ───────────────────────────────────────────────────

/** Si la columna lleva la raya de cambio de eslabón, y de qué tipo. */
function cambioDe(s: SemanaDeFuerza): 'medida' | 'eslabon' | undefined {
  if (!s.cambio) return undefined
  return medidaDe(s.cambio.de) !== medidaDe(s.cambio.a) ? 'medida' : 'eslabon'
}

/**
 * Sin columnas: "todavía" solo si la cadena no tiene ninguna marca. Si la tiene
 * fuera de estas semanas —antes, o con el reloj del teléfono adelantado—,
 * decir "todavía" sería borrarle esa historia. Se dice "columnas" y no
 * "series" porque la bajada y el reloj son series que acá no cuentan.
 */
const sinSemanas = (entrenada: boolean, cuantas: number) =>
  entrenada ? `Sin columnas ${cuantas === 1 ? 'esta semana' : `en estas ${cuantas} semanas`}` : 'Todavía sin columnas'

/** Lo que dice cada fila, con palabras, para el lector de pantalla. */
function lecturaDeFuerza(
  patron: Patron,
  semanas: (SemanaDeFuerza | null)[],
  desdeElInicio: boolean,
  entrenada: boolean,
): string {
  const nombre = NOMBRE_PATRON[patron]
  const hay = semanas.flatMap((s) => (s ? [s] : []))
  if (hay.length === 0) return `${nombre}: ${sinSemanas(entrenada, semanas.length).toLowerCase()}.`
  const primera = hay[0]!
  const ultima = hay[hay.length - 1]!
  if (hay.length === 1) {
    return `${nombre}, fuerza por semana: ${coma(primera.carga)} la semana del ${fechaCorta(primera.semana)}${desdeElInicio ? ', tu primera' : ''}.`
  }
  const cambio = Math.round((ultima.carga / primera.carga - 1) * 100)
  const eslabones = hay.flatMap((s) => {
    const tipo = cambioDe(s)
    if (!tipo) return []
    return [`cambio de eslabón la semana del ${fechaCorta(s.semana)}${tipo === 'medida' ? ', a uno que se mide distinto' : ''}`]
  })
  return `${nombre}, fuerza por semana: de ${coma(primera.carga)} la semana del ${fechaCorta(primera.semana)} a ${coma(ultima.carga)} la del ${fechaCorta(ultima.semana)}, ${cambio >= 0 ? `${cambio} % más` : `${-cambio} % menos`}${eslabones.length ? `; ${eslabones.join('; ')}` : ''}.`
}

/**
 * `desdeElInicio` dice si la primera semana del eje es la primera de la
 * persona. Si entrena hace más de doce semanas no lo es, y la base gris es la
 * primera semana que se ve, no "tu primera semana".
 */
function FilaDeFuerza({
  patron,
  semanas,
  k,
  desdeElInicio,
  entrenada,
}: {
  patron: Patron
  semanas: (SemanaDeFuerza | null)[]
  k: number
  desdeElInicio: boolean
  entrenada: boolean
}) {
  const hay = semanas.flatMap((s) => (s ? [s] : []))
  const primera = hay[0]
  const ultima = hay[hay.length - 1]
  const techo = Math.max(...hay.map((s) => s.carga), 0)

  const columnas = Array.from({ length: Math.max(SEMANAS, semanas.length) }, (_, j) => {
    const s = semanas[j]
    if (!s || !primera) return <span key={j} className="fuerza-col" style={{ '--k': j } as CSSProperties} />
    const alto = (s.carga / techo) * ALTO_FUERZA
    const base = (Math.min(s.carga, primera.carga) / techo) * ALTO_FUERZA
    const sobre = alto - base - 1.5
    return (
      <span key={j} className="fuerza-col" data-cambio={cambioDe(s)} style={{ '--k': j } as CSSProperties}>
        {sobre > 0.5 && <span className="fuerza-sobre" style={{ height: `${sobre.toFixed(1)}px` }} />}
        <span className="fuerza-base" style={{ height: `${base.toFixed(1)}px` }} />
      </span>
    )
  })

  const cambio = primera && ultima ? Math.round((ultima.carga / primera.carga - 1) * 100) : 0

  return (
    <div
      className="fila-fuerza"
      style={{ '--luz': LUZ[patron], '--orden': k } as CSSProperties}
      role="img"
      aria-label={lecturaDeFuerza(patron, semanas, desdeElInicio, entrenada)}
    >
      <div>
        <p className="rotulo">
          <Glifo patron={patron} />
          {NOMBRE_PATRON[patron]}
        </p>
        {!primera || !ultima ? (
          <p className="texto-chico fuerza-desde mt-2.5">{sinSemanas(entrenada, semanas.length)}</p>
        ) : hay.length === 1 ? (
          <>
            <p className="fuerza-valor">{coma(ultima.carga)}</p>
            <p className="texto-chico fuerza-desde">{desdeElInicio ? 'tu primera semana' : 'una semana'}</p>
          </>
        ) : (
          <>
            <p className="fuerza-valor">
              {cambio > 0 ? '+' : cambio < 0 ? '−' : ''}
              {Math.abs(cambio)}
              <span className="unidad">%</span>
            </p>
            <p className="texto-chico fuerza-desde">
              {coma(primera.carga)} <Simbolo nombre="flecha-der" /> {coma(ultima.carga)}
            </p>
          </>
        )}
      </div>
      <div className="fuerza-columnas" aria-hidden>
        {columnas}
      </div>
    </div>
  )
}

/**
 * Las notas debajo de FUERZA POR SEMANA. Cada una tiene que ser verdad en el
 * código, y por eso cada una dice de dónde sale y se muestra solo cuando su
 * condición se cumple en los datos.
 */
function notasDeFuerza(
  filas: { patron: Patron; semanas: (SemanaDeFuerza | null)[] }[],
  avances: Avance[],
): string[] {
  const notas: string[] = []

  for (const { patron, semanas } of filas) {
    const cadena = NOMBRE_PATRON[patron].toLowerCase()
    const hay = semanas.flatMap((s) => (s ? [s] : []))
    let discosDichos = false
    hay.forEach((s) => {
      // Un eslabón que se mide distinto. `fraccionDelMaximo` satura en doce
      // segundos o menos, así que de repeticiones a segundos esta escala no
      // traduce bien: hay saltos en los que ni el techo del eslabón nuevo
      // llega a la última marca del viejo. Solo en esos se dice.
      const nuevo = s.cambio && POR_ID.get(s.cambio.a)
      if (s.cambio && nuevo && cambioDe(s) === 'medida' && indiceDeCarga(nuevo, nuevo.ventana.max) < s.cambio.cargaAntes) {
        notas.push(
          `En ${cadena}, la semana del ${fechaCorta(s.semana)} pasaste a un eslabón que se mide en ${enPalabras(s.cambio.a)}. Esta escala no traduce bien ${enPalabras(s.cambio.de)} a ${enPalabras(s.cambio.a)}: ni el techo de ese eslabón llega a tu marca anterior, así que la columna puede quedar más abajo aunque no hayas perdido fuerza.`,
        )
      }

      // Los discos. En el último eslabón el motor los suma y te devuelve a
      // pocas repeticiones, y en esta escala muchas sin peso pueden contar más
      // que pocas con discos. Se dice el día en que entraron, y solo si ese
      // día quedó por debajo de tu última marca sin peso. Una vez por cadena:
      // si sacaste y volviste a poner, la explicación es la misma.
      if (!discosDichos && s.discos && s.discos.carga < s.discos.cargaAntes) {
        discosDichos = true
        notas.push(
          `En ${cadena}, el ${fechaCorta(s.discos.desde)} sumaste discos y bajaste de ${enPalabras(s.discos.ejercicioId)}. En esta escala, tu serie sin peso de antes cuenta más que la primera con discos, así que la columna puede bajar aunque no hayas perdido fuerza.`,
        )
      }
    })
  }

  // `fraccionDelMaximo` satura Brzycki en doce repeticiones: arriba de eso el
  // índice no sube, aunque sumes. Se dice para quien hoy entrena ahí, y solo
  // de las cadenas que tienen alguna columna: de una que no entrenaste no hay
  // nada que explicar.
  const conColumnas = new Set(filas.filter((f) => f.semanas.some(Boolean)).map((f) => f.patron))
  const planas = avances
    .filter((a) => conColumnas.has(a.patron) && medidaDe(a.ejercicioId) === 'repeticiones' && a.objetivoActual.cantidad > 12)
    .map((a) => NOMBRE_PATRON[a.patron].toLowerCase())
  if (planas.length > 0) {
    const varias = planas.length > 1
    notas.push(
      `${mayuscula(enLista(planas))} ${varias ? 'trabajan' : 'trabaja'} arriba de 12 repeticiones, donde esta escala deja de subir: lo que ${varias ? 'avanzaron' : 'avanzó'} está en Tus cadenas.`,
    )
  }
  return notas
}

// ─── LO QUE TE DEJA ENTRENAR ─────────────────────────────────────────────

function Baldosas({ vit, cal }: { vit: Vitalidad | null; cal: Calibracion | null }) {
  return (
    <div className="baldosas">
      {vit && (
        <div className="placa baldosa">
          <p className="rotulo">Energía</p>
          <p className="baldosa-valor">
            {vit.delta > 0 ? '+' : vit.delta < 0 ? '−' : ''}
            {coma(Math.abs(vit.delta), 1)}
          </p>
          <p className="texto-chico">
            de antes a después de la primera sesión del día, en{' '}
            {vit.dias === 1 ? 'tu último día' : `tus últimos ${vit.dias} días`} con chequeo y
            energía al terminarla
          </p>
          <div className="puntos-energia" aria-hidden>
            {vit.serie.map((d, i) => (
              <i key={i} className={d > 0 ? 'subio' : ''} />
            ))}
          </div>
          <p className="texto-chico mt-2">
            Subió en {vit.subieron} de {vit.dias} {vit.dias === 1 ? 'día' : 'días'}
          </p>
        </div>
      )}
      {cal && (
        <div className="placa baldosa">
          <p className="rotulo">Te conocés</p>
          <p className="baldosa-valor">
            {coma(cal.error, 1)}
            <span className="unidad">reps</span>
          </p>
          <p className="texto-chico">de error al predecir, últimas {cal.series} series</p>
          <p className="texto-chico mt-auto pt-2.5">
            {Math.abs(cal.sesgo) < 0.3
              ? 'No tirás ni para arriba ni para abajo.'
              : cal.sesgo > 0
                ? `Tendés a subestimarte (+${coma(cal.sesgo, 1)}).`
                : `Tendés a sobrestimarte (−${coma(Math.abs(cal.sesgo), 1)}).`}
            {cal.tendencia !== null &&
              ` Venís errando ${coma(Math.abs(cal.tendencia), 1)} ${cal.tendencia < 0 ? 'menos' : 'más'} que en las ${cal.series} anteriores.`}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── La pantalla ─────────────────────────────────────────────────────────

export function Progreso() {
  const sesiones = useLiveQuery(() => leerSesiones(), [])
  const avances = useLiveQuery(leerAvances, [])
  const preferencias = useLiveQuery(leerPreferencias, [])
  const [enciende] = useState(() => {
    if (yaSeEncendio || movimientoReducido()) return false
    yaSeEncendio = true
    return true
  })

  if (!sesiones || !avances || !preferencias) return <Cargando filas={5} />

  const resumen = totales(sesiones)
  const cal = calibracion(sesiones)
  const vit = vitalidad(sesiones)
  const total = sesionesDeVida(sesiones)
  const hoy = fechaISO()

  // Las semanas del eje, compartidas por FUERZA y SERIES: las mismas columnas
  // caen en las mismas fechas en las dos placas.
  const primera = sesiones.reduce<string | undefined>((min, s) => (!min || s.fecha < min ? s.fecha : min), undefined)
  const semanas = ultimasSemanas(hoy, SEMANAS, primera)
  const desdeElInicio = !primera || lunesDe(primera) >= semanas[0]!
  // Con el peso corporal cargado, los discos cuentan en la escala.
  const peso = preferencias.pesoCorporalKg
  const fuerza = CADENAS.map((c) => ({
    patron: c.patron,
    semanas: fuerzaPorSemana(sesiones, c.patron, semanas, peso),
    entrenada: curvaDeFuerza(sesiones, c.patron, peso).length > 0,
  }))
  const listaDeAvances = [...avances.values()]
  const notas = notasDeFuerza(fuerza, listaDeAvances)
  const tieneBarra = preferencias.tieneBarra !== false
  const consolida = (a: Avance) => {
    const cadena = cadenaDe(a.patron)
    const siguiente = cadena.ejercicios[cadena.ejercicios.indexOf(a.ejercicioId) + 1]
    return !siguiente || !eslabonesCerrados(cadena, avances, tieneBarra).has(siguiente)
  }

  const resumenes = new Map(porSemana(sesiones).map((s) => [s.semana, s]))
  const series = semanas.map((semana) => resumenes.get(semana) ?? { semana, sesiones: 0, series: 0, minutos: 0 })
  const estaSemana = series[series.length - 1]!
  const techoSeries = Math.max(1, ...series.map((s) => s.series))

  // El mapa muscular. Se ordena de más a menos y la barra se normaliza al
  // máximo de la propia lista: lo que se compara es un músculo contra los
  // otros, no contra un objetivo inventado.
  const porMusculo = seriesPorMusculo(sesiones, hoy)
  const ranking = MUSCULOS_CUBIERTOS.map((musculo) => ({
    musculo,
    series: porMusculo.get(musculo) ?? 0,
  })).sort((a, b) => b.series - a.series)
  const techo = Math.max(...ranking.map((r) => r.series), 0)

  /**
   * El mismo ranking, pero como cuerpo pintado.
   *
   * La lista dice cuánto recibió cada músculo y es exacta; el dibujo dice
   * DÓNDE, que es la pregunta que uno se hace primero y que una lista de
   * dieciocho renglones no contesta nunca. Las dos juntas y no una: el dibujo
   * sin la lista sería decorativo y la lista sin el dibujo obliga a saber
   * dónde queda el serrato.
   *
   * La escala es relativa al techo de la propia persona y no a un número
   * absoluto, porque no existe tal número. Los tres cortes son los mismos tres
   * de `Aporte`, así que el dibujo usa la misma escala de tinta que la ficha
   * de ejercicio.
   */
  const mapa: Partial<Record<Musculo, Aporte>> = {}
  if (techo > 0) {
    for (const { musculo, series: s } of ranking) {
      if (s <= 0) continue
      const parte = s / techo
      mapa[musculo] = parte >= 0.66 ? 1 : parte >= 0.33 ? 0.5 : 0.25
    }
  }

  /**
   * Los músculos que están en cero por falta de EQUIPO, no por cómo entrena.
   * Un músculo en cero porque la persona no lo entrena es un consejo; uno en
   * cero porque el único ejercicio que lo carga necesita una barra con discos
   * es información sobre la app, y reclamárselo sería el peor consejo que esta
   * pantalla puede dar.
   */
  const alcanzables = musculosAlcanzables(
    preferencias.tieneBarra !== false,
    (preferencias.cargaMaximaKg ?? 0) > 0,
  )
  const sinBarraCargable = MUSCULOS_CUBIERTOS.filter((m) => !alcanzables.has(m))
  const falta = loQueFalta({
    sesiones,
    hoy,
    rutina: rutinaActiva(preferencias),
    tieneBarra: preferencias.tieneBarra !== false,
    tieneBarraCargable: (preferencias.cargaMaximaKg ?? 0) > 0,
  })

  if (sesiones.length === 0) {
    return (
      <>
        <Rotulo>PROGRESO</Rotulo>
        <Vacio
          titulo="Todavía no hay nada que mostrar"
          texto="Después de la primera sesión vas a ver acá dónde estás en cada cadena y cuánta fuerza movés, semana a semana."
        />
      </>
    )
  }

  return (
    <div className={enciende ? 'enciende' : undefined}>
      <Rotulo>PROGRESO</Rotulo>

      {/* El acumulador. Solo sube: es lo que la racha no puede ser. */}
      <section className="placa acumulador entrar-en-orden mt-6" style={orden(0)}>
        <div className="acumulador-grilla">
          <div>
            <p className="cifra-tablero">{total}</p>
            <p className="rotulo">{total === 1 ? 'Sesión' : 'Sesiones'}</p>
          </div>
          <div className="acumulador-cifras">
            <div>
              <p className="cifra-kpi">{resumen.series}</p>
              <p className="rotulo">Series</p>
            </div>
            <div>
              <p className="cifra-kpi">
                {resumen.minutos}
                <span className="unidad">min</span>
              </p>
              <p className="rotulo">Entrenando</p>
            </div>
          </div>
        </div>
        <Tira cantidad={total} />
      </section>

      <section className="entrar-en-orden mt-10" style={orden(1)} aria-labelledby="tus-cadenas">
        <p className="rotulo seccion-titulo" id="tus-cadenas">
          Tus cadenas
        </p>
        <div className="placa">
          {listaDeAvances.map((a, k) => (
            <FilaDeCadena key={a.patron} avance={a} k={k} consolida={consolida(a)} />
          ))}
        </div>
      </section>

      <section className="entrar-en-orden mt-10" style={orden(2)} aria-labelledby="fuerza-por-semana">
        <p className="rotulo seccion-titulo" id="fuerza-por-semana">
          Fuerza por semana
        </p>
        <p className="texto-glosa -mt-1 mb-3 max-w-[42ch]">
          Tu mejor serie de cada semana, en una escala que compara ejercicios distintos: por eso no se
          desploma cuando subís a un eslabón que se mide igual. Es una estimación, no una medición.
        </p>
        <div className="placa">
          {fuerza.map((f, k) => (
            <FilaDeFuerza
              key={f.patron}
              patron={f.patron}
              semanas={f.semanas}
              k={k}
              desdeElInicio={desdeElInicio}
              entrenada={f.entrenada}
            />
          ))}
          {/* El eje, columna por columna: cada rótulo queda debajo de su
              columna, la primera fecha pegada a su borde izquierdo. "Esta"
              termina en el borde derecho de la suya desde la séptima semana;
              antes arranca en el izquierdo, hacia las columnas vacías que
              siguen. Así siempre tiene siete columnas para entrar. */}
          <div className="fuerza-eje" aria-hidden>
            <span />
            <div>
              {Array.from({ length: Math.max(SEMANAS, semanas.length) }, (_, j) => (
                <span
                  key={j}
                  {...(j === semanas.length - 1 && j >= 6 ? { 'data-fin': '' } : {})}
                  {...(j === 0 && semanas.length > 1 ? { 'data-inicio': '' } : {})}
                >
                  <span className="series-fecha">{j < semanas.length ? rotuloDeFuerza(j, semanas) : ''}</span>
                </span>
              ))}
            </div>
          </div>
          {semanas.length > 1 && (
            <div className="leyenda texto-chico" aria-hidden>
              <span>
                <span className="leyenda-dos">
                  <b />
                  <b />
                </span>
                {desdeElInicio ? 'Gris, tu primera semana.' : 'Gris, la primera de estas semanas.'} En color, lo
                que creció desde ahí.
              </span>
              <span>
                <span className="leyenda-marca" />
                Cambio de eslabón
              </span>
              <span>
                <span className="leyenda-marca" data-medida />
                Cambio a un eslabón que se mide distinto
              </span>
            </div>
          )}
        </div>
        {semanas.length === 1 ? (
          <p className="texto-glosa mt-3 max-w-[42ch]">
            Con una semana, cada columna es tu mejor serie de esa semana en esa cadena. Desde la
            segunda se ve si crece.
          </p>
        ) : (
          notas.map((n) => (
            <p key={n} className="texto-glosa mt-3 max-w-[42ch]">
              {n}
            </p>
          ))
        )}
      </section>

      {(cal || vit) && (
        <section className="entrar-en-orden mt-10" style={orden(3)}>
          <Rotulo className="mb-3">LO QUE TE DEJA ENTRENAR</Rotulo>
          <Baldosas vit={vit} cal={cal} />
        </section>
      )}

      <section className="entrar-en-orden mt-10" style={orden(4)} aria-labelledby="series-por-semana">
        <p className="rotulo seccion-titulo" id="series-por-semana">
          Series por semana
        </p>
        <div className="placa series-semana">
          <div className="series-semana-cabeza">
            <p className="series-semana-cifra">{estaSemana.series}</p>
            <p className="texto-chico pb-0.5">
              {estaSemana.series === 1 ? 'serie' : 'series'} esta semana, hasta hoy
              <br />
              {estaSemana.sesiones} {estaSemana.sesiones === 1 ? 'sesión' : 'sesiones'}
            </p>
          </div>
          <div className="series-columnas" aria-hidden>
            {series.map((s, j) => (
              <div key={s.semana} data-ahora={j === series.length - 1 ? '' : undefined}>
                <span className="series-n">{s.series}</span>
                <span
                  className="series-c"
                  data-cero={s.series === 0 ? '' : undefined}
                  style={
                    {
                      height: `${s.series === 0 ? 2 : ((s.series / techoSeries) * ALTO_SERIES).toFixed(1)}px`,
                      '--k': j,
                    } as CSSProperties
                  }
                />
              </div>
            ))}
            {Array.from({ length: Math.max(0, SEMANAS - series.length) }, (_, j) => (
              <div key={`vacia-${j}`} />
            ))}
          </div>
          <div className="series-pie" aria-hidden>
            {series.map((s, j) => (
              <div key={s.semana}>
                <span className="puntos-sesion">
                  {Array.from({ length: s.sesiones }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
                <span className="series-fecha">{rotuloDeSemana(j, semanas)}</span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, SEMANAS - series.length) }, (_, j) => (
              <div key={`vacia-${j}`} />
            ))}
          </div>
          <table className="sr-only">
            <caption>Series por semana</caption>
            <thead>
              <tr>
                <th>Semana del</th>
                <th>Series</th>
                <th>Sesiones</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.semana}>
                  <td>{fechaCorta(s.semana)}</td>
                  <td>{s.series}</td>
                  <td>{s.sesiones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="texto-chico mt-3">Un punto por sesión debajo de cada semana.</p>
      </section>

      {/* El mapa muscular: qué recibió cada músculo en cuatro semanas.
       *
       * Tiene que decir qué te FALTA y, cuando puede, llenarlo — si no, es un
       * dibujo lindo y nada más. La barra de cada músculo va en la luz de su
       * cadena, la misma del glifo del canal.
       *
       * Lo que está en cero NO se pinta de rojo ni lleva alarma: es una
       * píldora hueca. Lo que falta no está prohibido, está sin iluminar.
       */}
      <section className="entrar-en-orden mt-10" style={orden(5)}>
        <Rotulo className="mb-3">QUÉ ESTÁS ENTRENANDO</Rotulo>
        {techo > 0 && (
          <div className="placa cuerpo-placa">
            <CuerpoDoble vector={mapa} className="h-52" />
            <div className="niveles texto-chico" aria-hidden>
              <span>
                <i style={{ opacity: TINTA[1] }} />
                Más
              </span>
              <span>
                <i style={{ opacity: TINTA[0.5] }} />
                Medio
              </span>
              <span>
                <i style={{ opacity: Math.max(TINTA[0.25], 0.3) }} />
                Menos
              </span>
            </div>
          </div>
        )}
        <p className="texto-glosa mt-3 max-w-[42ch]">
          Series que recibió cada músculo en las últimas cuatro semanas, contra el músculo que más
          recibió. Una serie es una serie: una plancha de treinta segundos y ocho flexiones cuentan
          igual. Los músculos que un ejercicio solo estabiliza no suman — si sumaran, las flexiones
          dirían que entrenaste glúteos.
        </p>

        <div className="placa registro mt-3">
          {ranking.map(({ musculo, series: s }, k) => {
            const patron = patronDe(musculo)
            return (
              <div key={musculo}>
                <span className="canal">{patron ? <Glifo patron={patron} /> : null}</span>
                <span className="min-w-0">
                  <span className="nombre block">{NOMBRE_MUSCULO[musculo]}</span>
                  <span className="barra-musculo" aria-hidden>
                    <i
                      data-cero={s <= 0 ? '' : undefined}
                      style={
                        {
                          width: s > 0 && techo > 0 ? `${((s / techo) * 100).toFixed(1)}%` : undefined,
                          '--luz': patron ? LUZ[patron] : undefined,
                          '--k': k,
                        } as CSSProperties
                      }
                    />
                  </span>
                </span>
                <span className="cifra-fila">{redondo(s)}</span>
              </div>
            )
          })}
        </div>

        {/* El diagnóstico. Una sola cosa por vez: decir dos es no decir ninguna. */}
        {falta.clase === 'sin-datos' && (
          <p className="mt-3 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            {dichoSinDatos(falta.dias)}
          </p>
        )}

        {falta.clase === 'patron-ausente' && (
          <div className="mt-3">
            <p className="max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
              Tu rutina no incluye{' '}
              <span className="text-[var(--color-tinta)]">{NOMBRE_PATRON[falta.patron].toLowerCase()}</span>
              , así que hace cuatro semanas que{' '}
              {enLista(falta.musculos.map((m) => NOMBRE_MUSCULO[m].toLowerCase()))}{' '}
              {falta.musculos.length === 1 ? 'no recibe' : 'no reciben'} una serie.
            </p>
            {/* El arreglo, hecho y no aconsejado: el motor ya sabe en qué
                eslabón estás de esa cadena, así que el cambio no propone nada
                nuevo que aprender. */}
            <button
              onClick={() => void guardarPreferencias({ rutinaActivaId: falta.rutinaQueLoCubre })}
              className="rotulo mt-3 px-4 py-3"
              style={{ border: '1px solid var(--color-regla-fuerte)' }}
            >
              Pasar a {RUTINA_POR_ID.get(falta.rutinaQueLoCubre)?.nombre.toLowerCase()}
            </button>
          </div>
        )}

        {falta.clase === 'flojo' && (
          <p className="mt-3 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            Lo que menos venís trabajando es{' '}
            <span className="text-[var(--color-tinta)]">
              {NOMBRE_MUSCULO[falta.musculo].toLowerCase()}
            </span>
            : {redondo(falta.series)} {falta.series === 1 ? 'serie' : 'series'} en cuatro semanas.
            Está en {NOMBRE_PATRON[falta.patron].toLowerCase()}, así que la rutina ya te lo pide.
          </p>
        )}

        {falta.clase === 'parejo' && (
          <p className="mt-3 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            No hay ningún músculo muy atrás de los demás.
          </p>
        )}

        {/* Lo que la app todavía no puede entrenar, que es un hueco del
            catálogo y no de la persona. La guarda del `length > 0` no es
            defensiva: la lista SE VACIÓ al entrar el press militar y la
            elevación de talones, y sin guarda esta pantalla armaba una
            oración rota. */}
        {SIN_COBERTURA.length > 0 && (
          <p className="mt-3 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            {mayuscula(enLista(SIN_COBERTURA.map((x) => NOMBRE_MUSCULO[x.musculo].toLowerCase())))}{' '}
            {SIN_COBERTURA.length === 1 ? 'no aparece' : 'no aparecen'}: no hay todavía ningún
            ejercicio de {enLista(SIN_COBERTURA.map((x) => x.patronQueFalta), 'ni')} en la app.
          </p>
        )}

        {/* Los huecos de EQUIPO, que son los que la persona sí puede resolver. */}
        {sinBarraCargable.length > 0 && (
          <p className="mt-3 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
            {mayuscula(enLista(sinBarraCargable.map((m) => NOMBRE_MUSCULO[m].toLowerCase())))}{' '}
            {sinBarraCargable.length === 1 ? 'queda' : 'quedan'} en cero y no es por cómo
            entrenás: {sinBarraCargable.length === 1 ? 'el único ejercicio que lo carga necesita' : 'los únicos ejercicios que los cargan necesitan'}{' '}
            una barra con discos. Si la conseguís, cargala en Ajustes y{' '}
            {sinBarraCargable.length === 1 ? 'aparece' : 'aparecen'}.
          </p>
        )}
      </section>

      {/* El historial, con la voz del motor adentro.
          Solo se muestran los cambios de eslabón, que son los días que valen
          la pena releer. En el canal va el número de sesión y no la fecha:
          "047" dice quién sos, "12 sep" dice cuándo. La fecha baja al renglón
          chico. Queda así hasta que la reestructura lo agrupe por día. */}
      <section className="entrar-en-orden mt-10 pb-4" style={orden(6)}>
        <Rotulo>HISTORIAL</Rotulo>
        <div className="registro mt-3">
          {sesiones.slice(0, 20).map((sesion, i) => {
            const numero = total - i
            const saltos = (sesion.decisiones ?? []).filter((d) => d.cambioDeNivel)
            return (
              <div key={sesion.id}>
                {/* Arriba y no al medio: en una fila de tres renglones el
                    número centrado queda flotando lejos del nombre al que
                    pertenece. */}
                <span className="canal" style={{ alignItems: 'flex-start' }}>
                  {String(numero).padStart(3, '0')}
                </span>
                <span className="min-w-0">
                  <span className="nombre block truncate">
                    {sesion.registros
                      .map((r) => buscarEjercicio(r.ejercicioId)?.nombre)
                      .filter(Boolean)
                      .join(' · ') || 'Sesión sin registros'}
                  </span>
                  <span className="rotulo mt-0.5 flex items-center gap-2">
                    {new Date(`${sesion.fecha}T12:00:00`).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    <span className="flex gap-1">
                      {sesion.registros.map((r) => {
                        const e = buscarEjercicio(r.ejercicioId)
                        return e ? <Glifo key={r.ejercicioId} patron={e.patron} /> : null
                      })}
                    </span>
                  </span>
                  {saltos.map((d) => (
                    <span key={d.patron} className="glosa mt-2 block text-[0.9375rem]">
                      {d.explicacion}
                    </span>
                  ))}
                </span>
                <span className="cifra-fila self-start">
                  {Math.round(sesion.duracionSegundos / 60)}
                  <span className="unidad">min</span>
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export { NOMBRE_PATRON }
