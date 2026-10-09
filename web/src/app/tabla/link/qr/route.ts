import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getViewer } from "@/lib/auth";
import { siteOrigin } from "@/lib/site-url";

/** Downloadable QR code of the craftsman's own link. ?fmt=png|svg &size=512|1024|2048 */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.craftsmanSlug) return new Response("Нямате профил на майстор.", { status: 403 });

  const url = `${await siteOrigin()}/m/${viewer.craftsmanSlug}?s=qr`;
  const fmt = request.nextUrl.searchParams.get("fmt") === "svg" ? "svg" : "png";
  const wanted = Number(request.nextUrl.searchParams.get("size"));
  const size = [512, 1024, 2048].includes(wanted) ? wanted : 1024;
  const name = `maistorko-${viewer.craftsmanSlug}-qr`;

  if (fmt === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${name}.svg"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const png = await QRCode.toBuffer(url, { width: size, margin: 2, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${name}-${size}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}
