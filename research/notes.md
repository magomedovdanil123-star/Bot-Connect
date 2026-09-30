# Research Notes: PUMP (Pump.fun token) — 2026-09-30

**Status:** source review complete; unresolved conflicts must remain visible
**Depth:** Quick, with primary-source checks
**Cutoff:** 2026-09-30

## Plan

- **Question:** What can a general crypto viewer verify about the PUMP token and Pump.fun, and what remains uncertain?
- **Scope:** Identity, product, tokenomics/value capture, measured activity, competition, and material risks; no price prediction.
- **Audience:** General YouTube viewers who know basic crypto terms.
- **Deliverable:** A source-backed 16:9 Long review targeting about 15 minutes, with a maximum of 24 scenes so each scene can retain a crossfade.
- **Evidence standard:** Separate independent measurements, project statements, legal allegations, analysis, and unknowns. Put source links in the video description.

## Focus Areas

| # | Area | Status | Sources |
|---|---|---|---|
| 1 | Identity, product mechanics, and official claims | checked against Pump.fun pages and CoinGecko | `pump-token-page`, `pump-bonding-curve`, `pump-fees`, `coingecko-pump` |
| 2 | Supply, allocation, and value capture | allocations cross-checked; circulating supply unresolved | `pump-token-page`, `pump-buyback-announcement`, `blockworks-pump-filing`, `tokenomist-pump` |
| 3 | Activity, competition, legal status, and risks | dated snapshots; legal status sourced to plaintiffs' counsel | `defillama-pump-fees`, `raydium-launchlab`, `wolfpopper-pump-case` |

## Coverage Checklist

- [x] Match PUMP to Pump.fun on Solana; use the project token page and CoinGecko rather than ticker alone.
- [x] Separate shipped product mechanics from project claims.
- [x] Verify the maximum supply and allocation schedule; preserve the circulating/unlocked-supply conflict.
- [x] Use a dated fee metric with its methodology; do not label all fees as protocol revenue.
- [x] Confirm a named competing launch product without claiming market-share comparisons.
- [x] Attribute the court update to plaintiffs' counsel; state that allegations are not a finding of liability.
- [x] Distinguish facts, official claims, analysis, and unknowns; no price target or unsupported causal claim.

## Findings Log

### Identity and product

- Pump.fun identifies PUMP as its native token; CoinGecko identifies the same Pump.fun asset on Solana. Use the project name/network in narration to disambiguate the ticker. [@pump-token-page] [@coingecko-pump]
- Pump.fun's docs describe a constant-product bonding curve and automatic migration of graduated coins to PumpSwap. The platform's own fee page lists 1.25% total bonding-curve fees and variable PumpSwap fees. These are product mechanics and published terms, not proof of future revenue. [@pump-bonding-curve] [@pump-fees]

### Tokenomics and value capture

- Pump.fun's token page reports $468.44M in cumulative buybacks and 168.89B PUMP burned on the 30.09.2026 page capture. The page also says its fee dashboard does not correctly reflect custom-pair revenue/buybacks. Treat these as project-reported values, not independently reconciled totals. [@pump-token-page]
- The 28.04.2026 announcement describes a buyback-and-burn program directing 50% of net platform revenue for one year. It explicitly says PUMP is not equity, gives no right to revenue or distributions, and disclaims a general obligation to buy tokens. [@pump-buyback-announcement]
- DefiLlama reports about $45.98M of fees over the trailing 30 days on the 30.09.2026 snapshot. Its adapter distinguishes total fees, protocol revenue, buybacks, and creator/cashback payments; do not compare the fee total directly with Pump.fun's net revenue or buyback total. [@defillama-pump-fees]
- Blockworks' 21.09.2026 filing lists a 1T maximum supply, the 33% ICO allocation, and the full allocation breakdown. The filing marks itself partial with eight disclosure gaps and warns some project-supplied information may not be independently verifiable. Tokenomist provides a second allocation view but labels roughly 465.37B as “unlocked”; this is not interchangeable with circulating supply. [@blockworks-pump-filing] [@tokenomist-pump]
- The circulating-supply figures do not reconcile: Pump.fun displays 399.46B, while CoinGecko reports about 465.3B; Tokenomist reports about 465.37B unlocked. Definitions and coverage may differ. Do not present a single market cap or FDV as settled. [@pump-token-page] [@coingecko-pump] [@tokenomist-pump]

### Activity, competition, legal status, and risk

- DefiLlama's metric is a dated, measured fee total, not an audience popularity ranking. It is the strongest current activity figure in this quick review. [@defillama-pump-fees]
- Raydium's official page confirms LaunchLab as another token-launch product. No market-share or direct-performance comparison was verified. [@raydium-launchlab]
- On 31.08.2026, Wolf Popper LLP, counsel for plaintiffs, reported that a judge allowed specified RICO claims against the platform operator and founders to proceed. This is a procedural summary from plaintiffs' counsel; the case remains pending and the allegations are not established findings. Direct access to the docket/order was blocked during this research pass. [@wolfpopper-pump-case]
- Analysis: demand for Pump.fun's services depends on continued use of speculative token launches and trading. PUMP holders have no contractual claim on platform revenue; a temporary buyback program should not be described as permanent value accrual. Supply-data conflicts and legal uncertainty weaken precise valuation comparisons.

## Conflicts & Open Questions

1. **Circulating supply:** Pump.fun and CoinGecko differ by roughly 66B tokens; Tokenomist's “unlocked” field is a different measure. No reconciliation was found.
2. **Revenue/buybacks:** Pump.fun warns that custom pairs are missing from its fee dashboard. DefiLlama uses a documented but different fee/revenue taxonomy; the figures are not directly comparable.
3. **Allocation/unlock timing:** Blockworks is explicitly partial, while Tokenomist's page contains inconsistent unlock-status wording. Do not state exact future unlock dates without a fresh independent check.
4. **Legal source:** The court docket/order could not be independently opened here; use only attributed, procedural language from the plaintiffs' law firm, or omit the ruling in narration.
5. **On-chain burns:** Solscan was inaccessible in this environment. The burn total remains a Pump.fun-reported figure for this review.

## Gaps

- No price target, market-cap thesis, or causal claim about recent price movement.
- No exact current market-cap number because it depends on the unresolved circulating-supply definition.
- No assertion that the one-year buyback is guaranteed or that PUMP holders receive revenue.
- Research values are snapshots from 30.09.2026; refresh the volatile data before reusing this script on another date.
