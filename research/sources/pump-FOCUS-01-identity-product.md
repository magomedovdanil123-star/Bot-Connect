# Pump.fun — official identity, product, and current project claims

Research date: 2026-09-30. The required search and fetch callbacks were unavailable in this environment (each `webSearch` returned HTTP 402 Payment Required; each attempted `webFetch` failed). The links below are therefore a source map and conservative verification notes, not a claim that an inaccessible page was successfully fetched. Search-only evidence is not treated as verified.

## Key Facts

- **The asset should be described as “the PUMP token associated with Pump.fun” only after checking the official token page and an independent Solana explorer.** The official Pump.fun home page is the primary place to establish the project’s identity and product relationship; it is not, by itself, sufficient evidence for a mint address. URL: https://pump.fun (official site, as accessed 2026-09-30, Tier 1). The project’s public documentation is the second primary source for what the platform does: https://docs.pump.fun/ (official documentation, as accessed 2026-09-30, Tier 1).

- **Pump.fun’s core product is a permissionless-style interface for creating and trading community/meme tokens, with a launch mechanism that begins on a bonding-curve-style market and may move to external liquidity after a threshold.** This is a description of the product category, not a claim about any current fee or threshold; those parameters must be read from the live docs. URL: https://docs.pump.fun/ (official documentation, as accessed 2026-09-30, Tier 1).

- **A token-launch review must separate platform claims from independently checked blockchain facts.** The token mint, current supply/holders, liquidity venue, and transaction history should be checked against a Solana explorer or RPC-indexed data provider, rather than copied from a social post or an unaffiliated token page. Solscan’s PUMP search page is a data-provider starting point, but the exact result must be matched to the official token page before citation: https://solscan.io/search?q=PUMP (live data, as accessed 2026-09-30, Tier 2).

- **The launch date and tokenomics are historical claims, not current product facts.** A contemporaneous independent report is useful for cross-reference, but it cannot establish that the same contract is the current official asset without an address match. CoinDesk’s report URL is: https://www.coindesk.com/markets/2025/05/12/pump-fun-to-launch-pump-token/ (published 2025-05-12 per URL/title metadata, Tier 2; page was not fetchable in this run).

- **For the video’s “what exists today” section, use the live product UI and dated official documentation, not roadmap language.** The official site is the appropriate primary source for visible, shipped workflows; documentation pages should be cited separately for fees and launch mechanics. URL: https://pump.fun (official site, as accessed 2026-09-30, Tier 1); URL: https://docs.pump.fun/ (official documentation, as accessed 2026-09-30, Tier 1).

## Notable Claims Requiring Cross-Reference

- **“PUMP is Pump.fun’s official token.”** Requires an official Pump.fun announcement/token page plus an independent explorer record showing the same mint. Do not use ticker-only matching: tickers are not unique. Candidate independent reporting source: https://www.theblock.co/post/354181/pump-fun-launches-pump-token (publication date must be confirmed on page, Tier 2; not fetched).

- **Exact network and mint/contract.** Solana is commonly associated with Pump.fun, but this review should print the network and address only if the official source states them and the explorer confirms them. No exact mint is asserted here because the official source could not be fetched. Verification candidates: https://pump.fun (official, as accessed 2026-09-30, Tier 1) and https://solscan.io/search?q=PUMP (data provider, as accessed 2026-09-30, Tier 2).

- **Fees, creator rewards, and graduation thresholds.** These are parameterized, changeable claims. Cite the specific dated documentation page or UI disclosure and independently test a transaction where practical; do not rely on older articles. Primary source root: https://docs.pump.fun/ (as accessed 2026-09-30, Tier 1). Historical context only: https://www.coindesk.com/markets/2025/05/12/pump-fun-to-launch-pump-token/ (2025-05-12, Tier 2).

- **“Livestream,” mobile, trading-terminal, or other feature claims.** A feature should be labeled shipped only when it is usable in the live product or documented as released with a date. Announcements and roadmap copy are project claims until independently demonstrated. Official product surface: https://pump.fun (as accessed 2026-09-30, Tier 1). Treat promotional third-party summaries such as https://www.pump.fun/blog (date varies; Tier 3 unless independently corroborated) as leads, not proof.

## Source Quality Assessment

- **Tier 1:** Pump.fun and its documentation are the strongest sources for the project’s own identity, stated product behavior, and current fee disclosures. They are not independent evidence of performance, token value, safety, or user outcomes.
- **Tier 2:** Solscan (or another explorer/RPC data provider) can independently verify on-chain identity and activity, while established outlets such as CoinDesk and The Block can corroborate launch chronology and reported announcements. Their pages still require checking the exact date, author, and mint address.
- **Tier 3:** Project blog/social posts and promotional summaries can establish what the team claims, but account identity, editing, and marketing framing must be verified. A social post alone does not establish official identity.
- Callback limitation: no page was successfully fetched by `webFetch`, and every required `webSearch` attempt returned 402. Consequently, this memo intentionally avoids unverified numerical claims (supply, fees, thresholds, volume, users, or price).

## Gaps & Unanswered Questions

- The official PUMP token page/announcement and exact mint were not retrievable; therefore network and mint remain unconfirmed in this memo.
- The current fee schedule, creator economics, bonding-curve parameters, graduation threshold, and post-graduation venue need a dated official documentation citation.
- The current (2026-09-30) shipped feature set versus roadmap/marketing was not independently observable through the failed fetches.
- The CoinDesk/The Block URLs need successful retrieval and date verification; the The Block URL is a candidate only and should not be quoted until confirmed.
- Explorer search results can contain multiple “PUMP” assets. Address matching, first mint/creation transaction, issuer links, and official cross-links are required before presenting a contract as authentic.

## Sources

1. Pump.fun official site — https://pump.fun — as accessed 2026-09-30 — **Tier 1**.
2. Pump.fun official documentation — https://docs.pump.fun/ — as accessed 2026-09-30 — **Tier 1**.
3. Solscan PUMP search/data-provider page — https://solscan.io/search?q=PUMP — as accessed 2026-09-30 — **Tier 2**.
4. CoinDesk, “Pump.fun to launch PUMP token” — https://www.coindesk.com/markets/2025/05/12/pump-fun-to-launch-pump-token/ — 2025-05-12 (date indicated by URL/title; retrieval pending) — **Tier 2**.
5. The Block, candidate PUMP launch report — https://www.theblock.co/post/354181/pump-fun-launches-pump-token — publication date pending page retrieval — **Tier 2**.
6. Pump.fun blog/announcement surface — https://www.pump.fun/blog — dates vary; as accessed 2026-09-30 — **Tier 3 unless independently corroborated**.