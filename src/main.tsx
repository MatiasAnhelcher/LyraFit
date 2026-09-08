import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import './estilos.css'
import { pedirPersistencia } from './datos/respaldo'

// Se usa HashRouter y no BrowserRouter a propósito: así la app anda igual en
// GitHub Pages, en un subdirectorio o abierta desde un archivo, sin necesidad
// de configurar redirecciones en el servidor.

/**
 * Recargar una sola vez cuando entra una versión nueva.
 *
 * El service worker se genera con `skipWaiting` y `clientsClaim`, así que al
 * publicar una versión nueva el worker nuevo toma el control de la pestaña que
 * ya está abierta —una pestaña que sigue corriendo el código viejo—. Y como
 * también corre `cleanupOutdatedCaches`, los trozos viejos desaparecen del
 * cache justo cuando el código viejo todavía los va a pedir: la primera
 * pantalla que se carga por separado, como Progreso, revienta con "Failed to
 * fetch dynamically imported module". Está reproducido sirviendo una versión
 * arriba de la otra en el mismo origen.
 *
 * La salida es recargar: código nuevo pidiendo trozos nuevos, sin mezcla
 * posible. Y recargar acá es barato justamente por otra cosa que la app ya
 * hace — la sesión a medio hacer sobrevive a la recarga y se retoma sola—, así
 * que ni siquiera interrumpe a alguien que esté entrenando.
 *
 * Las dos condiciones importan. `habiaUno` evita el rebote de la primera
 * visita, donde `controller` es null y el evento dispara igual al instalarse
 * por primera vez. `recargando` evita el bucle si el evento llega dos veces.
 */
if ('serviceWorker' in navigator) {
  const habiaUno = navigator.serviceWorker.controller !== null
  let recargando = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaUno || recargando) return
    recargando = true
    window.location.reload()
  })
}

void pedirPersistencia()

const contenedor = document.getElementById('root')
if (!contenedor) throw new Error('No se encontró el elemento raíz.')

createRoot(contenedor).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
