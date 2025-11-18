# Configuración de Wallet con Reown AppKit

## Red Configurada: Base Sepolia Testnet

### Detalles de la Red
- **Nombre**: Base Sepolia
- **Chain ID**: 84532
- **RPC Endpoint**: https://sepolia.base.org
- **Currency Symbol**: ETH
- **Block Explorer**: https://sepolia-explorer.base.org

## Configuración Inicial

### 1. Obtener Project ID de Reown

1. Ve a [Reown Dashboard](https://dashboard.reown.com/)
2. Crea una cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Copia el **Project ID** que te proporcionen

### 2. Configurar el Project ID

Abre el archivo `walletConfig.ts` y reemplaza `'YOUR_PROJECT_ID'` con tu Project ID real:

```typescript
const projectId = 'tu-project-id-aqui';
```

### 3. Configurar Metadatos (Opcional)

También puedes personalizar los metadatos de tu aplicación en `walletConfig.ts`:

```typescript
const metadata = {
  name: 'Carpeta con Juan',
  description: 'Strategy game with blockchain integration',
  url: 'https://tudominio.com', // Tu dominio
  icons: ['https://tudominio.com/icon.png'] // Tu ícono
};
```

## Uso en el Juego

### Botón de Conexión

El componente `<appkit-button />` ya está agregado en el header del juego. Este botón:
- Muestra "Connect Wallet" cuando no hay billetera conectada
- Muestra la dirección de la billetera cuando está conectada
- Permite desconectar la billetera

### Funciones Disponibles

Puedes importar estas funciones en cualquier parte de tu aplicación:

```typescript
import { 
  openWalletModal, 
  openNetworkModal, 
  closeWalletModal,
  wagmiConfig 
} from './game/wallet/walletConfig';

// Abrir modal de conexión
openWalletModal();

// Abrir modal de redes
openNetworkModal();

// Cerrar modal
closeWalletModal();
```

### Interactuar con Contratos

Para interactuar con smart contracts, usa Wagmi:

```typescript
import { readContract, writeContract } from '@wagmi/core';
import { wagmiConfig } from './game/wallet/walletConfig';

// Leer de un contrato
const data = await readContract(wagmiConfig, {
  address: '0x...',
  abi: [...],
  functionName: 'balanceOf',
  args: [address]
});

// Escribir en un contrato
await writeContract(wagmiConfig, {
  address: '0x...',
  abi: [...],
  functionName: 'transfer',
  args: [to, amount]
});
```

## Faucets para Base Sepolia

Para obtener ETH de prueba en Base Sepolia:
- [Coinbase Faucet](https://portal.cdp.coinbase.com/products/faucet)
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)

## Recursos Adicionales

- [Documentación de Reown AppKit](https://docs.reown.com/appkit/overview)
- [Documentación de Wagmi](https://wagmi.sh/)
- [Documentación de Base](https://docs.base.org/)
- [Viem Docs](https://viem.sh/)

## Características Habilitadas

En `walletConfig.ts` puedes habilitar/deshabilitar:

- `analytics: true` - Análisis de uso
- `email: false` - Login con email (requiere configuración adicional)
- `socials: false` - Login con redes sociales (requiere configuración adicional)

## Soporte de Wallets

Reown AppKit soporta automáticamente cientos de wallets, incluyendo:
- MetaMask
- Coinbase Wallet
- Rainbow
- Trust Wallet
- WalletConnect compatible wallets
- Y muchas más...
