/**
 * OneWallet Detector - Wallet Standard Implementation
 *
 * Detects and manages connection with OneWallet using the official
 * wallet standard compatible with Sui/OneChain
 */

import { getWallets } from '@mysten/wallet-standard';
import type { Wallet } from '@mysten/wallet-standard';

/**
 * Searches for OneWallet among the wallets available in the browser
 * that comply with the Wallet Standard
 *
 * @returns The OneWallet instance or null if not installed
 */
export function findOneWallet(): Wallet | null {
  const wallets = getWallets().get(); // List of wallets compatible with Wallet Standard
  
  // Debug: see which wallets are available
  if (wallets.length > 0) {
    console.log('Wallets detected:', wallets.map(w => w.name));
  }
  
  // Search for OneWallet by name (adjust as needed for runtime name)
  const oneWallet = wallets.find((w) =>
    w.name.toLowerCase().includes('onewallet') ||
    w.name.toLowerCase().includes('one wallet') ||
    w.name.toLowerCase().includes('onechain')
  );
  
  if (oneWallet) {
    console.log('✅ OneWallet detected:', oneWallet.name, oneWallet.version);
  } else {
    console.warn('⚠️ OneWallet not detected. Available wallets:', wallets.map(w => w.name));
  }
  
  return oneWallet ?? null;
}

/**
 * Checks if OneWallet is installed in the browser
 */
export function isOneWalletInstalled(): boolean {
  return findOneWallet() !== null;
}

/**
 * Gets the full list of wallets compatible with Wallet Standard
 * Useful for debugging or showing options to the user
 */
export function getAllWallets(): readonly Wallet[] {
  return getWallets().get();
}
