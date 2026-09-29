/**
 * Local demo seed for Майсторко.
 *
 * Creates demo auth users (via the service role key; LOCAL ONLY), craftsman
 * profiles, prices, calendars, work photos, clients, conversations and reviews.
 * Idempotent: demo users (…@maistorko.test) are deleted and recreated.
 *
 *   npm run seed
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Липсват NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env.local");
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(url) && process.env.SEED_ALLOW_REMOTE !== "1") {
  console.error(
    `Отказвам да пусна демо данни към ${url}. Скриптът е само за локален Supabase.\n` +
      "Ако наистина искате демо данни в хостнат проект, задайте SEED_ALLOW_REMOTE=1.",
  );
  process.exit(1);
}

const db: SupabaseClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const DEMO_PASSWORD = "demo12345";
const DOMAIN = "maistorko.test";

// ---------------------------------------------------------------------------
// Deterministic randomness so every seed run looks the same
// ---------------------------------------------------------------------------
let seed = 20260928;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

function sofiaToday(): Date {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
  return new Date(`${s}T00:00:00Z`);
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

// ---------------------------------------------------------------------------
// Schedules (weekday 1 = Monday)
// ---------------------------------------------------------------------------
type Block = [number, string, string];
const W = [1, 2, 3, 4, 5];
const schedules: Record<string, Block[]> = {
  weekdays: W.map((d) => [d, "08:00", "17:00"] as Block),
  sixDays: [...W, 6].map((d) => [d, "08:00", "18:00"] as Block),
  mornings: [...W, 6].map((d) => [d, "07:30", "12:30"] as Block),
  evenings: [
    ...W.map((d) => [d, "17:00", "20:30"] as Block),
    [6, "09:00", "17:00"],
    [7, "10:00", "15:00"],
  ],
  split: [
    ...W.flatMap((d) => [[d, "08:00", "12:00"] as Block, [d, "15:00", "19:00"] as Block]),
    [6, "09:00", "13:00"],
  ],
  flex: [2, 3, 4, 5, 6].map((d) => [d, "10:00", "19:00"] as Block),
  allWeek: [1, 2, 3, 4, 5, 6, 7].map((d) => [d, "08:00", "20:00"] as Block),
};

// ---------------------------------------------------------------------------
// Craftsmen
// ---------------------------------------------------------------------------
type Svc = [name: string, kind: "fixed" | "from" | "quote", price: number | null, unit: string, cat?: string];
type Craftsman = {
  key: string;
  name: string;
  business?: string;
  city: string;
  areas: string[];
  cats: string[];
  years: number;
  hourly?: number;
  callout?: number;
  travel?: number;
  materials?: boolean;
  quote?: boolean;
  shortNotice?: boolean;
  verified?: boolean;
  languages?: string[];
  contactHours?: string;
  bio: string;
  services: Svc[];
  schedule: keyof typeof schedules;
  staleDays?: number;
  photos: [file: string, caption: string][];
};

const craftsmen: Craftsman[] = [
  {
    key: "maistor",
    name: "Георги Петров",
    city: "sofia",
    areas: ["bankya", "kostinbrod", "bozhurishte"],
    cats: ["el-instalatsii", "kontakti-klyuchove", "osvetlenie", "el-tabla"],
    years: 14,
    hourly: 25,
    callout: 20,
    shortNotice: true,
    verified: true,
    languages: ["bg", "en"],
    contactHours: "Отговарям вечер след 18:00",
    bio: "Правоспособен електротехник с 14 години опит в жилищни и офис инсталации. Подменям табла, правя нови линии, монтирам осветление. Работя чисто и оставям схема на таблото.",
    services: [
      ["Смяна на контакт или ключ", "fixed", 15, "piece", "kontakti-klyuchove"],
      ["Монтаж на полилей / лампа", "fixed", 25, "piece", "osvetlenie"],
      ["Нова линия за контакт", "from", 60, "job", "el-instalatsii"],
      ["Подмяна на ел. табло", "from", 280, "job", "el-tabla"],
      ["Цялостна ел. инсталация на апартамент", "quote", null, "job", "el-instalatsii"],
    ],
    schedule: "sixDays",
    photos: [
      ["electrical-panel", "Ново табло с дефектнотокова защита, Люлин"],
      ["lighting", "Скрито LED осветление в хол"],
      ["electrical-panel", "Подредено табло след подмяна"],
    ],
  },
  {
    key: "ivan-dimitrov",
    name: "Иван Димитров",
    city: "sofia",
    areas: ["novi-iskar", "elin-pelin"],
    cats: ["vodoprovod", "sanitaria", "kanalizatsia", "techove"],
    years: 22,
    hourly: 28,
    callout: 25,
    verified: true,
    bio: "ВиК майстор от 22 години. Смесители, тоалетни, подмяна на тръби, отпушване. Идвам с резервни части в буса, така че повечето ремонти стават от първия път.",
    services: [
      ["Смяна на смесител", "fixed", 30, "piece", "sanitaria"],
      ["Отпушване на мивка / сифон", "fixed", 40, "job", "kanalizatsia"],
      ["Монтаж на тоалетна", "from", 70, "job", "sanitaria"],
      ["Подмяна на водопровод в баня", "from", 350, "job", "vodoprovod"],
    ],
    schedule: "weekdays",
    photos: [
      ["pipes", "Подмяна на водопровод с PPR тръби"],
      ["bathroom", "Монтаж на окачена тоалетна"],
    ],
  },
  {
    key: "stoyanov",
    name: "Николай Стоянов",
    business: "Стоянов Ремонти ЕООД",
    city: "sofia",
    areas: ["pernik", "bankya"],
    cats: ["boyadisvane", "shpaklovka", "gipsokarton"],
    years: 11,
    materials: false,
    verified: true,
    bio: "Екип от трима души. Шпакловка, боядисване и гипсокартон с машинно шлайфане без прах. Даваме срок и го спазваме.",
    services: [
      ["Боядисване с латекс (2 ръце)", "from", 4, "m2", "boyadisvane"],
      ["Шпакловка на стени", "from", 8, "m2", "shpaklovka"],
      ["Окачен таван от гипсокартон", "from", 28, "m2", "gipsokarton"],
      ["Боядисване на стая до 15 м²", "from", 180, "job", "boyadisvane"],
    ],
    schedule: "sixDays",
    photos: [
      ["painted-wall", "Двуцветна стена в детска стая"],
      ["drywall", "Окачен таван със скрито осветление"],
      ["painted-wall", "Хол след шпакловка и латекс"],
    ],
  },
  {
    key: "hristo-ivanov",
    name: "Христо Иванов",
    city: "sofia",
    areas: ["pernik", "samokov"],
    cats: ["plochki-banya", "plochki-kuhnya", "fugi"],
    years: 17,
    bio: "Плочкаджия. Бани под ключ, гранитогрес голям формат, гръб на кухня. Прецизни фуги и нивелация със система.",
    services: [
      ["Лепене на фаянс", "from", 22, "m2", "plochki-banya"],
      ["Гранитогрес 60×120", "from", 30, "m2", "plochki-banya"],
      ["Гръб на кухня", "from", 150, "job", "plochki-kuhnya"],
      ["Баня под ключ", "quote", null, "job", "plochki-banya"],
    ],
    quote: true,
    schedule: "weekdays",
    photos: [
      ["tiles", "Баня с гранитогрес 60×120"],
      ["tiles", "Гръб на кухня, метро плочки"],
    ],
  },
  {
    key: "dimitar-kolev",
    name: "Димитър Колев",
    city: "sofia",
    areas: ["elin-pelin", "kostinbrod"],
    cats: ["parket", "tsiklene", "laminat"],
    years: 25,
    verified: true,
    bio: "Циклене и лакиране на паркет с прахоуловител. Редене на паркет, ламинат и дюшеме. Съвет за лак според помещението.",
    services: [
      ["Циклене и лакиране (3 ръце)", "from", 14, "m2", "tsiklene"],
      ["Редене на ламинат", "from", 7, "m2", "laminat"],
      ["Редене на паркет", "from", 16, "m2", "parket"],
    ],
    schedule: "weekdays",
    staleDays: 22,
    photos: [["parquet", "Циклен дъбов паркет, мат лак"]],
  },
  {
    key: "stefan-angelov",
    name: "Стефан Ангелов",
    city: "sofia",
    areas: ["elin-pelin", "novi-iskar", "bozhurishte"],
    cats: ["montazh-klimatitsi", "profilaktika-klimatitsi"],
    years: 9,
    hourly: 30,
    travel: 10,
    shortNotice: true,
    bio: "Хладилен техник. Монтаж на климатици до 3 часа, профилактика с дезинфекция, зареждане с фреон. Работя с всички марки.",
    services: [
      ["Стандартен монтаж на климатик до 14 000 BTU", "fixed", 150, "job", "montazh-klimatitsi"],
      ["Профилактика на климатик", "fixed", 45, "piece", "profilaktika-klimatitsi"],
      ["Демонтаж на климатик", "fixed", 50, "job", "montazh-klimatitsi"],
    ],
    schedule: "allWeek",
    photos: [
      ["ac-unit", "Монтаж на инверторен климатик"],
      ["ac-unit", "Външно тяло на стойка"],
    ],
  },
  {
    key: "petar-marinov",
    name: "Петър Маринов",
    city: "sofia",
    areas: ["bankya", "novi-iskar", "kostinbrod"],
    cats: ["drebni-remonti", "montazh-okachvane", "sglobyavane-mebeli"],
    years: 8,
    hourly: 20,
    callout: 15,
    shortNotice: true,
    bio: "Майстор за всичко: окачвам телевизори, корнизи и полици, сглобявам мебели, сменям дръжки и панти. Удобен за малки задачи, които никой не иска да поеме.",
    services: [
      ["Окачване на телевизор на стена", "fixed", 40, "job", "montazh-okachvane"],
      ["Монтаж на корниз", "fixed", 20, "piece", "montazh-okachvane"],
      ["Сглобяване на гардероб", "from", 50, "job", "sglobyavane-mebeli"],
    ],
    schedule: "evenings",
    photos: [["shelves", "Окачени полици в кабинет"]],
  },
  {
    key: "vasil-todorov",
    name: "Васил Тодоров",
    city: "sofia",
    areas: ["bankya", "pernik", "novi-iskar"],
    cats: ["avariyno-otklyuchvane", "smyana-patroni", "blindirani-vrati"],
    years: 12,
    callout: 30,
    shortNotice: true,
    verified: true,
    bio: "Ключар, денонощно при аварии. Отключване без повреда на вратата, смяна на патрони и брави на място.",
    services: [
      ["Аварийно отключване", "from", 50, "job", "avariyno-otklyuchvane"],
      ["Смяна на патрон", "from", 35, "piece", "smyana-patroni"],
    ],
    schedule: "allWeek",
    photos: [["door-lock", "Смяна на патрон на блиндирана врата"]],
  },
  {
    key: "martin-kirilov",
    name: "Мартин Кирилов",
    business: "Кирилов Смарт Системи",
    city: "sofia",
    areas: ["bankya", "bozhurishte", "elin-pelin"],
    cats: ["videonablyudenie", "mrezhi-wifi", "umen-dom", "alarmi-domofoni"],
    years: 6,
    hourly: 35,
    languages: ["bg", "en"],
    bio: "Wi-Fi покритие за къщи и офиси, камери с достъп от телефона, видеодомофони. Настройвам всичко и обяснявам как се ползва.",
    services: [
      ["Монтаж на IP камера", "from", 60, "piece", "videonablyudenie"],
      ["Mesh Wi-Fi за къща", "from", 90, "job", "mrezhi-wifi"],
      ["Видеодомофон", "from", 120, "job", "alarmi-domofoni"],
    ],
    schedule: "flex",
    photos: [
      ["cctv", "Камера над входна врата"],
      ["network", "Подреден комуникационен шкаф"],
    ],
  },
  {
    key: "rositsa-nikolova",
    name: "Росица Николова",
    city: "sofia",
    areas: ["bankya", "novi-iskar"],
    cats: ["pochistvane-dom", "sled-remont", "prane-mebel"],
    years: 7,
    hourly: 12,
    materials: true,
    bio: "Почистване на апартаменти и къщи, основно почистване след ремонт, пране на дивани и килими. Нося собствени препарати и машини.",
    services: [
      ["Основно почистване на апартамент", "from", 2, "m2", "pochistvane-dom"],
      ["Почистване след ремонт", "from", 3, "m2", "sled-remont"],
      ["Пране на тройка диван", "fixed", 70, "job", "prane-mebel"],
    ],
    schedule: "mornings",
    photos: [["cleaning", "Кухня след основно почистване"]],
  },
  {
    key: "atanas-georgiev",
    name: "Атанас Георгиев",
    city: "plovdiv",
    areas: ["asenovgrad", "kuklen", "rakovski"],
    cats: ["el-instalatsii", "kontakti-klyuchove", "avariyni-el-remonti"],
    years: 19,
    hourly: 22,
    callout: 15,
    verified: true,
    shortNotice: true,
    bio: "Електротехник в Пловдив и Асеновград. Аварии, нови инсталации, заземяване. Идвам в същия ден при спрял ток.",
    services: [
      ["Аварийно посещение", "fixed", 35, "job", "avariyni-el-remonti"],
      ["Смяна на контакт", "fixed", 12, "piece", "kontakti-klyuchove"],
      ["Ел. инсталация на къща", "quote", null, "job", "el-instalatsii"],
    ],
    schedule: "sixDays",
    photos: [["electrical-panel", "Табло в еднофамилна къща"]],
  },
  {
    key: "krasimir-valchev",
    name: "Красимир Вълчев",
    city: "plovdiv",
    areas: ["stamboliyski", "kuklen"],
    cats: ["boyleri", "sanitaria", "vodoprovod"],
    years: 15,
    hourly: 24,
    bio: "Бойлери (монтаж, почистване от котлен камък, смяна на нагревател), смесители и тръби. Пловдив и околните села.",
    services: [
      ["Почистване на бойлер", "fixed", 45, "job", "boyleri"],
      ["Монтаж на бойлер", "fixed", 60, "job", "boyleri"],
      ["Смяна на смесител", "fixed", 25, "piece", "sanitaria"],
    ],
    schedule: "weekdays",
    photos: [["boiler", "Нов бойлер с предпазен клапан"]],
  },
  {
    key: "lyubomir-hristov",
    name: "Любомир Христов",
    city: "plovdiv",
    areas: ["asenovgrad", "parvomay", "karlovo"],
    cats: ["pvc-dograma", "remont-dograma", "shtori-komarnitsi"],
    years: 10,
    bio: "Регулиране и ремонт на PVC и алуминиева дограма, подмяна на уплътнения и дръжки, комарници по размер.",
    services: [
      ["Регулиране на прозорец", "fixed", 15, "piece", "remont-dograma"],
      ["Подмяна на уплътнение", "from", 6, "meter", "remont-dograma"],
      ["Комарник по размер", "from", 35, "piece", "shtori-komarnitsi"],
    ],
    schedule: "split",
    photos: [["window", "Регулирана балконска врата"]],
  },
  {
    key: "todor-panayotov",
    name: "Тодор Панайотов",
    city: "plovdiv",
    areas: ["karlovo", "asenovgrad", "rakovski", "parvomay"],
    cats: ["remont-pokrivi", "hidroizolatsia", "ulutsi"],
    years: 20,
    quote: true,
    verified: true,
    bio: "Ремонт на покриви, пренареждане на керемиди, хидроизолация на тераси и плоски покриви, улуци. Оглед и оферта безплатно.",
    services: [
      ["Пренареждане на керемиди", "from", 18, "m2", "remont-pokrivi"],
      ["Хидроизолация с мембрана", "from", 22, "m2", "hidroizolatsia"],
      ["Нови улуци", "from", 25, "meter", "ulutsi"],
    ],
    schedule: "sixDays",
    staleDays: 30,
    photos: [
      ["roof", "Нов покрив с керемиди"],
      ["roof", "Улуци и водосточни тръби"],
    ],
  },
  {
    key: "metodi-yankov",
    name: "Методи Янков",
    business: "Хамали Янков",
    city: "plovdiv",
    areas: ["asenovgrad", "stamboliyski", "rakovski", "kuklen"],
    cats: ["premestvane", "izvozvane", "transport-bus"],
    years: 5,
    hourly: 30,
    shortNotice: true,
    bio: "Двама хамали и бус 3,5 т. Преместване на апартаменти, извозване на стари мебели и строителни отпадъци.",
    services: [
      ["Хамал + бус (час)", "fixed", 30, "hour", "premestvane"],
      ["Извозване на строителни отпадъци", "from", 60, "job", "izvozvane"],
    ],
    schedule: "allWeek",
    photos: [["moving", "Преместване на едностаен апартамент"]],
  },
  {
    key: "kaloyan-stefanov",
    name: "Калоян Стефанов",
    city: "varna",
    areas: ["aksakovo", "devnya", "beloslav"],
    cats: ["montazh-klimatitsi", "profilaktika-klimatitsi", "termopompi"],
    years: 12,
    hourly: 28,
    verified: true,
    bio: "Климатици и термопомпи във Варна. Профилактика преди сезона, монтаж с вакуумиране и проверка на налягането.",
    services: [
      ["Монтаж на климатик", "fixed", 140, "job", "montazh-klimatitsi"],
      ["Профилактика", "fixed", 40, "piece", "profilaktika-klimatitsi"],
      ["Термопомпа въздух-вода", "quote", null, "job", "termopompi"],
    ],
    schedule: "sixDays",
    photos: [["ac-unit", "Мулти-сплит система"]],
  },
  {
    key: "dragomir-rusev",
    name: "Драгомир Русев",
    city: "varna",
    areas: ["aksakovo", "byala-varna"],
    cats: ["plochki-banya", "plochki-terasa", "sanitaria"],
    years: 16,
    bio: "Бани от къртене до последния смесител. Плочки на тераси и стълбища с дренажни профили.",
    services: [
      ["Лепене на плочки", "from", 20, "m2", "plochki-banya"],
      ["Тераса с хидроизолация и плочки", "from", 45, "m2", "plochki-terasa"],
      ["Баня под ключ", "quote", null, "job", "plochki-banya"],
    ],
    quote: true,
    schedule: "weekdays",
    photos: [
      ["tiles", "Баня с тъмни плочки и ниша"],
      ["bathroom", "Душ с ниша и стъклен параван"],
    ],
  },
  {
    key: "emil-kostadinov",
    name: "Емил Костадинов",
    city: "varna",
    areas: ["devnya", "aksakovo", "provadiya"],
    cats: ["sglobyavane-mebeli", "kuhni", "mebeli-po-porachka"],
    years: 13,
    hourly: 22,
    bio: "Сглобяване на мебели от всички вериги, кухни по размер, вградени гардероби. Монтирам и уредите в кухнята.",
    services: [
      ["Сглобяване на легло", "from", 35, "job", "sglobyavane-mebeli"],
      ["Монтаж на кухня", "from", 25, "meter", "kuhni"],
      ["Вграден гардероб по поръчка", "quote", null, "job", "mebeli-po-porachka"],
    ],
    schedule: "flex",
    photos: [
      ["kitchen", "Кухня с плот от компакт ламинат"],
      ["shelves", "Вграден гардероб в коридор"],
    ],
  },
  {
    key: "yanko-iliev",
    name: "Янко Илиев",
    city: "varna",
    areas: ["balchik", "aksakovo", "byala-varna"],
    cats: ["kosene", "rezitba", "polivni-sistemi"],
    years: 9,
    hourly: 15,
    shortNotice: true,
    bio: "Поддръжка на дворове и вили: косене, резитба, капково напояване. Абонаментна поддръжка през сезона.",
    services: [
      ["Косене на трева", "from", 0.3, "m2", "kosene"],
      ["Резитба на овощно дърво", "fixed", 20, "piece", "rezitba"],
      ["Капково напояване", "from", 150, "job", "polivni-sistemi"],
    ],
    schedule: "mornings",
    photos: [["garden", "Окосен двор с нови бордюри"]],
  },
  {
    key: "borislav-mitev",
    name: "Борислав Митев",
    city: "burgas",
    areas: ["aytos", "kameno", "pomorie"],
    cats: ["ogradi-parapeti", "reshetki-porti", "metalni-konstruktsii"],
    years: 18,
    verified: true,
    bio: "Заварчик. Огради, плъзгащи порти, парапети и навеси. Изработка в цеха и монтаж на място.",
    services: [
      ["Метална ограда", "from", 45, "meter", "ogradi-parapeti"],
      ["Парапет за стълбище", "from", 90, "meter", "ogradi-parapeti"],
      ["Навес за кола", "quote", null, "job", "metalni-konstruktsii"],
    ],
    quote: true,
    schedule: "weekdays",
    photos: [
      ["fence", "Плъзгаща порта с автоматика"],
      ["fence", "Парапет с дървен ръкохват"],
    ],
  },
  {
    key: "plamen-zhelev",
    name: "Пламен Желев",
    city: "burgas",
    areas: ["nesebar", "pomorie", "sozopol"],
    cats: ["boyadisvane", "shpaklovka", "dekorativni-mazilki"],
    years: 12,
    bio: "Бояджия с опит в хотели по крайбрежието. Боядисване, шпакловка, декоративни мазилки. Свободен и през зимата.",
    services: [
      ["Боядисване (2 ръце)", "from", 3.5, "m2", "boyadisvane"],
      ["Шпакловка", "from", 7, "m2", "shpaklovka"],
      ["Венецианска мазилка", "from", 35, "m2", "dekorativni-mazilki"],
    ],
    schedule: "sixDays",
    photos: [["painted-wall", "Декоративна мазилка в лоби"]],
  },
  {
    key: "svetoslav-krastev",
    name: "Светослав Кръстев",
    city: "burgas",
    areas: ["pomorie", "kameno", "aytos"],
    cats: ["peralni", "hladilnitsi", "sadomiyalni", "pechki-furni"],
    years: 21,
    callout: 20,
    shortNotice: true,
    bio: "Сервиз на перални, хладилници, съдомиялни и фурни на адрес. Диагностиката се приспада от ремонта.",
    services: [
      ["Диагностика на адрес", "fixed", 20, "job", "peralni"],
      ["Смяна на помпа на пералня", "from", 60, "job", "peralni"],
      ["Зареждане на хладилник с фреон", "from", 80, "job", "hladilnitsi"],
    ],
    schedule: "sixDays",
    photos: [["appliance", "Смяна на лагери на пералня"]],
  },
  {
    key: "aleksandar-dobrev",
    name: "Александър Добрев",
    city: "burgas",
    areas: ["sozopol", "primorsko", "nesebar"],
    cats: ["zidaria", "betonovi-raboti", "kartene"],
    years: 24,
    quote: true,
    bio: "Груб строеж и ремонти: зидария, замазки, къртене. Бригада от 4 души. Оглед и оферта в рамките на седмицата.",
    services: [
      ["Зидария с тухли", "from", 25, "m2", "zidaria"],
      ["Циментова замазка", "from", 12, "m2", "betonovi-raboti"],
      ["Къртене на плочки", "from", 6, "m2", "kartene"],
    ],
    schedule: "weekdays",
    staleDays: 60,
    photos: [["masonry", "Зидане на преградна стена"]],
  },
  {
    key: "viktor-nenov",
    name: "Виктор Ненов",
    city: "ruse",
    areas: ["byala-ruse", "marten", "dve-mogili"],
    cats: ["mobilen-avtoservis", "gumi-na-adres", "akumulatori"],
    years: 11,
    hourly: 25,
    shortNotice: true,
    bio: "Мобилен сервиз в Русе: гуми на адрес, акумулатори, смяна на масла и накладки пред дома ви.",
    services: [
      ["Смяна на 4 гуми на адрес", "fixed", 50, "job", "gumi-na-adres"],
      ["Смяна на акумулатор", "fixed", 20, "job", "akumulatori"],
      ["Смяна на масло и филтри", "from", 30, "job", "mobilen-avtoservis"],
    ],
    schedule: "evenings",
    photos: [["car", "Смяна на гуми пред блок"]],
  },
  {
    key: "ognyan-radev",
    name: "Огнян Радев",
    city: "ruse",
    areas: ["byala-ruse", "vetovo", "slivo-pole", "marten"],
    cats: ["drebni-remonti", "montazh-okachvane", "sanitaria", "kontakti-klyuchove"],
    years: 30,
    hourly: 18,
    callout: 10,
    verified: true,
    bio: "Трийсет години дребни ремонти в Русе. Капещо кранче, разхлабен контакт, скърцаща врата: всичко в едно посещение.",
    services: [
      ["Смяна на смесител", "fixed", 25, "piece", "sanitaria"],
      ["Смяна на контакт", "fixed", 12, "piece", "kontakti-klyuchove"],
      ["Час майсторска работа", "fixed", 18, "hour", "drebni-remonti"],
    ],
    schedule: "split",
    photos: [["shelves", "Монтирани етажерки в мазе"]],
  },
];

const clients = [
  { key: "klient", name: "Мария Иванова", city: "sofia", phone: "0888 123 456" },
  { key: "elena", name: "Елена Стоянова", city: "plovdiv" },
  { key: "boyan", name: "Боян Николов", city: "varna" },
  { key: "teodora", name: "Теодора Маркова", city: "burgas" },
  { key: "kiril", name: "Кирил Павлов", city: "sofia" },
  { key: "nadya", name: "Надя Георгиева", city: "ruse" },
];

const reviewTexts: Record<number, string[]> = {
  5: [
    "Дойде точно когато се разбрахме, свърши работата за час и почисти след себе си.",
    "Много коректен. Цената беше каквато беше написал в профила си.",
    "Обясни какво е проблемът и какви са вариантите. Препоръчвам.",
    "Бързо, чисто и без изненади в сметката.",
    "Втори път го викам, пак без забележки.",
  ],
  4: [
    "Добра работа, закъсня малко, но предупреди предварително.",
    "Свърши всичко, цената беше малко над очакваното заради материалите.",
    "Качествено, но се наложи второ посещение за довършване.",
  ],
  3: ["Работата е наред, но комуникацията можеше да е по-бърза."],
};

const openers = [
  "Здравейте! Имам нужда от помощ. Удобно ли ви е да дойдете?",
  "Добър вечер, видях профила ви. Кога бихте могли да минете за оглед?",
  "Здравейте, свободен ли сте на тази дата? Работата е в апартамент, 4-ти етаж с асансьор.",
];
const replies = [
  "Здравейте! Да, мога. Ще дойда между 9 и 10 ч., ако ви е удобно.",
  "Добър вечер. Мога да мина утре след обяд за оглед, ще ви кажа точна цена на място.",
  "Здравейте, свободен съм. Изпратете ми снимка, за да взема нужните части.",
];
const followups = [
  "Чудесно, до скоро!",
  "Изпращам снимка след малко. Благодаря!",
  "Става, ще ви чакам. Благодаря за бързия отговор.",
];

/** How each demo craftsman handles the first visit (оглед). */
function inspectionFor(c: Craftsman, i: number) {
  if (c.key === "maistor") {
    return {
      inspection_policy: "deducted",
      inspection_fee: 20,
      terms_note:
        "Малки ремонти (контакт, лампа, ключ) правя направо, без оглед. За ново табло или цяла инсталация първо идвам на оглед и давам писмена оферта. Огледът се приспада, ако работата ми се възложи.",
    };
  }
  if (c.quote) return { inspection_policy: "deducted", inspection_fee: 20, terms_note: null };
  const kinds = ["free", "none", "paid"] as const;
  const policy = kinds[i % 3];
  return { inspection_policy: policy, inspection_fee: policy === "paid" ? 15 : null, terms_note: null };
}

// ---------------------------------------------------------------------------
async function must<T>(p: PromiseLike<{ data: T; error: unknown }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) {
    console.error(`✗ ${what}:`, error);
    process.exit(1);
  }
  return data;
}

async function deleteDemoUsers() {
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const demo = data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`));
    for (const u of demo) await db.auth.admin.deleteUser(u.id);
    if (data.users.length < 200) break;
    page++;
  }
}

async function createUser(email: string, meta: Record<string, string>) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error || !data.user) {
    console.error(`✗ createUser ${email}:`, error);
    process.exit(1);
  }
  return data.user.id;
}

async function main() {
  console.log("→ Изтривам стари демо потребители…");
  await deleteDemoUsers();

  const cities = (await must(db.from("cities").select("id, slug"), "cities")) ?? [];
  const cityId = (slug: string) => {
    const c = cities.find((x) => x.slug === slug);
    if (!c) throw new Error(`Няма град ${slug}`);
    return c.id as number;
  };
  const cats = (await must(db.from("categories").select("id, slug, parent_id"), "categories")) ?? [];
  const catId = (slug: string) => {
    const c = cats.find((x) => x.slug === slug);
    if (!c) throw new Error(`Няма категория ${slug}`);
    return c.id as number;
  };

  const today = sofiaToday();

  // Admin
  console.log("→ Администратор…");
  const adminId = await createUser(`admin@${DOMAIN}`, { full_name: "Админ Майсторко", role: "client", city: "sofia" });
  await must(db.from("profiles").update({ role: "admin" }).eq("id", adminId), "admin role");

  // Clients
  console.log("→ Клиенти…");
  const clientIds: Record<string, string> = {};
  for (const c of clients) {
    const id = await createUser(`${c.key}@${DOMAIN}`, { full_name: c.name, role: "client", city: c.city });
    clientIds[c.key] = id;
    if (c.phone) await must(db.from("profiles").update({ phone: c.phone }).eq("id", id), "client phone");
  }

  // Craftsmen
  console.log(`→ ${craftsmen.length} майстори…`);
  const craftsmanIds: Record<string, string> = {};
  for (const [i, c] of craftsmen.entries()) {
    const email = `${c.key}@${DOMAIN}`;
    const id = await createUser(email, { full_name: c.name, role: "craftsman", city: c.city });
    craftsmanIds[c.key] = id;
    // Demo numbers only (0899 000 1xx), never real ones
    await must(db.from("profiles").update({ phone: `0899 000 ${String(100 + i)}` }).eq("id", id), "craftsman phone");

    await must(
      db
        .from("craftsman_profiles")
        .update({
          business_name: c.business ?? null,
          bio: c.bio,
          years_experience: c.years,
          languages: c.languages ?? ["bg"],
          hourly_rate: c.hourly ?? null,
          callout_fee: c.callout ?? null,
          travel_fee: c.travel ?? null,
          materials_included: c.materials ?? false,
          quote_on_inspection: c.quote ?? false,
          short_notice: c.shortNotice ?? false,
          phone_visibility: (["login", "public", "login", "chat"] as const)[i % 4],
          contact_hours: c.contactHours ?? pick(["Отговарям вечер", "Отговарям до 1 час", "Най-лесно вечер след 19 ч.", null]),
          is_verified: c.verified ?? false,
          ...inspectionFor(c, i),
        })
        .eq("id", id),
      `craftsman ${c.key}`,
    );

    await must(
      db.from("craftsman_service_areas").insert(c.areas.map((a) => ({ craftsman_id: id, city_id: cityId(a) }))),
      "areas",
    );
    await must(
      db.from("craftsman_categories").insert(c.cats.map((s) => ({ craftsman_id: id, category_id: catId(s) }))),
      "categories",
    );
    await must(
      db.from("services").insert(
        c.services.map(([name, kind, price, unit, cat], sort) => ({
          craftsman_id: id,
          name,
          price_kind: kind,
          price: kind === "quote" ? null : price,
          unit,
          category_id: cat ? catId(cat) : null,
          sort,
        })),
      ),
      "services",
    );
    await must(
      db.from("availability_rules").insert(
        schedules[c.schedule].map(([weekday, start_time, end_time]) => ({
          craftsman_id: id,
          weekday,
          start_time,
          end_time,
        })),
      ),
      "rules",
    );

    // Exceptions: a few busy days/half-days, one vacation for some, an extra free Sunday for others
    const exceptions: Record<string, unknown>[] = [];
    const busyDays = 2 + Math.floor(rand() * 4);
    for (let k = 0; k < busyDays; k++) {
      const d = isoDate(addDays(today, 1 + Math.floor(rand() * 13)));
      const half = rand() < 0.4;
      exceptions.push({
        craftsman_id: id,
        kind: "busy",
        start_date: d,
        end_date: d,
        start_time: half ? "08:00" : null,
        end_time: half ? "13:00" : null,
        note: half ? "Обект сутринта" : "Зает на обект",
      });
    }
    if (i % 6 === 3) {
      const start = addDays(today, 16 + (i % 5));
      exceptions.push({
        craftsman_id: id,
        kind: "busy",
        start_date: isoDate(start),
        end_date: isoDate(addDays(start, 6)),
        note: "Отпуск",
      });
    }
    if (i % 5 === 1) {
      const nextSunday = addDays(today, ((7 - today.getUTCDay()) % 7) || 7);
      exceptions.push({
        craftsman_id: id,
        kind: "free",
        start_date: isoDate(nextSunday),
        end_date: isoDate(nextSunday),
        start_time: "10:00",
        end_time: "16:00",
        note: "Свободен в неделя",
      });
    }
    await must(db.from("availability_exceptions").insert(exceptions), "exceptions");

    await must(
      db.from("work_photos").insert(
        c.photos.map(([file, caption], sort) => ({
          craftsman_id: id,
          path: `/demo/work/${file}.svg`,
          caption,
          sort,
        })),
      ),
      "photos",
    );

    // Calendar freshness last, since calendar edits touch last_confirmed_at
    const confirmedHoursAgo = c.staleDays ? c.staleDays * 24 : Math.floor(rand() * 96) + 2;
    await must(
      db
        .from("craftsman_profiles")
        .update({
          last_confirmed_at: hoursAgo(confirmedHoursAgo),
          created_at: hoursAgo((craftsmen.length - i) * 60 + Math.floor(rand() * 40)),
        })
        .eq("id", id),
      "freshness",
    );
    process.stdout.write(".");
  }
  console.log("");

  // Conversations, messages, reviews
  console.log("→ Разговори и отзиви…");
  const clientKeys = Object.keys(clientIds);
  const ratingPattern = [5, 5, 4, 5, 5, 4, 5, 3, 5, 4, 5, 5];
  let reviewCount = 0;
  let convCount = 0;

  for (const [i, c] of craftsmen.entries()) {
    const craftsmanId = craftsmanIds[c.key];
    // 0–3 clients talked to each craftsman
    const n = i === 0 ? 3 : Math.floor(rand() * 4);
    const talked = new Set<string>();
    while (talked.size < n) talked.add(pick(clientKeys));

    for (const ck of talked) {
      const clientId = clientIds[ck];
      const startedHoursAgo = 24 * (2 + Math.floor(rand() * 40));
      const requested = isoDate(addDays(today, 1 + Math.floor(rand() * 10)));
      const conv = await must(
        db
          .from("conversations")
          .insert({
            client_id: clientId,
            craftsman_id: craftsmanId,
            requested_date: requested,
            category_id: catId(c.cats[0]),
          })
          .select("id")
          .single(),
        "conversation",
      );
      convCount++;
      const convId = (conv as { id: string }).id;
      const thread = [
        { sender_id: clientId, body: pick(openers), meta: { date: requested }, at: startedHoursAgo },
        { sender_id: craftsmanId, body: pick(replies), meta: {}, at: startedHoursAgo - 2 },
        { sender_id: clientId, body: pick(followups), meta: {}, at: startedHoursAgo - 3 },
      ];
      for (const m of thread) {
        await must(
          db.from("messages").insert({
            conversation_id: convId,
            sender_id: m.sender_id,
            body: m.body,
            meta: m.meta,
            created_at: hoursAgo(m.at),
          }),
          "message",
        );
      }
      await must(
        db
          .from("conversations")
          .update({ client_last_read_at: new Date().toISOString(), craftsman_last_read_at: new Date().toISOString() })
          .eq("id", convId),
        "read markers",
      );

      // Most conversations end with a review
      if (rand() < 0.8) {
        const rating = ratingPattern[reviewCount % ratingPattern.length];
        await must(
          db.from("reviews").insert({
            craftsman_id: craftsmanId,
            client_id: clientId,
            rating,
            body: pick(reviewTexts[rating]),
            created_at: hoursAgo(startedHoursAgo - 48),
          }),
          "review",
        );
        reviewCount++;
      }
    }
  }

  // A fresh, unread thread for the demo craftsman and demo client
  const fresh = await must(
    db
      .from("conversations")
      .upsert(
        {
          client_id: clientIds.klient,
          craftsman_id: craftsmanIds.maistor,
          requested_date: isoDate(addDays(today, 2)),
          category_id: catId("osvetlenie"),
        },
        { onConflict: "client_id,craftsman_id" },
      )
      .select("id")
      .single(),
    "demo conversation",
  );
  await must(
    db.from("messages").insert({
      conversation_id: (fresh as { id: string }).id,
      sender_id: clientIds.klient,
      body: "Здравейте! Трябва да се монтират 3 лампи в хола и една в коридора. Може ли в четвъртък следобед?",
      meta: { date: isoDate(addDays(today, 2)), category: "Осветление" },
      created_at: hoursAgo(1),
    }),
    "demo message",
  );
  await must(
    db
      .from("conversations")
      .update({ craftsman_last_read_at: hoursAgo(5) })
      .eq("id", (fresh as { id: string }).id),
    "unread marker",
  );

  // A confirmed inspection in the demo conversation, saved by the craftsman
  const inspectionDay = isoDate(addDays(today, 2));
  const booking = await must(
    db
      .from("bookings")
      .insert({
        conversation_id: (fresh as { id: string }).id,
        craftsman_id: craftsmanIds.maistor,
        client_id: clientIds.klient,
        booking_date: inspectionDay,
        start_time: "17:30",
        end_time: "18:30",
        kind: "inspection",
        status: "confirmed",
        note: "Оглед на осветлението в хола",
        proposed_by: craftsmanIds.maistor,
        responded_by: craftsmanIds.maistor,
      })
      .select("id")
      .single(),
    "demo booking",
  );
  await must(
    db.from("messages").insert({
      conversation_id: (fresh as { id: string }).id,
      sender_id: craftsmanIds.maistor,
      body: `Запазих оглед на ${inspectionDay.slice(8, 10)}.${inspectionDay.slice(5, 7)}, 17:30–18:30`,
      meta: { booking_id: (booking as { id: string }).id, event: "confirmed" },
      created_at: hoursAgo(0.5),
    }),
    "booking message",
  );

  // Saved craftsmen for the demo client
  await must(
    db.from("saved_craftsmen").insert(
      ["maistor", "ivan-dimitrov", "stefan-angelov"].map((k) => ({
        client_id: clientIds.klient,
        craftsman_id: craftsmanIds[k],
      })),
    ),
    "saved",
  );

  console.log(`✓ Готово: ${craftsmen.length} майстори, ${clients.length} клиенти, 1 админ, ${convCount + 1} разговора, ${reviewCount} отзива.`);
  console.log(`  Вход: klient@${DOMAIN} / maistor@${DOMAIN} / admin@${DOMAIN}, парола ${DEMO_PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
