# PUMP (Pump.fun) — source-checked review brief

**Research cutoff:** 30 September 2026  
**Video target:** 16:9, about 15 minutes, 20 scenes (maximum 24)  
**Purpose:** explain the product, token economics, evidence, and risks; no price prediction or investment recommendation.

## Editorial thesis

Pump.fun is a Solana token-launch and trading business whose products use bonding curves and PumpSwap. The platform has measurable fee activity, and Pump.fun reports a temporary buyback-and-burn program for PUMP. That is not the same as a contractual claim on revenue: the project says token holders receive no revenue rights, and the announced program is limited by its terms. The investment case is therefore exposed to product demand, fee policy, the end of the program, supply-data uncertainty, competition, and legal risk.

This is analysis, not a fact about future price. No valuation conclusion is justified by the evidence gathered here.

## What is verified

### Product and token identity

Pump.fun identifies PUMP as its native token, and CoinGecko lists the matching Pump.fun asset on Solana. The video should say “PUMP, the Pump.fun token on Solana,” not rely on the ticker by itself. [@pump-token-page] [@coingecko-pump]

The project describes a constant-product bonding curve: a new token trades against virtual reserves, buys move the quoted price up, and sells move it down. When a coin reaches its graduation threshold, its liquidity migrates to PumpSwap. Pump.fun's fee page lists 1.25% total fees on bonding-curve trades; PumpSwap fees vary by pool and market-cap band. These are the project's own current product descriptions and fee schedule. [@pump-bonding-curve] [@pump-fees]

### Activity and value capture

DefiLlama's 30 September snapshot shows about **$45.98 million in fees over 30 days**. Its methodology includes user-paid bonding-curve fees, graduation fees, and Mayhem fees; it separately distinguishes the protocol's retained revenue, buybacks, creator fees, and cashback. The script may use the $45.98M figure only as “fees,” not as net platform revenue. [@defillama-pump-fees]

Pump.fun's token page reports **$468.44 million** in cumulative buybacks and **168.89 billion PUMP** burned on the page captured on 30 September. The same page warns its fee dashboard does not correctly reflect custom-pair revenue and buybacks. Treat the totals as project-reported, not independently reconciled on-chain figures. [@pump-token-page]

The 28 April announcement describes directing 50% of net platform revenue toward buybacks and burns for a one-year term. The announcement also says PUMP is not equity and creates no right to revenues, profits, dividends, distributions, or cash flow; it disclaims a general obligation to buy tokens. The script must not describe buybacks as guaranteed, permanent, or a holder entitlement. [@pump-buyback-announcement]

### Supply and allocation

Blockworks' 21 September transparency filing lists an original/maximum supply of 1 trillion PUMP and the following allocations: 33% ICO, 24% community/ecosystem, 20% team, 13% existing investors, 3% livestream incentives, 2.6% liquidity/exchanges, 2.4% ecosystem fund, and 2% foundation. The filing is marked partial with eight disclosure gaps and warns that some project-supplied details may not be independently verifiable. Tokenomist's allocation view provides a second reference, but its “unlocked” figure must not be equated with circulating supply. [@blockworks-pump-filing] [@tokenomist-pump]

Supply snapshots conflict: Pump.fun displays 399.46 billion as circulating; CoinGecko displays about 465.3 billion circulating; Tokenomist reports about 465.37 billion unlocked. The sources may use different definitions or coverage, and the difference is unresolved. Do not use a single market-cap or fully diluted valuation figure in the video. [@pump-token-page] [@coingecko-pump] [@tokenomist-pump]

### Competition and legal risk

Raydium's official page confirms LaunchLab as another token-launch product. This establishes competition, but not relative market share, product quality, or user preference. [@raydium-launchlab]

On 31 August 2026, Wolf Popper LLP, counsel for plaintiffs, reported that a judge allowed specified RICO claims against Pump.fun's operator and founders to proceed. The case remains pending. This is a procedural report from plaintiffs' counsel; the allegations are not proof of wrongdoing or liability, and the litigation concerns alleged platform-level promotional conduct rather than an adjudicated finding about the PUMP token. Direct access to the court docket/order was blocked in this research pass. [@wolfpopper-pump-case]

## Risks and counterpoints

- **Demand risk:** platform fees depend on continuing launches and trading in highly speculative tokens.
- **Value-capture risk:** PUMP holders have no legal claim on platform revenue; the buyback program is time-limited and subject to its published terms.
- **Supply-data risk:** circulating and unlocked figures differ by source, which makes precise valuation comparisons unreliable.
- **Policy and competition risk:** Pump.fun's fee schedule can change, and alternatives such as Raydium LaunchLab exist.
- **Legal risk:** a pending case and unresolved allegations create uncertainty; do not imply that a procedural ruling is a finding of liability.
- **Measurement risk:** Pump.fun says its dashboard underreports custom-pair activity; DefiLlama's categories do not map one-to-one to project-reported “revenue.”

## Suggested 20-scene structure

1. PUMP is not the platform: identify the token and the review's evidence cutoff.
2. What Pump.fun lets users do.
3. A bonding curve in plain language.
4. Graduation to PumpSwap.
5. Where platform fees come from.
6. What DefiLlama's 30-day fee number actually measures.
7. PUMP's stated role and what it does not grant.
8. The announced buyback-and-burn mechanism.
9. Why a one-year program is not a permanent promise.
10. Project-reported buyback/burn totals and the dashboard caveat.
11. Maximum supply and ICO allocation.
12. Team, investor, and ecosystem allocations.
13. Circulating versus unlocked supply.
14. Why the supply conflict prevents a precise market-cap comparison.
15. LaunchLab as a verified alternative, without market-share claims.
16. The pending RICO litigation, attributed to plaintiffs' counsel.
17. A conditional upside case: continued usage and fee activity.
18. A base case: activity persists but token value capture remains indirect.
19. A downside case: falling speculative demand, program expiry, supply, or legal change.
20. What to monitor, what remains unknown, and a neutral conclusion.

## Visual and audio direction

Use a dark cosmic palette with restrained teal, violet, and amber accents. Keep generated visuals free of fabricated numbers, logos, UI screenshots, or chart labels; exact facts belong in narration and captions. Give every scene a slow, continuous camera move and a clear transition. Use the saved user-provided music bed at a slightly higher but still subdued level under the same chat-selected Shorts voice. Keep the script as a Telegram draft; production starts only after the user approves it.

## Source registry

Stable citations resolve through `research/sources.json`; source excerpts and limitations are stored in `research/sources/`.