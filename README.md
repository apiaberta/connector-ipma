# API Aberta — Weather Connector (IPMA)

Microservice that fetches and serves weather data from IPMA (Instituto Português do Mar e da Atmosfera).

## Features

- Daily weather forecasts
- Historical weather data
- Warnings and alerts
- UV index
- Sea conditions
- Seismic events (Açores, Continente and Madeira)

## Endpoints

- `GET /health` — Service health check
- `GET /ipma/meta` — Service metadata
- `GET /ipma/locations` — Available locations (districts + islands)
- `GET /ipma/forecasts` — Weather forecasts by location
- `GET /ipma/warnings` — Active weather warnings
- `GET /ipma/seismic` — Seismic events (filterable catalogue)
- `GET /ipma/seismic/latest` — Latest event per region
- `GET /ipma/seismic/:id` — Single seismic event

## Seismic events

IPMA only publishes about 30 days of earthquakes; this connector keeps history and refreshes every 10 minutes from:

- `idArea=3` — Açores
- `idArea=7` — Continente + Madeira

`GET /ipma/seismic` query parameters:

| Param | Description |
| --- | --- |
| `region` | `acores` or `continente-madeira` |
| `min_magnitude` | Minimum magnitude |
| `desde` / `ate` | Time window (ISO 8601). Default: last 30 days |
| `sensed` | `true` to keep only events felt by the population |
| `near` | `lat,lon` search centre |
| `radius_km` | Radius around `near` (max 500) |
| `limit` / `offset` | Pagination (default 100, max 1000) |

Attribution: **IPMA**.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

## Data Source

Official IPMA API (`https://api.ipma.pt`). Attribution: IPMA.

## License

MIT
