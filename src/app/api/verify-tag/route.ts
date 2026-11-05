import { NextRequest, NextResponse } from 'next/server';
import {
  CHAMBA_ATTRIBUTION_TAG,
  CHAMBA_DATA_SUFFIX,
  verifyCalldataHasChambaTag,
  verifyOnchainTxTag,
} from '@/lib/celo-rails';
import type { Hex } from 'viem';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.txHash && typeof body.txHash === 'string' && body.txHash.startsWith('0x')) {
      const result = await verifyOnchainTxTag(body.txHash as Hex);
      return NextResponse.json({
        ok: true,
        mode: 'onchain_tx',
        expectedTag: CHAMBA_ATTRIBUTION_TAG,
        expectedSuffix: CHAMBA_DATA_SUFFIX,
        result,
      });
    }

    if (body.calldata && typeof body.calldata === 'string' && body.calldata.startsWith('0x')) {
      const result = verifyCalldataHasChambaTag(body.calldata as Hex);
      return NextResponse.json({
        ok: true,
        mode: 'calldata',
        expectedTag: CHAMBA_ATTRIBUTION_TAG,
        expectedSuffix: CHAMBA_DATA_SUFFIX,
        result,
      });
    }

    return NextResponse.json(
      { ok: false, error: 'Provide either txHash (0x...) or calldata (0x...)' },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
