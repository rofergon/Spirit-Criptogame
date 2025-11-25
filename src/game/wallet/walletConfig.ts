/**
 * OneWallet Configuration for OneChain Blockchain
 *
 * Official integration with OneWallet using Wallet Standard
 * OneChain is a Sui-based blockchain with its own OCT token
 *
 * Resources:
 * - OneChain SDK: @onelabs/sui
 * - Wallet Standard: @mysten/wallet-standard
 * - Docs: https://docs.onelabs.cc/DevelopmentDocument
 */

import type { Wallet, WalletAccount } from '@mysten/wallet-standard';
import { findOneWallet, isOneWalletInstalled } from './onewalletDetector';
import { onechainClient, getOctBalance, formatAddress, type OneChainNetwork } from './onechainClient';

// Global wallet state
let currentWallet: Wallet | null = null;
let currentAccount: WalletAccount | null = null;
let currentNetwork: OneChainNetwork = 'testnet';
let isConnected = false;

/**
 * Account type extended with balance
 */
export interface OneWalletAccountInfo {
  name?: string;
  address: string;
  publicKey: Uint8Array;
  chains: readonly string[];
  features: readonly string[];
  balance?: number; // Balance in OCT
}

/**
 * Connection result
 */
export interface ConnectionResult {
  success: boolean;
  account?: OneWalletAccountInfo;
  error?: string;
}

/**
 * Checks if OneWallet is installed
 */
export { isOneWalletInstalled };

/**
 * Gets the current wallet instance (not connected)
 */
export function getWalletInstance(): Wallet | null {
  if (!currentWallet) {
    currentWallet = findOneWallet();
  }
  return currentWallet;
}

/**
 * Connects to OneWallet using the Wallet Standard
 * This is the main method to authenticate users
 */
export async function connectOneWallet(): Promise<ConnectionResult> {
  try {
    // 1. Detect OneWallet
    const wallet = getWalletInstance();
    
    if (!wallet) {
      return {
        success: false,
        error: 'OneWallet is not installed. Please install it from the Chrome Web Store.',
      };
    }

    // 2. Connect using standard:connect
    // If there are already authorized accounts, no need to ask for permission again
    if (wallet.accounts.length === 0) {
      const connectFeature = (wallet.features as any)['standard:connect'];
      
      if (!connectFeature) {
        return {
          success: false,
          error: 'OneWallet does not support standard:connect',
        };
      }

      // Request authorization from the user
      await connectFeature.connect();
    }

    // 3. Get the first authorized account
    const account = wallet.accounts[0];
    
    if (!account) {
      return {
        success: false,
        error: 'No authorized accounts in OneWallet',
      };
    }

    // 4. Save state
    currentWallet = wallet;
    currentAccount = account;
    isConnected = true;

    // 5. Get OCT balance
    let balance: number | undefined;
    try {
      balance = await getOctBalance(account.address);
    } catch (error) {
      console.warn('⚠️ Could not get balance:', error);
      balance = 0;
    }

    const accountInfo: OneWalletAccountInfo = {
      address: account.address,
      publicKey: new Uint8Array(account.publicKey),
      chains: account.chains,
      features: account.features,
      balance,
    };

    console.log('✅ Connected to OneWallet:', formatAddress(account.address));
    
    return {
      success: true,
      account: accountInfo,
    };

  } catch (error: any) {
    console.error('❌ Error connecting to OneWallet:', error);
    
    // Clear state in case of error
    currentWallet = null;
    currentAccount = null;
    isConnected = false;

    return {
      success: false,
      error: error?.message || 'Unknown error while connecting',
    };
  }
}

/**
 * Disconnects the wallet (revokes authorization)
 */
export async function disconnectOneWallet(): Promise<void> {
  if (!currentWallet) {
    return;
  }

  try {
    const disconnectFeature = (currentWallet.features as any)['standard:disconnect'];
    
    if (disconnectFeature) {
      await disconnectFeature.disconnect();
      console.log('✅ Disconnected from OneWallet');
    } else {
      console.warn('⚠️ OneWallet does not support standard:disconnect');
    }
  } catch (error) {
    console.error('❌ Error disconnecting:', error);
  } finally {
    // Always clear state
    currentWallet = null;
    currentAccount = null;
    isConnected = false;
  }
}

/**
 * Gets the currently connected account
 */
export function getCurrentAccount(): WalletAccount | null {
  return currentAccount;
}

/**
 * Gets full account info with updated balance
 */
export async function getCurrentAccountInfo(): Promise<OneWalletAccountInfo | null> {
  if (!currentAccount) {
    return null;
  }

  try {
    const balance = await getOctBalance(currentAccount.address);
    
    return {
      address: currentAccount.address,
      publicKey: new Uint8Array(currentAccount.publicKey),
      chains: currentAccount.chains,
      features: currentAccount.features,
      balance,
    };
  } catch (error) {
    console.error('❌ Error getting account info:', error);
    return null;
  }
}

/**
 * Checks if a wallet is connected
 */
export function isWalletConnected(): boolean {
  return isConnected && currentAccount !== null;
}

/**
 * Gets the current network
 */
export function getCurrentNetwork(): OneChainNetwork {
  return currentNetwork;
}

/**
 * Changes the current network (local only, user must change it in the extension)
 */
export function setNetwork(network: OneChainNetwork): void {
  currentNetwork = network;
  console.log(`🌐 Network changed to: ${network}`);
}

/**
 * Gets the balance of the current account
 */
export async function getBalance(): Promise<number> {
  if (!currentAccount) {
    throw new Error('No account connected');
  }

  return await getOctBalance(currentAccount.address);
}

/**
 * Signs a message with the current account
 * Uses the standard:signMessage feature of the Wallet Standard
 */
export async function signMessage(message: string): Promise<any> {
  if (!isWalletConnected() || !currentWallet) {
    throw new Error('No wallet connected');
  }

  try {
    const signFeature = (currentWallet.features as any)['standard:signMessage'];
    
    if (!signFeature) {
      throw new Error('OneWallet does not support message signing');
    }

    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);

    const signature = await signFeature.signMessage({
      message: messageBytes,
      account: currentAccount!,
    });

    return signature;
  } catch (error) {
    console.error('❌ Error signing message:', error);
    throw error;
  }
}

/**
 * Hook to listen for account changes
 * Polls every 2 seconds to detect changes
 */
export function onAccountChanged(
  callback: (account: WalletAccount | null) => void
): () => void {
  const checkInterval = setInterval(async () => {
    if (!isConnected || !currentWallet) {
      return;
    }

    try {
      // Check if the account is still the same
      const accounts = currentWallet.accounts;
      
      if (accounts.length === 0) {
        // User disconnected from the extension
        currentAccount = null;
        isConnected = false;
        callback(null);
        return;
      }

      const newAccount = accounts[0];
      
      if (newAccount && newAccount.address !== currentAccount?.address) {
        // User switched account
        currentAccount = newAccount;
        callback(newAccount);
      }
    } catch (error) {
      console.error('Error checking for account changes:', error);
    }
  }, 2000);

  // Function to stop polling
  return () => clearInterval(checkInterval);
}

// Compatibility functions with previous code
export function openWalletModal() {
  if (!isOneWalletInstalled()) {
    alert(
      'OneWallet is not installed.\n\n' +
      'Please install the extension from:\n' +
      'https://chrome.google.com/webstore/detail/harmony-one-wallet/fnnegphlobjdpkhecapkijjdkgcjhkib'
    );
    return;
  }
  connectOneWallet().catch(console.error);
}

export function closeWalletModal() {
  disconnectOneWallet().catch(console.error);
}

export function openNetworkModal() {
  alert(
    'To change network, open the OneWallet extension\n' +
    'and select the desired network (Mainnet, Testnet or Localnet)'
  );
}
