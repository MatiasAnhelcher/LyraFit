/**
 * El diario: comida y sueño, con el mismo peso que el entrenamiento.
 *
 * ## Qué es esta pantalla y qué no es
 *
 * NO es un contador de calorías. El balance energético es cierto y casi
 * inservible como función de software: el autorreporte subestima en torno al
 * 30% y el gasto no se estima sin sensores. Son siete hábitos y nada más — el
 * porqué de cada uno está en `nutricion.ts`, que es donde vive la lógica.
 *
 * ## Por qué no hay nota, ni racha, ni porcentaje del día
 *
 * Porque esta pantalla se abre para ANOTAR, no para rendir examen. La regla
 * que gobierna todo el módulo es que es un PISO, nunca un techo: la app no
 * dice "te pasaste" de nada y no felicita a nadie por no tomar alcohol. Lo
 * único que aparece solo es el aviso de cafeína, porque es el único dato que
 * la percepción de la persona no puede detectar sola.
 *
 * Y el día que no se contesta nada no pasa nada. `estado.ts` ya lo dice para
 * el chequeo y vale igual acá: **el silencio es la respuesta correcta la
 * mayoría de los días.**
 *
 * ## Por qué cada fila guarda sola
 *
 * El diario se contesta de a pedazos: el sueño a la mañana, la proteína a la
 * noche, la cafeína cuando se acordó. Un botón de "guardar" al final obligaría
 * a contestar todo de una o perder lo tocado, que es exactamente la fricción
 * que hace que un registro diario se abandone a la semana.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import {
  HORAS_DE_CAFEINA,
  NOMBRE_ALCOHOL,
  PISO_DE_PROTEINA,
  SIN_CAFEINA,
  TOPE_DE_PROTEINA,
  TRAMOS_DE_SUENO,
  comoHora,
  corteDeCafeina,
  senalesDelDia,
  type Alcohol,
  type DiaDelDiario,
} from '@/dominio/nutricion'
import { guardarDiaDelDiario, leerDiaDelDiario } from '@/datos/repositorio'
import { Cargando, Glosa, Regleta, Rotulo, Segmento } from '@/componentes/ui'
import { IconoComida, IconoSueno } from '@/componentes/iconos'
import { orden } from '@/componentes/movimiento'

/** La hora por defecto que se ofrece, cuando todavía no hay ninguna anotada. */
const DORMIR_POR_DEFECTO = 23 * 60

/** Las horas que se ofrecen en la regleta de cafeína, de dos en dos. */
const HORAS_DE_CAFE = [8, 10, 12, 14, 16, 18, 20]

function Seccion({
  titulo,
  dominio,
  Icono,
  children,
  i,
}: {
  titulo: string
  dominio: 'comida' | 'sueno'
  Icono: typeof IconoComida
  children: React.ReactNode
  i: number
}) {
  return (
    <section className="entrar-en-orden mt-8 first:mt-0" style={orden(i)} data-dominio={dominio}>
      <div className="campo filete-dominio pt-3 pb-4">
        <p className="rotulo-dominio rotulo flex items-center gap-2">
          <Icono className="h-4 w-4" />
          {titulo}
        </p>
        {children}
      </div>
    </section>
  )
}

/** Una pregunta con su explicación debajo, para que nada sea una orden suelta. */
function Pregunta({ children, porque }: { children: React.ReactNode; porque?: string }) {
  return (
    <>
      <p className="nombre mt-4">{children}</p>
      {porque && (
        <p className="mt-1 max-w-[42ch] text-xs leading-relaxed text-[var(--color-glosa)]">
          {porque}
        </p>
      )}
    </>
  )
}

export function Diario() {
  const dia = useLiveQuery(() => leerDiaDelDiario(), [])

  // `undefined` es "todavía no cargó" y `null`/fila-sin-campos es "no contestó
  // nada". La diferencia importa: sin ella la pantalla parpadea mostrando
  // todo vacío medio segundo antes de dibujar lo que ya estaba anotado.
  if (dia === undefined) return <Cargando filas={5} />

  const actual: DiaDelDiario = dia ?? { fecha: '', actualizadoEn: 0 }
  const poner = (campos: Partial<DiaDelDiario>) => void guardarDiaDelDiario(campos)
  const horaDeDormir = actual.horaDeDormir ?? DORMIR_POR_DEFECTO
  const senales = senalesDelDia({ ...actual, horaDeDormir })
  const porciones = actual.porcionesDeProteina

  return (
    <div>
      <Rotulo prueba="titulo-diario">EL DIARIO</Rotulo>

      {/* ── SUEÑO ──────────────────────────────────────────────────────── */}
      <Seccion titulo="SUEÑO" dominio="sueno" Icono={IconoSueno} i={0}>
        <Pregunta porque="Con el mismo déficit exacto, dormir cinco horas y media en vez de ocho y media hace que lo que baje sea más músculo y menos grasa. No hay comida que compense eso.">
          ¿Cuánto dormiste anoche?
        </Pregunta>
        <Regleta className="mt-3" etiqueta="Cuánto dormiste anoche">
          {TRAMOS_DE_SUENO.map((t) => (
            <Segmento
              key={t}
              elegido={actual.sueno === t}
              onClick={() => poner({ sueno: t })}
              cifra
              className="flex-1"
              prueba={`sueno-${t}`}
            >
              {t}
            </Segmento>
          ))}
        </Regleta>
        <p className="rotulo mt-2">horas</p>

        <Pregunta porque={`La cafeína sigue afectando el sueño ${HORAS_DE_CAFEINA} horas después aunque no se sienta.`}>
          ¿A qué hora fue el último café o mate?
        </Pregunta>
        <Regleta className="mt-3 flex-wrap" etiqueta="Hora de la última cafeína">
          {HORAS_DE_CAFE.map((h) => (
            <Segmento
              key={h}
              elegido={actual.ultimaCafeina === h * 60}
              onClick={() => poner({ ultimaCafeina: h * 60, horaDeDormir })}
              cifra
              className="flex-1"
            >
              {h}
            </Segmento>
          ))}
          {/* "Nada" es una RESPUESTA, no la ausencia de una. Por eso guarda el
              centinela y no se deja el campo vacío: si no, el día sin café
              quedaría indistinguible del día sin contestar. */}
          <Segmento
            elegido={actual.ultimaCafeina === SIN_CAFEINA}
            onClick={() => poner({ ultimaCafeina: SIN_CAFEINA, horaDeDormir })}
            className="flex-1"
            prueba="cafeina-nada"
          >
            Nada
          </Segmento>
        </Regleta>

        {senales.avisoDeCafeina && (
          <div className="mt-4">
            <Glosa tono="ambar" cita={`CORTE SUGERIDO · ${comoHora(corteDeCafeina(horaDeDormir))}`}>
              {senales.avisoDeCafeina}
            </Glosa>
          </div>
        )}
      </Seccion>

      {/* ── COMIDA ─────────────────────────────────────────────────────── */}
      <Seccion titulo="COMIDA" dominio="comida" Icono={IconoComida} i={1}>
        <Pregunta porque="Una porción es más o menos la palma de tu mano. Repartirla en varias comidas rinde más que meterla toda en la cena: cada toma dispara síntesis proteica por su cuenta.">
          ¿En cuántas comidas de hoy hubo proteína?
        </Pregunta>
        <Regleta className="mt-3" etiqueta="Comidas con proteína">
          {Array.from({ length: TOPE_DE_PROTEINA + 1 }, (_, n) => (
            <Segmento
              key={n}
              elegido={porciones === n}
              onClick={() => poner({ porcionesDeProteina: n })}
              cifra
              className="flex-1"
              prueba={`proteina-${n}`}
            >
              {n}
            </Segmento>
          ))}
        </Regleta>
        {/*
          El piso se dice como dato, no como nota. "Cuatro es el piso" informa;
          "te faltan dos" reclama, y esta pantalla no reclama nada. Y por
          encima del piso no hay mensaje: no existe "te pasaste de proteína".
        */}
        <p className="rotulo mt-2">el piso son {PISO_DE_PROTEINA}</p>

        <Pregunta porque="Esto pesa más en la salud a largo plazo que en lo que levantás mañana, y vale decirlo así en vez de venderlo como rendimiento.">
          ¿Hubo verdura o fruta en dos comidas?
        </Pregunta>
        <Regleta className="mt-3" etiqueta="Verdura o fruta en dos comidas">
          {[
            ['Sí', true],
            ['No', false],
          ].map(([texto, valor]) => (
            <Segmento
              key={String(valor)}
              elegido={actual.verduraEnDos === valor}
              onClick={() => poner({ verduraEnDos: valor as boolean })}
              className="flex-1"
            >
              {texto as string}
            </Segmento>
          ))}
        </Regleta>

        <Pregunta porque="El alcohol adormece rápido y empeora la segunda mitad de la noche, que es donde recuperás. Es un dato, no una falta: acá no hay días limpios ni rachas de abstinencia.">
          ¿Tomaste alcohol hoy?
        </Pregunta>
        <Regleta className="mt-3" etiqueta="Alcohol">
          {(Object.keys(NOMBRE_ALCOHOL) as Alcohol[]).map((a) => (
            <Segmento
              key={a}
              elegido={actual.alcohol === a}
              onClick={() => poner({ alcohol: a })}
              className="flex-1"
            >
              {NOMBRE_ALCOHOL[a]}
            </Segmento>
          ))}
        </Regleta>

        <Pregunta porque="Es el único suplemento que esta app va a nombrar. Tiene más evidencia que todo el resto junto; lo demás —BCAA, glutamina, quemadores, colágeno— no la tiene.">
          ¿Tomaste creatina?
        </Pregunta>
        <Regleta className="mt-3" etiqueta="Creatina">
          {[
            ['Sí', true],
            ['No', false],
          ].map(([texto, valor]) => (
            <Segmento
              key={String(valor)}
              elegido={actual.creatina === valor}
              onClick={() => poner({ creatina: valor as boolean })}
              className="flex-1"
            >
              {texto as string}
            </Segmento>
          ))}
        </Regleta>
      </Seccion>

      <p className="mt-8 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
        No hace falta contestar todo, ni contestar todos los días. Lo que quede
        sin tocar queda sin tocar: acá no hay racha que romper.
      </p>
    </div>
  )
}
