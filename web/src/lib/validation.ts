import { z } from "zod";

// Shared validation (client forms + server actions). Messages in Bulgarian.

const email = z
  .string()
  .trim()
  .min(1, "Въведете имейл.")
  .email("Имейлът не изглежда валиден.")
  .max(254);

const password = z
  .string()
  .min(8, "Паролата трябва да е поне 8 символа.")
  .max(72, "Паролата е твърде дълга.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Въведете парола."),
});

export const registerSchema = z.object({
  role: z.enum(["client", "craftsman"]),
  fullName: z
    .string()
    .trim()
    .min(2, "Въведете име (поне 2 символа).")
    .max(120, "Името е твърде дълго."),
  city: z.string().min(1, "Изберете град."),
  email,
  password,
  terms: z.literal("on", { message: "Трябва да приемете условията." }),
});

export const forgotSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Паролите не съвпадат.", path: ["confirm"] });

const phone = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || /^\+?[0-9 ()-]{6,20}$/.test(v), "Телефонът не изглежда валиден.");

export const clientProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Въведете име.").max(120),
  city: z.string().optional(),
  phone,
});

export const craftsmanProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Въведете име.").max(120),
  businessName: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(1500, "Описанието е до 1500 символа.").optional(),
  years: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 70), "Години опит: число от 0 до 70."),
  city: z.string().min(1, "Изберете град."),
  areas: z.array(z.string()).max(40),
  categories: z.array(z.string()).min(1, "Изберете поне една категория.").max(20, "Най-много 20 категории."),
  languages: z.array(z.string()).min(1, "Изберете поне един език."),
  contactHours: z.string().trim().max(80).optional(),
  otherServices: z.string().trim().max(200, "Описанието на „Друго“ е до 200 символа.").optional(),
  phone,
  phoneVisibility: z.enum(["public", "login", "chat", "hidden"]),
});

const money = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d+([.,]\d{1,2})?$/.test(v) && Number(v.replace(",", ".")) <= 100000), "Въведете сума, напр. 25 или 12,50.");

export const pricingSchema = z
  .object({
    hourlyRate: money,
    calloutFee: money,
    travelFee: money,
    materialsIncluded: z.boolean(),
    quoteOnInspection: z.boolean(),
    inspectionPolicy: z.enum(["", "free", "paid", "deducted", "none"]),
    inspectionFee: money,
    termsNote: z.string().trim().max(600, "Текстът е до 600 символа."),
  })
  .refine((v) => !(v.inspectionPolicy === "free" || v.inspectionPolicy === "none") || v.inspectionFee === "", {
    message: "Цена на огледа се попълва само ако огледът е платен.",
    path: ["inspectionFee"],
  });

export const serviceSchema = z
  .object({
    name: z.string().trim().min(2, "Въведете име на услугата.").max(120),
    kind: z.enum(["fixed", "from", "quote"]),
    price: money,
    unit: z.enum(["job", "hour", "m2", "piece", "meter", "day"]),
    categoryId: z.string().optional(),
  })
  .refine((v) => v.kind === "quote" || v.price !== "", { message: "Въведете цена или изберете „по оглед“.", path: ["price"] });

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Напишете съобщение.").max(4000, "Съобщението е до 4000 символа."),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Изберете оценка.").max(5),
  body: z.string().trim().max(1000, "Отзивът е до 1000 символа.").optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Въведете име.").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Само малки латински букви, цифри и тирета."),
  parentId: z.string().optional(),
  description: z.string().trim().max(400).optional(),
  keywords: z.string().trim().max(500).optional(),
  sort: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
});

export function toMoney(v: string): number | null {
  return v.trim() === "" ? null : Number(v.replace(",", "."));
}

export type FieldErrors = Record<string, string>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
