import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { POR_ID } from '@/dominio/biblioteca'
import { cuandoTengaContenido, pasajeEnCurso } from '@/componentes/movimiento'

/**
 * Cómo se llama cada pantalla: lo que dice la pestaña del navegador y la
 * franja de arriba cuando el título queda atrás.
 *
 * Una subpantalla dice su propio nombre y no el de su sección: en la lista de
 * pestañas, en el selector de apps o en lo que anuncia un lector, "Flexiones
 * inclinadas" dice dónde estás y "Cadenas" no. El alta no tiene nombre propio,
 * y el cierre de la sesión es la misma ruta que la sesión: lo distingue la
 * marca de la pantalla.
 */
export function nombreDeLaPantalla(ruta: string, pantalla: string | null = null): string | null {
  if (ruta === '/') return 'Hoy'
  if (ruta.startsWith('/biblioteca/')) {
    return POR_ID.get(decodeURIComponent(ruta.slice('/biblioteca/'.length)))?.nombre ?? 'Cadenas'
  }
  if (ruta === '/entrenar') return pantalla === 'cierre' ? 'Sesión' : 'Entrenando'
  return NOMBRES[ruta] ?? null
}

const NOMBRES: Record<string, string> = {
  '/biblioteca': 'Cadenas',
  '/diario': 'El diario',
  '/progreso': 'Progreso',
  '/ajustes': 'Ajustes',
  '/estado': '¿Cómo venís hoy?',
  '/molestia': '¿Te molesta algo?',
  '/reloj': 'El reloj',
}

function suscribirLaPantalla(avisar: () => void): () => void {
  const observador = new MutationObserver(avisar)
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-pantalla'] })
  return () => observador.disconnect()
}

const laPantalla = () => document.documentElement.getAttribute('data-pantalla')

/**
 * Si la persona ya tocó algo. Hasta el primer toque o tecla, lo que cambia de
 * ruta es la carga —el portero que manda al alta, por ejemplo—, y en la carga
 * el foco no se mueve: el lector empieza por arriba, como en cualquier página.
 */
let huboGesto = false
if (typeof document !== 'undefined') {
  const marcar = () => {
    huboGesto = true
  }
  document.addEventListener('pointerdown', marcar, { capture: true, once: true })
  document.addEventListener('keydown', marcar, { capture: true, once: true })
}

/**
 * El foco al título de la pantalla nueva, que el lector anuncia, y desde
 * donde arranca el Tab siguiente. Si la pantalla no tiene `h1`, va a su
 * `main`. Sin mover el scroll: volver a una sección es volver adonde estabas,
 * y el título de Hoy es `sr-only`.
 *
 * El `tabindex` que hace falta para enfocarlo se pone acá si la pantalla no
 * lo trae, y se saca cuando el foco se va: un contenedor enfocable atrapa
 * cada toque que cae en él, y eso no tiene que durar más que el anuncio.
 */
function enfocarElTitulo() {
  const principal = document.querySelector('main')
  if (!principal) return
  const titulo = principal.querySelector<HTMLElement>('h1') ?? principal
  if (titulo.closest('[inert]')) return
  if (!titulo.hasAttribute('tabindex')) {
    titulo.setAttribute('tabindex', '-1')
    titulo.addEventListener('blur', () => titulo.removeAttribute('tabindex'), { once: true })
  }
  titulo.focus({ preventScroll: true })
}

/**
 * Una promesa que resuelve cuando la pantalla tiene su `main`, o a los `tope`
 * ms. Casi todas lo traen en el primer cuadro, pero Entrenar dibuja
 * "PREPARANDO LA SESIÓN…" sin `main` mientras lee la base, y enfocar en ese
 * hueco deja el foco en `<body>`.
 */
function cuandoHayaMain(tope: number, corte: AbortSignal): Promise<void> {
  if (document.querySelector('main')) return Promise.resolve()
  return new Promise((resolver) => {
    const terminar = () => {
      observador.disconnect()
      window.clearTimeout(reloj)
      resolver()
    }
    const observador = new MutationObserver(() => {
      if (document.querySelector('main')) terminar()
    })
    observador.observe(document.body, { childList: true, subtree: true })
    const reloj = window.setTimeout(terminar, tope)
    corte.addEventListener('abort', terminar, { once: true })
  })
}

/**
 * El título del documento y el foco, cada vez que cambia la pantalla. Va una
 * sola vez, en `App`.
 *
 * El foco espera a que termine el pasaje, si hay uno: mientras corre, el
 * contenido nuevo está inerte y `focus()` falla callado. Y espera al
 * contenido: sobre el "CARGANDO…" no hay título que enfocar.
 */
export function useTituloYFoco(): void {
  const { pathname, key } = useLocation()
  const pantalla = useSyncExternalStore(suscribirLaPantalla, laPantalla, () => null)

  useLayoutEffect(() => {
    const nombre = nombreDeLaPantalla(pathname, pantalla)
    document.title = nombre ? `${nombre} · LyraFit` : 'LyraFit'
  }, [pathname, pantalla])

  const primera = useRef(true)
  useLayoutEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    if (!huboGesto) return
    const corte = new AbortController()
    const enfocar = () => {
      if (!corte.signal.aborted) enfocarElTitulo()
    }
    const pasaje = pasajeEnCurso()
    const llego = pasaje ? pasaje.finished.catch(() => {}) : Promise.resolve()
    void llego
      .then(() => cuandoHayaMain(1500, corte.signal))
      .then(() => cuandoTengaContenido(360))
      .then(enfocar)
    return () => corte.abort()
  }, [key])
}
