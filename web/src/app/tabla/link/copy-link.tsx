"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Линкът е копиран.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не успяхме да копираме. Маркирай линка и го копирай ръчно.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input
        readOnly
        value={url}
        aria-label="Твоят личен линк"
        className="field min-w-0 flex-1 font-semibold"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" className="btn btn-primary" onClick={copy}>
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? "Копирано" : "Копирай"}
      </button>
    </div>
  );
}
