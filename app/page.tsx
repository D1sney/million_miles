import Link from "next/link";
import { CarCard } from "@/components/car-card";
import { getCatalog, parseCatalogQuery } from "@/lib/data";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const yearOptions = [2025, 2024, 2023, 2022, 2021, 2020, 2018, 2016];
const priceOptions = [
  { label: "Up to 1,500 man-won", value: 1500 },
  { label: "Up to 2,500 man-won", value: 2500 },
  { label: "Up to 4,000 man-won", value: 4000 },
  { label: "Up to 6,000 man-won", value: 6000 },
];

function buildHref(
  query: {
    page: number;
    brand: string;
    fuel: string;
    yearFrom: number;
    maxPriceManWon: number;
  },
  overrides: Partial<{
    page: number;
    brand: string;
    fuel: string;
    yearFrom: number;
    maxPriceManWon: number;
  }>,
) {
  const next = {
    ...query,
    ...overrides,
  };

  const params = new URLSearchParams();
  if (next.page > 1) {
    params.set("page", String(next.page));
  }
  if (next.brand) {
    params.set("brand", next.brand);
  }
  if (next.fuel) {
    params.set("fuel", next.fuel);
  }
  if (next.yearFrom) {
    params.set("yearFrom", String(next.yearFrom));
  }
  if (next.maxPriceManWon) {
    params.set("maxPrice", String(next.maxPriceManWon));
  }

  const queryString = params.toString();
  return queryString ? `/?${queryString}` : "/";
}

export default async function Home({ searchParams }: PageProps) {
  const rawSearchParams = (await searchParams) ?? {};
  const catalog = await getCatalog(parseCatalogQuery(rawSearchParams));
  const { inventory, filters, query, pagination, cars } = catalog;

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
              We now keep a larger locally controlled catalog slice and filter it
              on our side. The JSON API remains visible for technical review, while
              the landing page supports classic catalog browsing with pagination and
              initial filters.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-[var(--shadow-soft)]">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  Visible now
                </p>
                <p className="font-display mt-3 text-3xl font-bold text-[var(--color-ink)]">
                  {cars.length}
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-[var(--shadow-soft)]">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  Synced locally
                </p>
                <p className="font-display mt-3 text-3xl font-bold text-[var(--color-ink)]">
                  {inventory.meta.syncedCount}
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
                MVP+
              </div>
            </div>

            <ul className="mt-5 space-y-4 text-sm leading-7 text-[var(--color-muted)]">
              <li>Daily sync keeps a broader in-app catalog available for browsing.</li>
              <li>Filters now apply to our normalized dataset, not per-click ENCAR calls.</li>
              <li>Pagination keeps the page fast while still exposing many more vehicles.</li>
              <li>The JSON endpoint stays open for technical review and debugging.</li>
            </ul>

            <Link
              href="/api/cars"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-[#bf9152] bg-[#bf9152] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#151515] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cfa169]"
            >
              Open inventory API
            </Link>
          </aside>
        </div>
      </section>

      <section className="pb-8">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">
                Inventory selection
              </p>
              <h2 className="font-display mt-2 text-3xl font-bold uppercase text-[var(--color-ink)] sm:text-4xl">
                Paginated catalog with starter filters
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[var(--color-muted)]">
              Showing page {pagination.page} of {pagination.totalPages} from{" "}
              {pagination.totalFiltered} filtered cars inside our synced catalog.
            </p>
          </div>

          <form
            className="mb-8 grid gap-4 rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-paper)] p-5 shadow-[var(--shadow-soft)] md:grid-cols-4"
            method="get"
          >
            <label className="text-sm text-[var(--color-muted)]">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em]">
                Brand
              </span>
              <select
                name="brand"
                defaultValue={query.brand}
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-[var(--color-ink)] outline-none"
              >
                <option value="">All brands</option>
                {filters.brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--color-muted)]">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em]">
                Fuel
              </span>
              <select
                name="fuel"
                defaultValue={query.fuel}
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-[var(--color-ink)] outline-none"
              >
                <option value="">All fuel types</option>
                {filters.fuels.map((fuel) => (
                  <option key={fuel} value={fuel}>
                    {fuel}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--color-muted)]">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em]">
                Year from
              </span>
              <select
                name="yearFrom"
                defaultValue={query.yearFrom ? String(query.yearFrom) : ""}
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-[var(--color-ink)] outline-none"
              >
                <option value="">Any year</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-[var(--color-muted)]">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em]">
                Max price
              </span>
              <select
                name="maxPrice"
                defaultValue={query.maxPriceManWon ? String(query.maxPriceManWon) : ""}
                className="w-full rounded-2xl border border-[var(--color-line)] bg-white px-4 py-3 text-[var(--color-ink)] outline-none"
              >
                <option value="">Any price</option>
                {priceOptions.map((price) => (
                  <option key={price.value} value={price.value}>
                    {price.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full border border-[#bf9152] bg-[#bf9152] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#151515] transition-all hover:bg-[#cfa169]"
              >
                Apply filters
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-[var(--color-line)] bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-ink)] transition-all hover:border-[var(--color-accent)]"
              >
                Reset
              </Link>
            </div>
          </form>

          {cars.length === 0 ? (
            <div className="rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-paper)] p-10 text-center text-[var(--color-muted)] shadow-[var(--shadow-soft)]">
              No cars matched the selected filters.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {cars.map((car, index) => (
                <div
                  key={car.id}
                  className="fade-up"
                  style={{ animationDelay: `${160 + index * 45}ms` }}
                >
                  <CarCard car={car} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={buildHref(query, { page: Math.max(1, query.page - 1) })}
              aria-disabled={pagination.page <= 1}
              className={`inline-flex min-w-28 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] ${
                pagination.page <= 1
                  ? "pointer-events-none border border-[var(--color-line)] bg-white/70 text-[var(--color-muted)]"
                  : "border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-accent)]"
              }`}
            >
              Previous
            </Link>

            {Array.from({ length: pagination.totalPages }, (_, index) => index + 1)
              .slice(Math.max(0, pagination.page - 3), Math.max(5, pagination.page + 2))
              .map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={buildHref(query, { page: pageNumber })}
                  className={`inline-flex size-12 items-center justify-center rounded-full text-sm font-semibold ${
                    pageNumber === pagination.page
                      ? "bg-[#151515] text-white"
                      : "border border-[var(--color-line)] bg-white text-[var(--color-ink)]"
                  }`}
                >
                  {pageNumber}
                </Link>
              ))}

            <Link
              href={buildHref(query, { page: Math.min(pagination.totalPages, query.page + 1) })}
              aria-disabled={pagination.page >= pagination.totalPages}
              className={`inline-flex min-w-28 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] ${
                pagination.page >= pagination.totalPages
                  ? "pointer-events-none border border-[var(--color-line)] bg-white/70 text-[var(--color-muted)]"
                  : "border border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:border-[var(--color-accent)]"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
