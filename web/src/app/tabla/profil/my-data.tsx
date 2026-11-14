import { Download } from "lucide-react";
import { DeleteAccount } from "./delete-account-dialog";

/** GDPR: download everything we hold about you, or delete the account for good (the deleting happens in a popup). */
export function MyData({ forClient = false }: { forClient?: boolean }) {
  return (
    <div className="grid max-w-2xl gap-10">
      <div>
        <h3 className="text-xl font-extrabold">Сваляне на данните</h3>
        <p className="mt-1 text-ink-2">Можеш да свалиш всичко, което пазим за теб, в един файл.</p>
        {/* a plain link: the browser downloads the file */}
        <a href="/tabla/profil/eksport" className="btn btn-outline mt-3" download>
          <Download className="size-4" aria-hidden /> Свали данните ми (JSON)
        </a>
      </div>
      <div>
        <h3 className="text-xl font-extrabold">Изтриване на профила</h3>
        <p className="mt-1 text-ink-2">Профилът и всичко към него се изтрива завинаги. Преди това ще те питаме още веднъж.</p>
        <DeleteAccount forClient={forClient} />
      </div>
    </div>
  );
}
