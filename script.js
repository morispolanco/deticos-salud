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
let currentDilemmaIndex = 0; // Cuenta cuántos dilemas se han *empezado* a mostrar
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
 * Muestra/oculta el indicador de carga.
 */
function setLoading(isLoading) {
    loadingDiv.style.display = isLoading ? 'block' : 'none';
    if (isLoading) {
        hideError(); // Oculta errores previos al cargar
        dilemmaContainerDiv.style.display = 'none'; // Oculta contenido mientras carga
        feedbackAreaDiv.style.display = 'none'; // Oculta feedback
        nextBtn.style.display = 'none'; // Oculta botón siguiente
        submitBtn.style.display = 'none'; // Oculta botón enviar mientras carga
    }
}

/**
 * Llama a la función Serverless para obtener UN dilema ético.
 */
async function fetchDilemmaFromAPI() {
    setLoading(true);
    try {
        const response = await fetch('/api/generateDilemma'); // Llama a nuestra función serverless
        if (!response.ok) {
            let errorData = { error: `Error del servidor: ${response.status}` };
            try {
                errorData = await response.json(); // Intenta obtener un mensaje de error del backend
            } catch (e) { /* Ignora si no hay JSON */ }
            throw new Error(errorData.error || `Error ${response.status}`);
        }
        const data = await response.json();

        // Validación básica de la respuesta de la API
        if (!data.dilemma || !data.question || !data.options || !Array.isArray(data.options) || data.options.length < 2 || !data.feedback || typeof data.feedback !== 'object') {
            console.error("Respuesta incompleta o mal formada de la API:", data);
            throw new Error("La API devolvió datos incompletos o con formato incorrecto.");
        }
        if (!data.options.every(opt => opt && opt.id && opt.text)) {
             console.error("Opciones mal formadas:", data.options);
             throw new Error("Las opciones recibidas de la API tienen un formato incorrecto.");
        }
        if (!data.options.every(opt => data.feedback.hasOwnProperty(opt.id))) {
             console.error("Feedback incompleto:", data.feedback, "Opciones:", data.options);
             throw new Error("El feedback recibido de la API no coincide con las opciones.");
         }

        setLoading(false);
        return data; // Devuelve el dilema generado
    } catch (error) {
        console.error('Error al llamar a la API de dilemas:', error);
        setLoading(false);
        showError(`No se pudo obtener el dilema de la API. ${error.message}`);
        return null; // Devuelve null para indicar fallo
    }
}

/**
 * Muestra el dilema recibido en la interfaz.
 */
function displayDilemma(dilemmaData) {
    if (!dilemmaData) return; // No hacer nada si no hay datos

    // Almacena el feedback para usarlo al enviar la respuesta
    currentFeedbackData = dilemmaData.feedback;

    // El índice aquí representa el *número* de dilema actual (empezando en 1)
    progressP.textContent = `Dilema ${currentDilemmaIndex + 1} de ${TOTAL_DILEMMAS}`;
    dilemmaTextP.textContent = dilemmaData.dilemma;
    questionTextP.textContent = dilemmaData.question;

    optionsContainerDiv.innerHTML = ''; // Limpiar opciones anteriores
    dilemmaData.options.forEach(option => {
        const label = document.createElement('label');
        label.classList.add('option-label');
        label.htmlFor = `option-${option.id}`;

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'dilemma-option';
        radio.id = `option-${option.id}`;
        radio.value = option.id;
        radio.addEventListener('change', handleOptionSelect);
        radio.disabled = false; // Asegurarse de que esté habilitado

        label.appendChild(radio);
        label.appendChild(document.createTextNode(` ${option.text}`));
        optionsContainerDiv.appendChild(label);
    });

    submitBtn.disabled = true; // Deshabilitar hasta que se seleccione una opción
    submitBtn.style.display = 'inline-block'; // Asegura que el botón Enviar sea visible
    feedbackAreaDiv.style.display = 'none'; // Ocultar feedback anterior
    nextBtn.style.display = 'none'; // Ocultar botón Siguiente
    dilemmaContainerDiv.style.display = 'block'; // Mostrar el contenedor del dilema
    endScreenDiv.style.display = 'none';
    selectedOptionId = null; // Resetear selección

    // Resetear estilos visuales
    document.querySelectorAll('.option-label').forEach(label => {
        label.classList.remove('selected');
    });
}

/**
 * Carga y muestra el siguiente dilema (o el primero).
 */
async function loadNextDilemma() {
    // No incrementar aquí, el índice se incrementa en handleNext o restartApp

    if (currentDilemmaIndex >= TOTAL_DILEMMAS) {
        showEndScreen();
        return;
    }

    const dilemmaData = await fetchDilemmaFromAPI();
    if (dilemmaData) {
        // Solo mostramos si la carga fue exitosa
        displayDilemma(dilemmaData);
    }
    // Si hubo un error, fetchDilemmaFromAPI ya lo mostró con showError.
}


/**
 * Maneja la selección de una opción por el usuario.
 */
function handleOptionSelect(event) {
    selectedOptionId = event.target.value;
    submitBtn.disabled = false;

    // Resalta la opción seleccionada
    document.querySelectorAll('.option-label').forEach(label => {
        label.classList.remove('selected');
    });
    // event.target es el input radio, closest('label') encuentra el label contenedor
    event.target.closest('label').classList.add('selected');
}

/**
 * Maneja el envío de la respuesta.
 */
function handleSubmit() {
    if (!selectedOptionId || !currentFeedbackData) return; // No hacer nada si no hay selección o datos de feedback

    const feedback = currentFeedbackData[selectedOptionId];

    feedbackTextP.textContent = feedback || "No hay retroalimentación específica para esta opción."; // Fallback
    feedbackAreaDiv.style.display = 'block';

    // Deshabilitar opciones y botón de envío
    submitBtn.disabled = true;
    submitBtn.style.display = 'none'; // Ocultar botón Enviar
    document.querySelectorAll('input[name="dilemma-option"]').forEach(radio => {
        radio.disabled = true;
        // Opcional: quitar el resaltado azul al mostrar feedback
        // radio.closest('label').classList.remove('selected');
    });

    nextBtn.style.display = 'inline-block'; // Mostrar botón para continuar
}

/**
 * Maneja el paso al siguiente dilema.
 */
function handleNext() {
    currentDilemmaIndex++; // Incrementar el contador de dilemas completados/avanzados
    // Ocultar feedback y botón 'next' inmediatamente
    feedbackAreaDiv.style.display = 'none';
    nextBtn.style.display = 'none';

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
    endScreenDiv.style.display = 'block';
}

/**
 * Reinicia la aplicación.
 */
function restartApp() {
    currentDilemmaIndex = 0; // Reiniciar contador
    selectedOptionId = null;
    currentFeedbackData = null;
    endScreenDiv.style.display = 'none'; // Ocultar pantalla final
    hideError(); // Ocultar errores previos si los hubo
    loadNextDilemma(); // Cargar el primer dilema de nuevo
}

/**
 * Manejador para el botón de reintentar en caso de error.
 */
function handleRetry() {
     hideError(); // Oculta el mensaje de error
     // Vuelve a intentar cargar el dilema actual (el índice no avanzó si hubo error)
     loadNextDilemma();
}


/**
 * Inicializa la aplicación al cargar la página.
 */
function initializeApp() {
    // Añadir event listeners a los botones
    submitBtn.addEventListener('click', handleSubmit);
    nextBtn.addEventListener('click', handleNext);
    restartBtn.addEventListener('click', restartApp);
    retryBtn.addEventListener('click', handleRetry); // Listener para reintentar

    // Cargar el primer dilema al iniciar
    loadNextDilemma();
}

// --- Iniciar la Aplicación ---
// Esperar a que el DOM esté completamente cargado para asegurar que todos los elementos existen
document.addEventListener('DOMContentLoaded', initializeApp);
