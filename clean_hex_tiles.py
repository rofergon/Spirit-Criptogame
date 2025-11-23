"""
Script para limpiar hexágonos: eliminar fondo blanco, recortar espacio vacío
y asegurar bordes limpios sin artefactos.
"""

from PIL import Image
import numpy as np
import os

def clean_hex_tile(input_path, output_path=None, threshold=250, tolerance=10):
    """
    Limpia un hexágono individual:
    - Convierte píxeles blancos/casi blancos a transparentes
    - Recorta el espacio vacío
    - Suaviza bordes para evitar artefactos
    
    Args:
        input_path: Ruta de la imagen de entrada
        output_path: Ruta de salida (si es None, sobrescribe la entrada)
        threshold: Valor RGB por encima del cual se considera blanco (0-255)
        tolerance: Tolerancia para detectar píxeles casi blancos
    """
    if output_path is None:
        output_path = input_path
    
    # Cargar imagen
    img = Image.open(input_path).convert('RGBA')
    data = np.array(img, dtype=np.float32)
    
    width, height = img.size
    
    # Separar canales
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    
    # Detectar píxeles blancos o casi blancos
    # Un píxel es "blanco" si R, G y B son altos
    is_white = (r >= threshold - tolerance) & (g >= threshold - tolerance) & (b >= threshold - tolerance)
    
    # También considerar píxeles muy claros que podrían ser bordes mal recortados
    avg_brightness = (r + g + b) / 3
    is_very_light = avg_brightness >= threshold
    
    # Combinar criterios: si es blanco Y tiene alpha alto, hacerlo transparente
    should_be_transparent = (is_white | is_very_light) & (a > 200)
    
    # Hacer transparentes los píxeles blancos
    new_alpha = a.copy()
    new_alpha[should_be_transparent] = 0
    
    # Suavizar los bordes: reducir alpha de píxeles semi-transparentes cerca de blancos
    # Esto elimina "halos" o bordes extraños
    for _ in range(2):  # 2 pasadas de suavizado
        # Detectar píxeles en el borde (tienen vecinos transparentes)
        padded_alpha = np.pad(new_alpha, 1, mode='constant', constant_values=0)
        
        # Contar vecinos transparentes
        neighbors_transparent = (
            (padded_alpha[:-2, 1:-1] < 50) +  # arriba
            (padded_alpha[2:, 1:-1] < 50) +   # abajo
            (padded_alpha[1:-1, :-2] < 50) +  # izquierda
            (padded_alpha[1:-1, 2:] < 50)     # derecha
        )
        
        # Si un píxel tiene vecinos transparentes y es claro, reducir su alpha
        is_edge = neighbors_transparent > 0
        is_light_edge = is_edge & (avg_brightness > 200) & (new_alpha > 0)
        new_alpha[is_light_edge] = np.minimum(new_alpha[is_light_edge], 100)
    
    # Aplicar el nuevo alpha
    data[:,:,3] = new_alpha
    
    # Convertir de vuelta a uint8
    data = np.clip(data, 0, 255).astype(np.uint8)
    
    # Crear imagen limpia
    clean_img = Image.fromarray(data, 'RGBA')
    
    # Recortar espacio vacío (auto-crop)
    bbox = clean_img.getbbox()
    
    if bbox:
        # Recortar
        cropped_img = clean_img.crop(bbox)
        
        # Agregar un pequeño padding para que no quede pegado al borde
        padding = 2
        padded_img = Image.new('RGBA', 
                               (cropped_img.width + padding * 2, 
                                cropped_img.height + padding * 2), 
                               (0, 0, 0, 0))
        padded_img.paste(cropped_img, (padding, padding))
        
        # Guardar
        padded_img.save(output_path, 'PNG')
        
        original_size = f"{width}x{height}"
        new_size = f"{padded_img.width}x{padded_img.height}"
        return original_size, new_size
    else:
        # Imagen vacía, guardar como está
        clean_img.save(output_path, 'PNG')
        return f"{width}x{height}", "vacía"


def clean_folder(input_folder, output_folder=None):
    """
    Limpia todos los PNG en una carpeta.
    Si output_folder es None, sobrescribe los archivos originales.
    """
    if output_folder:
        os.makedirs(output_folder, exist_ok=True)
    
    print("🧹 Limpiando hexágonos...\n")
    
    files = [f for f in os.listdir(input_folder) if f.endswith('.png')]
    
    if not files:
        print(f"❌ No se encontraron archivos PNG en {input_folder}")
        return
    
    for filename in files:
        input_path = os.path.join(input_folder, filename)
        output_path = os.path.join(output_folder or input_folder, filename)
        
        try:
            original_size, new_size = clean_hex_tile(input_path, output_path)
            print(f"✅ {filename}")
            print(f"   {original_size} → {new_size}")
        except Exception as e:
            print(f"❌ Error en {filename}: {e}")
    
    print(f"\n✨ ¡Limpieza completada!")
    print(f"📁 Archivos guardados en: {output_folder or input_folder}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Modo: procesar carpeta especificada
        input_folder = sys.argv[1]
        output_folder = sys.argv[2] if len(sys.argv) > 2 else None
        clean_folder(input_folder, output_folder)
    else:
        # Modo por defecto: limpiar extracted_grass_hexes
        clean_folder('extracted_grass_hexes')
