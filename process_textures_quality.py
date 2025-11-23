"""
Script mejorado para procesar texturas sin degradar la calidad de la imagen.
Solo elimina fondos blancos puros y recorta el espacio vacío.
"""

from PIL import Image
import numpy as np
import os

def process_texture_image_quality(input_path, output_dir, prefix, white_threshold=245):
    """
    Procesa una imagen de texturas dividiéndola en 4 tiles individuales (2x2),
    eliminando SOLO el fondo blanco puro y recortando el espacio no usado.
    
    Esta versión preserva la calidad de la imagen y no toca píxeles semi-transparentes
    ni detalles suaves.
    
    Args:
        input_path: Ruta de la imagen de entrada
        output_dir: Directorio de salida
        prefix: Prefijo para los archivos de salida
        white_threshold: Valor RGB por encima del cual se considera blanco puro (0-255)
    """
    print(f"\n📦 Procesando: {os.path.basename(input_path)}")
    
    # Crear directorio de salida si no existe
    os.makedirs(output_dir, exist_ok=True)
    
    # Cargar imagen
    img = Image.open(input_path).convert('RGBA')
    width, height = img.size
    data = np.array(img, dtype=np.uint8)
    
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
            r = tile_data[:,:,0].astype(np.int16)
            g = tile_data[:,:,1].astype(np.int16)
            b = tile_data[:,:,2].astype(np.int16)
            a = tile_data[:,:,3].astype(np.int16)
            
            # SOLO eliminar píxeles BLANCOS PUROS con alpha alto
            # Criterio muy estricto: R, G, B todos >= threshold Y alpha alto
            is_pure_white = (r >= white_threshold) & (g >= white_threshold) & (b >= white_threshold) & (a >= 250)
            
            # Crear nueva capa alpha: mantener todo excepto blanco puro
            new_alpha = a.copy()
            new_alpha[is_pure_white] = 0
            
            # Aplicar el nuevo alpha (sin suavizado para preservar calidad)
            tile_data[:,:,3] = new_alpha.astype(np.uint8)
            
            # Crear imagen
            tile_img = Image.fromarray(tile_data, 'RGBA')
            
            # Recortar espacio vacío (auto-crop)
            bbox = tile_img.getbbox()
            
            if bbox:
                # Recortar
                cropped_img = tile_img.crop(bbox)
                
                # Agregar un pequeño padding
                padding = 2
                padded_img = Image.new('RGBA', 
                                       (cropped_img.width + padding * 2, 
                                        cropped_img.height + padding * 2), 
                                       (0, 0, 0, 0))
                padded_img.paste(cropped_img, (padding, padding))
                
                # Generar nombre de archivo
                output_filename = f"{prefix}_{tile_index + 1}.png"
                output_path = os.path.join(output_dir, output_filename)
                
                # Guardar con máxima calidad
                padded_img.save(output_path, 'PNG', optimize=False, compress_level=1)
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
    print("🎨 PROCESADOR DE TEXTURAS - ALTA CALIDAD (SIN DEGRADACIÓN)")
    print("=" * 70)
    
    # Definir las imágenes a procesar
    textures = [
        {
            'path': 'public/assets/textures/899b3a5e-5930-4543-83c3-96904e72779d.png',
            'output_dir': 'extracted_tiles_hq/texture_1',
            'prefix': 'tile_899b3a5e'
        },
        {
            'path': 'public/assets/textures/d4dcad8f-f14f-4c28-9782-98de379db02e.png',
            'output_dir': 'extracted_tiles_hq/texture_2',
            'prefix': 'tile_d4dcad8f'
        },
        {
            'path': 'public/assets/textures/ChatGPT Image Nov 22, 2025, 09_42_25 PM.png',
            'output_dir': 'extracted_tiles_hq/chatgpt_09_42_25',
            'prefix': 'tile_chatgpt_42'
        },
        {
            'path': 'public/assets/textures/ChatGPT Image Nov 22, 2025, 09_45_56 PM.png',
            'output_dir': 'extracted_tiles_hq/chatgpt_09_45_56',
            'prefix': 'tile_chatgpt_45'
        },
        {
            'path': 'public/assets/textures/soldado razo 1.png',
            'output_dir': 'extracted_tiles_hq/soldado_razo',
            'prefix': 'tile_soldado'
        }
    ]
    
    all_extracted = []
    
    for texture in textures:
        try:
            extracted = process_texture_image_quality(
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
    print(f"   Guardados en: extracted_tiles_hq/")
    print("=" * 70)
    
    # Listar archivos generados
    if all_extracted:
        print("\n📁 Archivos generados:")
        for file_path in all_extracted:
            print(f"   - {file_path}")


if __name__ == "__main__":
    main()
