# LyraFit — Diagnóstico, evidencia y hoja de ruta

**Fecha:** septiembre de 2026 · **Alcance:** auditoría del código real, benchmark de los
líderes mundiales en adherencia, revisión de la evidencia científica, y un plan
priorizado y construible por una sola persona.

Este documento se apoya en tres cosas: la lectura completa del código de LyraFit con
simulaciones ejecutadas sobre el motor real, dieciséis investigaciones paralelas sobre los
productos más exitosos del mundo en entrenamiento, sueño, alimentación y vitalidad, y seis
revisiones de literatura científica con verificación adversarial de las afirmaciones que
sostienen cada decisión.

Todo lo que sigue está ordenado por una regla: **primero lo que está roto, después lo que
falta, y último lo que sería lindo tener.**


## Contenido

1. [Diagnóstico sin anestesia](#1-diagnóstico-sin-anestesia) — qué está roto, verificado corriendo el motor
2. [Lo que dice la evidencia](#2-lo-que-dice-la-evidencia-y-lo-que-hay-que-dejar-de-creer) — y lo que hay que dejar de creer
3. [La arquitectura de adherencia](#3-la-arquitectura-de-adherencia-que-reemplaza-a-la-racha) — qué reemplaza a la racha
4. [Motor v2](#4-motor-v2-la-reescritura-del-corazón) — la reescritura del corazón, con fórmulas
5. [La capa de vitalidad](#5-la-capa-de-vitalidad-sueño-alimentación-y-cognición-sin-pseudociencia) — sueño, alimentación y cognición sin pseudociencia
6. [Qué hacen los mejores del mundo](#6-qué-hacen-los-mejores-del-mundo) — 106 productos
7. [Hacia dónde va el mercado](#7-hacia-dónde-va-el-mercado) — 2026-2030
8. [El plan](#8-el-plan) — tres olas y los primeros 30 días
9. [Lo que no hay que construir](#9-lo-que-no-hay-que-construir)
10. [Los principios](#10-los-principios-que-no-habría-que-traicionar)

---

## Estado de implementación

Este documento se escribió como análisis. Lo que sigue ya está construido y en
la rama, así que el diagnóstico de la sección 1 describe el estado **anterior**
al trabajo, no el actual:

| Sección | Estado |
|---|---|
| §1.1 Estado absorbente del motor | **Hecho.** Señal EWMA sin reinicios + ruptura de meseta a las 4 sesiones |
| §1.2 Cadenas agotadas en 5 semanas | **Hecho.** Compuerta de dominio, consolidación del techo, 39 ejercicios |
| §1.4 Racha rota | **Hecho.** Borrada y reemplazada por adherencia rodante, créditos e identidad |
| §1.5 `lunesDe` y persistencia | **Hecho.** Más una corrida de CI con `TZ` al este |
| §1.5 `Serie.esfuerzo` sin usar | **Hecho.** Esfuerzo, ánimo, predicción y RIR |
| §1.6 Sin alta ni test de nivel | **Hecho.** |
| §1.6 Sin borrar sesión mal cargada | Pendiente |
| §1.6 "Volumen" mezclando unidades | **Hecho.** Series, repeticiones y segundos por separado |
| §3 Arquitectura de adherencia | **Hecho.** A28, créditos, sesión de vuelta, sesión corta, identidad |
| §4 Motor v2 completo | **Hecho**, salvo los micro-escalones dinámicos de §4.8 |
| §5.1 Delta de vitalidad | **Hecho.** |
| §5.2 Calibración interoceptiva | **Hecho.** |
| §5.3–5.4 Chequeo diario e índice | **Hecho.** |
| §5.5 Módulo de alimentación | Pendiente |
| §5.7 Ritual de respiración | Pendiente |
| §6.9 Backup automático | **Hecho.** OPFS con rotación de tres |
| §6.9 Web Push | Pendiente |
| §8 Ola 1 | 11 de 12 |

El sistema visual **Efeméride** no estaba en este documento: salió de una
exploración posterior de tres direcciones independientes con un jurado que las
integró. Está descrito en el encabezado de `src/estilos.css`.

---

## 1. Diagnóstico sin anestesia

LyraFit está mucho mejor construida de lo que está diseñada. La arquitectura es la de
alguien que sabe lo que hace: dominio puro y testeable separado de la persistencia y de la
interfaz, temporizadores calculados contra el reloj real en vez de contadores que se
atrasan, migraciones de Dexie versionadas con disciplina, una paleta de gráficos separada
de la de interfaz y verificada por contraste y daltonismo, y la pantalla pesada cargada en
un chunk aparte. Los 44 tests pasan y el typecheck pasa.

Y sin embargo el producto, tal como está, no puede retener a nadie más de tres semanas. No
por falta de features: por **defectos en el motor de progresión, que es exactamente donde
vive la promesa de la app.**

Todo lo que sigue en esta sección está verificado ejecutando el código real, no leyéndolo.

### 1.1 El motor tiene un estado absorbente. La app se cuelga sin fallar.

En `src/dominio/progresion.ts:196`, cuando el resultado de una sesión es `parcial`, el
motor devuelve el mismo objetivo y pone en cero **las dos** rachas:

```ts
if (resultado === 'parcial') {
  return {
    avance: { ...base, objetivoActual: { ...avance.objetivoActual },
              rachaExitos: 0, rachaFallos: 0 },   // ← las dos en cero
    explicacion: 'Quedaste cerca. Repetimos el mismo objetivo para consolidarlo.',
  }
}
```

Quien queda por debajo del objetivo pero por encima de `UMBRAL_FALLO` (0,6) nunca acumula
éxitos —así que nunca sube— ni fallos —así que nunca descarga—. La banda de captura es
enorme: **cualquier rendimiento entre el 60% y el 99,9% del objetivo.** Y alternar
éxito/parcial o fallo/parcial produce el mismo bloqueo, porque cada `parcial` borra lo
acumulado.

Simulación con el código real, principiante con capacidad fija (máximo 8 flexiones
completas, 4 diamante), 60 sesiones:

```
  s 8 | Flexiones completas | 3x6 | exito   | Subís a Flexiones diamante
  s 9 | Flexiones diamante  | 3x5 | parcial | Quedaste cerca. Repetimos el mismo objetivo…
  s10 | Flexiones diamante  | 3x5 | parcial | Quedaste cerca. Repetimos el mismo objetivo…
  …
  s60 | Flexiones diamante  | 3x5 | parcial | Quedaste cerca. Repetimos el mismo objetivo…
```

**52 de 60 sesiones en el mismo ejercicio con la misma frase textual.** Diecisiete semanas
sin que cambie un solo número. La app no se rompe, no tira un error, no avisa: simplemente
deja de ser un motor de progresión y se convierte en un cuaderno.

### 1.2 Las cuatro cadenas se agotan en menos de cinco semanas

En `progresion.ts:120`, el salto al ejercicio siguiente se dispara **solo** con
`rachaExitos >= EXITOS_PARA_AVANZAR`, sin verificar nunca que el objetivo actual haya
alcanzado el `objetivo` declarado del ejercicio:

```ts
if (rachaExitos >= EXITOS_PARA_AVANZAR) {
  const siguiente = vecino(ctx, actual.id, 1)   // ← nunca mira actual.objetivo
```

El campo `Ejercicio.objetivo` está documentado en `tipos.ts:44` como *"Qué hay que lograr
para pasar al siguiente nivel de la cadena"* y el README lo llama *"el criterio para pasar
al siguiente"*. **El motor no lo implementa.** Solo lo usa como tope del incremento
dentro del nivel. Que el mensaje de esa rama diga *"Una sesión más así y pasás al
siguiente nivel"* confirma que el comportamiento pretendido era otro: el texto de la
interfaz describe una lógica que el código no tiene.

Simulación con el código real, usuario que cumple exactamente lo que la app le pide:

| Cadena | Llega al último eslabón en | Sube desde el penúltimo con | Tope declarado de ese nivel |
|---|---|---|---|
| Empuje → flexión a una mano | **14 sesiones (4,7 semanas)** | 3×5 | 3×12 |
| Tracción → dominada a un brazo asistida | **12 sesiones (4 semanas)** | 3×4 | 3×10 |
| Piernas → sentadilla a una pierna | **8 sesiones (2,7 semanas)** | 3×5 | 3×12 |
| Core → palanca frontal agrupada | **8 sesiones (2,7 semanas)** | 3×6 | 3×12 |

Veinticinco ejercicios, cuatro cadenas, agotados en menos de cinco semanas. La flexión a
una mano lleva años de trabajo; acá se llega en mes y medio. Y detrás no hay nada: el
último eslabón solo suma repeticiones para siempre.

Además, cada salto sube la carga relativa de golpe. De flexión en la pared a flexión
inclinada, la fracción de peso corporal soportada pasa de ~0,25 a ~0,40: **un +60% de
carga en una sesión.** Ese es el patrón que produce tendinopatía de hombro y abandono.

### 1.3 Los dos juntos: el acantilado tiene fecha

Las secciones 1.1 y 1.2 no son dos problemas, son uno. La app regala ocho sesiones de
progreso irreal —cuatro niveles en menos de tres semanas— y deposita a la persona en un
eslabón para el que no está preparada. Ahí falla, cae en `parcial`, y el estado absorbente
la deja congelada indefinidamente.

**El acantilado de retención de LyraFit está en la sesión 9, semana 3, y tiene causa
exacta y línea de código.** Ninguna cantidad de notificaciones, rachas o gamificación lo
compensa: el problema no es que la persona se olvide de volver, es que cuando vuelve no
pasa nada.

### 1.4 La racha se rompe sola con adherencia perfecta

`estadisticas.ts:47`. `rachaActual` cuenta días calendario permitiendo un hueco máximo de
dos días. Las rutinas que trae la propia app tienen huecos de tres y cuatro días.
Verificado con ocho semanas de adherencia perfecta:

| Rutina | Sesiones perfectas | Racha que muestra |
|---|---|---|
| Cuerpo completo (L-X-V) — la de por defecto | 24 | **3** |
| La mínima (Ma-V) | 16 | **1** |
| Empuje y tracción (L-Ma-J-V) | 32 | 4 |

Es el número más prominente de la pantalla principal, con ícono de llama. Un usuario
impecable durante dos meses ve un 3.

La sección 3 explica por qué la respuesta correcta no es arreglar el cálculo.

### 1.5 Cuatro defectos más, verificados

**`lunesDe` devuelve domingo para todo usuario al este de UTC.** `estadisticas.ts:98` hace
`setDate` en hora local y después `toISOString()`, que convierte a UTC. Para el 2026-01-08
devuelve 2026-01-05 en Buenos Aires y en UTC, pero **2026-01-04** en Madrid, Kolkata y
Sydney. Toda Europa, Asia y Oceanía ven las semanas corridas un día y mal etiquetadas.
`fechaISO` en `repositorio.ts:24` resuelve bien este mismo problema; `lunesDe` no reusa esa
lógica.

**Riesgo real de pérdida total de datos.** No hay una sola llamada a
`navigator.storage.persist()` en todo `src/`. La app es local-first sin servidor:
IndexedDB es la única copia que existe. Sin persistencia solicitada, el navegador puede
desalojar los datos bajo presión de almacenamiento, y en Safari la política de ITP borra el
almacenamiento escribible por script tras siete días sin visitar un sitio no instalado. El
respaldo existe, pero es enteramente manual y depende de que la persona se acuerde.

**`Serie.esfuerzo` está declarado y jamás se escribe ni se lee.** `tipos.ts:66` define el
RPE opcional; `Entrenar.tsx:93` nunca lo setea y `evaluarSesion` nunca lo mira. Es la
palanca más barata de toda la app: un toque desbloquea autorregulación, carga interna y
readiness sin ningún sensor. La sección 4 la usa como cimiento.

**El descanso no avisa con el teléfono bloqueado.** `useTemporizador` calcula
correctamente contra el reloj real —buena decisión, bien documentada—, pero el aviso
(`pitar()` + `vibrar()`) se dispara desde un `setInterval` que el navegador estrangula en
segundo plano, y el contexto de audio queda suspendido. El cálculo es correcto; la alarma
no llega. Tampoco hay Screen Wake Lock: la pantalla se apaga en mitad de la sesión.

### 1.6 Lo que falta entero

- **No hay onboarding ni test de nivel.** `App.tsx` tiene cinco rutas y ninguna es de
  alta. Todo el mundo arranca en flexiones en la pared, venga de donde venga. `fijarNivel()`
  existe en el repositorio pero está enterrado en otra pantalla. Quien ya hace quince
  flexiones abre la app, ve la pared, y se va. Es una fuga en el día cero.
- **Cero ganchos de retorno.** Grep de `Notification`, `requestPermission`, `push`: sin
  resultados. Ni recordatorio, ni badge, ni widget, ni reactivación.
- **No se puede borrar ni corregir una sesión mal cargada.** `borrarSesion` existe en el
  repositorio y no la llama ninguna pantalla. Un toque de más queda para siempre y
  contamina el motor.
- **"Volumen" suma repeticiones con segundos.** 25 segundos de plancha + 10 flexiones = 35
  de "volumen". Es la tercera métrica de la home y el eje Y del único gráfico.
- **Sin demostración visual de los ejercicios.** Solo texto. En calistenia la técnica es el
  80% del resultado y el 100% del riesgo.

### 1.7 Por qué los tests no lo vieron

Los 44 tests verifican las reglas del motor una por una: dado este avance y este
resultado, devolvé esta decisión. Ninguno verifica un **resultado a lo largo del tiempo**.
Por eso una suite en verde convive con un motor que se cuelga durante diecisiete semanas.

Las simulaciones que expusieron 1.1 y 1.2 corren en 300 milisegundos. Es el test que
faltaba, y está incluido en los cambios que acompañan a este documento.

---

## 2. Lo que dice la evidencia (y lo que hay que dejar de creer)

Esta sección resume seis revisiones de literatura hechas para este informe. Está acá
porque casi todas las decisiones de producto de la sección 4 dependen de ella, y porque
buena parte de lo que "todo el mundo sabe" sobre fitness y apps es falso.

### 2.1 El hallazgo que reordena todo el producto

> **La respuesta afectiva DURANTE el ejercicio predice la actividad física futura. La
> respuesta afectiva POST-ejercicio no la predice.**
> Rhodes y Kates (2015), *Annals of Behavioral Medicine*, 24 estudios.

Todas las apps preguntan "¿cómo te fue?" al final. Están midiendo exactamente lo que no
sirve para predecir si la persona vuelve.

De ahí se desprende una cadena que cambia el diseño del motor:

- El afecto depende de la intensidad de forma **discontinua**: por debajo del umbral
  ventilatorio es homogéneamente positivo; entre umbrales, heterogéneo; por encima del
  punto de compensación respiratoria, homogéneamente negativo (teoría de modo dual de
  Ekkekakis).
- **Llegar al fallo empeora la valencia afectiva** frente a cortar con 1 a 3 repeticiones
  en reserva, sin beneficio proporcional en hipertrofia ni en fuerza (Refalo et al., 2025;
  Grgic et al., 2022).
- El placer **recordado** y el **pronosticado** siguen la regla de pico-final, y son ellos
  —no el placer promedio real— los que predicen la conducta futura. Bajar la intensidad
  hacia el final aumenta ambos con el mismo trabajo total (Zenko, Ekkekakis y Ariely, 2016).

Conclusión de ingeniería: **el motor de progresión necesita una compuerta afectiva, no
solo una compuerta de rendimiento.** Un motor que optimiza únicamente el número es ciego
al costo hedónico, que es justamente lo que decide si va a haber una sesión siguiente.

### 2.2 Lo que hay que dejar de prometer

La cadena mecanicista que sostiene el discurso de "entrenar te mejora el cerebro" está
mucho peor sostenida de lo que suena, y usarla sería un riesgo reputacional asimétrico: el
beneficio de decirlo es marginal y el costo de que un usuario informado lo detecte es la
credibilidad entera.

- **El efecto del ejercicio crónico sobre la cognición en adultos sanos se desvanece al
  corregir.** Ciria et al. (2023), *Nature Human Behaviour*: d = 0,22 crudo → d = 0,13 con
  control activo y diferencias basales → **d = 0,05 (IC95% −0,09 a 0,14)** corrigiendo
  sesgo de publicación. El ensayo EXERT (Baker et al., 2025; n = 296, 12-18 meses,
  adherencia 81-87%) no encontró **ninguna** diferencia entre aeróbico de intensidad
  moderada-alta y estiramiento de baja intensidad.
- **BDNF:** el sérico es mayormente plaquetario, el aumento es transitorio, el
  entrenamiento de fuerza no lo mueve de forma consistente (Goekint et al., 2010), y nadie
  mostró que el cambio en una persona prediga ningún resultado cognitivo suyo.
- **Neurogénesis e hipocampo:** ni siquiera está resuelto si existe neurogénesis
  hipocampal adulta en humanos, y el metaanálisis de Firth et al. (2018, n = 737) no
  encontró efecto sobre el volumen hipocampal total.
- **Irisina:** evidencia de ratón vendida como mecanismo humano; su medición fue impugnada
  por reactividad cruzada de anticuerpos (Albrecht et al., 2015).
- **"El ejercicio es tan efectivo como los antidepresivos":** la Cochrane restringida a
  ensayos de bajo riesgo de sesgo da SMD −0,18, no significativo (Cooney et al., 2013).

**Lo que sí se puede prometer, y es bastante:** el efecto **agudo** de una sola sesión
sobre el ánimo. Weinstein et al. (2024): g = 0,34 para ánimo general, g = 0,41 para
síntomas depresivos, g = 0,50 para ansiedad. Es la promesa mejor sostenida y —no
casualmente— la única que la persona puede verificar por sí misma el mismo día.

La promesa honesta de LyraFit no es *"vas a pensar mejor"*. Es *"hoy, en las próximas
horas, es probable que te sientas mejor — y la app te lo va a mostrar con tus propios
datos"*.

### 2.3 Rachas: la evidencia está en contra

Este es el punto donde el consenso de la industria y la evidencia se separan.

- Las rachas de días consecutivos tienen **asimetría desfavorable**: la racha intacta
  motiva, la rota desmotiva, y el daño se amplifica cuando la persona se atribuye la
  ruptura a sí misma.
- La gamificación en actividad física tiene efecto **real pero chico**, y cerca de la mitad
  se apaga en el seguimiento.
- Las recompensas tangibles y esperadas **socavan la motivación intrínseca** (efecto de
  sobrejustificación, d ≈ −0,36). El feedback informativo sobre competencia la **aumenta**
  (d ≈ +0,33). Es la diferencia entre una moneda de oro y decirle a alguien que hizo tres
  repeticiones más que el mes pasado.
- **Bonificar el regreso** después de una falta está entre las intervenciones más eficaces
  conocidas para asistencia. Es exactamente lo opuesto al castigo por romper la racha.
- Las cifras que circulan en blogs de producto ("78% abandona en 72 horas", "el streak
  freeze bajó el churn un 21%") **no tienen fuente primaria**: son marketing de
  herramientas de gamificación.

Y un dato que contradice frontalmente la intuición de producto: incentivar visitas dentro
de una **ventana horaria fija** produjo *menos* persistencia que incentivar visitas a
cualquier hora (Beshears et al., 2021, n = 2508). Lo que hay que estabilizar es la señal,
no el reloj.

En una app de fuerza el problema es peor que en Duolingo: **el descanso es parte del
programa.** Una racha diaria es literalmente contraproducente. La sección 3 propone qué
poner en su lugar.

### 2.4 Otras creencias que la evidencia no sostiene

| Creencia | Qué dice la evidencia |
|---|---|
| "21 días para formar un hábito" | Sin diseño experimental (Maltz, 1960). Mediana real ~59-66 días, rango 4-335, y el ejercicio está en el extremo lento. El "66 días" también está sobre-citado: la media del metaanálisis de Singh (2024) es 106-154 días. |
| "Si no llegás al fallo no sirve" | Cortar con 1-2 RIR da hipertrofia y fuerza comparables, con mejor afecto y menos fatiga. |
| "Terminá fuerte" | La regla del pico-final dice lo contrario: terminar destruido envenena el recuerdo de toda la sesión. |
| "HIIT resuelve la adherencia por ser corto" | En ECA con ≥12 meses no muestra ventaja de adherencia; sin supervisión la gente baja la intensidad sola. |
| "Preguntarle al usuario qué le impide entrenar ayuda" | La identificación de barreras se asoció a **menor** autoeficacia (Ashford, 2010). La pantalla de obstáculos, que parece empática, probablemente resta. |
| "Las frases motivacionales ayudan" | Persuasión verbal: la fuente más débil de autoeficacia según Bandura, y asociada a menor autoeficacia. Ocupan el lugar que debería tener un dato sobre el desempeño propio. |
| "Hay que entrenar siempre a la misma hora" | La rigidez horaria incentivada dio peor persistencia que la flexibilidad. |
| "ACWR (ratio carga aguda/crónica) previene lesiones" | Demolido: la carga aguda está contenida en la ventana crónica (acoplamiento matemático), el ratio no es un escalado válido, y **si se reemplaza la carga crónica por un número aleatorio el ratio conserva la misma asociación con lesión**. No implementarlo. |
| "El frío post-entrenamiento acelera la recuperación" | Atenúa la hipertrofia y la ganancia de fuerza. Para una app centrada en progresión, es una recomendación adversa. |
| "Box breathing (Navy SEALs)" | Sin ventaja demostrada; el pedigrí es marketing. Lo mecanicamente relevante es la exhalación prolongada, no la simetría del ciclo. |
| "La ventana anabólica de 30-60 minutos" | Se cayó: el efecto aparente del timing se explicaba por la proteína total diaria. |
| "El techo de 20-30 g de proteína por comida" | No existe ese límite superior abrupto. |

### 2.5 No existe el %1RM en calistenia — y eso es un problema resoluble

Las ecuaciones de estimación (Brzycki, Epley) tienen error aceptable hasta ~10-12
repeticiones y se degradan rápido después; además la relación %1RM-repeticiones no es
universal entre personas. Conclusión: **no construir un estimador de 1RM ni mostrarlo como
número de fuerza.**

La alternativa defendible es anclar cada ejercicio a su **Coeficiente de Carga Relativa
(CCR)**: la fracción del peso corporal efectivamente soportada, que para las variantes de
flexión está medida directamente en la literatura. Con eso se puede definir un índice
interno, explícitamente etiquetado como estimación:

```
ICL = CCR / (1,0278 − 0,0278 · min(reps + RIR, 12))
```

El `min(·, 12)` es el punto clave: por encima de doce repeticiones efectivas la fórmula
pierde validez, así que satura y la app dice *"estás en zona de resistencia, subí de
palanca"* en lugar de mostrar un número falso.

Verificación de coherencia entre ejercicios distintos:

- 12 flexiones completas (CCR 0,64), RIR 0 → ICL = 0,92
- 8 flexiones diamante (CCR 0,70), RIR 1 → ICL = 0,90

Dos estados de fuerza casi equivalentes dan un índice casi idéntico. Eso da lo que hoy no
existe: **una curva de progreso continua que no se corta cada vez que la persona cambia de
nivel.** Hoy `Progreso.tsx` no puede graficar nada comparable a través de un salto de
cadena, que es justamente donde ocurre el progreso más importante.

Sobre las variables de sobrecarga, la jerarquía por evidencia es clara:

1. **Apalancamiento** (siguiente eslabón). Es la única que replica funcionalmente un
   aumento de %1RM. Es lo que LyraFit ya hace, y está bien.
2. **Repeticiones**, dentro de una ventana acotada.
3. **Series**, con tope semanal.
4. **No usar como progresión automática:** tempo, reducción de descansos, inestabilidad.
   El tempo no funciona como palanca de carga, acortar descansos empeora el estímulo y la
   inestabilidad reduce la producción de fuerza.

---

## 3. La arquitectura de adherencia que reemplaza a la racha

La racha de LyraFit está rota (sección 1.4). La respuesta correcta no es arreglar el
cálculo: es **borrarla** y poner en su lugar cuatro mecánicas que atacan los mismos
moderadores sin la asimetría que las hace dañinas. Ninguna cuesta más que unas pocas
decenas de líneas.

### 3.1 Adherencia rodante de 28 días (A28)

```
A28 = sesiones completadas en los últimos 28 días / (meta_semanal × 4)
```

Se muestra como *"9 de 12"* y como barra. **Nunca se resetea a cero** y siempre se puede
recuperar en días, no en semanas. A diferencia de la racha, no tiene un estado
catastrófico: perder un día mueve la barra un poco, no la destruye.

Detalle gratis con evidencia detrás: dejar que la persona elija en ajustes si la barra dice
*"llevás 9 de 12"* o *"te faltan 3 de 12"*. Es autonomía sobre el encuadre, y en un
megaestudio de 54 intervenciones esa opción quedó entre las cinco mejores.

### 3.2 Créditos de perdón

```
créditos = min(2, floor(semanas_activas))    // recarga 1 por semana, tope 2
```

Al perder una ventana planificada se consume un crédito y la barra **no baja**: el día
queda marcado como cubierto. Esto ataca directamente el moderador que más daño hace de la
ruptura de racha —la autoatribución del fracaso—: el sistema ya contempló que ibas a
faltar, así que faltar no es una falla personal, es un uso previsto.

### 3.3 Sesión de vuelta

Bonificar el regreso después de una falta está entre las intervenciones más eficaces
conocidas para asistencia. La implementación es directa:

```
intervalo_habitual = mediana de los últimos 10 intervalos entre sesiones
si dias_desde_ultima >= 1,5 × intervalo_habitual:
    volumen_objetivo = 0,7 × volumen_habitual
    'cumplido' se evalúa contra ESE objetivo reducido
```

La vuelta casi siempre es un éxito, que es una experiencia de maestría justo en el momento
de máxima fragilidad. Copy: *"sesión de vuelta, más corta a propósito"*. **Nunca:** *"te
perdiste 5 días"*.

Plantilla obligatoria del copy tras una falta, en este orden:

1. Normalizar sin minimizar — *"faltaste 4 días; le pasa a todo el mundo y no borra nada de
   lo que hiciste"*.
2. Reafirmar identidad con dato duro — *"llevás 47 sesiones"*.
3. Ofrecer la acción más chica posible — *"¿arrancamos con 7 minutos?"*.

Prohibido: cuenta regresiva de racha perdida, emojis tristes, porcentaje en rojo.

### 3.4 Sesión mínima viable ("sesión corta")

Un ejercicio por cadena, una serie cada uno, seis a ocho minutos, siempre disponible en la
home a un toque.

La clave está en la separación:

- **Cuenta** como sesión completa para A28, para el contador de identidad y para el índice
  de consistencia.
- **No cuenta** para la lógica de progresión: no dispara subida ni bajada, se marca como
  sesión neutra.

Esa separación es lo que preserva la validez del motor sin castigar la adherencia.
Implementación: un flag `tipo: 'corta'` en el registro de sesión y su exclusión de la
ventana que evalúa el motor.

### 3.5 Identidad en vez de racha

La identidad de ejercitante es uno de los predictores observacionales más fuertes de
conducta, y moverla experimentalmente produce cambios grandes en actividad física.

Reemplazar la racha por un **contador acumulativo e irreversible**: *"sesiones de tu
vida"*, con hitos en 10, 25, 50, 100, 200 y 365. Nunca baja. Costo: un entero en Dexie.

*"Sesión 47"* pesa más que *"+2 repeticiones"*, porque una habla de quién sos y la otra de
lo que hiciste.

Complemento: una etiqueta autoelegida en el onboarding —*"¿cómo te querés describir dentro
de un año?"*— usada literalmente en el copy de cierre de sesión.

### 3.6 Consistencia contextual, sin score

Lo que automatiza una conducta es la estabilidad de la **señal**, no la del reloj. LyraFit
puede calcular gratis, con los timestamps que ya guarda:

```
C = 1 − (desvío circular de la hora de inicio de las últimas 10 sesiones / 6 h),  acotado a [0,1]
```

**No mostrarlo como score** —sería una segunda métrica reprobable—. Usarlo internamente
para elegir la hora del recordatorio, y mostrar una sola frase cuando `C ≥ 0,7`: *"tus
sesiones ya caen solas alrededor de las 19:30"*.

Y para el recordatorio, en lugar de pedir una hora fija, pedir **k ventanas candidatas**
por semana con k ≥ meta + 1:

```
prob(ventana v) = (sesiones hechas en v + 1) / (veces que se ofreció v + 2)   // Laplace
```

Se notifica en el argmax con probabilidad 0,8 y en una alternativa con 0,2, para no
colapsar la exploración.

---

## 4. Motor v2: la reescritura del corazón

Esta sección es la más importante del documento. Es una especificación, no una idea: se
puede implementar leyéndola.

### 4.1 Reemplazar el clasificador ternario por un indicador continuo

`evaluarSesion` juzga por la **peor serie**, que es el estimador con más varianza de todos
los disponibles; y como la fatiga intra-sesión hace que la peor serie sea casi siempre la
última, en la práctica mide *resistencia a la fatiga* en vez de capacidad.

Reemplazarlo por el **Rendimiento Relativo de Sesión**:

```
V_logrado  = Σ series[i].logrado
V_objetivo = objetivo.series × objetivo.cantidad
peor       = min(series[].logrado)          // 0 si faltaron series

RRS = 0,75 · min(V_logrado / V_objetivo, 1,25)
    + 0,25 · min(peor / objetivo.cantidad, 1,25)
```

El peso 0,25 en la peor serie preserva la intuición correcta que ya estaba en el código
—tres series de diez y una de dos no es un objetivo cumplido— sin darle dictadura al
estimador más ruidoso. El tope 1,25 evita que una sesión extraordinaria compense dos malas.

Las series no realizadas cuentan como 0 y fuerzan `peor = 0`, así que "abandonó a la mitad"
sigue penalizado sin necesitar la rama especial `faltaronSeries`.

**Eliminar `UMBRAL_FALLO = 0,6`**: es un umbral arbitrario con una discontinuidad fea
—0,59 y 0,61 producen destinos completamente distintos— y con RRS continuo no hace falta.

### 4.2 Matar el estado absorbente con memoria suave

La memoria con reset duro es frágil y es la causa del defecto 1.1. Reemplazar las dos
rachas por una media móvil exponencial:

```
S₀ = 1,0                                  // arranque neutro
Sₙ = α · RRSₙ + (1 − α) · Sₙ₋₁,   α = 0,5
```

α = 0,5 da una memoria efectiva de ~2 sesiones —la misma inercia que buscaba
`EXITOS_PARA_AVANZAR = 2`— **sin resets, y por lo tanto sin lazo absorbente**.

Guardar `S` en el `Avance` como un solo float (`señal: number`) y borrar `rachaExitos` y
`rachaFallos`.

Comportamiento verificado: dos sesiones con RRS = 1,0 partiendo de S = 1,0 dejan S = 1,0 →
progresa. Una de 1,0 y una de 0,7 dejan S = 0,85 → sostiene. Es exactamente el
comportamiento pretendido, sin la trampa.

### 4.3 Exigir el dominio real antes de cambiar de nivel

El arreglo mínimo del defecto 1.2, antes de cualquier rediseño:

```ts
const dominado = avance.objetivoActual.cantidad >= actual.objetivo.cantidad
if (rachaExitos >= EXITOS_PARA_AVANZAR && dominado) { /* saltar de nivel */ }
```

Y bajar los topes declarados: los objetivos actuales (3×25 de flexión en la pared, 3×20
inclinada, 3×90 s de plancha) están más cerca de *Convict Conditioning* —el sistema con
menos respaldo de los cuatro grandes— que de *Overcoming Gravity*. La corrección es
llevarlos a **≤15 repeticiones y ≤30 segundos**, que es donde vive la ventana útil.

### 4.4 Triple progresión: la ventana de repeticiones que falta

Los sistemas de progresión más respetados —*Overcoming Gravity* de Steven Low, la
*Recommended Routine* de r/bodyweightfitness, las variantes serias de *Convict
Conditioning*— convergen todos en el mismo esquema: **doble o triple progresión con
ventana de repeticiones acotada y salto de dificultad al techo de la ventana.**

LyraFit ya está en el paradigma correcto —cadenas más progresión reactiva, que es la
decisión de diseño más importante y está bien tomada—. Lo que falta es la ventana. Orden
estricto:

1. **Repeticiones** hasta `r_max`
2. **Series** hasta `s_max`, respetando el techo de 20 series semanales por patrón
3. **Palanca**: siguiente eslabón, recalculando repeticiones (4.6)

### 4.5 Incremento proporcional

El incremento fijo (+1 repetición, +5 segundos) produce pasos relativos que varían casi un
orden de magnitud a lo largo de una misma cadena: +1 sobre 5 es un 20%, +1 sobre 20 es un
5%.

```ts
function incremento(medida: Medida, cantidadActual: number): number {
  const delta  = medida === 'segundos' ? 0.15 : 0.10
  const minimo = medida === 'segundos' ? 3    : 1
  return Math.max(minimo, Math.round(cantidadActual * delta))
}
```

5 reps → +1 · 12 reps → +1 · 20 reps → +2 · 10 s → +3 · 20 s → +3. Cinco líneas, y es el
arreglo con mejor relación esfuerzo/beneficio de toda la lista.

### 4.6 Calibrar el cambio de nivel en vez de inventarlo

Hoy, al cambiar de nivel, el motor resetea a un `entrada` fijo escrito a mano, sin relación
con lo que la persona demostró. Dos personas con capacidades muy distintas reciben el mismo
objetivo.

Con los CCR definidos, el reset se **calcula**:

```ts
const p          = 1.0278 - 0.0278 * Math.min(repsActuales, 12)  // fracción del máximo
const rho        = ccrNuevo / ccrActual
const repsNuevas = Math.floor((1.0278 - p * rho) / 0.0278)
return clamp(repsNuevas, rMin, rMax)
```

Verificación 1 — 12 flexiones completas (CCR 0,70) → diamante (CCR 0,76): da **9
repeticiones**. Razonable.

Verificación 2 — 15 flexiones de rodillas (CCR 0,55) → flexión completa (CCR 0,70): da
**5 repeticiones**, que coincide exactamente con el `entrada` escrito a mano hoy. Buena
señal: la fórmula reproduce el juicio experto donde ese juicio ya estaba bien calibrado, y
lo corrige donde no.

Para isométricos, el equivalente es la ley de potencia de tiempo hasta el fallo:

```
t_nuevo ≈ t_actual · (ccr_actual / ccr_nuevo)³
```

De 20 s de palanca agrupada (0,40) a agrupada avanzada (0,55): 20 · 0,385 ≈ **8 segundos**.
Coherente con la práctica.

Limitación honesta que hay que documentar en el código: Brzycki solo vale hasta ~12
repeticiones, y por eso está el `min(reps, 12)`.

### 4.7 La compuerta afectiva

Esto es lo que ninguna app de calistenia tiene, y sale directo de 2.1. El motor deja de
optimizar solo el número:

```
SUBIR     si cumplió las 2 últimas Y mediana(RIR) ≥ 1 Y media(FS) ≥ 0
MANTENER  si cumplió las 2 pero RIR mediano = 0 o media(FS) < 0    → "consolidando", no "fallaste"
BAJAR     si falló las 2 últimas, O media(FS de las 3 últimas) ≤ −1,5
```

donde FS es la *Feeling Scale* de Hardy y Rejeski y RIR las repeticiones en reserva.
Ambas son escalas validadas de **un solo ítem**, ya usadas específicamente en entrenamiento
de fuerza, que resuelven el problema del input barato: un toque cada una.

La consecuencia práctica es que la app deja de empujar a alguien hacia un nivel que puede
sostener numéricamente pero que lo está haciendo sentir mal — que es, según la evidencia,
la definición operativa de alguien que va a abandonar.

### 4.8 Micro-escalones

Si el salto al siguiente eslabón implica un aumento de volumen equivalente mayor al 20%,
insertar un escalón intermedio: series mixtas con (n−1) series en el nivel viejo y 1 en el
nuevo, hasta que todas migren.

Esto convierte cuatro escalones en unos doce y **multiplica por tres la frecuencia de
experiencias de maestría**, que es el insumo de la autoeficacia. Además resuelve el salto
de carga del +60% señalado en 1.2.

### 4.9 La serie de cierre

Después de la última serie prescrita, agregar automáticamente una serie marcada como
**cierre**, del ejercicio más fácil de la sesión, con objetivo = `round(0,6 × objetivo)`.
Cuarenta a noventa segundos. Nunca cuenta para fallo. Recién después de esa serie se pide
la Feeling Scale.

Sale directo de la regla del pico-final: la rampa descendente mejora el placer post,
recordado y pronosticado, con el mismo trabajo total. Es, medida por línea de código,
**probablemente la feature de mayor retorno de todo este documento.**

Corolario negativo, porque contradice el folklore de gimnasio: **no** poner el ejercicio
más duro al final "para terminar fuerte". Eso envenena el recuerdo de toda la sesión.

---

## 5. La capa de vitalidad: sueño, alimentación y cognición sin pseudociencia

Acá es donde la mayoría de las apps se vuelve humo. La regla que ordena toda esta sección
es una sola:

> **Ninguna cadena de texto de la app puede afirmar un mecanismo o un resultado que no esté
> (a) medido dentro de la propia app, o (b) respaldado por un ensayo controlado.**

Es implementable como checklist de revisión, y conviene volverla un test: una lista negra
literal para buscar en el código —*parasimpático, cortisol, sistema inmune, detox, resetear
el sistema nervioso, equilibrar la energía, coherencia cardíaca, BDNF, neuroplasticidad,
optimizar*— que rompa el build si aparece. Es la forma más barata de que una sola persona
no se traicione a sí misma en un momento de entusiasmo de marketing.

### 5.1 Delta de vitalidad — lo primero, lo más barato, lo más honesto

Un solo ítem, dos veces por sesión: antes de la primera serie y después de la última.

> *"Ahora mismo, ¿cuánta energía sentís?"* — siete chips, un toque. No slider: cuesta más y
> da precisión falsa.

Dos campos opcionales en la tabla de sesiones (`vitPre`, `vitPost`). La métrica es
`deltaVitalidad = vitPost − vitPre`, con media móvil sobre las últimas diez sesiones.

Ese número es honesto, es propio de cada persona, y **casi ninguna app de entrenamiento lo
tiene**. Es además la única forma de cumplir la promesa de 2.2 —*"hoy es probable que te
sientas mejor"*— sin pedirle a nadie que confíe: se lo muestra con sus propios datos.

Declarar en la interfaz: *"adaptado de la Subjective Vitality Scale (Ryan y Frederick,
1997); no es la escala completa"*.

### 5.2 Predicción de repeticiones → calibración interoceptiva

**Este es el diferenciador competitivo real, y no lo tiene nadie.**

Antes de cada serie, junto al objetivo que ya se muestra, un stepper con valor por defecto
igual al objetivo: *"¿cuántas te salen hoy?"*. Costo: cero toques si acepta el default.

Con eso, datos que la app **ya registra** se convierten en una medida objetiva de
conciencia corporal, sin sensores, sin servidor y sin preguntar nada más:

```
e          = repsReales − repsPredichas            // por serie
sesgo      = mean(e) sobre las últimas 30 series   // positivo = te subestimás
precisión  = MAE = mean(|e|)
normalizada= mean(|e| / max(repsPredichas, 1))
```

Tendencia: comparar el MAE de las últimas 30 contra las 30 previas, y mostrar el cambio
**solo** si la diferencia supera 0,3 repeticiones — por debajo de eso, con n = 30, es ruido.

Presentación mensual, nunca por sesión. Sin racha, sin ranking, separada visualmente del
progreso. Copy: *"En las últimas 30 series te equivocaste en promedio 1,4 repeticiones y
tendés a subestimarte (+0,8)."*

Riesgo a mitigar: es manipulable prediciendo bajo. Por eso **nunca** debe ser una meta ni
tener recompensa.

Interocepción es, además, exactamente lo que se entrena entrenando. Es la conexión honesta
entre el cuerpo y la cabeza que el mercado busca vender con neurociencia de podcast, y acá
sale de aritmética sobre datos que ya existen.

### 5.3 Las tres preguntas diarias y el índice de estado

Quince segundos, una pantalla, sin scroll y sin botón de "siguiente". Las tres orientadas
en la misma dirección (5 = mejor), porque mezclar direcciones obliga a invertir mentalmente
y produce errores:

| Ítem | Pregunta | Escala |
|---|---|---|
| Sueño | *¿Cómo dormiste anoche?* | Muy mal · Mal · Más o menos · Bien · Muy bien |
| **Energía** (el de mayor señal) | *¿Cómo está tu energía hoy?* | En el piso · Cansado · Normal · Con energía · A pleno |
| Dolor muscular | *¿Cómo andan tus músculos del último entrenamiento?* | Muy doloridos · Doloridos · Algo cargados · Casi bien · Sin dolor |

Rama de seguridad, solo si el tercer ítem es 1 o 2: *"¿Es dolor muscular parejo o hay una
zona puntual que te molesta?"*. Si es puntual, selector de cadena y flag booleano. **Nunca
promediar eso dentro del índice**: es información categórica de seguridad, no un grado de
bienestar.

Botón *"Hoy no"* siempre visible, sin culpa y sin racha rota: quien puede saltar responde
más veces en el largo plazo.

**La matemática**, resumida (el detalle completo está en las notas de investigación):
normalizar cada ítem a [0,1] y promediar con pesos iguales; dos EWMA con α sensible al
tiempo —lenta de 28 días para la línea de base, rápida de 7 para la tendencia—; calcular el
z **antes** de actualizar el estado, porque si se actualiza primero la línea de base
persigue al dato y todos los z se encogen hacia cero; piso y techo en la desviación
estándar; y, en cuanto haya 30 entradas, pasar de z normales a **percentiles empíricos**,
porque una suma de tres ítems discretos no es normal.

Y las reglas anti-ruido, que importan más que la fórmula:

- **No mostrar nada** hasta 14 entradas, con al menos 10 en los últimos 21 días.
- Si pasaron más de 10 días sin datos, marcar la línea de base como rancia y exigir 5
  entradas nuevas.
- **Nunca imputar** un día faltante con la media: fabrica estabilidad falsa y encoge
  artificialmente el denominador del z. El α sensible al tiempo ya maneja los huecos.
- Banda muerta: **el ~68% de los días no debe pasar absolutamente nada.** El silencio es la
  respuesta correcta.
- Ámbar o rojo modifican el entrenamiento solo si se sostienen **2 de las últimas 3**
  entradas — la misma filosofía que el 2/2 del motor, y por lo tanto explicable con las
  mismas palabras.
- Nunca decimales ni porcentajes tipo "73,4% de readiness": implican una precisión que no
  existe. Tres estados con palabras.
- Nunca comparar con otras personas: la escala no tiene significado interpersonal.

### 5.4 El uso más valioso del índice no es mostrarlo

> **Es impedir que el motor degrade el objetivo por dos días malos.**

```
NORMAL   → no cambia nada. Ni mensaje.
VERDE+   → nada automático. A lo sumo: "si tenés ganas, hoy es buen día para un récord".
ÁMBAR    → objetivo × 0,90, se saltea la última serie,
           *** la sesión NO cuenta para el contador de fallos ***
           pero SÍ puede contar para promoción si igual cumple. Premiar, nunca castigar.
ROJO     → se ofrece movilidad de 10 min. Si entrena igual, la sesión no cuenta
           ni a favor ni en contra.
DOLOR LOCALIZADO → congela esa cadena: sin promoción ni democión hasta que el flag
           esté ausente en 3 entradas seguidas.
```

El razonamiento es de control de errores, no fisiológico: **el motor decide con dos
observaciones; si una de esas dos está contaminada por un estado transitorio identificable,
la decisión es inválida por construcción.** Proteger el contador cuesta un `if` y elimina
el modo de falla más frustrante posible — que la app te baje de nivel porque dormiste mal
el martes y el jueves.

### 5.5 Alimentación: siete hábitos, cero calorías

El balance energético es cierto y prácticamente inservible como feature de software: el
autorreporte de ingesta subestima masivamente y el gasto no se puede estimar sin sensores.
Contar calorías sería construir una versión mediocre de MyFitnessPal y heredar todos sus
riesgos.

La versión honesta son hábitos, ordenados por impacto:

1. **Sueño** — *"¿Cuánto dormiste anoche?"* en cinco chips. Mayor tamaño de efecto
   documentado de toda la revisión, y cruzable con datos que la app ya tiene. Devolución
   recién a las tres semanas y solo si hay señal: *"en las sesiones que venís de dormir
   menos de 6 horas cumpliste el objetivo el X% de las veces; durmiendo más de 7, el Y%"*.
   Sin objetivo de sueño, sin racha, sin juicio.
2. **Proteína por porciones, nunca por gramos** — *"¿En cuántas comidas de hoy hubo una
   porción de proteína?"*, stepper 0-6. Referencia visual una sola vez: *"una porción es más
   o menos la palma de tu mano"*. Es un **piso**: la app nunca dice "te pasaste".
3. **Hora de la última cafeína** — el único hábito donde la app le muestra algo que su
   percepción no puede detectar. Corte = hora de dormir − 9 h. Copy: *"tomaste café dentro
   de las 9 horas previas a acostarte. En los estudios eso recorta el sueño casi una hora, y
   lo interesante es que a esa distancia la gente no lo siente. No es que dormiste mal: es
   que dormiste menos sin enterarte."*
4. **Alcohol** — tres opciones, cero carga moral. Prohibido: "días limpios", rachas de
   abstinencia, felicitaciones por no tomar.
5. **Peso corporal** — solo como guardarraíl de seguridad, y **la recomendación es dejarlo
   fuera de la v1**. Si se implementa: opt-in aparte y apagado por defecto, semanal, solo
   media móvil de 7 días, sin peso objetivo, sin IMC, sin porcentaje de grasa, sin gráfico
   que celebre una tendencia descendente. El beneficio es un guardarraíl; el costo es meter
   una balanza en una app de calistenia.
6. **Verdura o fruta en dos comidas** — binario. Menor impacto sobre rendimiento, mayor
   sobre salud a largo plazo, y el copy tiene que decir esa diferencia en vez de venderlo
   como "te ayuda a entrenar".
7. **Creatina** — casilla de adherencia, sin entusiasmo. Es el **único** suplemento que la
   app debería nombrar: si aparece cualquier otro (BCAA, glutamina, quemadores, colágeno),
   se pierde credibilidad y se afirma algo que la evidencia no sostiene.

Todo el módulo cabe en dos tablas nuevas de Dexie y una versión de migración, sin tocar el
motor ni las pantallas existentes:

```ts
this.version(2).stores({ diario: 'fecha, actualizadoEn', pesos: 'fecha, actualizadoEn' })
```

con la lógica de umbrales en un `src/dominio/nutricion.ts` puro y testeable, igual que
`progresion.ts` — respetando la separación que el README ya defiende.

**Lo que la app puede afirmar:** que comer suficiente proteína mejora un poco lo que se
gana entrenando (Morton, 2018); que dormir poco mientras se baja de peso hace perder
músculo en vez de grasa (Nedeltcheva, 2010); que la cafeína afecta el sueño 6-9 horas
después aunque no se sienta (Drake, 2013); que el alcohol adormece rápido y empeora la
segunda mitad de la noche (Ebrahim, 2013); que bajar rápido cuesta músculo y fuerza
(Garthe, 2011); que la creatina monohidrato es el suplemento con más evidencia; que más
fibra se **asocia** con menos mortalidad (Reynolds, 2019).

**Lo que no puede afirmar:** ninguna cifra de calorías ingeridas o gastadas; que un horario
de comida cambie la composición corporal; que un alimento sea inflamatorio, tóxico o detox;
que la creatina mejore la cognición o compense el mal dormir; que el ayuno intermitente sea
superior; ni que la app pueda estimar porcentaje de grasa o gasto energético.

### 5.6 Detección de señales de alarma

La calistenia tiene un riesgo específico: la fuerza relativa premia mecánicamente el peso
bajo, así que el producto empuja estructuralmente hacia la restricción. Baja
disponibilidad energética y RED-S son **el** riesgo fisiológico del segmento.

Se puede detectar sin diagnosticar nada y sin instrumentos clínicos, con banderas
conductuales sobre datos que ya existen: 10+ días entrenados consecutivos sin descanso;
registro de peso 5 de los últimos 7 días; entrenar en días que la rutina no pedía mientras
el motor viene fallando; caída de peso ≥4% en 28 días; esfuerzo percibido ≥9 en 8 de las
últimas 10 sesiones.

Con tres banderas o más, **un** mensaje, no antes de 30 días del anterior, sin cifras, sin
bloquear nada y **nunca** como notificación push:

> *"Frenamos un segundo. Venís entrenando muy seguido, comiendo poco y sin descansar. Eso
> no acelera nada: en los estudios, entrenar así hace perder músculo y fuerza, no ganarlos.
> La app no puede evaluar tu salud. Si esto te resuena, hablalo con alguien. Podés seguir
> usando LyraFit normalmente."*

### 5.7 El ritual de cierre, y por qué no lleva racha

Cuarenta y cinco segundos opcionales al terminar: cinco ciclos de suspiro fisiológico
—inhalación nasal ~2 s, segunda inhalación corta ~1 s, exhalación bucal ~5-6 s—. Un
círculo SVG animado con `requestAnimationFrame`, cuya fase se calcula contra un timestamp
persistido y **nunca** acumulando ticks de `setInterval` (la misma disciplina que ya tiene
`useTemporizador`). Cero librerías.

Copy permitido: *"exhalación larga. El corazón desacelera un poco en cada exhalación. Sirve
para marcar que la sesión terminó."* Copy prohibido: todo lo demás.

El ritual tiene valor legítimo como estructura de sentido y marca de transición aunque su
mecanismo no esté probado, y **no hace falta mentir para que funcione**.

Prohibición contraintuitiva pero importante: **nada de rachas sobre prácticas
contemplativas.** Rachas para entrenar, discutible. Para respirar, no: una racha convierte
una práctica de aceptación en obligación de rendimiento, que es exactamente el modo
evaluativo asociado a peor regulación emocional.

### 5.8 Lo que no hay que construir nunca

Wim Hof o cualquier hiperventilación autoadministrada (riesgo agudo real de síncope);
HRV sin sensor, incluida la fotopletismografía por cámara; meditación guiada larga;
ACWR; inmersión en frío como recomendación post-entrenamiento; PHQ-9, GAD-7 o cualquier
instrumento de tamizaje clínico; y cualquier promesa fisiológica que la app no pueda medir.

---

## 6. Qué hacen los mejores del mundo

Diez investigaciones sobre 106 productos: calistenia, fuerza, hábito, social, recuperación,
alimentación, sueño, IA y visión, plataforma y negocio. Lo que sigue es lo que sobrevivió
al filtro de *"¿esto se puede construir sobre LyraFit y cambia algo?"*.

Un aviso sobre las cifras: buena parte de los números que circulan en este mercado —
retención, churn, efecto del *streak freeze* — no tienen fuente primaria verificable. Están
marcados como tales o directamente excluidos.

### 6.1 Calistenia: LyraFit está en el paradigma correcto y le faltan dos reglas

La *Recommended Routine* de r/bodyweightfitness es el estándar de facto del segmento y la
única progresión escrita como un algoritmo cerrado. Es **el mismo motor que LyraFit ya
tiene**. Le faltan exactamente dos reglas:

1. **El escalón nuevo arranca con objetivo reducido, no con el del escalón viejo.** La RR
   es explícita: lográs 3×8 y pasás a la variante más difícil **arrancando en 3×5**.
   LyraFit, al retroceder, asigna el `objetivo` (tope) del ejercicio anterior — que es
   justo lo que produce el yo-yo entre niveles.
2. **El criterio de bajada es "no llego al mínimo del escalón nuevo"**, no "fallé dos
   veces".

Ambas son esfuerzo S y arreglan un defecto real. Y hay un detalle de UX que la propia RR
sufre y LyraFit puede evitar: **el gráfico de repeticiones se desploma cada vez que subís
de escalón** (8 → 5), o sea que el registro crudo muestra un retroceso justo en el momento
de mayor progreso. Es exactamente el problema que resuelve el índice continuo de 2.5.

Dónde se para LyraFit en el eje de exigencia es una decisión que hoy está tomada por
accidente:

| Sistema | Criterio para subir de flexión completa |
|---|---|
| Recommended Routine | 3×8 |
| LyraFit hoy (efectivo) | 3×6, y sin exigir el tope |
| LyraFit (tope declarado) | 3×15 |
| Hybrid Calisthenics | 3×25 |

La recomendación no es elegir un número, es **hacerlo configurable**: "ritmo rápido /
conservador" en vez de una constante escondida.

De **The Movement Athlete** —la app que más en serio se toma el diagnóstico— lo valioso es
el encuadre: *"tu nivel no es una categoría, es una coordenada por patrón"*. Ubican al
usuario en 1 de ~96 niveles con un test de tres minutos. Lo que **no** hay que copiar es el
assessment obligatorio y largo: es la queja documentada más frecuente contra ellos.

### 6.2 El registro durante la sesión: donde Hevy gana

El patrón que explica la reputación de Hevy es aburrido y decisivo: **columna anterior
prellenada, confirmación de un toque, temporizador automático.** Esfuerzo S.

LyraFit ya tiene el valor por defecto correcto (`propuesto = objetivo.cantidad`), pero le
falta lo de al lado: *"la última vez: 3×7"*. Un dato que ya está en la base y hoy no se
muestra en el momento en que sirve.

De **Renaissance Periodization** lo interesante no es el algoritmo completo sino su
estructura: preguntas cortas post-serie que alimentan el volumen de la sesión siguiente. En
calistenia el equivalente honesto es más modesto y más barato — y es, otra vez, el campo
`esfuerzo` que ya está declarado y sin usar.

**Cuatro agentes distintos, investigando dominios distintos, señalaron el mismo campo
muerto.** Uno lo llamó *"el dato muerto más caro del proyecto"*.

### 6.3 La racha: el mercado la está abandonando, y hay convergencia con la evidencia

El patrón señalado con mayor impacto por cinco dominios independientes es el mismo:
**cambiarle la unidad a la racha.** Semana cumplida en vez de día consecutivo. Y por encima
de cualquier contador que pueda volver a cero, **acumuladores monotónicos**: sesiones de tu
vida, volumen total, semanas cumplidas. Nunca bajan.

Complementos, todos esfuerzo S:

- **Comodín de semana** — el *streak freeze* sin economía de gemas y sin culpa.
- **Rampa de regreso** — bajarle la vara al que vuelve, automáticamente y dentro del motor.
  Señalado como el de mayor impacto del informe de hábito, y coincide exactamente con lo
  que dice la evidencia (3.3).
- **Techo explícito en vez de piso** — que la app te diga que pares. Es contraintuitivo y
  es lo que diferencia una app de fuerza de una de idiomas.
- **Modo descanso / pausa** — y racha de *entrenamiento*, nunca racha de *registro*.

### 6.4 Social sin servidor: lo que sí se puede

Sin backend y sin cuentas, casi todo el engagement social queda afuera. Lo que queda es
más de lo que parece, y es **salida de datos, nunca entrada**:

- **Resumen semanal como narrativa, no como dashboard** — el "Wrapped" semanal. Señalado
  como la pieza de mayor impacto del dominio social, y se calcula entero en local.
- **Tarjeta PNG generada en canvas + Web Share Level 2** — adquisición viral sin backend.
- **Leyenda de constancia** — el *Local Legend* de Strava, pero contra uno mismo.
- **Desafío mensual único derivado de los propios datos** — los premios de Apple Watch,
  reimplementados como función pura sobre el historial.
- **Insignias derivadas**, catálogo chico y visible: una función pura sobre las sesiones, no
  un estado guardado que se pueda corromper.

Y lo que **no** hay que construir: un feed. Funciona solo con masa crítica; sin ella es una
pantalla vacía que grita que la app está muerta. Para una persona sola es una sección que
nunca se llena.

### 6.5 Readiness: cómo lo construyen Whoop y Oura, y qué es honesto copiar

El consenso técnico entre los siete productos analizados es claro y coincide con la ciencia
de la sección 5.3:

- **Línea de base personal por z-score sobre ventana móvil, nunca umbral absoluto.**
- **Cambio mínimo significativo**: 0,5 SD para notar, 1 SD para actuar.
- **Guardar el desglose por componente**, no solo el compuesto. Es la decisión que después
  permite explicar y corregir.
- **Comunicar en oraciones y bandas, jamás en un número de dos dígitos.** El "73% de
  readiness" es precisión falsa, y es lo que Whoop hace peor.
- **No usar ACWR.** Coincide con lo que dice la literatura (2.4).

Y el punto donde el mercado y la ciencia coinciden en contra de la intuición: **el
readiness modula el objetivo, nunca vetea la sesión.**

### 6.6 Una tensión real entre fuentes, que conviene no tapar

Cuatro agentes distintos llegaron a posiciones incompatibles sobre el mismo tema:

| Fuente | Posición sobre el RPE |
|---|---|
| Calistenia | RPE como **veto** |
| Fuerza/hipertrofia | *"RIR como calibrador ocasional, jamás como entrada del motor"* |
| IA y coaching | *"se muestra y se loguea pero **nunca** gatea la progresión"* |
| Recuperación | *"modula el objetivo, **nunca** vetea"* |
| Ciencia de adherencia | compuerta afectiva **dentro** del motor |

La síntesis que las reconcilia, y que además es la que menos puede hacer daño:

> **El esfuerzo y el afecto protegen el contador y modulan el objetivo. No promueven, no
> vetean, y nunca son la entrada principal.**

Es decir: pueden impedir que una sesión mala cuente como fallo, y pueden bajar el objetivo
del día un 10%. No pueden hacer que alguien suba de nivel sin cumplir las repeticiones, ni
cancelarle un entrenamiento que quiere hacer. Es exactamente la conclusión a la que llegó
la revisión de medición subjetiva por un camino independiente: *"proteger el contador
cuesta un `if` y elimina el modo de falla más frustrante de la app"*.

### 6.7 Alimentación y sueño: dos números que hay que calcular bien

De las doce apps de alimentación, lo único verdaderamente reutilizable es matemático:

- **Nunca mostrar el peso crudo como número principal.** EWMA con decaimiento por huecos, o
  un Kalman de velocidad constante si se quiere la versión buena.
- **Pendiente robusta por Theil–Sen, con intervalo de confianza y la capacidad de decir
  "todavía no sé".** Es lo que separa una app que informa de una que adivina.

De las once de sueño, el entregable es uno solo: **una recomendación diaria, anclada a una
hora de levantarse fija.** Y el hallazgo más aprovechable es que el **cronotipo se puede
derivar del propio diario** (MSFsc de Roenneberg) sin cuestionarios y sin sensores.

Con un detalle de método que vale para todo el documento: la correlación sueño-rendimiento
hay que hacerla **contra el residuo**, nunca contra el resultado crudo. Si no, se está
midiendo la progresión, no el sueño.

### 6.8 IA y visión: lo que es viable y lo que es una trampa

La corrección de técnica por cámara aparece en toda demo y en toda ronda de inversión.
El veredicto de la investigación es duro y coincide con el sentido común: es cara de
construir, frágil en el mundo real (luz, ángulo, encuadre, ropa), incómoda de usar —nadie
quiere apuntarse la cámara para hacer flexiones en el living— y entra en zona gris
regulatoria si se le adjudica prevención de lesiones. **Para una persona sola es una trampa
que consume años.**

Y hay una observación que vale más que todo el módulo:

> El contenido de `erroresComunes[]` que LyraFit **ya tiene escrito** resuelve el 80% del
> problema por el 0,1% del costo.

Lo mismo con el "coach de IA": rompe el local-first, agrega costo marginal por usuario
justo en el modelo que no lo tiene, e introduce el riesgo de que la app diga algo
peligroso. Y es innecesario: **el motor de progresión ya es el coach**, y ya explica cada
decisión en una frase determinista y auditable.

Lo que sí vale, y es esfuerzo S:

- **Explicabilidad**: que cada decisión guarde su evidencia y se pueda desplegar.
- **Resumen semanal determinístico por plantillas** — el "feature de IA" con mejor relación
  costo/retención, y sin una sola llamada de red.
- **Detección explícita de meseta con tres acciones concretas.**
- **Tempo y tiempo bajo tensión medidos sin cámara**, con el temporizador que ya existe.

### 6.9 Plataforma: los límites reales de una PWA en 2026

Esta sección es la que más cambia lo que es posible, y está verificada contra las
posiciones oficiales de los navegadores.

**Lo que no existe, por más que lo digan los tutoriales:**

- **No hay notificación local programada en la web.** El service worker se mata a los
  segundos. Cualquier tutorial que diga lo contrario habla de un *origin trial* de Chrome
  que murió.
- **Background Sync y Periodic Background Sync son solo Chromium.** Si el plan de
  sincronización depende de ellos, en iOS no hay plan.
- **`showSaveFilePicker` no va a existir en Safari**: WebKit tiene posición oficial de
  oposición. El camino portable es `navigator.share` con archivos (Safari 14+) y
  `<a download>` como fallback.
- **En iOS no existe `beforeinstallprompt`** y no va a existir. Instalar se explica, no se
  ofrece programáticamente.

**Y una corrección importante al arreglo que ya está commiteado:** en Safari,
`navigator.storage.persist()` **es una consulta, no un pedido** — devuelve `false` si el
dominio no está ya en el conjunto exento que define el navegador. Hay que tratarlo como
diagnóstico. Lo que de verdad protege los datos en iOS es que la app esté **instalada**.

De ahí salen tres consecuencias que no son opcionales si LyraFit quiere prometer que no
pierde datos:

1. **El backup tiene que existir aunque el usuario no haga nada.** Snapshot automático al
   cerrar cada sesión, a OPFS (Safari 26+, Chrome 86+) con fallback a una tabla de
   respaldos con rotación de tres. *"Poner un botón Exportar en Ajustes y considerar
   resuelto el backup"* está en la lista de anti-patrones: nadie lo toca.
2. **Mostrar el estado real de persistencia en Ajustes**, y si es `false` en una pestaña de
   iOS, explicar en una línea que instalar la app lo arregla, con las instrucciones exactas.
3. **Salir de `usuario.github.io`.** La cuota, el desalojo y las exenciones son **por
   origen**: hoy los datos de LyraFit comparten destino con cualquier otro Pages de la misma
   cuenta.

**Notificaciones**, si se quieren: la única vía es Web Push declarativo con un servidor
mínimo. El payload para iOS tiene un formato exacto —`"web_push": 8030`, con `title` y
`navigate` obligatorios o el parser tira `SyntaxError`—. Es un JSON de 200 bytes por usuario
por día: entra holgado en el plan gratuito de cualquier plataforma serverless. Y se puede
hacer sin traicionar nada: el endpoint recibe `{endpoint, keys, horaLocal, díasDeSemana}` y
**cero datos de entrenamiento, cero identidad**.

**Lo que no hay que hacer:** migrar a SQLite WASM (wasm grande, worker obligatorio, dilema
COOP/COEP, a cambio de nada a esta escala), ni escribir un merge de sincronización a mano
sobre la cola de `pendientes` con última-escritura-gana — *"vas a perder series sin que
nadie se entere"*. Si algún día hay sync, va con un CRDT probado (Loro, Automerge, Yjs).
Y varias opciones que siguen apareciendo en las listas ya no lo son: Triplit (sin publicar
desde julio de 2025 y AGPL-3.0-only, que contamina todo lo que se construya encima),
Replicache (propietaria y reemplazada por Zero), cr-sqlite (congelada desde 2023), Jazz y
automerge-repo (en alfa declarada por sus propios autores).

### 6.10 Negocio: el pago único no es un compromiso, es la arquitectura

LyraFit no tiene servidor, así que **no tiene costo marginal por usuario**. Cobrar una
suscripción sería cobrar una renta por nada, y el usuario que elige una app local-first es
exactamente el que más lo va a notar.

La pieza técnica que lo hace posible sin cuentas y sin backend:

1. Un par de claves Ed25519 generado offline. La pública va embebida en el bundle; la
   privada nunca toca internet.
2. Checkout con un Stripe Payment Link — cero código de servidor, es una URL.
3. Se firma un payload chico `{id, emitidoEn}` y se le manda al comprador una cadena
   base64.
4. En Ajustes, un campo "pegá tu licencia". Se verifica con
   `crypto.subtle.verify('Ed25519', ...)`, con `@noble/ed25519` (~4 KB) como fallback.
5. Verificación **100% offline y para siempre**. Sin cuenta, sin mail guardado, sin llamada
   de red.

Son 60-80 líneas y una función pura `verificarLicencia(cadena): boolean` que encaja en
`src/dominio/` como cualquier otra.

**Qué cobrar:** ni el motor de progresión ni el registro. Cortarlos mata la propuesta y el
boca a boca. Temas, exportación avanzada, rutinas propias, y sobre todo **apoyo al
proyecto**, al estilo Obsidian.

Se comparte la licencia entre amigos: es inevitable y hay que aceptarlo como lo aceptó
Sublime Text. Perseguirlo cuesta más de lo que recupera.

El contexto regulatorio lo habilita: entre la DMA europea y *Epic v. Apple*, el *link-out* a
checkout web dejó de ser el campo minado que era. Con un contrapeso honesto: **la PWA en
iOS es políticamente frágil** —en 2024 Apple estuvo a punto de eliminar las web apps en la
UE—, así que conviene tener un plan B de empaquetado.

---

## 7. Hacia dónde va el mercado

Separando lo sólido de la moda, que es lo que se pidió.

### 7.1 Las cuatro corrientes sólidas

**La fuerza como medicina, no como estética.** La conversación pública y científica se
movió de *entrenar para verse bien* a *entrenar para no depender de nadie a los ochenta*.
Masa muscular, fuerza de prensión y VO2máx como predictores de mortalidad e independencia
funcional. Está anclada en demografía y en literatura acumulada, no en una moda de redes:
**es el viento de cola estructural de LyraFit y no se va a revertir.**

**Longevidad y healthspan como categoría de consumo.** Attia la llevó al mainstream con un
marco que es literalmente entrenamiento de fuerza y capacidad aeróbica. Lo sólido es la
demanda de *"entreno hoy para mi capacidad de mañana"*. Lo frágil, y hay que evitarlo, es
la **"edad biológica" como número**: los relojes epigenéticos tienen problemas serios de
fiabilidad test-retest.

**GLP-1 y la preservación de masa muscular.** Millones de personas bajando de peso rápido y
perdiendo músculo en el camino, con indicación clínica creciente de sumar entrenamiento de
resistencia y proteína.

> **Es la oportunidad de mercado más grande, más concreta y peor atendida que aparece en
> toda la investigación: un público que NECESITA entrenar fuerza, que NO va a ir a un
> gimnasio, y que tiene que empezar desde muy abajo.**
>
> Que es, exactamente, para lo que sirve una cadena de progresión que arranca en flexiones
> contra la pared.

**La privacidad como diferenciador**, con un matiz que hay que tomar en serio: **retiene y
convierte a quien ya llegó, pero no adquiere.** Casi nadie busca "app de fitness privada".
Es un cierre de venta excelente y un motor de adquisición malo. La adquisición tiene que
venir del producto.

### 7.2 La amenaza

**La convergencia en plataformas únicas y la consolidación por adquisición** —Strava
comprando Runna es el patrón—. Para una persona sola esto es una amenaza, no una
oportunidad: **no se puede competir por amplitud.** La respuesta correcta es profundidad
radical en una cosa, más interoperabilidad de **lectura**: importar, nunca depender.

### 7.3 Las modas que hay que dejar pasar

- **Corrección de técnica por cámara.** Años de trabajo, frágil en el mundo real, zona gris
  regulatoria.
- **"Coach de IA" genérico.** Rompe el local-first, agrega costo marginal, y el motor ya es
  el coach.
- **El feed social.** Sin masa crítica es una pantalla vacía.
- **Periodización por fase del ciclo menstrual.** La categoría de salud femenina es sólida y
  grande; *esta* mecánica específica es la de peor respaldo de todo el informe —las
  revisiones recientes la califican de evidencia baja y muy variable entre individuos—. Lo
  defendible y barato es contexto, no prescripción: registrar cómo se sintió la sesión y
  dejar que el motor autorregule con datos reales. Que es, otra vez, la compuerta afectiva.
- **Integración con seguros y sistemas de salud.** La dirección existe, pero es lenta,
  dependiente de jurisdicción y con un costo de cumplimiento inaccesible. No es una apuesta
  para esta década.

Y una advertencia sobre el propio posicionamiento: **el hartazgo de suscripciones es real,
pero es un nicho, no un cambio de mercado.** La categoría sigue dominada por la suscripción
y va a seguir estándolo en 2029. Elegí el pago único porque es coherente con no tener
servidor, no porque el mercado se esté moviendo hacia ahí.

---

## 8. El plan

Ordenado por retorno sobre esfuerzo, no por dificultad. Cada ola es enviable por separado:
si el trabajo se corta después de la ola 1, LyraFit ya es una app sustancialmente mejor.

### Posicionamiento

> **La app que sabe qué te toca hoy — y que no te miente sobre por qué.**
>
> Progresiones de calistenia con reglas explícitas y auditables, que se adaptan a cómo
> venís durmiendo, comiendo y sintiéndote. Sin cuenta, sin servidor, sin suscripción. Los
> datos son tuyos y no salen de tu teléfono.

Lo defendible no es "privada" —eso no adquiere— sino **"la progresión que decide por vos y
te muestra la regla"**. La privacidad es el cierre de venta, no el anzuelo.

### Ola 1 — Que la app funcione (0 a 6 semanas)

Nada de esto es una feature nueva. Es hacer que lo que ya existe cumpla lo que promete.

| # | Qué | Categoría | Esf. | Por qué |
|---|---|---|---|---|
| 1 | **Motor v2**: RRS continuo, señal EWMA sin resets, compuerta de dominio, incremento proporcional, recalibración de nivel por CCR | entrenamiento | L | Elimina el estado absorbente y el agotamiento en 5 semanas. Es *el* problema (§1.3) |
| 2 | **Bajar los topes declarados** a ≤15 reps / ≤30 s y agregar micro-escalones donde el salto de CCR supere el 20% | entrenamiento | M | Sin esto, la compuerta de dominio vuelve la progresión desesperantemente lenta |
| 3 | **Test de nivel al ingreso** (AMRAP de calibración, 4 pantallas) + revelación del plan con proyección honesta | hábito | M | El mercado lo señala como *la prioridad absoluta*. Ataca la fuga del día cero |
| 4 | **Test de simulación en la suite**: N sesiones, usuario con capacidad fija, asertando que nadie se queda >K sesiones en el mismo objetivo | entrenamiento | S | Es el test que faltaba. Corre en 300 ms y habría atrapado todo lo de §1 |
| 5 | **Borrar la racha diaria**; poner A28 + créditos de perdón + sesiones de tu vida | hábito | S | La evidencia y cinco dominios de mercado coinciden (§2.3, §6.3) |
| 6 | **Usar el campo `esfuerzo`**: un toque post-serie, que *protege el contador* y modula el objetivo. Nunca promueve ni vetea | entrenamiento | S | Cuatro agentes independientes lo llamaron el dato muerto más caro del proyecto |
| 7 | **Backup automático** a OPFS al cerrar sesión, rotación de 3 + estado real de persistencia en Ajustes | plataforma | S | "El backup que sirve es el que ocurre solo" |
| 8 | **"La última vez: 3×7"** al lado de cada objetivo, y **regla de subida visible** ("te falta 1 sesión") | entrenamiento | S | Dato que ya está en la base y no se muestra cuando sirve |
| 9 | **Sesión corta** de 6-8 min, siempre a un toque; cuenta para adherencia, no para progresión | hábito | S | Ataca a la vez la brecha intención-conducta y el afecto anticipado |
| 10 | **Sesión de vuelta** con volumen al 70% tras una ausencia | hábito | S | De las intervenciones más eficaces conocidas para asistencia |
| 11 | **Screen Wake Lock** + poder borrar una sesión mal cargada | plataforma | S | Dos huecos obvios; `borrarSesion` ya existe sin usar |
| 12 | **Test de copy prohibido** en CI (lista negra: BDNF, cortisol, detox, parasimpático, optimizar…) | plataforma | S | La forma más barata de no traicionarse en un momento de entusiasmo |

### Ola 2 — La capa que no tiene nadie (2 a 6 meses)

| # | Qué | Categoría | Esf. | Por qué |
|---|---|---|---|---|
| 13 | **Delta de vitalidad**: un ítem antes y después, media móvil de 10 sesiones | vitalidad | S | Cumple la única promesa honesta sobre la mente (§2.2) con datos propios |
| 14 | **Predicción de repeticiones → calibración interoceptiva** | vitalidad | S | El diferenciador competitivo real. No lo tiene nadie |
| 15 | **Las tres preguntas diarias** + índice con línea de base personal y las reglas anti-ruido | vitalidad | M | Su mayor valor es proteger el contador del motor, no mostrar un score |
| 16 | **Sueño**: diario de 3 campos, deuda sobre ventana de 14 días, una recomendación diaria | sueño | M | Mayor tamaño de efecto de toda la revisión, y cruzable con datos que ya existen |
| 17 | **Alimentación**: los 7 hábitos, cero calorías, en dos tablas nuevas de Dexie | alimentación | M | La versión honesta. Contar calorías sería un MyFitnessPal mediocre |
| 18 | **Serie de cierre** (pico-final) + ritual de respiración opcional de 45 s | vitalidad | S | Probablemente el mayor retorno por línea de código del documento |
| 19 | **Resumen semanal como narrativa** + tarjeta PNG compartible por Web Share | hábito | M | Todo el beneficio del "Wrapped" sin una línea de backend |
| 20 | **Detección de meseta** con tres salidas concretas, y **detección de señales de alarma** | entrenamiento | M | La meseta es el momento exacto de abandono; RED-S es el riesgo del segmento |
| 21 | **Índice de carga continuo (CCR)** y el gráfico de progreso que no se corta al cambiar de nivel | entrenamiento | M | Resuelve el problema que la propia *Recommended Routine* sufre |
| 22 | **Dominio propio** y salir de `usuario.github.io` | plataforma | S | La cuota y el desalojo son por origen. No es opcional si se promete no perder datos |

### Ola 3 — Apuestas (6 meses en adelante)

| # | Qué | Categoría | Esf. | Nota |
|---|---|---|---|---|
| 23 | **Web Push declarativo** con servidor mínimo (200 bytes/usuario/día, cero datos de entrenamiento) | plataforma | M | La única vía real. Solo tras un gesto y en modo instalado |
| 24 | **Pago único con licencia Ed25519 offline** | negocio | M | Coherente con la arquitectura. No cortar nunca el motor ni el registro |
| 25 | **Cadenas nuevas** (verticales, fondos) y **experimento N-of-1 aleatorizado** | entrenamiento / vitalidad | L | El N-of-1 requiere consentimiento explícito y tope duro de carga |
| 26 | **Preservación de masa muscular** como recorrido explícito para usuarios de GLP-1 | negocio | M | La oportunidad más grande y peor atendida del mercado (§7.1) |

### Los primeros 30 días

Un plan que se puede empezar mañana a la mañana:

1. **Días 1-2.** Escribir el test de simulación (ola 1, #4) contra el motor **actual**.
   Debe fallar. Ese test es el contrato del motor v2.
2. **Días 3-8.** Motor v2 (#1): RRS, señal EWMA, compuerta de dominio, incremento
   proporcional. El test de #4 pasa a verde. Los 44 tests existentes que cambien de
   comportamiento se reescriben a propósito, uno por uno.
3. **Días 9-12.** Retunear la biblioteca (#2): topes a ≤15/≤30, CCR por ejercicio,
   micro-escalones donde el salto supere el 20%. Volver a correr la simulación y mirar la
   trayectoria de un principiante a 6 meses. Debe ser creíble.
4. **Días 13-18.** Test de nivel + revelación del plan (#3). Es la primera cosa que un
   usuario nuevo va a ver, y hoy no existe.
5. **Días 19-22.** Borrar la racha, poner A28 + créditos + sesiones de tu vida (#5).
   Un toque de esfuerzo post-serie (#6).
6. **Días 23-26.** Backup automático y estado de persistencia (#7). Wake Lock y borrar
   sesión (#11).
7. **Días 27-30.** "La última vez" y regla de subida visible (#8). Sesión corta (#9) y
   sesión de vuelta (#10). Test de copy prohibido (#12).

Al día 30, LyraFit tiene un motor que no se cuelga, contenido que dura más de un año, un
usuario nuevo que empieza donde corresponde, y datos que no se pierden.

---

## 9. Lo que no hay que construir

Tan importante como la lista de arriba, y más barato de respetar que de descubrir.

**Producto**
- Racha de días consecutivos. Y jamás una racha sobre prácticas contemplativas.
- Feed social. Sin masa crítica es una pantalla vacía.
- Conteo de calorías.
- Peso corporal en la v1 (y si entra, con todas las restricciones de §5.5 o ninguna).
- Frases motivacionales: son la fuente más débil de autoeficacia y ocupan el lugar de un
  dato sobre el desempeño propio.
- Pantalla de "¿qué te impide entrenar?": la identificación de barreras se asoció a **menor**
  autoeficacia.
- Programas cerrados de 12 semanas.
- PHQ-9, GAD-7 o cualquier instrumento de tamizaje clínico.

**Técnica**
- ACWR. Está demolido metodológicamente.
- Visión por computadora para contar repeticiones o corregir técnica. `erroresComunes[]` ya
  resuelve el 80% por el 0,1% del costo.
- LLM en la nube como coach. El motor ya es el coach y ya explica sus decisiones.
- HRV sin sensor, incluida la fotopletismografía por cámara.
- Migrar a SQLite WASM.
- Merge de sincronización a mano sobre `pendientes` con última-escritura-gana.
- `setTimeout` o alarmas en el service worker para recordatorios: no existen timers
  persistentes en la web.
- Depender de Background Sync o Periodic Background Sync: son solo Chromium.
- Triplit, Replicache, cr-sqlite, Jazz, automerge-repo: abandonados, propietarios, o en alfa
  declarada.

**Salud y ética**
- Wim Hof o cualquier hiperventilación autoadministrada.
- Inmersión en frío como recomendación post-entrenamiento: atenúa la hipertrofia.
- Cualquier promesa cognitiva: memoria, foco, neuroplasticidad, BDNF, "claridad mental"
  como efecto sostenido.
- Periodización por fase del ciclo menstrual como prescripción.
- Suplementos más allá de creatina.
- Correlacionar entrenamiento y ánimo presentándolo como causa: la causalidad más probable
  va al revés (uno entrena los días que ya está bien).
- Mostrar cualquier correlación personal con menos de 30 observaciones. Con n=20 la
  correlación mínima detectable es r=0,44: por debajo de eso es ruido con estética de señal.

---

## 10. Los principios que no habría que traicionar

1. **La regla se muestra.** Si el motor decide algo, dice por qué en una frase. Es lo que
   ya hace y es el activo más valioso del producto.
2. **Los datos no salen del teléfono.** Si algo tiene que salir —push, licencia— sale sin
   datos de entrenamiento y sin identidad.
3. **El silencio es una respuesta válida.** El ~68% de los días no debe pasar nada.
4. **Nunca castigar.** Ni por faltar, ni por un mal día, ni por romper nada. Bonificar el
   regreso, no penalizar la ausencia.
5. **No afirmar lo que no se puede medir o citar.** Verificable como test.
6. **El dominio se mantiene puro.** Todo lo de este documento —RRS, índices, cronotipo,
   licencia— es una función pura más en `src/dominio/`, testeable en milisegundos. Esa
   disciplina es la razón por la que este plan es viable para una sola persona.

---

## Nota sobre el método

Este documento salió de 16 investigaciones en paralelo (10 de mercado sobre 106 productos,
6 de literatura científica), 654 búsquedas web y ~1,5 millones de tokens de análisis, más la
lectura completa del código con simulaciones ejecutadas sobre el motor real.

Los hallazgos de la sección 1 no son lecturas del código: son resultados de correr el motor.
La sección 2 marca explícitamente la solidez de cada afirmación, y varias creencias muy
difundidas quedaron descartadas por no resistir la verificación.

Donde las fuentes se contradijeron —el rol del RPE en el motor— la contradicción está
expuesta en §6.6 en vez de resuelta por decreto.
