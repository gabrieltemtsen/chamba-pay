import { NextRequest, NextResponse } from 'next/server';
import {
  buyCencoriInvoiceInference,
  buyChainstackRpcBatch,
  emitTaggedAgentMainnetTx,
  fetchSqdOnchainIntelligence,
  getAgentMainnetBalances,
  probeLiveBuyQuotes,
  type BuyReceiptItem,
} from '@/lib/buy-engine';
import { quoteOpenCorridor } from '@/lib/corridor-fx';
import { checkAndPrepareErc8004Identity, registerAgentErc8004OnMainnet } from '@/lib/erc8004';
import {
  CHAMBA_ATTRIBUTION_TAG,
  CHAMBA_DATA_SUFFIX,
  verifyCalldataHasChambaTag,
} from '@/lib/celo-rails';

export async function GET() {
  const [balances, erc8004Status, liveQuotes] = await Promise.all([
    getAgentMainnetBalances(),
    checkAndPrepareErc8004Identity(),
    probeLiveBuyQuotes(),
  ]);

  return NextResponse.json({
    ok: true,
    agentName: 'ChambaPay — Tu Money, Sin Borders',
    attributionTag: CHAMBA_ATTRIBUTION_TAG,
    dataSuffix: CHAMBA_DATA_SUFFIX,
    agentWallet: balances,
    erc8004Status,
    liveUseBuyQuotes: liveQuotes,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action = 'full_chamba_pipeline',
      invoiceText = 'Factura #402: Pay Estudio Palermo in Buenos Aires $350 USAT in Argentine Pesos (wARS) for UI/UX design sprint',
      preferredToken = 'USAT',
      recipientAddress = '0x20faAca5F980E29639A0FCC6dcA6988E18ed333B',
    } = body;

    const receipts: BuyReceiptItem[] = [];

    if (action === 'agent_tagged_tx') {
      const txRes = await emitTaggedAgentMainnetTx({
        memoAction: 'chambapay_dashboard_tagged_proof',
        recipient: recipientAddress,
      });
      return NextResponse.json({
        ok: Boolean(txRes.txHash),
        attributionTag: CHAMBA_ATTRIBUTION_TAG,
        txHash: txRes.txHash,
        calldata: txRes.calldata,
        feeMethod: txRes.feeMethod,
        error: txRes.error,
      });
    }

    if (action === 'agent_register_8004') {
      const regRes = await registerAgentErc8004OnMainnet();
      return NextResponse.json({
        ok: true,
        attributionTag: CHAMBA_ATTRIBUTION_TAG,
        txHash: regRes.txHash,
        explorerUrl: regRes.explorerUrl,
      });
    }

    if (action === 'cencori_only') {
      const cencori = await buyCencoriInvoiceInference({ invoiceText, preferredToken });
      const corridor = quoteOpenCorridor({
        fromToken: preferredToken,
        toToken: cencori.parsedInvoice.targetCurrency,
        amountIn: cencori.parsedInvoice.amountSourceUsd,
        recipientAddress,
      });
      return NextResponse.json({
        ok: true,
        attributionTag: CHAMBA_ATTRIBUTION_TAG,
        parsedInvoice: cencori.parsedInvoice,
        corridorQuote: corridor,
        tagVerification: verifyCalldataHasChambaTag(corridor.taggedOrderCalldata),
        receipts: [cencori.receipt],
      });
    }

    if (action === 'chainstack_only') {
      const cs = await buyChainstackRpcBatch(preferredToken);
      return NextResponse.json({
        ok: true,
        attributionTag: CHAMBA_ATTRIBUTION_TAG,
        rpcResults: cs.rpcResults,
        receipts: [cs.receipt],
      });
    }

    if (action === 'sqd_only') {
      const sqd = await fetchSqdOnchainIntelligence();
      return NextResponse.json({
        ok: true,
        attributionTag: CHAMBA_ATTRIBUTION_TAG,
        sqdData: sqd.sqdData,
        receipts: [sqd.receipt],
      });
    }

    // Default: Full Autonomous ChambaPay Pipeline (Cencori LLM + Chainstack RPC + SQD Indexer + Textile FX Quote + Ripio wFIAT)
    const [cencori, sqd] = await Promise.all([
      buyCencoriInvoiceInference({ invoiceText, preferredToken }),
      fetchSqdOnchainIntelligence(),
    ]);
    const chainstack = await buyChainstackRpcBatch(preferredToken);

    receipts.push(cencori.receipt, chainstack.receipt, sqd.receipt);

    const corridorQuote = quoteOpenCorridor({
      fromToken: preferredToken,
      toToken: cencori.parsedInvoice.targetCurrency,
      amountIn: cencori.parsedInvoice.amountSourceUsd,
      recipientAddress,
    });

    const tagCheck = verifyCalldataHasChambaTag(corridorQuote.taggedOrderCalldata);

    return NextResponse.json({
      ok: true,
      attributionTag: CHAMBA_ATTRIBUTION_TAG,
      parsedInvoice: cencori.parsedInvoice,
      corridorQuote,
      tagVerification: tagCheck,
      receipts,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
