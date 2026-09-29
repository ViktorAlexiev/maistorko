// Shareable search URLs: Bulgarian-transliterated query params <-> RPC args.

export type TimeSlot = "morning" | "afternoon" | "evening";
export type SortKey = "soonest" | "price" | "rating" | "newest" | "relevance";

export const TIME_SLOTS: { value: TimeSlot; param: string; label: string; hours: string }[] = [
  { value: "morning", param: "sutrin", label: "Сутрин", hours: "до 12 ч." },
  { value: "afternoon", param: "sledobed", label: "Следобед", hours: "12–17 ч." },
  { value: "evening", param: "vecher", label: "Вечер", hours: "след 17 ч." },
];

export const SORTS: { value: SortKey; param: string; label: string }[] = [
  { value: "soonest", param: "nai-skoro", label: "Най-скоро свободни" },
  { value: "price", param: "nai-evtini", label: "Най-ниска цена" },
  { value: "rating", param: "reyting", label: "Най-висок рейтинг" },
  { value: "newest", param: "novi", label: "Най-нови" },
  { value: "relevance", param: "savpadenie", label: "Най-добро съвпадение" },
];

export const PAGE_SIZE = 12;

export type SearchState = {
  q: string;
  category: string;
  city: string;
  date: string;
  dateTo: string;
  time: TimeSlot | "";
  priceMin: string;
  priceMax: string;
  rating: string;
  verified: boolean;
  sort: SortKey;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isNum = (s: string) => /^\d+(\.\d+)?$/.test(s);

export function parseSearch(raw: Raw, fixedCategory?: string): SearchState {
  const time = TIME_SLOTS.find((t) => t.param === one(raw.chas))?.value ?? "";
  const q = one(raw.q).slice(0, 120).trim();
  const sortParam = one(raw.sort);
  const sort = SORTS.find((s) => s.param === sortParam)?.value ?? (q ? "relevance" : "soonest");
  const date = one(raw.data);
  const dateTo = one(raw.do);
  return {
    q,
    category: fixedCategory ?? one(raw.kategoria).replace(/[^a-z0-9-]/g, ""),
    city: one(raw.grad).replace(/[^a-z0-9-]/g, ""),
    date: isDate(date) ? date : "",
    dateTo: isDate(dateTo) ? dateTo : "",
    time,
    priceMin: isNum(one(raw.tsena_ot)) ? one(raw.tsena_ot) : "",
    priceMax: isNum(one(raw.tsena_do)) ? one(raw.tsena_do) : "",
    rating: ["3", "4", "4.5"].includes(one(raw.reyting)) ? one(raw.reyting) : "",
    verified: one(raw.provereni) === "1",
    sort,
    page: Math.max(1, Math.min(200, parseInt(one(raw.str) || "1", 10) || 1)),
  };
}

export function toQueryString(s: Partial<SearchState>, fixedCategory?: string) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.category && s.category !== fixedCategory) p.set("kategoria", s.category);
  if (s.city) p.set("grad", s.city);
  if (s.date) p.set("data", s.date);
  if (s.dateTo && s.dateTo !== s.date) p.set("do", s.dateTo);
  if (s.time) p.set("chas", TIME_SLOTS.find((t) => t.value === s.time)!.param);
  if (s.priceMin) p.set("tsena_ot", s.priceMin);
  if (s.priceMax) p.set("tsena_do", s.priceMax);
  if (s.rating) p.set("reyting", s.rating);
  if (s.verified) p.set("provereni", "1");
  const defaultSort = s.q ? "relevance" : "soonest";
  if (s.sort && s.sort !== defaultSort) p.set("sort", SORTS.find((x) => x.value === s.sort)!.param);
  if (s.page && s.page > 1) p.set("str", String(s.page));
  const str = p.toString();
  return str ? `?${str}` : "";
}

export function toRpcArgs(s: SearchState, any = false) {
  return {
    p_q: s.q || undefined,
    p_category: s.category || undefined,
    p_city: s.city || undefined,
    p_date_from: s.date || undefined,
    p_date_to: s.date ? s.dateTo || s.date : undefined,
    p_time: s.time || undefined,
    p_price_min: s.priceMin ? Number(s.priceMin) : undefined,
    p_price_max: s.priceMax ? Number(s.priceMax) : undefined,
    p_min_rating: s.rating ? Number(s.rating) : undefined,
    p_verified: s.verified,
    p_sort: s.sort,
    p_limit: PAGE_SIZE,
    p_offset: (s.page - 1) * PAGE_SIZE,
    p_any: any,
  };
}
