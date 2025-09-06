# main.py (Versión 2.4 - Final y Verificada)
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Tuple
import numpy as np
import cv2
import base64

# --- CONFIGURACIÓN ---
VISUALIZATION_ALPHA = 0.4 # Transparencia del filtro rojo

# --- Inicialización de la Aplicación FastAPI ---
app = FastAPI(
    title="API de Diagnóstico Fitopatológico con Detección por Contornos",
    version="2.4.0"
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- LÓGICA DEL PIPELINE ---

def detect_leaves(img_bgr: np.ndarray) -> List[Tuple[int, int, int, int]]:
    """
    ETAPA 1: Usa algoritmos de contornos para detectar objetos similares a hojas.
    """
    img_gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    img_blur = cv2.GaussianBlur(img_gray, (7, 7), 0)
    _, thresh = cv2.threshold(img_blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = np.ones((5, 5), np.uint8)
    thresh_cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(thresh_cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    detected_boxes = []
    min_area = (img_bgr.shape[0] * img_bgr.shape[1]) * 0.01
    for contour in contours:
        area = cv2.contourArea(contour)
        if area > min_area:
            x, y, w, h = cv2.boundingRect(contour)
            detected_boxes.append((x, y, w, h))
    print(f"Detector de contornos encontró {len(detected_boxes)} objetos.")
    return detected_boxes

def analyze_single_leaf(leaf_image: np.ndarray) -> Dict:
    """
    ETAPA 2: Analiza UNA SOLA hoja, calcula ambas métricas y genera una visualización con filtro rojo.
    """
    try:
        if leaf_image.size == 0:
            return {"error": "La hoja recortada está vacía."}
        img_hls = cv2.cvtColor(leaf_image, cv2.COLOR_BGR2HLS)
        healthy_mask = cv2.inRange(img_hls, (39, 51, 25), (89, 255, 255))
        damaged_mask = cv2.inRange(img_hls, (10, 51, 25), (36, 255, 255))
        damaged_pixels = cv2.countNonZero(damaged_mask)
        healthy_pixels = cv2.countNonZero(healthy_mask)
        total_pixels = damaged_pixels + healthy_pixels
        if total_pixels == 0:
            return {"error": "No se detectó tejido en la hoja recortada."}
        area_damage = (damaged_pixels / total_pixels) * 100
        num_labels, _, _, _ = cv2.connectedComponentsWithStats(damaged_mask, 4, cv2.CV_32S)
        lesion_count = num_labels - 1
        overlay = leaf_image.copy()
        overlay[damaged_mask == 255] = [0, 0, 255]
        visual_image = cv2.addWeighted(overlay, VISUALIZATION_ALPHA, leaf_image, 1 - VISUALIZATION_ALPHA, 0)
        _, buffer = cv2.imencode('.jpg', visual_image)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        return {
            "area_afectada_pct": round(area_damage, 2),
            "conteo_lesiones": lesion_count,
            "imagen_procesada": image_base64
        }
    except cv2.error:
        return {"error": "Error de OpenCV. La hoja recortada podría ser muy pequeña."}

# --- Endpoint Principal ---
@app.post("/analizar-imagen-compleja/", tags=["Análisis Avanzado"])
async def analizar_imagen_compleja(file: UploadFile = File(...)):
    image_bytes = await file.read()
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="No se pudo decodificar la imagen.")
    detected_boxes = detect_leaves(img_bgr)
    if not detected_boxes:
        raise HTTPException(status_code=404, detail="No se detectaron hojas en la imagen.")
    results_per_leaf = []
    for i, (x, y, w, h) in enumerate(detected_boxes):
        if w > 0 and h > 0:
            single_leaf_img = img_bgr[y:y+h, x:x+w]
            analysis = analyze_single_leaf(single_leaf_img)
            results_per_leaf.append({ "hoja_id": i + 1, **analysis })
    return {
        "nombre_archivo": file.filename,
        "numero_hojas_detectadas": len(detected_boxes),
        "resultados_individuales": results_per_leaf
    }
    
