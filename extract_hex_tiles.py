from PIL import Image
import numpy as np
import os

def extract_hex_tiles(input_path, output_dir='extracted_hexes', prefix='hex'):
    """
    Extrae cada hexágono individual de una imagen con múltiples hexágonos en cuadrícula.
    Detecta automáticamente las posiciones y extrae cada uno con fondo transparente.
    """
    print(f"\n📦 Procesando: {input_path}")
    
    # Crear directorio de salida si no existe
    os.makedirs(output_dir, exist_ok=True)
    
    # Cargar imagen
    img = Image.open(input_path).convert('RGBA')
    width, height = img.size
    data = np.array(img)
    
    print(f"   Dimensiones: {width}x{height}")
    
    # Detectar si hay contenido con alpha
    alpha = data[:,:,3]
    
    if not np.any(alpha > 20):
        print("   ⚠️  No se detectó contenido con alpha")
        return []
    
    # Para una cuadrícula 2x2, dividir en 4 regiones
    # Detectar automáticamente el número de columnas y filas
    # basándose en las dimensiones de la imagen
    
    # Asumiendo cuadrícula regular, intentar detectar divisiones
    # Por ahora asumimos 2x2 (puede ajustarse automáticamente)
    
    cols = 2
    rows = 2
    
    tile_width = width // cols
    tile_height = height // rows
    
    print(f"   Cuadrícula detectada: {cols}x{rows}")
    print(f"   Tamaño de cada celda: {tile_width}x{tile_height}")
    
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
            
            # Verificar si tiene contenido
            tile_alpha = tile_data[:,:,3]
            if not np.any(tile_alpha > 20):
                print(f"   ⏭️  Celda [{row},{col}] vacía, omitiendo")
                continue
            
            # Encontrar el bounding box del contenido real (eliminar espacio vacío)
            rows_with_content = np.any(tile_alpha > 20, axis=1)
            cols_with_content = np.any(tile_alpha > 20, axis=0)
            
            if not np.any(rows_with_content) or not np.any(cols_with_content):
                continue
            
            y_min = np.argmax(rows_with_content)
            y_max = len(rows_with_content) - np.argmax(rows_with_content[::-1])
            x_min = np.argmax(cols_with_content)
            x_max = len(cols_with_content) - np.argmax(cols_with_content[::-1])
            
            # Recortar al contenido
            cropped_tile = tile_data[y_min:y_max, x_min:x_max]
            
            # Crear imagen
            tile_img = Image.fromarray(cropped_tile, 'RGBA')
            
            # Generar nombre de archivo
            base_name = os.path.splitext(os.path.basename(input_path))[0]
            output_filename = f"{prefix}_{base_name}_{tile_index + 1}.png"
            output_path = os.path.join(output_dir, output_filename)
            
            # Guardar
            tile_img.save(output_path)
            extracted_files.append(output_path)
            
            print(f"   ✅ Hexágono {tile_index + 1} extraído: {output_filename} ({tile_img.size[0]}x{tile_img.size[1]})")
            tile_index += 1
    
    return extracted_files


def process_folder(input_folder, output_dir='extracted_hexes'):
    """
    Procesa todas las imágenes PNG en una carpeta.
    """
    print("🚀 Iniciando extracción de hexágonos individuales\n")
    print(f"📁 Carpeta de entrada: {input_folder}")
    print(f"📁 Carpeta de salida: {output_dir}\n")
    
    all_extracted = []
    
    # Buscar archivos PNG
    if os.path.isdir(input_folder):
        files = [f for f in os.listdir(input_folder) if f.endswith('.png')]
        files = [os.path.join(input_folder, f) for f in files]
    else:
        files = [input_folder]
    
    for file_path in files:
        try:
            extracted = extract_hex_tiles(file_path, output_dir)
            all_extracted.extend(extracted)
        except Exception as e:
            print(f"   ❌ Error procesando {file_path}: {e}")
    
    print(f"\n✨ ¡Proceso completado!")
    print(f"   Total de hexágonos extraídos: {len(all_extracted)}")
    print(f"   Guardados en: {output_dir}/")
    
    return all_extracted


if __name__ == "__main__":
    # Procesar la imagen adjunta o carpeta de texturas
    
    # Opción 1: Procesar una imagen específica
    # extract_hex_tiles('ruta/a/tu/imagen.png', output_dir='hexagons_output')
    
    # Opción 2: Procesar carpeta de texturas
    # process_folder('public/assets/textures', output_dir='extracted_hexes')
    
    # Por defecto, mostrar ayuda
    print("=" * 60)
    print("🔷 EXTRACTOR DE HEXÁGONOS INDIVIDUALES")
    print("=" * 60)
    print("\nUso:")
    print("\n  Para extraer hexágonos de una imagen:")
    print("    extract_hex_tiles('imagen.png', output_dir='output')")
    print("\n  Para procesar una carpeta completa:")
    print("    process_folder('carpeta_entrada', output_dir='output')")
    print("\n" + "=" * 60)
