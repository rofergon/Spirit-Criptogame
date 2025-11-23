"""
Script para procesar la imagen de 4 hexágonos de pasto
y extraer cada uno en un archivo PNG individual con fondo transparente.
"""

from extract_hex_tiles import extract_hex_tiles, process_folder
import sys

# Nombre del archivo de entrada (la imagen adjunta)
# Ajustar según el nombre real del archivo
input_files = [
    'c26606bc-1358-490f-9219-970fc0a664c2 (1).png',  # Posible nombre de la imagen adjunta
    'grass_tiles.png',
    'grassland_variants.png',
]

def main():
    print("🌿 Procesador de Hexágonos de Pasto\n")
    
    # Intentar encontrar el archivo
    found = False
    
    # Si se pasa un argumento, usarlo
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
        print(f"Procesando archivo especificado: {input_file}\n")
        extract_hex_tiles(input_file, output_dir='extracted_grass_hexes', prefix='grass_hex')
        found = True
    else:
        # Buscar en ubicaciones conocidas
        locations = [
            'public/assets/textures/',
            'public/assets/',
            './',
        ]
        
        for location in locations:
            for filename in input_files:
                full_path = location + filename
                try:
                    with open(full_path):
                        print(f"✅ Archivo encontrado: {full_path}\n")
                        extract_hex_tiles(full_path, output_dir='extracted_grass_hexes', prefix='grass_hex')
                        found = True
                        break
                except FileNotFoundError:
                    continue
            if found:
                break
    
    if not found:
        print("ℹ️  No se encontró automáticamente el archivo.")
        print("\nPuedes ejecutar este script de estas formas:\n")
        print("  1. python process_grass_tiles.py ruta/a/tu/imagen.png")
        print("  2. Editar el script y ajustar las rutas en 'input_files'")
        print("\nO usar directamente extract_hex_tiles.py:")
        print("  >>> from extract_hex_tiles import extract_hex_tiles")
        print("  >>> extract_hex_tiles('tu_imagen.png', output_dir='output')")

if __name__ == "__main__":
    main()
