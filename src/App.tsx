import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './componentes/Layout'
import { Hoy } from './pantallas/Hoy'
import { Entrenar } from './pantallas/Entrenar'
import { Biblioteca } from './pantallas/Biblioteca'
import { FichaEjercicio } from './pantallas/FichaEjercicio'
import { Ajustes } from './pantallas/Ajustes'
import { useTema } from './hooks/useTema'

// Progreso es la única pantalla que usa la librería de gráficos, y esa
// librería pesa más que todo el resto de la app junta. Cargándola aparte, el
// arranque queda liviano: quien abre la app para entrenar no baja el código de
// los gráficos hasta que entra a mirarlos.
const Progreso = lazy(() =>
  import('./pantallas/Progreso').then((m) => ({ default: m.Progreso })),
)

function Cargando() {
  return <p className="py-16 text-center text-[var(--color-texto-suave)]">Cargando…</p>
}

export function App() {
  useTema()

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Hoy />} />
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
      {/* La sesión de entrenamiento va a pantalla completa, sin la barra de
          navegación: mientras entrenás no hay nada más que hacer en la app. */}
      <Route path="/entrenar" element={<Entrenar />} />
    </Routes>
  )
}
