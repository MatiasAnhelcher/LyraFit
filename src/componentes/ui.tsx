/**
 * Las piezas compartidas de Pulso.
 *
 * Casi todo lo visual vive en `estilos.css` como clases; acá están las que
 * tienen algo de lógica o que se repiten tantas veces que conviene que existan
 * una sola vez.
 *
 * La regla de oro del sistema: nada brilla salvo la estrella de la carta, y
 * nada usa cursiva salvo el motor. Si aparece un componente nuevo que rompe
 * alguna de las dos, el sistema deja de funcionar entero.
 */

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { Medida, Patron } from '@/dominio/tipos'
import type { ClaseDeDia, Semana } from '@/dominio/rutinas'
import { DIAS, DIA_CORTO, NOMBRE_CLASE, NOMBRE_DIA } from '@/dominio/rutinas'
import {
  ANCHO_DE_REFERENCIA,
  CELDA_MINIMA,
  CELDA_MINIMA_ESFUERZO,
  columnasDeLaCelda,
  dosFilas,
  entra,
  repartir,
  unaFila,
  type Reparto,
} from './regleta'

/** El patrón como tinta sobre papel. Para la noche está la rampa de luz. */
export const COLOR_PATRON: Record<Patron, string> = {
  empuje: 'var(--color-empuje)',
  traccion: 'var(--color-traccion)',
  piernas: 'var(--color-piernas)',
  core: 'var(--color-core)',
  bisagra: 'var(--color-bisagra)',
}

// ─── Símbolos ────────────────────────────────────────────────────────────

/**
 * Los glifos que ni Inter ni Sora traen, dibujados.
 *
 * Medido en Chromium: ✓ ✕ ◆ ◇ ◈ → ← ↔ ◷ ★ ⟳ ≈ no están en ninguna de las dos
 * fuentes, y ↑ no está en Sora. Escritos como texto caían en la letra del
 * teléfono, que en cada marca es otra: un ◆ de Roboto al lado de un rombo de
 * Apple no son el mismo signo, y en el canal eso se nota. `simbolo.test.ts`
 * falla si alguno vuelve a escribirse como carácter.
 *
 * Todos en una caja de 16 con el trazo de 1,5 px que no escala: a 0,8em de un
 * rótulo de 11 px y a 16 px en "Salir" tienen el mismo peso de línea.
 */
const TRAZOS = {
  tilde: <path d="M2.5 8.75 6.25 12.25 13.5 3.75" />,
  cruz: <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" />,
  punto: <circle className="lleno" cx="8" cy="8" r="2" />,
  'rombo-vacio': <path d="M8 1.75 14.25 8 8 14.25 1.75 8Z" />,
  rombo: <path className="lleno" d="M8 1.75 14.25 8 8 14.25 1.75 8Z" />,
  'rombo-doble': (
    <>
      <path d="M8 1.75 14.25 8 8 14.25 1.75 8Z" />
      <path className="lleno" d="M8 5.25 10.75 8 8 10.75 5.25 8Z" />
    </>
  ),
  'flecha-der': <path d="M1.75 8h12.5M9.75 3.5l4.5 4.5-4.5 4.5" />,
  'flecha-izq': <path d="M14.25 8H1.75M6.25 3.5 1.75 8l4.5 4.5" />,
  'flecha-arriba': <path d="M8 14.25V1.75M3.5 6.25 8 1.75l4.5 4.5" />,
  aprox: (
    <path d="M1.75 5.75q1.5625-1.75 3.125 0t3.125 0 3.125 0 3.125 0M1.75 10.25q1.5625-1.75 3.125 0t3.125 0 3.125 0 3.125 0" />
  ),
  rango: <path d="M1.75 8h12.5M5.25 4.5 1.75 8l3.5 3.5M10.75 4.5l3.5 3.5-3.5 3.5" />,
  reloj: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.25V8h3.25" />
    </>
  ),
  ciclo: (
    <>
      <path d="M14 8a6 6 0 1 1-1.76-4.24" />
      <path d="M12.75 1.25v3h-3" />
    </>
  ),
  // Una raya arriba de un trazo corto: el techo alcanzado. No es una estrella,
  // porque la estrella quiere decir "estás acá" y nada más, y al lado de un
  // récord se leería como medalla.
  tope: <path d="M2.75 3.25h10.5M8 3.25v9.5" />,
} satisfies Record<string, ReactNode>

export type NombreDeSimbolo = keyof typeof TRAZOS

/**
 * La clase de día como símbolo: de menos a más peso, como en la grilla de la
 * semana. El texto del dominio (`GLIFO_CLASE`) no cambia; se traduce al
 * dibujar.
 */
export const SIMBOLO_CLASE: Record<ClaseDeDia, NombreDeSimbolo> = {
  descanso: 'punto',
  fuelle: 'rombo-vacio',
  fuerza: 'rombo',
  ambos: 'rombo-doble',
}

export function Simbolo({
  nombre,
  tamano,
  className = '',
}: {
  nombre: NombreDeSimbolo
  /** En px. Sin esto mide 0,8em de la letra que lo rodea. */
  tamano?: number
  className?: string
}) {
  return (
    <svg
      className={`simbolo ${className}`}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      style={tamano ? { width: tamano, height: tamano } : undefined}
    >
      {TRAZOS[nombre]}
    </svg>
  )
}

/**
 * Lo elegido en una lista de filas: un anillo, y adentro un disco cuando está.
 *
 * Reemplaza a los ◆/◇ que marcaban la rutina, la intensidad del fuelle y el
 * formato del reloj. El rombo ya quiere decir "clase de día" en la semana, y
 * el mismo signo diciendo dos cosas en la misma pantalla no dice ninguna.
 */
export function MarcaRadio({ elegida }: { elegida: boolean }) {
  return <span className="marca-radio" data-elegida={elegida} aria-hidden="true" />
}

// ─── Texto de interfaz ───────────────────────────────────────────────────

/** El rótulo de lámina: el título es una placa, no un titular. */
export function Rotulo({
  children,
  className = '',
  prueba,
}: {
  children: ReactNode
  className?: string
  /**
   * El nombre con el que los portones encuentran este rótulo.
   *
   * Existe porque hasta hoy los portones lo buscaban por clase de Tailwind
   * —`main p.rotulo`, `main p.cifra.text-7xl`— y eso convertía el tamaño de
   * letra en API: cambiar un `text-5xl` por un `text-6xl` rompía una medición
   * sin que nadie lo notara hasta correrla.
   */
  prueba?: string
}) {
  return (
    <p className={`rotulo ${className}`} data-prueba={prueba}>
      {children}
    </p>
  )
}

/** El contenedor de filas regladas. Las reglas van a sangre; el texto no. */
export function Registro({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`registro ${className}`}>{children}</div>
}

/**
 * La marca de 10px del patrón en el canal de la izquierda. `data-patron` le da
 * la forma (▲ ▼ ■ ● ▬): el color solo no alcanza para distinguir cinco
 * cadenas en todas las visiones.
 */
export function Glifo({ patron }: { patron: Patron }) {
  return (
    <span
      className="glifo"
      data-patron={patron}
      style={{ ['--tinta-patron' as string]: COLOR_PATRON[patron] }}
      aria-hidden
    />
  )
}

// ─── Acciones ────────────────────────────────────────────────────────────

/**
 * La acción principal: el único relleno menta de la pantalla.
 *
 * En el esfuerzo va a sangre, pegada al canto de abajo. Por la ley de Fitts,
 * un objetivo contra el borde tiene ancho infinito hacia afuera: no se le
 * puede errar con la mano transpirada, que es la condición real de uso.
 */
export function Accion({
  children,
  onClick,
  tipo = 'button',
  deshabilitado = false,
  esfuerzo = false,
  tono,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  tipo?: 'button' | 'submit'
  deshabilitado?: boolean
  /** True en la pantalla de entrenar, donde la acción va a sangre y crece. */
  esfuerzo?: boolean
  /**
   * 'destructivo' para lo que no se puede deshacer: la menta dice "seguí, es
   * por acá", y borrar todo no puede decir eso. 'quieto' para la misma caja
   * sin relleno, cuando la pantalla ya tiene su luz en otro lado.
   */
  tono?: 'destructivo' | 'quieto'
  className?: string
}) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={deshabilitado}
      className={`accion${esfuerzo ? ' accion-esfuerzo' : ''} ${className}`}
      {...(tono ? { 'data-tono': tono } : {})}
    >
      {children}
    </button>
  )
}

/** La acción que no empuja: terminar es terminar. */
export function AccionQuieta({
  children,
  onClick,
  deshabilitado = false,
  className = '',
}: {
  children: ReactNode
  onClick?: () => void
  deshabilitado?: boolean
  className?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={deshabilitado} className={`accion-quieta ${className}`}>
      {children}
    </button>
  )
}

/**
 * "Salir" del esfuerzo, con la cruz adelante.
 *
 * Era un rótulo de 43×16: el botón que más se busca con la mano temblando era
 * el más chico de la pantalla. Mide 56 de alto, como todo lo que se toca ahí.
 */
export function BotonSalir({ onClick, children = 'Salir' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="boton-salir">
      <Simbolo nombre="cruz" tamano={16} />
      {children}
    </button>
  )
}

// ─── La regleta ──────────────────────────────────────────────────────────

/** Cuántas columnas de la grilla ocupa cada celda, para el segmento. */
const CeldaDeRegleta = createContext<number | null>(null)

interface Forma {
  reparto: Reparto
  vertical: boolean
}

let lienzo: CanvasRenderingContext2D | null | undefined

/**
 * La palabra más ancha de todas las opciones, con la letra con la que se
 * dibuja cada una. Se mide en un lienzo y no en el DOM: medida en la regleta,
 * una palabra que no entra ya está cortada, y su ancho es el de la celda.
 */
function palabraMasAncha(regleta: HTMLElement): number | null {
  if (lienzo === undefined) lienzo = document.createElement('canvas').getContext('2d')
  if (!lienzo) return null
  let mayor = 0
  for (const texto of regleta.querySelectorAll<HTMLElement>('.segmento-texto')) {
    const estilo = getComputedStyle(texto)
    lienzo.font = `${estilo.fontWeight} ${estilo.fontSize} ${estilo.fontFamily}`
    for (const palabra of (texto.textContent ?? '').split(/\s+/)) {
      if (palabra) mayor = Math.max(mayor, lienzo.measureText(palabra).width)
    }
  }
  return mayor
}

/**
 * El ancho que esta regleta tendría en un teléfono de 320.
 *
 * Todo lo que hay entre el `main` de afuera y la regleta crece uno a uno con
 * él, y ese `main` mide 320 en un 320. Se toma el de más afuera porque el
 * chequeo y la molestia todavía viven adentro del de la barra.
 */
function anchoA320(regleta: HTMLElement, ancho: number): number {
  let marco = regleta.closest('main')
  for (let afuera = marco?.parentElement?.closest('main'); afuera; afuera = afuera.parentElement?.closest('main')) {
    marco = afuera
  }
  const exterior = marco ? marco.getBoundingClientRect().width : document.documentElement.clientWidth
  return ancho - Math.max(0, exterior - ANCHO_DE_REFERENCIA)
}

const mismaForma = (a: Forma, b: Forma) =>
  a.vertical === b.vertical && a.reparto.filas === b.reparto.filas && a.reparto.columnas === b.reparto.columnas

/**
 * La regleta de opciones: segmentos donde uno está elegido.
 *
 * Va en una fila o en dos filas parejas según `repartir` (`regleta.ts`), que
 * decide contra un 320 para que la misma pregunta se vea igual en todos los
 * teléfonos. Mide sola: la palabra más ancha y su ancho, al montarse, cuando
 * cambia de tamaño y cuando terminan de cargar las fuentes. Si ni en dos
 * filas entra una palabra entera, pasa a una columna.
 *
 * `aria-pressed` en cada segmento no es decoración de accesibilidad: es
 * también el selector que lo pinta. Un segmento sin estado anunciado no se
 * podría pintar.
 */
export function Regleta({
  children,
  className = '',
  etiqueta,
  esfuerzo = false,
}: {
  children: ReactNode
  className?: string
  /** Qué se está eligiendo. Un grupo sin nombre no se puede navegar a ciegas. */
  etiqueta?: string
  /** True en el esfuerzo, donde cada celda pide 56 y no 48. */
  esfuerzo?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const celdas = Children.toArray(children).filter(isValidElement)
  const cantidad = celdas.length
  const [forma, setForma] = useState<Forma>(() => ({
    reparto: cantidad <= 5 ? unaFila(cantidad) : dosFilas(cantidad),
    vertical: false,
  }))

  const medir = () => {
    const regleta = ref.current
    if (!regleta) return
    const palabra = palabraMasAncha(regleta)
    if (palabra === null) return
    const ancho = regleta.getBoundingClientRect().width
    const reparto = repartir({
      opciones: cantidad,
      ancho: anchoA320(regleta, ancho),
      palabraMasAncha: palabra,
      celdaMinima: esfuerzo ? CELDA_MINIMA_ESFUERZO : CELDA_MINIMA,
    })
    const nueva = { reparto, vertical: !entra(reparto, ancho, palabra) }
    setForma((antes) => (mismaForma(antes, nueva) ? antes : nueva))
  }
  const medirAhora = useRef(medir)
  medirAhora.current = medir

  // En cada pintada, antes de que se vea: un texto nuevo cambia la palabra
  // más ancha sin cambiar el tamaño, y el observador no se enteraría.
  useLayoutEffect(() => medirAhora.current())

  useEffect(() => {
    const regleta = ref.current
    if (!regleta) return
    const observador = new ResizeObserver(() => medirAhora.current())
    observador.observe(regleta)
    let viva = true
    void document.fonts?.ready.then(() => viva && medirAhora.current())
    return () => {
      viva = false
      observador.disconnect()
    }
  }, [])

  const { reparto, vertical } = forma
  return (
    <div
      ref={ref}
      className={`regleta ${className}`}
      role="group"
      aria-label={etiqueta}
      data-filas={vertical ? undefined : reparto.filas}
      data-vertical={vertical || undefined}
      data-esfuerzo={esfuerzo || undefined}
      style={{ ['--columnas' as string]: vertical ? 1 : reparto.columnas }}
    >
      {celdas.map((celda, i) => (
        <CeldaDeRegleta.Provider key={celda.key ?? i} value={columnasDeLaCelda(reparto, i)}>
          {celda}
        </CeldaDeRegleta.Provider>
      ))}
    </div>
  )
}

/**
 * Un segmento de la regleta.
 *
 * Lo elegido va en tinta con un ✓ arriba del rótulo. El ✓ está siempre
 * montado y con su lugar reservado, así que elegir no corre el rótulo; sin
 * elegir está transparente. Aparece con una transición y no con una
 * animación: en las preguntas del final no puede correr ninguna.
 */
export function Segmento({
  children,
  elegido,
  onClick,
  cifra = false,
  tono,
  className = '',
  prueba,
}: {
  children: ReactNode
  elegido: boolean
  onClick: () => void
  /** True cuando el contenido es un número: cifra tabular y celda más alta. */
  cifra?: boolean
  /** Ámbar cuando lo que se elige es una molestia, no una preferencia. */
  tono?: 'ambar'
  className?: string
  prueba?: string
}) {
  const columnas = useContext(CeldaDeRegleta)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={elegido}
      data-prueba={prueba}
      {...(tono ? { 'data-tono': tono } : {})}
      className={`segmento${cifra ? ' segmento-cifra' : ''} ${className}`}
      style={columnas ? { ['--columnas-celda' as string]: columnas } : undefined}
    >
      <Simbolo nombre="tilde" tamano={12} className="segmento-tilde" />
      <span className="segmento-texto">{children}</span>
    </button>
  )
}

// ─── Controles de fila ───────────────────────────────────────────────────

/**
 * Un sí o no, como fila entera que se toca.
 *
 * El "SÍ"/"NO" escrito es el último texto del botón a propósito: es lo que se
 * lee de reojo, y lo que `colgado.mjs` verifica. Para el lector lo dice
 * `aria-pressed`, así que el texto va oculto y no se anuncia dos veces.
 */
export function Interruptor({
  titulo,
  detalle,
  activo,
  onCambiar,
}: {
  titulo: string
  detalle?: ReactNode
  activo: boolean
  onCambiar: (v: boolean) => void
}) {
  return (
    <button type="button" onClick={() => onCambiar(!activo)} aria-pressed={activo} className="fila-pulsable">
      <span className="canal" />
      <span className="min-w-0">
        <span className="nombre block">{titulo}</span>
        {detalle && <span className="texto-chico mt-1 block">{detalle}</span>}
      </span>
      <span className="flex items-center gap-3">
        <span className="interruptor" data-activo={activo} aria-hidden="true" />
        <span className="rotulo min-w-5 text-right" aria-hidden="true">
          {activo ? 'SÍ' : 'NO'}
        </span>
      </span>
    </button>
  )
}

/**
 * La semana de una rutina: qué toca cada día.
 *
 * Dice qué TOCA, no qué pasó: por eso no usa las formas de la semana de Hoy,
 * donde el disco quiere decir "hubo sesión". Es un dibujo, así que no se lee;
 * la misma semana va en palabras para el lector.
 */
export function SemanaDeRutina({ semana }: { semana: Semana }) {
  const clase = (dia: number): ClaseDeDia => semana[dia] ?? 'descanso'
  return (
    <>
      <span className="semana-rutina" aria-hidden="true">
        {DIAS.map((dia) => (
          <span key={dia} data-clase={clase(dia)}>
            <Simbolo nombre={SIMBOLO_CLASE[clase(dia)]} />
            <span>{DIA_CORTO[dia]}</span>
          </span>
        ))}
      </span>
      <span className="sr-only">
        {DIAS.map((dia) => `${NOMBRE_DIA[dia]!.toLowerCase()}, ${NOMBRE_CLASE[clase(dia)].toLowerCase()}`).join('; ')}
      </span>
    </>
  )
}

// ─── La hoja ─────────────────────────────────────────────────────────────

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * La hoja: la modal que sube desde abajo, o "Cómo se hace" a pantalla
 * completa (`completa`).
 *
 * Atrapa el foco mientras está, Escape la cierra y el foco vuelve al botón
 * que la abrió. La hoja misma recibe el foco al abrirse, no su primer botón:
 * en una confirmación ese botón es el que reemplaza o borra, y un Enter de
 * más no puede bastar para eso.
 */
export function Hoja({
  children,
  onCerrar,
  etiqueta,
  completa = false,
  className = '',
}: {
  children: ReactNode
  onCerrar: () => void
  /** El nombre del diálogo. */
  etiqueta: string
  completa?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar

  useEffect(() => {
    const hoja = ref.current
    if (!hoja) return
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null
    hoja.focus()
    const enfocables = () => [...hoja.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => el.getClientRects().length > 0)
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cerrar.current()
        return
      }
      if (e.key !== 'Tab') return
      const lista = enfocables()
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      if (!primero || !ultimo) {
        e.preventDefault()
        return
      }
      const actual = document.activeElement
      if (e.shiftKey && (actual === primero || actual === hoja || !hoja.contains(actual))) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (actual === ultimo || !hoja.contains(actual))) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      if (antes?.isConnected) antes.focus()
    }
  }, [])

  return createPortal(
    <div className="hoja-marco" data-completa={completa || undefined}>
      <div className="hoja-cortina" onClick={completa ? undefined : () => cerrar.current()} aria-hidden="true" />
      <div
        ref={ref}
        className={`hoja ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        tabIndex={-1}
        data-completa={completa || undefined}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ─── Lo demás ────────────────────────────────────────────────────────────

/**
 * La voz del motor.
 *
 * Es lo único de la app en cursiva y es deliberadamente más grande que el
 * cuerpo: la explicación del algoritmo no es letra chica, es el activo
 * diferencial del producto. Un mal día se dice en ámbar; nunca en rojo.
 */
export function Glosa({
  children,
  cita,
  tono,
}: {
  children: ReactNode
  /** La regla que se aplicó. El motor firma lo que decide. */
  cita?: string
  tono?: 'ambar'
}) {
  return (
    <div>
      <p className="glosa glosa-motor" {...(tono ? { 'data-tono': tono } : {})}>
        {children}
      </p>
      {cita && <span className="cita">{cita}</span>}
    </div>
  )
}

/**
 * El acumulador monotónico, como marca de cuaderno.
 *
 * Un trazo por sesión, largo cada cinco, el último en Vega. Nunca baja: si
 * faltaste tres semanas sigue diciendo lo mismo, sin huecos ni marcas de
 * ausencia. Es exactamente lo que una racha no puede ser.
 */
export function Tira({ cantidad, tope = 120 }: { cantidad: number; tope?: number }) {
  const visibles = Math.min(cantidad, tope)
  return (
    <div className="tira" aria-hidden>
      {Array.from({ length: visibles }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  )
}

/** El estado vacío: las reglas ya dibujadas, quietas. Sin esqueleto latiendo. */
export function Cargando({ filas = 3 }: { filas?: number }) {
  return (
    <div className="registro" aria-busy="true" aria-live="polite">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="fila-vacia" />
      ))}
    </div>
  )
}

export function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="py-10">
      <p className="nombre">{titulo}</p>
      <p className="texto-glosa mt-2 max-w-[40ch]">{texto}</p>
    </div>
  )
}

// ─── Texto ───────────────────────────────────────────────────────────────

export function plural(cantidad: number, singular: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`
}

/** El número con su unidad, cuando la unidad hace falta para entenderlo. */
export function unidad(medida: Medida, cantidad: number): string {
  return medida === 'segundos' ? `${cantidad}s` : `${cantidad}`
}

export function nombreUnidad(medida: Medida, muchas = true): string {
  if (medida === 'segundos') return muchas ? 'segundos' : 'segundo'
  return muchas ? 'repeticiones' : 'repetición'
}

/** El objetivo escrito como en la tabla: 3×12, con el × discreto. */
export function Objetivo({ series, cantidad, medida }: { series: number; cantidad: number; medida: Medida }) {
  return (
    <span className="cifra-fila">
      {series}
      <span className="por">×</span>
      {cantidad}
      {medida === 'segundos' && <span className="unidad">s</span>}
    </span>
  )
}
