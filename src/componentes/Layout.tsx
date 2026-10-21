import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { IconoAjustes, IconoCadenas, IconoDiario, IconoHoy, IconoProgreso } from './iconos'
import { useIrA } from './movimiento'

/**
 * El armazón: contenido arriba, nomenclatura abajo.
 *
 * ## La barra, y por qué mide lo que mide
 *
 * La barra va abajo porque la app se usa con una mano y el pulgar no llega
 * cómodo a la parte de arriba de un teléfono grande. El `safe-area-inset` es
 * lo que evita que el último renglón quede tapado por la barra de gestos.
 *
 * **Su alto es un presupuesto, no una decisión de diseño.** En un Android de
 * 360×640 el botón `Empezar` de Hoy termina a exactamente DOCE píxeles de esta
 * barra: no hay un píxel de sobra, y la regresión de que `Empezar` quede
 * tapado ya pasó tres veces. Por eso los íconos entraron con el relleno
 * recortado en vez de agregado, y por eso `pliegue.mjs` mide esto en cada
 * corrida. Si mañana hay que agregar algo acá, primero hay que sacar alto de
 * Hoy — no al revés.
 *
 * ## Por qué ahora sí hay íconos
 *
 * El comentario que estaba acá decía "sin íconos: en este sistema la
 * navegación es rotulado de lámina, no una fila de pictogramas". Era una buena
 * regla para cuatro secciones y deja de serlo con cinco: cinco rótulos de
 * texto en 320 px son cinco palabras cortadas. El ícono no reemplaza al
 * rótulo, lo acompaña — y los íconos son de esta app (un amanecer, unos
 * eslabones, un plato y una luna), no el juego genérico que vivía sin usar en
 * `iconos.tsx` desde hacía meses.
 *
 * ## El color de la sección activa
 *
 * La sección activa toma la LUZ DE SU DOMINIO, y es el único lugar de la app
 * donde esa luz aparece chica. Es lo que hace que la barra diga en qué mundo
 * estás sin una sola palabra de más. Hoy no tiene dominio propio a propósito:
 * contiene a los cuatro, así que se marca en tinta plena.
 *
 * Vega no aparece acá. El acento está racionado a tres apariciones por
 * pantalla y la navegación aparece en todas: si se la comiera la barra, no
 * quedaría para lo que de verdad importa.
 */

const SECCIONES = [
  { a: '/', etiqueta: 'Hoy', Icono: IconoHoy, dominio: null },
  { a: '/biblioteca', etiqueta: 'Cadenas', Icono: IconoCadenas, dominio: 'fuerza' },
  { a: '/diario', etiqueta: 'Diario', Icono: IconoDiario, dominio: 'comida' },
  { a: '/progreso', etiqueta: 'Progreso', Icono: IconoProgreso, dominio: null },
  { a: '/ajustes', etiqueta: 'Ajustes', Icono: IconoAjustes, dominio: null },
] as const

export function Layout() {
  const irA = useIrA()
  const lugar = useLocation()

  return (
    <div className="min-h-dvh">
      <main
        className="mx-auto w-full max-w-2xl px-4 pt-8"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </main>

      {/* `marco-fijo` le pone nombre de View Transition: la barra NO participa
          del pasaje entre pantallas. Un marco que se desvanece en cada toque
          convierte la app en una presentación. */}
      <nav
        className="marco-fijo fixed inset-x-0 bottom-0 border-t border-[var(--color-regla-fuerte)] bg-[var(--color-fondo)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Secciones"
      >
        <ul className="mx-auto flex w-full max-w-2xl">
          {SECCIONES.map(({ a, etiqueta, Icono, dominio }) => {
            const activa = a === '/' ? lugar.pathname === '/' : lugar.pathname.startsWith(a)
            return (
              <li key={a} className="flex-1">
                <NavLink
                  to={a}
                  end={a === '/'}
                  onClick={(e) => {
                    // El pasaje lo dispara el hook, no el router: con
                    // `HashRouter` la prop `viewTransition` del router no hace
                    // nada, y una transición que no ocurre es peor que ninguna
                    // porque nadie se entera de que no está.
                    e.preventDefault()
                    if (!activa) irA(a)
                  }}
                  {...(activa ? { 'aria-current': 'page' as const } : {})}
                  data-prueba={`nav-${etiqueta.toLowerCase()}`}
                  className="flex flex-col items-center justify-center gap-[3px] pt-2 pb-[7px]"
                  style={
                    activa
                      ? {
                          boxShadow: 'inset 0 2px 0 0 currentColor',
                          color: dominio
                            ? `var(--dominio-${dominio}-luz)`
                            : 'var(--color-tinta)',
                        }
                      : { color: 'var(--color-glosa)' }
                  }
                >
                  <Icono className="h-[18px] w-[18px]" />
                  <span className="etiqueta-barra">{etiqueta}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
