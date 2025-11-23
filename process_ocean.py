"""
Script para procesar la imagen de océano
"""

from extract_hex_tiles import extract_hex_tiles
import os

possible_paths = [
    'Ocean_variants.png',
    'ocean_variants.png',
    'public/assets/textures/Ocean_variants.png',
    'public/assets/Ocean.png',
]

print("🌊 Procesando hexágonos de océano...\n")

found = False
for path in possible_paths:
    if os.path.exists(path):
        print(f"✅ Archivo encontrado: {path}\n")
        result = extract_hex_tiles(
            path, 
            output_dir='public/assets/extracted_ocean_hexes', 
            prefix='ocean_hex_Ocean'
        )
        found = True
        print(f"\n✨ Se extrajeron {len(result)} hexágonos de océano")
        
        # Limpiar automáticamente
        print("\n🧹 Limpiando hexágonos...")
        import subprocess
        subprocess.run(['python', 'clean_hex_tiles.py', 'public/assets/extracted_ocean_hexes'])
        break

if not found:
    print("❌ No se encontró la imagen de océano.")
    print("\nPor favor:")
    print("1. Guarda la imagen adjunta como: Ocean_variants.png")
    print("2. Colócala en: public/assets/textures/")
    print("3. Ejecuta: python process_ocean.py")
