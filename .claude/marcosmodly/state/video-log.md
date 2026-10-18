<!-- MARKETING-SKILL:VIDEO-LOG -->
# Video Log

> One row per short-form video that went out, with how it did, so the next
> video can start from what works for this account rather than from
> generic advice. `short-form-video` adds a row when a video is posted (or
> when you tell it one was), and fills in the numbers when you paste them
> from each platform's own analytics, or when it fetches them with
> `scripts/publish_direct.py --metrics` if that platform's credentials are
> set up. Safe to hand-edit: add a row, correct a number, delete a test.
>
> **How the skills use it.** Once there are about 10 rows with numbers,
> `short-form-video` and `content-calendar` read it before planning: which
> formats and hook patterns hold viewers longest on this account, which
> sounds and lengths do better, and which days and hours its own posts got
> the most views. They say how many posts a pattern rests on, treat a gap
> of a few percent between two formats as noise, and keep trying new
> formats (about 10% of posts) so the log doesn't just repeat itself.
> Below about 10 rows they use the general guidance and say so.
>
> **Columns.** `Format` is the template or video type (`tier-list`,
> `narrated`, `how-to`, `take`...). `Hook` is the on-screen hook and its
> pattern from `references/hooks.md` (e.g. `pain: you're losing money on
> late invoices`); `Variant` is which hook variant this was, if any.
> `Avg watch` is the share of the video watched on average (or the
> average watch time in seconds, marked `s`); `3s hold` is the share of
> viewers still there after three seconds, where the platform shows it.
> Leave a cell blank when the platform doesn't report it, never guess.
> Escape `|` as `\|` and keep each cell to one line.

| Posted | Platform | Video | Format | Hook | Variant | Sound | Length | Link / ID | Views | Avg watch | 3s hold | Likes | Comments | Shares | Saves | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
