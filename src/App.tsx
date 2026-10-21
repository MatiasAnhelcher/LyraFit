import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout } from './componentes/Layout'
import { useAplicarMovimiento, useAvisarLugar, useCargando } from './componentes/movimiento'
import { Rotulo } from './componentes/ui'
import { Hoy } from './pantallas/hoy/Hoy'
import { Entrenar } from './pantallas/entrenar/Entrenar'
import { Reloj } from './pantallas/reloj/Reloj'
import { Alta } from './pantallas/Alta'
import { Estado } from './pantallas/Estado'
import { Molestia } from './pantallas/Molestia'
import { Diario } from './pantallas/Diario'
import { Biblioteca } from './pantallas/Biblioteca'
import { FichaEjercicio } from './pantallas/FichaEjercicio'
import { Ajustes } from './pantallas/ajustes/Ajustes'
import { HojaDeFiguras } from './pantallas/HojaDeFiguras'
import { leerPreferencias } from './datos/repositorio'
import { movimientoGuardado } from './dominio/movimiento'

// Progreso es la única pantalla que usa la librería de gráficos, y esa
// librería pesa más que todo el resto de la app junta. Cargándola aparte, el
// arranque queda liviano: quien abre la app para entrenar no baja el código de
// los gráficos hasta que entra a mirarlos.
let moduloDeProgreso: typeof import('./pantallas/Progreso') | null = null
const pedirProgreso = () =>
  import('./pantallas/Progreso').then((m) => {
    moduloDeProgreso = m
    return m
  })
const ProgresoPerezoso = lazy(() => pedirProgreso().then((m) => ({ default: m.Progreso })))

/**
 * Progreso, sin suspender si su trozo ya llegó.
 *
 * `lazy` suspende la primera vez que se dibuja aunque el módulo ya esté en
 * memoria —no lo sabe hasta pedirlo—, y React tarda en volver a mostrar lo
 * que suspendió. Adentro de un pasaje eso era una foto nueva con
 * "CARGANDO…" y la pantalla apareciendo después, ya sin pasaje.
 */
function PantallaDeProgreso() {
  if (moduloDeProgreso) return <moduloDeProgreso.Progreso />
  return (
    <Suspense fallback={<Cargando />}>
      <ProgresoPerezoso />
    </Suspense>
  )
}

/**
 * Y el trozo de Progreso se pide igual, apenas Hoy está dibujado y el
 * teléfono no tiene otra cosa que hacer. Ya está en el precache, así que no
 * es red sino leerlo y compilarlo: hecho en un rato libre, el pasaje a
 * Progreso no lo tiene que esperar.
 */
let progresoPedido = false
function usePrecargarProgreso(enHoy: boolean) {
  useEffect(() => {
    if (!enHoy || progresoPedido) return
    progresoPedido = true
    const pedir = () => void pedirProgreso()
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(pedir)
    else window.setTimeout(pedir, 1)
  }, [enHoy])
}

function Cargando() {
  useCargando()
  return (
    <p className="py-16 text-center">
      <Rotulo>CARGANDO…</Rotulo>
    </p>
  )
}

/**
 * El portero del alta.
 *
 * Quien nunca configuró nada va al test de nivel antes que a cualquier otra
 * cosa. Sin esto, todo el mundo arranca en flexiones contra la pared, que es
 * la fuga más grande que tenía la app.
 *
 * Mientras las preferencias no llegaron no se decide nada: redirigir con datos
 * a medias mandaría al alta a alguien que ya la hizo.
 */
function Portero({ children }: { children: React.ReactNode }) {
  const preferencias = useLiveQuery(leerPreferencias, [])
  const lugar = useLocation()
  // El movimiento se aplica antes de la primera pantalla, con lo guardado.
  const movimientoAplicado = useAplicarMovimiento(preferencias && movimientoGuardado(preferencias))

  if (!preferencias || !movimientoAplicado) return <Cargando />
  if (!preferencias.altaCompletadaEn && lugar.pathname !== '/alta') {
    return <Navigate to="/alta" replace />
  }
  return <>{children}</>
}

export function App() {
  useAvisarLugar()
  usePrecargarProgreso(useLocation().pathname === '/')
  return (
    <Portero>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Hoy />} />
          <Route path="/estado" element={<Estado />} />
          <Route path="/molestia" element={<Molestia />} />
          <Route path="/diario" element={<Diario />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          {/* La hoja de contacto de los dibujos, solo en desarrollo: es una
              herramienta de taller y no tiene por qué viajar al teléfono de
              nadie. `import.meta.env.DEV` lo resuelve en tiempo de compilación,
              así que en producción la ruta ni siquiera existe. */}
          {import.meta.env.DEV && (
            <Route path="/figuras" element={<HojaDeFiguras />} />
          )}
          <Route path="/biblioteca/:id" element={<FichaEjercicio />} />
          <Route path="/progreso" element={<PantallaDeProgreso />} />
          <Route path="/ajustes" element={<Ajustes />} />
        </Route>

        {/* El alta y la sesión van a pantalla completa, sin la barra de
            navegación: mientras entrenás no hay nada más que hacer en la app,
            y mientras te das de alta tampoco. */}
        <Route path="/alta" element={<Alta />} />
        <Route path="/entrenar" element={<Entrenar />} />
        {/* El reloj también va a pantalla completa: en un tabata la barra de
            navegación no se toca, y lo que hay que ver tiene que ser lo único
            que se ve. */}
        <Route path="/reloj" element={<Reloj />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Portero>
  )
}
