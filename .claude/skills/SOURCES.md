# Сторонние скиллы проекта

Установлены 2026-10-18 после проверки безопасности (без хуков, MCP-серверов и автозапуска; скрипты не запускались).

| Источник | Лицензия | Что установлено |
|---|---|---|
| github.com/sbeclaude/marketing-skills | MIT | 40 маркетинговых скиллов (copywriting, marketing-psychology, lead-magnets, referral-program, content-strategy, social-content, paid-ads, seo-audit, ab-test-setup …). CLI-обёртки `tools/clis` не установлены. |
| github.com/marcosmodly/marketing-skill | MIT | 12 скиллов (short-form-video, content-calendar, content-repurposer, ad-copy-generator, competitor-research, seo-brief, community-post-generator, email-outreach, email-sequence-pro, publish-pipeline, full-pipeline, visual-brief-generator). Общие файлы — `.claude/marcosmodly/` (пути `${CLAUDE_PLUGIN_ROOT}` заменены). Бренд — `.claude/marcosmodly/references/brand-voice.md`. Публикация во внешние сети — только с явного подтверждения автора. |
| github.com/getatelier/youtube-skills | MIT | `youtube` (скрипты в `execution/` используют YouTube Data/Analytics API с ключом автора). Установщик `install.sh` не запускать — он клонирует другой репозиторий. |
| github.com/WU-HAOTIAN34/2dimg2motion | MIT | `2dimg2motion`, `img2mo-learn`, `img2mo-std`. Основной сценарий рассчитан на инструмент генерации картинок Codex (`image_gen`), которого в Claude Code нет; работают только локальные скрипты обработки (Pillow). |

Не установлены:
- github.com/shinraitechnologies/marketing-skills — дубль набора sbeclaude (те же 25 названий, версии короче).
- github.com/GenielabsOpenSource/spine-animation-ai — лицензия PolyForm Noncommercial 1.0.0 запрещает коммерческое использование, а канал коммерческий.
