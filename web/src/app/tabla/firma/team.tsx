"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { formatDate, relativeDay, timeAgo } from "@/lib/format";

export type TeamMember = {
  user_id: string;
  role: "owner" | "manager" | "craftsman";
  name: string;
  slug: string | null;
  avatar_url: string | null;
  joined_at: string;
  last_confirmed_at: string | null;
  next_free: string | null;
};

const ROLE = { owner: "Собственик", manager: "Мениджър", craftsman: "Майстор" } as const;

export function TeamList({ team, meId, myRole }: { team: TeamMember[]; meId: string; myRole: "owner" | "manager" | "craftsman" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const manager = myRole === "owner" || myRole === "manager";

  function call(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    start(async () => {
      const { error } = await fn();
      if (error) toast.error(error.message);
      else {
        toast.success(ok);
        router.refresh();
      }
    });
  }

  return (
    <ul className="grid border-t-[1.5px] border-ink">
      {team.map((m) => (
        <li key={m.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3">
          <Avatar name={m.name} url={m.avatar_url} size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">
              {m.slug ? (
                <Link href={`/maistori/${m.slug}`} className="hover:underline">
                  {m.name}
                </Link>
              ) : (
                m.name
              )}
              {m.user_id === meId && <span className="ml-2 text-sm font-normal text-ink-3">(вие)</span>}
            </p>
            <p className="text-sm text-ink-2">
              {ROLE[m.role]}
              {m.slug && (
                <>
                  {" · "}
                  {m.next_free ? `свободен ${relativeDay(m.next_free)}` : "няма свободни дни скоро"}
                  {m.last_confirmed_at && ` · календар: ${timeAgo(m.last_confirmed_at)}`}
                </>
              )}
            </p>
          </div>
          {manager && m.user_id !== meId && m.role !== "owner" && (
            <div className="flex flex-wrap gap-1">
              {myRole === "owner" && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={pending}
                  onClick={() =>
                    call(
                      () => createClient().rpc("set_member_role", { p_user: m.user_id, p_role: m.role === "manager" ? "craftsman" : "manager" }),
                      m.role === "manager" ? "Вече е майстор." : "Вече е мениджър.",
                    )
                  }
                >
                  {m.role === "manager" ? "Направи майстор" : "Направи мениджър"}
                </button>
              )}
              {(m.role === "craftsman" || myRole === "owner") && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Да махна ли ${m.name} от фирмата? Профилът и отзивите му остават негови.`)) return;
                    call(() => createClient().rpc("remove_org_member", { p_user: m.user_id }), "Махнат от фирмата.");
                  }}
                >
                  Махни
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ShareLink({ link, name }: { link: string; name?: string | null }) {
  const text = encodeURIComponent(`${name ? `${name}, ` : ""}отвори този линк, за да приемеш поканата ни в Майсторко: ${link}`);
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <input readOnly className="field min-w-0 flex-1 text-sm" value={link} aria-label="Линк за поканата" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Копирано."), () => toast.error("Не успяхме да копираме."))}
      >
        <Copy className="size-4" aria-hidden /> Копирай
      </button>
      <a className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={`viber://forward?text=${text}`}>
        <Send className="size-4" aria-hidden /> Viber
      </a>
      <a className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${text}`}>
        <Send className="size-4" aria-hidden /> WhatsApp
      </a>
    </div>
  );
}

export function InviteForm({ myRole }: { myRole: "owner" | "manager" | "craftsman" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [created, setCreated] = useState<{ link: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get("name") ?? "").trim();
    setError(null);
    start(async () => {
      const { data, error: err } = await createClient().rpc("create_org_invite", {
        p_full_name: name || undefined,
        p_email: String(f.get("email") ?? "").trim() || undefined,
        p_role: String(f.get("role") ?? "craftsman"),
      });
      if (err || !data) return void setError(err?.message ?? "Не успяхме да направим покана.");
      setCreated({ link: `${window.location.origin}/pokana/${data}`, name });
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11rem]">
        <div>
          <label htmlFor="inv-name" className="label">
            Име на човека
          </label>
          <input id="inv-name" name="name" className="field" maxLength={120} placeholder="напр. Иван Петров" />
        </div>
        <div>
          <label htmlFor="inv-email" className="label">
            Имейл <span className="font-normal text-ink-3">(по желание)</span>
          </label>
          <input id="inv-email" name="email" type="email" className="field" maxLength={200} />
        </div>
        <div>
          <label htmlFor="inv-role" className="label">
            Роля
          </label>
          <select id="inv-role" name="role" className="field" defaultValue="craftsman">
            <option value="craftsman">Майстор</option>
            {myRole === "owner" && <option value="manager">Мениджър</option>}
          </select>
        </div>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Правим линк…" : "Направи покана"}
        </button>
      </div>
      {created && (
        <div className="rounded-[8px] bg-rule-soft p-3">
          <p className="text-sm font-bold">Готово. Изпрати линка на {created.name || "човека"}. Важи 30 дни и се ползва веднъж.</p>
          <ShareLink link={created.link} name={created.name} />
        </div>
      )}
    </form>
  );
}

export function PendingInvites({ invites }: { invites: { token: string; role: string; full_name: string | null; email: string | null; created_at: string; expires_at: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!invites.length) return null;
  return (
    <div>
      <h3 className="font-extrabold">Чакащи покани</h3>
      <ul className="mt-2 grid border-t border-line">
        {invites.map((i) => (
          <li key={i.token} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2.5 text-sm">
            <span className="font-bold">{i.full_name || i.email || "Без име"}</span>
            <span className="text-ink-3">
              {i.role === "manager" ? "мениджър" : i.role === "owner" ? "собственик" : "майстор"} · изтича на {formatDate(i.expires_at.slice(0, 10))}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                navigator.clipboard
                  .writeText(`${window.location.origin}/pokana/${i.token}`)
                  .then(() => toast.success("Линкът е копиран."), () => toast.error("Не успяхме да копираме."))
              }
            >
              <Copy className="size-4" aria-hidden /> Линк
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await createClient().rpc("revoke_org_invite", { p_token: i.token });
                  router.refresh();
                })
              }
            >
              Анулирай
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OrgProfileForm({
  org,
  cities,
}: {
  org: { id: string; name: string; description: string; phone: string; cityId: number | null };
  cities: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (name.length < 2) return void toast.error("Напишете името на фирмата.");
    start(async () => {
      const { error } = await createClient()
        .from("organizations")
        .update({
          name,
          description: String(f.get("description") ?? "").trim() || null,
          phone: String(f.get("phone") ?? "").trim() || null,
          city_id: f.get("city") ? Number(f.get("city")) : null,
        })
        .eq("id", org.id);
      if (error) return void toast.error("Не успяхме да запишем промените.");
      toast.success("Профилът на фирмата е записан.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="org-name" className="label">
            Име
          </label>
          <input id="org-name" name="name" className="field" defaultValue={org.name} maxLength={120} />
        </div>
        <div>
          <label htmlFor="org-phone" className="label">
            Телефон на фирмата
          </label>
          <input id="org-phone" name="phone" type="tel" className="field" defaultValue={org.phone} maxLength={40} />
        </div>
      </div>
      <div className="max-w-sm">
        <label htmlFor="org-city" className="label">
          Град
        </label>
        <select id="org-city" name="city" className="field" defaultValue={org.cityId ?? ""}>
          <option value="">Не е избран</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="org-desc" className="label">
          За фирмата
        </label>
        <textarea id="org-desc" name="description" className="field" rows={4} maxLength={1000} defaultValue={org.description} />
      </div>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Записваме…" : "Запази"}
        </button>
      </div>
    </form>
  );
}

export function LeaveButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Да напусна ли фирмата?")) return;
        start(async () => {
          const { error } = await createClient().rpc("leave_org");
          if (error) return void toast.error(error.message);
          toast.success("Напуснахте фирмата.");
          router.push("/tabla");
          router.refresh();
        });
      }}
    >
      Напусни фирмата
    </button>
  );
}
