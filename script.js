// --- Elementos del DOM ---
const loadingDiv = document.getElementById('loading');
const errorMessageDiv = document.getElementById('error-message');
const errorMessageP = errorMessageDiv.querySelector('p');
const retryBtn = document.getElementById('retry-btn');
const dilemmaContainerDiv = document.getElementById('dilemma-container');
const progressP = document.getElementById('progress');
const dilemmaTextP = document.getElementById('dilemma-text');
const questionTextP = document.getElementById('question-text');
const optionsContainerDiv = document.getElementById('options-container');
const submitBtn = document.getElementById('submit-btn');
const feedbackAreaDiv = document.getElementById('feedback-area');
const feedbackTextP = document.getElementById('feedback-text');
const nextBtn = document.getElementById('next-btn');
const endScreenDiv = document.getElementById('end-screen');
const restartBtn = document.getElementById('restart-btn');

// --- Estado de la Aplicación ---
let currentDilemmaIndex = 0; // Cuenta cuántos dilemas se han *empezado* a mostrar (0-based)
let selectedOptionId = null;
let currentFeedbackData = null; // Almacena el objeto de feedback del dilema actual
const TOTAL_DILEMMAS = 20;

// --- Funciones ---

/**
 * Muestra un mensaje de error al usuario.
 */
function showError(message) {
    errorMessageP.textContent = `Error: ${message}`;
    errorMessageDiv.style.display = 'block';
    // Oculta otros contenedores principales
    loadingDiv.style.display = 'none';
    dilemmaContainerDiv.style.display = 'none';
    endScreenDiv.style.display = 'none';
}

/**
 * Oculta el mensaje de error.
 */
function hideError() {
    errorMessageDiv.style.display = 'none';
}

/**
 * Muestra/oculta el indicador de carga y gestiona la visibilidad de otros elementos.
 */
function setLoading(isLoading) {
    if (isLoading) {
        loadingDiv.style.display = 'block';
        hideError(); // Oculta errores previos al cargar
        dilemmaContainerDiv.style.display = 'none'; // Oculta contenido mientras carga
        feedbackAreaDiv.style.display = 'none'; // Oculta feedback
        nextBtn.style.display = 'none'; // Oculta botón siguiente
        submitBtn.style.display = 'none'; // Oculta botón enviar mientras carga
        endScreenDiv.style.display = 'none'; // Oculta pantalla final
    } else {
        loadingDiv.style.display = 'none';
    }
}

/**
 * Llama a la función Serverless para obtener UN dilema ético.
 */
async function fetchDilemmaFromAPI() {
    setLoading(true);
    try {
        // Asegura que la URL empieza con '/' para ser relativa a la raíz del dominio
        const response = await fetch('/api/generateDilemma');
        if (!response.ok) {
            let errorData = { error: `Error del servidor: ${response.status} ${response.statusText}` };
            try {
                // Intenta obtener un mensaje de error más específico del cuerpo de la respuesta
                const errorJson = await response.json();
                errorData.error = errorJson.error || errorData.error;
            } catch (e) {
                // Si el cuerpo no es JSON o está vacío, usa el error de estado HTTP
                console.warn("No se pudo parsear el cuerpo del error como JSON.");
            }
            throw new Error(errorData.error);
        }
        const data = await response.json();

        // Validación robusta de la respuesta de la API
        if (!data || typeof data !== 'object') {
             throw new Error("La respuesta de la API no es un objeto JSON válido.");
        }
        if (!data.dilemma || typeof data.dilemma !== 'string' || data.dilemma.trim() === '') {
            throw new Error("La respuesta de la API no contiene un 'dilemma' válido.");
        }
        if (!data.question || typeof data.question !== 'string' || data.question.trim() === '') {
             throw new Error("La respuesta de la API no contiene una 'question' válida.");
        }
        if (!data.options || !Array.isArray(data.options) || data.options.length < 2) {
             throw new Error("La respuesta de la API no contiene un array 'options' válido con al menos 2 elementos.");
        }
        if (!data.options.every(opt => opt && typeof opt === 'object' && opt.id && typeof opt.id === 'string' && opt.text && typeof opt.text === 'string')) {
             throw new Error("Las 'options' en la respuesta de la API tienen un formato incorrecto (falta id o text).");
        }
         if (!data.feedback || typeof data.feedback !== 'object' || Object.keys(data.feedback).length === 0) {
             throw new Error("La respuesta de la API no contiene un objeto 'feedback' válido.");
        }
        // Verifica que haya feedback para cada opción
        if (!data.options.every(opt => data.feedback.hasOwnProperty(opt.id) && typeof data.feedback[opt.id] === 'string')) {
             throw new Error("El 'feedback' recibido de la API no coincide con las opciones o no es válido.");
         }

        setLoading(false);
        return data; // Devuelve el dilema generado y validado

    } catch (error) {
        console.error('Error al llamar o procesar la API de dilemas:', error);
        setLoading(false);
        // Muestra el error al usuario a través de la función showError
        showError(`No se pudo obtener el dilema de la API. ${error.message}`);
        return null; // Devuelve null para indicar fallo
    }
}

/**
 * Muestra el dilema recibido en la interfaz.
 */
function displayDilemma(dilemmaData) {
    // Asegurarse que el contenedor principal está visible y otros ocultos
    dilemmaContainerDiv.style.display = 'block';
    loadingDiv.style.display = 'none';
    errorMessageDiv.style.display = 'none';
    endScreenDiv.style.display = 'none';

    // Almacena el feedback para usarlo al enviar la respuesta
    currentFeedbackData = dilemmaData.feedback;

    // El índice aquí representa el *número* de dilema actual (empezando en 1 para el usuario)
    progressP.textContent = `Dilema ${currentDilemmaIndex + 1} de ${TOTAL_DILEMMAS}`;
    dilemmaTextP.textContent = dilemmaData.dilemma;
    questionTextP.textContent = dilemmaData.question;

    optionsContainerDiv.innerHTML = ''; // Limpiar opciones anteriores
    dilemmaData.options.forEach(option => {
        const label = document.createElement('label');
        label.classList.add('option-label');
        label.htmlFor = `option-${option.id}`; // Usar ID único para el 'for'

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'dilemma-option'; // Mismo nombre para agruparlos
        radio.id = `option-${option.id}`; // ID único
        radio.value = option.id; // El valor será el ID de la opción (A, B, C...)
        radio.addEventListener('change', handleOptionSelect);
        radio.disabled = false; // Asegurarse de que esté habilitado al mostrar

        label.appendChild(radio);
        // Añadir un espacio entre el radio y el texto
        label.appendChild(document.createTextNode(` ${option.text}`));
        optionsContainerDiv.appendChild(label);
    });

    submitBtn.disabled = true; // Deshabilitar hasta que se seleccione una opción
    submitBtn.style.display = 'inline-block'; // Asegura que el botón Enviar sea visible
    feedbackAreaDiv.style.display = 'none'; // Ocultar feedback anterior
    nextBtn.style.display = 'none'; // Ocultar botón Siguiente
    selectedOptionId = null; // Resetear selección previa

    // Resetear estilos visuales de selección previa si los hubiera
    document.querySelectorAll('.option-label').forEach(label => {
        label.classList.remove('selected');
        // Podrías añadir aquí la eliminación de clases 'correct' o 'incorrect' si las usaras
    });
}

/**
 * Carga y muestra el siguiente dilema (o el primero).
 */
async function loadNextDilemma() {
    // No incrementar el índice aquí, se hace en handleNext o restartApp

    // Verifica si ya se completaron todos los dilemas ANTES de intentar cargar uno nuevo
    if (currentDilemmaIndex >= TOTAL_DILEMMAS) {
        showEndScreen();
        return;
    }

    const dilemmaData = await fetchDilemmaFromAPI();

    if (dilemmaData) {
        // Solo mostramos el dilema si la carga fue exitosa
        displayDilemma(dilemmaData);
    }
    // Si hubo un error, la función fetchDilemmaFromAPI ya habrá llamado a showError
    // y el flujo se detiene hasta que el usuario interactúe (ej: con retryBtn)
}


/**
 * Maneja la selección de una opción por el usuario.
 */
function handleOptionSelect(event) {
    selectedOptionId = event.target.value; // Guarda el ID de la opción seleccionada (A, B, C...)
    submitBtn.disabled = false; // Habilita el botón de envío

    // Resalta visualmente la opción seleccionada
    document.querySelectorAll('.option-label').forEach(label => {
        label.classList.remove('selected');
    });
    // event.target es el input radio, closest('label') encuentra el label contenedor padre
    event.target.closest('label').classList.add('selected');
}

/**
 * Maneja el envío de la respuesta. Muestra feedback.
 */
function handleSubmit() {
    if (!selectedOptionId || !currentFeedbackData) {
        console.warn("Intento de submit sin opción seleccionada o sin datos de feedback.");
        return; // No hacer nada si no hay selección o datos
    }

    const feedback = currentFeedbackData[selectedOptionId];

    feedbackTextP.textContent = feedback || "No se encontró retroalimentación específica para esta opción."; // Fallback por si acaso
    feedbackAreaDiv.style.display = 'block'; // Muestra el área de feedback

    // Deshabilitar todas las opciones de radio para evitar cambios
    document.querySelectorAll('input[name="dilemma-option"]').forEach(radio => {
        radio.disabled = true;
    });

    // Ocultar botón Enviar y deshabilitarlo (por si acaso)
    submitBtn.style.display = 'none';
    submitBtn.disabled = true;

    // Mostrar botón para continuar al siguiente dilema
    nextBtn.style.display = 'inline-block';

     // Opcional: Quitar el resaltado azul de 'selected' al mostrar el feedback
     const selectedLabel = document.getElementById(`option-${selectedOptionId}`)?.closest('label');
     if (selectedLabel) {
         selectedLabel.classList.remove('selected');
     }
}

/**
 * Maneja el paso al siguiente dilema.
 */
function handleNext() {
    currentDilemmaIndex++; // Incrementar el contador de dilemas completados/vistos

    // Ocultar feedback y botón 'next' inmediatamente para preparar la siguiente carga
    feedbackAreaDiv.style.display = 'none';
    nextBtn.style.display = 'none';

    // Verifica si ya hemos alcanzado el total de dilemas
    if (currentDilemmaIndex < TOTAL_DILEMMAS) {
        loadNextDilemma(); // Carga el siguiente
    } else {
        showEndScreen(); // Se completaron los 20
    }
}

/**
 * Muestra la pantalla final.
 */
function showEndScreen() {
    dilemmaContainerDiv.style.display = 'none';
    loadingDiv.style.display = 'none';
    errorMessageDiv.style.display = 'none';
    feedbackAreaDiv.style.display = 'none';
    nextBtn.style.display = 'none';
    submitBtn.style.display = 'none';
    endScreenDiv.style.display = 'block'; // Muestra la pantalla final
}

/**
 * Reinicia la aplicación desde el principio.
 */
function restartApp() {
    currentDilemmaIndex = 0; // Reiniciar contador
    selectedOptionId = null;
    currentFeedbackData = null;
    endScreenDiv.style.display = 'none'; // Ocultar pantalla final
    hideError(); // Ocultar errores previos si los hubo
    // Inicia la carga del primer dilema nuevamente
    loadNextDilemma();
}

/**
 * Manejador para el botón de reintentar en caso de error de carga.
 */
function handleRetry() {
     console.log("Retrying to load dilemma...");
     hideError(); // Oculta el mensaje de error
     // Vuelve a intentar cargar el dilema que falló (el índice no avanzó si hubo error)
     loadNextDilemma();
}


/**
 * Inicializa la aplicación al cargar la página.
 */
function initializeApp() {
    console.log("Initializing Ethical Dilemmas App...");
    // Añadir event listeners a los botones principales
    submitBtn.addEventListener('click', handleSubmit);
    nextBtn.addEventListener('click', handleNext);
    restartBtn.addEventListener('click', restartApp);
    retryBtn.addEventListener('click', handleRetry); // Listener para reintentar

    // Cargar el primer dilema al iniciar
    loadNextDilemma();
}

// --- Iniciar la Aplicación ---
// Esperar a que el DOM esté completamente cargado para asegurar que todos los elementos existen
// y evitar errores si el script se carga antes que el HTML.
document.addEventListener('DOMContentLoaded', initializeApp);
