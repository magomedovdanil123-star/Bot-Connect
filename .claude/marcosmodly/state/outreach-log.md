<!-- MARKETING-SKILL:OUTREACH-LOG -->
# Outreach Log & Suppression List

> This file is both the daily queue and the permanent contact history for
> `email-outreach` — rows accumulate over time rather than getting
> cleared out, and it is the single source of truth for duplicate
> checking and suppression. It's written by `email-outreach` (queuing new
> rows; updating Status on replies/bounces/unsubscribes/sends — either
> from a live human reply or detected automatically via a Gmail inbox
> sync, see below) and is safe to hand-edit directly, same as
> `state/content-calendar.md`: change a `Status`, fix a typo'd email, or
> add a row yourself (e.g. to log an unsubscribe request that arrived
> outside email).
>
> **This table is an index, not the content store.** The full email body
> lives at `state/outreach/<date>-<prospect-slug>.md`, referenced from
> each row's Notes column, which also carries the Gmail draft/thread id
> when one was created (e.g. `draft:r-1234, thread:18c9f...`) — that id
> is what a future inbox sync uses to check for a reply/bounce without
> re-searching from scratch. `email-outreach` reads the linked file, not
> this table, to get the actual drafted/sent content.
>
> **Before drafting anyone, check this file first** — by `Email`, then by
> `LinkedIn`, then by `Name + Company` (the same identity precedence
> Vibe Prospecting's own `match-prospects` uses) — for an existing row.
> See "Suppression & duplicate rules" below for what each Status means
> for a new draft.
>
> **Escape `|` as `\|`** in any cell, and keep every cell to a single
> line — an unescaped pipe or embedded newline corrupts the row (and
> every column after it) the same way it would in the content calendar.

## Identity columns
`Email` is the primary key when known; `LinkedIn` or `Name + Company` is
the fallback when it isn't. A row must have at least one identity field
filled in — never queue a prospect this file can't later be used to
recognize.

## Status values
- `Drafted` — email written and saved, not yet reviewed.
- `Ready for Approval` — queued and explicitly waiting on a human.
- `Approved` — a human reviewed the actual email in a live conversation
  and said to send it.
- `Sent` — actually sent (via Gmail `send_message`, or the human sent the
  Gmail draft themselves — update the row once you know which happened).
  An "open" `Sent` row (no terminal outcome yet) is what the inbox sync
  below checks on every run.
- `Replied` — the prospect responded, with no opt-out language in the
  reply. Permanent stop for this cadence; a new campaign to the same
  person later is a deliberate human decision, never an automatic
  re-queue. May be set by a human or detected automatically (see below).
- `Bounced` — hard bounce. Permanent suppression. May be set by a human
  or detected automatically.
- `Unsubscribed` / `Do-Not-Contact` — permanent suppression, no matter how
  much time passes or how a later request to re-contact them is phrased.
  May be set by a human or detected automatically from opt-out language
  in a reply — treat a detected match here as urgent and authoritative,
  same as a human setting it directly.
- `Skipped-Duplicate` — a same-run or already-logged duplicate was found
  and this candidate was dropped before drafting; logged so "why today's
  batch came in under target" stays visible instead of silently vanishing.

## Automatic status detection (Gmail inbox sync)
When Gmail MCP tools are connected, `email-outreach` checks every "open"
`Sent` row (no `Replied`/`Bounced`/`Unsubscribed`/`Do-Not-Contact` yet) at
the start of each run, using the thread/draft id in Notes (or a
`search_threads` lookup by `Email` if no id was stored):
- A reply from the prospect containing opt-out language (e.g.
  "unsubscribe," "remove me," "stop emailing," "take me off," "do not
  contact," "opt out") → `Unsubscribed`/`Do-Not-Contact`, immediately, no
  matter how small the batch or how the sync was triggered. This is the
  one mistake this skill must never make quietly, so treat a match here
  as more urgent than ordinary reply processing.
- A reply from the prospect with no opt-out language → `Replied`.
- A bounce notification (typically from a mailer-daemon/postmaster
  address, or a "Delivery Status Notification (Failure)"/"Undelivered
  Mail Returned to Sender" subject, referencing this address) →
  `Bounced`.
- This is best-effort pattern matching on real inbox content, not
  guaranteed parsing — an ambiguous result is left as-is (still `Sent`)
  rather than guessed at, and reported as ambiguous rather than silently
  resolved either way.

## Separation-of-duties rule (same rule `state/content-calendar.md` uses)
- `email-outreach` may only ever write `Drafted`, `Ready for Approval`, or
  `Skipped-Duplicate` to Status for a row it queues. **Never `Approved`.**
- `Approved` is only ever written immediately after a human has seen the
  actual email in a live conversation and given an explicit affirmative
  reply — never from silence, a timeout, or a blanket "just send today's
  batch" authorizing everything in advance. This holds the same way
  whether the run is interactive or fired by a scheduled daily trigger.
- Only an actual send (Gmail `send_message`, gated the same way) flips a
  row to `Sent`. No skill in this plugin sets `Approved` or sends at any
  other point. (The automatic detection above only ever moves a row
  *out* of `Sent` toward a terminal outcome — it never sets `Approved` or
  `Sent` themselves.)

## Suppression & duplicate rules (read before every batch)
- `Unsubscribed`, `Do-Not-Contact`, `Bounced`, and `Replied` rows are
  permanent — skip forever, regardless of Status age or whether that
  status was set by a human or auto-detected.
- Any other row inside the suppression window
  (`references/outreach-strategy.md`'s Suppression Rules; default 90
  days) is a duplicate — skip and log as `Skipped-Duplicate`, unless it's
  a scheduled follow-up whose Next Follow-Up date is today or earlier.
- A duplicate found this way is dropped from the batch, not silently
  replaced with padding — pull an additional candidate instead so the
  batch still reaches its target, or report a shortfall if candidates run
  out.

## Extra columns
- **Subject Variant** — `A` or `B`, whichever subject-line variant this
  prospect got (see `email-outreach`'s A/B rule). Lets a later refresh
  tally reply rate per variant.
- **Recommended Send Time** — this prospect's approximate local time
  (with time zone) inside the strategy file's Send-Time Window — the
  actual send is still manual (or the human's own Gmail scheduled-send),
  this column just says when.

| Date | Email | LinkedIn / Name + Company | Segment | Status | Subject Variant | Next Follow-Up | Recommended Send Time | Notes |
|---|---|---|---|---|---|---|---|---|
