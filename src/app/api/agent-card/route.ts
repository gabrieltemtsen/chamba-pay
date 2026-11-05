import { NextRequest, NextResponse } from 'next/server';
import { buildChambaAgentCard, checkAndPrepareErc8004Identity } from '@/lib/erc8004';
import { CHAMBA_ATTRIBUTION_TAG } from '@/lib/celo-rails';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin || 'https://chambapay.celo.org';
  const card = buildChambaAgentCard(origin);
  const status = await checkAndPrepareErc8004Identity();

  return NextResponse.json(
    {
      ...card,
      onchainStatus: status,
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'X-Attribution-Tag': CHAMBA_ATTRIBUTION_TAG,
      },
    }
  );
}
