// script.js (Versión 2.4 - Final, Completa y Verificada)

// --- Constantes y Elementos del DOM ---
const API_URL = "http://127.0.0.1:8000/analizar-imagen-compleja/";

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

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(header + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    const date = new Date();
    const batchId = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    link.setAttribute("download", `datos_fitopatologicos_completos_${batchId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- Lógica de Análisis ---
analyzeButton.addEventListener('click', async () => {
    if (imageFiles.length === 0) return;

    initialMessage.style.display = 'none';
    resultsContent.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    analyzeButton.disabled = true;

    const allResults = [];
    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const formData = new FormData();
        formData.append("file", file);
        try {
            const response = await fetch(API_URL, { method: 'POST', body: formData });
            const data = await response.json();
            if (!response.ok) { throw new Error(data.detail || 'Error en el servidor'); }
            
            data.resultados_individuales.forEach(leafResult => {
                allResults.push({
                    fileName: `${data.nombre_archivo} (Hoja ${leafResult.hoja_id})`,
                    areaDamage: leafResult.area_afectada_pct,
                    lesionCount: leafResult.conteo_lesiones,
                    diseaseGrade: getDiseaseGrade(leafResult.area_afectada_pct),
                    processedImage: leafResult.imagen_procesada,
                    error: leafResult.error ? true : false,
                    errorMessage: leafResult.error
                });
            });
        } catch (error) {
            allResults.push({ fileName: file.name, error: true, errorMessage: error.message });
        }
        const percentage = Math.round(((i + 1) / imageFiles.length) * 100);
        progressBar.style.width = `${percentage}%`;
        progressLabel.textContent = `Analizando muestra ${i + 1} de ${imageFiles.length}...`;
    }

    lastAnalysisResults = allResults;
    progressContainer.classList.add('hidden');

    const validResults = allResults.filter(r => !r.error);
    if (validResults.length > 0) {
        await appendDataToLocalFile(validResults);
        const summaryStats = calculateSummaryStats(validResults);
        displaySummary(summaryStats);
        createCharts(validResults);
    } else {
        initialMessage.innerHTML = `<p class="text-red-500 font-semibold">Análisis fallido.</p><p class="text-sm">No se pudo procesar ninguna imagen.</p>`;
        initialMessage.style.display = 'block';
    }

    displayDataTable(allResults);
    resultsContent.classList.remove('hidden');
    downloadDataCSVButton.classList.remove('hidden');
    document.getElementById('tab-summary').click();
    
    analyzeButton.disabled = false;
    imageFiles = [];
    previewsContainerWrapper.classList.add('hidden');
});

// --- Funciones de Visualización y Epidemiología ---
function displaySummary(stats) {
    const container = document.getElementById('content-summary');
    container.innerHTML = `
        <h3 class="text-xl font-bold text-gray-800 text-center">Resumen del Lote</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-blue-50 p-4 rounded-lg text-center border"><p class="text-sm font-semibold">Incidencia (Hojas Afectadas)</p><p class="text-4xl font-bold">${stats.incidence.toFixed(1)}%</p></div>
            <div class="bg-red-50 p-4 rounded-lg text-center border"><p class="text-sm font-semibold">Severidad Promedio</p><p class="text-4xl font-bold">${stats.averageSeverity.toFixed(1)}%</p></div>
        </div>
    `;
}

function displayDataTable(results) {
    const container = document.getElementById('content-data');
    let tableHTML = `
        <div class="overflow-x-auto"><table class="min-w-full divide-y">
            <thead class="bg-gray-50"><tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Muestra (Hoja Individual)</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Área Afectada (%)</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Grado (0-5)</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Visualización / Estado</th>
            </tr></thead><tbody class="bg-white divide-y">`;
    results.forEach(res => {
        if (res.error) {
            tableHTML += `<tr><td class="px-4 py-3" title="${res.fileName}">${res.fileName}</td><td class="px-4 py-3 text-center text-red-600 font-semibold" colspan="3">Error: ${res.errorMessage || 'Desconocido'}</td></tr>`;
        } else {
            tableHTML += `<tr>
                <td class="px-4 py-3" title="${res.fileName}">${res.fileName}</td>
                <td class="px-4 py-3 font-semibold">${res.areaDamage.toFixed(2)}%</td>
                <td class="px-4 py-3">${res.diseaseGrade}</td>
                <td class="px-4 py-3"><img src="data:image/jpeg;base64,${res.processedImage}" alt="Análisis de ${res.fileName}" class="h-16 w-16 object-cover rounded-md border"/></td>
            </tr>`;
        }
    });
    tableHTML += `</tbody></table></div>`;
    container.innerHTML = tableHTML;
}

function createCharts(results) {
    const container = document.getElementById('content-charts');
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="relative p-2 border rounded-lg bg-white chart-container"><canvas id="damageBarChart"></canvas></div>
            <div class="relative p-2 border rounded-lg bg-white chart-container"><canvas id="scatterPlot"></canvas></div>
        </div>
    `;
    new Chart(document.getElementById('damageBarChart').getContext('2d'), { type: 'bar', data: { labels: results.map(r => r.fileName), datasets: [{ label: 'Área Afectada (%)', data: results.map(r => r.areaDamage), backgroundColor: 'rgba(239, 68, 68, 0.6)' }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    new Chart(document.getElementById('scatterPlot').getContext('2d'), { type: 'scatter', data: { datasets: [{ label: 'Hojas', data: results.map(r => ({ x: r.areaDamage, y: r.lesionCount })), backgroundColor: 'rgba(59, 130, 246, 0.7)' }] }, options: { maintainAspectRatio: false, scales: { x: { title: { display: true, text: '% Área Afectada' } }, y: { title: { display: true, text: '# Lesiones' } } } } });
}

function getDiseaseGrade(areaDamage) {
    if (areaDamage === undefined) return 'N/A';
    if (areaDamage === 0) return 0;
    if (areaDamage <= 5) return 1;
    if (areaDamage <= 25) return 2;
    if (areaDamage <= 50) return 3;
    if (areaDamage <= 75) return 4;
    return 5;
}

function calculateSummaryStats(results) {
    const n = results.length;
    if (n === 0) return { incidence: 0, averageSeverity: 0 };
    const diseasedLeaves = results.filter(r => r.areaDamage > 0);
    const incidence = (diseasedLeaves.length / n) * 100;
    const totalSeverity = results.reduce((sum, r) => sum + r.areaDamage, 0);
    const averageSeverity = totalSeverity / n;
    return { incidence, averageSeverity };
}

