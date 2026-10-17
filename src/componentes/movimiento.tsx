/**
 * La gramática del movimiento, del lado de JavaScript.
 *
 * El CSS tiene las seis primitivas (`estilos.css`, sección 7). Acá están las
 * dos cosas que el CSS no puede hacer solo: disparar el pasaje entre
 * pantallas, y decidir cuándo NO dispararlo.
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
 * resortes y la View Transitions API para el pasaje.
 */

import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, type NavigateOptions } from 'react-router-dom'

/**
 * Las tres pantallas donde el pasaje está PROHIBIDO.
 *
 * No es una preferencia estética. A 140 pulsaciones, 320 ms de deslizamiento
 * se perciben como una app trabada, y las tres son pantallas donde la persona
 * está en esfuerzo o saliendo de él. La prohibición vive acá, en un solo
 * lugar, y no repartida en cada botón que navega.
 */
const SIN_PASAJE = ['/entrenar', '/reloj']

function destinoProhibido(a: string): boolean {
  return SIN_PASAJE.some((p) => a === p || a.startsWith(`${p}/`))
}

function origenProhibido(): boolean {
  const pantalla = document.documentElement.dataset.pantalla
  return pantalla === 'entrenar' || pantalla === 'cierre'
}

/** Si el navegador no la tiene, no pasa nada: queda el corte duro de siempre. */
function hayTransiciones(): boolean {
  return typeof document !== 'undefined' && typeof document.startViewTransition === 'function'
}

function quiereQuieto(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Navegar con pasaje, cuando corresponde.
 *
 * Devuelve una función con la misma firma que `useNavigate`, así cambiar un
 * sitio de llamada es cambiar el nombre del hook y nada más.
 *
 * El `flushSync` adentro de `startViewTransition` no es un adorno: la API
 * saca la foto del estado nuevo cuando la callback termina, y React por
 * defecto agenda la actualización para después. Sin `flushSync` la foto sale
 * del estado viejo y la transición no muestra nada.
 */
export function useIrA(): (a: string, opciones?: NavigateOptions) => void {
  const navegar = useNavigate()

  return useCallback(
    (a, opciones) => {
      if (!hayTransiciones() || quiereQuieto() || origenProhibido() || destinoProhibido(a)) {
        navegar(a, opciones)
        return
      }
      document.startViewTransition(() => {
        flushSync(() => navegar(a, opciones))
      })
    },
    [navegar],
  )
}

/**
 * El índice de una fila, para que entre escalonada.
 *
 * Se devuelve como objeto de estilo y no como clase porque el valor es un
 * número: `style={orden(i)}` en el JSX y la clase `entrar-en-orden` hace el
 * resto. Más de doce filas no escalonan — a partir de ahí la última entraría
 * casi medio segundo tarde, y lo que era orden pasa a ser espera.
 */
export function orden(i: number): React.CSSProperties {
  return { ['--orden' as string]: Math.min(i, 11) }
}
