# 🎉 CONTRATOS DESPLEGADOS EXITOSAMENTE

**Fecha:** 2025-11-24  
**Red:** OneChain Testnet  
**Wallet:** `0xc8e262bc649bc5ae64adc77c5f4661f322eeab9c3bb358b6cafb2dc1874c88ae`

---

## 📦 PACKAGE ID (IMPORTANTE)

```
0xee46771b757523af06d19cff029366b81b6716715bea7bb58d0d5013b0e5c73d
```

**Este ID identifica todos tus contratos desplegados.**

---

## 🎯 OBJETOS PRINCIPALES CREADOS

### 1️⃣ HEX Token (Token Débil - Inflacionario)
- **Treasury Holder:** `0xa48be070305d5a94144ec13ef71733cbdd9fb2fca1352b492d51a66db28f03d5`
- **Economy Stats:** `0xf57368221c63529dd792b205f82294b25919e4ef306ba98c4f49a5589d961b3f`
- **Metadata:** `0x400f39cd624b59eab81e0a682aec996ba5fb9aaf8df3b0b0dd18e8e7871d196b`

**Funciones principales:**
- `mint_from_faith()` - Convertir Fe → HEX
- `burn_tokens()` - Quemar HEX para upgrades/construcciones

---

### 2️⃣ THERON Token (Token Fuerte - Limitado)
- **Treasury Holder:** `0x7a3a35803966fc82d77c5a1f9dd02859b32321a7131a4f7db8dd5542227c00d2`
- **Stats:** `0x9c97a8b23df2254b648851b30f322571fee31fd346f827c8b2340b3152b41cf8`
- **Metadata:** `0x2486ec8b7b6421e885c050fbdb26dfc882292fc7d3fe409eb5939b6acea76438`

**Funciones principales:**
- `mint_from_hex_burn()` - Convertir 100k HEX → 1 THERON
- `burn_for_purchase()` - Quemar THERON para comprar Lands/Chests

---

### 3️⃣ Land NFT (Tierras con Rareza)
- **Mint Cap:** `0x0c8547a3824e02f18c3422aea11ae5019be4cca9ffe0baeca89cf4bf8031dba8`
- **Registry:** `0xe6639fb106cb5cd289e8f4c1b580531f891826d783a28184b811d1ffb36bd993`

**Rarezas disponibles:**
- Common (1.0x multiplicadores)
- Rare (1.2x multiplicadores)
- Epic (1.5x multiplicadores)
- Legendary (2.0x multiplicadores)

**Funciones principales:**
- `mint_land()` - Crear nueva tierra NFT
- `mint_land_by_rarity()` - Crear tierra con rareza específica

---

### 4️⃣ Store (Marketplace)
- **Store Config:** `0x7c57f992b6bfdb25cf23767776b5754e71bd9a33253a794e7e5df089c340281e`

**Precios por defecto:**
- Common Land: 10 THERON
- Rare Land: 50 THERON
- Epic Land: 150 THERON
- Legendary Land: 500 THERON
- Copper Chest: 5 THERON
- Silver Chest: 15 THERON
- Gold Chest: 40 THERON

**Funciones principales:**
- `buy_land()` - Comprar tierra con THERON
- `buy_chest()` - Comprar cofre con THERON
- `open_chest()` - Abrir cofre y recibir recursos

**Burn:** 30% de cada compra se quema automáticamente

---

### 5️⃣ Upgrade Cap
- **Object ID:** `0x7b714ce4094632d4fe3a89da658397efcb2fa31041872a95bceab17f3c7dcaf0`
- Permite actualizar los contratos en el futuro

---

## 🔗 ENLACES ÚTILES

**Explorador de transacciones:**
https://onescan.cc/testnet/address/0xc8e262bc649bc5ae64adc77c5f4661f322eeab9c3bb358b6cafb2dc1874c88ae

**Package desplegado:**
https://onescan.cc/testnet/object/0xee46771b757523af06d19cff029366b81b6716715bea7bb58d0d5013b0e5c73d

---

## 💻 INTEGRACIÓN CON FRONTEND

### Variables de entorno (.env)

```env
VITE_ONECHAIN_RPC=https://rpc-testnet.onelabs.cc:443
VITE_PACKAGE_ID=0xee46771b757523af06d19cff029366b81b6716715bea7bb58d0d5013b0e5c73d

# HEX Token
VITE_HEX_TREASURY=0xa48be070305d5a94144ec13ef71733cbdd9fb2fca1352b492d51a66db28f03d5
VITE_HEX_STATS=0xf57368221c63529dd792b205f82294b25919e4ef306ba98c4f49a5589d961b3f

# THERON Token
VITE_THERON_TREASURY=0x7a3a35803966fc82d77c5a1f9dd02859b32321a7131a4f7db8dd5542227c00d2
VITE_THERON_STATS=0x9c97a8b23df2254b648851b30f322571fee31fd346f827c8b2340b3152b41cf8

# Land NFT
VITE_LAND_MINTCAP=0x0c8547a3824e02f18c3422aea11ae5019be4cca9ffe0baeca89cf4bf8031dba8
VITE_LAND_REGISTRY=0xe6639fb106cb5cd289e8f4c1b580531f891826d783a28184b811d1ffb36bd993

# Store
VITE_STORE_CONFIG=0x7c57f992b6bfdb25cf23767776b5754e71bd9a33253a794e7e5df089c340281e
```

### Ejemplo de llamada desde TypeScript

```typescript
import { Transaction } from '@mysten/sui/transactions';

const packageId = '0xee46771b757523af06d19cff029366b81b6716715bea7bb58d0d5013b0e5c73d';

// Mintear HEX desde Faith
const tx = new Transaction();
tx.moveCall({
  target: `${packageId}::hex_token::mint_from_faith`,
  arguments: [
    tx.object(VITE_HEX_TREASURY), // treasury
    tx.pure(1000000000),           // amount (1 HEX)
    tx.object(VITE_HEX_STATS)      // stats
  ]
});

await client.signAndExecuteTransaction({
  transaction: tx,
  signer: keypair
});
```

---

## 📊 RESUMEN ECONÓMICO

### Flujo de tokens:
1. **Faith** (recurso in-game) → **HEX** (via `mint_from_faith`)
2. **HEX** (100,000) → **THERON** (1) (via `mint_from_hex_burn`)
3. **THERON** → **Lands/Chests** (via `buy_land`/`buy_chest`)
4. 30% del THERON gastado se **quema** automáticamente

### Rareza de Lands:
- **Common:** Multiplicadores base (1.0x)
- **Rare:** +20% (1.2x)
- **Epic:** +50% (1.5x)  
- **Legendary:** +100% (2.0x) en Faith, Fertilidad, Stone, Recurso especial

---

## ✅ SIGUIENTE PASO

**Integrar en tu frontend:**

1. Copia las variables de entorno arriba a tu archivo `.env`
2. Usa el SDK `@mysten/sui` para interactuar con los contratos
3. Los contratos están listos para:
   - Mintear tokens HEX y THERON
   - Crear NFTs de tierras
   - Vender tierras y cofres en la store
   - Sistema completo de economía dual

**¡Tus contratos están LIVE en OneChain Testnet!** 🚀
