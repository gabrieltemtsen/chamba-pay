import { describe, it, expect } from 'vitest';
import {
  CHAMBA_ATTRIBUTION_TAG,
  CHAMBA_DATA_SUFFIX,
  CELO_TOKENS,
  PROTOCOL_CONTRACTS,
  ensureTaggedCalldata,
  verifyCalldataHasChambaTag,
  buildRipioRampUrl,
} from '../src/lib/celo-rails';
import { quoteOpenCorridor, buildChambaX402Challenge } from '../src/lib/corridor-fx';
import { buildChambaAgentCard } from '../src/lib/erc8004';

describe('ChambaPay — Celo Open Rails & ERC-8021 Attribution Tests', () => {
  it('encodes and verifies the exact Loops House attribution tag celo_42cd0161c62d', () => {
    expect(CHAMBA_ATTRIBUTION_TAG).toBe('celo_42cd0161c62d');
    expect(CHAMBA_DATA_SUFFIX.endsWith('80218021802180218021802180218021')).toBe(true);

    const tagged = ensureTaggedCalldata('0xa9059cbb000000000000000000000000');
    const check = verifyCalldataHasChambaTag(tagged);
    expect(check.isTagged).toBe(true);
    expect(check.codes).toContain('celo_42cd0161c62d');
    expect(check.markerPresent).toBe(true);
  });

  it('produces tagged Textile FX LimitOrderReactor calldata and Ripio off-ramp URLs', () => {
    const quote = quoteOpenCorridor({
      fromToken: 'USAT',
      toToken: 'wARS',
      amountIn: 500,
      recipientAddress: '0x20faAca5F980E29639A0FCC6dcA6988E18ed333B',
    });

    expect(quote.reactorAddress).toBe(PROTOCOL_CONTRACTS.TEXTILE_LIMIT_ORDER_REACTOR);
    expect(quote.amountOut).toBeGreaterThan(500000);
    expect(quote.savingsVsBankPct).toBeGreaterThan(5);
    expect(quote.ripioOfframpUrl).toContain('https://ramp.ripio.com/offramp');
    expect(quote.ripioOfframpUrl).toContain('country=AR');
    expect(quote.ripioOfframpUrl).toContain('token=WARS');

    const tagCheck = verifyCalldataHasChambaTag(quote.taggedOrderCalldata);
    expect(tagCheck.isTagged).toBe(true);
  });

  it('generates an authoritative Celo x402 challenge supporting USAT, wARS, wBRL, and USDC', () => {
    const challenge = buildChambaX402Challenge('https://chambapay.celo.org/api/x402-execute');
    expect(challenge.x402Version).toBe(1);
    expect(challenge.attributionTag).toBe('celo_42cd0161c62d');
    const assets = challenge.accepts.map((a) => a.asset);
    expect(assets).toContain(CELO_TOKENS.USAT.address);
    expect(assets).toContain(CELO_TOKENS.wARS.address);
    expect(assets).toContain(CELO_TOKENS.wBRL.address);
    expect(assets).toContain(CELO_TOKENS.USDC.address);
  });

  it('generates a valid ERC-8004 Agent Registration Card pointing to Celo Mainnet', () => {
    const card = buildChambaAgentCard();
    expect(card.attributionTag).toBe('celo_42cd0161c62d');
    expect(card.x402Support).toBe(true);
    expect(card.registrations[0].agentRegistry).toContain(
      PROTOCOL_CONTRACTS.ERC8004_IDENTITY_REGISTRY
    );
  });
});
