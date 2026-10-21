import { comoReloj } from '@/hooks/useTemporizador'
import type { PasoDelPlan } from './usePlanDeLaSesion'

/**
 * Lo de arriba de la sesión: la salida, el cronómetro, cuánto falta y, si la
 * sesión se retomó, el aviso.
 *
 * Son tres piezas sueltas y no una caja: van directo en la columna de la
 * pantalla, que es la que reparte el alto.
 */
export function Encabezado({
  duracion,
  plan,
  enCurso,
  retomada,
  onSalir,
  onEmpezarDeCero,
}: {
  /** Los segundos que lleva la sesión. */
  duracion: number
  plan: PasoDelPlan[]
  /** Qué ejercicio del plan está en curso, empezando en cero. */
  enCurso: number
  retomada: boolean
  onSalir: () => void
  onEmpezarDeCero: () => void
}) {
  return (
    <>
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={onSalir} className="rotulo">
          Salir
        </button>
        <p className="cifra text-sm text-[var(--color-glosa)]" data-prueba="cronometro">
          {comoReloj(duracion)}
        </p>
      </header>

      <div className="flex gap-px px-4">
        {plan.map((p, i) => (
          <div
            key={p.ejercicio.id}
            className="h-0.5 flex-1"
            style={{
              backgroundColor: i <= enCurso ? 'var(--color-vega)' : 'var(--color-regla)',
              opacity: i < enCurso ? 0.5 : 1,
            }}
          />
        ))}
      </div>

      {/* El único aviso de que esto se retomó. Va acá y no en un cartel: lo
          que hay que comunicar es "no perdiste nada", y para eso alcanza con
          que las series ya anotadas estén en su lugar. El botón es para el
          otro caso, el que salió a propósito y quiere arrancar limpio. */}
      {retomada && (
        <p className="rotulo mt-3 flex items-center justify-between gap-3 px-4">
          <span>sesión retomada donde la dejaste</span>
          <button onClick={onEmpezarDeCero} className="underline underline-offset-4">
            empezar de cero
          </button>
        </p>
      )}
    </>
  )
}
