import { NavLink, Outlet } from 'react-router-dom'

const SECCIONES = [
  { a: '/', etiqueta: 'Hoy' },
  { a: '/biblioteca', etiqueta: 'Cadenas' },
  { a: '/progreso', etiqueta: 'Progreso' },
  { a: '/ajustes', etiqueta: 'Ajustes' },
]

/**
 * El armazón: contenido arriba, nomenclatura abajo.
 *
 * La barra va abajo porque la app se usa con una mano y el pulgar no llega
 * cómodo a la parte de arriba de un teléfono grande. El `safe-area-inset` es
 * lo que evita que el último renglón quede tapado por la barra de gestos.
 *
 * Sin íconos y sin desenfoque: en este sistema la navegación es rotulado de
 * lámina, no una fila de pictogramas. Y la sección activa se marca con un
 * filete y con tinta plena, no con Vega — el acento está racionado a tres
 * apariciones por pantalla y la navegación aparece en todas.
 */
export function Layout() {
  return (
    <div className="min-h-dvh">
      <main
        className="mx-auto w-full max-w-2xl px-4 pt-8"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 border-t border-[var(--color-regla-fuerte)] bg-[var(--color-fondo)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Secciones"
      >
        <ul className="mx-auto flex w-full max-w-2xl">
          {SECCIONES.map(({ a, etiqueta }) => (
            <li key={a} className="flex-1">
              <NavLink
                to={a}
                end={a === '/'}
                className={({ isActive }) =>
                  [
                    'rotulo flex items-center justify-center py-4',
                    isActive ? 'text-[var(--color-tinta)]' : '',
                  ].join(' ')
                }
                style={({ isActive }) =>
                  isActive
                    ? { boxShadow: 'inset 0 2px 0 0 var(--color-tinta)' }
                    : undefined
                }
              >
                {etiqueta}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
