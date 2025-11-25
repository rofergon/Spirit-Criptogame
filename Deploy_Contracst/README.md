# 🎮 Contratos Theron Game - OneChain Testnet

Contratos inteligentes del juego Theron escritos en Move, desplegados en OneChain Testnet.

## 📦 Contratos Incluidos

- **hex_token.move** - Token débil e inflacionario (HEX) para economía diaria
- **theron_token.move** - Token premium con supply limitado (1M THERON)
- **land_nft.move** - NFTs de tierras con 6 biomas y 4 niveles de rareza
- **store.move** - Marketplace para comprar tierras y cofres con THERON

## ✅ Estado Actual

**CONTRATOS DESPLEGADOS EN ONECHAIN TESTNET**

- **Package ID**: `0xee46771b757523af06d19cff029366b81b6716715bea7bb58d0d5013b0e5c73d`
- **Network**: OneChain Testnet
- **RPC**: https://rpc-testnet.onelabs.cc:443
- **Explorer**: https://onescan.cc/testnet/object/0xee46771b757523af06d19cff029366b81b6716715bea7bb58d0d5013b0e5c73d

Ver `DEPLOYMENT_SUCCESS.md` para todos los IDs de objetos y ejemplos de integración.

---

## 🚀 Cómo Desplegar (Si necesitas redesplegar)

### Prerrequisitos

1. **WSL Ubuntu** instalado (para compilar en Windows)
2. **Sui CLI** instalado en WSL
3. **Wallet con fondos** en OneChain Testnet (mínimo 0.1 OCT)
4. **Node.js 18+** instalado

### Paso 1: Compilar Contratos en WSL

Abre WSL y ejecuta:

```bash
# Ir al directorio del proyecto
cd /mnt/c/Users/TU_USUARIO/carpeta\ con\ juan/Deploy_Contracst

# Compilar los contratos Move
sui move build
```

Esto generará el directorio `build/` con los módulos compilados.

### Paso 2: Configurar Variables de Entorno

Crea un archivo `.env` con tu clave privada:

```env
ONECHAIN_PRIVATE_KEY=suiprivkey1...
```

**⚠️ IMPORTANTE**: 
- Nunca compartas tu `.env` ni lo subas a Git
- El archivo `.env` ya está en `.gitignore`

### Paso 3: Desplegar con Node.js

En PowerShell:

```powershell
# Ir al directorio
cd "c:\Users\TU_USUARIO\carpeta con juan\Deploy_Contracst"

# Instalar dependencias (solo primera vez)
npm install

# Ejecutar deployment
npm run deploy
```

### ¿Qué hace el script de deployment?

El script `deploy-sdk.mjs` ejecuta automáticamente:

1. ✅ Verifica que los contratos estén compilados
2. 📦 Lee los módulos compilados de `build/theron_game_contracts/bytecode-modules.json`
3. 🔑 Carga tu wallet desde `.env`
4. 🚀 Despliega los contratos a OneChain Testnet
5. 💾 Guarda todos los IDs en `.env`
6. 📋 Muestra resumen completo con:
   - Package ID
   - IDs de Treasuries (HEX, THERON)
   - IDs de Stats
   - IDs de MintCap y Registry (Land NFT)
   - ID de StoreConfig
   - Link al explorador

### Resultado Esperado

```
╔═══════════════════════════════════════════════════════╗
║           ✅ CONTRATOS DESPLEGADOS ✅                  ║
╚═══════════════════════════════════════════════════════╝

📦 Package ID: 0x...

🎯 Objetos creados:
   - HEX Treasury: 0x...
   - THERON Treasury: 0x...
   - Land MintCap: 0x...
   - Store Config: 0x...
   [...]

🌐 Explorador: https://onescan.cc/testnet/object/0x...
```

---

## 📁 Estructura del Proyecto

```
Deploy_Contracst/
├── sources/              # ← Código fuente Move
│   ├── hex_token.move
│   ├── theron_token.move
│   ├── land_nft.move
│   └── store.move
├── build/               # ← Contratos compilados (auto-generado)
├── deploy-sdk.mjs       # ← Script de deployment
├── package.json         # ← Configuración npm
├── .env                 # ← Tu clave privada (NO SUBIR A GIT)
├── .gitignore           # ← Protege .env
├── Move.toml            # ← Config del proyecto Move
├── DEPLOYMENT_SUCCESS.md # ← Info completa del deployment
└── INTEGRATION.md       # ← Ejemplos de integración frontend
```

---

## 🔧 Troubleshooting

### ❌ Error: "Cannot find build directory"

**Solución**: Compila los contratos primero en WSL:
```bash
cd /mnt/c/Users/TU_USUARIO/carpeta\ con\ juan/Deploy_Contracst
sui move build
```

### ❌ Error: "Insufficient gas"

**Solución**: Tu wallet necesita más OCT. Verifica tu balance:
```powershell
npm run balance
```

Si necesitas fondos, solicítalos del faucet de OneChain Testnet.

### ❌ Error: "Network error" o "Connection refused"

**Solución**: Verifica que el RPC de OneChain esté disponible:
```
https://rpc-testnet.onelabs.cc:443
```

Intenta hacer ping o verificar en el explorador si la red está activa.

### ❌ Error: "Invalid private key"

**Solución**: Verifica que tu `.env` tenga el formato correcto:
```env
ONECHAIN_PRIVATE_KEY=suiprivkey1qzr...
```

---

## 📚 Documentación Adicional

- **DEPLOYMENT_SUCCESS.md** - Detalles completos del deployment actual con todos los IDs
- **INTEGRATION.md** - Ejemplos de integración con frontend TypeScript
- `.env` - Variables de entorno con IDs de contratos (generado después del deployment)

---

## 🌐 Recursos Útiles

- [Documentación de OneChain](https://docs.onechain.io)
- [Explorador OneScan](https://onescan.cc/testnet)
- [Sui Move Book](https://move-language.github.io/move/)

---

**Desarrollado para Theron Game 🎮**
