/** Prototype data: the real cities and categories from supabase/migrations/20260928000004_reference_data.sql. */

export type City = { slug: string; name: string; around: string };

/** The five launch cities; every other place in the seed belongs to the surroundings of one of them. */
export const AREAS: { key: string; label: string }[] = [
  { key: "sofia", label: "София и околността" },
  { key: "plovdiv", label: "Пловдив и околността" },
  { key: "varna", label: "Варна и околността" },
  { key: "burgas", label: "Бургас и околността" },
  { key: "ruse", label: "Русе и околността" },
];

const c = (around: string, slug: string, name: string): City => ({ slug, name, around });

export const CITIES: City[] = [
  c("sofia", "sofia", "София"),
  c("sofia", "bankya", "Банкя"),
  c("sofia", "novi-iskar", "Нови Искър"),
  c("sofia", "bozhurishte", "Божурище"),
  c("sofia", "kostinbrod", "Костинброд"),
  c("sofia", "elin-pelin", "Елин Пелин"),
  c("sofia", "samokov", "Самоков"),
  c("sofia", "pernik", "Перник"),
  c("plovdiv", "plovdiv", "Пловдив"),
  c("plovdiv", "asenovgrad", "Асеновград"),
  c("plovdiv", "stamboliyski", "Стамболийски"),
  c("plovdiv", "rakovski", "Раковски"),
  c("plovdiv", "kuklen", "Куклен"),
  c("plovdiv", "karlovo", "Карлово"),
  c("plovdiv", "parvomay", "Първомай"),
  c("varna", "varna", "Варна"),
  c("varna", "devnya", "Девня"),
  c("varna", "aksakovo", "Аксаково"),
  c("varna", "beloslav", "Белослав"),
  c("varna", "provadiya", "Провадия"),
  c("varna", "byala-varna", "Бяла (Варна)"),
  c("varna", "balchik", "Балчик"),
  c("burgas", "burgas", "Бургас"),
  c("burgas", "nesebar", "Несебър"),
  c("burgas", "pomorie", "Поморие"),
  c("burgas", "sozopol", "Созопол"),
  c("burgas", "aytos", "Айтос"),
  c("burgas", "kameno", "Камено"),
  c("burgas", "primorsko", "Приморско"),
  c("ruse", "ruse", "Русе"),
  c("ruse", "byala-ruse", "Бяла (Русе)"),
  c("ruse", "marten", "Мартен"),
  c("ruse", "dve-mogili", "Две могили"),
  c("ruse", "vetovo", "Ветово"),
  c("ruse", "slivo-pole", "Сливо поле"),
];

export const cityBy = (slug: string) => CITIES.find((x) => x.slug === slug) ?? CITIES[0];
export const cityName = (slug: string) => cityBy(slug).name;

/** Free plan: three cities, the main one included. */
export const CITY_LIMIT = 3;

export type Category = { slug: string; name: string; icon: string; children: { slug: string; name: string }[] };

const cat = (slug: string, name: string, icon: string, children: [string, string][]): Category => ({
  slug,
  name,
  icon,
  children: children.map(([s, n]) => ({ slug: s, name: n })),
});

export const TREE: Category[] = [
  cat("elektro", "Електроуслуги", "zap", [
    ["el-instalatsii", "Ел. инсталации"],
    ["kontakti-klyuchove", "Контакти и ключове"],
    ["osvetlenie", "Осветление"],
    ["el-tabla", "Ел. табла"],
    ["avariyni-el-remonti", "Аварийни ел. ремонти"],
  ]),
  cat("vik", "ВиК", "droplets", [
    ["vodoprovod", "Водопровод"],
    ["kanalizatsia", "Канализация и отпушване"],
    ["sanitaria", "Санитария и смесители"],
    ["boyleri", "Бойлери"],
    ["techove", "Течове"],
  ]),
  cat("boyadisvane-shpaklovka", "Боя и шпакловка", "paint-roller", [
    ["boyadisvane", "Боядисване"],
    ["shpaklovka", "Шпакловка"],
    ["gipsokarton", "Гипсокартон"],
    ["dekorativni-mazilki", "Декоративни мазилки"],
  ]),
  cat("plochki", "Плочки", "grid", [
    ["plochki-banya", "Плочки за баня"],
    ["plochki-kuhnya", "Плочки за кухня"],
    ["plochki-terasa", "Тераси и стълбища"],
    ["fugi", "Фуги и дребен ремонт"],
  ]),
  cat("podove-parket", "Подове и паркет", "layers", [
    ["parket", "Паркет"],
    ["laminat", "Ламинат"],
    ["tsiklene", "Циклене и лакиране"],
    ["vinil-moket", "Винил и мокет"],
  ]),
  cat("darvodelstvo-mebeli", "Дърводелство и мебели", "hammer", [
    ["sglobyavane-mebeli", "Сглобяване на мебели"],
    ["mebeli-po-porachka", "Мебели по поръчка"],
    ["kuhni", "Кухни"],
    ["darvodelski-remonti", "Дърводелски ремонти"],
  ]),
  cat("vrati-prozortsi", "Врати и прозорци", "door-open", [
    ["pvc-dograma", "PVC дограма"],
    ["aluminieva-dograma", "Алуминиева дограма"],
    ["interiorni-vrati", "Интериорни врати"],
    ["shtori-komarnitsi", "Щори и комарници"],
    ["remont-dograma", "Ремонт и регулиране на дограма"],
  ]),
  cat("pokrivi-izolatsii", "Покриви и изолации", "house", [
    ["remont-pokrivi", "Ремонт на покриви"],
    ["hidroizolatsia", "Хидроизолация"],
    ["toploizolatsia", "Топлоизолация и саниране"],
    ["ulutsi", "Улуци"],
  ]),
  cat("klimatitsi-otoplenie", "Климатици и отопление", "air-vent", [
    ["montazh-klimatitsi", "Монтаж на климатици"],
    ["profilaktika-klimatitsi", "Профилактика на климатици"],
    ["otoplenie-parno", "Отопление и парно"],
    ["termopompi", "Термопомпи"],
  ]),
  cat("remont-uredi", "Ремонт на уреди", "washing-machine", [
    ["peralni", "Перални и сушилни"],
    ["hladilnitsi", "Хладилници"],
    ["pechki-furni", "Печки и фурни"],
    ["sadomiyalni", "Съдомиялни"],
  ]),
  cat("klyuchar", "Ключар", "key", [
    ["avariyno-otklyuchvane", "Аварийно отключване"],
    ["smyana-patroni", "Смяна на патрони и брави"],
    ["blindirani-vrati", "Блиндирани врати"],
  ]),
  cat("maistor-za-vsichko", "Майстор за всичко", "wrench", [
    ["drebni-remonti", "Дребни ремонти"],
    ["montazh-okachvane", "Монтаж и окачване"],
    ["poddrazhka", "Поддръжка на жилище"],
  ]),
  cat("stroitelstvo-zidaria", "Строителство и зидария", "brick-wall", [
    ["zidaria", "Зидария"],
    ["betonovi-raboti", "Бетонови работи"],
    ["kartene", "Къртене и събаряне"],
  ]),
  cat("zavaryavane-metal", "Заваряване и метал", "flame", [
    ["ogradi-parapeti", "Огради и парапети"],
    ["reshetki-porti", "Решетки и порти"],
    ["metalni-konstruktsii", "Метални конструкции"],
  ]),
  cat("gradina-ozelenyavane", "Градина и озеленяване", "sprout", [
    ["kosene", "Косене на трева"],
    ["rezitba", "Резитба на дървета"],
    ["polivni-sistemi", "Поливни системи"],
  ]),
  cat("pochistvane", "Почистване", "sparkles", [
    ["pochistvane-dom", "Почистване на дома"],
    ["sled-remont", "Почистване след ремонт"],
    ["prane-mebel", "Пране на мека мебел"],
  ]),
  cat("hamali-transport", "Хамали и транспорт", "truck", [
    ["premestvane", "Преместване"],
    ["izvozvane", "Извозване на отпадъци"],
    ["transport-bus", "Транспорт с бус"],
  ]),
  cat("smart-dom-mrezhi", "Смарт дом, мрежи и камери", "cctv", [
    ["mrezhi-wifi", "Интернет и Wi-Fi мрежи"],
    ["videonablyudenie", "Видеонаблюдение"],
    ["umen-dom", "Умен дом"],
    ["alarmi-domofoni", "Аларми и домофони"],
  ]),
  cat("avto", "Помощ за автомобила", "car", [
    ["mobilen-avtoservis", "Мобилен автосервиз"],
    ["gumi-na-adres", "Смяна на гуми на адрес"],
    ["akumulatori", "Акумулатори и автоелектрика"],
  ]),
  cat("drugo", "Друго", "ellipsis", [["drugi-uslugi", "Други услуги"]]),
];

export type PhoneVisibility = "public" | "login" | "chat" | "hidden";

export const PHONE_OPTIONS: { value: PhoneVisibility; label: string; short: string; hint: string }[] = [
  {
    value: "login",
    label: "На всеки влязъл потребител",
    short: "виждат го влезлите потребители",
    hint: "Препоръчано. Номерът не се вижда от ботове и от хора без профил.",
  },
  { value: "public", label: "На всеки", short: "вижда го всеки", hint: "Бутон „Покажи телефона“ в профила ти, и без вход." },
  {
    value: "chat",
    label: "Само след като отговоря в чата",
    short: "вижда се, след като отговориш в чата",
    hint: "Първо се пише в чата, после клиентът вижда номера.",
  },
  { value: "hidden", label: "На никого", short: "не се вижда", hint: "Клиентите се свързват с теб само през чата." },
];

export type Profile = {
  displayName: string;
  businessName: string;
  bio: string;
  years: string;
  contactHours: string;
  languages: string[];
  categories: string[];
  otherServices: string;
  city: string;
  areas: string[];
  phone: string;
  phoneVisibility: PhoneVisibility;
};

export const EMAIL = "georgi.petrov@example.com";

/** The demo craftsman from web/scripts/seed.ts, as he appears in docs/ui-pregled/12-profil-nastroyki-1.jpg. */
export const INITIAL: Profile = {
  displayName: "Георги Петров",
  businessName: "",
  bio: "Правоспособен електротехник с 14 години опит. Правя нови инсталации, сменям табла и контакти, откривам повреди. Идвам навреме и чистя след себе си.",
  years: "14",
  contactHours: "Отговарям вечер след 18:00",
  languages: ["bg", "en"],
  categories: ["el-instalatsii", "kontakti-klyuchove", "osvetlenie", "el-tabla"],
  otherServices: "",
  city: "sofia",
  areas: ["bankya"],
  phone: "0888 123 456",
  phoneVisibility: "login",
};

export type PartKey = "za-men" | "kakvo" | "kade" | "kontakti" | "danni";

export const PARTS: { key: PartKey; label: string }[] = [
  { key: "za-men", label: "За мен" },
  { key: "kakvo", label: "Какво работя" },
  { key: "kade", label: "Къде работя" },
  { key: "kontakti", label: "Контакти" },
  { key: "danni", label: "Моите данни" },
];

export const PART_FIELDS: Record<PartKey, (keyof Profile)[]> = {
  "za-men": ["displayName", "businessName", "bio", "years", "contactHours", "languages"],
  kakvo: ["categories", "otherServices"],
  kade: ["city", "areas"],
  kontakti: ["phone", "phoneVisibility"],
  danni: [],
};
