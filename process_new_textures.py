"""
Script para procesar las tres nuevas imágenes de texturas y dividirlas en 4 tiles individuales cada una,
eliminando el fondo y el espacio no usado.
"""

from PIL import Image
import numpy as np
import os

def process_texture_image(input_path, output_dir, prefix, threshold=250, tolerance=10):
    """
    Procesa una imagen de texturas dividiéndola en 4 tiles individuales (2x2),
    eliminando el fondo blanco/transparente y recortando el espacio no usado.
    
    Args:
        input_path: Ruta de la imagen de entrada
        output_dir: Directorio de salida
        prefix: Prefijo para los archivos de salida
        threshold: Valor RGB por encima del cual se considera blanco (0-255)
        tolerance: Tolerancia para detectar píxeles casi blancos
    """
    print(f"\n📦 Procesando: {os.path.basename(input_path)}")
    
    # Crear directorio de salida si no existe
    os.makedirs(output_dir, exist_ok=True)
    
    # Cargar imagen
    img = Image.open(input_path).convert('RGBA')
    width, height = img.size
    data = np.array(img, dtype=np.float32)
    
    print(f"   Dimensiones: {width}x{height}")
    
    # Dividir en cuadrícula 2x2
    cols = 2
    rows = 2
    
    tile_width = width // cols
    tile_height = height // rows
    
    print(f"   Cuadrícula: {cols}x{rows}")
    print(f"   Tamaño de cada celda: {tile_width}x{tile_height}\n")
    
    extracted_files = []
    tile_index = 0
    
    # Extraer cada celda
    for row in range(rows):
        for col in range(cols):
            # Calcular región
            x1 = col * tile_width
            y1 = row * tile_height
            x2 = x1 + tile_width
            y2 = y1 + tile_height
            
            # Extraer región
            tile_data = data[y1:y2, x1:x2].copy()
            
            # Separar canales
            r, g, b, a = tile_data[:,:,0], tile_data[:,:,1], tile_data[:,:,2], tile_data[:,:,3]
            
            # Detectar píxeles blancos o casi blancos
            is_white = (r >= threshold - tolerance) & (g >= threshold - tolerance) & (b >= threshold - tolerance)
            
            # También considerar píxeles muy claros
            avg_brightness = (r + g + b) / 3
            is_very_light = avg_brightness >= threshold
            
            # Combinar criterios: si es blanco Y tiene alpha alto, hacerlo transparente
            should_be_transparent = (is_white | is_very_light) & (a > 200)
            
            # Hacer transparentes los píxeles blancos
            new_alpha = a.copy()
            new_alpha[should_be_transparent] = 0
            
            # Suavizar los bordes: reducir alpha de píxeles semi-transparentes cerca de blancos
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
            tile_data[:,:,3] = new_alpha
            
            # Convertir de vuelta a uint8
            tile_data = np.clip(tile_data, 0, 255).astype(np.uint8)
            
            # Crear imagen limpia
            tile_img = Image.fromarray(tile_data, 'RGBA')
            
            # Recortar espacio vacío (auto-crop)
            bbox = tile_img.getbbox()
            
            if bbox:
                # Recortar
                cropped_img = tile_img.crop(bbox)
                
                # Agregar un pequeño padding para que no quede pegado al borde
                padding = 2
                padded_img = Image.new('RGBA', 
                                       (cropped_img.width + padding * 2, 
                                        cropped_img.height + padding * 2), 
                                       (0, 0, 0, 0))
                padded_img.paste(cropped_img, (padding, padding))
                
                # Generar nombre de archivo
                output_filename = f"{prefix}_{tile_index + 1}.png"
                output_path = os.path.join(output_dir, output_filename)
                
                # Guardar
                padded_img.save(output_path, 'PNG')
                extracted_files.append(output_path)
                
                original_size = f"{tile_width}x{tile_height}"
                new_size = f"{padded_img.width}x{padded_img.height}"
                print(f"   ✅ Tile {tile_index + 1}: {output_filename}")
                print(f"      {original_size} → {new_size}")
            else:
                print(f"   ⏭️  Tile {tile_index + 1}: vacío, omitiendo")
            
            tile_index += 1
    
    return extracted_files


def main():
    print("=" * 70)
    print("🎨 PROCESADOR DE TEXTURAS - DIVISIÓN EN TILES INDIVIDUALES")
    print("=" * 70)
    
    # Definir las nuevas imágenes a procesar
    textures = [
        {
            'path': 'public/assets/textures/ChatGPT Image Nov 22, 2025, 09_42_25 PM.png',
            'output_dir': 'extracted_tiles/chatgpt_09_42_25',
            'prefix': 'tile_chatgpt_42'
        },
        {
            'path': 'public/assets/textures/ChatGPT Image Nov 22, 2025, 09_45_56 PM.png',
            'output_dir': 'extracted_tiles/chatgpt_09_45_56',
            'prefix': 'tile_chatgpt_45'
        },
        {
            'path': 'public/assets/textures/soldado razo 1.png',
            'output_dir': 'extracted_tiles/soldado_razo',
            'prefix': 'tile_soldado'
        }
    ]
    
    all_extracted = []
    
    for texture in textures:
        try:
            extracted = process_texture_image(
                texture['path'],
                texture['output_dir'],
                texture['prefix']
            )
            all_extracted.extend(extracted)
        except Exception as e:
            print(f"\n❌ Error procesando {texture['path']}: {e}")
    
    print("\n" + "=" * 70)
    print(f"✨ ¡Proceso completado!")
    print(f"   Total de tiles extraídos: {len(all_extracted)}")
    print(f"   Guardados en: extracted_tiles/")
    print("=" * 70)
    
    # Listar archivos generados
    if all_extracted:
        print("\n📁 Archivos generados:")
        for file_path in all_extracted:
            print(f"   - {file_path}")


if __name__ == "__main__":
    main()
