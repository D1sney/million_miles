import { CarCard } from "@/components/car-card";
import { getInventory } from "@/lib/data";

export default async function Home() {
  const inventory = await getInventory(18);

  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="shell-grid pointer-events-none absolute inset-x-0 top-0 h-[38rem]" />

      <section className="relative border-b border-[var(--color-line)] bg-[#121212] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="font-display text-xl font-bold tracking-[0.28em] uppercase">
              Million Miles
            </p>
            <p className="text-xs uppercase tracking-[0.24em] text-white/60">
              ENCAR-curated inventory
            </p>
          </div>
          <div className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-right text-xs uppercase tracking-[0.22em] text-white/72">
            {inventory.meta.source === "live" ? "Live daily sync" : "Snapshot fallback"}
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-20">
          <div className="fade-up">
            <div className="mb-5 flex flex-wrap gap-3 text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">
              <span className="rounded-full border border-[var(--color-line)] bg-white/70 px-3 py-2">
                Updated every 24 hours
              </span>
              <span className="rounded-full border border-[var(--color-line)] bg-white/70 px-3 py-2">
                Source: ENCAR Korea
              </span>
            </div>

            <h1 className="font-display max-w-4xl text-5xl font-bold uppercase leading-none tracking-[-0.04em] text-[var(--color-ink)] sm:text-6xl lg:text-7xl">
              Korean inventory, staged like a premium boutique showroom.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--color-muted)] sm:text-lg">
              This landing page pairs a dependable ENCAR import pipeline with a
              modern, card-first catalog inspired by Million Miles. The deployed
              build prefers a daily live sync and falls back to a local JSON
              snapshot if the upstream source becomes unavailable.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-[var(--shadow-soft)]">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  Showing now
                </p>
                <p className="font-display mt-3 text-3xl font-bold text-[var(--color-ink)]">
                  {inventory.meta.displayedCount}
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-[var(--shadow-soft)]">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  Source total
                </p>
                <p className="font-display mt-3 text-3xl font-bold text-[var(--color-ink)]">
                  {new Intl.NumberFormat("en-US").format(inventory.meta.sourceCount)}
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-[var(--shadow-soft)]">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  Last sync
                </p>
                <p className="mt-3 text-sm font-semibold text-[var(--color-ink)]">
                  {inventory.meta.fetchedLabel}
                </p>
              </div>
            </div>
          </div>

          <aside className="fade-up rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-paper)] p-6 shadow-[var(--shadow-soft)] [animation-delay:120ms]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">
                  Build principles
                </p>
                <p className="font-display mt-2 text-2xl font-bold uppercase text-[var(--color-ink)]">
                  Fast, inspectable, resilient
                </p>
              </div>
              <div className="rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                MVP
              </div>
            </div>

            <ul className="mt-5 space-y-4 text-sm leading-7 text-[var(--color-muted)]">
              <li>Live ENCAR API integration with typed normalization.</li>
              <li>Local JSON fallback for predictable demos and cold starts.</li>
              <li>Image-first responsive grid styled after premium dealer catalogs.</li>
              <li>Validation script that guards against empty, broken, or duplicate snapshots.</li>
            </ul>

            <a
              href="/api/cars"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--color-ink)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-transform duration-300 hover:-translate-y-0.5"
            >
              Open inventory API
            </a>
          </aside>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">
                Inventory selection
              </p>
              <h2 className="font-display mt-2 text-3xl font-bold uppercase text-[var(--color-ink)] sm:text-4xl">
                Latest imported cars
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[var(--color-muted)]">
              Cards render from the same normalized dataset exposed by the API.
              Price stays faithful to the ENCAR source and is shown in KRW, with
              the original man-won value preserved inside each record.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {inventory.cars.map((car, index) => (
              <div
                key={car.id}
                className="fade-up"
                style={{ animationDelay: `${160 + index * 45}ms` }}
              >
                <CarCard car={car} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
