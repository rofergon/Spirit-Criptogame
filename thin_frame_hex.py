"""
Script para reducir el grosor de los marcos en texturas hexagonales mediante escalado.
Escala el marco hacia adentro manteniendo su forma hexagonal.
"""

from PIL import Image
import numpy as np
from scipy.ndimage import distance_transform_edt, map_coordinates
import os

def thin_hex_frame(input_path, output_path, frame_shrink_pixels=3):
    """
    Reduce el grosor del marco de una textura hexagonal escalando hacia adentro.
    
    Args:
        input_path: Ruta de la imagen de entrada
        output_path: Ruta donde guardar la imagen procesada
        frame_shrink_pixels: Píxeles a reducir del ancho del marco (3-5 recomendado)
    """
    # Cargar imagen
    img = Image.open(input_path).convert('RGBA')
    img_array = np.array(img, dtype=np.float32)
    height, width = img_array.shape[:2]
    
    # Extraer canal alpha
    alpha = img_array[:, :, 3]
    
    # Calcular el centro de la imagen
    center_y, center_x = height / 2, width / 2
    
    # Crear máscara del marco (píxeles con alpha > 0)
    frame_mask = alpha > 0
    
    # Calcular la distancia desde el borde externo hacia adentro
    # usando el campo de distancia
    distance_from_edge = distance_transform_edt(frame_mask)
    
    # Encontrar el grosor máximo del marco
    max_distance = distance_from_edge.max()
    
    # Crear nueva imagen
    new_img_array = np.zeros_like(img_array)
    
    # Para cada píxel, calcular su posición escalada
    for i in range(height):
        for j in range(width):
            if not frame_mask[i, j]:
                continue
            
            # Vector desde el centro hacia el píxel actual
            dy = i - center_y
            dx = j - center_x
            
            # Distancia al centro
            dist_to_center = np.sqrt(dx*dx + dy*dy)
            
            if dist_to_center < 1e-6:
                # Píxel en el centro
                new_img_array[i, j] = img_array[i, j]
                continue
            
            # Calcular qué tan cerca está del borde externo
            # distance_from_edge alto = cerca del centro
            # distance_from_edge bajo = cerca del borde
            distance_ratio = distance_from_edge[i, j] / max_distance if max_distance > 0 else 0
            
            # Solo desplazar píxeles del marco (no del área central)
            # El área central tiene distance_from_edge alto
            if distance_from_edge[i, j] > frame_shrink_pixels:
                # Es parte del área de relleno, mantener
                new_img_array[i, j] = img_array[i, j]
            else:
                # Es parte del marco, escalar hacia adentro
                # Desplazamiento proporcional a qué tan cerca está del borde
                shrink_factor = (distance_from_edge[i, j] / frame_shrink_pixels)
                
                # Escalar hacia el centro
                displacement = frame_shrink_pixels * (1 - shrink_factor)
                
                # Nueva posición (empujando hacia el centro)
                new_dy = dy * (1 - displacement / dist_to_center) if dist_to_center > 0 else dy
                new_dx = dx * (1 - displacement / dist_to_center) if dist_to_center > 0 else dx
                
                source_y = center_y + new_dy
                source_x = center_x + new_dx
                
                # Interpolar el valor desde la posición original
                if 0 <= source_y < height-1 and 0 <= source_x < width-1:
                    # Interpolación bilineal
                    y0, x0 = int(source_y), int(source_x)
                    y1, x1 = y0 + 1, x0 + 1
                    
                    fy, fx = source_y - y0, source_x - x0
                    
                    # Interpolar cada canal
                    for c in range(4):
                        val = (img_array[y0, x0, c] * (1-fy) * (1-fx) +
                               img_array[y0, x1, c] * (1-fy) * fx +
                               img_array[y1, x0, c] * fy * (1-fx) +
                               img_array[y1, x1, c] * fy * fx)
                        new_img_array[i, j, c] = val
    
    # Convertir de vuelta a uint8
    new_img_array = np.clip(new_img_array, 0, 255).astype(np.uint8)
    
    # Guardar imagen procesada
    new_img = Image.fromarray(new_img_array, 'RGBA')
    new_img.save(output_path, 'PNG')
    print(f"✓ Procesado: {os.path.basename(input_path)} -> {os.path.basename(output_path)}")

def process_all_hex_frames(input_dir, output_dir=None, frame_shrink_pixels=3):
    """
    Procesa todas las imágenes PNG en el directorio de entrada.
    
    Args:
        input_dir: Directorio con las texturas originales
        output_dir: Directorio de salida (si es None, sobreescribe originales)
        frame_shrink_pixels: Píxeles a reducir del ancho del marco (3-5 recomendado)
    """
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Buscar todos los PNG en el directorio
    files = [f for f in os.listdir(input_dir) if f.lower().endswith('.png')]
    
    if not files:
        print(f"No se encontraron archivos PNG en {input_dir}")
        return
    
    print(f"Procesando {len(files)} archivos (reduciendo {frame_shrink_pixels}px del marco)...")
    print()
    
    for filename in files:
        input_path = os.path.join(input_dir, filename)
        
        if output_dir:
            output_path = os.path.join(output_dir, filename)
        else:
            # Crear backup y sobreescribir original
            backup_path = os.path.join(input_dir, f"{os.path.splitext(filename)[0]}_backup.png")
            if not os.path.exists(backup_path):
                img = Image.open(input_path)
                img.save(backup_path)
                print(f"  Backup creado: {os.path.basename(backup_path)}")
            output_path = input_path
        
        thin_hex_frame(input_path, output_path, frame_shrink_pixels)
    
    print()
    print("✓ Proceso completado!")
    if not output_dir:
        print("  Los archivos originales fueron respaldados con sufijo '_backup.png'")

if __name__ == "__main__":
    # Configuración
    input_directory = "public/assets/hex_frames_textures"
    
    # Puedes ajustar este valor:
    # 2-3 = reducción mínima del marco
    # 4-5 = reducción moderada (recomendado)
    # 6+ = reducción más agresiva
    frame_shrink_pixels = 4
    
    # Opciones:
    # 1. Sobreescribir originales (creará backups automáticamente)
    process_all_hex_frames(input_directory, frame_shrink_pixels=frame_shrink_pixels)
    
    # 2. O guardar en directorio separado (descomentar siguiente línea)
    # process_all_hex_frames(input_directory, output_dir="public/assets/hex_frames_thin", frame_shrink_pixels=frame_shrink_pixels)
