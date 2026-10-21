import { useCallback, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { nombreDeLaPantalla } from '@/hooks/useTituloYFoco'
import { IconoAjustes, IconoCadenas, IconoDiario, IconoHoy, IconoProgreso } from './iconos'
import { subirAlPrincipio, useAcompanante, useIrA, type Acompanante } from './movimiento'

/**
 * El armazón: contenido arriba, nomenclatura abajo.
 *
 * ## La barra, y por qué mide lo que mide
 *
 * La barra va abajo porque la app se usa con una mano y el pulgar no llega
 * cómodo a la parte de arriba de un teléfono grande. El `safe-area-inset` es
 * lo que evita que el último renglón quede tapado por la barra de gestos.
 *
 * Mide 56 y no 48: cada pestaña es un blanco de 72×56 a 360, que se acierta
 * con el pulgar sin mirar. Esos 8 píxeles salieron de Hoy y no de la barra:
 * `Empezar` va en el dock, que lo pega a 16 de la barra cuando su lugar queda
 * abajo del pliegue, y `pliegue.mjs` lo mide en cada corrida.
 *
 * ## Por qué hay íconos
 *
 * Cinco rótulos de texto solos en 320 px son cinco palabras cortadas. El
 * ícono no reemplaza al rótulo, lo acompaña, y los íconos son de esta app (un
 * amanecer, unos eslabones, un plato y una luna), no un juego genérico.
 *
 * ## La sección activa
 *
 * Va en tinta, y la marca —un trazo de 22×2 sobre el filete— dice cuál es.
 * Cadenas y el Diario toman además la luz de su dominio: es el único lugar de
 * la app donde esa luz aparece chica, y dice en qué mundo estás sin una
 * palabra de más. Hoy no tiene dominio propio a propósito: contiene a los
 * cuatro.
 *
 * La marca no es menta ni coral. La menta es lo que hay que hacer ahora y el
 * coral es de Lyra, y la barra aparece en todas las pantallas: si se los
 * comiera, no quedarían para lo que de verdad importa.
 */

const SECCIONES = [
  { a: '/', etiqueta: 'Hoy', Icono: IconoHoy, luz: null },
  { a: '/biblioteca', etiqueta: 'Cadenas', Icono: IconoCadenas, luz: 'fuerza' },
  { a: '/diario', etiqueta: 'Diario', Icono: IconoDiario, luz: 'comida' },
  { a: '/progreso', etiqueta: 'Progreso', Icono: IconoProgreso, luz: null },
  { a: '/ajustes', etiqueta: 'Ajustes', Icono: IconoAjustes, luz: null },
] as const

/** Las pantallas a pantalla completa, sin barra. */
const SIN_BARRA = ['/entrenar', '/reloj', '/alta']

/**
 * De qué sección es una pantalla. El chequeo y la molestia se abren desde Hoy
 * y vuelven a Hoy, así que son de Hoy; la ficha es de Cadenas.
 */
function seccionDe(ruta: string): number {
  const i = SECCIONES.findIndex(({ a }) => a !== '/' && (ruta === a || ruta.startsWith(`${a}/`)))
  return i === -1 ? 0 : i
}

export function Layout() {
  const irA = useIrA()
  const lugar = useLocation()
  const activa = seccionDe(lugar.pathname)
  const carril = useRef<HTMLSpanElement>(null)

  // La marca viaja en cada cambio de sección, toque quien toque: la barra o
  // una fila de Hoy que lleva al Diario.
  //
  // Lo que viaja no es la marca sino su carril, que mide lo mismo antes y
  // después: un elemento compartido que cambia de lugar le cuesta a Chrome
  // recalcular el estilo de toda la página una vez más, justo en el primer
  // cuadro del movimiento, y en Hoy o Ajustes, con la CPU de un teléfono
  // de gama baja, eso es un tirón. El CSS del pasaje corre la foto nueva del
  // carril desde la pestaña de origen, y para eso necesita saber cuántas
  // pestañas hay entre las dos.
  const conLaMarca = useCallback<Acompanante>((desde, destino) => {
    if (SIN_BARRA.includes(destino)) return null
    const pestanas = seccionDe(desde) - seccionDe(destino)
    return pestanas === 0
      ? null
      : { origen: carril.current, nombre: 'lf-nav-marca', datos: { marcaDesde: String(pestanas) } }
  }, [])
  useAcompanante(conLaMarca)

  return (
    <div className="min-h-dvh">
      <EncabezadoCompacto
        nombre={nombreDeLaPantalla(lugar.pathname)}
        luz={SECCIONES[activa]?.luz ?? null}
      />

      <main className="principal">
        <Outlet />
      </main>

      {/* `marco-fijo` le pone nombre de View Transition: la barra NO participa
          del pasaje entre pantallas. Un marco que se desvanece en cada toque
          convierte la app en una presentación. */}
      <nav className="marco-fijo barra" aria-label="Secciones">
        <div className="barra-pestanas">
          <ul>
            {SECCIONES.map(({ a, etiqueta, Icono, luz }, i) => (
              <li key={a}>
                <NavLink
                  to={a}
                  end={a === '/'}
                  onClick={(e) => {
                    // El pasaje lo dispara el hook, no el router: con
                    // `HashRouter` la prop `viewTransition` del router no hace
                    // nada, y una transición que no ocurre es peor que ninguna
                    // porque nadie se entera de que no está.
                    e.preventDefault()
                    // La pestaña de la pantalla en la que estás sube al
                    // principio; desde una subpantalla, vuelve a la sección.
                    if (lugar.pathname === a) subirAlPrincipio()
                    else if (i === activa) irA(a, { direccion: 'superficie' })
                    else irA(a, { direccion: i > activa ? 'lateral-der' : 'lateral-izq' })
                  }}
                  data-prueba={`nav-${etiqueta.toLowerCase()}`}
                  data-activa={i === activa || undefined}
                  data-luz={luz ?? undefined}
                  className="pestana"
                >
                  <Icono className="pestana-icono" />
                  <span className="etiqueta-barra">{etiqueta}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          <span ref={carril} className="barra-carril" aria-hidden="true">
            <span className="barra-marca" style={{ '--pestana': activa } as CSSProperties} />
          </span>
        </div>
      </nav>
    </div>
  )
}

/**
 * La franja de arriba: el nombre de la pantalla, cuando su título ya quedó
 * atrás. La dispara un IntersectionObserver sobre el título visible —el `h1`,
 * o la cifra en Hoy, donde el `h1` es para el lector— y no el scroll: no
 * corre nada en cada cuadro.
 *
 * Tocarla sube al principio, como tocar la pestaña activa: es el mismo gesto
 * que en cualquier teléfono, y quien no la ve tiene la pestaña.
 */
function EncabezadoCompacto({ nombre, luz }: { nombre: string | null; luz: string | null }) {
  const franja = useRef<HTMLDivElement>(null)
  const { key } = useLocation()

  useLayoutEffect(() => {
    const el = franja.current
    const principal = document.querySelector('main')
    if (!el || !principal) return

    // Cada pantalla llega con la franja escondida y en seco, y el primer
    // aviso del observador también va en seco: si el título de la que llega
    // ya está atrás —una sección que vuelve adonde la dejaste—, la franja
    // llega con la pantalla y no se funde encima de ella.
    el.setAttribute('data-instante', '')
    el.removeAttribute('data-visible')

    let titulo: Element | null = null
    let observador: IntersectionObserver | null = null
    const mirar = () => {
      const nuevo =
        principal.querySelector('h1:not(.sr-only)') ??
        principal.querySelector('.cifra-identidad') ??
        principal.querySelector('.rotulo')
      if (nuevo === titulo) return
      observador?.disconnect()
      titulo = nuevo
      if (!titulo) return
      // El título queda atrás cuando sale entero por arriba de la pantalla,
      // y no cuando entra en la franja: varios títulos viven, quietos, en
      // los primeros 44 píxeles, y la franja los taparía al llegar.
      observador = new IntersectionObserver(([visto]) => {
        if (!visto) return
        const atras = visto.boundingClientRect.bottom <= (visto.rootBounds?.top ?? 0) + 0.5
        el.toggleAttribute('data-visible', !visto.isIntersecting && atras)
        if (el.hasAttribute('data-instante')) {
          // El estilo se resuelve con la transición todavía apagada, y
          // recién después se prende. Acá la pantalla ya se dibujó y lo único
          // pendiente es la franja: no es el recálculo de la página entera
          // que costaría hacerlo al montar, adentro del pasaje.
          void getComputedStyle(el).opacity
          el.removeAttribute('data-instante')
        }
      })
      observador.observe(titulo)
    }
    // El título llega con el contenido, y la pantalla puede cambiarlo sin
    // cambiar de ruta (una ficha a la siguiente): se vuelve a buscar cuando
    // cambia lo que hay adentro de `main`.
    const cambios = new MutationObserver(mirar)
    cambios.observe(principal, { childList: true, subtree: true })
    mirar()
    return () => {
      cambios.disconnect()
      observador?.disconnect()
    }
  }, [key])

  return (
    <div
      ref={franja}
      className="encabezado-compacto"
      data-luz={luz ?? undefined}
      aria-hidden="true"
      onClick={subirAlPrincipio}
    >
      <p className="rotulo">{nombre}</p>
    </div>
  )
}
