/**
 * Questions the client can answer before the first message, by kind of work. The answers are added to the message as
 * short lines, so the craftsman can give a price without asking three more questions. Keys are top-level category slugs.
 */
export type InquiryQuestion = { id: string; label: string; options?: string[]; placeholder?: string };

const WHERE: InquiryQuestion = { id: "where", label: "Квартал или адрес", placeholder: "напр. Люлин 5, до метрото" };
const BUILDING: InquiryQuestion = { id: "building", label: "Къде е работата", options: ["Апартамент", "Къща", "Офис или магазин"] };

export const INQUIRY_QUESTIONS: Record<string, InquiryQuestion[]> = {
  vik: [
    { id: "what", label: "Какво тече или е запушено", placeholder: "напр. мивка в кухнята, спойка на бойлер" },
    { id: "room", label: "Къде в дома", options: ["Баня", "Кухня", "Тоалетна", "Мазе или двор", "Друго"] },
    { id: "now", label: "Тече ли в момента", options: ["Да, тече", "Спрял съм водата", "Не тече, но има проблем"] },
    WHERE,
  ],
  elektro: [
    { id: "power", label: "Има ли ток", options: ["Да, има", "Няма ток", "Само на част от дома"] },
    { id: "what", label: "Какво е нужно", placeholder: "напр. смяна на контакт, нова лампа, табло" },
    { id: "room", label: "В коя стая", placeholder: "напр. хол, баня" },
    BUILDING,
    WHERE,
  ],
  "klimatitsi-otoplenie": [
    { id: "need", label: "Какво е нужно", options: ["Монтаж на нов климатик", "Профилактика", "Ремонт", "Парно или радиатор"] },
    { id: "size", label: "Квадратура на помещението", placeholder: "напр. 25 кв.м" },
    { id: "have", label: "Имате ли уреда", options: ["Да, вече е закупен", "Не, трябва да се купи"] },
    WHERE,
  ],
  "maistor-za-vsichko": [
    { id: "what", label: "Какво трябва да се свърши", placeholder: "напр. закачане на ТВ на стена" },
    { id: "material", label: "Материали и уреди", options: ["Имам всичко", "Трябва да се купят", "Не знам какво трябва"] },
    WHERE,
  ],
};

/** For any other kind of work */
export const GENERIC_QUESTIONS: InquiryQuestion[] = [
  { id: "what", label: "Какво трябва да се свърши", placeholder: "Опишете накратко" },
  { id: "material", label: "Материали", options: ["Имам всичко", "Трябва да се купят", "Не знам"] },
  WHERE,
];

export const questionsFor = (slug: string | undefined) => (slug && INQUIRY_QUESTIONS[slug]) || GENERIC_QUESTIONS;

/** "Какво: мивка в кухнята\nТече ли: Да, тече" from the answers that were filled in */
export function composeAnswers(questions: InquiryQuestion[], answers: Record<string, string>) {
  return questions
    .filter((q) => answers[q.id]?.trim())
    .map((q) => `${q.label}: ${answers[q.id].trim()}`)
    .join("\n");
}
