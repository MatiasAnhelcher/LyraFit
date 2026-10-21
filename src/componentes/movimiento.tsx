/**
 * La gramática del movimiento, del lado de JavaScript.
 *
 * El CSS tiene las primitivas (`estilos.css`, sección 7). Acá están las cosas
 * que el CSS no puede hacer solo: disparar el pasaje entre pantallas, decidir
 * cuándo NO dispararlo, esperar a que la pantalla nueva tenga algo que
 * mostrar, y decirle a lo que se mueve solo —Lyra, la figura— que se quede
 * quieto.
 *
 * ## Por qué no hay una librería de animación
 *
 * Porque el service worker precachea todos los trozos del build. Una librería
 * de animación de 40 kB no se baja "cuando hace falta": se baja entera en cada
 * instalación y en cada actualización, aunque esté detrás de un `lazy`. Para
 * una app que tiene que arrancar en un teléfono de gama media y sin conexión,
 * ese es el peor lugar donde poner peso.
 *
 * Todo lo que hace falta ya está en la plataforma: `linear()` para los
 * resortes y la View Transitions API para el pasaje. Y va a mano, con
 * `startViewTransition` y `flushSync`: con `HashRouter` la prop
 * `viewTransition` del router no hace nada, y React todavía no trae
 * `<ViewTransition>` estable.
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from 'react'
import { flushSync } from 'react-dom'
import { Link, useLocation, useNavigate, type LinkProps, type NavigateFunction } from 'react-router-dom'
import { despertarAudio } from '@/respuesta'
import { rigeReducido } from '@/dominio/movimiento'
import type { Movimiento } from '@/dominio/tipos'

// ─── Lo que rige ─────────────────────────────────────────────────────────

/**
 * Si rige el movimiento reducido.
 *
 * Se lee del atributo y no del media query, igual que el CSS: lo pone el
 * script de `index.html` con la preferencia del teléfono y lo corrige el
 * portero con la de Ajustes. Así hay una sola verdad, y el interruptor apaga
 * en el acto a todo lo que pregunta acá, sin recargar.
 */
export function movimientoReducido(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.movimiento === 'reducido'
}

/**
 * Pone en la raíz el movimiento guardado. Lo usa el portero, que ya espera a
 * las preferencias antes de dibujar cualquier pantalla.
 *
 * `'reducido'` pone el atributo, `'completo'` lo saca y `'sistema'` sigue lo
 * que el script de `index.html` dejó escrito del teléfono, también si cambia
 * con la app abierta. Devuelve si ya lo aplicó: el portero dibuja la primera
 * pantalla recién después, así ninguna entrada corre con el valor
 * equivocado. Es un efecto de layout, así que pasa antes de pintar.
 */
export function useAplicarMovimiento(guardado: Movimiento | undefined): boolean {
  const [aplicado, setAplicado] = useState(false)
  useLayoutEffect(() => {
    if (guardado === undefined) return
    const raiz = document.documentElement
    const aplicar = () => {
      if (rigeReducido(guardado, raiz.dataset.movimientoSistema === 'reducido')) {
        raiz.dataset.movimiento = 'reducido'
      } else if (raiz.dataset.movimiento === 'reducido') {
        delete raiz.dataset.movimiento
        terminarLoQueYaLlego()
      }
    }
    aplicar()
    setAplicado(true)
    if (guardado !== 'sistema') return
    const observador = new MutationObserver(aplicar)
    observador.observe(raiz, { attributes: true, attributeFilter: ['data-movimiento-sistema'] })
    return () => observador.disconnect()
  }, [guardado])
  return aplicado
}

/**
 * Sacar el reducido saca el `animation: none`, y eso arranca de cero cada
 * animación de lo que ya está en pantalla: Ajustes entera volvería a entrar,
 * desde opacidad 0, bajo el dedo que acaba de tocar el interruptor. Lo que ya
 * llegó queda llegado. Lyra, que no termina nunca, vuelve a respirar.
 *
 * `getAnimations()` recalcula los estilos antes de responder, así que las
 * animaciones recién arrancadas ya están ahí y se terminan antes del cuadro
 * siguiente: no llega a verse ninguna.
 */
function terminarLoQueYaLlego() {
  for (const animacion of document.getAnimations()) {
    if (animacion instanceof CSSAnimation && animacion.effect?.getTiming().iterations !== Infinity) animacion.finish()
  }
}

/** Lo vivo se apaga con movimiento reducido y bajo el esfuerzo, sin excepciones. */
function quietoPorLaRaiz(): boolean {
  const raiz = document.documentElement
  return raiz.dataset.movimiento === 'reducido' || raiz.dataset.pantalla === 'entrenar'
}

function suscribirLaRaiz(avisar: () => void): () => void {
  const observador = new MutationObserver(avisar)
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-movimiento', 'data-pantalla'],
  })
  return () => observador.disconnect()
}

/** `movimientoReducido()`, para un componente que tiene que redibujarse cuando cambia. */
export function useMovimientoReducido(): boolean {
  return useSyncExternalStore(suscribirLaRaiz, movimientoReducido, () => false)
}

/**
 * Si lo que se mueve solo tiene que quedarse quieto, preguntado sin hooks.
 *
 * Además de la raíz mira si el elemento está adentro de una pantalla de
 * esfuerzo: esa clase está en el DOM desde el primer cuadro, y
 * `data-pantalla` llega recién cuando termina el pasaje que lleva a ella.
 */
export function debeQuedarseQuieto(elemento: Element | null): boolean {
  return quietoPorLaRaiz() || elemento?.closest('.pantalla-esfuerzo') != null
}

/**
 * `debeQuedarseQuieto`, para un componente.
 *
 * La quietud se lee sola, como el CSS lee el atributo, y no se le pide a cada
 * pantalla que la pase como prop: así ninguna pantalla tiene que acordarse de
 * pedirla, y una pieza nueva adentro del esfuerzo nace quieta.
 */
export function useQuieto(ref: RefObject<Element | null>): boolean {
  const porLaRaiz = useSyncExternalStore(suscribirLaRaiz, quietoPorLaRaiz, () => false)
  const [enElEsfuerzo, setEnElEsfuerzo] = useState(false)
  useLayoutEffect(() => {
    setEnElEsfuerzo(ref.current?.closest('.pantalla-esfuerzo') != null)
  })
  return porLaRaiz || enElEsfuerzo
}

// ─── El escalonado ───────────────────────────────────────────────────────

/**
 * El índice de una fila, para que entre escalonada.
 *
 * Se devuelve como objeto de estilo y no como clase porque el valor es un
 * número: `style={orden(i)}` en el JSX y la clase `entrar-en-orden` hace el
 * resto. Más de ocho filas no escalonan: con el escalón de 24 ms la octava
 * termina a los 348, y una más ya se lee como espera y no como orden.
 */
export function orden(i: number): CSSProperties {
  return { ['--orden' as string]: Math.min(i, 7) }
}

// ─── El pasaje ───────────────────────────────────────────────────────────

/**
 * Hacia dónde se va. Es lo único que el CSS necesita saber del pasaje.
 *
 * `puerta` (de Hoy a Entrenar) y `regreso` (del Cierre a Hoy) son los únicos
 * que cruzan el esfuerzo, y solo en ese sentido y desde ese lugar.
 */
export type Direccion =
  | 'lateral-der'
  | 'lateral-izq'
  | 'profundo'
  | 'superficie'
  | 'paso-adelante'
  | 'paso-atras'
  | 'puerta'
  | 'regreso'

/** Un elemento de la pantalla de origen que viaja hasta la de destino. */
export interface Compartido {
  origen: HTMLElement | null | undefined
  nombre: string
}

/**
 * Como mucho dos, y lo dice el tipo: con la raíz y el marco son cuatro fotos
 * por pasaje, cada una del tamaño de la pantalla en memoria de texturas.
 */
export type Compartidos = readonly [Compartido] | readonly [Compartido, Compartido]

export interface OpcionesDelPasaje {
  direccion: Direccion
  compartidos?: Compartidos
  /** Lo que la pantalla de destino lee con `useLocation().state`. */
  estado?: unknown
  reemplazar?: boolean
}

/**
 * Las pantallas donde el pasaje está PROHIBIDO.
 *
 * No es una preferencia estética. A 140 pulsaciones, cualquier deslizamiento
 * se percibe como una app trabada, y son pantallas donde la persona está en
 * esfuerzo o saliendo de él. La prohibición vive acá, en un solo lugar, y no
 * repartida en cada botón que navega.
 */
const SIN_PASAJE = ['/entrenar', '/reloj']

/** Lo que espera el pasaje a que la pantalla nueva tenga su contenido. */
const TOPE_DEL_DESTINO = 120

const rutaDe = (destino: string) => destino.split('?')[0] || '/'

const entraAlEsfuerzo = (destino: string) =>
  SIN_PASAJE.some((p) => rutaDe(destino) === p || rutaDe(destino).startsWith(`${p}/`))

/**
 * Si el esfuerzo queda de por medio y el cambio tiene que ser un corte.
 *
 * Las dos excepciones son exactas a propósito: la puerta solo desde Hoy y
 * solo a Entrenar, y el regreso solo del Cierre a Hoy. El Reloj entra y sale
 * siempre por corte, y nunca hay un pasaje entre dos estados de la sesión,
 * que no navegan.
 */
function esfuerzoDePorMedio(desde: string, destino: string, direccion: Direccion): boolean {
  const pantalla = document.documentElement.dataset.pantalla
  if (pantalla === 'entrenar') return true
  if (pantalla === 'cierre') return !(direccion === 'regreso' && rutaDe(destino) === '/')
  if (entraAlEsfuerzo(destino)) {
    return !(direccion === 'puerta' && desde === '/' && rutaDe(destino) === '/entrenar')
  }
  return false
}

function hayPasaje(desde: string, destino: string, direccion: Direccion): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function' &&
    !movimientoReducido() &&
    !esfuerzoDePorMedio(desde, destino, direccion)
  )
}

/** El pasaje que está corriendo, si hay uno. */
let enCurso: ViewTransition | null = null

/**
 * El pasaje en curso, para quien tiene que esperar a que termine.
 *
 * Lo usa `useModoDePantalla`: si la pantalla de esfuerzo llega por un pasaje,
 * `data-pantalla` se pone recién en su `finished`, porque mientras el pasaje
 * corre todavía hay algo moviéndose. Lo mismo vale para mover el foco al
 * llegar (el `h1` de la pantalla nueva): va en el `finished`, o en el acto si
 * esto da `null`, y nunca en el efecto de layout del destino, porque mientras
 * el pasaje corre el contenido nuevo está inerte y `focus()` falla callado.
 */
export function pasajeEnCurso(): ViewTransition | null {
  return enCurso
}

/** Marca el atrás que dispara "Volver", que va adentro de un pasaje. */
let volviendo = false

// ─── Esperar al destino ──────────────────────────────────────────────────

let placasCargando = 0
let alTenerContenido: (() => void)[] = []

function avisarSiTieneContenido() {
  if (placasCargando > 0) return
  const pendientes = alTenerContenido
  alTenerContenido = []
  for (const avisar of pendientes) avisar()
}

/**
 * Lo llama la placa de "cargando" mientras está montada.
 *
 * Así el pasaje sabe cuándo la pantalla nueva ya tiene su contenido sin que
 * cada pantalla tenga que avisarlo: el contenido llega cuando la última placa
 * se va. Se mira en una microtarea y no en el acto porque en el mismo commit
 * puede irse una placa y montarse otra —la de Progreso reemplaza a la del
 * `Suspense`—, y eso todavía no es contenido.
 */
export function useCargando(): void {
  useLayoutEffect(() => {
    placasCargando++
    return () => {
      placasCargando--
      queueMicrotask(avisarSiTieneContenido)
    }
  }, [])
}

/**
 * Una promesa que resuelve cuando la pantalla nueva tiene su contenido, y no
 * el "CARGANDO…", o a los `tope` ms: si no llega, el pasaje sigue igual y lo
 * que viajaba se degrada a fundido. No sondea cuadro por cuadro porque
 * mientras el pasaje toma la foto el navegador no corre los cuadros.
 */
function destinoListo(tope: number): Promise<void> {
  if (placasCargando === 0) return Promise.resolve()
  return new Promise((resolver) => {
    const listo = () => {
      window.clearTimeout(reloj)
      alTenerContenido = alTenerContenido.filter((f) => f !== listo)
      resolver()
    }
    const reloj = window.setTimeout(listo, tope)
    alTenerContenido.push(listo)
  })
}

let alCambiarDeLugar: (() => void)[] = []

/**
 * Avisa que React ya dibujó una ruta nueva. Va una sola vez, en `App`.
 *
 * Hace falta para "Volver": `history.back()` es asíncrono y la ruta cambia
 * cuando el router escucha el `popstate`, no cuando se llama. Es un efecto de
 * layout de la raíz, que corre después de los de toda la pantalla nueva.
 */
export function useAvisarLugar(): void {
  const { key } = useLocation()
  useLayoutEffect(() => {
    const pendientes = alCambiarDeLugar
    alCambiarDeLugar = []
    for (const avisar of pendientes) avisar()
  }, [key])
}

function lugarNuevo(tope: number): Promise<void> {
  return new Promise((resolver) => {
    const listo = () => {
      window.clearTimeout(reloj)
      alCambiarDeLugar = alCambiarDeLugar.filter((f) => f !== listo)
      resolver()
    }
    const reloj = window.setTimeout(listo, tope)
    alCambiarDeLugar.push(listo)
  })
}

// ─── El scroll ───────────────────────────────────────────────────────────

/**
 * Dónde dejaste cada pantalla. En memoria y nada más: es de esta visita, y
 * al volver a abrir la app cada sección arranca arriba.
 */
const memoriaDeScroll = new Map<string, number>()

const rutaActual = () => rutaDe(window.location.hash.slice(1))

function irAlScroll(y: number) {
  window.scrollTo({ top: y, behavior: 'instant' })
}

/**
 * Volver a una sección o a la superficie es volver adonde estabas; ir a una
 * subpantalla, a un paso o al esfuerzo es empezar arriba.
 */
function scrollAlLlegar(direccion: Direccion, destino: string): number {
  const vuelve = direccion === 'lateral-der' || direccion === 'lateral-izq' || direccion === 'superficie' || direccion === 'regreso'
  return vuelve ? (memoriaDeScroll.get(rutaDe(destino)) ?? 0) : 0
}

/** Tocar la pestaña activa sube al principio. */
export function subirAlPrincipio(): void {
  window.scrollTo({ top: 0, behavior: movimientoReducido() ? 'instant' : 'smooth' })
}

// ─── El atrás del sistema ────────────────────────────────────────────────

// Un atrás del sistema en medio de un pasaje lo corta en seco. El atrás nunca
// tiene pasaje propio: si el navegador ya hizo su animación de gesto, otra
// encima sería doble, y si no la hizo, el atrás se siente como un atrás.
//
// Lo que sí tiene es scroll que devolver. El navegador restaura el suyo en el
// acto, cuando la pantalla todavía no tiene su contenido —Cadenas mide un
// solo alto mientras lee la base— y lo topea en 0. Por eso se espera a que
// llegue el contenido y se vuelve adonde estabas, si esta visita lo anotó. En
// Android este atrás es el camino más usado para salir de una ficha.
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (volviendo) return
    enCurso?.skipTransition()
    const ruta = rutaActual()
    const y = memoriaDeScroll.get(ruta)
    if (y === undefined) return
    void lugarNuevo(TOPE_DEL_DESTINO * 3)
      .then(() => destinoListo(TOPE_DEL_DESTINO * 3))
      .then(() => {
        if (rutaActual() === ruta) irAlScroll(y)
      })
  })
}

// ─── Correr un pasaje ────────────────────────────────────────────────────

/**
 * Lo que queda inerte mientras corre el pasaje: el contenido nuevo, que
 * todavía se está corriendo de lugar. Es el `main` de cada pantalla, también
 * el del alta; la barra no, porque es el marco y no se mueve. Se suelta en
 * `finished`, que llega siempre, y no en `animationend`, que no llega si el
 * pasaje se saltea.
 */
function marcarInerte() {
  for (const principal of document.querySelectorAll('main')) {
    principal.inert = true
    principal.dataset.inerteDelPasaje = ''
  }
}

function soltarInerte() {
  for (const principal of document.querySelectorAll<HTMLElement>('[data-inerte-del-pasaje]')) {
    principal.inert = false
    delete principal.dataset.inerteDelPasaje
  }
}

/**
 * Quién tenía el foco cuando arrancó el pasaje.
 *
 * El inerte se lo saca —el enlace al eslabón siguiente, "Siguiente" en el
 * alta—, y el teclado y el lector quedarían en `<body>`, con el cursor
 * perdido. Se devuelve en `finished` si sigue en la pantalla y nadie movió el
 * foco mientras tanto. Vive en el módulo y no en cada pasaje porque uno puede
 * cortar al anterior: el segundo ya encuentra el foco en `<body>`.
 */
let focoDelPasaje: HTMLElement | null = null

function guardarElFoco() {
  const activo = document.activeElement
  if (focoDelPasaje === null && activo instanceof HTMLElement && activo !== document.body) focoDelPasaje = activo
}

function devolverElFoco() {
  const foco = focoDelPasaje
  focoDelPasaje = null
  const perdido = document.activeElement === null || document.activeElement === document.body
  if (foco?.isConnected && perdido) foco.focus({ preventScroll: true })
}

/**
 * Un toque que cae en medio de un pasaje no se pierde (§6.4.8).
 *
 * Mientras corre una View Transition, Chromium le manda todo toque a
 * `<html>`: el de la barra o el del contenido nuevo no le llegaba a nadie, y
 * la app quedaba sorda hasta medio segundo después de cada navegación. Acá se
 * corta el pasaje en seco y el toque se vuelve a dar en el mismo punto, que
 * para entonces ya es la pantalla nueva, quieta y sin inerte. Si caen varios,
 * vale el último.
 */
let toqueEnEspera: { x: number; y: number } | null = null

function rescatarElToque(evento: MouseEvent) {
  const pasaje = enCurso
  if (pasaje === null || evento.target !== document.documentElement) return
  const yaEsperaba = toqueEnEspera !== null
  toqueEnEspera = { x: evento.clientX, y: evento.clientY }
  if (yaEsperaba) return
  pasaje.skipTransition()
  // Se anota después de la limpieza de `correrPasaje` en el mismo `finished`,
  // así que corre cuando el contenido ya no está inerte.
  void pasaje.finished.finally(() => {
    const toque = toqueEnEspera
    toqueEnEspera = null
    if (toque === null) return
    // Un evento y no `click()`: lo que queda bajo el dedo puede ser el
    // dibujo de un ícono, que es SVG y no tiene `click()`. El evento sube
    // hasta el enlace o el botón igual que un toque.
    document.elementFromPoint(toque.x, toque.y)?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: toque.x, clientY: toque.y, view: window }),
    )
  })
}

if (typeof document !== 'undefined') document.addEventListener('click', rescatarElToque, true)

/**
 * El pasaje, para los tres que lo usan: ir, volver y cambiar de paso.
 *
 * `actualizar` cambia el DOM adentro de la foto y devuelve el scroll que
 * tiene que tener la pantalla nueva. Lo que viaja se nombra acá, en el
 * toque, y se desnombra en `finished`: nunca hay dos elementos con el mismo
 * nombre, que es lo que hace que Chrome cancele el pasaje entero.
 */
function correrPasaje(direccion: Direccion, compartidos: readonly Compartido[], actualizar: () => Promise<number>) {
  const raiz = document.documentElement
  const nombrados = raiz.hasAttribute('data-liviano')
    ? []
    : compartidos.filter((c): c is { origen: HTMLElement; nombre: string } => c.origen != null && estaEnPantalla(c.origen))
  for (const c of nombrados) c.origen.style.viewTransitionName = c.nombre
  raiz.dataset.vt = direccion
  guardarElFoco()

  const pasaje = document.startViewTransition(async () => {
    // Inerte ANTES de dibujar lo nuevo: así el contenido nuevo nace inerte y
    // el navegador calcula su estilo una sola vez. Puesto después costaba un
    // recálculo entero más, adentro del cuadro congelado del pasaje. Que lo
    // viejo quede inerte no se ve: su foto ya está sacada.
    marcarInerte()
    const y = await actualizar()
    irAlScroll(y)
  })
  enCurso = pasaje
  // Un pasaje salteado rechaza `ready`; sin esto cada salteo sería un error
  // sin atrapar en la consola.
  pasaje.ready.catch(() => {})
  void pasaje.finished.finally(() => {
    for (const c of nombrados) c.origen.style.viewTransitionName = ''
    // Si ya arrancó otro pasaje, lo que queda en la raíz es suyo. Si lo que
    // vino después fue un corte (`enCurso` en null), no hay nadie más que
    // limpie: sin esto el contenido quedaba inerte para siempre.
    if (enCurso !== null && enCurso !== pasaje) return
    enCurso = null
    delete raiz.dataset.vt
    soltarInerte()
    devolverElFoco()
  })
}

/** No se nombra lo que está fuera de la pantalla: su foto viajaría desde la nada. */
function estaEnPantalla(elemento: HTMLElement): boolean {
  const caja = elemento.getBoundingClientRect()
  return caja.bottom > 0 && caja.top < window.innerHeight && caja.width > 0
}

function irA(navegar: NavigateFunction, desde: string, destino: string, opciones: OpcionesDelPasaje) {
  const { direccion, compartidos = [], estado, reemplazar = false } = opciones
  // Adentro del toque y antes de la foto: en iOS un audio que se despierta
  // fuera de un gesto nace suspendido y el descanso no suena nunca.
  if (entraAlEsfuerzo(destino)) despertarAudio()
  memoriaDeScroll.set(desde, window.scrollY)
  // Un toque nuevo en medio de un pasaje lo termina en seco y arranca el suyo.
  enCurso?.skipTransition()

  const navegarYa = () => navegar(destino, { replace: reemplazar, state: estado })
  const scroll = scrollAlLlegar(direccion, destino)

  if (!hayPasaje(desde, destino, direccion)) {
    enCurso = null
    flushSync(navegarYa)
    if (scroll === 0) irAlScroll(0)
    else void destinoListo(TOPE_DEL_DESTINO * 3).then(() => irAlScroll(scroll))
    return
  }

  correrPasaje(direccion, compartidos, async () => {
    flushSync(navegarYa)
    await destinoListo(TOPE_DEL_DESTINO)
    return scroll
  })
}

/**
 * Navegar con pasaje, cuando corresponde.
 *
 * `irA(destino, { direccion })` hace un corte cuando no hay View Transitions,
 * con movimiento reducido o con el esfuerzo de por medio, y un pasaje en todo
 * lo demás.
 *
 * El `flushSync` adentro de `startViewTransition` no es un adorno: la API
 * saca la foto del estado nuevo cuando la callback termina, y React por
 * defecto agenda la actualización para después. Sin `flushSync` la foto sale
 * del estado viejo y el pasaje no muestra nada. Por lo mismo el router va con
 * `useTransitions={false}` (`main.tsx`): una navegación adentro de
 * `startTransition` no la apura ni `flushSync`.
 */
export function useIrA(): (destino: string, opciones: OpcionesDelPasaje) => void {
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const desde = useRef(pathname)
  desde.current = pathname
  return useCallback((destino, opciones) => irA(navegar, desde.current, destino, opciones), [navegar])
}

/**
 * "Volver" de una subpantalla: el atrás de la historia, con el pasaje a la
 * superficie y el scroll donde lo habías dejado.
 *
 * Si no hay adónde volver adentro de la app —se abrió directo en esta
 * pantalla—, va a `respaldo` reemplazando la entrada, para no sacar a nadie
 * de la app con un atrás.
 */
export function useVolver(): (respaldo: string) => void {
  const irA = useIrA()
  return useCallback(
    (respaldo) => {
      const indice = (window.history.state as { idx?: number } | null)?.idx ?? 0
      if (indice < 1) {
        irA(respaldo, { direccion: 'superficie', reemplazar: true })
        return
      }
      const desde = rutaActual()
      memoriaDeScroll.set(desde, window.scrollY)
      enCurso?.skipTransition()

      const atras = async () => {
        volviendo = true
        try {
          const llego = lugarNuevo(TOPE_DEL_DESTINO * 3)
          window.history.back()
          await llego
        } finally {
          volviendo = false
        }
        await destinoListo(TOPE_DEL_DESTINO)
        return memoriaDeScroll.get(rutaActual()) ?? 0
      }

      if (!hayPasaje(desde, respaldo, 'superficie')) {
        enCurso = null
        void atras().then(irAlScroll)
        return
      }
      correrPasaje('superficie', [], atras)
    },
    [irA],
  )
}

/**
 * Cambiar de paso adentro de una misma pantalla —los pasos del alta—, con el
 * pasaje de paso. `cambiar` es el `setState` del paso, y corre adentro de
 * `flushSync` para que la foto nueva lo tenga.
 */
export function usePasoConPasaje(): (
  direccion: 'paso-adelante' | 'paso-atras',
  cambiar: () => void,
  compartidos?: Compartidos,
) => void {
  const { pathname } = useLocation()
  const aca = useRef(pathname)
  aca.current = pathname
  return useCallback((direccion, cambiar, compartidos) => {
    enCurso?.skipTransition()
    if (!hayPasaje(aca.current, aca.current, direccion)) {
      enCurso = null
      flushSync(cambiar)
      irAlScroll(0)
      return
    }
    correrPasaje(direccion, compartidos ?? [], async () => {
      flushSync(cambiar)
      return 0
    })
  }, [])
}

/**
 * Un enlace de verdad —`<a href>`, que se puede abrir en otra pestaña y que
 * los portones encuentran por su `href`— que al tocarlo navega con pasaje.
 *
 * `compartidos` recibe el enlace tocado, para nombrar lo que viaja desde
 * adentro de esa fila y no de otra.
 */
export function LinkConPasaje({
  a,
  direccion,
  compartidos,
  estado,
  replace,
  onClick,
  ...resto
}: Omit<LinkProps, 'to' | 'state'> & {
  a: string
  direccion: Direccion
  compartidos?: (enlace: HTMLAnchorElement) => Compartidos
  estado?: unknown
}) {
  const ir = useIrA()
  return (
    <Link
      to={a}
      replace={replace}
      {...resto}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        ir(a, { direccion, compartidos: compartidos?.(e.currentTarget), estado, reemplazar: replace })
      }}
    />
  )
}
