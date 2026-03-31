# Million Miles x ENCAR

Premium landing page for ENCAR inventory with a daily live sync strategy and a local JSON fallback.

## Scripts

```bash
npm run dev
npm run sync:data
npm run validate:data
npm run check
```

## Data strategy

- Production prefers a live ENCAR API fetch with `revalidate: 86400`.
- Local `data/cars.json` is the fail-safe snapshot and is also exposed through `/api/cars`.
- `scripts/fetch-encar.mjs` refreshes the snapshot from ENCAR.
- `scripts/validate-cars.mjs` checks that the snapshot is non-empty, deduplicated, and structurally sound.

## Source references

- ENCAR search page: `https://www.encar.com/dc/dc_carsearchlist.do?carType=kor`
- ENCAR API: `https://api.encar.com/search/car/list/premium`
- ENCAR image CDN: `https://ci.encar.com/carpicture`
- UX reference: `https://millionmiles.ae/cars`
