import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layout } from './componentes/Layout'
import { Rotulo } from './componentes/ui'
import { Hoy } from './pantallas/Hoy'
import { Entrenar } from './pantallas/Entrenar'
import { Alta } from './pantallas/Alta'
import { Estado } from './pantallas/Estado'
import { Biblioteca } from './pantallas/Biblioteca'
import { FichaEjercicio } from './pantallas/FichaEjercicio'
import { Ajustes } from './pantallas/Ajustes'
import { leerPreferencias } from './datos/repositorio'
import { useTema } from './hooks/useTema'

// Progreso es la única pantalla que usa la librería de gráficos, y esa
// librería pesa más que todo el resto de la app junta. Cargándola aparte, el
// arranque queda liviano: quien abre la app para entrenar no baja el código de
// los gráficos hasta que entra a mirarlos.
const Progreso = lazy(() =>
  import('./pantallas/Progreso').then((m) => ({ default: m.Progreso })),
)

function Cargando() {
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

  if (!preferencias) return <Cargando />
  if (!preferencias.altaCompletadaEn && lugar.pathname !== '/alta') {
    return <Navigate to="/alta" replace />
  }
  return <>{children}</>
}

export function App() {
  useTema()

  return (
    <Portero>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Hoy />} />
          <Route path="/estado" element={<Estado />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/biblioteca/:id" element={<FichaEjercicio />} />
          <Route
            path="/progreso"
            element={
              <Suspense fallback={<Cargando />}>
                <Progreso />
              </Suspense>
            }
          />
          <Route path="/ajustes" element={<Ajustes />} />
        </Route>

        {/* El alta y la sesión van a pantalla completa, sin la barra de
            navegación: mientras entrenás no hay nada más que hacer en la app,
            y mientras te das de alta tampoco. */}
        <Route path="/alta" element={<Alta />} />
        <Route path="/entrenar" element={<Entrenar />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Portero>
  )
}
