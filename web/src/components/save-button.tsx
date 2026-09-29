"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleSaved } from "@/app/actions/engage";

export function SaveButton({ craftsmanId, saved, loginHref }: { craftsmanId: string; saved: boolean; loginHref: string }) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, start] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-outline"
      aria-pressed={optimistic}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          const res = await toggleSaved(craftsmanId, !optimistic);
          if (!res.ok) {
            if (res.message === "login") router.push(loginHref);
            else toast.error(res.message);
            return;
          }
          toast.success(!optimistic ? "Запазен в „Моите майстори“" : "Премахнат от запазените");
          router.refresh();
        })
      }
    >
      <Heart className={`size-4 transition-colors ${optimistic ? "fill-red text-red" : ""}`} aria-hidden />
      {optimistic ? "Запазен" : "Запази"}
    </button>
  );
}
