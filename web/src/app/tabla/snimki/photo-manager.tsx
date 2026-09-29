"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { checkImage, shrinkImage } from "@/components/image-upload";
import { EmptyState } from "@/components/bits";

type Photo = { id: string; path: string; caption: string | null; sort: number; url: string };
const MAX = 24;

export function PhotoManager({ userId, initial }: { userId: string; initial: Photo[] }) {
  const supabase = createClient();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(initial);
  const [uploading, setUploading] = useState(0);
  const [, start] = useTransition();

  async function upload(files: FileList) {
    const list = Array.from(files).slice(0, MAX - photos.length);
    if (files.length > list.length) toast.message(`Можете да имате до ${MAX} снимки.`);
    setUploading(list.length);
    for (const file of list) {
      const problem = checkImage(file, 5);
      if (problem) {
        toast.error(`${file.name}: ${problem}`);
        setUploading((n) => n - 1);
        continue;
      }
      const blob = await shrinkImage(file, 1800, 0.82);
      if (blob.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: над 5 MB.`);
        setUploading((n) => n - 1);
        continue;
      }
      const ext = blob.type === "image/webp" ? "webp" : file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("work-photos").upload(path, blob, { contentType: blob.type });
      if (up.error) {
        toast.error(`${file.name}: не беше качена.`);
        setUploading((n) => n - 1);
        continue;
      }
      const { data, error } = await supabase
        .from("work_photos")
        .insert({ craftsman_id: userId, path, sort: photos.length + 1 })
        .select("id, path, caption, sort")
        .single();
      if (error || !data) {
        await supabase.storage.from("work-photos").remove([path]);
        toast.error(`${file.name}: не беше записана.`);
      } else {
        setPhotos((p) => [...p, { ...data, url: supabase.storage.from("work-photos").getPublicUrl(path).data.publicUrl }]);
      }
      setUploading((n) => n - 1);
    }
    router.refresh();
  }

  function remove(p: Photo) {
    start(async () => {
      const { error } = await supabase.from("work_photos").delete().eq("id", p.id);
      if (error) return void toast.error("Снимката не беше изтрита.");
      if (!p.path.startsWith("/")) await supabase.storage.from("work-photos").remove([p.path]);
      setPhotos((xs) => xs.filter((x) => x.id !== p.id));
      toast.success("Снимката е изтрита.");
      router.refresh();
    });
  }

  function saveCaption(p: Photo, caption: string) {
    if ((p.caption ?? "") === caption) return;
    start(async () => {
      const { error } = await supabase.from("work_photos").update({ caption: caption || null }).eq("id", p.id);
      if (error) toast.error("Надписът не беше записан.");
      else {
        setPhotos((xs) => xs.map((x) => (x.id === p.id ? { ...x, caption } : x)));
        toast.success("Надписът е записан.");
      }
    });
  }

  return (
    <div className="grid gap-5">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        id="photo-files"
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={uploading > 0 || photos.length >= MAX} onClick={() => input.current?.click()}>
          <ImagePlus className="size-4" aria-hidden /> {uploading ? `Качваме (${uploading})…` : "Качи снимки"}
        </button>
        <p className="text-sm text-ink-3">
          JPG, PNG или WEBP, до 5 MB всяка. {photos.length}/{MAX}
        </p>
      </div>

      {photos.length === 0 && uploading === 0 ? (
        <EmptyState title="Още нямаш снимки">
          Профилите със снимки от завършени обекти получават повече запитвания. Качи 3–6 снимки.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-[10px] border border-line bg-surface">
              <div className="relative aspect-[4/3] bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption ?? "Снимка от работа"} className="size-full object-cover" loading="lazy" />
                {p.path.startsWith("/demo/") && (
                  <span className="absolute left-2 top-2 rounded bg-ink/75 px-1.5 py-0.5 text-[0.7rem] font-bold text-white">
                    Демо изображение
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 p-2">
                <label htmlFor={`cap-${p.id}`} className="sr-only">
                  Надпис
                </label>
                <input
                  id={`cap-${p.id}`}
                  className="field min-h-10 py-1.5 text-sm"
                  maxLength={140}
                  placeholder="Надпис, напр. „Баня в Лозенец“"
                  defaultValue={p.caption ?? ""}
                  onBlur={(e) => saveCaption(p, e.target.value.trim())}
                />
                <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => remove(p)} aria-label="Изтрий снимката">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <li key={`u${i}`} className="skeleton aspect-[4/3]" aria-label="Качва се" />
          ))}
        </ul>
      )}
    </div>
  );
}
