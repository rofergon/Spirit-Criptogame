"""
Script para procesar la imagen de 4 hexágonos de playa
y extraer cada uno en un archivo PNG individual con fondo transparente.
"""

from extract_hex_tiles import extract_hex_tiles
import sys
import os

def main():
    print("🏖️  Procesador de Hexágonos de Playa\n")
    
    # Posibles nombres de archivo de entrada
    input_files = [
        'beach_tiles.png',
        'Beach.png',
        'beach_variants.png',
        'beach.png',
    ]
    
    # Si se pasa un argumento, usarlo
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
        print(f"Procesando archivo especificado: {input_file}\n")
        extract_hex_tiles(input_file, output_dir='public/assets/extracted_beach_hexes', prefix='beach_hex')
        return
    
    # Buscar en ubicaciones conocidas
    locations = [
        'public/assets/textures/',
        'public/assets/',
        './',
    ]
    
    found = False
    for location in locations:
        for filename in input_files:
            full_path = os.path.join(location, filename)
            if os.path.exists(full_path):
                print(f"✅ Archivo encontrado: {full_path}\n")
                extract_hex_tiles(full_path, output_dir='public/assets/extracted_beach_hexes', prefix='beach_hex')
                found = True
                break
        if found:
            break
    
    if not found:
        print("ℹ️  No se encontró automáticamente el archivo.")
        print("\nPuedes ejecutar este script así:\n")
        print("  python process_beach.py ruta/a/beach_tiles.png")
        print("\nO coloca la imagen de playa (4 hexágonos) en:")
        print("  - public/assets/textures/beach_tiles.png")
        print("  - public/assets/Beach.png")

if __name__ == "__main__":
    main()
