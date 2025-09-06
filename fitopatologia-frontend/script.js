// script.js (Versión 2.5 - Final para Despliegue Web)

// --- Constantes y Elementos del DOM ---
// ¡CAMBIO CRUCIAL! Reemplaza la URL de abajo con la URL pública de tu servidor de Render.
const API_URL = "https://api-fitopatologia.onrender.com/analizar-imagen-compleja/";

const fileLoader = document.getElementById('fileLoader');
const analyzeButton = document.getElementById('analyzeButton');
const previewsContainer = document.getElementById('previewsContainer');
const previewsContainerWrapper = document.getElementById('previewsContainerWrapper');
const previewsHeader = document.getElementById('previewsHeader');
const initialMessage = document.getElementById('initial-message');
const resultsContent = document.getElementById('results-content');
const downloadDataCSVButton = document.getElementById('downloadDataCSV');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');
const progressPercentage = document.getElementById('progress-percentage');
const selectFolderButton = document.getElementById('select-folder-button');
const folderStatus = document.getElementById('folder-status');

let imageFiles = [];
let lastAnalysisResults = [];
let directoryHandle = null;

// --- Lógica de Pestañas ---
const tabs = document.querySelectorAll('.tab-button');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        document.getElementById('content-' + tab.id.split('-')[1]).classList.add('active');
    });
});

// --- Lógica de Carga de Archivos ---
fileLoader.addEventListener('change', e => handleFiles(e.target.files));
document.querySelector('label[for="fileLoader"]').addEventListener('click', (e) => {
    e.preventDefault();
    fileLoader.click();
});

function handleFiles(files) {
    imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    previewsContainer.innerHTML = '';
    
    if (imageFiles.length === 0) {
        analyzeButton.disabled = true;
        previewsContainerWrapper.classList.add('hidden');
        return;
    }

    previewsContainerWrapper.classList.remove('hidden');
    previewsHeader.textContent = `${imageFiles.length} muestras cargadas:`;
    imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'w-full h-20 object-cover rounded-md border';
            img.title = file.name;
            previewsContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
    
    analyzeButton.disabled = false;
}

// --- Lógica de Guardado y Descarga ---
selectFolderButton.addEventListener('click', async () => {
    try {
        directoryHandle = await window.showDirectoryPicker();
        folderStatus.textContent = `Registrando en: ${directoryHandle.name}`;
        folderStatus.classList.remove('text-red-500');
        folderStatus.classList.add('text-green-600');
    } catch (err) {
        folderStatus.textContent = 'Selección de carpeta cancelada.';
        folderStatus.classList.remove('text-green-600');
    }
});

async function appendDataToLocalFile(results) {
    if (!directoryHandle) return;
    try {
        const fileHandle = await directoryHandle.getFileHandle('historial_analisis.csv', { create: true });
        const file = await fileHandle.getFile();
        const writable = await fileHandle.createWritable({ keepExistingData: true });
        if (file.size === 0) {
            await writable.write("Fecha,Muestra,Area Afectada (%),Numero Lesiones,Grado (0-5)\n");
        }
        await writable.seek(file.size);
        const timestamp = new Date().toISOString();
        const rows = results.map(res =>
            `${timestamp},"${res.fileName}",${res.areaDamage.toFixed(2)},${res.lesionCount},${res.diseaseGrade}`
        ).join("\n");
        await writable.write(rows + "\n");
        await writable.close();
    } catch (err) {
        console.error("Error al guardar datos automáticamente:", err);
    }
}

downloadDataCSVButton.addEventListener('click', () => {
    const validResults = lastAnalysisResults.filter(res => !res.error);
    if (validResults.length === 0) return;

    const header = "Muestra,Area Afectada (%),Numero Lesiones,Grado (0-5)\n";
    const rows = validResults.map(res =>
        `"${res.fileName}",${res.areaDamage.toFixed(2)},${res.lesionCount},${res.diseaseGrade}`
    ).join("\n");

    const csvContent = "data:text/csv;

