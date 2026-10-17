// weather.client.test.ts — RF16, RN08

import { WeatherClient } from '../src/services/weather/weather.client';
import { AppError } from '../src/types/errors';

jest.mock('../src/config/env', () => ({
  env: {
    openWeatherApiKey: 'test-api-key',
  },
}));

describe('WeatherClient', () => {
  const client = new WeatherClient();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retorna a lista de previsões em caso de sucesso', async () => {
    const list = [
      {
        dt_txt: '2026-09-02 12:00:00',
        main: { temp: 24.3 },
        weather: [{ description: 'céu limpo', icon: '01d' }],
      },
    ];
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ list }),
    } as Response);

    const result = await client.getForecast('Santorini, Grécia');

    expect(result).toEqual(list);
  });

  it('monta a URL com destino, unidade métrica e idioma pt-BR', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ list: [] }) } as Response);

    await client.getForecast('Santorini, Grécia');

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'https://api.openweathermap.org/data/2.5/forecast',
    );
    expect(calledUrl.searchParams.get('q')).toBe('Santorini, Grécia');
    expect(calledUrl.searchParams.get('units')).toBe('metric');
    expect(calledUrl.searchParams.get('lang')).toBe('pt_br');
    expect(calledUrl.searchParams.get('appid')).toBe('test-api-key');
  });

  it('monta a URL com lat/lon quando a viagem já tem coordenadas, sem usar o texto do destino', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, json: async () => ({ list: [] }) } as Response);

    await client.getForecast('Santorini, Grécia', { latitude: 36.4071, longitude: 25.4566 });

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get('lat')).toBe('36.4071');
    expect(calledUrl.searchParams.get('lon')).toBe('25.4566');
    expect(calledUrl.searchParams.has('q')).toBe(false);
  });

  it('lança AppError 503 quando a API externa responde com erro (RN08)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);

    await expect(client.getForecast('Cidade Inexistente')).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('lança AppError 503 quando a requisição falha por rede (RN08)', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));

    await expect(client.getForecast('Santorini, Grécia')).rejects.toBeInstanceOf(AppError);
  });

  it('lança AppError 503 sem chamar a API quando não há chave configurada (RN08)', async () => {
    const envModule = jest.requireMock('../src/config/env') as {
      env: { openWeatherApiKey: string };
    };
    const original = envModule.env.openWeatherApiKey;
    envModule.env.openWeatherApiKey = '';
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(client.getForecast('Santorini, Grécia')).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    envModule.env.openWeatherApiKey = original;
  });

  it('retorna lista vazia quando a resposta não possui o campo list', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const result = await client.getForecast('Santorini, Grécia');

    expect(result).toEqual([]);
  });
});
