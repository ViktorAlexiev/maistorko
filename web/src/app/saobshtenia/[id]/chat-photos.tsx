"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { checkImage, imageExt, shrinkImage } from "@/components/image-upload";

export type Share = {
  id: string;
  message_id: number;
  path: string;
  status: "pending" | "approved" | "declined";
  published_at: string | null;
  requested_by: string;
};

export type Attachment = { key: string; file: File; preview: string };

export const MAX_ATTACHMENTS = 4;

/** Re-encodes (drops EXIF/GPS) and uploads photos to the private chat bucket. Returns the stored paths. */
export async function uploadChatPhotos(
  supabase: SupabaseClient,
  conversationId: string,
  files: File[],
): Promise<{ paths: string[]; errors: string[] }> {
  const paths: string[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const problem = checkImage(file, 5);
    if (problem) {
      errors.push(`${file.name}: ${problem}`);
      continue;
    }
    let blob: Blob;
    try {
      blob = await shrinkImage(file, 1600, 0.82);
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : "не може да се обработи."}`);
      continue;
    }
    if (blob.size > 5 * 1024 * 1024) {
      errors.push(`${file.name}: над 5 MB.`);
      continue;
    }
    const path = `${conversationId}/${crypto.randomUUID()}.${imageExt(blob)}`;
    const up = await supabase.storage.from("chat-photos").upload(path, blob, { contentType: blob.type });
    if (up.error) errors.push(`${file.name}: не беше качена.`);
    else paths.push(path);
  }
  return { paths, errors };
}

/**
 * Copies a chat photo into the craftsman's public portfolio (work-photos). The caller checks that
 * the craftsman sent it, or that the client agreed. Throws a readable message (e.g. the free-plan limit).
 */
export async function publishToPortfolio(supabase: SupabaseClient, userId: string, chatPath: string) {
  const { data: blob, error: dl } = await supabase.storage.from("chat-photos").download(chatPath);
  if (dl || !blob) throw new Error("Снимката не се зареди.");
  const path = `${userId}/${crypto.randomUUID()}.${imageExt(blob)}`;
  const up = await supabase.storage.from("work-photos").upload(path, blob, { contentType: blob.type });
  if (up.error) throw new Error("Снимката не беше качена в профила.");
  const { count } = await supabase.from("work_photos").select("id", { count: "exact", head: true }).eq("craftsman_id", userId);
  const { error } = await supabase.from("work_photos").insert({ craftsman_id: userId, path, sort: (count ?? 0) + 1 });
  if (error) {
    await supabase.storage.from("work-photos").remove([path]);
    throw new Error(error.message.startsWith("Безплатният план") ? error.message : "Снимката не беше записана в профила.");
  }
}

/** Thumbnails of the photos picked for the next message. */
export function AttachmentStrip({ items, onRemove, busy }: { items: Attachment[]; onRemove: (key: string) => void; busy: boolean }) {
  if (!items.length) return null;
  return (
    <ul className="mx-auto mb-2 flex max-w-2xl gap-2 overflow-x-auto" aria-label="Снимки за изпращане">
      {items.map((a) => (
        <li key={a.key} className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.preview} alt="" className="size-16 rounded-[8px] object-cover ring-1 ring-line" />
          {!busy && (
            <button
              type="button"
              className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-white"
              aria-label="Махни снимката"
              onClick={() => onRemove(a.key)}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
          {busy && <Loader2 className="absolute inset-0 m-auto size-5 animate-spin text-white drop-shadow" aria-hidden />}
        </li>
      ))}
    </ul>
  );
}

export function AttachButton({ onPick, disabled }: { onPick: (files: File[]) => void; disabled: boolean }) {
  return (
    <>
      <input
        id="chat-files"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) onPick(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <label
        htmlFor="chat-files"
        className={`btn btn-outline size-11 shrink-0 cursor-pointer p-0 ${disabled ? "pointer-events-none opacity-50" : ""}`}
        title="Прикачи снимка"
      >
        <ImagePlus className="size-5" aria-hidden />
        <span className="sr-only">Прикачи снимка</span>
      </label>
    </>
  );
}

/** One photo inside a message. The craftsman gets a small action to show it in his profile. */
export function PhotoTile({
  url,
  action,
}: {
  url: string | undefined;
  action?: { label: string; disabled?: boolean; done?: boolean; onClick?: () => void };
}) {
  return (
    <div className="relative">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Отвори снимката">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Снимка в чата" loading="lazy" className="size-32 rounded-[8px] object-cover sm:size-40" />
        </a>
      ) : (
        <div className="skeleton size-32 sm:size-40" aria-label="Снимката се зарежда" />
      )}
      {action && (
        <button
          type="button"
          disabled={action.disabled}
          onClick={action.onClick}
          className="absolute inset-x-1 bottom-1 inline-flex items-center justify-center gap-1 rounded-[6px] bg-ink/85 px-2 py-1 text-xs font-bold text-white backdrop-blur disabled:opacity-70"
        >
          {action.done && <CheckCircle2 className="size-3.5" aria-hidden />}
          {action.label}
        </button>
      )}
    </div>
  );
}
