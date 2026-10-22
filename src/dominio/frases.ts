/**
 * La voz de Lyra.
 *
 * ## La objeción, y por qué esto igual entra
 *
 * `docs/estrategia-2026.md` §9 dice, con todas las letras, que no hay que
 * construir frases motivacionales: son la fuente más débil de autoeficacia
 * según Bandura y **ocupan el lugar que debería tener un dato sobre el
 * desempeño propio.** Eso sigue siendo cierto y no se borra porque ahora haya
 * una mascota.
 *
 * Lo que la evidencia castiga es un tipo puntual de frase: la que promete un
 * resultado, la que elogia a la persona en vez de a lo que hizo, y la que
 * aparece **en lugar** de un dato. Nada de eso es obligatorio. Así que este
 * banco se escribió con cuatro reglas duras, y hay un test para cada una:
 *
 * 1. **Nunca promete un resultado.** Ni "vas a lograrlo", ni "en un mes estás
 *    haciendo dominadas". El motor es el único que proyecta acá, y proyecta con
 *    una cuenta.
 * 2. **Habla de lo que hiciste, no de lo que sos.** "Apareciste" y no "sos
 *    constante". La conducta es controlable; la identidad, cuando falla, se
 *    lleva puesta a la persona.
 * 3. **Nunca culpa, avergüenza ni mete urgencia.** Ni "no aflojes", ni "no
 *    pierdas la racha" —que además no existe en esta app—, ni comparaciones.
 * 4. **Nunca ocupa el lugar de un dato.** Lyra habla en los huecos: al abrir el
 *    día y al cerrar la sesión, al lado de lo que el motor decidió, nunca
 *    encima. Si hay un número que decir, lo dice el motor.
 *
 * La regla que hereda de Grow Cosmos y que vale más que las cuatro: **el buen
 * PNL es invisible.** No se nombra el mecanismo, no se explica que esto es
 * motivación, no se firma. Es una línea corta y se va.
 *
 * ## Lo que se coló igual, y ahora tiene test
 *
 * La revisión del 20 de octubre de 2026 encontró 46 frases en uso que
 * rompían el espíritu de las cuatro sin tocar las palabras que los tests
 * buscaban: "cuando el cuerpo dice basta y seguís un poco más" en el cierre de
 * un salto de eslabón, "no tenés que tener ganas, tenés que empezar", "un mes
 * de esto se nota", "dormiste mal" dicho sin haber leído el sueño, y nueve en
 * masculino. Se corrigieron o se borraron, y ahora hay un test por familia:
 * obligar o retar, empujar más allá del límite, prometer (también en futuro
 * corto), inventar una cifra escrita con letras, comparar con otra gente,
 * afirmar una causa que nadie midió y el género por defecto. Lyra le habla a
 * cualquiera: "con calma", no "tranquilo" ni "tranquila". La regla 2 decía
 * tener test y no lo tenía —por eso entró "Ya sos alguien que entrena"—: ahora
 * sí, contra los rótulos de persona.
 *
 * Y una frase que solo es cierta con historia —"acá estás otra vez", "es que
 * volviste"— lleva su condición en `DESDE_SESIONES`, para que no salga el
 * primer día.
 *
 * ## Por qué no hay `Math.random()` acá
 *
 * Todo `src/dominio/` son funciones puras y se verifican con tests que corren
 * en milisegundos. Una fuente de azar adentro rompería eso: el mismo estado
 * daría distintas frases y no habría forma de atar nada. El azar entra por
 * parámetro, como en el original, y lo aporta la pantalla.
 */

/**
 * En qué momento habla Lyra.
 *
 * No son "tonos" sino situaciones, y la diferencia importa: una frase de ánimo
 * suelta se puede decir en cualquier lado y por eso no dice nada. Estas saben
 * dónde están paradas.
 */
export type Momento =
  | 'abrir'
  | 'esfuerzo'
  | 'reencuadre'
  | 'constancia'
  | 'cierre'
  | 'descanso'
  | 'vuelta'
  | 'techo'
  | 'duda'
  | 'cuerpo'
  | 'largo'
  // Los tres de adentro de la sesión, que son los únicos que Lyra dice con la
  // persona en movimiento. Van en el DESCANSO, nunca durante la serie: lo que
  // aumenta las repeticiones es el aliento verbal, y eso funciona como voz, no
  // como algo que compita por la mirada mientras se lee un número.
  | 'aliento'
  | 'ultima'
  | 'final'

/**
 * El momento de Hoy, el de la pantalla de todos los días.
 *
 * Entrenar hoy va antes que todo. Antes que volver: el día de la vuelta,
 * `vuelve` sigue en true después de la sesión —cuenta desde antes de hoy, para
 * que el motor la lea como vuelta—, y "tomátelo con calma esta primera" ya no
 * sería cierto. Y antes que descansar: quien entrenó un día de descanso no
 * puede leer "hoy toca no entrenar". Lo mismo ordenan el rótulo del Plan y el
 * del día.
 */
export function momentoDeHoy({
  esDiaDeEntrenar,
  entrenoHoy,
  vuelve,
}: {
  esDiaDeEntrenar: boolean
  entrenoHoy: boolean
  vuelve: boolean
}): Momento {
  if (entrenoHoy) return 'constancia'
  if (!esDiaDeEntrenar) return 'descanso'
  return vuelve ? 'vuelta' : 'abrir'
}

/** La cara con la que lo dice. Son las mismas expresiones que tiene el dibujo. */
export type Expresion = 'calma' | 'contenta' | 'festejo' | 'guino' | 'orgullosa' | 'piensa' | 'dormida'

export interface Grupo {
  momento: Momento
  expresion: Expresion
  lineas: string[]
}

/** Lo más larga que puede ser una frase. Más que esto no se lee de reojo. */
export const LARGO_MAXIMO = 96

export const FRASES: Grupo[] = [
  {
    momento: 'abrir',
    expresion: 'contenta',
    lineas: [
      'Abriste la app. Eso ya es parte del entrenamiento.',
      'Acá estás otra vez. Vamos de a una serie.',
      'El plan ya está armado. Vos ponés el cuerpo.',
      'Hoy no hace falta que sea épico. Solo que pase.',
      'Empezar es lo más caro. Después es de a una serie.',
      'Nadie entra en forma en una sesión. Se entra en todas.',
      'Buen momento para hacer algo que mañana agradezcas.',
      'La sesión más útil es la que hacés, no la perfecta.',
      'Estás a un toque de que hoy cuente.',
      'Lo tenés medido y escrito. Solo falta moverse.',
      'Un rato tuyo. Después el día sigue.',
      'Vení, que esto es más corto de lo que parece.',
      'Ponete la ropa. El resto se acomoda solo.',
      'No hace falta tener ganas. Alcanza con empezar.',
      'Cada vez que abrís esto, algo se está sosteniendo.',
      'El cuerpo arranca frío siempre. Es normal.',
      'Lo de hoy es lo de la lista. Ni una cosa más.',
      'Vamos despacio, que tenemos tiempo.',
      'Lo que hagas hoy queda escrito para cuando quieras mirarlo.',
      'Dale que arrancamos.',
      'Un poco de ruido, un poco de aire, y a laburar.',
      'Lo difícil ya pasó: estás acá.',
      'No vinimos a impresionar a nadie.',
      'Primera serie y después vemos.',
      'La constancia no se siente. Se acumula.',
      'Poné el teléfono en el piso. Empezamos.',
      'Hoy es uno de esos días que después no te acordás. Igual cuenta.',
      'Diez minutos de esto valen más que una hora de planearlo.',
    ],
  },
  {
    momento: 'esfuerzo',
    expresion: 'orgullosa',
    lineas: [
      'Eso costó, y lo hiciste igual.',
      'La serie fea también suma.',
      'Terminaste una que tenías ganas de saltear.',
      'Nadie te vio hacer eso. Yo sí.',
      'Apretaste los dientes. Se notó.',
      'No fue linda, pero fue.',
      'Eso que acabás de hacer no se improvisa.',
      'Buen laburo. En serio.',
      'Te la bancaste entera.',
      'Insistir cuando cuesta es la parte difícil. La hiciste.',
      'Le pusiste. Se ve.',
      'Eso fue trabajo del bueno.',
      'Lo de hoy movió la cadena un paso.',
      'Ahí está. Eso era.',
      'Cambiaste de eslabón. Se ganó sesión a sesión.',
      'Hoy se abrió un eslabón nuevo. Lo abriste vos.',
      'Esa serie ya quedó anotada para siempre.',
      'Hiciste la parte incómoda. Es la que paga.',
      'No aflojaste a la mitad.',
      'El esfuerzo de hoy no se ve hoy.',
      'Bien ahí. Descansá que sigue.',
      'Eso fue elegir lo incómodo. Bien.',
      'Esa la sacaste de algún lado.',
    ],
  },
  {
    momento: 'reencuadre',
    expresion: 'calma',
    lineas: [
      'No pudiste hoy. Hoy, nada más.',
      'Un mal día es del día, no tuyo.',
      'Un día flojo no dice cuánta fuerza tenés.',
      'Quedar corto una vez es información, no un veredicto.',
      'El cuerpo tiene días. El plan lo contempla.',
      'Esto no es un techo, es una curva.',
      'El intento no salió. Eso no habla de vos.',
      'Bajar el objetivo no es retroceder. Es medir bien.',
      'El motor ajustó el objetivo. Es un ajuste, no un castigo.',
      'Nadie sube todas las semanas. Nadie.',
      'Una sesión floja no borra las que ya hiciste.',
      'Ojo con leer un número malo como una sentencia.',
      'Lo que pasó hoy no dice nada de mañana.',
      'Un día flojo no es un estancamiento.',
      'El motor ya lo tuvo en cuenta. Con calma.',
      'Menos repeticiones no es menos vos.',
      'Es un dato, no un juicio.',
      'A veces el progreso se parece a quedarse quieto.',
      'Bajaste hoy y eso también es entrenar.',
      'No hace falta explicar nada. Pasa.',
      'La semana que viene es otra semana.',
      'Preferible una sesión corta que una historia que te contás.',
      'Si te dolió algo, hiciste bien en parar.',
      'Cortar a tiempo también es criterio.',
      'Hoy salió lo que salió, y quedó anotado.',
      'Estuviste. Alcanza.',
      'Volvé mañana sin bronca.',
    ],
  },
  {
    momento: 'constancia',
    expresion: 'contenta',
    lineas: [
      'Otra más en la cuenta.',
      'Ese número solo sube.',
      'Apareciste de nuevo. Es lo único que hace falta.',
      'Las sesiones se suman aunque no lo sientas.',
      'Esto ya dejó de ser un intento.',
      'Llevás más de las que creías.',
      'No es motivación: es que volviste.',
      'Estás construyendo algo lento y difícil de romper.',
      'Lo que hacés seguido pesa más que lo que hacés fuerte.',
      'Cada sesión que entra ya no se va.',
      'Mirá el historial cuando dudes.',
      'Faltar una vez no rompe nada. Volver lo arregla todo.',
      'Esto no se trata de no fallar. Se trata de volver.',
      'La suma no tiene apuro.',
      'Nadie sostiene esto por ganas. Lo sostenés por costumbre.',
      'Sumaste otra sin hacer ruido.',
      'Semana tras semana, ahí seguís.',
      'Poco y siempre le gana a mucho y a veces.',
      'Otra vuelta al sol para el cuerpo.',
      'Se te está haciendo normal. Eso es lo bueno.',
      'Esto queda anotado para cuando quieras mirar atrás.',
      'Hoy pusiste otro ladrillo.',
      'No pasó nada especial. Por eso funciona.',
      'Lo aburrido es lo que rinde.',
      'Un rato tuyo que ya quedó hecho.',
    ],
  },
  {
    momento: 'cierre',
    expresion: 'festejo',
    lineas: [
      'Listo. Eso ya es tuyo.',
      'Se terminó. Andá a comer algo.',
      'Bien. Ahora dejá que el cuerpo haga lo suyo.',
      'Sesión cerrada. Nadie te la saca.',
      'Ahí quedó anotado para siempre.',
      'Terminaste lo que empezaste.',
      'Eso estuvo bien hecho.',
      'Andá con calma, ya hiciste la parte difícil.',
      'Guardá cómo te sentís ahora.',
      'Buen laburo de hoy.',
      'Ya está. Respirá.',
      'Se siente distinto después, ¿no?',
      'Eso no se puede comprar ni pedir prestado.',
      'Una sesión más en la columna que importa.',
      'Bien jugado.',
      'Lo hiciste. Punto.',
      'Cerrá el teléfono y disfrutá el resto.',
      'Estiramiento, agua, y listo.',
      'Hoy el cuerpo trabajó de verdad.',
      'Esto es lo que después se llama estar en forma.',
      'Bien. Nos vemos la próxima.',
      'Descansar ahora es parte del trabajo.',
      'Llegaste al final. Buena señal.',
      'Nada mal para un día cualquiera.',
      'Andá a hacer otra cosa, que ya está.',
      'Sesión hecha. Cabeza libre.',
      'Eso fue tiempo bien gastado.',
      'Ya podés olvidarte hasta la próxima.',
    ],
  },
  {
    momento: 'descanso',
    expresion: 'dormida',
    lineas: [
      'Hoy toca no entrenar. En serio.',
      'Descansar no es una pausa del plan. Es el plan.',
      'Tomate el día. Está previsto.',
      'No hace falta entrenar todos los días para avanzar.',
      'Nada que hacer hoy. Disfrutalo.',
      'Se descansa para poder volver a apretar.',
      'Dejá que el cuerpo termine lo que empezaste.',
      'Un día libre no te atrasa.',
      'Caminá si querés moverte. Nada más.',
      'El progreso pasa mientras dormís.',
      'Guardá las ganas para el próximo día.',
      'No hay nada que compensar.',
      'Descansar cuesta más que entrenar, a veces.',
      'Este también es un día del plan.',
      'Tranqui. No estás perdiendo nada.',
      'Aprovechá y estirá un poco, si querés.',
      'Hoy no hace falta hacer nada.',
      'La recuperación es la mitad invisible.',
      'Si te sentís con energía, mejor: es que descansaste.',
      'Nos vemos en el próximo.',
      'Agua, comida y sueño. Eso es hoy.',
      'Un día quieto también es entrenar.',
    ],
  },
  {
    momento: 'vuelta',
    expresion: 'calma',
    lineas: [
      'Volviste. Eso es todo lo que importa.',
      'Cuánto tiempo pasó no cambia nada. Estás acá.',
      'Arrancamos más liviano y listo.',
      'No hay que recuperar nada. Se sigue desde acá.',
      'Nadie lleva la cuenta de los días que faltaste.',
      'Volver es más difícil que seguir. Y lo hiciste.',
      'El cuerpo se acuerda más rápido de lo que creés.',
      'Hoy bajamos un poco la vara. Es a propósito.',
      'Ningún plan sobrevive a la vida. Se retoma y ya.',
      'Perfecto. Sin culpa y sin apuro.',
      'Esto no se reinicia desde cero.',
      'Lo que construiste sigue ahí abajo.',
      'El tiempo afuera no borra lo que hiciste antes.',
      'La vuelta siempre se siente peor de lo que es.',
      'Tomátelo con calma esta primera.',
      'Hoy no hay nada que exigir. Solo retomar.',
      'Qué bueno verte de nuevo.',
      'Lo importante no es no faltar. Es volver.',
      'Vamos de a poco que el cuerpo avisa.',
      'Hoy alcanza con hacer acto de presencia.',
      'Nadie vuelve en su mejor forma. Se vuelve y ya.',
      'Retomar es una habilidad. La estás usando.',
      'Faltar estaba previsto. Volver también.',
      'Esta sesión cuenta aunque no lo parezca.',
      'Retomamos, sin drama.',
      'Ya está, ya volviste. Lo demás es cuesta abajo.',
    ],
  },
  {
    momento: 'techo',
    expresion: 'piensa',
    lineas: [
      'Estás cerca del techo de este ejercicio.',
      'Una más de estas y cambia el juego.',
      'El eslabón siguiente está a la vuelta.',
      'Se te está poniendo fácil. Buena señal.',
      'Esto ya casi no te cuesta.',
      'El salto que viene va a doler un poco. Es normal.',
      'Cuando cambies de ejercicio vas a hacer menos. No te asustes.',
      'Menos repeticiones en algo más difícil es progreso.',
      'Falta poco para que esto quede atrás.',
      'Ya dominaste este. Se nota en los números.',
      'El techo no es el final: es la puerta.',
      'Guardá esta sensación de que te sale fácil.',
      'Acordate de cuando esto era imposible.',
      'Estás arriba del rango. Eso es lo que buscábamos.',
      'Esto ya lo tenés. Vamos por lo que sigue.',
      'Sin apuro: el salto se gana consolidando.',
      'Una o dos sesiones más así y cambiás.',
      'Buen momento para revisar la técnica antes de subir.',
      'Cuando subas, el número baja. El nivel sube.',
      'Casi. Falta muy poco.',
      'El cambio de eslabón se siente como retroceder. No lo es.',
      'Te queda un escalón de este tramo.',
    ],
  },
  {
    momento: 'duda',
    expresion: 'guino',
    lineas: [
      'Probá una serie. Si está mal, paramos.',
      'No tenés que decidir la sesión entera. Solo la primera.',
      'Las ganas vienen después de empezar, no antes.',
      'Si no podés con todo, hacé la mitad.',
      'Siete minutos también cuentan.',
      'Hacé lo mínimo. Lo mínimo alcanza.',
      'Nadie tiene ganas a las siete de la tarde.',
      'Empezá mal, terminá igual.',
      'Una serie floja es infinitamente mejor que ninguna.',
      'Negociá con vos: solo el primer ejercicio.',
      'Si en diez minutos seguís sin querer, cortá.',
      'No busques motivación. Buscá las zapatillas.',
      'Bajemos el objetivo y listo, pero hagamos algo.',
      'No pienses en las tres series. Pensá en esta.',
      'Hoy no busquemos récords. Busquemos presencia.',
      'Entrar es lo difícil, salir es fácil.',
      'Si te sale, seguimos. Si no, cortamos sin culpa.',
      'Lo peor que puede pasar es que hagas poco.',
      'Dale, una y vemos.',
      'No hace falta que salga bien.',
      'Empezá con lo más fácil del plan.',
    ],
  },
  {
    momento: 'cuerpo',
    expresion: 'calma',
    lineas: [
      'Esto no es por cómo te ves. Es por lo que podés.',
      'Fuerza es poder levantarte del piso a los ochenta.',
      'Entrenás hoy para tu autonomía de mañana.',
      'Si te duele una articulación, no es esfuerzo. Es aviso.',
      'La técnica primero. Siempre.',
      'Más repeticiones con mala forma no es más entrenamiento.',
      'El cuerpo aprende el movimiento antes que la fuerza.',
      'Respirá. Media sesión se arregla respirando.',
      'Si no podés hablar, bajá un cambio.',
      'No hay que terminar destruido para que sirva.',
      'El dolor muscular no mide nada.',
      'Que no te duela no significa que no sirvió.',
      'Tomá agua.',
      'El calentamiento no es tiempo perdido.',
      'Si algo se siente mal, se para. No se negocia.',
      'La fuerza que ganás acá se nota afuera.',
      'Escaleras, valijas, mudanzas. Para eso también es.',
      'El cuerpo responde a lo que le pedís seguido.',
      'No compares tu día uno con el día cien de nadie.',
      'Hoy tu trabajo es moverte bien, no moverte mucho.',
      'La postura de todos los días también se entrena acá.',
      'Estirar no hace magia, pero se siente bien.',
      'Cuidá los hombros: son los primeros en quejarse.',
    ],
  },
  {
    momento: 'largo',
    expresion: 'piensa',
    lineas: [
      'Esto es un juego largo. Muy largo.',
      'Nadie se puso fuerte en poco tiempo.',
      'La paciencia acá no es virtud: es el método.',
      'Despacio también es avanzar.',
      'Las progresiones no se saltean. Se caminan.',
      'Vas a olvidarte de cuándo empezaste.',
      'El progreso no es una línea. Es un garabato que sube.',
      'Medir cada semana no sirve. Mirá los meses.',
      'El apuro es el único enemigo real acá.',
      'Vas a estancarte varias veces. Es parte.',
      'Lo lento también llega.',
      'No hay atajos que no se paguen después.',
      'El objetivo no es esta sesión. Es la número doscientos.',
      'Cada sesión anotada es el punto de partida de la próxima.',
      'Nadie ve el progreso desde adentro. Por eso se mide.',
      'Cada eslabón tiene su tiempo y no se negocia.',
      'Las cadenas terminan en ejercicios que hoy parecen de otro planeta.',
      'La versión tuya del año que viene empieza hoy.',
      'Esto no tiene línea de llegada, y está bien.',
      'Lo que importa no es cuánto podés. Es cuánto tiempo seguís.',
    ],
  },
  {
    momento: 'aliento',
    expresion: 'orgullosa',
    lineas: [
      'Vas bien. Respirá hondo y seguimos.',
      'Esa ya está. Vamos con la que sigue.',
      'Buen ritmo. No lo apures.',
      'Acomodate, tomá aire y volvé.',
      'Vamos bien. Falta menos de lo que parece.',
      'Aprovechá el descanso entero. Es parte.',
      'Te sale. Seguí igual.',
      'Una menos. Así se hace.',
      'Sacudí los brazos y volvé a entrar.',
      'Todo lo que anotaste ya es tuyo.',
      'La que viene sale igual que la anterior.',
      'Estás en el medio, que es donde cuesta. Normal.',
      'Bajá las pulsaciones y arrancamos.',
      'Vas mejor de lo que creés.',
      'Cuidá la técnica. Del número se ocupa el motor.',
      'No hace falta que sea rápido.',
      'Otra más y esto empieza a terminarse.',
      'Respirá. El descanso es para eso.',
      'Vos podés con la que sigue.',
      'Buen laburo hasta acá.',
      'Estás haciendo justo lo que había que hacer.',
      'Mantené la forma y listo.',
      'Cuando vuelvas, empezá con calma.',
      'El cuerpo ya entró en calor. Ahora rinde.',
      'Falta poco para el próximo ejercicio.',
      'Soltá los brazos y aprovechá el aire.',
    ],
  },
  {
    momento: 'ultima',
    expresion: 'guino',
    lineas: [
      'Queda una. El número lo pone el motor; vos ponés la forma.',
      'La última. Con buena forma, y después descansás.',
      'Una sola más y este ejercicio está.',
      'Ya casi. Queda la última.',
      'Última de este ejercicio. Si la forma se rompe, ahí cortás.',
      'Última: la técnica primero, el número después.',
      'La que viene cierra el ejercicio.',
      'Una y listo. Vos podés.',
      'Última serie. Después no hay más de esto.',
      'La de cierre. Metele.',
      'Ya está prácticamente hecho. Falta una.',
      'Esta última vale doble en la cabeza.',
      'Una más y pasamos a otra cosa.',
      'Guardá algo para esta. Es la última.',
      'Última. Respirá y entrá.',
      'Lo difícil ya pasó. Queda una.',
      'Cerrá este ejercicio como empezaste.',
      'La última es la que te vas a acordar.',
      'Una sola. Y bien hecha.',
      'Último esfuerzo de este ejercicio.',
      'Ya la tenés. Es la última.',
      'Esta cierra. Después aflojás.',
      'Falta poco: una serie.',
      'La última. Si no sale entera, también cuenta.',
      'Una más y cambiamos de patrón.',
      'Terminala como si fuera la primera.',
    ],
  },
  {
    momento: 'final',
    expresion: 'festejo',
    lineas: [
      'Último ejercicio. Esto ya está terminando.',
      'Último ejercicio. Sin apuro.',
      'Ya casi. Este es el último.',
      'Estás en el final de la sesión.',
      'Última cadena del día.',
      'Esto es lo último que te pido hoy.',
      'Falta poco y te vas.',
      'El final. Terminalo bien y listo.',
      'Ya hiciste casi todo. Queda esto.',
      'Último tramo. Vos podés.',
      'Después de esto, se acabó por hoy.',
      'La sesión ya está ganada. Cerrala.',
      'Este es el que te deja la sesión completa.',
      'Un ejercicio y a otra cosa.',
      'Último. Y después la fácil del final.',
      'Ya está casi entera. Terminala.',
      'Lo más difícil quedó atrás.',
      'Esto es la cola de la sesión.',
      'Este es el último. Terminá con resto.',
      'Último ejercicio: acá se cierra.',
      'Casi. Ya casi.',
      'Estás a un ejercicio de terminar.',
      'Lo que falta se hace solo.',
      'Final de sesión. Bien ahí.',
      'Último ejercicio: la técnica primero.',
      'Ya te la ganaste. Cerrá.',
    ],
  },
]

/** Todas las frases, sin agrupar. Para contar y para verificar. */
export const TODAS: string[] = FRASES.flatMap((g) => g.lineas)

/**
 * Cuántas frases tiene el banco.
 *
 * Está escrito a mano y no calculado, igual que la lista de dibujos pendientes:
 * así el test falla si alguien saca o agrega una sin querer, en vez de
 * adaptarse en silencio a lo que haya.
 */
export const CUANTAS = 343

/**
 * Las frases que solo son ciertas a partir de cierta cantidad de sesiones.
 *
 * Sin esto, "Acá estás otra vez" salía el primer día y "Una sesión más en la
 * columna que importa" en la sesión 001 —quedó en una captura—: Lyra
 * desmentía el número que la pantalla tiene arriba, que es lo peor que le
 * puede pasar a la regla 4. La condición va acá y no adentro de cada frase
 * para que el banco siga siendo una lista que se lee de corrido.
 *
 * El número es el de sesiones de la persona cuando se muestra la frase: en
 * Hoy, las que ya hizo; en el cierre, contando la que acaba de cerrar. La
 * constancia sale en Hoy recién después de entrenar, así que su piso es una
 * sesión, y con una sola no hay "otra" ni "volviste": lo que nombra una sesión
 * anterior pide dos. Lo que habla de costumbre pide diez, el mismo número que
 * "llevás más de las que creías".
 */
export const DESDE_SESIONES: ReadonlyMap<string, number> = new Map([
  ['Acá estás otra vez. Vamos de a una serie.', 1],
  ['Dejá que el cuerpo termine lo que empezaste.', 1],
  ['Otra más en la cuenta.', 2],
  ['Apareciste de nuevo. Es lo único que hace falta.', 2],
  ['No es motivación: es que volviste.', 2],
  ['Sumaste otra sin hacer ruido.', 2],
  ['Otra vuelta al sol para el cuerpo.', 2],
  ['Hoy pusiste otro ladrillo.', 2],
  ['Una sesión más en la columna que importa.', 2],
  ['Una sesión floja no borra las que ya hiciste.', 3],
  ['Llevás más de las que creías.', 10],
  ['Esto ya dejó de ser un intento.', 10],
  ['Nadie sostiene esto por ganas. Lo sostenés por costumbre.', 10],
  ['Semana tras semana, ahí seguís.', 10],
  ['Se te está haciendo normal. Eso es lo bueno.', 10],
])

/**
 * Las frases que hablan de seguir sin cortar. Solo son ciertas si la persona
 * viene entrenando sin cortar (`vieneSinCortar`), lleve las sesiones que
 * lleve: el día de la vuelta después de semanas sin entrenar no lo son, y
 * tampoco el día siguiente, que ya no cuenta como vuelta. `fraseDe` las saca.
 */
export const PIDEN_CONTINUIDAD: ReadonlySet<string> = new Set([
  'Nadie sostiene esto por ganas. Lo sostenés por costumbre.',
  'Semana tras semana, ahí seguís.',
  'Se te está haciendo normal. Eso es lo bueno.',
])

/**
 * Las frases de descanso que dan por hecho que la persona entrenó hace poco:
 * "lo que empezaste" es la sesión de ayer o de anteayer, no una de hace un
 * mes (`entrenoHacePoco`).
 */
export const PIDEN_ENTRENO_RECIENTE: ReadonlySet<string> = new Set([
  'Dejá que el cuerpo termine lo que empezaste.',
])

/**
 * Lo que la pantalla sabe de la persona y decide qué frases son ciertas.
 *
 * Todo es opcional y lo que falta se toma por lo más prudente: una pantalla
 * que se olvide de pasar algo se pierde algunas frases, pero no dice ninguna
 * falsa.
 */
export interface Situacion {
  /** Cuántas sesiones lleva (ver `DESDE_SESIONES`). Por defecto, cero. */
  sesiones?: number
  /** Si viene entrenando sin cortar (`PIDEN_CONTINUIDAD`). Por defecto, no. */
  sinCortar?: boolean
  /** Si entrenó en los últimos días (`PIDEN_ENTRENO_RECIENTE`). Por defecto, no. */
  entrenoReciente?: boolean
}

const POR_MOMENTO = new Map(FRASES.map((g) => [g.momento, g]))

/**
 * Una frase para este momento.
 *
 * `azar` es un número entre 0 y 1 que trae la pantalla: acá adentro no puede
 * haber `Math.random()` sin volver el dominio imposible de testear, y el
 * original de Grow Cosmos resuelve lo mismo pasando el azar por parámetro.
 *
 * `dichas` es el buffer anti-repetición: las últimas frases que ya se
 * mostraron. Sin él, con doscientas aperturas de la app la misma frase cae dos
 * veces seguidas más seguido de lo que la intuición dice, y una frase repetida
 * deja de ser una voz y pasa a ser un cartel.
 *
 * `situacion` es lo que se sabe de la persona, y saca las frases que no
 * serían ciertas para ella (ver `Situacion`).
 */
export function fraseDe(
  momento: Momento,
  azar: number,
  dichas: readonly string[] = [],
  { sesiones = 0, sinCortar = false, entrenoReciente = false }: Situacion = {},
): { texto: string; expresion: Expresion } | null {
  const grupo = POR_MOMENTO.get(momento)
  if (!grupo) return null

  const ciertas = grupo.lineas.filter(
    (l) =>
      (DESDE_SESIONES.get(l) ?? 0) <= sesiones &&
      (sinCortar || !PIDEN_CONTINUIDAD.has(l)) &&
      (entrenoReciente || !PIDEN_ENTRENO_RECIENTE.has(l)),
  )
  if (ciertas.length === 0) return null

  const recientes = new Set(dichas)
  const libres = ciertas.filter((l) => !recientes.has(l))
  // Si ya se dijeron todas, se permite repetir: es preferible repetir a callarse.
  const candidatas = libres.length > 0 ? libres : ciertas

  const i = Math.min(
    candidatas.length - 1,
    Math.max(0, Math.floor(Math.abs(azar) * candidatas.length)),
  )
  return { texto: candidatas[i]!, expresion: grupo.expresion }
}

/** Cuántas frases se recuerdan para no repetirlas. */
export const MEMORIA = 40

/** Agrega una frase al buffer, recortándolo. */
export function recordar(dichas: readonly string[], texto: string): string[] {
  return [texto, ...dichas.filter((d) => d !== texto)].slice(0, MEMORIA)
}

/**
 * Qué se dice en un descanso, y con qué cara.
 *
 * Vive acá y no en la pantalla porque es una decisión, no un renderizado: hay
 * cuatro caminos y una garantía —**un descanso nunca se queda mudo**— que sin
 * un test se rompe la primera vez que alguien toca una rama.
 *
 * El criterio es el de un entrenador, que tampoco dice lo mismo en el minuto
 * cinco que en el cuarenta:
 *
 * - Si falta una sola serie, se habla de esa serie.
 * - Si es el último ejercicio, se habla del final.
 * - En la primera mitad de la sesión, la técnica. Es lo que de verdad sirve
 *   justo antes de repetir el movimiento, y es cuando queda cabeza para
 *   aplicarla.
 * - En la segunda mitad, aliento. Es cuando hace falta no aflojar y cuando una
 *   corrección técnica ya no se ejecuta.
 *
 * La técnica rota por `azar` y no por la serie que va. Todos los ejercicios
 * son de tres series, así que el único descanso que muestra técnica es el de
 * la primera: rotar por el contador de series dejaba las otras indicaciones
 * escritas y nunca vistas.
 */
export function dichoDelDescanso(clave: {
  /** Las indicaciones de técnica del ejercicio. */
  tecnica: readonly string[]
  /** Cuántas series faltan después de esta. */
  faltan: number
  /** Qué ejercicio de la sesión es, empezando en cero. */
  indice: number
  /** Cuántos ejercicios tiene la sesión. */
  total: number
  /** El azar del descanso, entre 0 y 1. */
  azar: number
}): { texto: string; expresion: Expresion } | null {
  const { tecnica, faltan, indice, total, azar } = clave

  // El orden de estos dos `if` importa, y estaba al revés.
  //
  // Con `faltan === 1` primero, en una sesión densa el banco del final no se
  // mostraba NUNCA: el plan denso queda [duro, bajada, duro, bajada…], la
  // última entrada es una bajada de dos series, y su único descanso tiene
  // siempre una serie por delante. Medido sobre 8910 sesiones densas
  // simuladas: solo el 11% llegaba alguna vez a una frase de final, y eran
  // justo las que no tienen bajada en el último bloque.
  //
  // El final gana porque dice algo más específico: "queda una" es cierto en
  // treinta descansos de la semana, y "te vas" es cierto una sola vez.
  if (indice === total - 1) return fraseDe('final', azar)
  if (faltan === 1) return fraseDe('ultima', azar)

  const primeraMitad = indice < (total - 1) / 2
  if (!primeraMitad) {
    const aliento = fraseDe('aliento', azar)
    if (aliento) return aliento
  }

  if (tecnica.length === 0) return fraseDe('aliento', azar)

  const i = Math.min(
    tecnica.length - 1,
    Math.max(0, Math.floor(Math.abs(azar) * tecnica.length)),
  )
  return { texto: tecnica[i]!, expresion: 'piensa' }
}
