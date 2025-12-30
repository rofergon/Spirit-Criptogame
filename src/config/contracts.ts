/**
 * Base Sepolia Deployed Contracts Configuration
 * 
 * Contract addresses for Base Sepolia (EVM)
 * Currently using placeholders/simulation addresses until deployment.
 */

import { baseSepolia } from 'viem/chains';

/**
 * Base Chain Configuration
 */
export const NETWORK_CONFIG = {
  NAME: "Base Sepolia",
  CHAIN_ID: baseSepolia.id,
  RPC_URL: baseSepolia.rpcUrls.default.http[0],
  EXPLORER_URL: baseSepolia.blockExplorers.default.url,
} as const;

/**
 * Simulated/Placeholder Contracts
 * These addresses should be updated after deploying Solidity contracts.
 */
export const CONTRACTS = {
  // HEX Token (ERC20)
  HEX_TOKEN: "0x0000000000000000000000000000000000000000", // TODO: Deploy

  // Theron Token (ERC20)
  THERON_TOKEN: "0x0000000000000000000000000000000000000000", // TODO: Deploy

  // Land NFT (ERC721)
  LAND_NFT: "0x0000000000000000000000000000000000000000", // TODO: Deploy

  // Store/Marketplace
  STORE: "0x0000000000000000000000000000000000000000", // TODO: Deploy
} as const;

/**
 * Conversion rates
 */
export const CONVERSION_RATES = {
  // Faith a HEX: 20 Faith = 1 HEX
  FAITH_TO_HEX: 20,

  // HEX a THERON: 100,000 HEX = 1 THERON
  HEX_TO_THERON: 100_000,
} as const;

