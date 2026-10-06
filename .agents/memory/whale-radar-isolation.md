---
name: Whale Radar isolation
description: Project scope boundary for the new Whale Radar Shorts format.
---

Keep Whale Radar separate from all existing financial and crypto Shorts routes, renderers, prompts, SEO, sources, tables, and publishing behavior. Its only approved shared integrations are the Finance main-menu entry and reuse of the existing Bybit banner in Whale Radar's CTA. The current Telegram bot is its entry point; do not publish automatically. A whale signal means a wallet explicitly identified as Smart Money, not a large transaction by itself. Exclude ordinary transfers, exchange deposits, and withdrawals from BUY/SELL classification.

**Why:** The user requires this format to stay isolated, defined whales as Smart Money wallets, and rejected treating large DEX swaps or transfers as whale purchases.

**How to apply:** Use the `whale:` Telegram callback namespace and whale-specific modules/tables. Keep scans and previews user-initiated, and verify existing growth formats remain unchanged.

For new source work, follow Arkham → Dune → Lookonchain: Arkham is primary, Dune verifies or expands the on-chain trade, and Lookonchain is an additional check. Use only free limits unless the user explicitly authorizes spend. Never silently substitute Nansen when these sources are unavailable. Historical price is separate from trade discovery; report 1h, 6h, 24h, and preferably 7d only when verified post-trade candles exist.

**Why:** The user explicitly set this source order and selected free-only requests for the Whale Radar discovery flow.

**How to apply:** Verify the actual DEX swap, token amounts, USD value, timestamp, chain, transaction hash, and BUY/SELL direction. Exclude ordinary transfers, exchange deposits, and withdrawals. If a source or price interval cannot be verified within free limits, disclose the missing data instead of inventing a value or switching providers.

The established production Shorts flow remains separate from one-off visual tests. For a visual test, a longer runtime must not change the production duration limit. Give the narration a detailed, evidence-based account of the trade and show market-price movement from the execution price; add a second coin only with a separate verified trade and its own post-trade prices. Describe this as market-price movement, never wallet profit, and do not invent missing data.

**Why:** The user approved a one-off two-minute V2 visual test while requiring existing Shorts routes and renderers to remain untouched.

**How to apply:** Keep a test-only renderer isolated inside the Whale Radar module. Do not raise production runtime limits or add an unverified comparison coin.
