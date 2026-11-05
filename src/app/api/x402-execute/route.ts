import { NextRequest, NextResponse } from 'next/server';
import { buildChambaX402Challenge, quoteOpenCorridor } from '@/lib/corridor-fx';
import { buyCencoriInvoiceInference } from '@/lib/buy-engine';
import { CHAMBA_ATTRIBUTION_TAG, verifyCalldataHasChambaTag, type TokenCode } from '@/lib/celo-rails';

const CELO_FACILITATOR_URL = 'https://api.x402.celo.org';

async function settleWithCeloFacilitator(
  requirements: Record<string, unknown>,
  payment: Record<string, unknown>
) {
  const wireBody = {
    x402Version: 1,
    paymentPayload: {
      x402Version: payment.x402Version ?? 1,
      scheme: payment.scheme,
      network: payment.network,
      payload: payment.payload,
    },
    paymentRequirements: requirements,
  };
  const res = await fetch(`${CELO_FACILITATOR_URL}/settle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wireBody),
  });
  const data = await res.json();
  if (!res.ok || data?.success !== true) {
    throw new Error(data?.errorMessage || data?.errorReason || `Celo x402 settle HTTP ${res.status}`);
  }
  return data;
}

/**
 * ChambaPay's native x402 Paywalled Agent Execution Endpoint!
 * - Unpaid GET/POST returns HTTP `402 Payment Required` advertising USA₮, wARS, wBRL, and USDC on Celo Mainnet (`eip155:42220`).
 * - When called with `X-PAYMENT` (from `@celo/buy curl`, another agent, or the UI), it verifies & settles through `https://api.x402.celo.org`.
 */
export async function GET(req: NextRequest) {
  const challenge = buildChambaX402Challenge(req.url);
  return NextResponse.json(challenge, {
    status: 402,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'X-Attribution-Tag': CHAMBA_ATTRIBUTION_TAG,
    },
  });
}

export async function POST(req: NextRequest) {
  const paymentHeader = req.headers.get('x-payment') || req.headers.get('payment-signature');
  const challenge = buildChambaX402Challenge(req.url);

  let body: {
    invoiceText?: string;
    fromToken?: TokenCode;
    toToken?: TokenCode;
    amountIn?: number;
    recipientAddress?: string;
    simulatex402Demo?: boolean;
  } = {};

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // If no X-PAYMENT header and not explicitly running interactive preview, return authoritative HTTP 402
  if (!paymentHeader && !body.simulatex402Demo) {
    return NextResponse.json(challenge, {
      status: 402,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'X-Attribution-Tag': CHAMBA_ATTRIBUTION_TAG,
      },
    });
  }

  let settlementResult: unknown = null;

  if (paymentHeader) {
    try {
      const decodedPayment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf8'));
      const matchingReq =
        challenge.accepts.find(
          (a) =>
            a.asset.toLowerCase() ===
            decodedPayment?.payload?.authorization?.to?.toLowerCase()
        ) ?? challenge.accepts[0];

      const settled = await settleWithCeloFacilitator(
        matchingReq as unknown as Record<string, unknown>,
        decodedPayment
      );
      settlementResult = settled;
    } catch (err) {
      return NextResponse.json(
        {
          error: 'x402_settlement_failed',
          reason: err instanceof Error ? err.message : String(err),
          facilitator: CELO_FACILITATOR_URL,
        },
        { status: 402 }
      );
    }
  }

  // Execute the ChambaPay Autonomous Loop (buys Cencori LLM via @celo/buy + quotes Textile FX + generates Ripio wFIAT payout)
  const invoiceText =
    body.invoiceText ||
    `Pay ${body.amountIn || 250} ${body.fromToken || 'USAT'} to ${body.toToken || 'wARS'} vendor in Buenos Aires`;

  const cencori = await buyCencoriInvoiceInference({
    invoiceText,
    preferredToken: 'USAT',
  });

  const quote = quoteOpenCorridor({
    fromToken: body.fromToken || 'USAT',
    toToken: body.toToken || cencori.parsedInvoice.targetCurrency,
    amountIn: body.amountIn || cencori.parsedInvoice.amountSourceUsd,
    recipientAddress: body.recipientAddress,
  });

  return NextResponse.json(
    {
      ok: true,
      settledVia: 'https://api.x402.celo.org',
      attributionTag: CHAMBA_ATTRIBUTION_TAG,
      x402ChallengeAccepted: challenge.accepts[0],
      settlementResult,
      cencoriInferenceReceipt: cencori.receipt,
      parsedInvoice: cencori.parsedInvoice,
      textileCorridorQuote: quote,
      tagVerification: verifyCalldataHasChambaTag(quote.taggedOrderCalldata),
    },
    {
      status: 200,
      headers: {
        'X-Attribution-Tag': CHAMBA_ATTRIBUTION_TAG,
      },
    }
  );
}
