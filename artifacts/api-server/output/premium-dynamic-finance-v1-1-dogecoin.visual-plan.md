# Premium Dynamic Finance V1.1 — Dogecoin visual plan

**Plan only. No MP4 was rendered.** The plan uses full-scene compositions; market-data cards are not the default.

## Project

- Version: PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_DIVERSITY
- Duration: 120 seconds
- Aspect ratio: 16:9
- Scenes: 10
- Market source: CoinGecko — https://www.coingecko.com/en/coins/dogecoin
- Data timestamp: 2026-10-03T14:38:30.000Z
- Confirmed genesis date: not returned; omitted

## Data snapshot

- Current price: $0.093005
- 7-day change: -4.93%
- 7-day range: $0.09106129–$0.09864234
- Market cap: $14,522,990,000
- Benchmarks, same period: BTC +0.98% · ETH -0.25%
- Sampled price points: 7
- Visual types repeat consecutively: 0
- Unique backgrounds: 10
- Editorial/illustrative scenes have explicit integrity labels; no fictional news, audience totals, or live blockchain data.

## SCENE 01 · 00:00–00:12

**TEXT:** “Начнём с происхождения Dogecoin: это история интернет-мема, а не график котировки.”

**SEMANTIC MEANING:** Происхождение и подтверждённые исторические опорные точки.

**VISUAL:** HISTORY_DOCUMENTARY

**DOMINANT VISUAL:** Редакционная газетная полоса трансформируется в таймлайн; только подтверждённые даты.

**COMPOSITION:** DOCUMENTARY; visual occupies approximately 76% of attention. Крупный газетный фрагмент в перспективе; логотип и временная шкала занимают центр кадра.

**BACKGROUND:** archival-paper-and-ink

**ASSETS:**

- original:editorial-history-reconstruction — Newspaper-style documentary artwork, visibly labeled as a reconstruction. **[original-graphic]**; Not a real archived newspaper or article.
- verified-history:dogecoin — Only add a date or historical event if a source returns it. **[needs-verification]**; No confirmed date in current research response; do not invent one.
- coingecko:dogecoin:logo — Official coin logo; use the provider image, never redraw the mark. **[available]**; CoinGecko: https://www.coingecko.com/en/coins/dogecoin

**ANIMATION:**

- 00:00 — Бумажная кромка раскрывается из макро-кропа; второй графический слой виден с первого кадра.
- 00:00 — Плашка редакционной реконструкции фиксирует, что это не архивная публикация.
- 00:01 — Подтверждённая дата печатается крупно; при отсутствии даты этот шаг пропускается.
- 00:02 — Логотип Dogecoin раскрывается как большой центральный объект, не как маленький бейдж.
- 00:04 — Линия времени тянется от источника к сегодняшнему рыночному срезу.
- 00:06 — Промежуточные годы не добавляются без подтверждённых событий.
- 00:08 — Камера приближается к последней точке и переводит взгляд с истории на рыночные данные.
- 00:10 — Бумажная полоса складывается в линию графика для следующей сцены.

**TRANSITION:** Сложенная газетная кромка становится осью ценового графика.

**INTEGRITY NOTE:** В текущем ответе источника нет подтверждённой даты запуска; не показывать 2013 или другую дату.


**SOURCES:**

- No external factual source used.

---

## SCENE 02 · 00:12–00:24

**TEXT:** “Теперь сама цена Dogecoin за семь дней: линия показывает прошлые наблюдения, а не следующий шаг.”

**SEMANTIC MEANING:** Наблюдаемое изменение цены на выбранном временном интервале.

**VISUAL:** PRICE_MOVEMENT

**DOMINANT VISUAL:** Ценовая линия строится по реальным временным точкам, занимает большую часть кадра.

**COMPOSITION:** DATA; visual occupies approximately 78% of attention. Широкий график через кадр; значения, оси и источник остаются читаемыми.

**BACKGROUND:** price-chart-black-grid

**ASSETS:**

- coingecko:dogecoin:price-history:2026-10-03T14:38:30.000Z — Observed seven-day price samples; preserve timestamps and values. **[available-data]**; CoinGecko: https://www.coingecko.com/en/coins/dogecoin

**ANIMATION:**

- 00:12 — Ось времени вырастает слева направо; сетка появляется вторым уровнем.
- 00:12 — Точки фактического ряда последовательно проявляются без сглаживания в новую историю.
- 00:13 — Линия цены быстро дорисовывается до последнего доступного значения.
- 00:14 — Камера следует вдоль линии к актуальной точке.
- 00:16 — Выделяется только значение, реально присутствующее в рыночном снимке.
- 00:18 — Под линией появляется короткая подпись о периоде и источнике.
- 00:20 — График сжимается к последней точке, не превращаясь в карточку.
- 00:22 — Последняя точка расширяется и становится входом следующего движения.

**TRANSITION:** Фактическая точка графика растёт в направление следующего ценового отрезка.

**Verified data anchors:**

```json
{
  "currentPriceUsd": 0.093005,
  "periodStartPriceUsd": 0.09783057719569956,
  "changePercent7d": -4.932585837704407,
  "sampleCount": 7
}
```


**SOURCES:**

- CoinGecko market snapshot: https://www.coingecko.com/en/coins/dogecoin

---

## SCENE 03 · 00:24–00:36

**TEXT:** “На графике цены выделим фактический восходящий отрезок. Рост прошлого не обещает продолжения.”

**SEMANTIC MEANING:** Подтверждённый рост виден как движение графика, а не как декоративный процент.

**VISUAL:** MARKET_GROWTH

**DOMINANT VISUAL:** Фактическая ценовая линия рисуется снизу вверх с маркировкой исходной и конечной точек.

**COMPOSITION:** DATA; visual occupies approximately 84% of attention. Крупный график с восходящей диагональю; ростовой отрезок занимает не менее половины кадра.

**BACKGROUND:** green-directional-chart-field

**ASSETS:**

- coingecko:dogecoin:price-history:2026-10-03T14:38:30.000Z — Rising interval selected from observed samples. **[available-data]**; Use only the attached samples and calculated change.; CoinGecko: https://www.coingecko.com/en/coins/dogecoin

**ANIMATION:**

- 00:24 — На первом кадре видна исходная точка выбранного реального интервала.
- 00:24 — Линия начинает движение вверх, синхронно с появлением осей.
- 00:25 — Наблюдаемые точки и свечи последовательно дополняют траекторию.
- 00:26 — Логотип DOGE появляется только как метка ряда, не как отдельная карточка.
- 00:28 — Камера делает короткий push-in на конечную точку.
- 00:30 — Изменение в процентах появляется только после подтверждённого расчёта.
- 00:32 — На экране остаётся подпись «прошлый интервал · не прогноз».
- 00:34 — Линия продолжает движение за верхнюю границу и раскрывает следующую сцену.

**TRANSITION:** Восходящая линия уходит за верхний край и превращается в разделитель следующей сцены.

**Verified data anchors:**

```json
{
  "moveDirection": "up",
  "moveStartAt": "28 сент.",
  "moveEndAt": "02 окт.",
  "moveStartPriceUsd": 0.09349980028478785,
  "moveEndPriceUsd": 0.09660975417860171,
  "moveChangePercent": 3.3261610017789907
}
```


**SOURCES:**

- CoinGecko market snapshot: https://www.coingecko.com/en/coins/dogecoin

---

## SCENE 04 · 00:36–00:48

**TEXT:** “Здесь — фактическое падение цены внутри того же ряда. Не добавляем процент, которого нет в данных.”

**SEMANTIC MEANING:** Подтверждённый нисходящий участок цены показан как движение на графике, без преувеличения его масштаба.

**VISUAL:** MARKET_DROP

**DOMINANT VISUAL:** Нисходящая линия занимает основную площадь; красный акцент обозначает направление, а не уровень опасности.

**COMPOSITION:** DATA; visual occupies approximately 84% of attention. Крупный график с фактическим спуском от исходной точки к конечной; шкала и период остаются видимыми.

**BACKGROUND:** downside-chart-red-grid

**ASSETS:**

- coingecko:dogecoin:price-history:2026-10-03T14:38:30.000Z — falling interval selected from observed samples. **[available-data]**; Use only the attached samples and calculated change.; CoinGecko: https://www.coingecko.com/en/coins/dogecoin

**ANIMATION:**

- 00:36 — На первом кадре появляется исходная точка выбранного наблюдаемого интервала.
- 00:36 — Линия цены рисуется к более низкой фактической точке.
- 00:37 — Временные точки следуют реальному ряду, без синтетического резкого провала.
- 00:38 — Камера опускается вслед за линией и быстро стабилизируется.
- 00:40 — Процент показывается только при доступных исходной и конечной точках.
- 00:42 — Подпись фиксирует период и источник.
- 00:44 — График отъезжает, показывая относительный масштаб движения.
- 00:46 — Нижняя точка становится горизонтальной осью следующей сцены.

**TRANSITION:** Нижняя точка графика становится горизонтальной осью следующей сцены.

**Verified data anchors:**

```json
{
  "moveDirection": "down",
  "moveStartAt": "26 сент.",
  "moveEndAt": "03 окт.",
  "moveStartPriceUsd": 0.09783057719569956,
  "moveEndPriceUsd": 0.09300540208504207,
  "moveChangePercent": -4.932174836304236
}
```


**SOURCES:**

- CoinGecko market snapshot: https://www.coingecko.com/en/coins/dogecoin

---

## SCENE 05 · 00:48–01:00

**TEXT:** “Отдельный факт — рыночная капитализация на момент среза. Это размер рынка, а не цена одной монеты.”

**SEMANTIC MEANING:** Одна проверяемая рыночная цифра получает главный экранный фокус.

**VISUAL:** FULLSCREEN_STAT

**DOMINANT VISUAL:** Одна крупная цифра занимает кадр, затем за ней раскрывается слой измеряемой величины.

**COMPOSITION:** FULLSCREEN; visual occupies approximately 88% of attention. Число по центру или крупно смещено; подпись и источник закреплены в безопасной зоне.

**BACKGROUND:** amber-numeral-field

**ASSETS:**

- market-snapshot:dogecoin:2026-10-03T14:38:30.000Z — Verified market capitalization at the snapshot time. **[available-data]**; CoinGecko: https://www.coingecko.com/en/coins/dogecoin

**ANIMATION:**

- 00:48 — Тёмный кадр получает вторую графическую форму до появления цифры.
- 00:48 — Число собирается из крупных фрагментов и занимает большую часть высоты.
- 00:49 — Суффикс и единицы измерения пристёгиваются отдельным движением.
- 00:50 — Подпись метрики раскрывается под числом, объясняя что именно измерено.
- 00:52 — Камера мягко приближается, превращая цифру в фактурный фон данных.
- 00:54 — Дата среза и источник появляются компактно, но читаемо.
- 00:56 — Цифра рассыпается по контрольным точкам, не теряя исходное значение.
- 00:58 — Одна точка остаётся и становится центральной осью сравнения.

**TRANSITION:** Контрольная точка числа превращается в центральную ось сравнения.

**Verified data anchors:**

```json
{
  "marketCapUsd": 14522985009,
  "dataAsOf": "2026-10-03T14:38:30.000Z"
}
```


**SOURCES:**

- CoinGecko market snapshot: https://www.coingecko.com/en/coins/dogecoin

---

## SCENE 06 · 01:00–01:12

**TEXT:** “Сравним Dogecoin, Bitcoin и Ethereum за одинаковые семь дней. Это рыночный контекст, не объяснение причин.”

**SEMANTIC MEANING:** Два криптоактива сравниваются в одной полноэкранной композиции и на одном интервале.

**VISUAL:** COIN_COMPARISON

**DOMINANT VISUAL:** Две стороны экрана с реальными лого или типографическими названиями и общей шкалой периода.

**COMPOSITION:** FULLSCREEN; visual occupies approximately 86% of attention. Симметричный split screen: DOGE слева, BTC справа, центральная ось VS.

**BACKGROUND:** doge-vs-bitcoin-split

**ASSETS:**

- coingecko:dogecoin:logo — Official coin logo; use the provider image, never redraw the mark. **[available]**; CoinGecko: https://www.coingecko.com/en/coins/dogecoin
- coingecko:bitcoin:logo — Official Bitcoin logo; fetch and verify before a render. **[needs-verification]**; Do not substitute a generated Bitcoin mark.
- coingecko:ethereum:logo — Official Ethereum logo; fetch and verify before a render. **[needs-verification]**; Do not substitute a generated Ethereum mark.
- same-period-benchmarks:dogecoin:2026-10-03T14:38:30.000Z — DOGE, BTC, and ETH seven-day changes on the same provider snapshot. **[available-data]**; CoinGecko: https://www.coingecko.com/en/coins/dogecoin

**ANIMATION:**

- 01:00 — Центральная ось раскрывает кадр на левую и правую половины.
- 01:00 — DOGE входит слева, Bitcoin — справа; официальные изображения не перерисовываются.
- 01:01 — VS собирается в центре и удерживает композицию.
- 01:02 — Первый показатель появляется слева и справа синхронно.
- 01:04 — Значения недельного изменения сравниваются на одинаковом масштабе.
- 01:06 — Камера проходит по оси и показывает источник и границы периода.
- 01:08 — Половины сходятся, а числа остаются привязанными к своим сторонам.
- 01:10 — Центральная ось схлопывается в переход к редакционному кадру.

**TRANSITION:** Split screen складывается по центральной оси в газетную кромку.

**Verified data anchors:**

```json
{
  "dogeChangePercent7d": -4.932585837704407,
  "btcChangePercent7d": 0.9762,
  "ethChangePercent7d": -0.2473,
  "intervalDays": 7
}
```


**SOURCES:**

- CoinGecko market snapshot: https://www.coingecko.com/en/coins/dogecoin

---

## SCENE 07 · 01:12–01:24

**TEXT:** “Новостной формат здесь — редакционный макет, а не настоящая публикация или неподтверждённое событие.”

**SEMANTIC MEANING:** Новостной формат показывается только как редакционный макет, если реальная публикация не проверена.

**VISUAL:** NEWS_EDITORIAL

**DOMINANT VISUAL:** Редакционный клиппинг с явной маркировкой «МАКЕТ · НЕ РЕАЛЬНАЯ НОВОСТЬ».

**COMPOSITION:** EDITORIAL; visual occupies approximately 82% of attention. Большой газетный лист под углом, с полем заголовка и крупной датой.

**BACKGROUND:** newsprint-white-on-charcoal

**ASSETS:**

- original:editorial-headline-mockup — Newspaper clipping and headline layout for the visual test. **[original-graphic]**; Explicitly fictional/editorial; not a real publication or reported event.

**ANIMATION:**

- 01:12 — Лист резко входит в кадр и раскрывается почти на всю ширину.
- 01:12 — Маркировка «РЕДАКЦИОННЫЙ МАКЕТ» появляется раньше заголовка.
- 01:13 — Заголовок открывается маской по словам.
- 01:14 — Пустое поле источника остаётся пустым: фальшивый логотип СМИ не добавляется.
- 01:16 — Камера делает короткий push-in на выделенную фразу.
- 01:18 — Бумажная текстура и подчёркивание двигаются независимо.
- 01:20 — Лист сгибается по диагонали, готовя уход.
- 01:22 — Край листа проходит через объектив и открывает следующую композицию.

**TRANSITION:** Сгиб газетного листа становится диагональной маской следующей сцены.

**INTEGRITY NOTE:** Редакционная реконструкция, не реальная статья и не новостной факт.


**SOURCES:**

- No external factual source used.

---

## SCENE 08 · 01:24–01:36

**TEXT:** “Сообщество покажем через сообщения и связи, без придуманного числа участников и фальшивых постов.”

**SEMANTIC MEANING:** Сообщество изображается как взаимодействие людей, без выдуманного количества участников.

**VISUAL:** COMMUNITY

**DOMINANT VISUAL:** Абстрактные аватары, сообщения и реакции собираются вокруг DOGE без счётчика аудитории.

**COMPOSITION:** DOMINANT; visual occupies approximately 80% of attention. Большой центральный знак окружён движущимися социальными элементами по всей площади кадра.

**BACKGROUND:** social-orbit-collage

**ASSETS:**

- original:community-social-elements — Abstract avatars, reactions, and posts without real identities or audience counts. **[original-graphic]**; Illustrative social composition; no user count or fake post claims.

**ANIMATION:**

- 01:24 — Центральный узел появляется, а вокруг сразу видны несколько удалённых элементов.
- 01:24 — Аватары и абстрактные сообщения входят из разных глубин.
- 01:25 — Связи формируются между элементами, ведущими к центральному знаку.
- 01:26 — Реакции возникают по одной; никаких числовых счётчиков.
- 01:28 — Камера отъезжает, раскрывая всю сеть.
- 01:30 — Коллаж уплотняется вокруг логотипа, сохраняя читаемое поле.
- 01:32 — Отдельные сообщения расходятся по орбите.
- 01:34 — Орбитальная дуга превращается в схематическую связь следующей сцены.

**TRANSITION:** Социальная орбита преобразуется в линию связи сети.

**INTEGRITY NOTE:** Не добавлять число участников, реальные личности или неподтверждённые посты.


**SOURCES:**

- No external factual source used.

---

## SCENE 09 · 01:36–01:48

**TEXT:** “Блокчейн покажем как схему узлов и потоков; это не карта транзакций в реальном времени.”

**SEMANTIC MEANING:** Технология и блокчейн объясняются через схему узлов и потоков, а не фоновый узор.

**VISUAL:** BLOCKCHAIN_NETWORK

**DOMINANT VISUAL:** Анимированная схема узлов, связей и пакетов данных с маркировкой «иллюстрация».

**COMPOSITION:** MOTION_GRAPHIC; visual occupies approximately 82% of attention. Слой узлов на всю ширину кадра; камера проходит по маршруту данных.

**BACKGROUND:** deep-blue-network-plane

**ASSETS:**

- original:blockchain-network-schematic — Animated nodes, links, and data packets. **[original-graphic]**; Diagram only; not live transactions or current network state.

**ANIMATION:**

- 01:36 — Несколько узлов загораются в разнесённых точках пространства.
- 01:36 — Связи прокладываются между ними, раскрывая глубину сети.
- 01:37 — Пакет данных проходит по двум реальным графическим маршрутам.
- 01:38 — Камера следует за пакетом и делает короткий punch-in.
- 01:40 — Появляется надпись «СХЕМА · НЕ LIVE-ТРАНЗАКЦИИ».
- 01:42 — Сеть расходится на слои, показывая структуру, а не текущие блоки.
- 01:44 — Маршруты сходятся к одному узлу.
- 01:46 — Узел раскрывается в пустое поле для следующей мысли.

**TRANSITION:** Последний узел раскрывается в следующую полноэкранную композицию.

**INTEGRITY NOTE:** Схема не изображает транзакции или состояние сети в реальном времени.


**SOURCES:**

- No external factual source used.

---

## SCENE 10 · 01:48–02:00

**TEXT:** “График показывает, что было, но не говорит, что будет. Проверяйте риск, источник и временной горизонт.”

**SEMANTIC MEANING:** Итоговая или рискованная мысль выражена крупной кинетической типографикой.

**VISUAL:** FULLSCREEN_IMPACT

**DOMINANT VISUAL:** Полноэкранная финальная мысль, которая собирает смысл ролика без рыночной карточки.

**COMPOSITION:** FULLSCREEN; visual occupies approximately 90% of attention. Крупная типографика по всему экрану с безопасными полями и ясной иерархией.

**BACKGROUND:** finale-deep-ink

**ASSETS:**

- script-only:dogecoin:FULLSCREEN_IMPACT — Use exact narration text; do not add unsupported values. **[original-graphic]**

**ANIMATION:**

- 01:48 — Короткое первое слово ударно раскрывается; второе слово уже подано как контур.
- 01:48 — Главная мысль вырастает по строкам и занимает почти весь кадр.
- 01:49 — Ключевое слово получает отдельный punch-in.
- 01:50 — Предыдущие визуальные линии собираются вокруг текста.
- 01:52 — Текст на мгновение замирает, сохраняя читаемость.
- 01:54 — Фраза пересобирается в финальный акцент.
- 01:56 — Камера отъезжает и показывает завершённую композицию.
- 01:58 — Последний элемент движется в точку handoff; пустого tail-кадра нет.

**TRANSITION:** Финальная точка сохраняет направление для следующего цикла; выход не заканчивается пустым экраном.


**SOURCES:**

- No external factual source used.

## Renderer boundary

- This is a semantic visual plan for review; it does not call the video renderer.
- Telegram, production routing, and the active Premium Dynamic renderer remain unchanged.
- The rejected corner-card overlay output is not treated as satisfying this plan.
