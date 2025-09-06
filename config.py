# config.py
# Archivo de configuración para los parámetros del análisis de imágenes.

# --- Parámetros Generales ---
# Dimensión máxima a la que se redimensionará la imagen para estandarizar el análisis.
MAX_DIM = 500

# --- Rangos de Color HLS (Hue, Lightness, Saturation) ---
# Estos rangos definen qué se considera tejido sano vs. dañado.
# Deben ajustarse según el tipo de planta, enfermedad y condiciones de luz.

# Rango para tejido dañado (colores amarillos/marrones)
HLS_DAMAGED_LOWER = (10, 51, 25)
HLS_DAMAGED_UPPER = (36, 255, 255)

# Rango para tejido sano (colores verdes)
HLS_HEALTHY_LOWER = (39, 51, 25)
HLS_HEALTHY_UPPER = (89, 255, 255)

# Rango para identificar y excluir el fondo de la imagen
# Se basa en umbrales de Saturación (S) y Luminosidad (L)
BACKGROUND_S_LOWER_THRESHOLD = 51
BACKGROUND_L_LOWER_THRESHOLD = 25
BACKGROUND_L_UPPER_THRESHOLD = 242