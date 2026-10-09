import { addDaysISO, formatDate } from "@/lib/format";

export type JobSource = "maistorko" | "recommendation" | "phone" | "facebook" | "other";
export type JobStatus = "planned" | "done" | "cancelled";

export const SOURCE_LABEL: Record<JobSource, string> = {
  maistorko: "От Майсторко",
  recommendation: "Препоръка",
  phone: "Обаждане",
  facebook: "Facebook",
  other: "Друго",
};

export type Material = { id: string; name: string; qty: string | null; amount: number };
export type Client = { id: string; name: string; phone: string | null; address: string | null; note: string | null };

export type Job = {
  id: string;
  title: string;
  source: JobSource;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  status: JobStatus;
  note: string | null;
  materials_by_client: boolean;
  labor_price: number | null;
  transport_price: number | null;
  client_id: string | null;
  done_at: string | null;
  materials: Material[];
};

/** "14 окт" or "14 окт – 18 окт, цели дни" or "14 окт, 09:00–11:00" */
export function jobWhen(j: Pick<Job, "start_date" | "end_date" | "start_time" | "end_time">) {
  if (j.end_date !== j.start_date) return `${formatDate(j.start_date)} – ${formatDate(j.end_date)}, цели дни`;
  if (j.start_time) return `${formatDate(j.start_date, true)}, ${j.start_time.slice(0, 5)}–${j.end_time!.slice(0, 5)}`;
  return `${formatDate(j.start_date, true)}, цял ден`;
}

/** What the craftsman earns from a job: labour + transport + materials he supplied. */
export function jobTotal(j: Pick<Job, "labor_price" | "transport_price" | "materials_by_client" | "materials">) {
  const materials = j.materials_by_client ? 0 : j.materials.reduce((n, m) => n + Number(m.amount), 0);
  return Number(j.labor_price ?? 0) + Number(j.transport_price ?? 0) + materials;
}

export const hasMoney = (j: Pick<Job, "labor_price" | "transport_price" | "materials">) =>
  j.labor_price != null || j.transport_price != null || j.materials.length > 0;

/** First and last day of a "YYYY-MM" month. */
export function monthRange(ym: string) {
  const from = `${ym}-01`;
  const d = new Date(`${from}T12:00:00Z`);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12));
  const to = addDaysISO(next.toISOString().slice(0, 10), -1);
  return { from, to };
}

export const shiftMonth = (ym: string, delta: number) => {
  const d = new Date(`${ym}-01T12:00:00Z`);
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1, 12));
  return n.toISOString().slice(0, 7);
};
