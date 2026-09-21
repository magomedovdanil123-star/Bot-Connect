---
name: User horoscope visual assets
description: Horoscope video visuals are restricted to the user-provided asset set.
---

Horoscope videos must use only the user-provided visual library; do not add stock-provider or AI-generated scene visuals to this pipeline unless the user explicitly changes this decision.

**Why:** The user wants the supplied zodiac images and video to define the visual identity of future horoscope videos and does not want external visual sources mixed into them.

**How to apply:** Keep the horoscope visual library filtered to the user-upload provider and preserve the assets in persistent storage before rendering.

Future horoscope uploads extend this same library rather than replacing earlier assets. Identify zodiac-specific images from their visible symbols or subjects and associate them with the corresponding sign; ask only when identification is ambiguous. Multiple images for one sign are valid additions. Images without a specific sign and general cosmic videos belong to the shared background collection.

**Why:** The user explicitly wants to keep adding photos and videos without repeating how to categorize and use them.

**How to apply:** For a forecast about a sign, show that sign's imagery, interspersed with the user's shared cosmic photos and videos—not another sign's individual card. Preserve previous uploads and avoid duplicate entries. The previously required NOX banner remains a separate overlay unless the user changes that requirement.