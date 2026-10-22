/**
 * Lo que el armazón de la sesión hace solo: apretar la serie cuando no entra,
 * y llevar el foco al encabezado de cada estado nuevo.
 */

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { crearAnunciador } from './anuncios'

/**
 * La compresión de la serie (§7.4): `data-apretado` en `main`, de 0 a 5.
 *
 * Mide de verdad en vez de suponer por el alto de la pantalla, porque lo que
 * decide si entra es la combinación —la víspera de dos renglones, los kilos,
 * la retomada, el nombre largo, la letra del teléfono—, y ninguna regla por
 * media query la ve entera. Los niveles se acumulan y se mide de nuevo
 * después de cada uno:
 *
 * - N1 y N2 ("la vez pasada" a `sr-only`, la cifra más chica) se aplican si
 *   `main` scrollea: son para que entre la secundaria.
 * - N3 a N5 (la víspera y el título a un renglón, los nodos más chicos) solo
 *   si el número —o los kilos, si los hay— pasa el borde visible de `main`:
 *   la secundaria puede quedar en el scroll, el número no.
 *
 * El atributo se pone en el DOM y no en el estado de React: es una medición
 * del cuadro, y como estado haría un render más por nivel. Corre antes de
 * pintar, así que nunca se ve la versión sin apretar.
 */
export function useApretado(principal: RefObject<HTMLElement | null>, activo: boolean, clave: string) {
  useLayoutEffect(() => {
    const main = principal.current
    if (!main) return
    if (!activo) {
      main.dataset.apretado = '0'
      return
    }
    const scrollea = () => main.scrollHeight > main.clientHeight + 0.5
    const elNumeroNoSeVe = () => {
      const pieza = main.querySelector('[data-medir="kilos"]') ?? main.querySelector('[data-medir="numero"]')
      if (!pieza) return false
      // En coordenadas del contenido: como si `main` estuviera arriba de todo.
      const fondo = pieza.getBoundingClientRect().bottom - main.getBoundingClientRect().top + main.scrollTop
      return fondo > main.clientHeight + 0.5
    }
    const medir = () => {
      main.dataset.apretado = '0'
      for (let nivel = 1; nivel <= 5; nivel++) {
        if (!(nivel <= 2 ? scrollea() : elNumeroNoSeVe())) break
        main.dataset.apretado = String(nivel)
      }
    }
    medir()
    // Cambia el alto de `main` si cambia la letra o gira el teléfono, y
    // cambia el contenido cuando llega Sora: las dos cosas vuelven a medir.
    const observador = new ResizeObserver(medir)
    observador.observe(main)
    let vigente = true
    void document.fonts?.ready.then(() => {
      if (vigente) medir()
    })
    return () => {
      vigente = false
      observador.disconnect()
    }
  }, [principal, activo, clave])
}

/**
 * Cada estado nuevo de la sesión —la serie, el descanso, el ejercicio
 * completo, la serie de cierre, las preguntas— arranca arriba de todo y con
 * el foco en su encabezado, el elemento con `data-foco` (§7.1): el `h1` en la
 * serie, el rótulo en los demás. Así el lector dice dónde estás y el Tab
 * siguiente arranca de ahí, y no de un botón que ya no existe.
 *
 * `clave` en null es que la sesión todavía no está: el primer valor que llega
 * es la carga, y en la carga el foco no se mueve (lo hace `useTituloYFoco`
 * cuando se llega navegando). Tampoco se mueve con "Cómo se hace" abierto:
 * sacarle el foco a la hoja para dárselo a algo que está detrás no sirve a
 * nadie, y al cerrarla vuelve solo al botón que la abrió.
 */
export function useEstadoNuevo(clave: string | null) {
  const anterior = useRef<string | null>(null)
  useEffect(() => {
    if (clave === null) return
    const antes = anterior.current
    anterior.current = clave
    if (antes === null || antes === clave) return
    document.querySelector('main')?.scrollTo({ top: 0 })
    if (document.querySelector('[role="dialog"]')) return
    const destino = document.querySelector<HTMLElement>('[data-foco]')
    if (!destino) return
    // El `tabindex` hace falta para enfocarlo y se va con el foco: un
    // encabezado enfocable atrapa cada toque que cae en él.
    if (!destino.hasAttribute('tabindex')) {
      destino.setAttribute('tabindex', '-1')
      destino.addEventListener('blur', () => destino.removeAttribute('tabindex'), { once: true })
    }
    destino.focus({ preventScroll: true })
  }, [clave])
}

/**
 * La región viva de la sesión: un solo texto, que se reemplaza o se vacía.
 * Las reglas están en `crearAnunciador`; las funciones son las mismas en
 * cada render, así que se pueden pasar sin envolver.
 */
export function useAnunciador() {
  const [dicho, setDicho] = useState('')
  const [anunciador] = useState(() => crearAnunciador(setDicho))
  return { dicho, ...anunciador }
}
