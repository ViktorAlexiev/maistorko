"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCategory, saveCategory } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/auth";
import { CategoryIcon } from "@/components/category-icon";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";

type Cat = {
  id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  keywords: string[];
  sort: number;
  is_active: boolean;
};

function translit(s: string) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht",
    ъ: "a", ь: "y", ю: "yu", я: "ya",
  };
  return s
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CategoryAdmin({ categories, usage }: { categories: Cat[]; usage: Record<number, number> }) {
  const [editing, setEditing] = useState<Cat | "new" | null>(null);
  const [pending, start] = useTransition();
  const tops = categories.filter((c) => c.parent_id === null);

  function remove(c: Cat) {
    if (!window.confirm(`Да изтрия ли „${c.name}“?`)) return;
    start(async () => {
      const r = await deleteCategory(c.id);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });
  }

  const row = (c: Cat, child = false) => (
    <li key={c.id} className={`flex items-center gap-3 border-b border-line py-2.5 ${child ? "pl-10" : ""}`}>
      {!child && (
        <span className="grid size-8 place-items-center rounded-[6px] bg-paper ring-1 ring-inset ring-line">
          <CategoryIcon name={c.icon} className="size-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={child ? "font-semibold" : "font-extrabold"}>
          {c.name}
          {!c.is_active && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-bold text-ink-2">
              <EyeOff className="size-3" aria-hidden /> скрита
            </span>
          )}
        </p>
        <p className="truncate text-sm text-ink-3">
          /{c.slug} · {usage[c.id] ?? 0} майстори{c.keywords.length ? ` · ${c.keywords.slice(0, 6).join(", ")}` : ""}
        </p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(c)} aria-label={`Редактирай ${c.name}`}>
        <Pencil className="size-4" aria-hidden />
      </button>
      <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={pending} onClick={() => remove(c)} aria-label={`Изтрий ${c.name}`}>
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div>
        <button type="button" className="btn btn-primary mb-4" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden /> Нова категория
        </button>
        <ul className="border-t-[1.5px] border-ink">
          {tops.map((t) => (
            <li key={t.id}>
              <ul>
                {row(t)}
                {categories.filter((c) => c.parent_id === t.id).map((c) => row(c, true))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      {editing && (
        <CategoryForm
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          tops={tops}
          onDone={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CategoryForm({ category, tops, onDone }: { category: Cat | null; tops: Cat[]; onDone: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(saveCategory, {});
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="grid content-start gap-4 rounded-[10px] border-[1.5px] border-ink bg-surface p-5 xl:sticky xl:top-24" noValidate>
      <h2 className="text-xl font-extrabold">{category ? `Редакция: ${category.name}` : "Нова категория"}</h2>
      {category && <input type="hidden" name="id" value={category.id} />}
      <div>
        <label htmlFor="c-name" className="label">
          Име
        </label>
        <input
          id="c-name"
          name="name"
          className="field"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(translit(e.target.value));
          }}
          aria-invalid={Boolean(state.errors?.name)}
        />
        <FieldError id="c-name-err" message={state.errors?.name} />
      </div>
      <div>
        <label htmlFor="c-slug" className="label">
          Адрес (slug)
        </label>
        <input
          id="c-slug"
          name="slug"
          className="field"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          aria-invalid={Boolean(state.errors?.slug)}
          aria-describedby="c-slug-hint"
        />
        <p id="c-slug-hint" className="hint">
          /kategorii/{slug || "…"}
        </p>
        <FieldError id="c-slug-err" message={state.errors?.slug} />
      </div>
      <div>
        <label htmlFor="c-parent" className="label">
          Родителска категория
        </label>
        <select id="c-parent" name="parentId" className="field" defaultValue={category?.parent_id ? String(category.parent_id) : ""}>
          <option value="">Няма (основна категория)</option>
          {tops
            .filter((t) => t.id !== category?.id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
        <FieldError id="c-parent-err" message={state.errors?.parentId} />
      </div>
      <div>
        <label htmlFor="c-desc" className="label">
          Описание
        </label>
        <textarea id="c-desc" name="description" rows={2} className="field min-h-0" defaultValue={category?.description ?? ""} maxLength={400} />
      </div>
      <div>
        <label htmlFor="c-kw" className="label">
          Ключови думи
        </label>
        <input id="c-kw" name="keywords" className="field" defaultValue={category?.keywords.join(", ") ?? ""} aria-describedby="c-kw-hint" />
        <p id="c-kw-hint" className="hint">
          Разделени със запетая, напр. „чешма, кран, теч“.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="c-sort" className="label">
            Подредба
          </label>
          <input id="c-sort" name="sort" inputMode="numeric" className="field" defaultValue={category?.sort ?? 100} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 self-end pb-3">
          <input type="checkbox" name="isActive" className="check" defaultChecked={category?.is_active ?? true} />
          Видима
        </label>
      </div>
      {!state.ok && <FormMessage state={state} />}
      <div className="flex gap-2">
        <SubmitButton pendingText="Записваме…">Запази</SubmitButton>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Откажи
        </button>
      </div>
    </form>
  );
}
