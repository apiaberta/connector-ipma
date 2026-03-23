# API Aberta — Weather Connector (IPMA)

Microservice that fetches and serves weather data from IPMA (Instituto Português do Mar e da Atmosfera).

## Features

- Daily weather forecasts
- Historical weather data
- Warnings and alerts
- UV index
- Sea conditions

## Endpoints

- `GET /health` — Service health check
- `GET /meta` — Service metadata
- `GET /forecasts` — Weather forecasts by location
- `GET /warnings` — Active weather warnings
- `GET /observations` — Current observations

## Setup

```bash
npm install
cp .env.example .env
npm start
```

## Data Source

Official IPMA API.

## License

MIT
