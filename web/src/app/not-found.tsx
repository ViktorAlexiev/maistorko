import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="numerals text-[8rem] leading-none text-red">404</p>
      <h1 className="display mt-2 text-5xl">Тази страница я няма</h1>
      <p className="mx-auto mt-3 max-w-md text-lg text-ink-2">
        Може линкът да е стар или майсторът да е скрил профила си.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link href="/maistori" className="btn btn-primary btn-lg">
          Към майсторите
        </Link>
        <Link href="/" className="btn btn-outline btn-lg">
          Начало
        </Link>
      </div>
    </div>
  );
}
