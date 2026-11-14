/**
 * Demo data for the „Цени и услуги“ prototype: an electrician in Sofia, four subcategories under „Електроуслуги“,
 * modelled on the local demo profile georgi-petrov. Planning only, never imported by product code.
 */

export type BoxKind = "fixed" | "from" | "hour" | "quote";
export type ServiceKind = "fixed" | "from" | "quote";
export type Unit = "job" | "hour" | "m2" | "piece" | "meter" | "day";

/** The price of one checked subcategory. `kind: null` = no price yet. */
export type Box = { id: number; name: string; kind: BoxKind | null; price: string; unit: Unit };

export type Group = {
  name: string;
  boxes: Box[];
  /** Pro only: what colleagues charge in this top category */
  hint: { hourly: [number, number]; job: [number, number]; scope: "city" | "all" };
};

export type Service = {
  id: string;
  name: string;
  kind: ServiceKind;
  price: string;
  unit: Unit;
  catId: number;
  description: string;
  templateId?: number;
};

export type Template = { id: number; name: string; unit: Unit; catId: number; hours: number; range: [number, number] };

export type Policy = "" | "free" | "paid" | "deducted" | "none";

export type Terms = {
  callout: string;
  travel: string;
  materials: boolean;
  quoteOnInspection: boolean;
  policy: Policy;
  inspectionFee: string;
  note: string;
};

export const CITY = "София";

export const GROUPS: Group[] = [
  {
    name: "Електроуслуги",
    hint: { hourly: [20, 30], job: [25, 80], scope: "city" },
    boxes: [
      { id: 21, name: "Ел. инсталации", kind: "hour", price: "25", unit: "hour" },
      { id: 22, name: "Контакти и ключове", kind: "hour", price: "25", unit: "hour" },
      { id: 23, name: "Осветление", kind: "from", price: "20", unit: "job" },
      { id: 24, name: "Ел. табла", kind: null, price: "", unit: "job" },
    ],
  },
];

export const SERVICES: Service[] = [
  { id: "s1", name: "Смяна на контакт или ключ", kind: "fixed", price: "15", unit: "piece", catId: 22, description: "", templateId: 101 },
  { id: "s2", name: "Монтаж на полилей / лампа", kind: "fixed", price: "25", unit: "piece", catId: 23, description: "без окачване на тежки полилеи", templateId: 102 },
  { id: "s3", name: "Нова линия за контакт", kind: "from", price: "60", unit: "job", catId: 21, description: "" },
  { id: "s4", name: "Цялостна ел. инсталация на апартамент", kind: "quote", price: "", unit: "job", catId: 21, description: "" },
  { id: "s5", name: "Подмяна на ел. табло", kind: "from", price: "280", unit: "job", catId: 24, description: "" },
];

/** Three more services for ?pulno=1, so the free plan starts full (8 of 8). */
export const MORE_SERVICES: Service[] = [
  { id: "s6", name: "Монтаж на LED лента", kind: "fixed", price: "12", unit: "meter", catId: 23, description: "" },
  { id: "s7", name: "Поставяне на нов контакт", kind: "fixed", price: "35", unit: "piece", catId: 22, description: "", templateId: 104 },
  { id: "s8", name: "Смяна на бушон", kind: "fixed", price: "20", unit: "job", catId: 24, description: "", templateId: 103 },
];

/** Ready-made jobs of the checked subcategories („Търсене на повреда“ belongs to an unchecked one and is not offered). */
export const TEMPLATES: Template[] = [
  { id: 101, name: "Смяна на контакт или ключ", unit: "job", catId: 22, hours: 0.5, range: [12, 20] },
  { id: 104, name: "Поставяне на нов контакт", unit: "job", catId: 22, hours: 1.5, range: [30, 50] },
  { id: 102, name: "Монтаж на лампа или полилей", unit: "job", catId: 23, hours: 1, range: [20, 35] },
  { id: 103, name: "Смяна на бушон", unit: "job", catId: 24, hours: 0.5, range: [15, 25] },
  { id: 105, name: "Монтаж на ел. табло", unit: "job", catId: 24, hours: 4, range: [150, 300] },
  { id: 107, name: "Монтаж на вентилатор", unit: "job", catId: 21, hours: 1.5, range: [30, 45] },
];

export const TERMS: Terms = {
  callout: "20",
  travel: "",
  materials: false,
  quoteOnInspection: false,
  policy: "deducted",
  inspectionFee: "20",
  note: "Малки ремонти (контакт, лампа, ключ) правя направо, без оглед. За ново табло или цяла инсталация първо идвам на оглед и давам писмена оферта. Огледът се приспада, ако работата ми се възложи.",
};

export const FREE_LIMIT = 8;
