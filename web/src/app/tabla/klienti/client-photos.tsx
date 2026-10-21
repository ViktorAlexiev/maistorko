"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { checkImage, imageExt, shrinkImage } from "@/components/image-upload";

type Photo = { id: string; path: string; caption: string | null };

/**
 * Photos on a client's card: the bathroom before the work, the boiler plate, the fault seen at the inspection.
 * They live in a private bucket and only the craftsman who uploaded them can see them.
 */
export function ClientPhotos({ clientId, userId, craftsmanId }: { clientId: string; userId: string; craftsmanId: string }) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("client_photos").select("id, path, caption").eq("client_id", clientId).order("created_at", { ascending: false });
    const list = (data ?? []) as Photo[];
    setPhotos(list);
    if (!list.length) return;
    const { data: signed } = await supabase.storage.from("client-photos").createSignedUrls(list.map((p) => p.path), 3600);
    const next: Record<string, string> = {};
    for (const s of signed ?? []) if (s.path && s.signedUrl) next[s.path] = s.signedUrl;
    setUrls(next);
  }, [supabase, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(files: File[]) {
    setBusy(true);
    for (const file of files.slice(0, 6)) {
      const problem = checkImage(file, 5);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        continue;
      }
      try {
        // re-encoded in the browser: EXIF and GPS are dropped
        const blob = await shrinkImage(file, 1600, 0.82);
        const path = `${userId}/${clientId}/${crypto.randomUUID()}.${imageExt(blob)}`;
        const up = await supabase.storage.from("client-photos").upload(path, blob, { contentType: blob.type });
        if (up.error) throw new Error("не беше качена.");
        const { error } = await supabase.from("client_photos").insert({ client_id: clientId, craftsman_id: craftsmanId, path });
        if (error) {
          await supabase.storage.from("client-photos").remove([path]);
          throw new Error(error.message);
        }
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "не може да се обработи."}`);
      }
    }
    setBusy(false);
    load();
  }

  async function remove(p: Photo) {
    const { error } = await supabase.from("client_photos").delete().eq("id", p.id);
    if (error) return void toast.error("Не успяхме да изтрием.");
    await supabase.storage.from("client-photos").remove([p.path]);
    setPhotos((xs) => xs.filter((x) => x.id !== p.id));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-extrabold">Снимки</h3>
        <label className={`btn btn-outline btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />} Добави снимка
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) upload(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {photos.length === 0 ? (
        <p className="mt-1 text-sm text-ink-3">Още няма снимки. Само ти ги виждаш.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              {urls[p.path] ? (
                <a href={urls[p.path]} target="_blank" rel="noopener noreferrer" aria-label="Отвори снимката">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls[p.path]} alt="Снимка към клиента" loading="lazy" className="size-24 rounded-[8px] object-cover ring-1 ring-line" />
                </a>
              ) : (
                <div className="skeleton size-24" aria-label="Снимката се зарежда" />
              )}
              <button
                type="button"
                onClick={() => remove(p)}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-white"
                aria-label="Изтрий снимката"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
