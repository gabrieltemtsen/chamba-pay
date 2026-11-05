import {
  withAttribution,
  toDataSuffix,
  fromDataSuffix,
  verifyTx,
  ERC_8021_MARKER,
} from '@celo/attribution-tags';
import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  encodeFunctionData,
  erc20Abi,
  parseAbi,
  type Address,
  type Hex,
  type LocalAccount,
  type Transport,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { celo } from 'viem/chains';

/**
 * NON-NEGOTIABLE HACKATHON ATTRIBUTION TAG
 * Issued by Loops House for "Agents on Open Rails".
 * Every transaction sent by our agent or user frontend MUST include this tag.
 */
export const CHAMBA_ATTRIBUTION_TAG = 'celo_42cd0161c62d' as const;

export const CHAMBA_DATA_SUFFIX: Hex = toDataSuffix(CHAMBA_ATTRIBUTION_TAG);

/**
 * Live Celo Mainnet (Chain ID: 42220) Contracts & Token Registry
 */
export const CELO_CHAIN_ID = 42220 as const;

export const CELO_TOKENS = {
  USAT: {
    symbol: 'USA₮',
    code: 'USAT',
    name: 'Tether America USD',
    address: '0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771' as Address,
    decimals: 6,
    feeCurrency: '0x0357EE22278c922e1D36cFe6b899269b161880C4' as Address,
    transferMethod: 'eip3009' as const,
    eip712Name: 'Tether America USD',
    eip712Version: '1',
    country: 'US',
    flag: '🇺🇸',
  },
  USDC: {
    symbol: 'USDC',
    code: 'USDC',
    name: 'USD Coin',
    address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as Address,
    decimals: 6,
    feeCurrency: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address,
    transferMethod: 'eip3009' as const,
    eip712Name: 'USDC',
    eip712Version: '2',
    country: 'US',
    flag: '💵',
  },
  USDT: {
    symbol: 'USD₮',
    code: 'USDT',
    name: 'Tether USD',
    address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as Address,
    decimals: 6,
    feeCurrency: '0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72' as Address,
    transferMethod: 'eip3009' as const,
    eip712Name: 'Tether USD',
    eip712Version: '1',
    country: 'Global',
    flag: '🌐',
  },
  wARS: {
    symbol: 'wARS',
    code: 'wARS',
    name: 'Peso Argentino (Ripio)',
    address: '0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D' as Address,
    decimals: 18,
    transferMethod: 'permit2' as const,
    eip712Name: 'Peso Argentino',
    eip712Version: '1',
    country: 'AR',
    flag: '🇦🇷',
  },
  wBRL: {
    symbol: 'wBRL',
    code: 'wBRL',
    name: 'Real Brasileño (Ripio)',
    address: '0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0' as Address,
    decimals: 18,
    transferMethod: 'permit2' as const,
    eip712Name: 'Real Brasileño',
    eip712Version: '1',
    country: 'BR',
    flag: '🇧🇷',
  },
  wMXN: {
    symbol: 'wMXN',
    code: 'wMXN',
    name: 'Peso Mexicano (Ripio)',
    address: '0x337E7456B420bD3481e7FA61fA9850343d610d34' as Address,
    decimals: 18,
    transferMethod: 'permit2' as const,
    eip712Name: 'Peso Mexicano',
    eip712Version: '1',
    country: 'MX',
    flag: '🇲🇽',
  },
  wCOP: {
    symbol: 'wCOP',
    code: 'wCOP',
    name: 'Peso Colombiano (Ripio)',
    address: '0x8a1D45e102e886510e891d2Ec656a708991e2D76' as Address,
    decimals: 18,
    transferMethod: 'permit2' as const,
    eip712Name: 'Peso Colombiano',
    eip712Version: '1',
    country: 'CO',
    flag: '🇨🇴',
  },
  wPEN: {
    symbol: 'wPEN',
    code: 'wPEN',
    name: 'Sol Peruano (Ripio)',
    address: '0x4F34c8b3b5FB6D98Da888F0feA543d4d9C9F2eBE' as Address,
    decimals: 18,
    transferMethod: 'permit2' as const,
    eip712Name: 'Sol Peruano',
    eip712Version: '1',
    country: 'PE',
    flag: '🇵🇪',
  },
  wCLP: {
    symbol: 'wCLP',
    code: 'wCLP',
    name: 'Peso Chileno (Ripio)',
    address: '0x61D450a098b6a7f69fC4b98CE68198fe59768651' as Address,
    decimals: 18,
    transferMethod: 'permit2' as const,
    eip712Name: 'Peso Chileno',
    eip712Version: '1',
    country: 'CL',
    flag: '🇨🇱',
  },
  cNGN: {
    symbol: 'cNGN',
    code: 'cNGN',
    name: 'Nigerian Naira Stablecoin',
    address: '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f' as Address,
    decimals: 6,
    transferMethod: 'permit2' as const,
    eip712Name: 'cNGN',
    eip712Version: '1',
    country: 'NG',
    flag: '🇳🇬',
  },
} as const;

export type TokenCode = keyof typeof CELO_TOKENS;

export const PROTOCOL_CONTRACTS = {
  ERC8004_IDENTITY_REGISTRY: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address,
  ERC8004_REPUTATION_REGISTRY: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as Address,
  TEXTILE_LIMIT_ORDER_REACTOR: '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3' as Address,
  TEXTILE_SELL_FIRST_FEE_CONTROLLER: '0x7b005466F905DD882A959888154587fA76cd3Ea7' as Address,
  TEXTILE_PREFERRED_FILLER_VALIDATION: '0x10B9EbA3a175Df418a35CB8329a527691EE258C5' as Address,
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
  X402_FACILITATOR_SIGNER: '0x0d74D5Cefd2e7F24E623330ebE3d8D4cB45fFB48' as Address,
  USEBUY_GATEWAY_RECIPIENT: '0x20faAca5F980E29639A0FCC6dcA6988E18ed333B' as Address,
} as const;

export const CELO_RPC_URL =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ||
  process.env.BUY_RPC_URL ||
  'https://forno.celo.org';

export function getCeloPublicClient(rpcUrl: string = CELO_RPC_URL) {
  return createPublicClient({
    chain: celo,
    transport: http(rpcUrl),
  });
}

/**
 * Creates a Viem WalletClient pre-extended with `withAttribution('celo_42cd0161c62d')`.
 * Every `sendTransaction` and `writeContract` call automatically carries the ERC-8021 tag.
 */
export function createTaggedAgentWalletClient(
  account: LocalAccount,
  rpcUrl: string = CELO_RPC_URL
) {
  return createWalletClient({
    account,
    chain: celo,
    transport: http(rpcUrl),
  }).extend(withAttribution(CHAMBA_ATTRIBUTION_TAG));
}

/**
 * Browser WalletClient wrapper for user-signed transactions (MetaMask, MiniPay, Rabby)
 * that automatically attaches `celo_42cd0161c62d` to every user transaction.
 */
export function createTaggedBrowserWalletClient(ethereumProvider: unknown) {
  return createWalletClient({
    chain: celo,
    transport: custom(ethereumProvider as Parameters<typeof custom>[0]),
  }).extend(withAttribution(CHAMBA_ATTRIBUTION_TAG));
}

/**
 * Appends our ERC-8021 attribution suffix (`celo_42cd0161c62d`) to raw calldata
 * and verifies that it decodes cleanly via `fromDataSuffix`.
 */
export function ensureTaggedCalldata(calldata: Hex = '0x'): Hex {
  const existing = fromDataSuffix(calldata);
  if (existing && existing.codes.includes(CHAMBA_ATTRIBUTION_TAG)) {
    return calldata;
  }
  const suffixRaw = CHAMBA_DATA_SUFFIX.startsWith('0x')
    ? CHAMBA_DATA_SUFFIX.slice(2)
    : CHAMBA_DATA_SUFFIX;
  const base = calldata === '0x' ? '0x' : calldata;
  return `${base}${suffixRaw}` as Hex;
}

/**
 * Pure verification helper: checks whether a transaction calldata hex string
 * carries the required `celo_42cd0161c62d` ERC-8021 tag.
 */
export function verifyCalldataHasChambaTag(calldata: Hex): {
  isTagged: boolean;
  codes: string[];
  schemaId: number | null;
  markerPresent: boolean;
} {
  const decoded = fromDataSuffix(calldata);
  const markerPresent = calldata
    .toLowerCase()
    .endsWith(ERC_8021_MARKER.slice(2).toLowerCase());
  return {
    isTagged: Boolean(decoded?.codes.includes(CHAMBA_ATTRIBUTION_TAG)),
    codes: decoded?.codes ?? [],
    schemaId: decoded?.schemaId ?? null,
    markerPresent,
  };
}

/**
 * Verifies an on-chain Celo Mainnet transaction hash for our `celo_42cd0161c62d` tag.
 */
export async function verifyOnchainTxTag(hash: Hex, rpcUrl: string = CELO_RPC_URL) {
  const client = getCeloPublicClient(rpcUrl);
  const decoded = await verifyTx({ client, hash });
  return {
    hash,
    isTagged: Boolean(decoded?.codes.includes(CHAMBA_ATTRIBUTION_TAG)),
    codes: decoded?.codes ?? [],
    schemaId: decoded?.schemaId ?? null,
    explorerUrl: `https://celoscan.io/tx/${hash}`,
  };
}

export const verifyMainnetTxHasChambaTag = verifyOnchainTxTag;

/**
 * Builds a Ripio B2B/Consumer Ramp URL (`ramp.ripio.com`) for 1-click local currency
 * on-ramp and off-ramp in Argentina, Brazil, Mexico, Colombia, Chile, and Peru.
 */
export function buildRipioRampUrl(params: {
  direction: 'onramp' | 'offramp';
  country: 'AR' | 'BR' | 'MX' | 'CO' | 'PE' | 'CL';
  token: 'WARS' | 'WBRL' | 'WMXN' | 'WCOP' | 'WPEN' | 'WCLP';
  amount: number | string;
  address: string;
}): string {
  const basePath =
    params.direction === 'offramp'
      ? 'https://ramp.ripio.com/offramp'
      : 'https://ramp.ripio.com/';
  const search = new URLSearchParams({
    country: params.country,
    chain: String(CELO_CHAIN_ID),
    token: params.token.toUpperCase(),
    amount: String(params.amount),
    address: params.address,
  });
  return `${basePath}?${search.toString()}`;
}

export {
  erc20Abi,
  encodeFunctionData,
  parseAbi,
  privateKeyToAccount,
  generatePrivateKey,
  ERC_8021_MARKER,
};
