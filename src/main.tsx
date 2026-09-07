import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import './estilos.css'

// Se usa HashRouter y no BrowserRouter a propósito: así la app anda igual en
// GitHub Pages, en un subdirectorio o abierta desde un archivo, sin necesidad
// de configurar redirecciones en el servidor.

/**
 * Le pide al navegador que no borre la base.
 *
 * Esto importa más acá que en casi cualquier otra app: no hay servidor, así que
 * IndexedDB no es una copia de los datos, es la única. Sin este pedido el
 * navegador puede desalojarlos cuando le falta espacio, y Safari directamente
 * borra el almacenamiento de un sitio no instalado tras unos días sin visitarlo
 * — alguien que entrena en el parque y no agregó la app a la pantalla de inicio
 * puede volver de vacaciones y encontrar el historial vacío.
 *
 * El permiso se concede solo en algunos casos (app instalada, uso frecuente,
 * marcador), así que esto es un pedido, no una garantía: la copia de seguridad
 * de Ajustes sigue siendo la red que sostiene todo.
 */
async function pedirPersistencia(): Promise<void> {
  try {
    if (!navigator.storage?.persist) return
    if (await navigator.storage.persisted()) return
    await navigator.storage.persist()
  } catch {
    // Un navegador que no deja preguntar no es motivo para no arrancar.
  }
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
