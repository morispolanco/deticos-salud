// Importa el SDK de Google Generative AI
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// Handler de Vercel Serverless Function
export default async function handler(req, res) {
    // Asegúrate de que solo se acepten peticiones GET (o POST si prefieres)
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Obtén la API Key desde las variables de entorno de Vercel
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Error: GEMINI_API_KEY no está configurada en las variables de entorno.");
        return res.status(500).json({ error: 'Configuración interna del servidor incorrecta.' });
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
             model: "gemini-1.5-flash", // O el modelo que prefieras/tengas acceso
             // Ajustes de seguridad (opcional pero recomendado)
             safetySettings: [
                 { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                 { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                 { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                 { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
        });

        const prompt = `
            Genera un dilema ético conciso relacionado con el campo de la salud (medicina, enfermería, gestión sanitaria, investigación biomédica, etc.).
            El dilema debe ser presentado como una situación seguida de una pregunta de opción múltiple con exactamente 3 opciones (A, B, C).
            Proporciona retroalimentación específica para CADA una de las 3 opciones, explicando brevemente las implicaciones éticas o las razones por las que esa opción podría ser elegida o considerada problemática.

            Formato de respuesta OBLIGATORIO (solo JSON, sin texto introductorio ni explicaciones adicionales fuera del JSON):
            {
              "dilemma": "Descripción de la situación ética...",
              "question": "La pregunta específica para el usuario...",
              "options": [
                {"id": "A", "text": "Texto de la opción A..."},
                {"id": "B", "text": "Texto de la opción B..."},
                {"id": "C", "text": "Texto de la opción C..."}
              ],
              "feedback": {
                "A": "Retroalimentación si se elige A...",
                "B": "Retroalimentación si se elige B...",
                "C": "Retroalimentación si se elige C..."
              }
            }

            Asegúrate de que el JSON sea válido. No incluyas saltos de línea innecesarios dentro de las cadenas de texto del JSON.
        `;

        console.log("Enviando prompt a Gemini..."); // Log para depuración
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        console.log("Respuesta recibida de Gemini (texto):", text); // Log para depuración

        // Intenta parsear la respuesta como JSON
        let jsonData;
        try {
            // Limpiar posible markdown de bloque de código si Gemini lo añade
             const cleanedText = text.replace(/^```json\s*|```$/g, '').trim();
             jsonData = JSON.parse(cleanedText);
        } catch (parseError) {
             console.error("Error al parsear JSON de Gemini:", parseError);
             console.error("Texto recibido:", text); // Mostrar el texto problemático
             throw new Error("La respuesta de la API no pudo ser interpretada como JSON válido.");
        }

        // Validación adicional de la estructura del JSON parseado (opcional pero recomendado)
        if (!jsonData.dilemma || !jsonData.question || !jsonData.options || !Array.isArray(jsonData.options) || jsonData.options.length !== 3 || !jsonData.feedback || typeof jsonData.feedback !== 'object') {
            console.error("JSON parseado no tiene la estructura esperada:", jsonData);
            throw new Error("La estructura del JSON recibido de la API es incorrecta.");
        }
         if (!jsonData.options.every(opt => opt && opt.id && opt.text) || !jsonData.options.every(opt => jsonData.feedback.hasOwnProperty(opt.id))) {
             console.error("Estructura interna de opciones o feedback incorrecta:", jsonData);
             throw new Error("Las opciones o el feedback en el JSON recibido tienen formato incorrecto.");
         }


        console.log("JSON parseado correctamente:", jsonData); // Log para depuración
        // Envía la respuesta JSON parseada al cliente
        res.status(200).json(jsonData);

    } catch (error) {
        console.error('Error al generar dilema con Gemini:', error);
        // Devuelve un error genérico al cliente por seguridad, pero loguea el detalle.
        res.status(500).json({ error: `Error al comunicarse con la API de IA. ${error.message}` });
    }
}
