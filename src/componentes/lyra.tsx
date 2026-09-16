/**
 * LYRA.
 *
 * La misma criatura que vive en Grow Cosmos, traída acá y pasada al naranja.
 * Es literalmente la misma geometría —la estrella redondeada generada con
 * Catmull-Rom, la cresta-cometa de tres llamas, la sombra de contacto, el halo,
 * el brillo especular arriba a la izquierda, el rim-light de abajo— y las
 * mismas cualidades: te mira, parpadea, flota, y si la tocás rebota y tira
 * chispas.
 *
 * ## Por qué el naranja no es un capricho
 *
 * `--color-vega` ya era el acento de esta app, y se llama así porque **Vega es
 * la estrella alfa de la constelación de Lyra**. O sea que la mascota y el color
 * de la app eran la misma estrella desde antes de que nadie lo notara. Pasarla
 * al naranja no la disfraza: la devuelve a su lugar.
 *
 * ## Lo que hay que decir en voz alta
 *
 * El sistema visual de esta app dice que hay cinco animaciones, que la sexta
 * —la figura del ejercicio— entró con un argumento explícito, y que **no existe
 * ni un `animation-iteration-count: infinite`**. Lyra flota y parpadea en loop:
 * rompe esa regla, y no hay forma de que no la rompa, porque un ser que no
 * respira está muerto y un ser muerto no acompaña a nadie.
 *
 * Así que esto es un cambio del sistema visual, no una excepción escondida, y
 * está escrito también en `estilos.css`, que es donde vive el sistema. Lo que sí
 * se respeta, porque es lo que hacía honesta a la regla:
 *
 * - **Con `prefers-reduced-motion` queda quieta del todo.** Sin flotar, sin
 *   parpadear, sin chispas. Sigue siendo Lyra, en pose.
 * - **Nunca aparece durante la serie; sí en el descanso.** La distinción es la
 *   que importa y antes acá decía "nunca durante el esfuerzo", que era impreciso.
 *   Mientras hacés la serie estás leyendo un número con el pulso a ciento
 *   cuarenta: ahí una cara que te mira es exactamente el ruido que
 *   `[data-pantalla='entrenar']` apaga. El descanso son sesenta a ciento
 *   cincuenta segundos mirando un arco vaciarse, y ahí es donde habla un
 *   entrenador — el aliento verbal aumenta las repeticiones, pero funciona
 *   como voz, no como algo que compita por la mirada.
 * - **No hay confeti.** Las chispas del toque son seis puntos que se van en
 *   setecientos milisegundos, no una celebración.
 *
 * Sin framer-motion, que no es dependencia de esta app: el flote va por CSS y
 * el resto por estado de React, igual que la figura del ejercicio.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Expresion } from '@/dominio/frases'

/** La tinta de los ojos: un marrón casi negro, cálido, que lee sobre naranja. */
const OJO = '#2A1206'

// ── El cuerpo: una estrella de cinco puntas, redondeada ───────────────────
//
// Se suavizan los diez vértices con Catmull-Rom convertido a cúbicas de Bézier.
// Es lo que convierte una estrella de escuela primaria en un ser con volumen.

function puntasDeEstrella(cx: number, cy: number, afuera: number, adentro: number, n = 5) {
  const rot = -Math.PI / 2
  const puntos: [number, number][] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? adentro : afuera
    const a = rot + (i * Math.PI) / n
    puntos.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return puntos
}

function suavizarCerrado(p: [number, number][]) {
  const n = p.length
  let d = `M ${p[0]![0].toFixed(2)} ${p[0]![1].toFixed(2)} `
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]!
    const p1 = p[i]!
    const p2 = p[(i + 1) % n]!
    const p3 = p[(i + 2) % n]!
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} `
  }
  return d + 'Z'
}

/** El cuerpo, gordito a propósito: relación 41/30 entre punta y valle. */
export const CUERPO = suavizarCerrado(puntasDeEstrella(50, 54, 41, 30))

function ojosDe(expr: Expresion): 'abiertos' | 'arco' | 'guino' | 'dormida' {
  if (expr === 'festejo' || expr === 'contenta') return 'arco'
  if (expr === 'guino' || expr === 'orgullosa') return 'guino'
  if (expr === 'dormida') return 'dormida'
  return 'abiertos'
}

function Boca({ expr }: { expr: Expresion }) {
  const s = {
    fill: 'none',
    stroke: OJO,
    strokeWidth: 2.6,
    strokeLinecap: 'round' as const,
  }
  switch (expr) {
    case 'festejo':
      return <path d="M42 58 Q50 68 58 58" {...s} strokeWidth={3} />
    case 'contenta':
    case 'guino':
    case 'orgullosa':
      return <path d="M43 58 Q50 65 57 58" {...s} />
    case 'dormida':
      return <path d="M46 60 Q50 62 54 60" {...s} strokeWidth={2.2} />
    case 'piensa':
      return <path d="M46 61 L54 60" {...s} strokeWidth={2.2} />
    default:
      return <path d="M44 59 Q50 64 56 59" {...s} />
  }
}

const Chispa = ({ x, y, s = 4, c = '#fff', o = 1 }: { x: number; y: number; s?: number; c?: string; o?: number }) => (
  <path
    d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`}
    fill={c}
    opacity={o}
  />
)

function prefiereQuieto() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function Lyra({
  tamano = 48,
  expresion = 'calma',
  interactiva = true,
  className = '',
  onTocar,
}: {
  tamano?: number
  expresion?: Expresion
  /** En false no mira, no parpadea y no reacciona: es un logo. */
  interactiva?: boolean
  className?: string
  onTocar?: () => void
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [mira, setMira] = useState({ x: 0, y: 0 })
  const [parpadea, setParpadea] = useState(false)
  const [chispas, setChispas] = useState(0)
  const [festeja, setFesteja] = useState(false)

  const quieto = prefiereQuieto()
  const viva = interactiva && !quieto
  const expr: Expresion = festeja ? 'festejo' : expresion
  const ojos = ojosDe(expr)

  // Los ojos siguen al puntero. En un teléfono no hay puntero y se quedan al
  // frente, que es lo correcto: no hay nada que seguir.
  useEffect(() => {
    if (!viva) return
    const alMover = (e: PointerEvent) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height * 0.48
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const d = Math.hypot(dx, dy) || 1
      const mag = Math.min(1, d / 260)
      setMira({ x: (dx / d) * mag, y: (dy / d) * mag })
    }
    window.addEventListener('pointermove', alMover, { passive: true })
    return () => window.removeEventListener('pointermove', alMover)
  }, [viva])

  // Parpadeo irregular. Regular se lee como un semáforo.
  useEffect(() => {
    if (!viva) return
    let t1: number
    let t2: number
    const vuelta = () => {
      t1 = window.setTimeout(() => {
        setParpadea(true)
        t2 = window.setTimeout(() => {
          setParpadea(false)
          vuelta()
        }, 130)
      }, 2200 + Math.random() * 3200)
    }
    vuelta()
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [viva])

  const alTocar = useCallback(() => {
    onTocar?.()
    if (!viva) return
    setChispas((n) => n + 1)
    setFesteja(true)
    window.setTimeout(() => setFesteja(false), 1100)
  }, [onTocar, viva])

  // Clamp elíptico: la pupila nunca se sale del ojo, y tope abajo para que no
  // se "caigan" las miradas hacia el piso.
  let ex = mira.x * 2.4
  let ey = mira.y * 1.6
  const k = Math.hypot(ex / 2.6, ey / 1.6)
  if (k > 1) {
    ex /= k
    ey /= k
  }
  ey = Math.min(ey, 0.6)
  const ojoY = expr === 'piensa' ? 50 : 51

  return (
    <span
      ref={ref}
      className={`lyra ${viva ? 'lyra--viva' : ''} ${onTocar ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: tamano, height: tamano }}
      onClick={onTocar || viva ? alTocar : undefined}
      role="img"
      aria-label="Lyra"
    >
      <svg viewBox="0 0 100 105" width="100%" height="100%" className={chispas > 0 ? 'lyra-rebote' : ''} key={chispas}>
        <defs>
          <radialGradient id="lyHalo" cx="50%" cy="48%" r="55%">
            <stop offset="0%" stopColor="rgba(255,138,84,0.55)" />
            <stop offset="100%" stopColor="rgba(255,122,69,0)" />
          </radialGradient>
          {/* El cuerpo: luz arriba a la izquierda, naranja de Vega abajo. */}
          <radialGradient id="lyCuerpo" cx="38%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#FFE9D6" />
            <stop offset="24%" stopColor="#FFB578" />
            <stop offset="58%" stopColor="#FF7A2F" />
            <stop offset="100%" stopColor="#A8330A" />
          </radialGradient>
          <linearGradient id="lyCresta" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#B03A0C" />
            <stop offset="100%" stopColor="#FFC08A" />
          </linearGradient>
          <radialGradient id="lySombra" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(28,14,6,0.4)" />
            <stop offset="100%" stopColor="rgba(28,14,6,0)" />
          </radialGradient>
        </defs>

        {/* sombra de contacto: es lo que le da peso */}
        <ellipse cx="50" cy="99" rx="24" ry="5" fill="url(#lySombra)" />
        <circle cx="50" cy="52" r="50" fill="url(#lyHalo)" />

        {/* la cresta-cometa: la firma de Lyra */}
        <g>
          <path d="M50 2 Q43 17 50 26 Q57 17 50 2 Z" fill="url(#lyCresta)" opacity="0.95" />
          <path d="M41 10 Q38 20 46 26 Q44 17 41 10 Z" fill="url(#lyCresta)" opacity="0.72" />
          <path d="M59 10 Q62 20 54 26 Q56 17 59 10 Z" fill="url(#lyCresta)" opacity="0.72" />
        </g>

        <path
          d={CUERPO}
          fill="url(#lyCuerpo)"
          stroke="rgba(255,236,220,0.45)"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
        {/* rim-light de abajo: separa el cuerpo del fondo y suma volumen */}
        <path
          d={CUERPO}
          fill="none"
          stroke="rgba(90,28,4,0.28)"
          strokeWidth="2"
          style={{ clipPath: 'inset(55% 0 0 0)' }}
        />
        <ellipse cx="38" cy="36" rx="11" ry="7" fill="rgba(255,255,255,0.5)" transform="rotate(-28 38 36)" />

        {ojos === 'abiertos' && (
          <g transform={`translate(${ex.toFixed(2)} ${ey.toFixed(2)})`}>
            {[41, 59].map((cx, i) =>
              parpadea ? (
                <path
                  key={i}
                  d={`M${cx - 3.4} ${ojoY - 0.6} Q${cx} ${ojoY + 2.2} ${cx + 3.4} ${ojoY - 0.6}`}
                  fill="none"
                  stroke={OJO}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              ) : (
                <g key={i}>
                  <ellipse cx={cx} cy={ojoY} rx="3.5" ry="4.6" fill={OJO} />
                  <circle cx={cx + 1.4} cy={ojoY - 1.8} r="1.35" fill="#fff" />
                  <circle cx={cx - 1.1} cy={ojoY + 1.4} r="0.7" fill="#fff" opacity="0.7" />
                </g>
              ),
            )}
          </g>
        )}
        {ojos === 'arco' && (
          <g fill="none" stroke={OJO} strokeWidth="3" strokeLinecap="round">
            <path d="M36 51 Q41 45 46 51" />
            <path d="M54 51 Q59 45 64 51" />
          </g>
        )}
        {ojos === 'guino' && (
          <g>
            <g transform={`translate(${ex.toFixed(2)} ${ey.toFixed(2)})`}>
              <ellipse cx="41" cy="51" rx="3.5" ry="4.6" fill={OJO} />
              <circle cx="42.4" cy="49.2" r="1.35" fill="#fff" />
            </g>
            <path d="M54 51 Q59 46 64 51" fill="none" stroke={OJO} strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
        {ojos === 'dormida' && (
          <g fill="none" stroke={OJO} strokeWidth="2.6" strokeLinecap="round">
            <path d="M35 51 Q41 54 47 51" />
            <path d="M53 51 Q59 54 65 51" />
          </g>
        )}

        {/* el rubor: un rojo quemado, que sobre naranja no chilla */}
        {expr !== 'piensa' && expr !== 'dormida' && (
          <g fill="#8A2B06" opacity="0.22">
            <circle cx="33" cy="57" r="3" />
            <circle cx="67" cy="57" r="3" />
          </g>
        )}

        <Boca expr={expr} />

        {expr === 'festejo' && (
          <g>
            <Chispa x={16} y={26} s={3.6} c="#FFC08A" />
            <Chispa x={86} y={32} s={3.2} c="#FFF7F1" />
          </g>
        )}
        {expr === 'piensa' && (
          <g>
            <circle cx="84" cy="24" r="2.6" fill="none" stroke="#FF8B54" strokeWidth="1.5" />
            <circle cx="90" cy="17" r="1.5" fill="#FF8B54" />
          </g>
        )}
        {expr === 'dormida' && (
          <text x="82" y="28" fontSize="12" fontWeight="700" fill="#B08A6A">
            z
          </text>
        )}
      </svg>

      {/* Seis chispas que se van en setecientos milisegundos. No es confeti:
          no cae, no se acumula y no celebra un logro — confirma un toque. */}
      {chispas > 0 && viva && (
        <span className="lyra-chispas" key={`c${chispas}`} aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              style={{
                ['--ang' as string]: `${(i / 6) * 360}deg`,
                ['--lejos' as string]: `${tamano * 0.75}px`,
                background: i % 2 ? '#FFC08A' : '#fff',
              }}
            />
          ))}
        </span>
      )}
    </span>
  )
}
