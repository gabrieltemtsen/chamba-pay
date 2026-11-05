import { encodeFunctionData, parseAbi, type Address, type Hex } from 'viem';
import {
  CHAMBA_ATTRIBUTION_TAG,
  CHAMBA_DATA_SUFFIX,
  CELO_RPC_URL,
  PROTOCOL_CONTRACTS,
  createTaggedAgentWalletClient,
  ensureTaggedCalldata,
  getCeloPublicClient,
} from './celo-rails';
import { getAgentSigner } from './buy-engine';

export const ERC8004_IDENTITY_ABI = parseAbi([
  'function register(string agentURI) external returns (uint256 agentId)',
  'function register() external returns (uint256 agentId)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
]);

/**
 * Builds the canonical ERC-8004 Agent Registration Card JSON for ChambaPay.
 */
export function buildChambaAgentCard(baseUrl: string = 'https://chambapay.celo.org') {
  const { account } = getAgentSigner();
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: 'ChambaPay — Tu Money, Sin Borders (LatAm FX & Payroll Agent)',
    description:
      'Autonomous LatAm cross-border treasury, invoice, and payroll agent on Celo Mainnet. Buys its own Cencori LLM inference & Chainstack/SQD data via @celo/buy (usebuy.ai), settles USD corridors in USA₮ over Celo x402 (api.x402.celo.org), quotes & fills local FX swaps on Textile FX (LimitOrderReactor), and pays out directly in Ripio wFIAT (wARS, wBRL, wMXN, wCOP, wPEN, wCLP) with ERC-8021 attribution tag celo_42cd0161c62d.',
    image: `${baseUrl}/chambapay-avatar.svg`,
    active: true,
    x402Support: true,
    attributionTag: CHAMBA_ATTRIBUTION_TAG,
    agentWallet: account.address,
    chainId: 42220,
    endpoints: [
      {
        name: 'A2A',
        endpoint: `${baseUrl}/api/agent-card`,
        version: '1.0.0',
      },
      {
        name: 'x402-execute',
        endpoint: `${baseUrl}/api/x402-execute`,
        version: '1.0.0',
        pricing: {
          facilitator: 'https://api.x402.celo.org',
          tokens: ['USAT', 'wARS', 'wBRL', 'wCOP', 'USDC', 'USDT'],
        },
      },
      {
        name: 'buy-autonomous-loop',
        endpoint: `${baseUrl}/api/agent-buy`,
        version: '0.8.5',
        providers: ['cencori/inference', 'chainstack/celo-rpc', 'sqd/datasets'],
      },
    ],
    supportedTrust: ['reputation', 'erc-8004', 'self-protocol'],
    registrations: [
      {
        agentRegistry: `eip155:42220:${PROTOCOL_CONTRACTS.ERC8004_IDENTITY_REGISTRY}`,
        reputationRegistry: `eip155:42220:${PROTOCOL_CONTRACTS.ERC8004_REPUTATION_REGISTRY}`,
      },
    ],
  };
}

/**
 * Checks whether an address already holds an ERC-8004 Agent Identity NFT on Celo Mainnet,
 * and constructs the `celo_42cd0161c62d`-tagged registration transaction calldata.
 */
export async function checkAndPrepareErc8004Identity(targetAddress?: Address, agentUri?: string) {
  const { account } = getAgentSigner();
  const owner = targetAddress ?? account.address;
  const uri =
    agentUri ||
    `data:application/json;base64,${Buffer.from(JSON.stringify(buildChambaAgentCard())).toString('base64')}`;

  const publicClient = getCeloPublicClient(CELO_RPC_URL);
  let balance = BigInt(0);
  try {
    balance = await publicClient.readContract({
      address: PROTOCOL_CONTRACTS.ERC8004_IDENTITY_REGISTRY,
      abi: ERC8004_IDENTITY_ABI,
      functionName: 'balanceOf',
      args: [owner],
    });
  } catch {
    balance = BigInt(0);
  }

  const rawRegisterData = encodeFunctionData({
    abi: ERC8004_IDENTITY_ABI,
    functionName: 'register',
    args: [uri],
  });

  const taggedRegisterCalldata = ensureTaggedCalldata(rawRegisterData);

  return {
    owner,
    registryAddress: PROTOCOL_CONTRACTS.ERC8004_IDENTITY_REGISTRY,
    reputationRegistryAddress: PROTOCOL_CONTRACTS.ERC8004_REPUTATION_REGISTRY,
    isRegisteredOnMainnet: balance > BigInt(0),
    nftCount: Number(balance),
    nftBalance: Number(balance),
    attributionTag: CHAMBA_ATTRIBUTION_TAG,
    dataSuffix: CHAMBA_DATA_SUFFIX,
    taggedRegisterCalldata,
    scanUrl: `https://8004scan.io/agents?chain=42220&search=${owner}`,
    celoscanRegistryUrl: `https://celoscan.io/address/${PROTOCOL_CONTRACTS.ERC8004_IDENTITY_REGISTRY}`,
  };
}

/**
 * Registers the Agent's ERC-8004 Identity on Celo Mainnet from the Agent Wallet,
 * automatically tagging the transaction with `celo_42cd0161c62d`.
 */
export async function registerAgentErc8004OnMainnet(customUri?: string) {
  const { account } = getAgentSigner();
  const prep = await checkAndPrepareErc8004Identity(account.address, customUri);
  const walletClient = createTaggedAgentWalletClient(account, CELO_RPC_URL);

  const txHash = await walletClient.sendTransaction({
    account,
    to: PROTOCOL_CONTRACTS.ERC8004_IDENTITY_REGISTRY,
    data: prep.taggedRegisterCalldata,
    value: BigInt(0),
  });

  return {
    txHash,
    owner: account.address,
    registry: PROTOCOL_CONTRACTS.ERC8004_IDENTITY_REGISTRY,
    attributionTag: CHAMBA_ATTRIBUTION_TAG,
    explorerUrl: `https://celoscan.io/tx/${txHash}`,
  };
}

export const registerAgentOnMainnet = registerAgentErc8004OnMainnet;
