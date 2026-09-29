"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { checkImage, shrinkImage } from "@/components/image-upload";

export function AvatarUpload({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();

  function onFile(file: File) {
    const problem = checkImage(file, 2);
    if (problem) return void toast.error(problem);
    start(async () => {
      const supabase = createClient();
      const blob = await shrinkImage(file, 512);
      if (blob.size > 2 * 1024 * 1024) return void toast.error("Снимката е твърде голяма (макс. 2 MB).");
      const ext = blob.type === "image/webp" ? "webp" : file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, blob, { contentType: blob.type, upsert: false });
      if (up.error) return void toast.error("Снимката не беше качена. Опитайте с друга.");
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
      if (error) return void toast.error("Снимката не беше записана.");
      toast.success("Снимката е сменена.");
      router.refresh();
    });
  }

  async function remove() {
    const supabase = createClient();
    start(async () => {
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      toast.success("Снимката е премахната.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <Avatar name={name} url={url} size={96} square />
        {pending && <span className="absolute inset-0 animate-pulse rounded-[8px] bg-paper/70" aria-hidden />}
      </div>
      <div className="grid gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id="avatar-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <button type="button" className="btn btn-outline" disabled={pending} onClick={() => input.current?.click()}>
          <Camera className="size-4" aria-hidden /> {pending ? "Качваме…" : url ? "Смени снимката" : "Качи снимка"}
        </button>
        {url && (
          <button type="button" className="text-left text-sm font-semibold text-ink-2 underline" disabled={pending} onClick={remove}>
            Премахни снимката
          </button>
        )}
        <p className="text-sm text-ink-3">JPG, PNG или WEBP, до 2 MB.</p>
      </div>
    </div>
  );
}
