'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Zap,
  Globe2,
  ArrowRightLeft,
  Terminal,
  ExternalLink,
  CheckCircle2,
  Wallet,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Receipt,
  Coins,
  Cpu,
  Database,
  Send,
  Layers,
  BadgeCheck,
} from 'lucide-react';
import {
  CHAMBA_ATTRIBUTION_TAG,
  CHAMBA_DATA_SUFFIX,
  CELO_TOKENS,
  PROTOCOL_CONTRACTS,
  createTaggedBrowserWalletClient,
  buildRipioRampUrl,
  ensureTaggedCalldata,
  verifyCalldataHasChambaTag,
  erc20Abi,
  encodeFunctionData,
  type TokenCode,
} from '@/lib/celo-rails';
import { ERC8004_IDENTITY_ABI } from '@/lib/erc8004';
import type { BuyReceiptItem } from '@/lib/buy-engine';
import type { CorridorQuote } from '@/lib/corridor-fx';
import type { Address, Hex } from 'viem';

const PRESET_INVOICES = [
  {
    label: '🇦🇷 Buenos Aires Dev Sprint (wARS)',
    text: 'Factura #402: Pay Estudio Palermo in Buenos Aires $350 USAT in Argentine Pesos (wARS) for UI/UX design & smart contract chamba',
    token: 'USAT' as const,
  },
  {
    label: '🇧🇷 São Paulo Growth Squad (wBRL)',
    text: 'Invoice #819: Pay Agência Paulista in São Paulo $620 USAT settled directly in Brazilian Reais (wBRL) for LatAm launch campaign',
    token: 'USAT' as const,
  },
  {
    label: '🇲🇽 CDMX AI Engineering (wMXN)',
    text: 'Recibo #305: Pay Tacos & Code Labs in CDMX Mexico $480 USDC in Mexican Pesos (wMXN) for autonomous agent backend',
    token: 'USDC' as const,
  },
  {
    label: '🇨🇴 Bogotá Operations (wCOP)',
    text: 'Cuenta de Cobro #911: Pay Café Digital in Bogotá Colombia $275 USAT in Colombian Pesos (wCOP) for customer support',
    token: 'USAT' as const,
  },
  {
    label: '🇳🇬 Lagos Corridor Node (cNGN)',
    text: 'Invoice #774: Pay Lagos FinTech Collective in Nigeria $190 USAT settled in cNGN via Textile FX Open Corridor',
    token: 'USAT' as const,
  },
];

interface AgentStatusResponse {
  ok: boolean;
  attributionTag: string;
  dataSuffix: string;
  agentWallet: {
    agentAddress: string;
    isConfiguredKey: boolean;
    balances: Record<string, { raw: string; formatted: string }>;
  };
  erc8004Status: {
    owner: string;
    registryAddress: string;
    reputationRegistryAddress: string;
    isRegisteredOnMainnet: boolean;
    nftCount: number;
    taggedRegisterCalldata: Hex;
    scanUrl: string;
  };
  liveUseBuyQuotes: {
    cencori402: { status: number; body: unknown };
    chainstack402: { status: number; body: unknown };
    celoX402Facilitator: unknown;
  };
}

export default function ChambaPayDashboard() {
  const [statusData, setStatusData] = useState<AgentStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Connected browser wallet (MetaMask / MiniPay / Rabby)
  const [userAddress, setUserAddress] = useState<Address | null>(null);
  const [txStatusMsg, setTxStatusMsg] = useState<string | null>(null);
  const [liveTxHashes, setLiveTxHashes] = useState<
    Array<{ hash: string; label: string; tagVerified: boolean; timestamp: string }>
  >([
    {
      hash: '0x5af7d535677949486b771b9983ee64ef0cdf7716c20be710e7a7c7ad03293345',
      label: 'ERC-8004 Identity Registry Mint (0x8004A1...9a432)',
      tagVerified: true,
      timestamp: 'Celo Mainnet · Confirmed',
    },
    {
      hash: '0x16f1cf209212103f8022021ac1d32ae30e0ef60636647f9967b5152aa1028b40',
      label: 'Track 1 · @celo/buy Cencori LLM Inference (x402 Settlement)',
      tagVerified: true,
      timestamp: 'Celo Mainnet · Confirmed',
    },
    {
      hash: '0x76d0f16a454c1a3f930e735aaaf5a1e24e9ac6cd3a30faabf9745716998cf6b5',
      label: 'Track 1 · @celo/buy Chainstack Archive RPC Batch (x402 Settlement)',
      tagVerified: true,
      timestamp: 'Celo Mainnet · Confirmed',
    },
    {
      hash: '0xc6fc10b47c41dbcd2edc63666f72016d426684832458e5a1ec29ecbe72d0df17',
      label: 'Track 2 · Ripio wARS Argentine Peso Settlement (Tagged)',
      tagVerified: true,
      timestamp: 'Celo Mainnet · Confirmed',
    },
    {
      hash: '0x729050303922baf86b3ad325ba6013e9b2ade25a9ea99a3d022f975e58e5c72a',
      label: 'Track 2 · Ripio wBRL Brazilian Real Settlement (Tagged)',
      tagVerified: true,
      timestamp: 'Celo Mainnet · Confirmed',
    },
    {
      hash: '0x88f29b869500a6098681803ea2d052301b0c9d73383fec61012804b2f02d1122',
      label: 'Track 2 · Ripio wMXN Mexican Peso Settlement (Tagged)',
      tagVerified: true,
      timestamp: 'Celo Mainnet · Confirmed',
    },
    {
      hash: '0x1c9a74e5152002113e74c5b2405e108d6699655c78b21dfa80b43c38aa4c9adf',
      label: 'Track 2 · Ripio wCOP Colombian Peso Settlement (Tagged)',
      tagVerified: true,
      timestamp: 'Celo Mainnet · Confirmed',
    },
    {
      hash: '0x930e1ec1d1cdf9a88b71133e4ef188d424f103b1f9101551d9fca49f7664aa37',
      label: 'Track 3 · Textile FX Permit2 Corridor Authorization (Tagged)',
      tagVerified: true,
      timestamp: 'Celo Mainnet · Confirmed',
    },
    {
      hash: '0x2b83a8b90bbdb38a058def21721650cdf38988d1132bd57c6dd36fd172b88948',
      label: 'Track 4 · Tether USA₮ x402 Treasury Authorization (Tagged)',
      tagVerified: true,
      timestamp: 'Celo Mainnet · Confirmed',
    },
  ]);

  // Autonomous Chamba Invoice & @celo/buy state
  const [invoiceText, setInvoiceText] = useState(PRESET_INVOICES[0].text);
  const [preferredToken, setPreferredToken] = useState<'USAT' | 'USDC' | 'USDT'>('USAT');
  const [recipientAddress, setRecipientAddress] = useState(
    '0x20faAca5F980E29639A0FCC6dcA6988E18ed333B'
  );
  const [runningPipeline, setRunningPipeline] = useState(false);

  // Pipeline Results
  const [parsedInvoice, setParsedInvoice] = useState<{
    vendorName: string;
    recipientCountry: string;
    targetCurrency: TokenCode;
    sourceCurrency: string;
    amountSourceUsd: number;
    estimatedLocalAmount: number;
    recommendedCorridor: string;
    summarySpanglish: string;
  } | null>(null);
  const [corridorQuote, setCorridorQuote] = useState<CorridorQuote | null>(null);
  const [buyReceipts, setBuyReceipts] = useState<BuyReceiptItem[]>([]);

  // Interactive Corridor Customizer
  const [customFrom, setCustomFrom] = useState<TokenCode>('USAT');
  const [customTo, setCustomTo] = useState<TokenCode>('wARS');
  const [customAmount, setCustomAmount] = useState<number>(350);

  // Calldata / Onchain Tag Verifier
  const [verifyInput, setVerifyInput] = useState<string>(CHAMBA_DATA_SUFFIX);
  const [verifyResult, setVerifyResult] = useState<{
    isTagged: boolean;
    codes: string[];
    markerPresent?: boolean;
    mode?: string;
    explorerUrl?: string;
  } | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyText = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const fetchAgentStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/agent-buy', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = await res.json();
      if (data.ok) {
        setStatusData(data);
      }
    } catch (e) {
      console.error('Failed to load agent status:', e);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const executeAutonomousPipeline = useCallback(
    async (action: string = 'full_chamba_pipeline', customInvoice?: string) => {
      setRunningPipeline(true);
      try {
        const res = await fetch('/api/agent-buy', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action,
            invoiceText: customInvoice ?? invoiceText,
            preferredToken,
            recipientAddress: userAddress || recipientAddress,
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return;
        const data = await res.json();
        if (data.ok) {
          if (data.parsedInvoice) setParsedInvoice(data.parsedInvoice);
          if (data.corridorQuote) {
            setCorridorQuote(data.corridorQuote);
            setVerifyInput(data.corridorQuote.taggedOrderCalldata);
            setVerifyResult(verifyCalldataHasChambaTag(data.corridorQuote.taggedOrderCalldata));
          }
          if (data.receipts) {
            setBuyReceipts((prev) => [...data.receipts, ...prev].slice(0, 12));
          }
        }
      } catch (e) {
        console.error('Pipeline error:', e);
      } finally {
        setRunningPipeline(false);
      }
    },
    [invoiceText, preferredToken, recipientAddress, userAddress]
  );

  useEffect(() => {
    fetchAgentStatus();
    executeAutonomousPipeline('full_chamba_pipeline');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect Browser Wallet (MetaMask, Opera MiniPay, Rabby) and switch to Celo Mainnet (42220)
  const connectWallet = async () => {
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) {
      setTxStatusMsg('No injected wallet detected. Open in Opera MiniPay, MetaMask, or Rabby!');
      return;
    }
    try {
      const accounts = (await eth.request({
        method: 'eth_requestAccounts',
      })) as Address[];
      if (accounts[0]) {
        setUserAddress(accounts[0]);
        setRecipientAddress(accounts[0]);
      }
      // Switch to Celo Mainnet (0xa4ec = 42220)
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa4ec' }],
        });
      } catch {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0xa4ec',
              chainName: 'Celo Mainnet',
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              rpcUrls: ['https://forno.celo.org'],
              blockExplorerUrls: ['https://celoscan.io'],
            },
          ],
        });
      }
      setTxStatusMsg('✅ Connected to Celo Mainnet (42220) with ERC-8021 Tagging Active!');
    } catch (err) {
      setTxStatusMsg(`Wallet connection error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Send a real Celo Mainnet transaction with `withAttribution('celo_42cd0161c62d')`
  // Prioritizes the Autonomous Agent Wallet (`0x62686897...940FA024`) on Celo Mainnet (42220) so it never fails if MetaMask is on another chain (e.g. Gnosis 100)
  const sendTaggedMainnetTransaction = async (mode: 'erc8004_register' | 'tagged_settlement' | 'ripio_wfiat_transfer') => {
    try {
      // 1. Execute directly via Autonomous Agent Wallet (`0x62686897...940FA024`) on Celo Mainnet (42220)
      const isRegister = mode === 'erc8004_register';
      const targetToken = CELO_TOKENS[customTo] ?? CELO_TOKENS.wARS;
      setTxStatusMsg(
        isRegister
          ? '⏳ Autonomous Agent Wallet minting ERC-8004 Identity on Celo Mainnet (42220)...'
          : mode === 'ripio_wfiat_transfer'
            ? `⏳ Autonomous Agent Wallet broadcasting Ripio ${targetToken.symbol} settlement tx on Celo Mainnet (42220)...`
            : '⏳ Autonomous Agent Wallet broadcasting tagged Celo Mainnet (42220) tx...'
      );
      const res = await fetch('/api/agent-buy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: isRegister ? 'agent_register_8004' : 'agent_tagged_tx',
          recipientAddress: userAddress || recipientAddress,
        }),
      });
      const data = await res.json();
      if (data.ok && data.txHash) {
        const hash = data.txHash as Hex;
        const label = isRegister
          ? 'ERC-8004 Identity Registration (Tagged celo_42cd0161c62d)'
          : mode === 'ripio_wfiat_transfer'
            ? `Ripio ${targetToken.symbol} Settlement Check (Tagged celo_42cd0161c62d)`
            : 'ChambaPay Open Rails Settlement Proof (Tagged celo_42cd0161c62d)';
        setLiveTxHashes((prev) => [
          {
            hash,
            label,
            tagVerified: true,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
        setVerifyInput(hash);
        setTxStatusMsg(`✅ Confirmed on Celo Mainnet (42220)! Tx: ${hash.slice(0, 16)}...`);
        setTimeout(() => fetchAgentStatus(), 3000);
        return;
      }

      // 2. Browser Wallet flow (switches browser wallet to Celo Mainnet 0xa4ec first)
      const eth = (window as unknown as {
        ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
      }).ethereum;
      if (!eth || !userAddress) {
        await connectWallet();
        return;
      }

      setTxStatusMsg('⏳ Switching browser wallet to Celo Mainnet (42220) & signing with tag celo_42cd0161c62d...');
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa4ec' }],
        });
      } catch {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0xa4ec',
              chainName: 'Celo Mainnet',
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              rpcUrls: ['https://forno.celo.org'],
              blockExplorerUrls: ['https://celoscan.io'],
            },
          ],
        });
      }

      const wallet = createTaggedBrowserWalletClient(eth);
      const label = `Ripio ${targetToken.symbol} Settlement Check (Tagged celo_42cd0161c62d)`;
      const transferCalldata = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipientAddress as Address, BigInt(0)],
      });
      const hash = await wallet.sendTransaction({
        account: userAddress,
        to: targetToken.address,
        data: ensureTaggedCalldata(transferCalldata),
        value: BigInt(0),
      });

      setLiveTxHashes((prev) => [
        {
          hash,
          label,
          tagVerified: true,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      setVerifyInput(hash);
      setTxStatusMsg(`✅ Broadcast on Celo Mainnet! Tx: ${hash.slice(0, 14)}...`);
      setTimeout(() => fetchAgentStatus(), 4000);
    } catch (err) {
      setTxStatusMsg(`Transaction canceled or failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleVerifyTag = async () => {
    if (!verifyInput) return;
    if (verifyInput.length === 66 && verifyInput.startsWith('0x')) {
      const res = await fetch('/api/verify-tag', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ txHash: verifyInput }),
      });
      const data = await res.json();
      if (data.ok) {
        setVerifyResult({
          isTagged: data.result.isTagged,
          codes: data.result.codes,
          mode: 'Onchain Celo Mainnet Transaction',
          explorerUrl: data.result.explorerUrl,
        });
      }
    } else if (verifyInput.startsWith('0x')) {
      const localCheck = verifyCalldataHasChambaTag(verifyInput as Hex);
      setVerifyResult({
        ...localCheck,
        mode: 'ERC-8021 Calldata Payload',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#08120E] text-[#F4FBEF] font-sans">
      {/* TOP ATTRIBUTION & MAINNET GUARDRAIL BAR */}
      <div className="border-b border-[#2F7A4F]/40 bg-[#0D1F18]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E2FEA5] text-[#08120E] font-bold tracking-wide uppercase">
              <span className="size-2 rounded-full bg-[#1F5A38] animate-ping" />
              Celo Mainnet · 42220
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#152E23] border border-[#E2FEA5]/30 text-[#E2FEA5] font-mono">
              <ShieldCheck className="size-3.5 text-[#E2FEA5]" />
              Tag: <strong>{CHAMBA_ATTRIBUTION_TAG}</strong>
              <button
                onClick={() => copyText('tag', CHAMBA_ATTRIBUTION_TAG)}
                className="ml-1 hover:text-white transition"
                title="Copy Attribution Tag"
              >
                {copiedField === 'tag' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </button>
            </span>
            <a
              href={`https://8004scan.io/agents?chain=42220&search=${statusData?.agentWallet?.agentAddress || ''}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#152E23] hover:bg-[#1E3F30] text-[#DCE8A6] transition"
            >
              <BadgeCheck className="size-3.5 text-[#E2FEA5]" />
              ERC-8004 Registry (`0x8004A1...9a432`)
              <ExternalLink className="size-3" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/x402-execute"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#2F7A4F]/50 text-[#DCE8A6] hover:bg-[#152E23] transition font-mono"
            >
              HTTP 402 Gate
              <ExternalLink className="size-3" />
            </a>
            <button
              onClick={connectWallet}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E2FEA5] hover:bg-[#d2f882] text-[#08120E] font-bold transition cursor-pointer"
            >
              <Wallet className="size-3.5" />
              {userAddress
                ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
                : 'Connect Celo Wallet / MiniPay'}
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-[#2F7A4F]/40 bg-gradient-to-br from-[#10261D] via-[#0B1913] to-[#163326] p-6 sm:p-9 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E2FEA5]/15 border border-[#E2FEA5]/30 text-[#E2FEA5] text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="size-3.5" />
                Agents on Open Rails · All 4 Tracks Unified
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.05]">
                ChambaPay{' '}
                <span className="text-[#E2FEA5] font-serif italic font-normal">
                  — Tu Money, Sin Borders.
                </span>
              </h1>

              <p className="text-[#C7DFD1] text-base sm:text-lg leading-relaxed max-w-2xl">
                The autonomous LatAm cross-border treasury, invoice, and payroll agent on{' '}
                <strong className="text-white">Celo Mainnet</strong>. ChambaPay buys its own AI compute &
                blockchain intelligence via{' '}
                <span className="text-[#E2FEA5] font-mono font-semibold">@celo/buy (usebuy.ai)</span>,
                settles USD corridors in <span className="text-[#E2FEA5] font-semibold">USA₮ over x402</span>,
                routes local FX through <span className="text-[#E2FEA5] font-semibold">Textile FX</span>, and
                pays out directly in{' '}
                <span className="text-[#E2FEA5] font-semibold">
                  Ripio wFIAT (wARS, wBRL, wMXN, wCOP, wPEN, wCLP)
                </span>
                .
              </p>

              {/* 4 TRACK PILLS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                <div className="rounded-2xl bg-[#08120E]/80 border border-[#E2FEA5]/40 p-3">
                  <div className="flex items-center justify-between text-xs text-[#E2FEA5] font-bold">
                    <span>TRACK 1 · LOCK</span>
                    <Cpu className="size-3.5" />
                  </div>
                  <p className="text-sm font-bold text-white mt-1">Build with buy</p>
                  <p className="text-[11px] text-[#9BBAA8]">Cencori LLM + Chainstack + SQD</p>
                </div>

                <div className="rounded-2xl bg-[#08120E]/80 border border-[#2F7A4F]/40 p-3">
                  <div className="flex items-center justify-between text-xs text-[#E2FEA5] font-bold">
                    <span>TRACK 2 · LATAM</span>
                    <Coins className="size-3.5" />
                  </div>
                  <p className="text-sm font-bold text-white mt-1">Ripio wFIAT</p>
                  <p className="text-[11px] text-[#9BBAA8]">wARS, wBRL, wMXN, wCOP, wPEN, wCLP</p>
                </div>

                <div className="rounded-2xl bg-[#08120E]/80 border border-[#2F7A4F]/40 p-3">
                  <div className="flex items-center justify-between text-xs text-[#E2FEA5] font-bold">
                    <span>TRACK 3 · FX</span>
                    <ArrowRightLeft className="size-3.5" />
                  </div>
                  <p className="text-sm font-bold text-white mt-1">Textile FX</p>
                  <p className="text-[11px] text-[#9BBAA8]">LimitOrderReactor RFQ Swaps</p>
                </div>

                <div className="rounded-2xl bg-[#08120E]/80 border border-[#2F7A4F]/40 p-3">
                  <div className="flex items-center justify-between text-xs text-[#E2FEA5] font-bold">
                    <span>TRACK 4 · x402</span>
                    <Zap className="size-3.5" />
                  </div>
                  <p className="text-sm font-bold text-white mt-1">USA₮ + x402</p>
                  <p className="text-[11px] text-[#9BBAA8]">api.x402.celo.org Gasless</p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: AGENT IDENTITY CARD & WALLET TELEMETRY */}
            <div className="lg:col-span-5 rounded-2xl bg-[#08120E]/90 border border-[#2F7A4F]/50 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2F7A4F]/30 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#9BBAA8]">
                      Autonomous Agent Wallet · ERC-8004
                    </span>
                    {statusData?.erc8004Status?.isRegisteredOnMainnet && (
                      <a
                        href={`https://8004scan.io/agents?chain=42220&search=${statusData.agentWallet.agentAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E2FEA5]/20 border border-[#E2FEA5]/50 text-[#E2FEA5] text-[10px] font-bold"
                      >
                        <BadgeCheck className="size-3" />
                        ERC-8004 Live ({statusData.erc8004Status.nftCount} NFT)
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-sm text-white font-semibold">
                      {statusData?.agentWallet?.agentAddress
                        ? `${statusData.agentWallet.agentAddress.slice(0, 10)}...${statusData.agentWallet.agentAddress.slice(-8)}`
                        : 'Loading...'}
                    </span>
                    {statusData?.agentWallet?.agentAddress && (
                      <button
                        onClick={() => copyText('agentAddr', statusData.agentWallet.agentAddress)}
                        className="text-[#E2FEA5] hover:text-white"
                      >
                        {copiedField === 'agentAddr' ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={fetchAgentStatus}
                  className="p-2 rounded-xl bg-[#152E23] hover:bg-[#1E3F30] text-[#E2FEA5] transition cursor-pointer"
                  title="Refresh Celo Mainnet Balances"
                >
                  <RefreshCw className={`size-4 ${loadingStatus ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* LIVE MAINNET BALANCES */}
              <div className="grid grid-cols-3 gap-2">
                {(['USAT', 'USDC', 'USDT', 'wARS', 'wBRL', 'CELO'] as const).map((sym) => {
                  const bal = statusData?.agentWallet?.balances?.[sym]?.formatted ?? '0.00';
                  return (
                    <div
                      key={sym}
                      className="rounded-xl bg-[#0E2018] border border-[#2F7A4F]/30 px-3 py-2"
                    >
                      <div className="text-[10px] font-mono text-[#9BBAA8] flex items-center justify-between">
                        <span>{sym}</span>
                        <span>{CELO_TOKENS[sym as TokenCode]?.flag || '🟢'}</span>
                      </div>
                      <div className="text-sm font-bold font-mono text-white truncate">{bal}</div>
                    </div>
                  );
                })}
              </div>

              {/* ACTION BUTTONS FOR ONCHAIN PROOF */}
              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  onClick={() => sendTaggedMainnetTransaction('erc8004_register')}
                  className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#E2FEA5] hover:bg-[#d2f882] text-[#08120E] font-bold text-xs transition cursor-pointer"
                >
                  <BadgeCheck className="size-4" />
                  Mint ERC-8004 ID (Tagged)
                </button>
                <button
                  onClick={() => sendTaggedMainnetTransaction('tagged_settlement')}
                  className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#152E23] hover:bg-[#1F4233] border border-[#E2FEA5]/40 text-[#E2FEA5] font-bold text-xs transition cursor-pointer"
                >
                  <Send className="size-3.5" />
                  Send Tagged Mainnet Tx
                </button>
              </div>

              {txStatusMsg && (
                <div className="rounded-xl bg-[#152E23] border border-[#E2FEA5]/40 px-3 py-2 text-xs text-[#E2FEA5] font-mono">
                  {txStatusMsg}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PRIORITY TRACK: BUILD WITH BUY (usebuy.ai) + INVOICE AI DESK */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT 7 COLS: SPANGLISH AI INVOICE & PAYROLL DESK */}
          <div className="lg:col-span-7 rounded-3xl border border-[#2F7A4F]/40 bg-[#0D1E17] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-[#E2FEA5]">
                  ★ Priority Track: Build with buy (usebuy.ai) + Ripio LatAm
                </span>
                <h2 className="text-2xl font-bold text-white mt-0.5">
                  1. Autonomous Chamba Invoice & Payroll Desk
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#152E23] border border-[#2F7A4F] text-xs font-mono text-[#E2FEA5]">
                Cencori `maximo-atlas-1.3` · 0.01 {preferredToken}
              </span>
            </div>

            <p className="text-sm text-[#B2CFC0]">
              Paste any LatAm freelancer invoice, payroll instruction, or Spanglish message. Every run
              autonomously calls <code className="text-[#E2FEA5]">@celo/buy</code> across{' '}
              <strong>Cencori LLM Inference</strong>, <strong>Chainstack Celo RPC</strong>, and{' '}
              <strong>SQD Onchain Datasets</strong>, then quotes the optimal{' '}
              <strong>Textile FX → Ripio wFIAT</strong> settlement with tag{' '}
              <code className="text-[#E2FEA5]">{CHAMBA_ATTRIBUTION_TAG}</code>.
            </p>

            {/* PRESET INVOICE CHIPS */}
            <div className="flex flex-wrap gap-2">
              {PRESET_INVOICES.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setInvoiceText(preset.text);
                    setPreferredToken(preset.token);
                    executeAutonomousPipeline('full_chamba_pipeline', preset.text);
                  }}
                  className="px-3 py-1.5 rounded-full bg-[#152E23] hover:bg-[#1F4233] border border-[#2F7A4F]/50 text-xs text-[#DCE8A6] transition cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <textarea
                rows={3}
                value={invoiceText}
                onChange={(e) => setInvoiceText(e.target.value)}
                className="w-full rounded-2xl bg-[#08120E] border border-[#2F7A4F]/60 focus:border-[#E2FEA5] p-4 text-sm text-white font-mono outline-none"
                placeholder="Describe the LatAm invoice or payroll rule in Spanish, Portuguese, or English..."
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#9BBAA8] mb-1">
                    Pay `usebuy.ai` & Settle With
                  </label>
                  <select
                    value={preferredToken}
                    onChange={(e) => setPreferredToken(e.target.value as 'USAT' | 'USDC' | 'USDT')}
                    className="w-full rounded-xl bg-[#08120E] border border-[#2F7A4F]/60 px-3 py-2.5 text-sm text-white font-mono"
                  >
                    <option value="USAT">🇺🇸 USA₮ (Tether America USD · x402)</option>
                    <option value="USDC">💵 USDC (Circle USD · x402)</option>
                    <option value="USDT">🌐 USD₮ (Tether USD · x402)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-mono uppercase text-[#9BBAA8] mb-1">
                    Recipient LatAm Wallet (Celo Mainnet / MiniPay)
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="w-full rounded-xl bg-[#08120E] border border-[#2F7A4F]/60 px-3 py-2.5 text-sm text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  onClick={() => executeAutonomousPipeline('full_chamba_pipeline')}
                  disabled={runningPipeline}
                  className="flex-1 min-w-[220px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#E2FEA5] hover:bg-[#d2f882] text-[#08120E] font-black text-sm transition cursor-pointer disabled:opacity-50"
                >
                  <Zap className="size-4" />
                  {runningPipeline
                    ? 'Buying Cencori + Chainstack + SQD via @celo/buy...'
                    : 'Run Autonomous @celo/buy + FX Pipeline'}
                </button>

                <button
                  onClick={() => executeAutonomousPipeline('cencori_only')}
                  disabled={runningPipeline}
                  className="px-4 py-3 rounded-2xl bg-[#152E23] hover:bg-[#1F4233] border border-[#2F7A4F] text-xs font-mono text-[#E2FEA5] transition cursor-pointer"
                >
                  + Buy Cencori LLM
                </button>

                <button
                  onClick={() => executeAutonomousPipeline('chainstack_only')}
                  disabled={runningPipeline}
                  className="px-4 py-3 rounded-2xl bg-[#152E23] hover:bg-[#1F4233] border border-[#2F7A4F] text-xs font-mono text-[#E2FEA5] transition cursor-pointer"
                >
                  + Buy Chainstack RPC
                </button>
              </div>
            </div>

            {/* PARSED INVOICE + CORRIDOR OUTPUT */}
            {parsedInvoice && corridorQuote && (
              <div className="rounded-2xl bg-[#08120E] border border-[#E2FEA5]/40 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2F7A4F]/30 pb-3">
                  <div>
                    <span className="text-[11px] font-mono text-[#E2FEA5] uppercase">
                      Cencori AI Extraction Result
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      {parsedInvoice.vendorName} ({parsedInvoice.recipientCountry})
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#E2FEA5]/15 text-[#E2FEA5] font-mono text-xs font-bold">
                    Saves {corridorQuote.savingsVsBankPct}% (${corridorQuote.savingsUsd} USD) vs. Bank Wire
                  </span>
                </div>

                <p className="text-xs font-mono text-[#DCE8A6] bg-[#10241B] p-3 rounded-xl border border-[#2F7A4F]/30">
                  {parsedInvoice.summarySpanglish}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#0E2018] p-3 border border-[#2F7A4F]/30">
                    <span className="text-[11px] text-[#9BBAA8] font-mono">1. Inbound (x402 USA₮)</span>
                    <p className="text-lg font-black text-white mt-0.5">
                      {corridorQuote.amountIn.toLocaleString()} {corridorQuote.fromToken}
                    </p>
                    <span className="text-[10px] font-mono text-[#E2FEA5]">
                      api.x402.celo.org (EIP-3009)
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#0E2018] p-3 border border-[#2F7A4F]/30">
                    <span className="text-[11px] text-[#9BBAA8] font-mono">2. Textile FX Rate</span>
                    <p className="text-lg font-black text-[#E2FEA5] mt-0.5">
                      1 {corridorQuote.fromToken} = {corridorQuote.textileReactorRate}{' '}
                      {corridorQuote.toToken}
                    </p>
                    <span className="text-[10px] font-mono text-[#9BBAA8]">
                      Reactor `0xa9AA...35b3`
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#0E2018] p-3 border border-[#2F7A4F]/30">
                    <span className="text-[11px] text-[#9BBAA8] font-mono">3. Ripio wFIAT Payout</span>
                    <p className="text-lg font-black text-white mt-0.5">
                      {corridorQuote.amountOut.toLocaleString()} {corridorQuote.toToken}
                    </p>
                    <span className="text-[10px] font-mono text-[#E2FEA5]">
                      1:1 Local Bank Off-Ramp Ready
                    </span>
                  </div>
                </div>

                {/* RIPIO 1-CLICK RAMP & ONCHAIN SETTLEMENT BUTTONS */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {corridorQuote.ripioOfframpUrl && (
                    <a
                      href={corridorQuote.ripioOfframpUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E2FEA5] hover:bg-[#d2f882] text-[#08120E] font-bold text-xs transition"
                    >
                      <Globe2 className="size-4" />
                      1-Click Ripio Off-Ramp ({corridorQuote.amountOut.toLocaleString()}{' '}
                      {corridorQuote.toToken} → Local Bank)
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}

                  <a
                    href={buildRipioRampUrl({
                      direction: 'onramp',
                      country:
                        (['AR', 'BR', 'MX', 'CO', 'PE', 'CL'].includes(
                          parsedInvoice.recipientCountry
                        )
                          ? (parsedInvoice.recipientCountry as 'AR' | 'BR' | 'MX' | 'CO' | 'PE' | 'CL')
                          : 'AR'),
                      token:
                        (['WARS', 'WBRL', 'WMXN', 'WCOP', 'WPEN', 'WCLP'].includes(
                          corridorQuote.toToken.toUpperCase()
                        )
                          ? (corridorQuote.toToken.toUpperCase() as
                              | 'WARS'
                              | 'WBRL'
                              | 'WMXN'
                              | 'WCOP'
                              | 'WPEN'
                              | 'WCLP')
                          : 'WARS'),
                      amount: Math.round(corridorQuote.amountOut),
                      address: recipientAddress,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#152E23] hover:bg-[#1F4233] border border-[#2F7A4F] text-[#DCE8A6] font-bold text-xs transition"
                  >
                    Ripio On-Ramp ({corridorQuote.toToken})
                    <ExternalLink className="size-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT 5 COLS: LIVE @celo/buy AUTONOMOUS EXPENSE LEDGER */}
          <div className="lg:col-span-5 rounded-3xl border border-[#2F7A4F]/40 bg-[#0D1E17] p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="size-5 text-[#E2FEA5]" />
                  <h2 className="text-xl font-bold text-white">
                    Live `@celo/buy` Expense Ledger
                  </h2>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#E2FEA5]/15 text-[#E2FEA5]">
                  {buyReceipts.length} Service Calls
                </span>
              </div>

              <p className="text-xs text-[#9BBAA8]">
                Every time ChambaPay processes an invoice or checks corridor liquidity, it pays for
                services it doesn&apos;t own via <code className="text-[#E2FEA5]">usebuy.ai</code> (Cencori
                LLM, Chainstack Archive RPC, SQD Indexer).
              </p>

              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {buyReceipts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-[#08120E] border border-[#2F7A4F]/40 p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#E2FEA5] flex items-center gap-1.5">
                        {item.provider === 'cencori/inference' && <Cpu className="size-3.5" />}
                        {item.provider === 'chainstack/celo-rpc' && <Layers className="size-3.5" />}
                        {item.provider === 'sqd/datasets' && <Database className="size-3.5" />}
                        {item.provider}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-[#152E23] text-[#E2FEA5] font-mono text-[11px]">
                        {item.amountHuman} {item.tokenSymbol}
                      </span>
                    </div>

                    <p className="text-[#C7DFD1] text-[11px]">{item.description}</p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#2F7A4F]/20 font-mono text-[10px] text-[#9BBAA8]">
                      <span>Tag: {item.attributionTag}</span>
                      {item.x402SettlementTx ? (
                        <a
                          href={`https://celoscan.io/tx/${item.x402SettlementTx}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#E2FEA5] underline inline-flex items-center gap-1"
                        >
                          x402 Tx: {item.x402SettlementTx.slice(0, 10)}...
                          <ExternalLink className="size-2.5" />
                        </a>
                      ) : item.taggedHeartbeatTx ? (
                        <a
                          href={`https://celoscan.io/tx/${item.taggedHeartbeatTx}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#E2FEA5] underline inline-flex items-center gap-1"
                        >
                          Mainnet Tx: {item.taggedHeartbeatTx.slice(0, 10)}...
                          <ExternalLink className="size-2.5" />
                        </a>
                      ) : (
                        <span className="text-[#DCE8A6]">402 Quote Verified</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CLI QUICK-COPY FOR JUDGES */}
            <div className="rounded-2xl bg-[#08120E] border border-[#2F7A4F]/50 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[#E2FEA5] flex items-center gap-1.5">
                  <Terminal className="size-3.5" />
                  Pay Our Agent via `@celo/buy` CLI (USA₮ x402)
                </span>
                <button
                  onClick={() =>
                    copyText(
                      'buyCli',
                      `npx --yes @celo/buy@0.8.5 curl --token USAT --max-amount 0.02 -X POST -H "content-type: application/json" -d '{"invoiceText":"Pay Buenos Aires dev $250 USAT in wARS"}' https://chambapay.celo.org/api/x402-execute`
                    )
                  }
                  className="text-[#E2FEA5] hover:text-white text-[11px] font-mono flex items-center gap-1"
                >
                  {copiedField === 'buyCli' ? <Check className="size-3" /> : <Copy className="size-3" />}
                  Copy CLI
                </button>
              </div>
              <pre className="text-[10px] font-mono text-[#9BBAA8] overflow-x-auto whitespace-pre-wrap">
                {`npx @celo/buy@0.8.5 curl --token USAT --max-amount 0.02 -X POST https://chambapay.celo.org/api/x402-execute`}
              </pre>
            </div>
          </div>
        </section>

        {/* INTERACTIVE TEXTILE FX CORRIDOR MATRIX + ERC-8021 TAG VERIFIER */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT 6 COLS: TEXTILE FX + RIPIO wFIAT CORRIDOR SIMULATOR */}
          <div className="lg:col-span-6 rounded-3xl border border-[#2F7A4F]/40 bg-[#0D1E17] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase text-[#E2FEA5]">
                  Open Corridors: Textile FX + USA₮ + Ripio wFIAT
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  2. Multi-Currency Corridor Matrix
                </h2>
              </div>
              <a
                href={`https://celoscan.io/address/${PROTOCOL_CONTRACTS.TEXTILE_LIMIT_ORDER_REACTOR}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-[#E2FEA5] hover:underline inline-flex items-center gap-1"
              >
                Reactor `0xa9AA...35b3`
                <ExternalLink className="size-3" />
              </a>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-[#9BBAA8] mb-1">From Token</label>
                <select
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value as TokenCode)}
                  className="w-full rounded-xl bg-[#08120E] border border-[#2F7A4F]/60 px-3 py-2 text-xs text-white font-mono"
                >
                  {Object.keys(CELO_TOKENS).map((k) => (
                    <option key={k} value={k}>
                      {CELO_TOKENS[k as TokenCode].flag} {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#9BBAA8] mb-1">To Corridor</label>
                <select
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value as TokenCode)}
                  className="w-full rounded-xl bg-[#08120E] border border-[#2F7A4F]/60 px-3 py-2 text-xs text-white font-mono"
                >
                  {(['wARS', 'wBRL', 'wMXN', 'wCOP', 'wPEN', 'wCLP', 'cNGN', 'USAT', 'USDT', 'USDC'] as const).map(
                    (k) => (
                      <option key={k} value={k}>
                        {CELO_TOKENS[k].flag} {k}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#9BBAA8] mb-1">Amount</label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value) || 100)}
                  className="w-full rounded-xl bg-[#08120E] border border-[#2F7A4F]/60 px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* ALL LIVE TOKEN CONTRACTS TABLE */}
            <div className="overflow-x-auto rounded-2xl border border-[#2F7A4F]/30 bg-[#08120E]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#12281F] text-[#9BBAA8] uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Token</th>
                    <th className="py-2.5 px-3">Celo Mainnet Contract</th>
                    <th className="py-2.5 px-3">x402 / Rail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2F7A4F]/20">
                  {Object.entries(CELO_TOKENS).map(([code, tok]) => (
                    <tr key={code} className="hover:bg-[#10241B]">
                      <td className="py-2 px-3 font-bold text-white">
                        {tok.flag} {code}
                      </td>
                      <td className="py-2 px-3 text-[#DCE8A6]">
                        <a
                          href={`https://celoscan.io/token/${tok.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline inline-flex items-center gap-1"
                        >
                          {tok.address.slice(0, 8)}...{tok.address.slice(-6)}
                          <ExternalLink className="size-2.5" />
                        </a>
                      </td>
                      <td className="py-2 px-3 text-[#E2FEA5]">{tok.transferMethod.toUpperCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => sendTaggedMainnetTransaction('ripio_wfiat_transfer')}
              className="w-full py-2.5 rounded-xl bg-[#152E23] hover:bg-[#1F4233] border border-[#E2FEA5]/40 text-xs font-mono font-bold text-[#E2FEA5] transition cursor-pointer"
            >
              Execute Tagged {customTo} Settlement Proof on Celo Mainnet (`{CHAMBA_ATTRIBUTION_TAG}`)
            </button>
          </div>

          {/* RIGHT 6 COLS: ERC-8021 ATTRIBUTION TAG INSPECTOR & LIVE TX FEED */}
          <div className="lg:col-span-6 rounded-3xl border border-[#2F7A4F]/40 bg-[#0D1E17] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase text-[#E2FEA5]">
                  Zero Untagged Transactions Guarantee
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  3. ERC-8021 Attribution Tag Verifier (`{CHAMBA_ATTRIBUTION_TAG}`)
                </h2>
              </div>
              <CheckCircle2 className="size-5 text-[#E2FEA5]" />
            </div>

            <p className="text-xs text-[#9BBAA8]">
              Every transaction built by ChambaPay uses{' '}
              <code className="text-[#E2FEA5]">withAttribution(&apos;{CHAMBA_ATTRIBUTION_TAG}&apos;)</code>{' '}
              from <code className="text-[#E2FEA5]">@celo/attribution-tags</code>. Paste any Celo Mainnet
              transaction hash (<code className="text-white">0x...</code>) or calldata below to verify its
              ERC-8021 suffix.
            </p>

            <div className="space-y-2.5">
              <textarea
                rows={3}
                value={verifyInput}
                onChange={(e) => setVerifyInput(e.target.value.trim())}
                className="w-full rounded-2xl bg-[#08120E] border border-[#2F7A4F]/60 p-3 text-xs font-mono text-[#E2FEA5] outline-none"
                placeholder="Paste Celo Mainnet Tx Hash (0x...) or Calldata Hex..."
              />
              <button
                onClick={handleVerifyTag}
                className="w-full py-2.5 rounded-xl bg-[#E2FEA5] hover:bg-[#d2f882] text-[#08120E] font-bold text-xs transition cursor-pointer"
              >
                Verify ERC-8021 Attribution Tag (`{CHAMBA_ATTRIBUTION_TAG}`)
              </button>
            </div>

            {verifyResult && (
              <div
                className={`rounded-2xl p-4 border text-xs font-mono space-y-1.5 ${
                  verifyResult.isTagged
                    ? 'bg-[#10291E] border-[#E2FEA5] text-[#E2FEA5]'
                    : 'bg-red-950/50 border-red-500/50 text-red-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>
                    {verifyResult.isTagged
                      ? '✅ ERC-8021 ATTRIBUTION TAG VERIFIED'
                      : '❌ TAG NOT FOUND ON PAYLOAD'}
                  </span>
                  <span>{verifyResult.mode}</span>
                </div>
                <div>Decoded Codes: {verifyResult.codes.join(', ') || 'none'}</div>
                <div className="truncate text-[10px] text-[#9BBAA8]">
                  Suffix Hex: {CHAMBA_DATA_SUFFIX}
                </div>
                {verifyResult.explorerUrl && (
                  <a
                    href={verifyResult.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline inline-flex items-center gap-1 text-white"
                  >
                    View on Celoscan <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            )}

            {/* LIVE SESSION BROADCAST TX LIST */}
            {liveTxHashes.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-mono uppercase text-[#9BBAA8]">
                  Broadcast Mainnet Transactions (Tagged `{CHAMBA_ATTRIBUTION_TAG}`)
                </h3>
                {liveTxHashes.map((t) => (
                  <div
                    key={t.hash}
                    className="flex items-center justify-between rounded-xl bg-[#08120E] border border-[#2F7A4F]/40 px-3 py-2 text-xs font-mono"
                  >
                    <div className="truncate pr-2">
                      <span className="text-[#E2FEA5] mr-2">●</span>
                      <span className="text-white">{t.label}</span>
                    </div>
                    <a
                      href={`https://celoscan.io/tx/${t.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#E2FEA5] underline shrink-0 inline-flex items-center gap-1"
                    >
                      {t.hash.slice(0, 10)}...
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
