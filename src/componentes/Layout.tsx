import { NavLink, Outlet } from 'react-router-dom'
import {
  IconoAjustes,
  IconoBiblioteca,
  IconoHoy,
  IconoProgreso,
} from './iconos'

const SECCIONES = [
  { a: '/', etiqueta: 'Hoy', Icono: IconoHoy },
  { a: '/biblioteca', etiqueta: 'Ejercicios', Icono: IconoBiblioteca },
  { a: '/progreso', etiqueta: 'Progreso', Icono: IconoProgreso },
  { a: '/ajustes', etiqueta: 'Ajustes', Icono: IconoAjustes },
]

/**
 * El armazón de la app: contenido arriba, navegación abajo.
 *
 * La barra va abajo porque la app se usa con una mano y el pulgar no llega
 * cómodo a la parte superior de un teléfono grande. El `padding-bottom` con
 * `safe-area-inset` es lo que evita que el último botón quede tapado por la
 * barra de gestos del iPhone.
 */
export function Layout() {
  return (
    <div className="min-h-dvh bg-[var(--color-fondo)]">
      <main
        className="mx-auto w-full max-w-2xl px-4 pt-6"
        style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 border-t border-[var(--color-borde)] bg-[var(--color-fondo)]/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Secciones"
      >
        <ul className="mx-auto flex w-full max-w-2xl">
          {SECCIONES.map(({ a, etiqueta, Icono }) => (
            <li key={a} className="flex-1">
              <NavLink
                to={a}
                end={a === '/'}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center gap-1 py-3 text-[0.7rem] font-medium transition-colors',
                    isActive
                      ? 'text-[var(--color-acento)]'
                      : 'text-[var(--color-texto-suave)]',
                  ].join(' ')
                }
              >
                <Icono className="h-6 w-6" />
                {etiqueta}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
