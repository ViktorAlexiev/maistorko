"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="display text-5xl">Нещо се обърка</h1>
      <p className="mx-auto mt-3 max-w-md text-lg text-ink-2">
        Не успяхме да заредим страницата. Опитайте отново след малко.
      </p>
      <button type="button" className="btn btn-primary btn-lg mt-8" onClick={reset}>
        Опитай отново
      </button>
    </div>
  );
}
