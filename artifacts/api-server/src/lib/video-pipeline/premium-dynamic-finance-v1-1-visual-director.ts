import type {
  CoinOverviewLongResearchData,
  CoinOverviewMarketData,
} from "../coin-overview-data";
import type { LongformVoice } from "./longform-visual-director";

export const PREMIUM_DYNAMIC_FINANCE_V1_1_VERSION =
  "PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_DIVERSITY" as const;

export const PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES = [
  "HISTORY_DOCUMENTARY",
  "NEWS_EDITORIAL",
  "PRICE_MOVEMENT",
  "MARKET_DROP",
  "MARKET_CRASH",
  "MARKET_GROWTH",
  "FULLSCREEN_STAT",
  "COIN_REVEAL",
  "COIN_COMPARISON",
  "PROJECT_COMPARISON",
  "COMMUNITY",
  "BLOCKCHAIN_NETWORK",
  "TRADING_INTERFACE",
  "TIMELINE",
  "QUOTE",
  "HEADLINE",
  "DATA_VISUALIZATION",
  "CONCEPT_ILLUSTRATION",
  "MAP",
  "SOCIAL_PROOF",
  "RISK_WARNING",
  "FULLSCREEN_IMPACT",
  "EXISTING_PREMIUM_DYNAMIC",
] as const;

type LegacyCardVisualType =
  | "COIN_INTRO"
  | "MARKET_DATA"
  | "PRICE_CHART"
  | "STAT_CARD"
  | "COMPARISON"
  | "NEWS_CARD"
  | "UI_TERMINAL"
  | "ILLUSTRATION"
  | "ICON_CLUSTER";

export type PremiumDynamicFinanceV1_1VisualType =
  | typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number]
  | LegacyCardVisualType;

export const PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TAGS = [
  "COIN_MENTION",
  "PRICE",
  "PRICE_GROWTH",
  "PRICE_DROP",
  "MARKET_CAP",
  "VOLUME",
  "ATH",
  "ATL",
  "PERCENTAGE",
  "STATISTIC",
  "HISTORY",
  "YEAR",
  "FOUNDER",
  "PERSON",
  "NEWS",
  "COMMUNITY",
  "BLOCKCHAIN",
  "TECHNOLOGY",
  "EXCHANGE",
  "TRADING",
  "RISK",
  "WARNING",
  "COMPARISON",
  "TIMELINE",
  "QUOTE",
  "CONCLUSION",
  "HYPE",
  "GROWTH",
  "COLLAPSE",
  "FUTURE",
  "LIST",
  "EXPLANATION",
] as const;

export type PremiumDynamicFinanceV1_1SemanticTag =
  typeof PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TAGS[number];

export type PremiumDynamicFinanceV1_1Layout =
  | "left"
  | "right"
  | "wide"
  | "centered"
  | "fullscreen";

export type PremiumDynamicFinanceV1_1CompositionMode =
  | "FULLSCREEN"
  | "DOMINANT"
  | "DOCUMENTARY"
  | "DATA"
  | "EDITORIAL"
  | "MOTION_GRAPHIC";

export type PremiumDynamicFinanceV1_1AssetPlan = {
  key: string;
  purpose: string;
  status:
    | "available"
    | "available-data"
    | "needs-verification"
    | "original-graphic"
    | "unavailable";
  sourceLabel?: string;
  sourceUrl?: string;
  integrityLabel?: string;
};

export type PremiumDynamicFinanceV1_1MotionBeat = {
  atMs: number;
  action: string;
};

export type PremiumDynamicFinanceV1_1HistoricalMove = {
  direction: "up" | "down";
  startAt: string;
  endAt: string;
  startPriceUsd: number;
  endPriceUsd: number;
  changePercent: number;
};

export type PremiumDynamicFinanceV1_1VisualEvent = {
  sceneId: number;
  startMs: number;
  endMs: number;
  text: string;
  semanticMeaning: string;
  visualType: PremiumDynamicFinanceV1_1VisualType;
  semanticTags: PremiumDynamicFinanceV1_1SemanticTag[];
  compositionMode: PremiumDynamicFinanceV1_1CompositionMode;
  subjectOccupancyPercent: number;
  cameraFraming: string;
  dominantVisual: string;
  backgroundKey: string;
  assetPlans: PremiumDynamicFinanceV1_1AssetPlan[];
  assetKeys: string[];
  motionBeats: PremiumDynamicFinanceV1_1MotionBeat[];
  transitionOut: string;
  factualData: Record<string, number | string | null>;
  sourceReferences: Array<{ label: string; url: string }>;
  integrityNote?: string;
  /** Legacy compatibility field. Full-scene plans use fullscreen/wide, never corner-card placement. */
  layout: PremiumDynamicFinanceV1_1Layout;
  /** Legacy compatibility field; true means the scene is explicitly editorial or illustrative. */
  decorative: boolean;
  fallbackReason?: string;
  diversityAdjusted: boolean;
};

export type PremiumDynamicFinanceV1_1VisualPlan = {
  version: typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VERSION;
  mode: "PLAN_ONLY";
  aspectRatio: "16:9";
  durationMs: number;
  entity: { id: string; name: string; symbol: string };
  dataAsOf: string;
  dataSource: { label: string; url: string };
  marketSnapshot?: {
    currentPriceUsd: number;
    periodStartPriceUsd: number;
    changePercent7d: number;
    lowPriceUsd7d: number;
    highPriceUsd7d: number;
    marketCapUsd: number | null;
    activityValueUsd: number;
    activityKind: string;
    benchmarks: Array<{ name: string; symbol: string; changePercent7d: number }>;
  };
  events: PremiumDynamicFinanceV1_1VisualEvent[];
  visualTypeCounts: Record<typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number], number>;
  repeatedVisualTypes: number;
  repeatedAssets: string[];
  fallbackScenes: number;
  diagnostics: {
    recentVisualTypes: PremiumDynamicFinanceV1_1VisualType[];
    recentAssets: string[];
    recentLayouts: PremiumDynamicFinanceV1_1Layout[];
    recentBackgrounds: string[];
    adjustedSceneIds: number[];
  };
};

export type PremiumDynamicFinanceV1_1Entity = {
  id: string;
  name: string;
  symbol: string;
};

type SceneBlueprint = {
  meaning: string;
  compositionMode: PremiumDynamicFinanceV1_1CompositionMode;
  subjectOccupancyPercent: number;
  cameraFraming: string;
  dominantVisual: string;
  backgroundKey: string;
  choreography: string[];
  transitionOut: string;
};

const MOTION_TIMES_MS = [0, 650, 1_500, 2_800, 4_300, 6_100, 8_200, 10_200];

const BLUEPRINTS: Record<
  typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number],
  SceneBlueprint
> = {
  HISTORY_DOCUMENTARY: {
    meaning: "Происхождение и подтверждённые исторические опорные точки.",
    compositionMode: "DOCUMENTARY",
    subjectOccupancyPercent: 76,
    cameraFraming: "Крупный газетный фрагмент в перспективе; логотип и временная шкала занимают центр кадра.",
    dominantVisual: "Редакционная газетная полоса трансформируется в таймлайн; только подтверждённые даты.",
    backgroundKey: "archival-paper-and-ink",
    choreography: [
      "Бумажная кромка раскрывается из макро-кропа; второй графический слой виден с первого кадра.",
      "Плашка редакционной реконструкции фиксирует, что это не архивная публикация.",
      "Подтверждённая дата печатается крупно; при отсутствии даты этот шаг пропускается.",
      "Логотип Dogecoin раскрывается как большой центральный объект, не как маленький бейдж.",
      "Линия времени тянется от источника к сегодняшнему рыночному срезу.",
      "Промежуточные годы не добавляются без подтверждённых событий.",
      "Камера приближается к последней точке и переводит взгляд с истории на рыночные данные.",
      "Бумажная полоса складывается в линию графика для следующей сцены.",
    ],
    transitionOut: "Сложенная газетная кромка становится осью ценового графика.",
  },
  NEWS_EDITORIAL: {
    meaning: "Новостной формат показывается только как редакционный макет, если реальная публикация не проверена.",
    compositionMode: "EDITORIAL",
    subjectOccupancyPercent: 82,
    cameraFraming: "Большой газетный лист под углом, с полем заголовка и крупной датой.",
    dominantVisual: "Редакционный клиппинг с явной маркировкой «МАКЕТ · НЕ РЕАЛЬНАЯ НОВОСТЬ».",
    backgroundKey: "newsprint-white-on-charcoal",
    choreography: [
      "Лист резко входит в кадр и раскрывается почти на всю ширину.",
      "Маркировка «РЕДАКЦИОННЫЙ МАКЕТ» появляется раньше заголовка.",
      "Заголовок открывается маской по словам.",
      "Пустое поле источника остаётся пустым: фальшивый логотип СМИ не добавляется.",
      "Камера делает короткий push-in на выделенную фразу.",
      "Бумажная текстура и подчёркивание двигаются независимо.",
      "Лист сгибается по диагонали, готовя уход.",
      "Край листа проходит через объектив и открывает следующую композицию.",
    ],
    transitionOut: "Сгиб газетного листа становится диагональной маской следующей сцены.",
  },
  PRICE_MOVEMENT: {
    meaning: "Наблюдаемое изменение цены на выбранном временном интервале.",
    compositionMode: "DATA",
    subjectOccupancyPercent: 78,
    cameraFraming: "Широкий график через кадр; значения, оси и источник остаются читаемыми.",
    dominantVisual: "Ценовая линия строится по реальным временным точкам, занимает большую часть кадра.",
    backgroundKey: "price-chart-black-grid",
    choreography: [
      "Ось времени вырастает слева направо; сетка появляется вторым уровнем.",
      "Точки фактического ряда последовательно проявляются без сглаживания в новую историю.",
      "Линия цены быстро дорисовывается до последнего доступного значения.",
      "Камера следует вдоль линии к актуальной точке.",
      "Выделяется только значение, реально присутствующее в рыночном снимке.",
      "Под линией появляется короткая подпись о периоде и источнике.",
      "График сжимается к последней точке, не превращаясь в карточку.",
      "Последняя точка расширяется и становится входом следующего движения.",
    ],
    transitionOut: "Фактическая точка графика растёт в направление следующего ценового отрезка.",
  },
  MARKET_DROP: {
    meaning: "Подтверждённый нисходящий участок цены показан как движение на графике, без преувеличения его масштаба.",
    compositionMode: "DATA",
    subjectOccupancyPercent: 84,
    cameraFraming: "Крупный график с фактическим спуском от исходной точки к конечной; шкала и период остаются видимыми.",
    dominantVisual: "Нисходящая линия занимает основную площадь; красный акцент обозначает направление, а не уровень опасности.",
    backgroundKey: "downside-chart-red-grid",
    choreography: [
      "На первом кадре появляется исходная точка выбранного наблюдаемого интервала.",
      "Линия цены рисуется к более низкой фактической точке.",
      "Временные точки следуют реальному ряду, без синтетического резкого провала.",
      "Камера опускается вслед за линией и быстро стабилизируется.",
      "Процент показывается только при доступных исходной и конечной точках.",
      "Подпись фиксирует период и источник.",
      "График отъезжает, показывая относительный масштаб движения.",
      "Нижняя точка становится горизонтальной осью следующей сцены.",
    ],
    transitionOut: "Нижняя точка графика становится горизонтальной осью следующей сцены.",
  },
  MARKET_CRASH: {
    meaning: "Резкое падение показывается как реальный участок ряда либо как явно помеченная схема.",
    compositionMode: "DATA",
    subjectOccupancyPercent: 88,
    cameraFraming: "Экстремально широкий график с крупным наклонным спуском; число появляется только при подтверждённом расчёте.",
    dominantVisual: "Большая красная линия падения и свечи, привязанные к данным либо явно помеченные как схема.",
    backgroundKey: "red-fracture-market-field",
    choreography: [
      "Кадр открывается последним реальным пиком ряда, если он доступен.",
      "Нисходящий участок прочерчивается через весь экран.",
      "Свечи и точки следуют фактической последовательности; синтетические значения не добавляются.",
      "Короткий контролируемый camera shake подчёркивает сам факт падения, не перекрывая данные.",
      "Процент появляется только если он вычислен из подтверждённых точек.",
      "Если фактического участка нет, выводится «СХЕМА ПАДЕНИЯ · НЕ ИСТОРИЧЕСКИЕ ДАННЫЕ».",
      "Камера резко отступает, оставляя источник и временной интервал видимыми.",
      "Красная линия становится горизонтальным срезом для следующего факта.",
    ],
    transitionOut: "Падающая линия обрывается в жёстком match cut на следующем числовом визуале.",
  },
  MARKET_GROWTH: {
    meaning: "Подтверждённый рост виден как движение графика, а не как декоративный процент.",
    compositionMode: "DATA",
    subjectOccupancyPercent: 84,
    cameraFraming: "Крупный график с восходящей диагональю; ростовой отрезок занимает не менее половины кадра.",
    dominantVisual: "Фактическая ценовая линия рисуется снизу вверх с маркировкой исходной и конечной точек.",
    backgroundKey: "green-directional-chart-field",
    choreography: [
      "На первом кадре видна исходная точка выбранного реального интервала.",
      "Линия начинает движение вверх, синхронно с появлением осей.",
      "Наблюдаемые точки и свечи последовательно дополняют траекторию.",
      "Логотип DOGE появляется только как метка ряда, не как отдельная карточка.",
      "Камера делает короткий push-in на конечную точку.",
      "Изменение в процентах появляется только после подтверждённого расчёта.",
      "На экране остаётся подпись «прошлый интервал · не прогноз».",
      "Линия продолжает движение за верхнюю границу и раскрывает следующую сцену.",
    ],
    transitionOut: "Восходящая линия уходит за верхний край и превращается в разделитель следующей сцены.",
  },
  FULLSCREEN_STAT: {
    meaning: "Одна проверяемая рыночная цифра получает главный экранный фокус.",
    compositionMode: "FULLSCREEN",
    subjectOccupancyPercent: 88,
    cameraFraming: "Число по центру или крупно смещено; подпись и источник закреплены в безопасной зоне.",
    dominantVisual: "Одна крупная цифра занимает кадр, затем за ней раскрывается слой измеряемой величины.",
    backgroundKey: "amber-numeral-field",
    choreography: [
      "Тёмный кадр получает вторую графическую форму до появления цифры.",
      "Число собирается из крупных фрагментов и занимает большую часть высоты.",
      "Суффикс и единицы измерения пристёгиваются отдельным движением.",
      "Подпись метрики раскрывается под числом, объясняя что именно измерено.",
      "Камера мягко приближается, превращая цифру в фактурный фон данных.",
      "Дата среза и источник появляются компактно, но читаемо.",
      "Цифра рассыпается по контрольным точкам, не теряя исходное значение.",
      "Одна точка остаётся и становится центральной осью сравнения.",
    ],
    transitionOut: "Контрольная точка числа превращается в центральную ось сравнения.",
  },
  COIN_REVEAL: {
    meaning: "Монета представляется как объект только там, где смысл фразы — именно знакомство с активом.",
    compositionMode: "DOMINANT",
    subjectOccupancyPercent: 78,
    cameraFraming: "Большой логотип или официальный визуал в центре, с крупным макро-кропом и контролируемым отъездом.",
    dominantVisual: "Официальный логотип монеты раскрывается на чистом фирменном поле без панели данных.",
    backgroundKey: "coin-reveal-matte",
    choreography: [
      "Световая щель открывает часть официального знака.",
      "Логотип собирается и быстро занимает центр кадра.",
      "Камера отъезжает, раскрывая глубину и типографический контекст.",
      "Название и тикер появляются рядом с объектом, не в карточке.",
      "Крупный макро-кроп показывает форму знака без его перерисовки.",
      "Логотип поворачивается только в пределах плоского изображения.",
      "Название уходит, оставляя объект на коротком hold.",
      "Форма знака становится маской следующей визуальной сцены.",
    ],
    transitionOut: "Форма логотипа раскрывает следующий визуал через маску.",
  },
  COIN_COMPARISON: {
    meaning: "Два криптоактива сравниваются в одной полноэкранной композиции и на одном интервале.",
    compositionMode: "FULLSCREEN",
    subjectOccupancyPercent: 86,
    cameraFraming: "Симметричный split screen: DOGE слева, BTC справа, центральная ось VS.",
    dominantVisual: "Две стороны экрана с реальными лого или типографическими названиями и общей шкалой периода.",
    backgroundKey: "doge-vs-bitcoin-split",
    choreography: [
      "Центральная ось раскрывает кадр на левую и правую половины.",
      "DOGE входит слева, Bitcoin — справа; официальные изображения не перерисовываются.",
      "VS собирается в центре и удерживает композицию.",
      "Первый показатель появляется слева и справа синхронно.",
      "Значения недельного изменения сравниваются на одинаковом масштабе.",
      "Камера проходит по оси и показывает источник и границы периода.",
      "Половины сходятся, а числа остаются привязанными к своим сторонам.",
      "Центральная ось схлопывается в переход к редакционному кадру.",
    ],
    transitionOut: "Split screen складывается по центральной оси в газетную кромку.",
  },
  PROJECT_COMPARISON: {
    meaning: "Сравнение проектов строится по явно названным параметрам, а не по декоративным карточкам.",
    compositionMode: "FULLSCREEN",
    subjectOccupancyPercent: 82,
    cameraFraming: "Большой двухколоночный кадр с единой шкалой и центральной осью.",
    dominantVisual: "Две визуально равные стороны и одна общая строка сравнения за раз.",
    backgroundKey: "project-comparison-halves",
    choreography: [
      "Две разные цветовые плоскости раскрываются с краёв.",
      "Названия проектов закрепляются в своих половинах.",
      "Центральная линия прорисовывает общий параметр.",
      "Параметры появляются по одному, не стеком.",
      "Камера по очереди фокусируется на каждой стороне.",
      "Сравнение удерживает одинаковый масштаб и период.",
      "Неподтверждённые поля остаются пустыми, а не заполняются оценкой.",
      "Две плоскости сходятся в общую форму следующей сцены.",
    ],
    transitionOut: "Общие оси сводятся в одну линию-переход.",
  },
  COMMUNITY: {
    meaning: "Сообщество изображается как взаимодействие людей, без выдуманного количества участников.",
    compositionMode: "DOMINANT",
    subjectOccupancyPercent: 80,
    cameraFraming: "Большой центральный знак окружён движущимися социальными элементами по всей площади кадра.",
    dominantVisual: "Абстрактные аватары, сообщения и реакции собираются вокруг DOGE без счётчика аудитории.",
    backgroundKey: "social-orbit-collage",
    choreography: [
      "Центральный узел появляется, а вокруг сразу видны несколько удалённых элементов.",
      "Аватары и абстрактные сообщения входят из разных глубин.",
      "Связи формируются между элементами, ведущими к центральному знаку.",
      "Реакции возникают по одной; никаких числовых счётчиков.",
      "Камера отъезжает, раскрывая всю сеть.",
      "Коллаж уплотняется вокруг логотипа, сохраняя читаемое поле.",
      "Отдельные сообщения расходятся по орбите.",
      "Орбитальная дуга превращается в схематическую связь следующей сцены.",
    ],
    transitionOut: "Социальная орбита преобразуется в линию связи сети.",
  },
  BLOCKCHAIN_NETWORK: {
    meaning: "Технология и блокчейн объясняются через схему узлов и потоков, а не фоновый узор.",
    compositionMode: "MOTION_GRAPHIC",
    subjectOccupancyPercent: 82,
    cameraFraming: "Слой узлов на всю ширину кадра; камера проходит по маршруту данных.",
    dominantVisual: "Анимированная схема узлов, связей и пакетов данных с маркировкой «иллюстрация».",
    backgroundKey: "deep-blue-network-plane",
    choreography: [
      "Несколько узлов загораются в разнесённых точках пространства.",
      "Связи прокладываются между ними, раскрывая глубину сети.",
      "Пакет данных проходит по двум реальным графическим маршрутам.",
      "Камера следует за пакетом и делает короткий punch-in.",
      "Появляется надпись «СХЕМА · НЕ LIVE-ТРАНЗАКЦИИ».",
      "Сеть расходится на слои, показывая структуру, а не текущие блоки.",
      "Маршруты сходятся к одному узлу.",
      "Узел раскрывается в пустое поле для следующей мысли.",
    ],
    transitionOut: "Последний узел раскрывается в следующую полноэкранную композицию.",
  },
  TRADING_INTERFACE: {
    meaning: "Торговый интерфейс используется, только когда текст говорит о торговле или биржевом механизме.",
    compositionMode: "DOMINANT",
    subjectOccupancyPercent: 76,
    cameraFraming: "Большой интерфейс на 70–80% кадра, с явной маркировкой, если экран не реальный.",
    dominantVisual: "Крупный торговый интерфейс; только проверенные значения, без имитации исполняемых котировок.",
    backgroundKey: "trading-interface-dark",
    choreography: [
      "Панели интерфейса раскрываются как одна связанная система.",
      "Название пары и статус источника появляются до чисел.",
      "Один график прорисовывается в основном поле.",
      "Секция книги заявок появляется только при наличии настоящих данных.",
      "Камера приближается к активной области интерфейса.",
      "Неподдерживаемые поля явно заменяются маркировкой «СХЕМА».",
      "Интерфейс складывается по сетке.",
      "Одна линия сетки становится переходом.",
    ],
    transitionOut: "Сетка интерфейса закрывается и оставляет одну линию для следующего кадра.",
  },
  TIMELINE: {
    meaning: "Подтверждённые события упорядочиваются по времени; неизвестные промежуточные даты не придумываются.",
    compositionMode: "DOCUMENTARY",
    subjectOccupancyPercent: 72,
    cameraFraming: "Широкая временная ось пересекает кадр; отдельные опорные точки имеют достаточно места.",
    dominantVisual: "Горизонтальная timeline с датами и событиями, подтверждёнными источником.",
    backgroundKey: "timeline-archive-charcoal",
    choreography: [
      "Ось времени раскрывается от одного подтверждённого якоря.",
      "Вторая опорная точка входит с другой стороны.",
      "Подтверждённые события появляются по одному.",
      "Камера проходит по оси, не ускоряясь на длинных пробелах данных.",
      "Даты крупно фиксируются над своими точками.",
      "Незаполненные промежутки остаются визуально пустыми.",
      "Ось поворачивается в перспективу.",
      "Последний якорь становится началом новой оси.",
    ],
    transitionOut: "Временная ось поворачивается и становится осью рыночного графика.",
  },
  QUOTE: {
    meaning: "Короткая точная фраза получает собственный экран и управляемую паузу.",
    compositionMode: "FULLSCREEN",
    subjectOccupancyPercent: 88,
    cameraFraming: "Крупная типографика в безопасной зоне, без карточки или лишнего интерфейса.",
    dominantVisual: "Большая фраза раскрывается маской на почти пустом, но предметно оформленном поле.",
    backgroundKey: "quote-ink-field",
    choreography: [
      "Первое короткое слово появляется ударно, пока второе слово уже частично видно.",
      "Основная фраза раскрывается по строкам с разным темпом.",
      "Одно ключевое слово получает типографический акцент.",
      "Камера приближается на одном слове, не двигая всю фразу равномерно.",
      "Вторая строка меняет масштаб и усиливает смысл.",
      "Короткая пауза удерживает читаемость.",
      "Типографика собирается в компактный центр.",
      "Финальный глиф становится маской перехода.",
    ],
    transitionOut: "Последний глиф раскрывает следующую композицию.",
  },
  HEADLINE: {
    meaning: "Заголовок — часть визуального рассказа, а не строка внутри карточки.",
    compositionMode: "EDITORIAL",
    subjectOccupancyPercent: 82,
    cameraFraming: "Крупный заголовок на отдельном листе или полноэкранном editorial-поле.",
    dominantVisual: "Заголовок проходит через кадр как главный объект, с датой и источником только при проверке.",
    backgroundKey: "headline-cutout-field",
    choreography: [
      "Ключевое слово резко проявляется в крупном масштабе.",
      "Следующая строка собирает смысл фразы.",
      "Второстепенная дата появляется лишь если она подтверждена.",
      "Линия подчёркивания прорисовывается под заголовком.",
      "Камера проходит вдоль текста к ключевому слову.",
      "Поля вокруг текста сжимаются в газетную полосу.",
      "Заголовок сгибается по вертикальной оси.",
      "Сгиб переносит внимание в следующую сцену.",
    ],
    transitionOut: "Заголовок складывается в вертикальный газетный сгиб.",
  },
  DATA_VISUALIZATION: {
    meaning: "Связанные показатели показаны как большой data-визуал, а не набор угловых карточек.",
    compositionMode: "DATA",
    subjectOccupancyPercent: 82,
    cameraFraming: "График или одна визуальная метрика в центре; легенда и источник — в безопасных нижних зонах.",
    dominantVisual: "Анимированный график, шкала или поток значений занимает центральную часть кадра.",
    backgroundKey: "data-visualization-blueprint",
    choreography: [
      "Шкала появляется до первого значения.",
      "Данные строятся по временным точкам или подтверждённым агрегатам.",
      "Главный показатель выделяется в масштабе, не в рамке карточки.",
      "Камера пересекает визуал слева направо.",
      "Второй ряд данных включается только если он сопоставим.",
      "Источник и дата фиксируются в нижней безопасной полосе.",
      "Линии визуала собираются в одну доминирующую форму.",
      "Форма уходит в сторону следующей композиции.",
    ],
    transitionOut: "Главная линия визуализации уходит в сторону и задаёт направление следующей сцены.",
  },
  CONCEPT_ILLUSTRATION: {
    meaning: "Абстрактная идея объясняется отдельной оригинальной иллюстрацией.",
    compositionMode: "DOMINANT",
    subjectOccupancyPercent: 74,
    cameraFraming: "Один крупный предметный образ в асимметричной композиции.",
    dominantVisual: "Оригинальная иллюстрация, напрямую соответствующая смыслу фразы.",
    backgroundKey: "concept-illustration-matte",
    choreography: [
      "В кадре появляется главный объект и поддерживающая форма.",
      "Объект трансформируется, показывая отношение из фразы.",
      "Камера делает короткий push-in на точку взаимодействия.",
      "Подпись появляется только если без неё смысл неоднозначен.",
      "Вторичная форма меняет масштаб и раскрывает следствие.",
      "Композиция удерживается в читаемом состоянии.",
      "Объекты расходятся по разным плоскостям.",
      "Одна форма передаётся следующей сцене.",
    ],
    transitionOut: "Одна форма иллюстрации сохраняется как carrier в следующем кадре.",
  },
  MAP: {
    meaning: "Географические связи показываются картой только при наличии пространственного смысла.",
    compositionMode: "DATA",
    subjectOccupancyPercent: 84,
    cameraFraming: "Карта на весь кадр с крупными регионами и траекториями, не с декоративными метками.",
    dominantVisual: "Карта с подтверждёнными географическими точками и анимированными маршрутами.",
    backgroundKey: "map-grid-midnight",
    choreography: [
      "Контур карты раскрывается из темноты.",
      "Подтверждённые географические точки загораются по одной.",
      "Маршрут прорисовывается между имеющимися точками.",
      "Камера приближается к смысловому центру.",
      "Подписи появляются в безопасных свободных зонах.",
      "Данные без географической привязки не размещаются на карте.",
      "Маршрут отъезжает в масштаб всей карты.",
      "Линия маршрута становится переходом.",
    ],
    transitionOut: "Маршрут карты сворачивается в линию следующей сцены.",
  },
  SOCIAL_PROOF: {
    meaning: "Подтверждённые публичные сигналы сообщества без выдуманного социального счётчика.",
    compositionMode: "DOMINANT",
    subjectOccupancyPercent: 80,
    cameraFraming: "Разнесённые социальные элементы с читаемым источником у каждого реального показателя.",
    dominantVisual: "Социальные сообщения и сигналы собираются в масштабную композицию без неподтверждённых чисел.",
    backgroundKey: "social-proof-collage",
    choreography: [
      "Несколько сообщений входят с разных краёв и сразу занимают заметную площадь.",
      "Даты или источники становятся видны раньше цитат.",
      "Подтверждённые фрагменты группируются по теме.",
      "Камера приближается к одной проверенной фразе.",
      "Реакции и линии связи собирают общую композицию.",
      "Фальшивые аватары публичных персон не добавляются.",
      "Коллаж отъезжает и показывает взаимосвязи.",
      "Линии схлопываются в переход.",
    ],
    transitionOut: "Линии связи превращаются в следующую схему.",
  },
  RISK_WARNING: {
    meaning: "Риск сообщается прямо, без ложной точности или обещания защиты.",
    compositionMode: "FULLSCREEN",
    subjectOccupancyPercent: 88,
    cameraFraming: "Крупная предупреждающая типографика и один поддерживающий знак риска.",
    dominantVisual: "Полноэкранное предупреждение, где смысл читается без дополнительного интерфейса.",
    backgroundKey: "risk-red-black-field",
    choreography: [
      "Предупреждающий знак возникает ударно, пока заголовок уже проявляется.",
      "Ключевое слово разворачивается на большую часть кадра.",
      "Поддерживающая строка входит отдельно.",
      "Короткий controlled shake подчёркивает акцент и быстро затухает.",
      "Источник факта появляется только если риск описан конкретными данными.",
      "Читаемая композиция удерживается без дополнительных чисел.",
      "Красный цвет постепенно уходит к нейтральному тону.",
      "Слово риска становится переходом к итоговой мысли.",
    ],
    transitionOut: "Предупреждающее слово уменьшается в одну точку для финальной фразы.",
  },
  FULLSCREEN_IMPACT: {
    meaning: "Итоговая или рискованная мысль выражена крупной кинетической типографикой.",
    compositionMode: "FULLSCREEN",
    subjectOccupancyPercent: 90,
    cameraFraming: "Крупная типографика по всему экрану с безопасными полями и ясной иерархией.",
    dominantVisual: "Полноэкранная финальная мысль, которая собирает смысл ролика без рыночной карточки.",
    backgroundKey: "finale-deep-ink",
    choreography: [
      "Короткое первое слово ударно раскрывается; второе слово уже подано как контур.",
      "Главная мысль вырастает по строкам и занимает почти весь кадр.",
      "Ключевое слово получает отдельный punch-in.",
      "Предыдущие визуальные линии собираются вокруг текста.",
      "Текст на мгновение замирает, сохраняя читаемость.",
      "Фраза пересобирается в финальный акцент.",
      "Камера отъезжает и показывает завершённую композицию.",
      "Последний элемент движется в точку handoff; пустого tail-кадра нет.",
    ],
    transitionOut: "Финальная точка сохраняет направление для следующего цикла; выход не заканчивается пустым экраном.",
  },
  EXISTING_PREMIUM_DYNAMIC: {
    meaning: "Безопасный fallback сохраняет исходный Premium Dynamic визуальный beat и не подменяет смысл карточкой.",
    compositionMode: "DOMINANT",
    subjectOccupancyPercent: 70,
    cameraFraming: "Композиция следует существующему Premium Dynamic beat, не добавляя неподтверждённые активы.",
    dominantVisual: "Существующий Premium Dynamic визуал как фон и движение; новые угловые панели не накладываются.",
    backgroundKey: "existing-premium-dynamic-owned-background",
    choreography: [
      "Существующий визуальный beat задаёт исходную композицию.",
      "Кинетическая типографика связывается с ключевыми словами.",
      "Камера выполняет предусмотренное движение.",
      "Акцент появляется только при семантической связи с фразой.",
      "Сцена удерживает читаемую иерархию.",
      "Фон не заменяется универсальным абстрактным мотивом.",
      "Ключевая форма готовится к transition.",
      "Исходный Premium Dynamic transition завершает beat.",
    ],
    transitionOut: "Использовать уже запланированный Premium Dynamic transition без дополнительного overlay.",
  },
};

const RECENT_WINDOW = 4;
const ENTITY_NAME_MIN_LENGTH = 3;

function normalize(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

function contains(text: string, expression: RegExp): boolean {
  return expression.test(text);
}

function entityIsMentioned(text: string, entity: PremiumDynamicFinanceV1_1Entity): boolean {
  const normalized = normalize(text);
  const candidates = [entity.name, entity.symbol, entity.id]
    .map(normalize)
    .filter((candidate) => candidate.length >= ENTITY_NAME_MIN_LENGTH);
  return candidates.some((candidate) => {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "iu").test(normalized);
  });
}

export function detectPremiumDynamicFinanceV1_1SemanticTags(
  text: string,
  entity: PremiumDynamicFinanceV1_1Entity,
): PremiumDynamicFinanceV1_1SemanticTag[] {
  const normalized = normalize(text);
  const tags = new Set<PremiumDynamicFinanceV1_1SemanticTag>();
  const add = (
    tag: PremiumDynamicFinanceV1_1SemanticTag,
    expression: RegExp,
  ) => {
    if (contains(normalized, expression)) tags.add(tag);
  };

  if (entityIsMentioned(normalized, entity)) tags.add("COIN_MENTION");
  add("PRICE", /(?:цен\p{L}*|курс|стоимост\p{L}*|price)/iu);
  add("PRICE_GROWTH", /(?:вырос|рост|поднял|увеличил|пробил|восход|раст[её]т)/iu);
  add("PRICE_DROP", /(?:упал|снизил|падени|просад|обвал|коррекци|нисход)/iu);
  add("MARKET_CAP", /(?:капитализац|market\s*cap)/iu);
  add("VOLUME", /(?:объ[её]м|оборот|volume)/iu);
  add("ATH", /(?:\bath\b|историческ.{0,12}максим|максимум)/iu);
  add("ATL", /(?:\batl\b|историческ.{0,12}миним|минимум)/iu);
  add("PERCENTAGE", /(?:%|процент|процента|процентов|изменени.{0,12}за семь дней)/iu);
  add("STATISTIC", /(?:\d|статистик|показател|ранг|рейтинг|срез|данные|факт)/iu);
  add("HISTORY", /(?:истори|раньше|происхожд|запуск|появил|генезис)/iu);
  add("YEAR", /(?:^|\D)(?:19|20)\d{2}(?:\D|$)|(?:год|года|генезис)/iu);
  add("FOUNDER", /(?:основател|создател|founder)/iu);
  add("PERSON", /(?:\b[A-ZА-ЯЁ][a-zа-яё]+ [A-ZА-ЯЁ][a-zа-яё]+\b|человек|автор)/u);
  add("NEWS", /(?:новост|событи|заголов|пресс-релиз|редакционн.{0,18}(?:карточк|макет|композиц|визуал))/iu);
  add("COMMUNITY", /(?:сообществ|участник|комьюнити|community)/iu);
  add("BLOCKCHAIN", /(?:блокчейн|ончейн|узел|транзакци|blockchain)/iu);
  add("TECHNOLOGY", /(?:технолог|протокол|сеть|код|open.source)/iu);
  add("EXCHANGE", /(?:бирж|обменник|exchange|стакан заявок)/iu);
  add("TRADING", /(?:торг|сделк|заявк|кошел[её]к|trading)/iu);
  add("RISK", /(?:риск|опас|волатил|убыт|потер|гаранти|обещани)/iu);
  add("WARNING", /(?:не смешивать|отделим|предупреж|не прогноз|не является обещанием)/iu);
  add("COMPARISON", /(?:сравн|по сравнению|напротив|против|vs\.?)/iu);
  add("TIMELINE", /(?:временн.{0,12}шкал|этап|затем|по порядку|сначала.{0,30}затем)/iu);
  add("QUOTE", /(?:[«»“”"]|цитат|редакционн.{0,12}вывод)/u);
  add("CONCLUSION", /(?:итог|вывод|главн.{0,12}мысл|заключени|поэтому|график показывает)/iu);
  add("HYPE", /(?:хайп|ажиотаж|внимани|знаменит|шум)/iu);
  add("GROWTH", /(?:рост|вырос|увелич|раст[её]т|восход)/iu);
  add("COLLAPSE", /(?:обвал|крах|схлоп|коллапс)/iu);
  add("FUTURE", /(?:будущ|прогноз|дальше|завтра)/iu);
  add("LIST", /(?:список|перечислим|три темы|несколько пунктов|во-первых|во-вторых)/iu);
  add("EXPLANATION", /(?:объясн|представим|схема|разбер[её]м|показывает)/iu);

  return PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TAGS.filter((tag) => tags.has(tag));
}

function hasAny(
  tags: ReadonlySet<PremiumDynamicFinanceV1_1SemanticTag>,
  ...values: PremiumDynamicFinanceV1_1SemanticTag[]
): boolean {
  return values.some((value) => tags.has(value));
}

function chooseVisualType(
  tags: ReadonlySet<PremiumDynamicFinanceV1_1SemanticTag>,
  text: string,
): typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number] {
  if (tags.has("NEWS")) return "NEWS_EDITORIAL";
  if (tags.has("HISTORY")) return "HISTORY_DOCUMENTARY";
  if (tags.has("COMPARISON")) {
    return /(?:bitcoin|биткоин|btc|ethereum|эфир|eth|doge|dogecoin)/iu.test(text)
      ? "COIN_COMPARISON"
      : "PROJECT_COMPARISON";
  }
  if (tags.has("COMMUNITY")) return "COMMUNITY";
  if (hasAny(tags, "BLOCKCHAIN", "TECHNOLOGY")) return "BLOCKCHAIN_NETWORK";
  if (tags.has("PRICE_GROWTH") && tags.has("PRICE")) return "MARKET_GROWTH";
  if (tags.has("PRICE_DROP") && tags.has("COLLAPSE")) return "MARKET_CRASH";
  if (tags.has("PRICE") && tags.has("PRICE_DROP")) return "MARKET_DROP";
  if (hasAny(tags, "MARKET_CAP", "VOLUME", "STATISTIC", "PERCENTAGE", "ATH", "ATL")) {
    return "FULLSCREEN_STAT";
  }
  if (tags.has("PRICE")) return "PRICE_MOVEMENT";
  if (tags.has("TIMELINE") || (tags.has("YEAR") && tags.has("HISTORY"))) return "TIMELINE";
  if (tags.has("QUOTE")) return "QUOTE";
  if (tags.has("CONCLUSION") && tags.has("RISK")) return "FULLSCREEN_IMPACT";
  if (hasAny(tags, "RISK", "WARNING")) return "RISK_WARNING";
  if (hasAny(tags, "CONCLUSION", "HYPE", "COLLAPSE")) return "FULLSCREEN_IMPACT";
  if (hasAny(tags, "EXCHANGE", "TRADING")) return "TRADING_INTERFACE";
  if (tags.has("COIN_MENTION")) return "COIN_REVEAL";
  if (tags.has("EXPLANATION")) return "CONCEPT_ILLUSTRATION";
  return "EXISTING_PREMIUM_DYNAMIC";
}

function defaultLayout(
  visualType: typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number],
): PremiumDynamicFinanceV1_1Layout {
  const blueprint = BLUEPRINTS[visualType];
  if (blueprint.compositionMode === "FULLSCREEN") return "fullscreen";
  if (blueprint.compositionMode === "DOCUMENTARY" || blueprint.compositionMode === "DATA") {
    return "wide";
  }
  return "centered";
}

function findHistoricalMove(
  points: CoinOverviewMarketData["priceSamples"],
  direction: "up" | "down",
): PremiumDynamicFinanceV1_1HistoricalMove | null {
  let selected: PremiumDynamicFinanceV1_1HistoricalMove | null = null;
  for (let startIndex = 0; startIndex < points.length - 1; startIndex += 1) {
    const start = points[startIndex]!;
    if (start.priceUsd <= 0) continue;
    for (let endIndex = startIndex + 1; endIndex < points.length; endIndex += 1) {
      const end = points[endIndex]!;
      const changePercent = ((end.priceUsd - start.priceUsd) / start.priceUsd) * 100;
      if (direction === "up" ? changePercent <= 0 : changePercent >= 0) continue;
      if (!selected || (direction === "up"
        ? changePercent > selected.changePercent
        : changePercent < selected.changePercent)) {
        selected = {
          direction,
          startAt: start.label,
          endAt: end.label,
          startPriceUsd: start.priceUsd,
          endPriceUsd: end.priceUsd,
          changePercent,
        };
      }
    }
  }
  return selected;
}

function buildAssetPlans(input: {
  visualType: typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number];
  entity: PremiumDynamicFinanceV1_1Entity;
  market?: CoinOverviewMarketData;
  research?: CoinOverviewLongResearchData | null;
  historicalMove?: PremiumDynamicFinanceV1_1HistoricalMove | null;
}): PremiumDynamicFinanceV1_1AssetPlan[] {
  const { visualType, entity, market, research, historicalMove } = input;
  const dataSource = market
    ? { sourceLabel: market.sourceLabel, sourceUrl: market.coin.sourceUrl }
    : {};
  const logoAvailable = Boolean(market?.coin.logoDataUri);
  const original = (key: string, purpose: string, integrityLabel?: string) => ({
    key,
    purpose,
    status: "original-graphic" as const,
    ...(integrityLabel ? { integrityLabel } : {}),
  });
  const coinLogo = {
    key: `coingecko:${entity.id}:logo`,
    purpose: "Official coin logo; use the provider image, never redraw the mark.",
    status: logoAvailable ? "available" as const : "needs-verification" as const,
    ...dataSource,
  };
  const priceSeries = {
    key: `${market?.sourceLabel.toLocaleLowerCase("en-US") ?? "market-data"}:${entity.id}:price-history:${market?.dataAsOf ?? "unavailable"}`,
    purpose: "Observed seven-day price samples; preserve timestamps and values.",
    status: market?.priceSamples.length ? "available-data" as const : "unavailable" as const,
    ...dataSource,
  };
  const dateAsset: PremiumDynamicFinanceV1_1AssetPlan = research?.genesisDate
    ? {
        key: `verified-history:${entity.id}:${research.genesisDate}`,
        purpose: "Genesis date returned by the research source.",
        status: "available",
        sourceLabel: research.sourceLabel,
        sourceUrl: research.historySourceUrl,
      }
    : {
        key: `verified-history:${entity.id}`,
        purpose: "Only add a date or historical event if a source returns it.",
        status: research ? "unavailable" : "needs-verification",
        ...(research?.historySourceUrl ? { sourceUrl: research.historySourceUrl } : {}),
        integrityLabel: "No confirmed date in current research response; do not invent one.",
      };

  switch (visualType) {
    case "HISTORY_DOCUMENTARY":
      return [
        original(
          "original:editorial-history-reconstruction",
          "Newspaper-style documentary artwork, visibly labeled as a reconstruction.",
          "Not a real archived newspaper or article.",
        ),
        dateAsset,
        ...(logoAvailable ? [coinLogo] : []),
      ];
    case "PRICE_MOVEMENT":
    case "DATA_VISUALIZATION":
      return [priceSeries];
    case "MARKET_GROWTH":
    case "MARKET_DROP":
    case "MARKET_CRASH":
      return historicalMove
        ? [{
            ...priceSeries,
            purpose: `${historicalMove.direction === "up" ? "Rising" : "falling"} interval selected from observed samples.`,
            integrityLabel: "Use only the attached samples and calculated change.",
          }]
        : [{
            ...priceSeries,
            status: "unavailable",
            integrityLabel: "No matching observed interval; if shown, label as an illustration and omit a market percentage.",
          }];
    case "FULLSCREEN_STAT":
      return [{
        key: `market-snapshot:${entity.id}:${market?.dataAsOf ?? "unavailable"}`,
        purpose: market?.marketCapUsd !== null && market?.marketCapUsd !== undefined
          ? "Verified market capitalization at the snapshot time."
          : "Current observed unit price; market capitalization was not provided.",
        status: market ? "available-data" : "unavailable",
        ...dataSource,
      }];
    case "COIN_REVEAL":
      return [coinLogo];
    case "COIN_COMPARISON":
      return [
        coinLogo,
        {
          key: "coingecko:bitcoin:logo",
          purpose: "Official Bitcoin logo; fetch and verify before a render.",
          status: "needs-verification",
          sourceLabel: "CoinGecko benchmark",
          integrityLabel: "Do not substitute a generated Bitcoin mark.",
        },
        {
          key: "coingecko:ethereum:logo",
          purpose: "Official Ethereum logo; fetch and verify before a render.",
          status: "needs-verification",
          sourceLabel: "CoinGecko benchmark",
          integrityLabel: "Do not substitute a generated Ethereum mark.",
        },
        {
          key: `same-period-benchmarks:${entity.id}:${market?.dataAsOf ?? "unavailable"}`,
          purpose: "DOGE, BTC, and ETH seven-day changes on the same provider snapshot.",
          status: market ? "available-data" : "unavailable",
          ...dataSource,
        },
      ];
    case "TIMELINE":
      return [dateAsset];
    case "NEWS_EDITORIAL":
    case "HEADLINE":
      return [original(
        "original:editorial-headline-mockup",
        "Newspaper clipping and headline layout for the visual test.",
        "Explicitly fictional/editorial; not a real publication or reported event.",
      )];
    case "COMMUNITY":
    case "SOCIAL_PROOF":
      return [original(
        "original:community-social-elements",
        "Abstract avatars, reactions, and posts without real identities or audience counts.",
        "Illustrative social composition; no user count or fake post claims.",
      )];
    case "BLOCKCHAIN_NETWORK":
      return [original(
        "original:blockchain-network-schematic",
        "Animated nodes, links, and data packets.",
        "Diagram only; not live transactions or current network state.",
      )];
    case "TRADING_INTERFACE":
      return [original(
        "original:trading-interface-schematic",
        "Large interface composition; no order book unless a verified source is available.",
        "Mark as a schematic if no live exchange data is attached.",
      )];
    case "MAP":
      return [original(
        "original:verified-map-composition",
        "Map only when the narration contains verified geographic data.",
        "Do not imply transaction locations from non-geographic data.",
      )];
    case "CONCEPT_ILLUSTRATION":
      return [original(
        `original:concept-illustration:${entity.id}`,
        "Original illustration selected to express the sentence meaning.",
      )];
    case "QUOTE":
    case "RISK_WARNING":
    case "FULLSCREEN_IMPACT":
    case "PROJECT_COMPARISON":
    case "EXISTING_PREMIUM_DYNAMIC":
      return market ? [{
        key: `verified-script:${entity.id}:${visualType}`,
        purpose: "Use exact script text; add no unsourced market values.",
        status: "available-data",
        ...dataSource,
      }] : [original(
        `script-only:${entity.id}:${visualType}`,
        "Use exact narration text; do not add unsupported values.",
      )];
  }
}

function historicalMoveForScene(
  visualType: typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number],
  tags: ReadonlySet<PremiumDynamicFinanceV1_1SemanticTag>,
  market?: CoinOverviewMarketData,
): PremiumDynamicFinanceV1_1HistoricalMove | null {
  if (!market) return null;
  if (visualType === "MARKET_GROWTH" || tags.has("PRICE_GROWTH")) {
    return findHistoricalMove(market.priceSamples, "up");
  }
  if (
    visualType === "MARKET_DROP"
    || visualType === "MARKET_CRASH"
    || tags.has("PRICE_DROP")
  ) {
    return findHistoricalMove(market.priceSamples, "down");
  }
  return null;
}

function factualDataForScene(input: {
  visualType: typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number];
  market?: CoinOverviewMarketData;
  historicalMove?: PremiumDynamicFinanceV1_1HistoricalMove | null;
}): Record<string, number | string | null> {
  const { visualType, market, historicalMove } = input;
  if (!market) return {};
  if (visualType === "PRICE_MOVEMENT" || visualType === "DATA_VISUALIZATION") {
    return {
      currentPriceUsd: market.currentPriceUsd,
      periodStartPriceUsd: market.periodStartPriceUsd,
      changePercent7d: market.changePercent7d,
      sampleCount: market.priceSamples.length,
    };
  }
  if (
    visualType === "MARKET_GROWTH"
    || visualType === "MARKET_DROP"
    || visualType === "MARKET_CRASH"
  ) {
    return historicalMove ? {
      moveDirection: historicalMove.direction,
      moveStartAt: historicalMove.startAt,
      moveEndAt: historicalMove.endAt,
      moveStartPriceUsd: historicalMove.startPriceUsd,
      moveEndPriceUsd: historicalMove.endPriceUsd,
      moveChangePercent: historicalMove.changePercent,
    } : {
      moveDirection: visualType === "MARKET_GROWTH" ? "up" : "down",
      moveAvailable: "no matching observed samples",
    };
  }
  if (visualType === "FULLSCREEN_STAT") {
    return market.marketCapUsd !== null
      ? { marketCapUsd: market.marketCapUsd, dataAsOf: market.dataAsOf }
      : { currentPriceUsd: market.currentPriceUsd, dataAsOf: market.dataAsOf };
  }
  if (visualType === "COIN_COMPARISON") {
    return {
      dogeChangePercent7d: market.changePercent7d,
      btcChangePercent7d: market.benchmarks[0].changePercent7d,
      ethChangePercent7d: market.benchmarks[1].changePercent7d,
      intervalDays: market.periodDays,
    };
  }
  return {};
}

function integrityNoteForScene(input: {
  visualType: typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number];
  market?: CoinOverviewMarketData;
  research?: CoinOverviewLongResearchData | null;
  historicalMove?: PremiumDynamicFinanceV1_1HistoricalMove | null;
}): string | undefined {
  const { visualType, market, research, historicalMove } = input;
  if (visualType === "HISTORY_DOCUMENTARY" && !research?.genesisDate) {
    return "В текущем ответе источника нет подтверждённой даты запуска; не показывать 2013 или другую дату.";
  }
  if (
    (visualType === "MARKET_GROWTH" || visualType === "MARKET_DROP" || visualType === "MARKET_CRASH")
    && !historicalMove
  ) {
    return "Для выбранного направления нет подходящего фактического отрезка; показывать только маркированную схему без процента.";
  }
  if (visualType === "NEWS_EDITORIAL" || visualType === "HEADLINE") {
    return "Редакционная реконструкция, не реальная статья и не новостной факт.";
  }
  if (visualType === "COMMUNITY" || visualType === "SOCIAL_PROOF") {
    return "Не добавлять число участников, реальные личности или неподтверждённые посты.";
  }
  if (visualType === "BLOCKCHAIN_NETWORK") {
    return "Схема не изображает транзакции или состояние сети в реальном времени.";
  }
  if (visualType === "COIN_COMPARISON" && !market) {
    return "Не сравнивать активы, пока не получены значения за одинаковый период.";
  }
  if (visualType === "FULLSCREEN_STAT" && market?.marketCapUsd === null) {
    return "Источник не предоставил капитализацию; показывать проверенную цену вместо рыночной капитализации.";
  }
  return undefined;
}

function sourceReferencesForScene(input: {
  visualType: typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number];
  market?: CoinOverviewMarketData;
  research?: CoinOverviewLongResearchData | null;
}): Array<{ label: string; url: string }> {
  const references: Array<{ label: string; url: string }> = [];
  if (input.market) {
    references.push({
      label: `${input.market.sourceLabel} market snapshot`,
      url: input.market.coin.sourceUrl,
    });
  }
  if (
    input.research?.historySourceUrl
    && (input.visualType === "HISTORY_DOCUMENTARY" || input.visualType === "TIMELINE")
  ) {
    references.push({
      label: `${input.research.sourceLabel} historical research`,
      url: input.research.historySourceUrl,
    });
  }
  for (const url of input.research?.sourceUrls ?? []) {
    if (
      (input.visualType === "HISTORY_DOCUMENTARY" || input.visualType === "TIMELINE")
      && !references.some((reference) => reference.url === url)
    ) {
      references.push({ label: `${input.research?.sourceLabel ?? "Research"} reference`, url });
    }
  }
  return references;
}

export function buildPremiumDynamicFinanceV1_1VisualPlan(input: {
  voices: LongformVoice[];
  entity: PremiumDynamicFinanceV1_1Entity;
  dataAsOf: string;
  market?: CoinOverviewMarketData;
  research?: CoinOverviewLongResearchData | null;
}): PremiumDynamicFinanceV1_1VisualPlan {
  const grouped = new Map<number, LongformVoice[]>();
  for (const voice of input.voices
    .filter((item) => !item.isFullVoice && item.text.trim())
    .filter((item) => item.startTime !== null && item.endTime !== null)
    .sort((left, right) => (left.startTime ?? 0) - (right.startTime ?? 0))) {
    const sceneVoices = grouped.get(voice.sceneId) ?? [];
    sceneVoices.push(voice);
    grouped.set(voice.sceneId, sceneVoices);
  }

  const scenes = [...grouped.entries()]
    .map(([sceneId, voices]) => ({
      sceneId,
      startMs: Math.min(...voices.map((voice) => Math.max(0, Math.round(voice.startTime ?? 0)))),
      endMs: Math.max(...voices.map((voice) => Math.round(voice.endTime ?? 0))),
      text: voices.map((voice) => voice.text.trim()).join(" ").trim(),
    }))
    .filter((scene) => scene.endMs > scene.startMs)
    .sort((left, right) => left.startMs - right.startMs);
  if (!scenes.length) {
    throw new Error("Premium Dynamic V1.1 visual director requires timed script scenes");
  }
  if (!input.entity.id.trim() || !input.entity.name.trim() || !input.entity.symbol.trim()) {
    throw new Error("Premium Dynamic V1.1 visual director requires a resolved coin entity");
  }
  if (!Number.isFinite(Date.parse(input.dataAsOf))) {
    throw new Error("Premium Dynamic V1.1 visual director requires a valid market-data timestamp");
  }

  const recentVisualTypes: PremiumDynamicFinanceV1_1VisualType[] = [];
  const recentAssets: string[] = [];
  const recentLayouts: PremiumDynamicFinanceV1_1Layout[] = [];
  const recentBackgrounds: string[] = [];
  const assetUseCounts = new Map<string, number>();
  const events = scenes.map((scene): PremiumDynamicFinanceV1_1VisualEvent => {
    const semanticTags = detectPremiumDynamicFinanceV1_1SemanticTags(scene.text, input.entity);
    const tagSet = new Set(semanticTags);
    const visualType = chooseVisualType(tagSet, scene.text);
    const blueprint = BLUEPRINTS[visualType];
    const historicalMove = historicalMoveForScene(visualType, tagSet, input.market);
    const assetPlans = buildAssetPlans({
      visualType,
      entity: input.entity,
      market: input.market,
      research: input.research,
      historicalMove,
    });
    const layout = defaultLayout(visualType);
    const assetKeys = assetPlans.map((asset) => asset.key);
    assetKeys.forEach((assetKey) => {
      assetUseCounts.set(assetKey, (assetUseCounts.get(assetKey) ?? 0) + 1);
    });
    recentVisualTypes.push(visualType);
    recentAssets.push(...assetKeys);
    recentLayouts.push(layout);
    recentBackgrounds.push(blueprint.backgroundKey);
    return {
      sceneId: scene.sceneId,
      startMs: scene.startMs,
      endMs: scene.endMs,
      text: scene.text,
      semanticMeaning: blueprint.meaning,
      visualType,
      semanticTags,
      compositionMode: blueprint.compositionMode,
      subjectOccupancyPercent: blueprint.subjectOccupancyPercent,
      cameraFraming: blueprint.cameraFraming,
      dominantVisual: blueprint.dominantVisual,
      backgroundKey: blueprint.backgroundKey,
      assetPlans,
      assetKeys,
      motionBeats: blueprint.choreography.map((action, index) => ({
        atMs: MOTION_TIMES_MS[index]!,
        action,
      })),
      transitionOut: blueprint.transitionOut,
      factualData: factualDataForScene({ visualType, market: input.market, historicalMove }),
      sourceReferences: sourceReferencesForScene({
        visualType,
        market: input.market,
        research: input.research,
      }),
      ...(integrityNoteForScene({
        visualType,
        market: input.market,
        research: input.research,
        historicalMove,
      }) ? {
        integrityNote: integrityNoteForScene({
          visualType,
          market: input.market,
          research: input.research,
          historicalMove,
        })!,
      } : {}),
      layout,
      decorative: [
        "NEWS_EDITORIAL",
        "HEADLINE",
        "COMMUNITY",
        "SOCIAL_PROOF",
        "BLOCKCHAIN_NETWORK",
        "CONCEPT_ILLUSTRATION",
        "MAP",
      ].includes(visualType),
      ...(visualType === "EXISTING_PREMIUM_DYNAMIC"
        ? { fallbackReason: "No supported semantic cue matched; preserve the existing Premium Dynamic scene without adding a data card." }
        : {}),
      diversityAdjusted: false,
    };
  });

  const counts = Object.fromEntries(
    PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES.map((visualType) => [
      visualType,
      events.filter((event) => event.visualType === visualType).length,
    ]),
  ) as Record<typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number], number>;
  return {
    version: PREMIUM_DYNAMIC_FINANCE_V1_1_VERSION,
    mode: "PLAN_ONLY",
    aspectRatio: "16:9",
    durationMs: Math.max(...events.map((event) => event.endMs)),
    entity: {
      id: input.entity.id,
      name: input.entity.name,
      symbol: input.entity.symbol,
    },
    dataAsOf: input.dataAsOf,
    dataSource: {
      label: input.market?.sourceLabel ?? "No market source supplied",
      url: input.market?.coin.sourceUrl ?? "",
    },
    ...(input.market ? {
      marketSnapshot: {
        currentPriceUsd: input.market.currentPriceUsd,
        periodStartPriceUsd: input.market.periodStartPriceUsd,
        changePercent7d: input.market.changePercent7d,
        lowPriceUsd7d: input.market.lowPriceUsd7d,
        highPriceUsd7d: input.market.highPriceUsd7d,
        marketCapUsd: input.market.marketCapUsd,
        activityValueUsd: input.market.activity.valueUsd,
        activityKind: input.market.activity.kind,
        benchmarks: input.market.benchmarks.map((benchmark) => ({
          name: benchmark.name,
          symbol: benchmark.symbol,
          changePercent7d: benchmark.changePercent7d,
        })),
      },
    } : {}),
    events,
    visualTypeCounts: counts,
    repeatedVisualTypes: events.slice(1).filter((event, index) =>
      event.visualType === events[index]!.visualType,
    ).length,
    repeatedAssets: [...assetUseCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([assetKey]) => assetKey),
    fallbackScenes: events.filter((event) => Boolean(event.fallbackReason)).length,
    diagnostics: {
      recentVisualTypes: recentVisualTypes.slice(-RECENT_WINDOW),
      recentAssets: recentAssets.slice(-RECENT_WINDOW),
      recentLayouts: recentLayouts.slice(-RECENT_WINDOW),
      recentBackgrounds: recentBackgrounds.slice(-RECENT_WINDOW),
      adjustedSceneIds: [],
    },
  };
}

const coinLogoCache = new Map<string, Promise<string | null>>();

export function resolvePremiumDynamicFinanceV1_1CachedLogo(
  coinId: string,
  loader: () => Promise<string | null>,
): Promise<string | null> {
  const key = coinId.trim().toLowerCase();
  if (!key) return Promise.reject(new Error("Coin logo cache requires a coin ID"));
  const cached = coinLogoCache.get(key);
  if (cached) return cached;
  const pending = loader().catch((error: unknown) => {
    coinLogoCache.delete(key);
    throw error;
  });
  coinLogoCache.set(key, pending);
  return pending;
}

export function clearPremiumDynamicFinanceV1_1LogoCacheForTests(): void {
  coinLogoCache.clear();
}