import { MessageCircle } from "lucide-react";

export default function MessagesIndex() {
  return (
    <section className="hidden place-items-center bg-paper p-10 text-center md:grid">
      <div>
        <MessageCircle className="mx-auto size-10 text-ink-3" strokeWidth={1.5} aria-hidden />
        <p className="mt-3 text-lg font-bold">Изберете разговор</p>
        <p className="mt-1 max-w-sm text-ink-2">Тук уточнявате детайлите: дата, адрес, цена. Съобщенията пристигат веднага.</p>
      </div>
    </section>
  );
}
