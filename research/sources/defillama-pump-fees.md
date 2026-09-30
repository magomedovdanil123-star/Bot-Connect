# Pump.fun fees — DefiLlama

- **Dashboard:** https://defillama.com/protocol/pump.fun?fees=true
- **API snapshot:** https://api.llama.fi/summary/fees/pump.fun?dataType=dailyFees
- **Methodology:** https://github.com/DefiLlama/dimension-adapters/blob/master/fees/pumpdotfun.ts
- **Publisher:** DefiLlama
- **Snapshot:** 2026-09-30
- **Type:** Independent analytics

The API reports about $45.98M total fees in the trailing 30 days. Its methodology distinguishes:

- **Fees:** bonding-curve trade fees, graduation fees, and Mayhem fees; includes protocol and creator/cashback portions.
- **Revenue / protocol revenue:** narrower protocol-retained measures with era-specific splits.
- **Holders revenue:** buybacks inferred from on-chain burns, aggregated across Pump products.
- **Supply-side revenue:** creator fees and cashback.

**Use:** call the $45.98M figure “fees,” not net revenue. Do not compare it directly with Pump.fun's buyback dashboard.