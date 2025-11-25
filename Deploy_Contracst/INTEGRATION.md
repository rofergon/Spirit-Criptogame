# Guía de Integración Frontend - Theron Contracts

Esta guía muestra cómo integrar los contratos de OneChain con el frontend de Theron.

## 📦 Instalación de Dependencias

```bash
npm install @onelabs/sui @mysten/wallet-adapter-react @mysten/wallet-adapter-wallet-standard
```

## 🔧 Configuración Inicial

### 1. Variables de Entorno

Actualiza `.env`:

```env
# OneChain Network
VITE_ONECHAIN_RPC_URL=https://rpc-testnet.onelabs.cc:443
VITE_ONECHAIN_NETWORK=testnet

# Contract Addresses (actualizar después del despliegue)
VITE_PACKAGE_ID=
VITE_HEX_TREASURY_ID=
VITE_HEX_STATS_ID=
VITE_THERON_TREASURY_ID=
VITE_THERON_STATS_ID=
VITE_STORE_CONFIG_ID=
VITE_LAND_MINT_CAP_ID=
VITE_LAND_REGISTRY_ID=

# Backend API (para operaciones autorizadas)
VITE_BACKEND_API_URL=http://localhost:3000/api
```

### 2. Cliente OneChain

Actualiza `src/game/wallet/onechainClient.ts`:

```typescript
import { SuiClient, getFullnodeUrl } from '@onelabs/sui/client';
import { Transaction } from '@onelabs/sui/transactions';

// Configuración de contratos
export const CONTRACTS = {
  PACKAGE_ID: import.meta.env.VITE_PACKAGE_ID,
  
  HEX_TOKEN: {
    TREASURY_HOLDER: import.meta.env.VITE_HEX_TREASURY_ID,
    STATS: import.meta.env.VITE_HEX_STATS_ID,
    MODULE: 'hex_token',
    TYPE: `${import.meta.env.VITE_PACKAGE_ID}::hex_token::HEX_TOKEN`
  },
  
  THERON_TOKEN: {
    TREASURY_HOLDER: import.meta.env.VITE_THERON_TREASURY_ID,
    STATS: import.meta.env.VITE_THERON_STATS_ID,
    MODULE: 'theron_token',
    TYPE: `${import.meta.env.VITE_PACKAGE_ID}::theron_token::THERON_TOKEN`
  },
  
  LAND_NFT: {
    MINT_CAP: import.meta.env.VITE_LAND_MINT_CAP_ID,
    REGISTRY: import.meta.env.VITE_LAND_REGISTRY_ID,
    MODULE: 'land_nft'
  },
  
  STORE: {
    CONFIG: import.meta.env.VITE_STORE_CONFIG_ID,
    MODULE: 'store'
  }
};

// Cliente RPC
export const suiClient = new SuiClient({ 
  url: import.meta.env.VITE_ONECHAIN_RPC_URL 
});

// Helper: Obtener balance de un token
export async function getTokenBalance(
  address: string, 
  tokenType: string
): Promise<bigint> {
  const balance = await suiClient.getBalance({
    owner: address,
    coinType: tokenType
  });
  return BigInt(balance.totalBalance);
}

// Helper: Obtener objetos de un tipo específico
export async function getOwnedObjectsOfType(
  address: string,
  structType: string
) {
  const objects = await suiClient.getOwnedObjects({
    owner: address,
    filter: { StructType: structType },
    options: { showContent: true, showType: true }
  });
  return objects.data;
}
```

## 🎮 Integración con EconomyManager

Actualiza `src/game/core/EconomyManager.ts`:

```typescript
import { suiClient, CONTRACTS, getTokenBalance } from '../wallet/onechainClient';

export class EconomyManager {
  private faith: number = 0;
  private token1: number = 0; // HEX off-chain
  private token2: number = 0; // THERON off-chain (sincronizado con on-chain)
  
  private playerAddress?: string;
  private faithToToken1Rate = 100; // 100 Faith = 1 HEX
  
  // Sincronizar balances on-chain
  async syncOnChainBalances(address: string) {
    this.playerAddress = address;
    
    // Obtener balance de HEX on-chain
    const hexBalance = await getTokenBalance(address, CONTRACTS.HEX_TOKEN.TYPE);
    // Convertir de unidades más pequeñas (9 decimales)
    const hexInTokens = Number(hexBalance) / 1e9;
    
    // Obtener balance de THERON on-chain
    const theronBalance = await getTokenBalance(address, CONTRACTS.THERON_TOKEN.TYPE);
    const theronInTokens = Number(theronBalance) / 1e9;
    
    // Actualizar estado local (podrías hacer merge con off-chain)
    this.token2 = theronInTokens;
    
    console.log(`[Economy] Synced on-chain: ${hexInTokens} HEX, ${theronInTokens} THERON`);
  }
  
  // Convertir Faith -> HEX (local, luego backend mintea on-chain)
  async convertFaithToToken1(faithAmount?: number): Promise<boolean> {
    const toConvert = faithAmount ?? this.faith;
    if (toConvert < this.faithToToken1Rate) {
      console.warn('Not enough Faith to convert');
      return false;
    }
    
    const hexAmount = Math.floor(toConvert / this.faithToToken1Rate);
    
    // Registrar conversión localmente
    this.faith -= (hexAmount * this.faithToToken1Rate);
    this.token1 += hexAmount;
    
    // Llamar backend para mintear HEX on-chain
    if (this.playerAddress) {
      await this.requestMintHexFromBackend(
        this.playerAddress, 
        hexAmount * this.faithToToken1Rate, 
        hexAmount
      );
    }
    
    console.log(`[Economy] Converted ${hexAmount * this.faithToToken1Rate} Faith -> ${hexAmount} HEX`);
    return true;
  }
  
  // Solicitar mint de HEX al backend
  private async requestMintHexFromBackend(
    recipient: string, 
    faithAmount: number, 
    hexAmount: number
  ) {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL}/mint-hex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient,
          faithAmount,
          hexAmount,
          conversionRate: this.faithToToken1Rate
        })
      });
      
      if (!response.ok) {
        throw new Error('Backend mint failed');
      }
      
      const data = await response.json();
      console.log('[Economy] Backend minted HEX:', data.transactionHash);
    } catch (error) {
      console.error('[Economy] Failed to request HEX mint:', error);
    }
  }
  
  // Otros métodos existentes...
  addFaith(amount: number) {
    this.faith += amount;
  }
  
  spendToken1(cost: number): boolean {
    if (this.token1 < cost) return false;
    this.token1 -= cost;
    return true;
  }
  
  getStats() {
    return {
      faith: this.faith,
      token1: this.token1,
      token2: this.token2,
      faithToToken1Rate: this.faithToToken1Rate
    };
  }
}
```

## 🛒 Comprar Lands desde Frontend

Crea `src/game/wallet/storeOperations.ts`:

```typescript
import { Transaction } from '@onelabs/sui/transactions';
import { suiClient, CONTRACTS } from './onechainClient';

export interface BuyLandParams {
  wallet: any; // OneWallet instance
  rarity: number; // 0=Common, 1=Rare, 2=Epic, 3=Legendary
  biomeType: number; // 0-5
  playerAddress: string;
}

export async function buyLand(params: BuyLandParams) {
  const { wallet, rarity, biomeType, playerAddress } = params;
  
  // 1. Obtener precio del Land
  const priceResult = await suiClient.devInspectTransactionBlock({
    sender: playerAddress,
    transactionBlock: (() => {
      const tx = new Transaction();
      tx.moveCall({
        target: `${CONTRACTS.PACKAGE_ID}::${CONTRACTS.STORE.MODULE}::get_land_price`,
        arguments: [
          tx.object(CONTRACTS.STORE.CONFIG),
          tx.pure(rarity)
        ]
      });
      return tx;
    })()
  });
  
  // Parsear precio (en unidades más pequeñas)
  // const price = parseResultValue(priceResult); // Helper para parsear
  
  // 2. Obtener coins de THERON del jugador
  const theronCoins = await suiClient.getCoins({
    owner: playerAddress,
    coinType: CONTRACTS.THERON_TOKEN.TYPE
  });
  
  if (theronCoins.data.length === 0) {
    throw new Error('No THERON tokens found');
  }
  
  // Usar primer coin (o mergear múltiples si es necesario)
  const coinId = theronCoins.data[0].coinObjectId;
  
  // 3. Construir transacción de compra
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${CONTRACTS.PACKAGE_ID}::${CONTRACTS.STORE.MODULE}::buy_land`,
    arguments: [
      tx.object(CONTRACTS.STORE.CONFIG),
      tx.object(CONTRACTS.LAND_NFT.MINT_CAP),
      tx.object(CONTRACTS.LAND_NFT.REGISTRY),
      tx.object(coinId),
      tx.pure(rarity),
      tx.pure(biomeType)
    ]
  });
  
  // 4. Firmar y ejecutar con OneWallet
  const result = await wallet.signAndExecuteTransaction({
    transaction: tx,
    chain: 'onechain:testnet',
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true
    }
  });
  
  console.log('[Store] Land purchased:', result);
  
  // 5. Extraer ID del Land creado de los eventos
  const landMintedEvent = result.events?.find(
    (e: any) => e.type.includes('::land_nft::LandMinted')
  );
  
  if (landMintedEvent) {
    const landId = landMintedEvent.parsedJson.land_id;
    console.log('[Store] New Land ID:', landId);
    return { success: true, landId, transactionHash: result.digest };
  }
  
  return { success: true, transactionHash: result.digest };
}

export async function buyChest(
  wallet: any,
  chestType: number, // 0=Copper, 1=Silver, 2=Gold
  playerAddress: string
) {
  const theronCoins = await suiClient.getCoins({
    owner: playerAddress,
    coinType: CONTRACTS.THERON_TOKEN.TYPE
  });
  
  if (theronCoins.data.length === 0) {
    throw new Error('No THERON tokens found');
  }
  
  const coinId = theronCoins.data[0].coinObjectId;
  
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${CONTRACTS.PACKAGE_ID}::${CONTRACTS.STORE.MODULE}::buy_chest`,
    arguments: [
      tx.object(CONTRACTS.STORE.CONFIG),
      tx.object(coinId),
      tx.pure(chestType)
    ]
  });
  
  const result = await wallet.signAndExecuteTransaction({
    transaction: tx,
    chain: 'onechain:testnet',
    options: { showEffects: true, showEvents: true }
  });
  
  console.log('[Store] Chest purchased:', result);
  return { success: true, transactionHash: result.digest };
}

// Helper: Listar Lands del jugador
export async function getPlayerLands(playerAddress: string) {
  const lands = await suiClient.getOwnedObjects({
    owner: playerAddress,
    filter: {
      StructType: `${CONTRACTS.PACKAGE_ID}::land_nft::Land`
    },
    options: { showContent: true }
  });
  
  return lands.data.map((obj: any) => ({
    id: obj.data.objectId,
    landId: obj.data.content.fields.land_id,
    biomeType: obj.data.content.fields.biome_type,
    rarity: obj.data.content.fields.rarity,
    name: obj.data.content.fields.name,
    faithMultiplier: obj.data.content.fields.faith_multiplier,
    // ... otros campos
  }));
}

// Helper: Listar Chests del jugador
export async function getPlayerChests(playerAddress: string) {
  const chests = await suiClient.getOwnedObjects({
    owner: playerAddress,
    filter: {
      StructType: `${CONTRACTS.PACKAGE_ID}::store::StarterChest`
    },
    options: { showContent: true }
  });
  
  return chests.data.map((obj: any) => ({
    id: obj.data.objectId,
    chestType: obj.data.content.fields.chest_type,
    isOpened: obj.data.content.fields.is_opened,
    villagers: obj.data.content.fields.initial_villagers,
    // ... otros campos
  }));
}
```

## 🎨 UI de Store en HUD

Actualiza `src/game/ui/HUDController.ts`:

```typescript
import { buyLand, buyChest, getPlayerLands } from '../wallet/storeOperations';

// En el método de inicialización del HUD, añade botones de Store
private createStorePanel() {
  const panel = document.createElement('div');
  panel.id = 'store-panel';
  panel.className = 'hud-panel';
  panel.style.cssText = `
    position: absolute;
    top: 100px;
    right: 20px;
    background: rgba(0,0,0,0.8);
    padding: 15px;
    border-radius: 8px;
    display: none;
  `;
  
  panel.innerHTML = `
    <h3>🏪 Store</h3>
    <div>
      <h4>Lands</h4>
      <button id="buy-land-common">Common Land (10 THERON)</button>
      <button id="buy-land-rare">Rare Land (50 THERON)</button>
      <button id="buy-land-epic">Epic Land (150 THERON)</button>
      <button id="buy-land-legendary">Legendary Land (500 THERON)</button>
    </div>
    <div>
      <h4>Starter Chests</h4>
      <button id="buy-chest-copper">Copper Chest (5 THERON)</button>
      <button id="buy-chest-silver">Silver Chest (15 THERON)</button>
      <button id="buy-chest-gold">Gold Chest (40 THERON)</button>
    </div>
    <button id="close-store">Close</button>
  `;
  
  // Event listeners
  panel.querySelector('#buy-land-common')?.addEventListener('click', () => {
    this.handleBuyLand(0); // Common
  });
  
  panel.querySelector('#buy-chest-copper')?.addEventListener('click', () => {
    this.handleBuyChest(0); // Copper
  });
  
  // ... más listeners
  
  document.body.appendChild(panel);
}

private async handleBuyLand(rarity: number) {
  const wallet = (window as any).oneWallet;
  if (!wallet) {
    alert('Please connect OneWallet first');
    return;
  }
  
  try {
    const accounts = await wallet.getAccounts();
    const playerAddress = accounts[0].address;
    
    // Mostrar loading
    this.showLoading('Purchasing Land...');
    
    const result = await buyLand({
      wallet,
      rarity,
      biomeType: Math.floor(Math.random() * 6), // Random biome
      playerAddress
    });
    
    this.hideLoading();
    alert(`Land purchased! Transaction: ${result.transactionHash}`);
    
    // Refrescar lista de Lands
    await this.refreshPlayerLands(playerAddress);
    
  } catch (error) {
    this.hideLoading();
    console.error('Failed to buy land:', error);
    alert('Purchase failed: ' + (error as Error).message);
  }
}

private async refreshPlayerLands(playerAddress: string) {
  const lands = await getPlayerLands(playerAddress);
  console.log('Player lands:', lands);
  // Actualizar UI con lista de lands
  // Podrías mostrar en un panel lateral
}
```

## 🔌 Conectar OneWallet

Actualiza `src/game/wallet/onewalletDetector.ts`:

```typescript
export async function detectAndConnectOneWallet() {
  const wallet = (window as any).oneWallet;
  
  if (!wallet) {
    throw new Error('OneWallet extension not installed');
  }
  
  // Verificar que esté en la red correcta
  const network = await wallet.getNetwork();
  if (network !== 'onechain:testnet') {
    throw new Error('Please switch OneWallet to OneChain Testnet');
  }
  
  // Solicitar conexión
  await wallet.connect();
  
  // Obtener cuentas
  const accounts = await wallet.getAccounts();
  if (accounts.length === 0) {
    throw new Error('No accounts found in OneWallet');
  }
  
  const address = accounts[0].address;
  console.log('[Wallet] Connected:', address);
  
  return { wallet, address };
}

// En MainMenu, añadir botón de conexión
export function setupWalletConnection(onConnected: (address: string) => void) {
  const connectBtn = document.createElement('button');
  connectBtn.textContent = 'Connect OneWallet';
  connectBtn.onclick = async () => {
    try {
      const { address } = await detectAndConnectOneWallet();
      onConnected(address);
      connectBtn.textContent = `Connected: ${address.slice(0, 6)}...${address.slice(-4)}`;
      connectBtn.disabled = true;
    } catch (error) {
      alert((error as Error).message);
    }
  };
  
  return connectBtn;
}
```

## 📊 Visualización de Tokens en HUD

Añade indicadores de tokens en el HUD:

```typescript
// En HUDController
private createTokensDisplay() {
  const container = document.createElement('div');
  container.id = 'tokens-display';
  container.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(0,0,0,0.7);
    padding: 10px;
    border-radius: 5px;
    font-family: monospace;
  `;
  
  container.innerHTML = `
    <div>💎 Faith: <span id="faith-value">0</span></div>
    <div>🪙 HEX: <span id="hex-value">0</span></div>
    <div>⭐ THERON: <span id="theron-value">0</span></div>
    <button id="convert-faith-btn">Convert Faith → HEX</button>
  `;
  
  document.body.appendChild(container);
  
  // Event listener para conversión
  container.querySelector('#convert-faith-btn')?.addEventListener('click', () => {
    this.session.economyManager.convertFaithToToken1();
    this.updateTokensDisplay();
  });
}

private updateTokensDisplay() {
  const stats = this.session.economyManager.getStats();
  
  document.getElementById('faith-value')!.textContent = stats.faith.toFixed(2);
  document.getElementById('hex-value')!.textContent = stats.token1.toFixed(2);
  document.getElementById('theron-value')!.textContent = stats.token2.toFixed(2);
}
```

## 🎯 Próximos Pasos

1. **Implementar backend para mint autorizado**
   - Endpoint `/api/mint-hex` que valide Faith y llame al contrato
   - Endpoint `/api/mint-land` para minteo controlado de Lands

2. **Sincronización periódica**
   - Polling de balances on-chain cada X segundos
   - WebSocket para notificaciones de transacciones

3. **Manejo de errores robusto**
   - Retry logic para transacciones fallidas
   - UI feedback para estado de transacciones

4. **Testing**
   - Tests unitarios para operaciones de contratos
   - Tests de integración con testnet

---

**Nota**: Este es un ejemplo de integración básica. Ajusta según las necesidades específicas de tu arquitectura.
