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

import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  HORAS_DE_CAFEINA,
  HORAS_DE_DORMIR,
  NOMBRE_ALCOHOL,
  PISO_DE_PROTEINA,
  SIN_CAFEINA,
  TOPE_DE_PROTEINA,
  TRAMOS_DE_SUENO,
  comoHora,
  corteDeCafeina,
  cuandoSeContesto,
  preguntarHoraDeDormir,
  senalesDelDia,
  type Alcohol,
  type DiaDelDiario,
  type HoraDeDormir,
} from '@/dominio/nutricion'
import { guardarDiaDelDiario, leerDiaDelDiario, leerHoraDeDormir } from '@/datos/repositorio'
import { Cargando, Glosa, Regleta, Rotulo, Segmento } from '@/componentes/ui'
import { IconoComida, IconoSueno } from '@/componentes/iconos'
import { orden } from '@/componentes/movimiento'

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
    /* `campo` va en el MISMO elemento que `data-dominio`, no en un hijo.
       Separados, el hijo se estiraba a sangre con su `margin-inline` negativo
       y el fondo lo pintaba el padre, que no se estiró: el campo quedaba 16 px
       más angosto que el contenido de cada lado, con el texto saliéndose del
       color. */
    <section
      className="campo entrar-en-orden mt-8 first:mt-0"
      style={orden(i)}
      data-dominio={dominio}
    >
      <div className="filete-dominio pt-3 pb-4">
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

/**
 * La hora de acostarse: la pregunta, o la respuesta de otro día con su fecha.
 *
 * Si se contestó hace poco, no se vuelve a preguntar: se muestra en una línea
 * qué hora se está usando y de cuándo es, con "Cambiar" a un toque. Esa hora
 * NO se guarda en la fila de hoy —se usa, no se copia—, así que la única hora
 * que queda escrita en un día es una que la persona tocó ese día.
 *
 * Contestada hoy, o al tocar "Cambiar", queda la regleta con la hora que vale
 * marcada, igual que las otras preguntas del diario: lo marcado es lo que se
 * está usando, y tocar otra la cambia.
 */
function HoraDeAcostarse({
  hora,
  poner,
}: {
  hora: HoraDeDormir | null
  poner: (campos: Partial<DiaDelDiario>) => void
}) {
  const [cambiando, setCambiando] = useState(false)
  const regleta = useRef<HTMLDivElement>(null)

  /* "Cambiar" desaparece al tocarlo, y con él el foco: sin esto quedaba en
     <body> y un lector de pantalla no se enteraba de que apareció la regleta.
     Se lleva a la hora marcada, que es la que se está por cambiar. */
  useEffect(() => {
    if (!cambiando) return
    const destino =
      regleta.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ??
      regleta.current?.querySelector<HTMLButtonElement>('button')
    destino?.focus()
  }, [cambiando])

  if (hora && hora.hace > 0 && !cambiando) {
    // La una va en singular: "a la 01:00", no "a las 01:00".
    const a = Math.floor(hora.minutos / 60) === 1 ? 'a la' : 'a las'
    return (
      <div className="mt-4 flex items-center justify-between gap-3" data-prueba="hora-de-dormir-de-antes">
        <p className="text-sm leading-snug">
          Te acostás {a} <span className="cifra">{comoHora(hora.minutos)}</span>, como dijiste{' '}
          {cuandoSeContesto(hora.hace)}.
        </p>
        <button
          type="button"
          onClick={() => setCambiando(true)}
          className="boton-contorno shrink-0"
          aria-label="Cambiar la hora de acostarte"
        >
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <>
      <Pregunta
        porque={`Un café necesita unas ${HORAS_DE_CAFEINA} horas antes de dormir para no recortar el sueño (Gardiner y col., 2023). Con tu hora se hace la cuenta; sin ella, no se inventa ninguna.`}
      >
        ¿A qué hora te pensás acostar?
      </Pregunta>
      <div ref={regleta}>
        <Regleta className="mt-3" etiqueta="Hora de acostarte">
          {HORAS_DE_DORMIR.map((h) => (
            <Segmento
              key={h}
              elegido={hora?.minutos === h * 60}
              onClick={() => poner({ horaDeDormir: h * 60, horaDeDormirContestada: true })}
              cifra
              prueba={`dormir-${h}`}
            >
              {h}
            </Segmento>
          ))}
        </Regleta>
      </div>
      {/* El reloj da la vuelta acá, y se dice con palabras: sin esto, el 0
          al lado del 23 parece un error y el 1 se lee como la una de la tarde. */}
      <p className="rotulo mt-2">0, 1 y 2 ya son de madrugada</p>
    </>
  )
}

export function Diario() {
  /**
   * El `?? null` no es un adorno, es el arreglo de un bug que hacía que esta
   * pantalla no existiera.
   *
   * `useLiveQuery` devuelve `undefined` mientras la consulta está en vuelo, y
   * `db.diario.get(fecha)` devuelve `undefined` cuando NO HAY FILA. Los dos
   * casos llegaban acá como el mismo valor, así que la guarda de abajo —que
   * está para evitar el parpadeo del primer render— se quedaba trabada para
   * siempre en el caso más común de todos: el primer día, antes de contestar
   * nada.
   *
   * El resultado era una pantalla de rayas vacías. Lo agarró una captura, no
   * un test: ningún test de dominio puede ver esto y la pantalla no tenía
   * aserción de contenido en `revisar.mjs`. Ahora la tiene.
   */
  const dia = useLiveQuery(async () => (await leerDiaDelDiario()) ?? null, [])
  /* Esta sí puede devolver `null` sin ayuda: sin hora es `null` y en vuelo es
     `undefined`, así que la guarda de abajo no se confunde. */
  const hora = useLiveQuery(() => leerHoraDeDormir(), [])

  if (dia === undefined || hora === undefined) return <Cargando filas={5} />

  const actual: DiaDelDiario = dia ?? { fecha: '', actualizadoEn: 0 }
  const poner = (campos: Partial<DiaDelDiario>) => void guardarDiaDelDiario(campos)
  /*
   * La hora de acostarse, solo si la dio la persona.
   *
   * Antes había una por defecto, las 23:00, y la pantalla la guardaba sola al
   * tocar la cafeína: a quien se acuesta a la una le avisaba de más y a quien
   * se acuesta a las diez, de menos, con un "corte sugerido" calculado contra
   * una hora que nadie contestó. Ahora se pregunta, y solo cuando el café de
   * hoy puede tocar el sueño; sin respuesta —de hoy o de hace poco—,
   * `cafeinaTarde` no afirma nada y el aviso no sale.
   */
  const senales = senalesDelDia(actual, hora)
  const porciones = actual.porcionesDeProteina

  return (
    <div>
      <Rotulo prueba="titulo-diario">EL DIARIO</Rotulo>

      {/* ── SUEÑO ──────────────────────────────────────────────────────── */}
      <Seccion titulo="SUEÑO" dominio="sueno" Icono={IconoSueno} i={0}>
        <Pregunta porque="Si estás bajando de peso, dormir poco hace que una parte mayor de lo que baja sea músculo. En un ensayo chico, durmiendo unas cinco horas se perdió menos grasa y más músculo que durmiendo siete y media.">
          ¿Cuánto dormiste anoche?
        </Pregunta>
        <Regleta className="mt-3" etiqueta="Cuánto dormiste anoche">
          {TRAMOS_DE_SUENO.map((t) => (
            <Segmento
              key={t}
              elegido={actual.sueno === t}
              onClick={() => poner({ sueno: t })}
              cifra
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
        <Regleta className="mt-3" etiqueta="Hora de la última cafeína">
          {HORAS_DE_CAFE.map((h) => (
            <Segmento
              key={h}
              elegido={actual.ultimaCafeina === h * 60}
              onClick={() => poner({ ultimaCafeina: h * 60 })}
              cifra
            >
              {h}
            </Segmento>
          ))}
          {/* "Nada" es una RESPUESTA, no la ausencia de una. Por eso guarda el
              centinela y no se deja el campo vacío: si no, el día sin café
              quedaría indistinguible del día sin contestar. */}
          <Segmento
            elegido={actual.ultimaCafeina === SIN_CAFEINA}
            onClick={() => poner({ ultimaCafeina: SIN_CAFEINA })}
            prueba="cafeina-nada"
          >
            Nada
          </Segmento>
        </Regleta>

        {preguntarHoraDeDormir(actual.ultimaCafeina) && <HoraDeAcostarse hora={hora} poner={poner} />}

        {senales.avisoDeCafeina && hora && (
          <div className="mt-4">
            <Glosa tono="ambar" cita={`CORTE SUGERIDO · ${comoHora(corteDeCafeina(hora.minutos))}`}>
              {senales.avisoDeCafeina}
            </Glosa>
          </div>
        )}
      </Seccion>

      {/* ── COMIDA ─────────────────────────────────────────────────────── */}
      <Seccion titulo="COMIDA" dominio="comida" Icono={IconoComida} i={1}>
        <Pregunta porque="Una porción es más o menos la palma de tu mano. Lo que más cuenta es el total del día, y repartirla en cuatro comidas es la forma más fácil de llegar.">
          ¿En cuántas comidas de hoy hubo proteína?
        </Pregunta>
        <Regleta className="mt-3" etiqueta="Comidas con proteína">
          {Array.from({ length: TOPE_DE_PROTEINA + 1 }, (_, n) => (
            <Segmento
              key={n}
              elegido={porciones === n}
              onClick={() => poner({ porcionesDeProteina: n })}
              cifra
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
            >
              {texto as string}
            </Segmento>
          ))}
        </Regleta>

        <Pregunta porque="Con alcohol te dormís más rápido, pero la segunda mitad de la noche se vuelve más cortada. Es un dato, no una falta: acá no se cuentan días sin tomar.">
          ¿Tomaste alcohol hoy?
        </Pregunta>
        <Regleta className="mt-3" etiqueta="Alcohol">
          {(Object.keys(NOMBRE_ALCOHOL) as Alcohol[]).map((a) => (
            <Segmento
              key={a}
              elegido={actual.alcohol === a}
              onClick={() => poner({ alcohol: a })}
            >
              {NOMBRE_ALCOHOL[a]}
            </Segmento>
          ))}
        </Regleta>

        <Pregunta porque="Es el único suplemento por el que pregunta esta app: el que más evidencia tiene para ganar fuerza y músculo. BCAA, glutamina, quemadores y colágeno no la tienen para eso. Si un día no la tomás, no pasa nada: el músculo la guarda por semanas.">
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
            >
              {texto as string}
            </Segmento>
          ))}
        </Regleta>
      </Seccion>

      <p className="mt-8 max-w-[40ch] text-xs leading-relaxed text-[var(--color-glosa)]">
        No hace falta contestar todo, ni contestar todos los días. Lo que quede
        sin tocar queda sin tocar, y no cuenta en contra de nada.
      </p>
    </div>
  )
}
