import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import './estilos.css'

// Se usa HashRouter y no BrowserRouter a propósito: así la app anda igual en
// GitHub Pages, en un subdirectorio o abierta desde un archivo, sin necesidad
// de configurar redirecciones en el servidor.

const contenedor = document.getElementById('root')
if (!contenedor) throw new Error('No se encontró el elemento raíz.')

createRoot(contenedor).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
