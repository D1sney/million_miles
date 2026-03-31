import Image from "next/image";
import type { InventoryCar } from "@/lib/encar";

type CarCardProps = {
  car: InventoryCar;
};

export function CarCard({ car }: CarCardProps) {
  return (
    <article className="card-sheen group flex h-full flex-col overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-paper)] shadow-[var(--shadow-soft)] transition-transform duration-300 hover:-translate-y-1">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#e8dece]">
        <div className="absolute inset-0 bg-gradient-to-t from-black/22 via-transparent to-transparent" />
        <Image
          src={car.imageUrl}
          alt={car.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
            {car.year}
          </span>
          <span className="rounded-full bg-white/88 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink)]">
            {car.fuelType}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">
            {car.brand}
          </p>
          <h3 className="font-display mt-2 text-2xl font-bold uppercase leading-tight text-[var(--color-ink)]">
            {car.model}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            {car.trim}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 border-y border-[var(--color-line)] py-5 text-sm text-[var(--color-muted)]">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.2em]">Mileage</dt>
            <dd className="mt-2 font-semibold text-[var(--color-ink)]">
              {car.mileageLabel}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.2em]">Gearbox</dt>
            <dd className="mt-2 font-semibold text-[var(--color-ink)]">
              {car.transmission}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.2em]">Location</dt>
            <dd className="mt-2 font-semibold text-[var(--color-ink)]">
              {car.location}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.2em]">Dealer</dt>
            <dd className="mt-2 truncate font-semibold text-[var(--color-ink)]">
              {car.dealerName}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex items-end justify-between gap-4 pt-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
              Price
            </p>
            <p className="font-display mt-2 text-2xl font-bold text-[var(--color-accent-strong)]">
              {car.priceLabel}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              {car.sourcePriceLabel}
            </p>
          </div>

          <a
            href={car.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-[#bf9152] bg-[#bf9152] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#151515] transition-all hover:bg-[#cfa169]"
          >
            View on ENCAR
          </a>
        </div>
      </div>
    </article>
  );
}
