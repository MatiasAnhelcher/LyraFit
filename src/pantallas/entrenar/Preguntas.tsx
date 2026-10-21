import { useState } from 'react'
import { Accion, Rotulo } from '@/componentes/ui'

/** Las preguntas del final. Tres toques, todos opcionales. */
export function Preguntas({
  guardando,
  error,
  onListo,
}: {
  guardando: boolean
  /** Si el último intento de cerrar falló, qué decir. */
  error: string | null
  onListo: (datos: { esfuerzo?: number; animo?: number; vitalidadPost?: number }) => void
}) {
  const [esfuerzo, setEsfuerzo] = useState<number | undefined>()
  const [animo, setAnimo] = useState<number | undefined>()
  const [energia, setEnergia] = useState<number | undefined>()

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-10">
        <Rotulo>ANTES DE CERRAR</Rotulo>

        <Pregunta
          titulo="¿Qué tan dura te resultó?"
          opciones={[
            [2, 'Suave'],
            [4, 'Moderada'],
            [6, 'Exigente'],
            [8, 'Dura'],
            [10, 'Al límite'],
          ]}
          valor={esfuerzo}
          onElegir={setEsfuerzo}
        />

        <Pregunta
          titulo="¿Cómo te sentiste haciéndola?"
          opciones={[
            [-2, 'Mal'],
            [-1, 'Cuesta arriba'],
            [0, 'Neutra'],
            [1, 'Bien'],
            [2, 'Muy bien'],
          ]}
          valor={animo}
          onElegir={setAnimo}
        />

        <Pregunta
          titulo="¿Cuánta energía tenés ahora?"
          // La misma escala de cinco puntos y las mismas etiquetas que el
          // chequeo diario. Si las dos puntas del delta no se miden con la
          // misma vara, el delta no significa nada.
          opciones={[
            [1, 'En el piso'],
            [2, 'Con poca energía'],
            [3, 'Normal'],
            [4, 'Con energía'],
            [5, 'A pleno'],
          ]}
          valor={energia}
          onElegir={setEnergia}
        />

        <p className="mt-8 max-w-[38ch] text-xs leading-relaxed text-[var(--color-glosa)]">
          Nada de esto es obligatorio. Lo usa el motor para no bajarte el objetivo por un mal día,
          y para mostrarte con tus propios datos qué te deja entrenar.
        </p>

        {/* En ámbar, que es el techo de alarma de esta pantalla: el rojo de
            borrar no existe en el entrenamiento. */}
        {error && (
          <p
            role="alert"
            className="mt-6 max-w-[38ch] text-sm leading-relaxed text-[var(--color-ambar)]"
          >
            {error}
          </p>
        )}
      </main>

      <div className="mt-auto">
        <Accion
          esfuerzo
          deshabilitado={guardando}
          onClick={() =>
            onListo({
              ...(esfuerzo !== undefined ? { esfuerzo } : {}),
              ...(animo !== undefined ? { animo } : {}),
              ...(energia !== undefined ? { vitalidadPost: energia } : {}),
            })
          }
        >
          {guardando ? 'Guardando…' : 'Cerrar la sesión'}
        </Accion>
      </div>
    </div>
  )
}

function Pregunta({
  titulo,
  opciones,
  valor,
  onElegir,
}: {
  titulo: string
  opciones: [number, string][]
  valor: number | undefined
  onElegir: (n: number) => void
}) {
  return (
    <section className="mt-8">
      <p className="nombre">{titulo}</p>
      <div className="regleta mt-3" role="group" aria-label={titulo}>
        {opciones.map(([n, etiqueta]) => (
          <button
            key={n}
            onClick={() => onElegir(n)}
            className="flex-1 px-1 py-3 text-[0.6875rem] leading-tight"
            // Lo mismo que un segmento: el borde en regla-fuerte, que es lo que
            // dice que esto se toca, y lo elegido en tinta, no en el acento,
            // que acá es de "Cerrar la sesión".
            style={{
              border: `1px solid ${valor === n ? 'var(--color-tinta)' : 'var(--color-regla-fuerte)'}`,
              backgroundColor: valor === n ? 'var(--color-tinta)' : 'transparent',
              color: valor === n ? 'var(--color-fondo)' : 'var(--color-glosa)',
            }}
          >
            {etiqueta}
          </button>
        ))}
      </div>
    </section>
  )
}
