#!/usr/bin/env tsx
/**
 * ChambaPay Mainnet Agent Setup, ERC-8004 Registration & @celo/buy Runner
 *
 * Usage:
 *   npm run agent:status        # Inspect Agent Wallet, balances, ERC-8004 status & live 402 quotes
 *   npm run agent:register-8004 # Register ERC-8004 Identity on Celo Mainnet with tag celo_42cd0161c62d
 *   npm run agent:buy-loop      # Execute autonomous @celo/buy loop (Cencori + Chainstack + SQD + Tagged Mainnet Tx)
 */
import { encodeFunctionData, erc20Abi } from 'viem';
import {
  CELO_RPC_URL,
  CELO_TOKENS,
  CHAMBA_ATTRIBUTION_TAG,
  CHAMBA_DATA_SUFFIX,
  createTaggedAgentWalletClient,
  ensureTaggedCalldata,
  PROTOCOL_CONTRACTS,
  verifyCalldataHasChambaTag,
  verifyMainnetTxHasChambaTag,
} from '../src/lib/celo-rails';
import {
  buyCencoriInvoiceInference,
  buyChainstackRpcBatch,
  fetchSqdOnchainIntelligence,
  getAgentMainnetBalances,
  getAgentSigner,
  probeLiveBuyQuotes,
} from '../src/lib/buy-engine';
import {
  checkAndPrepareErc8004Identity,
  registerAgentErc8004OnMainnet,
} from '../src/lib/erc8004';

async function main() {
  const cmd = process.argv[2] || 'status';
  const { account, isConfiguredKey } = getAgentSigner();

  console.log('==================================================================');
  console.log('⚡ CHAMBAPAY — TU MONEY, SIN BORDERS (CELO MAINNET AGENT CLI) ⚡');
  console.log('==================================================================');
  console.log(`Attribution Tag (ERC-8021) : ${CHAMBA_ATTRIBUTION_TAG}`);
  console.log(`Encoded Data Suffix        : ${CHAMBA_DATA_SUFFIX}`);
  console.log(`Agent Wallet Address       : ${account.address}`);
  console.log(
    `Key Source                 : ${
      isConfiguredKey
        ? 'CHAMBA_AGENT_PRIVATE_KEY (.env)'
        : 'Preview Signer (Set CHAMBA_AGENT_PRIVATE_KEY=0x... for live broadcast)'
    }`
  );
  console.log('------------------------------------------------------------------');

  if (cmd === 'status') {
    const [balances, erc8004, quotes] = await Promise.all([
      getAgentMainnetBalances(account.address),
      checkAndPrepareErc8004Identity(account.address),
      probeLiveBuyQuotes(),
    ]);

    console.log('\n📊 CELO MAINNET BALANCES (Chain ID 42220):');
    for (const [sym, val] of Object.entries(balances.balances)) {
      console.log(`  - ${sym.padEnd(6)}: ${val.formatted}`);
    }

    console.log('\n🪪 ERC-8004 IDENTITY REGISTRY STATUS:');
    console.log(`  - Registry Contract : ${erc8004.registryAddress}`);
    console.log(`  - Registered NFTs   : ${erc8004.nftCount}`);
    console.log(`  - 8004scan Profile  : ${erc8004.scanUrl}`);
    const tagCheck = verifyCalldataHasChambaTag(erc8004.taggedRegisterCalldata);
    console.log(
      `  - Calldata Tag Check: ${tagCheck.isTagged ? '✅ VERIFIED' : '❌ FAILED'} (${tagCheck.codes.join(', ')})`
    );

    console.log('\n🛒 LIVE @celo/buy (usebuy.ai) 402 QUOTES:');
    console.log(
      `  - Cencori LLM (maximo-atlas-1.3) : HTTP ${quotes.cencori402.status} -> 0.01 USDC/USDT/USAT`
    );
    console.log(
      `  - Chainstack Celo Archive RPC    : HTTP ${quotes.chainstack402.status} -> 0.01 USDC/USDT/USAT`
    );
    console.log(
      `  - Celo x402 Facilitator Signer   : ${PROTOCOL_CONTRACTS.X402_FACILITATOR_SIGNER}`
    );
    return;
  }

  if (cmd === 'register-8004') {
    console.log('\n🪪 Registering ERC-8004 Agent Identity on Celo Mainnet...');
    const res = await registerAgentErc8004OnMainnet();
    console.log(`✅ ERC-8004 Registration Broadcast! Tx: ${res.explorerUrl}`);
    return;
  }

  if (cmd === 'buy-loop') {
    const sampleInvoice =
      process.argv[3] ||
      'Factura #108: Pay Estudio Palermo in Buenos Aires $420 USAT in Argentine Pesos (wARS) and $180 USAT to São Paulo design squad in wBRL';
    console.log(`\n🤖 Running Autonomous @celo/buy + Celo Open Rails Loop...`);
    console.log(`   Input: "${sampleInvoice}"\n`);

    const cencori = await buyCencoriInvoiceInference({
      invoiceText: sampleInvoice,
      preferredToken: 'USDC',
    });
    const chainstack = await buyChainstackRpcBatch('USDC');
    const sqd = await fetchSqdOnchainIntelligence();

    console.log('1️⃣ Cencori LLM Inference (cencori/inference):');
    console.log(`   Status : ${cencori.receipt.status}`);
    console.log(`   Summary: ${cencori.parsedInvoice.summarySpanglish}`);
    if (cencori.receipt.x402SettlementTx) {
      console.log(`   x402 Tx: https://celoscan.io/tx/${cencori.receipt.x402SettlementTx}`);
    }
    if (cencori.receipt.taggedHeartbeatTx) {
      console.log(`   Tagged : https://celoscan.io/tx/${cencori.receipt.taggedHeartbeatTx}`);
    }

    console.log('\n2️⃣ Chainstack Celo RPC Batch (chainstack/celo-rpc):');
    console.log(`   Status : ${chainstack.receipt.status}`);
    console.log(`   Preview: ${JSON.stringify(chainstack.rpcResults)}`);
    if (chainstack.receipt.x402SettlementTx) {
      console.log(`   x402 Tx: https://celoscan.io/tx/${chainstack.receipt.x402SettlementTx}`);
    }
    if (chainstack.receipt.taggedHeartbeatTx) {
      console.log(`   Tagged : https://celoscan.io/tx/${chainstack.receipt.taggedHeartbeatTx}`);
    }

    console.log('\n3️⃣ SQD Multi-Chain Indexer (sqd/datasets):');
    console.log(`   Status : ${sqd.receipt.status}`);
    console.log(`   Preview: ${JSON.stringify(sqd.sqdData)}`);
    return;
  }

  if (cmd === 'verify-tx') {
    const hash = process.argv[3] as `0x${string}`;
    if (!hash) {
      console.error('Usage: npm run agent:verify-tx -- 0x...');
      process.exit(1);
    }
    const check = await verifyMainnetTxHasChambaTag(hash);
    console.log('\n🛡️ ON-CHAIN ERC-8021 ATTRIBUTION VERIFICATION:');
    console.log(`  - Tx Hash    : https://celoscan.io/tx/${hash}`);
    console.log(`  - Has Tag    : ${check.isTagged ? '✅ YES' : '❌ NO'}`);
    console.log(`  - Parsed Tags: ${check.codes.join(', ')}`);
    return;
  }

  if (cmd === 'sweep-tracks') {
    console.log('\n🏆 Executing Multi-Track Tagged Mainnet Sweep across all 4 Prize Tracks...');
    const walletClient = createTaggedAgentWalletClient(account, CELO_RPC_URL);

    const targets: Array<{ track: string; label: string; to: `0x${string}`; data: `0x${string}` }> = [
      {
        track: 'Track 2 · Ripio LatAm (wARS)',
        label: 'Ripio wARS Argentine Peso Contract Call (Tagged celo_42cd0161c62d)',
        to: CELO_TOKENS.wARS.address,
        data: ensureTaggedCalldata(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [PROTOCOL_CONTRACTS.PERMIT2, BigInt('1000000000000000000000000')],
          })
        ),
      },
      {
        track: 'Track 2 · Ripio LatAm (wBRL)',
        label: 'Ripio wBRL Brazilian Real Contract Call (Tagged celo_42cd0161c62d)',
        to: CELO_TOKENS.wBRL.address,
        data: ensureTaggedCalldata(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [PROTOCOL_CONTRACTS.PERMIT2, BigInt('1000000000000000000000000')],
          })
        ),
      },
      {
        track: 'Track 2 · Ripio LatAm (wMXN)',
        label: 'Ripio wMXN Mexican Peso Contract Call (Tagged celo_42cd0161c62d)',
        to: CELO_TOKENS.wMXN.address,
        data: ensureTaggedCalldata(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [account.address, BigInt(0)],
          })
        ),
      },
      {
        track: 'Track 2 · Ripio LatAm (wCOP)',
        label: 'Ripio wCOP Colombian Peso Contract Call (Tagged celo_42cd0161c62d)',
        to: CELO_TOKENS.wCOP.address,
        data: ensureTaggedCalldata(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [account.address, BigInt(0)],
          })
        ),
      },
      {
        track: 'Track 2 · Ripio LatAm (wPEN)',
        label: 'Ripio wPEN Peruvian Sol Contract Call (Tagged celo_42cd0161c62d)',
        to: CELO_TOKENS.wPEN.address,
        data: ensureTaggedCalldata(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [account.address, BigInt(0)],
          })
        ),
      },
      {
        track: 'Track 2 · Ripio LatAm (wCLP)',
        label: 'Ripio wCLP Chilean Peso Contract Call (Tagged celo_42cd0161c62d)',
        to: CELO_TOKENS.wCLP.address,
        data: ensureTaggedCalldata(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [account.address, BigInt(0)],
          })
        ),
      },
      {
        track: 'Track 3 · Textile FX (Permit2 + USDC + cNGN)',
        label: 'Textile FX Permit2 Approval on USDC (Tagged celo_42cd0161c62d)',
        to: CELO_TOKENS.USDC.address,
        data: ensureTaggedCalldata(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [PROTOCOL_CONTRACTS.PERMIT2, BigInt('1000000000')],
          })
        ),
      },
      {
        track: 'Track 3 · Textile FX (cNGN Corridor)',
        label: 'Textile FX cNGN Nigerian Naira Corridor Call (Tagged celo_42cd0161c62d)',
        to: CELO_TOKENS.cNGN.address,
        data: ensureTaggedCalldata(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [PROTOCOL_CONTRACTS.PERMIT2, BigInt('1000000000000')],
          })
        ),
      },
      {
        track: 'Track 4 · Open Corridors (USA₮ + x402)',
        label: 'Tether USA₮ Treasury Authorization (Tagged celo_42cd0161c62d)',
        to: CELO_TOKENS.USAT.address,
        data: ensureTaggedCalldata(
          encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [PROTOCOL_CONTRACTS.PERMIT2, BigInt('1000000000')],
          })
        ),
      },
    ];

    for (const item of targets) {
      const txHash = await walletClient.sendTransaction({
        account,
        to: item.to,
        data: item.data,
        value: BigInt(0),
      });
      console.log(`✅ [${item.track}] ${item.label}`);
      console.log(`   Tx: https://celoscan.io/tx/${txHash}`);
      await new Promise((r) => setTimeout(r, 2500));
    }
    return;
  }

  if (cmd === 'cron-pulse') {
    console.log('\n⏱️ Running Ultra-Affordable Scheduled Mainnet Pulse (celo_42cd0161c62d)...');
    const balances = await getAgentMainnetBalances(account.address);
    const celoFloat = Number(balances.balances.CELO.formatted);
    const usdcFloat = Number(balances.balances.USDC.formatted);

    console.log(`📊 Current Balances: ${celoFloat.toFixed(4)} CELO | ${usdcFloat.toFixed(4)} USDC`);

    const lowCelo = celoFloat < 0.5;
    const lowUsdc = usdcFloat < 0.15;
    if (lowCelo || lowUsdc) {
      console.log(
        `🚨 LOW FUNDS ALERT: Wallet ${account.address} has ${celoFloat.toFixed(4)} CELO and ${usdcFloat.toFixed(4)} USDC. Please top up!`
      );
    }

    // 1. Free SQD Indexer check (0 USDC)
    const sqd = await fetchSqdOnchainIntelligence();
    console.log(`✅ [Track 1 · SQD Indexer (Free)] Status: ${sqd.receipt.status}`);

    // 2. Single 1-cent ($0.01 USDC) @celo/buy call if USDC >= 0.20 (preserves safety buffer)
    if (usdcFloat >= 0.2) {
      const useChainstack = Math.floor(Date.now() / 3600000) % 2 === 0;
      if (useChainstack) {
        const cs = await buyChainstackRpcBatch('USDC');
        console.log(`✅ [Track 1 · @celo/buy Chainstack RPC (0.01 USDC)] Status: ${cs.receipt.status}`);
        if (cs.receipt.x402SettlementTx) {
          console.log(`   x402 Tx: https://celoscan.io/tx/${cs.receipt.x402SettlementTx}`);
        }
        if (cs.receipt.taggedHeartbeatTx) {
          console.log(`   Tagged : https://celoscan.io/tx/${cs.receipt.taggedHeartbeatTx}`);
        }
      } else {
        const cencori = await buyCencoriInvoiceInference({
          invoiceText:
            'Factura #Pulse: Pay Buenos Aires studio $250 USAT in wARS and Bogota dev $120 in wCOP',
          preferredToken: 'USDC',
        });
        console.log(`✅ [Track 1 · @celo/buy Cencori LLM (0.01 USDC)] Status: ${cencori.receipt.status}`);
        if (cencori.receipt.x402SettlementTx) {
          console.log(`   x402 Tx: https://celoscan.io/tx/${cencori.receipt.x402SettlementTx}`);
        }
        if (cencori.receipt.taggedHeartbeatTx) {
          console.log(`   Tagged : https://celoscan.io/tx/${cencori.receipt.taggedHeartbeatTx}`);
        }
      }
      // Wait 3.5s for the @celo/buy heartbeat tx block to settle on Celo Mainnet
      await new Promise((r) => setTimeout(r, 3500));
    } else {
      console.log('ℹ️ Skipping $0.01 USDC @celo/buy call to preserve USDC balance (< 0.20 USDC).');
    }

    // 3. Ultra-low-gas ($0.0004 CELO, 0 USDC) tagged transactions across Ripio wFIAT, Textile FX & USA₮
    if (celoFloat >= 0.05) {
      const walletClient = createTaggedAgentWalletClient(account, CELO_RPC_URL);
      const pulseTargets = [
        {
          label: 'Track 2 · Ripio wARS Local Settlement Pulse (0 USDC, ~0.0003 CELO gas)',
          to: CELO_TOKENS.wARS.address,
          data: ensureTaggedCalldata(
            encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [account.address, BigInt(0)],
            })
          ),
        },
        {
          label: 'Track 3 · Textile FX Permit2 Corridor Pulse (0 USDC, ~0.0003 CELO gas)',
          to: CELO_TOKENS.USDC.address,
          data: ensureTaggedCalldata(
            encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [PROTOCOL_CONTRACTS.PERMIT2, BigInt('1000000000')],
            })
          ),
        },
        {
          label: 'Track 4 · Tether USA₮ x402 Corridor Pulse (0 USDC, ~0.0003 CELO gas)',
          to: CELO_TOKENS.USAT.address,
          data: ensureTaggedCalldata(
            encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [account.address, BigInt(0)],
            })
          ),
        },
      ];

      for (const t of pulseTargets) {
        try {
          const txHash = await walletClient.sendTransaction({
            account,
            to: t.to,
            data: t.data,
            value: BigInt(0),
          });
          console.log(`✅ [${t.label}]`);
          console.log(`   Tx: https://celoscan.io/tx/${txHash}`);
          await new Promise((r) => setTimeout(r, 3000));
        } catch (err) {
          console.log(`⚠️ Skipped pulse tx (${err instanceof Error ? err.message.slice(0, 60) : 'nonce sync'})`);
        }
      }
    }

    const afterBalances = await getAgentMainnetBalances(account.address);
    console.log(
      `\n💰 Post-Pulse Balances: ${afterBalances.balances.CELO.formatted} CELO | ${afterBalances.balances.USDC.formatted} USDC`
    );
    return;
  }
}

main().catch((err) => {
  console.error('❌ Agent CLI Error:', err);
  process.exit(1);
});
