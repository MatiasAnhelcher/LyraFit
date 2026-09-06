import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { RUTINAS } from '@/dominio/rutinas'
import { DIA_CORTO } from '@/dominio/rutinas'
import type { Preferencias } from '@/dominio/tipos'
import {
  RespaldoInvalido,
  borrarTodo,
  exportarTodo,
  guardarPreferencias,
  importarTodo,
  leerPreferencias,
  validarRespaldo,
} from '@/datos/repositorio'
import { Boton, Titulo } from '@/componentes/ui'
import { IconoTilde } from '@/componentes/iconos'

const TEMAS: { valor: Preferencias['tema']; etiqueta: string }[] = [
  { valor: 'sistema', etiqueta: 'Sistema' },
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro' },
]

export function Ajustes() {
  const preferencias = useLiveQuery(leerPreferencias, [])
  const archivo = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  if (!preferencias) {
    return <p className="py-16 text-center text-[var(--color-texto-suave)]">Cargando…</p>
  }

  async function descargarRespaldo() {
    const respaldo = await exportarTodo()
    const blob = new Blob([JSON.stringify(respaldo, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `lyrafit-${respaldo.exportadoEn.slice(0, 10)}.json`
    enlace.click()
    URL.revokeObjectURL(url)
    setAviso({ tono: 'ok', texto: 'Copia descargada.' })
  }

  async function cargarRespaldo(entrada: File) {
    try {
      const respaldo = validarRespaldo(JSON.parse(await entrada.text()))
      await importarTodo(respaldo)
      setAviso({
        tono: 'ok',
        texto: `Se restauraron ${respaldo.sesiones.length} sesiones.`,
      })
    } catch (error) {
      setAviso({
        tono: 'error',
        texto:
          error instanceof RespaldoInvalido
            ? error.message
            : 'No se pudo leer el archivo. ¿Es una copia de LyraFit?',
      })
    }
  }

  return (
    <>
      <Titulo>Ajustes</Titulo>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
          Rutina
        </h2>
        <ul className="space-y-2">
          {RUTINAS.map((rutina) => {
            const activa = rutina.id === preferencias.rutinaActivaId
            return (
              <li key={rutina.id}>
                <button
                  onClick={() => void guardarPreferencias({ rutinaActivaId: rutina.id })}
                  className="tarjeta w-full p-4 text-left transition"
                  style={activa ? { borderColor: 'var(--color-acento)' } : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{rutina.nombre}</p>
                      <p className="mt-1 flex gap-1">
                        {[1, 2, 3, 4, 5, 6, 7].map((dia) => (
                          <span
                            key={dia}
                            className="cifra flex h-6 w-6 items-center justify-center rounded text-[0.65rem] font-bold"
                            style={{
                              backgroundColor: rutina.dias.includes(dia)
                                ? 'var(--color-acento)'
                                : 'var(--color-superficie-alta)',
                              color: rutina.dias.includes(dia)
                                ? '#fff'
                                : 'var(--color-texto-suave)',
                            }}
                          >
                            {DIA_CORTO[dia]}
                          </span>
                        ))}
                      </p>
                    </div>
                    {activa && (
                      <IconoTilde className="h-5 w-5 shrink-0 text-[var(--color-acento)]" />
                    )}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-texto-suave)]">
                    {rutina.descripcion}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
          Apariencia
        </h2>
        <div className="flex gap-2">
          {TEMAS.map(({ valor, etiqueta }) => (
            <button
              key={valor}
              onClick={() => void guardarPreferencias({ tema: valor })}
              className="flex-1 rounded-xl border px-3 py-3 text-sm font-medium transition"
              style={{
                borderColor:
                  preferencias.tema === valor ? 'var(--color-acento)' : 'var(--color-borde)',
                color:
                  preferencias.tema === valor
                    ? 'var(--color-acento)'
                    : 'var(--color-texto-suave)',
              }}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
          Sonido
        </h2>
        <label className="tarjeta flex items-center justify-between gap-4 p-4">
          <span className="text-sm">
            Avisar cuando termina el descanso
            <span className="mt-1 block text-xs text-[var(--color-texto-suave)]">
              Un pitido corto y una vibración, para no tener que mirar la pantalla.
            </span>
          </span>
          <input
            type="checkbox"
            checked={preferencias.sonidoDescanso}
            onChange={(e) => void guardarPreferencias({ sonidoDescanso: e.target.checked })}
            className="h-6 w-6 shrink-0 accent-[var(--color-acento)]"
          />
        </label>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
          Tus datos
        </h2>
        <div className="tarjeta p-4">
          <p className="text-sm leading-relaxed text-[var(--color-texto-suave)]">
            Todo lo que registrás vive en este dispositivo, no en un servidor. Eso
            hace que la app funcione sin señal, y también que la copia de
            seguridad sea cosa tuya: descargala cada tanto y guardala donde
            guardás lo que te importa. Es además la forma de pasar tu historial a
            otro dispositivo.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Boton variante="secundario" className="flex-1" onClick={() => void descargarRespaldo()}>
              Descargar copia
            </Boton>
            <Boton variante="secundario" className="flex-1" onClick={() => archivo.current?.click()}>
              Restaurar copia
            </Boton>
          </div>

          <input
            ref={archivo}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const elegido = e.target.files?.[0]
              if (elegido) void cargarRespaldo(elegido)
              e.target.value = ''
            }}
          />

          {aviso && (
            <p
              className="mt-3 text-sm"
              style={{
                color: aviso.tono === 'ok' ? 'var(--color-exito)' : 'var(--color-error)',
              }}
              role="status"
            >
              {aviso.texto}
            </p>
          )}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-texto-suave)]">
          Empezar de cero
        </h2>
        {confirmandoBorrado ? (
          <div className="tarjeta p-4">
            <p className="text-sm leading-relaxed">
              Esto borra todas tus sesiones y te devuelve al primer nivel de cada
              cadena. No hay forma de deshacerlo. Si todavía no descargaste una
              copia, este es el momento.
            </p>
            <div className="mt-4 flex gap-2">
              <Boton
                variante="secundario"
                className="flex-1"
                onClick={() => setConfirmandoBorrado(false)}
              >
                Mejor no
              </Boton>
              <Boton
                variante="peligro"
                className="flex-1"
                onClick={() => {
                  void borrarTodo()
                  setConfirmandoBorrado(false)
                  setAviso({ tono: 'ok', texto: 'Listo, quedó todo en cero.' })
                }}
              >
                Borrar todo
              </Boton>
            </div>
          </div>
        ) : (
          <Boton variante="peligro" className="w-full" onClick={() => setConfirmandoBorrado(true)}>
            Borrar todos mis datos
          </Boton>
        )}
      </section>

      <p className="pb-4 text-center text-xs text-[var(--color-texto-suave)]">
        LyraFit · versión 0.1.0
      </p>
    </>
  )
}
