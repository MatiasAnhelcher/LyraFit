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
      'Empezar es lo más caro. Lo demás ya viene solo.',
      'Nadie entra en forma en una sesión. Se entra en todas.',
      'Buen momento para hacer algo que mañana agradezcas.',
      'La sesión más útil es la que hacés, no la perfecta.',
      'Estás a un toque de que hoy cuente.',
      'Lo tenés medido y escrito. Solo falta moverse.',
      'Media hora tuya. Después el día sigue.',
      'Vení, que esto es más corto de lo que parece.',
      'Ponete la ropa. El resto se acomoda solo.',
      'No tenés que tener ganas. Tenés que empezar.',
      'Cada vez que abrís esto, algo se está sosteniendo.',
      'El cuerpo arranca frío siempre. Es normal.',
      'Hoy tocan cuatro cosas. Ni una más.',
      'Vamos despacio, que tenemos tiempo.',
      'Lo que hagas hoy lo vas a leer dentro de un año.',
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
      'La última repetición es la que cambia algo.',
      'No fue linda, pero fue.',
      'Eso que acabás de hacer no se improvisa.',
      'Seguiste cuando ya no querías. Eso es lo raro.',
      'Buen laburo. En serio.',
      'Te la bancaste entera.',
      'Insistir cuando cuesta es la parte que casi nadie hace.',
      'Le pusiste. Se ve.',
      'Eso fue trabajo del bueno.',
      'Una más de las que no tenías.',
      'Ahí está. Eso era.',
      'Cuando el cuerpo dice basta y seguís un poco más, algo cambia.',
      'Te costó respirar y no paraste.',
      'Esa serie ya quedó anotada para siempre.',
      'Hiciste la parte incómoda. Es la que paga.',
      'No aflojaste a la mitad.',
      'Esa temblaba y salió igual.',
      'El esfuerzo de hoy no se ve hoy.',
      'Bien ahí. Descansá que sigue.',
      'Lo hiciste con la técnica puesta. Doble mérito.',
      'Te sostuviste hasta el final del tiempo.',
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
      'No perdiste fuerza. Dormiste mal.',
      'Quedar corto una vez es información, no un veredicto.',
      'El cuerpo tiene días. El plan lo contempla.',
      'Esto no es un techo, es una curva.',
      'No fallaste vos. Falló el intento.',
      'Bajar el objetivo no es retroceder. Es medir bien.',
      'Salieron menos y seguís exactamente donde estabas.',
      'Nadie sube todas las semanas. Nadie.',
      'Una sesión floja no borra las quince anteriores.',
      'Ojo con leer un número malo como una sentencia.',
      'Lo que pasó hoy no dice nada de mañana.',
      'Estás cansado, no estancado.',
      'El motor ya lo tuvo en cuenta. Quedate tranquilo.',
      'Menos repeticiones no es menos vos.',
      'Es un dato, no un juicio.',
      'A veces el progreso se parece a quedarse quieto.',
      'Bajaste hoy y eso también es entrenar.',
      'No hace falta explicar nada. Pasa.',
      'La semana que viene es otra semana.',
      'Preferible una sesión corta que una historia que te contás.',
      'Si te dolió algo, hiciste bien en parar.',
      'Cortar a tiempo también es criterio.',
      'Guardá esto: la peor sesión es la que no pasó.',
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
      'Un mes de esto se nota. Tres, se ve.',
      'No es motivación: es que volviste.',
      'Estás construyendo algo lento y difícil de romper.',
      'Lo que hacés seguido pesa más que lo que hacés fuerte.',
      'Cada sesión que entra ya no se va.',
      'Mirá el historial cuando dudes.',
      'Faltar una vez no rompe nada. Volver lo arregla todo.',
      'Esto no se trata de no fallar. Se trata de volver.',
      'La suma no tiene apuro.',
      'Ya sos alguien que entrena. Ya está.',
      'Nadie sostiene esto por ganas. Lo sostenés por costumbre.',
      'Sumaste otra sin hacer ruido.',
      'Semana tras semana, ahí seguís.',
      'Poco y siempre le gana a mucho y a veces.',
      'Otra vuelta al sol para el cuerpo.',
      'Se te está haciendo normal. Eso es lo bueno.',
      'La versión tuya de dentro de un año va a mirar esto.',
      'Hoy pusiste otro ladrillo.',
      'No pasó nada especial. Por eso funciona.',
      'Lo aburrido es lo que rinde.',
      'Cuarenta minutos que no te van a devolver, y valió.',
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
      'Andá tranquilo, hiciste la parte difícil.',
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
      'Terminaste entero. Buena señal.',
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
      'El músculo se construye descansando, no entrenando.',
      'Descansar no es una pausa del plan. Es el plan.',
      'Si entrenás hoy, mañana rendís menos.',
      'Dormir bien hace más que una serie extra.',
      'Tomate el día. Está previsto.',
      'La ansiedad de entrenar todos los días no construye nada.',
      'Nada que hacer hoy. Disfrutalo.',
      'Se descansa para poder volver a apretar.',
      'Dejá que el cuerpo termine lo que empezaste.',
      'Hoy comer bien es tu entrenamiento.',
      'Un día libre no te atrasa.',
      'Caminá si querés moverte. Nada más.',
      'El progreso pasa mientras dormís.',
      'Guardá las ganas para el próximo día.',
      'No hay nada que compensar.',
      'Descansar cuesta más que entrenar, a veces.',
      'Este también es un día del plan.',
      'Mañana te va a salir mejor por esto.',
      'Tranquilo. No estás perdiendo nada.',
      'Aprovechá y estirá un poco, si querés.',
      'Hoy no hace falta hacer nada.',
      'La recuperación es la mitad invisible.',
      'Si te sentís entero, mejor: significa que descansaste.',
      'Nos vemos en el próximo.',
      'Agua, comida y sueño. Eso es hoy.',
      'Estar quieto también es entrenar.',
    ],
  },
  {
    momento: 'vuelta',
    expresion: 'calma',
    lineas: [
      'Volviste. Eso es todo lo que importa.',
      'Cuánto tiempo pasó no cambia nada. Estás acá.',
      'Arrancamos más liviano y listo.',
      'No hay que recuperar nada. Hay que empezar.',
      'Nadie lleva la cuenta de los días que faltaste.',
      'Volver es más difícil que seguir. Y lo hiciste.',
      'El cuerpo se acuerda más rápido de lo que creés.',
      'Hoy bajamos un poco la vara. Es a propósito.',
      'Ningún plan sobrevive a la vida. Se retoma y ya.',
      'Perfecto. Sin culpa y sin apuro.',
      'Esto no se reinicia desde cero.',
      'Lo que construiste sigue ahí abajo.',
      'Dos semanas afuera no borran tres meses adentro.',
      'La vuelta siempre se siente peor de lo que es.',
      'Tomátelo con calma esta primera.',
      'No te exijas hoy. Exigite la próxima.',
      'Bienvenido de nuevo.',
      'Lo importante no es no faltar. Es volver.',
      'Vamos de a poco que el cuerpo avisa.',
      'Hoy alcanza con hacer acto de presencia.',
      'Nadie vuelve en su mejor forma. Se vuelve y ya.',
      'Retomar es una habilidad. La estás usando.',
      'Faltar estaba previsto. Volver también.',
      'Esta sesión vale doble aunque no lo parezca.',
      'Empezamos de nuevo, sin drama.',
      'Bajá las expectativas de hoy y subí las de la semana.',
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
      'Lo que hoy es tu máximo va a ser tu calentamiento.',
      'Ya dominaste este. Se nota en los números.',
      'El techo no es el final: es la puerta.',
      'Guardá esta sensación de que te sale fácil.',
      'Acordate de cuando esto era imposible.',
      'Estás arriba del rango. Eso es lo que buscábamos.',
      'El próximo eslabón te va a parecer otro deporte.',
      'Esto ya lo tenés. Vamos por lo que sigue.',
      'Cuidado con acelerar: el salto se gana consolidando.',
      'Una o dos sesiones más así y cambiás.',
      'Buen momento para revisar la técnica antes de subir.',
      'Cuando subas, el número baja. El nivel sube.',
      'Lo estás haciendo mejor que hace un mes. Está medido.',
      'Casi. Falta muy poco.',
      'El cambio de eslabón se siente como retroceder. No lo es.',
      'Ya no sos el que empezó esta cadena.',
      'Te queda un escalón de este tramo.',
      'Mantené la calidad y el salto llega solo.',
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
      'El día que menos querés es el que más suma.',
      'Bajemos el objetivo y listo, pero hagamos algo.',
      'Se puede entrenar cansado. Se hace siempre.',
      'No pienses en las tres series. Pensá en esta.',
      'Cortala con el análisis y hacé una.',
      'Ya estás vestido. Es medio camino.',
      'Hoy no busquemos récords. Busquemos presencia.',
      'Entrar es lo difícil, salir es fácil.',
      'Diez minutos y te dejo en paz.',
      'Si te sale, seguimos. Si no, cortamos sin culpa.',
      'Lo peor que puede pasar es que hagas poco.',
      'Dale, una y vemos.',
      'No hace falta que salga bien.',
      'Podés hacerlo mal. Lo que no podés es no hacerlo.',
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
      'Bajá despacio: la parte lenta es la que construye.',
      'Si no podés hablar, bajá un cambio.',
      'No hay que terminar destruido para que sirva.',
      'Dejar una o dos en el tanque es mejor entrenamiento.',
      'El dolor muscular no mide nada.',
      'Que no te duela no significa que no sirvió.',
      'Tomá agua.',
      'Comer proteína hace más que la última serie.',
      'Dormir seis horas te cuesta más que saltear una sesión.',
      'El calentamiento no es tiempo perdido.',
      'Si algo se siente mal, se para. No se negocia.',
      'La fuerza que ganás acá se nota afuera.',
      'Escaleras, valijas, mudanzas. Para eso también es.',
      'El cuerpo responde a lo que le pedís seguido.',
      'No compares tu día uno con el día cien de nadie.',
      'Hoy tu trabajo es moverte bien, no moverte mucho.',
      'La postura de todos los días también se entrena acá.',
      'Estirar no previene nada mágico, pero se siente bien.',
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
      'Lo que ganás despacio se pierde despacio.',
      'Dentro de un año esto va a parecer poco.',
      'Las progresiones no se saltean. Se caminan.',
      'Vas a olvidarte de cuándo empezaste.',
      'El progreso no es una línea. Es un garabato que sube.',
      'Medir cada semana no sirve. Mirá los meses.',
      'Un año de esto te cambia el cuerpo entero.',
      'El apuro es el único enemigo real acá.',
      'Vas a estancarte varias veces. Es parte.',
      'Lo lento también llega.',
      'No hay atajos que no se paguen después.',
      'Tres años de constancia le ganan a cualquier plan perfecto.',
      'El objetivo no es esta sesión. Es la número doscientos.',
      'Vas a mirar atrás y no vas a reconocer el punto de partida.',
      'Lo que estás haciendo hoy ya funcionó para mucha gente.',
      'La fuerza es la única cosa que se acumula sin caducar.',
      'Sumar un kilo de músculo lleva meses. Está bien.',
      'Nadie ve el progreso desde adentro. Por eso se mide.',
      'Cada eslabón tiene su tiempo y no se negocia.',
      'Las cadenas terminan en ejercicios que hoy parecen de otro planeta.',
      'La versión tuya del año que viene empieza hoy.',
      'Esto no tiene línea de llegada, y está bien.',
      'Lo que importa no es cuánto podés. Es cuánto tiempo seguís.',
      'Mucha gente empieza. Poca sigue. Vos seguís.',
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
      'Cuidá la técnica y el número viene solo.',
      'No hace falta que sea rápido.',
      'Otra más y esto empieza a terminarse.',
      'Respirá. El descanso es para eso.',
      'Vos podés con la que sigue.',
      'Buen laburo hasta acá.',
      'Estás haciendo justo lo que había que hacer.',
      'Mantené la forma y listo.',
      'Cuando vuelvas, empezá tranquilo.',
      'El cuerpo ya entró en calor. Ahora rinde.',
      'Falta poco para el próximo ejercicio.',
      'Seguís entero. Aprovechalo.',
    ],
  },
  {
    momento: 'ultima',
    expresion: 'guino',
    lineas: [
      'Queda una. Esta es la que cuenta.',
      'La última. Dale todo y después descansás.',
      'Una sola más y este ejercicio está.',
      'Ya casi. Queda la última.',
      'Esta es la que más suma. Última.',
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
      'La última sale. Siempre sale.',
      'Una más y cambiamos de patrón.',
      'Terminala como si fuera la primera.',
    ],
  },
  {
    momento: 'final',
    expresion: 'festejo',
    lineas: [
      'Último ejercicio. Esto ya está terminando.',
      'Lo que queda es poco. Aguantá ahí.',
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
      'Aguantá un poquito más.',
      'Último ejercicio: acá se cierra.',
      'Casi. Ya casi.',
      'Estás a un ejercicio de terminar.',
      'Lo que falta se hace solo.',
      'Final de sesión. Bien ahí.',
      'Un último empujón y listo.',
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
export const CUANTAS = 378

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
 */
export function fraseDe(
  momento: Momento,
  azar: number,
  dichas: readonly string[] = [],
): { texto: string; expresion: Expresion } | null {
  const grupo = POR_MOMENTO.get(momento)
  if (!grupo || grupo.lineas.length === 0) return null

  const recientes = new Set(dichas)
  const libres = grupo.lineas.filter((l) => !recientes.has(l))
  // Si ya se dijeron todas, se permite repetir: es preferible repetir a callarse.
  const candidatas = libres.length > 0 ? libres : grupo.lineas

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

  if (faltan === 1) return fraseDe('ultima', azar)
  if (indice === total - 1) return fraseDe('final', azar)

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
