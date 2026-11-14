// Demo data for the planning prototype „цената в реда на каталога“. Never imported by product code.
import { addDaysISO, headlinePrice, todayISO, type PriceUnit } from "@/lib/format";
import type { CraftsmanCardData } from "@/components/craftsman-row";

/** The service or subcategory of the craftsman that matched the search text, price already formatted. */
export type RowMatch = { name: string; price: string };

export type RedRow = CraftsmanCardData & {
  match?: RowMatch;
  /** the general headline price, as the row shows it today */
  headline: string;
};

export type Preset = { query: string; count: number; rows: RedRow[] };

type Seed = {
  name: string;
  pro?: boolean;
  verified?: boolean;
  cats: string[];
  city: string;
  rating?: [number, number];
  years: number;
  from: number;
  unit?: PriceUnit;
  /** 14 days from today: F free, P partial, B busy */
  strip: string;
  stale?: boolean;
  shortNotice?: boolean;
  match?: RowMatch;
};

function build(seeds: Seed[], today: string): RedRow[] {
  return seeds.map((s, i) => {
    const first = s.strip.search(/[FP]/);
    return {
      id: `red-${i}`,
      slug: `red-${i}`,
      display_name: s.name,
      business_name: null,
      avatar_url: null,
      city_name: s.city,
      category_names: s.cats,
      price_from: s.from,
      price_from_unit: s.unit ?? null,
      quote_on_inspection: false,
      rating_avg: s.rating?.[0] ?? 0,
      rating_count: s.rating?.[1] ?? 0,
      is_verified: s.verified ?? true,
      short_notice: s.shortNotice ?? false,
      years_experience: s.years,
      next_free: first >= 0 ? addDaysISO(today, first) : null,
      matched_date: null,
      strip: s.strip,
      freshness: s.stale ? "stale" : "fresh",
      is_pro: s.pro ?? false,
      match: s.match,
      headline: headlinePrice(s.from, s.unit ?? null, false),
    };
  });
}

export function presetData(n: 1 | 2): Preset {
  const today = todayISO();
  if (n === 1) {
    return {
      query: "смяна на контакт",
      count: 6,
      rows: build(
        [
          {
            name: "Георги Петров",
            pro: true,
            cats: ["Електроуслуги"],
            city: "София",
            rating: [4.67, 3],
            years: 14,
            from: 20,
            strip: "FFPBBFFFPBBFFP",
            shortNotice: true,
            match: { name: "Смяна на контакт или ключ", price: "15 €/бр." },
          },
          {
            name: "Огнян Радев",
            cats: ["Майстор за всичко", "Електроуслуги", "ВиК"],
            city: "Русе",
            years: 30,
            from: 15,
            strip: "BFFBBBPFFBBBFF",
            match: { name: "Смяна на контакт", price: "12 €" },
          },
          {
            name: "Васил Тодоров",
            cats: ["Ключар"],
            city: "София",
            years: 12,
            from: 50,
            strip: "BBPFFBBBFFFBBP",
          },
          {
            name: "Атанас Георгиев",
            cats: ["Електроуслуги"],
            city: "Пловдив",
            years: 19,
            from: 18,
            strip: "PFBBFFBBBPFFBB",
            match: { name: "Смяна на контакт", price: "12 €" },
          },
          {
            name: "Виктор Ненов",
            verified: false,
            cats: ["Помощ за автомобила"],
            city: "София",
            years: 11,
            from: 25,
            unit: "hour",
            strip: "BBBBBBBBBBBBBB",
            stale: true,
          },
          {
            name: "Стефан Ангелов",
            cats: ["Климатици и отопление"],
            city: "Варна",
            rating: [4.8, 5],
            years: 9,
            from: 45,
            strip: "BFFFBBPPFFBBBF",
          },
        ],
        today,
      ),
    };
  }
  return {
    query: "теч",
    count: 4,
    rows: build(
      [
        {
          name: "Иван Димитров",
          cats: ["ВиК"],
          city: "София",
          rating: [4.9, 7],
          years: 16,
          from: 30,
          strip: "FPFBBFFFBBPFFB",
          match: { name: "Течове", price: "от 30 €" },
        },
        {
          name: "Красимир Вълчев",
          cats: ["ВиК"],
          city: "София",
          rating: [4.5, 2],
          years: 8,
          from: 35,
          strip: "BFFBBBPFFBBBFP",
          match: { name: "Отстраняване на теч под мивка", price: "35 €" },
        },
        {
          name: "Пламен Желев",
          cats: ["ВиК", "Плочки"],
          city: "Бургас",
          years: 21,
          from: 40,
          strip: "PPBBFFFBBBPFFF",
          match: { name: "Търсене на скрит теч в стена", price: "по оглед" },
        },
        {
          name: "Димитър Колев",
          cats: ["Покриви"],
          city: "София",
          rating: [4.2, 4],
          years: 25,
          from: 60,
          strip: "BBBFFBBBBPFBBB",
        },
      ],
      today,
    ),
  };
}
