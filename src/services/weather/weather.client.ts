import { env } from '../../config/env';
import { AppError } from '../../types/errors';

const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const WEATHER_UNAVAILABLE_MESSAGE = 'Previsão do tempo indisponível no momento';

export interface OpenWeatherForecastEntry {
  dt_txt: string;
  main: { temp: number };
  weather: Array<{ description: string; icon: string }>;
}

interface OpenWeatherForecastResponse {
  list?: OpenWeatherForecastEntry[];
}

export interface ForecastCoordinates {
  latitude: number;
  longitude: number;
}

export class WeatherClient {
  async getForecast(
    destination: string,
    coordinates?: ForecastCoordinates | null,
  ): Promise<OpenWeatherForecastEntry[]> {
    if (!env.openWeatherApiKey) {
      throw new AppError(WEATHER_UNAVAILABLE_MESSAGE, 503);
    }

    try {
      const response = await fetch(this.buildUrl(destination, coordinates));

      if (!response.ok) {
        throw new AppError(WEATHER_UNAVAILABLE_MESSAGE, 503);
      }

      const data = (await response.json()) as OpenWeatherForecastResponse;
      return data.list ?? [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(WEATHER_UNAVAILABLE_MESSAGE, 503);
    }
  }

  private buildUrl(destination: string, coordinates?: ForecastCoordinates | null): string {
    const params = new URLSearchParams({
      appid: env.openWeatherApiKey,
      units: 'metric',
      lang: 'pt_br',
    });

    // Coordenadas são mais precisas que busca por nome de cidade, que é ambíguo
    // (ex.: "York" pode resolver pra cidade errada). Usamos lat/lon quando a viagem
    // já tem o destino geocodificado; caso contrário caímos no texto como antes.
    if (coordinates) {
      params.set('lat', coordinates.latitude.toString());
      params.set('lon', coordinates.longitude.toString());
    } else {
      params.set('q', destination);
    }

    return `${FORECAST_URL}?${params.toString()}`;
  }
}
