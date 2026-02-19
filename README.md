# connector-ipma

IPMA (Instituto Português do Mar e da Atmosfera) weather data connector for API Aberta.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check |
| GET | `/forecasts` | 5-day forecast for all cities |
| GET | `/forecasts/:cityId` | Forecast for a specific city |
| GET | `/warnings` | Active meteorological warnings |

## Cities

| City | ID |
|------|----|
| Lisboa | 1110600 |
| Porto | 1131200 |
| Faro | 1060600 |
| Braga | 1030300 |
| Coimbra | 1060200 |

## Data Sources

- Forecasts: `https://api.ipma.pt/open-data/forecast/meteorology/cities/daily/{cityId}.json` (every 6h)
- Warnings: `https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json` (every 30min)

## Setup

```bash
npm install
pm2 start ecosystem.config.js
```

## Via API Aberta Gateway

```
GET https://api.apiaberta.pt/v1/ipma/forecasts
GET https://api.apiaberta.pt/v1/ipma/forecasts/1110600
GET https://api.apiaberta.pt/v1/ipma/warnings
```
