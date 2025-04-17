// --- Elementos del DOM ---
const loadingDiv = document.getElementById('loading');
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
let dilemmas = []; // Almacenará los 20 dilemas generados
let currentDilemmaIndex = 0;
let selectedOptionId = null;
const TOTAL_DILEMMAS = 20;

// --- Funciones ---

/**
 * Muestra un mensaje de error al usuario.
 */
function showError(message) {
    loadingDiv.innerHTML = `<p style="color: red;">Error: ${message}</p><p>Por favor, revisa la consola y recarga la página.</p>`;
    loadingDiv.style.display = 'block';
    dilemmaContainerDiv.style.display = 'none';
    endScreenDiv.style.display = 'none';
}

/**
 * Llama a la función Serverless para obtener un dilema ético.
 */
async function fetchDilemmaFromAPI() {
    try {
        const response = await fetch('/api/generateDilemma'); // Llama a nuestra función serverless
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error del servidor: ${response.status}`);
        }
        const data = await response.json();

        // Validación básica de la respuesta de la API
        if (!data.dilemma || !data.question || !data.options || data.options.length < 2 || !data.feedback) {
            console.error("Respuesta incompleta o mal formada de la API:", data);
            throw new Error("La API devolvió datos incompletos o con formato incorrecto.");
        }
        // Asegurarse de que cada opción tiene id y text
        if (!data.options.every(opt => opt && opt.id && opt.text)) {
             console.error("Opciones mal formadas:", data.options);
             throw new Error("Las opciones recibidas de la API tienen un formato incorrecto.");
        }
         // Asegurarse de que el feedback tiene entradas para cada opción ID
        if (!data.options.every(opt => data.feedback.hasOwnProperty(opt.id))) {
             console.error("Feedback incompleto:", data.feedback, "Opciones:", data.options);
             throw new Error("El feedback recibido de la API no coincide con las opciones.");
        }

        return data;
    } catch (error) {
        console.error('Error al llamar a la API de dilemas:', error);
        showError(`No se pudo obtener el dilema de la API. ${error.message}`);
        return null; // Devuelve null para indicar fallo
    }
}

/**
 * Genera los 20 dilemas llamando a la API repetidamente.
 */
async function generateAllDilemmas() {
    loadingDiv.style.display = 'block';
    dilemmaContainerDiv.style.display = 'none';
    endScreenDiv.style.display = 'none';
    dilemmas = []; // Limpia dilemas previos si se reinicia

    for (let i = 0; i < TOTAL_DILEMMAS; i++) {
        console.log(`Generando dilema ${i + 1}...`);
        const dilemma = await fetchDilemmaFromAPI();
        if (dilemma) {
            dilemmas.push(dilemma);
            // Actualizar progreso visualmente (opcional pero bueno)
            loadingDiv.querySelector('p').textContent = `Generando dilema ${i + 1} de ${TOTAL_DILEMMAS}...`;
        } else {
            // Si falla la obtención de un dilema, detenemos el proceso.
            // El error ya se mostró en fetchDilemmaFromAPI
            return false; // Indica que la generación falló
        }
    }
    loadingDiv.style.display = 'none';
    return true; // Indica que la generación fue exitosa
}

/**
 * Muestra el dilema actual en la interfaz.
 */
function displayDilemma(index) {
    if (index >= dilemmas.length) {
        showEndScreen();
        return;
    }

    const currentDilemma = dilemmas[index];
    progressP.textContent = `Dilema ${index + 1} de ${TOTAL_DILEMMAS}`;
    dilemmaTextP.textContent = currentDilemma.dilemma;
    questionTextP.textContent = currentDilemma.question;

    optionsContainerDiv.innerHTML = ''; // Limpiar opciones anteriores
    currentDilemma.options.forEach(option => {
        const label = document.createElement('label');
        label.classList.add('option-label');
        label.htmlFor = `option-${option.id}`;

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'dilemma-option';
        radio.id = `option-${option.id}`;
        radio.value = option.id;
        radio.addEventListener('change', handleOptionSelect);

        label.appendChild(radio);
        label.appendChild(document.createTextNode(` ${option.text}`)); // Añadir texto de la opción
        optionsContainerDiv.appendChild(label);
    });

    submitBtn.disabled = true; // Deshabilitar hasta que se seleccione una opción
    feedbackAreaDiv.style.display = 'none';
    nextBtn.style.display = 'none';
    dilemmaContainerDiv.style.display = 'block';
    selectedOptionId = null; // Resetear selección
     // Resetear estilos de opciones
    document.querySelectorAll('.option-label').forEach(label => {
        label.classList.remove('selected', 'correct', 'incorrect');
    });

}

/**
 * Maneja la selección de una opción por el usuario.
 */
function handleOptionSelect(event) {
    selectedOptionId = event.target.value;
    submitBtn.disabled = false;

    // Resaltar opción seleccionada (visual)
    document.querySelectorAll('.option-label').forEach(label => {
        label.classList.remove('selected');
    });
    event.target.closest('label').classList.add('selected');
}

/**
 * Maneja el envío de la respuesta.
 */
function handleSubmit() {
    if (!selectedOptionId) return; // No hacer nada si no hay selección

    const currentDilemma = dilemmas[currentDilemmaIndex];
    const feedback = currentDilemma.feedback[selectedOptionId];

    feedbackTextP.textContent = feedback || "No hay retroalimentación específica para esta opción."; // Fallback
    feedbackAreaDiv.style.display = 'block';

    // Deshabilitar opciones y botón de envío
    submitBtn.disabled = true;
    document.querySelectorAll('input[name="dilemma-option"]').forEach(radio => {
        radio.disabled = true;
        const label = radio.closest('label');
        // Opcional: Marcar visualmente la correcta/incorrecta si tienes esa info
        // (La API actual no la pide explícitamente como "correcta", solo da feedback)
        // if (radio.value === currentDilemma.correctOptionId) { // Si tuvieras 'correctOptionId'
        //     label.classList.add('correct');
        // } else if (radio.value === selectedOptionId) {
        //     label.classList.add('incorrect');
        // }
        label.classList.remove('selected'); // Quitar el resaltado azul
    });


    nextBtn.style.display = 'inline-block'; // Mostrar botón para continuar
}

/**
 * Maneja el paso al siguiente dilema.
 */
function handleNext() {
    currentDilemmaIndex++;
    if (currentDilemmaIndex < TOTAL_DILEMMAS) {
        displayDilemma(currentDilemmaIndex);
    } else {
        showEndScreen();
    }
}

/**
 * Muestra la pantalla final.
 */
function showEndScreen() {
    dilemmaContainerDiv.style.display = 'none';
    endScreenDiv.style.display = 'block';
}

/**
 * Reinicia la aplicación.
 */
async function restartApp() {
    endScreenDiv.style.display = 'none';
    loadingDiv.style.display = 'block';
    currentDilemmaIndex = 0;
    selectedOptionId = null;

    // Volver a generar dilemas (o podrías reutilizar los existentes si prefieres)
    const generated = await generateAllDilemmas();
    if (generated) {
        displayDilemma(currentDilemmaIndex);
    }
    // Si 'generated' es false, la función showError ya habrá mostrado un error.
}


/**
 * Inicializa la aplicación al cargar la página.
 */
async function initializeApp() {
    submitBtn.addEventListener('click', handleSubmit);
    nextBtn.addEventListener('click', handleNext);
    restartBtn.addEventListener('click', restartApp);

    const generated = await generateAllDilemmas();
    if (generated) {
        displayDilemma(currentDilemmaIndex);
    }
    // Si 'generated' es false, la función showError ya habrá mostrado un error.
}

// --- Iniciar la Aplicación ---
initializeApp();
