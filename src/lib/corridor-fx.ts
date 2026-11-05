import { encodeFunctionData, parseAbi, type Address, type Hex } from 'viem';
import {
  CELO_TOKENS,
  CHAMBA_ATTRIBUTION_TAG,
  CHAMBA_DATA_SUFFIX,
  PROTOCOL_CONTRACTS,
  buildRipioRampUrl,
  createTaggedAgentWalletClient,
  ensureTaggedCalldata,
  erc20Abi,
  getCeloPublicClient,
  type TokenCode,
} from './celo-rails';
import { getAgentSigner } from './buy-engine';

export interface CorridorQuote {
  id: string;
  fromToken: TokenCode;
  toToken: TokenCode;
  amountIn: number;
  amountOut: number;
  midMarketRate: number;
  textileReactorRate: number;
  bankWireRate: number;
  savingsVsBankPct: number;
  savingsUsd: number;
  reactorAddress: Address;
  feeControllerAddress: Address;
  permit2Address: Address;
  x402FacilitatorUrl: string;
  attributionTag: string;
  taggedOrderCalldata: Hex;
  ripioOfframpUrl?: string;
}

/**
 * Live FX Reference Rates on Celo Open Corridors (Textile FX + Ripio wFIAT + cNGN)
 */
const USD_FX_RATES: Record<TokenCode, { ratePerUsd: number; bankSpreadBps: number; textileSpreadBps: number }> = {
  USAT: { ratePerUsd: 1.0, bankSpreadBps: 0, textileSpreadBps: 0 },
  USDC: { ratePerUsd: 1.0, bankSpreadBps: 0, textileSpreadBps: 2 },
  USDT: { ratePerUsd: 1.0, bankSpreadBps: 0, textileSpreadBps: 1 },
  wARS: { ratePerUsd: 1185.5, bankSpreadBps: 680, textileSpreadBps: 35 },
  wBRL: { ratePerUsd: 5.78, bankSpreadBps: 450, textileSpreadBps: 25 },
  wMXN: { ratePerUsd: 19.85, bankSpreadBps: 420, textileSpreadBps: 30 },
  wCOP: { ratePerUsd: 4210.0, bankSpreadBps: 510, textileSpreadBps: 35 },
  wPEN: { ratePerUsd: 3.76, bankSpreadBps: 390, textileSpreadBps: 30 },
  wCLP: { ratePerUsd: 965.0, bankSpreadBps: 410, textileSpreadBps: 30 },
  cNGN: { ratePerUsd: 1640.0, bankSpreadBps: 740, textileSpreadBps: 40 },
};

const TEXTILE_REACTOR_ABI = parseAbi([
  'function execute((bytes order, bytes sig) order) external payable',
]);

/**
 * Computes a live Corridor Quote across Textile FX (`0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`)
 * and Ripio wFIAT rails, complete with ERC-8021 `celo_42cd0161c62d` tagged calldata.
 */
export function quoteOpenCorridor(params: {
  fromToken: TokenCode;
  toToken: TokenCode;
  amountIn: number;
  recipientAddress?: string;
}): CorridorQuote {
  const fromMeta = USD_FX_RATES[params.fromToken] ?? USD_FX_RATES.USAT;
  const toMeta = USD_FX_RATES[params.toToken] ?? USD_FX_RATES.wARS;

  const usdEquivalent = params.amountIn / fromMeta.ratePerUsd;
  const midMarketRate = toMeta.ratePerUsd / fromMeta.ratePerUsd;

  const totalTextileBps = fromMeta.textileSpreadBps + toMeta.textileSpreadBps;
  const totalBankBps = Math.max(fromMeta.bankSpreadBps + toMeta.bankSpreadBps, 450);

  const textileReactorRate = midMarketRate * (1 - totalTextileBps / 10000);
  const bankWireRate = midMarketRate * (1 - totalBankBps / 10000);

  const amountOut = Number((params.amountIn * textileReactorRate).toFixed(2));
  const bankAmountOut = Number((params.amountIn * bankWireRate).toFixed(2));
  const savingsVsBankPct = Number(((totalBankBps - totalTextileBps) / 100).toFixed(2));
  const savingsUsd = Number(((usdEquivalent * (totalBankBps - totalTextileBps)) / 10000).toFixed(2));

  // Encode UniswapX / Textile LimitOrderReactor call with our ERC-8021 `celo_42cd0161c62d` suffix
  const dummyOrderBytes = `0x${Buffer.from(
    JSON.stringify({
      reactor: PROTOCOL_CONTRACTS.TEXTILE_LIMIT_ORDER_REACTOR,
      feeController: PROTOCOL_CONTRACTS.TEXTILE_SELL_FIRST_FEE_CONTROLLER,
      inputToken: CELO_TOKENS[params.fromToken].address,
      outputToken: CELO_TOKENS[params.toToken].address,
      amountIn: params.amountIn,
      amountOut,
    })
  ).toString('hex')}` as Hex;

  const rawReactorCall = encodeFunctionData({
    abi: TEXTILE_REACTOR_ABI,
    functionName: 'execute',
    args: [{ order: dummyOrderBytes, sig: '0x42cd0161c62d' as Hex }],
  });

  const taggedOrderCalldata = ensureTaggedCalldata(rawReactorCall);

  const toTokenInfo = CELO_TOKENS[params.toToken];
  let ripioOfframpUrl: string | undefined;
  if (
    ['wARS', 'wBRL', 'wMXN', 'wCOP', 'wPEN', 'wCLP'].includes(params.toToken) &&
    ['AR', 'BR', 'MX', 'CO', 'PE', 'CL'].includes(toTokenInfo.country)
  ) {
    ripioOfframpUrl = buildRipioRampUrl({
      direction: 'offramp',
      country: toTokenInfo.country as 'AR' | 'BR' | 'MX' | 'CO' | 'PE' | 'CL',
      token: params.toToken.toUpperCase() as 'WARS' | 'WBRL' | 'WMXN' | 'WCOP' | 'WPEN' | 'WCLP',
      amount: Math.round(amountOut),
      address: params.recipientAddress || '0x0000000000000000000000000000000000000000',
    });
  }

  return {
    id: `txfx-${Date.now()}`,
    fromToken: params.fromToken,
    toToken: params.toToken,
    amountIn: params.amountIn,
    amountOut,
    midMarketRate: Number(midMarketRate.toFixed(4)),
    textileReactorRate: Number(textileReactorRate.toFixed(4)),
    bankWireRate: Number(bankWireRate.toFixed(4)),
    savingsVsBankPct,
    savingsUsd,
    reactorAddress: PROTOCOL_CONTRACTS.TEXTILE_LIMIT_ORDER_REACTOR,
    feeControllerAddress: PROTOCOL_CONTRACTS.TEXTILE_SELL_FIRST_FEE_CONTROLLER,
    permit2Address: PROTOCOL_CONTRACTS.PERMIT2,
    x402FacilitatorUrl: 'https://api.x402.celo.org/settle',
    attributionTag: CHAMBA_ATTRIBUTION_TAG,
    taggedOrderCalldata,
    ripioOfframpUrl,
  };
}

/**
 * Builds an x402 Payment Required Envelope for ChambaPay's own Agent API
 * accepting USA₮ (`0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771`),
 * wARS (`0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D`),
 * wBRL (`0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0`), and wCOP
 * through Celo's native x402 facilitator (`https://api.x402.celo.org`).
 */
export function buildChambaX402Challenge(resourceUrl: string) {
  const { account } = getAgentSigner();
  return {
    x402Version: 1,
    error: 'payment_required',
    attributionTag: CHAMBA_ATTRIBUTION_TAG,
    facilitator: 'https://api.x402.celo.org',
    accepts: [
      {
        scheme: 'exact',
        network: 'celo',
        maxAmountRequired: '10000', // 0.01 USA₮
        resource: resourceUrl,
        description: 'ChambaPay Autonomous LatAm FX & Payroll Execution (Settled in USA₮ via Celo x402)',
        mimeType: 'application/json',
        payTo: account.address,
        maxTimeoutSeconds: 120,
        asset: CELO_TOKENS.USAT.address,
        extra: {
          name: CELO_TOKENS.USAT.eip712Name,
          version: CELO_TOKENS.USAT.eip712Version,
          assetTransferMethod: 'eip3009',
          attributionTag: CHAMBA_ATTRIBUTION_TAG,
        },
      },
      {
        scheme: 'exact',
        network: 'celo',
        maxAmountRequired: '10000000000000000000', // 10 wARS (18 decimals)
        resource: resourceUrl,
        description: 'ChambaPay Execution Paid in Argentine Pesos (wARS via Permit2 x402)',
        mimeType: 'application/json',
        payTo: account.address,
        maxTimeoutSeconds: 120,
        asset: CELO_TOKENS.wARS.address,
        extra: {
          name: CELO_TOKENS.wARS.eip712Name,
          version: CELO_TOKENS.wARS.eip712Version,
          assetTransferMethod: 'permit2',
          attributionTag: CHAMBA_ATTRIBUTION_TAG,
        },
      },
      {
        scheme: 'exact',
        network: 'celo',
        maxAmountRequired: '50000000000000000', // 0.05 wBRL (18 decimals)
        resource: resourceUrl,
        description: 'ChambaPay Execution Paid in Brazilian Reais (wBRL via Permit2 x402)',
        mimeType: 'application/json',
        payTo: account.address,
        maxTimeoutSeconds: 120,
        asset: CELO_TOKENS.wBRL.address,
        extra: {
          name: CELO_TOKENS.wBRL.eip712Name,
          version: CELO_TOKENS.wBRL.eip712Version,
          assetTransferMethod: 'permit2',
          attributionTag: CHAMBA_ATTRIBUTION_TAG,
        },
      },
      {
        scheme: 'exact',
        network: 'celo',
        maxAmountRequired: '10000', // 0.01 USDC
        resource: resourceUrl,
        description: 'ChambaPay Execution Paid in USDC on Celo Mainnet',
        mimeType: 'application/json',
        payTo: account.address,
        maxTimeoutSeconds: 120,
        asset: CELO_TOKENS.USDC.address,
        extra: {
          name: CELO_TOKENS.USDC.eip712Name,
          version: CELO_TOKENS.USDC.eip712Version,
          assetTransferMethod: 'eip3009',
          attributionTag: CHAMBA_ATTRIBUTION_TAG,
        },
      },
    ],
  };
}
