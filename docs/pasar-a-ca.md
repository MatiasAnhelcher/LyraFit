# El camino para pasar a CA

**Fecha:** septiembre de 2026 · **Alcance:** qué tiene Calisteniapp que LyraFit
no, qué de eso vale la pena, y el diseño completo de las dos piezas que pueden
ponerla adelante — el mapa muscular diagnóstico y la balanza de rutinas.

Este documento es la mitad **en papel** de una entrega cuya otra mitad ya está
construida: elegir los días de la semana y saber qué viene después. Nada de lo
que sigue está implementado. Está escrito con el detalle suficiente para
construirlo por partes, en el orden que dice la última sección.

---

## 1. Dónde está parado CA, con sus fuentes

Calisteniapp es el referente del rubro y conviene medirlo sin autoengaño:

| Lo que tiene | Cantidad |
|---|---|
| Ejercicios | 620–700 |
| Sesiones armadas | más de 500 |
| Programas | 35–40 |
| Rutinas EVO (ajustan la carga según cómo puntuás la sesión y tu frecuencia) | 23+ |
| Skills guiadas | dominada, muscle-up, front lever, back lever, planche, bandera |
| Creador de rutinas | HIIT, Tabata, EMOM |
| Otros | retos de 21 días, mapa muscular, calendario con estadísticas, Apple Watch, Apple Health |
| Reputación | 4,8 en iOS · 4,5 en Android · +2 millones de descargas |

Y sus quejas reales, de reseñas independientes y de sus propios usuarios:

- **La interfaz es densa y lleva tiempo aprenderla.** Es el punto que hace toda
  reseña independiente.
- **Paywall inmediato**, precio visible recién después del onboarding, y
  denuncias de discrepancia entre el precio mostrado y el cobrado.
- **No se puede cargar una sesión con fecha anterior.**
- **Una sesión solo queda registrada si la corrés en vivo dentro de la app.**

Las dos últimas son limitaciones funcionales, no de gusto, y son terreno
regalado.

## 2. La tesis, y lo que se descarta con ella

LyraFit no le va a ganar a CA en cantidad de contenido, y **no debería
intentarlo**. Cuarenta y siete ejercicios en cadenas verificadas —cada eslabón
con su `ccr`, su ventana y su dibujo, y una simulación que comprueba que la
cadena dura más de 45 sesiones— valen más que seiscientos sin orden. Con
seiscientos el motor no sabría qué hacer: la progresión existe porque alguien
decidió qué va después de qué.

Donde sí le gana, y lo que hay que reforzar en cada decisión de abajo:

> **El motor decide por vos, con honestidad, sin cuenta, sin suscripción,
> offline, y sin que tengas que mirar la pantalla.**

De ahí salen tres descartes explícitos:

- **Ningún puntaje único.** Ni de rutina, ni de sesión, ni de persona. El
  documento de estrategia ya rechazó un score en §3.6, y la razón vale igual
  acá: un número que resume siete cosas distintas borra las siete.
- **Ninguna racha.** Ya se borró una vez por medición: con adherencia perfecta
  en la rutina por defecto mostraba 3.
- **Nada que sume alto en `Hoy`.** La regla del pliegue no se negocia.

---

## 3. El mapa muscular, pero diagnóstico — **hecho**

> Construido en `src/dominio/musculos.ts` y en la sección "QUÉ ESTÁS
> ENTRENANDO" de Progreso. Lo que sigue es el diseño; lo que cambió al
> construirlo está anotado al final de la sección.

En CA el mapa es decorativo: te muestra qué entrenaste y ahí termina. Acá es el
**sustrato** de todo lo demás, y por eso va primero.

### 3.1 La matriz

```ts
// src/dominio/musculos.ts
export type Musculo =
  | 'pectoral' | 'deltoide-anterior' | 'deltoide-lateral' | 'deltoide-posterior'
  | 'triceps' | 'biceps' | 'antebrazo'
  | 'dorsal' | 'trapecio-medio' | 'romboides' | 'erectores'
  | 'recto-abdominal' | 'oblicuos' | 'transverso'
  | 'gluteo' | 'cuadriceps' | 'isquiotibial' | 'aductor' | 'gemelo'

/**
 * Cuánto carga cada ejercicio a cada músculo.
 *   1    primario — el que limita la serie
 *   0,5  secundario — trabaja de verdad pero no es el que falla
 *   0,25 estabilizador — sostiene, no mueve
 */
export const APORTE: Record<string, Partial<Record<Musculo, number>>>
```

**Honestidad sobre los números:** los tres valores son juicio profesional, no
medición. Donde exista electromiografía publicada para ese ejercicio hay que
citarla en el comentario; donde no, hay que decir que es criterio. Una tabla que
finge precisión es peor que una que declara su incertidumbre — es la misma regla
con la que la estimación de duración dice "aprox.".

### 3.2 Las dos vistas

- **Lo hecho.** Series efectivas por músculo en 28 días, sumadas desde
  `sesiones`. Es un dato medido, no una promesa.
- **Lo que falta.** El músculo con menos aporte, nombrado. Y acá está la
  diferencia con CA: **la app no te deja el hueco para que lo resuelvas vos, lo
  llena sola.** Es exactamente la mecánica que hizo aparecer la cadena de
  bisagra cuando la auditoría mostró que los nueve ejercicios de pierna eran
  todos dominantes de rodilla.

---

## 4. La balanza: armar tu rutina y que la app la juzgue

La idea del dueño, expandida. Es la pieza más grande y la que puede poner a
LyraFit adelante de CA, porque CA tiene un creador de rutinas que **no opina**.

### 4.1 Por qué no es un puntaje

Un porcentaje —"eficiencia 72%"— destruye justo la información que sirve. Una
rutina puede estar perfecta en seis dimensiones y no tener una sola tracción, y
eso no es "86% bien": está rota. Promediar lo escondería.

La regla que ordena todo:

> **El veredicto de la rutina es el PEOR eje, nunca el promedio.**

Y el veredicto se dice en tres palabras, que son las que pidió el dueño:
**cierra · cojea · no cierra**.

### 4.2 Los siete ejes

| Eje | Qué mide | Cuándo no cierra | De dónde sale el criterio |
|---|---|---|---|
| **Cobertura** | Cuáles de los 8 patrones fundamentales aparecen | Falta un patrón entero | La auditoría de patrones que ya se hizo acá |
| **Empuje / tracción** | Volumen de empuje contra volumen de tracción | Fuera de 1:1 ± 30% | Lo ideal se inclina a tracción: casi todos llegamos con dominancia anterior de estar sentados |
| **Cadena anterior / posterior** | Cuádriceps + pectoral contra glúteo + isquio + dorsal | Ídem | Es el eje con más evidencia de lesión detrás (Petersen AJSM 2011, van Dyk BJSM 2019) |
| **Orden** | La secuencia adentro de la sesión | Lo más exigente no va primero; dos ejercicios que comparten estabilizador quedan pegados; el core antes del resto; lo pliométrico después de lo lento | La app ya lo encoda: "el core al final: si lo hacés antes, te sabotea el resto" |
| **Dosis** | Series efectivas por músculo por semana | Menos de 4 es mantenimiento, no progreso; más de ~20 es costo de recuperación sin retorno | Literatura de volumen semanal |
| **Frecuencia** | Días entre repeticiones del mismo patrón | Menos de 48 h en un patrón pesado | Ya está encodado: el curl nórdico se banca una vez por semana |
| **Interferencia** | Trabajo metabólico contra trabajo de fuerza | La dosis que escala con duración y frecuencia | Wilson 2012, ya citado en `metabolico.ts` |

### 4.3 El ejemplo del dueño, diagnosticado

*"Flexiones de pecho, después sentadillas, después burpees."*

- **Cobertura: no cierra.** Cero tracción. Nada de dorsal, romboides ni bíceps.
- **Empuje / tracción: no cierra.** Infinito a cero.
- **Cadena ant. / post.: cojea.** Pectoral y cuádriceps sin contrapeso.
- **Orden: cojea.** El burpee lleva una flexión adentro y va después de
  flexiones: el pectoral llega pre-fatigado, así que el burpee no rinde ni como
  metabólico ni como fuerza.
- **Dosis: cierra.** Tres ejercicios alcanzan para lo que cubren.
- **Frecuencia: cierra.**
- **Interferencia: cojea.** Burpees al final de una sesión de fuerza son la
  dosis metabólica que Wilson asocia con pérdida de adaptación.

**Veredicto: no cierra**, porque el peor eje no cierra. Y debajo, la corrección
concreta:

> *Metele un remo o unas dominadas entre las flexiones y la sentadilla. Los
> burpees pasan al fuelle, que es donde no te cobran fuerza.*

### 4.4 La ventaja que CA no puede copiar

Cada veredicto que no cierra viene con **un arreglo de un toque**. Y el arreglo
no es un consejo genérico: **el motor ya sabe en qué eslabón estás de cada
cadena**, así que lo que ofrece es el ejercicio exacto que te toca hoy, con sus
series y sus repeticiones. CA no puede hacer eso porque su creador de rutinas no
está conectado a su progresión.

### 4.5 La forma del código

`src/dominio/balanza.ts`, funciones puras, con el azar y las fechas por
parámetro, igual que `frases.ts` y `metabolico.ts`. Testeable en milisegundos.

```ts
export type Veredicto = 'cierra' | 'cojea' | 'no-cierra'

export interface Eje {
  clave: 'cobertura' | 'empuje-traccion' | 'anterior-posterior'
       | 'orden' | 'dosis' | 'frecuencia' | 'interferencia'
  veredicto: Veredicto
  /** Qué pasa, en una línea, con el número que lo dice. */
  texto: string
  /** El arreglo concreto, si lo hay. Lo resuelve el motor, no una regla fija. */
  arreglo?: { texto: string; aplicar: (rutina: RutinaPropia) => RutinaPropia }
}

export function pesar(rutina: RutinaPropia, contexto: Contexto): {
  veredicto: Veredicto   // el PEOR eje, nunca el promedio
  ejes: Eje[]            // ordenados de peor a mejor
}
```

---

## 5. Skills con nombre propio

El gancho más fuerte de CA. Las cadenas de LyraFit ya **son** progresiones: lo
que falta es el destino con nombre y la víspera larga —"te faltan tres eslabones
para tu primera dominada"—.

Sin parada de manos, que el dueño descartó por equilibrio. Vale dejar anotado
que los tres primeros eslabones de esa cadena son flexiones pique, contra el
piso y con la cadera arriba, que no piden nada de equilibrio invertido: el
equilibrio recién hace falta del cuarto en adelante.

## 6. Los patrones que faltan

De los ocho patrones fundamentales la app cubre cinco. Por orden de daño:

1. **Remo horizontal después de las dominadas.** Hoy, al llegar a dominadas,
   nunca volvés a remar. Es peor para el hombro que perder las diamante: el
   equilibrio escapular se sostiene con tracción horizontal.
2. **Core lateral / anti-rotación.** No existe. **No conviene como cadena de
   `ccr`**: progresa por palanca y por tiempo, no por repeticiones, y forzarle
   una escalera sería inventar números.
3. **Empuje vertical.** Diseñado y guardado; declinado por ahora.

## 7. El calendario, y cargar una sesión a mano

Las dos limitaciones que los propios usuarios de CA denuncian. LyraFit puede
hacer las dos, y además §1.6 del documento de estrategia —borrar una sesión mal
cargada— sigue Pendiente.

**Cuidado con una cosa:** una sesión cargada a mano no puede mover el motor
igual que una en vivo. Va con su propio `TipoSesion`, como ya se hizo con
`'fuelle'`, y `mueveElPlan` la deja afuera. Si no, el historial se vuelve un
lugar donde se puede editar el propio progreso, y el motor deja de medir nada.

---

## 8. El orden

Cada paso deja algo usable y ninguno depende de que el siguiente exista.

1. **`musculos.ts`** — la matriz de aporte y sus tests. Sin interfaz todavía.
   Es el cimiento de 2 y de 3, y se puede verificar solo.
2. **El mapa de lo hecho**, en Progreso. Un dato medido, que es lo más barato de
   construir y lo primero que se puede mirar.
3. **La balanza**, sobre la matriz. Primero el dominio con sus siete ejes y sus
   tests; después la interfaz.
4. **El armador de rutinas propias**, que es lo que le da a la balanza algo que
   pesar.
5. **Remo horizontal y core lateral**, que la balanza va a estar señalando sola
   para entonces.
6. **Skills**, que es presentación de lo que ya existe.
7. **Calendario y carga manual.**

## 9. Lo que no hay que construir

- Un puntaje único, de nada.
- Una racha, de ninguna forma.
- Seiscientos ejercicios.
- Cualquier cosa que sume alto en `Hoy`.
- Un mapa muscular que solo decore: si no dice qué falta y no lo llena, es CA
  con otro color.
