"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { createOrganization, newOwnerInvite, setOrganizationOwner, updateOrganization } from "@/app/actions/admin";

function InviteLink({ token }: { token: string }) {
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/pokana/${token}`;
  return (
    <div className="mt-3 rounded-[8px] bg-rule-soft p-3">
      <p className="text-sm font-bold">Дай този линк на собственика на фирмата. Важи 30 дни и се ползва веднъж.</p>
      <div className="mt-2 flex gap-2">
        <input readOnly className="field min-w-0 flex-1 text-sm" value={link} aria-label="Линк за собственика" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Копирано."), () => toast.error("Не успяхме да копираме."))}
        >
          <Copy className="size-4" aria-hidden /> Копирай
        </button>
      </div>
    </div>
  );
}

export function CreateOrgForm({ cities }: { cities: { slug: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [token, setToken] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    start(async () => {
      const r = await createOrganization(String(f.get("name") ?? ""), String(f.get("eik") ?? ""), String(f.get("city") ?? ""));
      if (!r.ok) return void toast.error(r.message);
      toast.success(r.message);
      setToken(r.token);
      form.reset();
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <div>
          <label htmlFor="o-name" className="label">
            Име на фирмата
          </label>
          <input id="o-name" name="name" className="field" required minLength={2} maxLength={120} />
        </div>
        <div>
          <label htmlFor="o-eik" className="label">
            ЕИК
          </label>
          <input id="o-eik" name="eik" className="field" inputMode="numeric" maxLength={13} />
        </div>
        <div>
          <label htmlFor="o-city" className="label">
            Град
          </label>
          <select id="o-city" name="city" className="field" defaultValue="">
            <option value="">Без град</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Създаваме…" : "Създай фирма"}
        </button>
      </div>
      {token && <InviteLink token={token} />}
    </form>
  );
}

export function OrgAdmin({
  id,
  verified,
  hidden,
  planStatus,
  hasOwner,
}: {
  id: string;
  verified: boolean;
  hidden: boolean;
  planStatus: "active" | "paused";
  hasOwner: boolean;
}) {
  const [pending, start] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) toast.success(r.message);
        else toast.error(r.message);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Неуспешно.");
      }
    });

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => updateOrganization(id, { verified: !verified }))}>
          {verified ? "Махни „Проверена“" : "Маркирай като проверена"}
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => updateOrganization(id, { hidden: !hidden }))}>
          {hidden ? "Покажи" : "Скрий"}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={pending}
          onClick={() => run(() => updateOrganization(id, { planStatus: planStatus === "active" ? "paused" : "active" }))}
        >
          {planStatus === "active" ? "Спри плана" : "Включи плана"}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await newOwnerInvite(id);
              if (r.ok) setToken(r.token);
              else toast.error(r.message);
            })
          }
        >
          {hasOwner ? "Нов линк за собственик" : "Линк за собственика"}
        </button>
      </div>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await setOrganizationOwner(id, email);
            if (r.ok) setEmail("");
            return r;
          });
        }}
      >
        <div className="min-w-60 flex-1">
          <label htmlFor={`own-${id}`} className="text-sm font-semibold text-ink-2">
            Или направи собственик съществуващ потребител (имейл)
          </label>
          <input id={`own-${id}`} type="email" className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-ghost btn-sm underline underline-offset-4" disabled={pending}>
          Добави
        </button>
      </form>
      {token && <InviteLink token={token} />}
    </div>
  );
}
