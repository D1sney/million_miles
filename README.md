# Million Miles x ENCAR

Next.js каталог автомобилей с данными из ENCAR.

Прод:
- [millon-miles-encar.vercel.app](https://millon-miles-encar.vercel.app)

Что есть сейчас:
- лендинг и каталог на Next.js
- JSON API: `/api/cars`
- пагинация и базовые фильтры
- ежедневный sync на Vercel
- локальный snapshot в `data/cars.json`

## Запуск

```bash
npm install
npm run dev
```

## Полезные команды

```bash
npm run sync:data
npm run validate:data
npm run lint
npm run build
```

## Источник данных

- ENCAR API: `https://api.encar.com/search/car/list/premium`
- ENCAR images: `https://ci.encar.com/carpicture`

## Стек

- Next.js
- TypeScript
- Tailwind CSS
- Vercel
