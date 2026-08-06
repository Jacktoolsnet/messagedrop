export function weatherIconForCode(code?: number): string {
  if (code === undefined) return 'na';

  const icons: Record<number, string> = {
    0: 'day-sunny',
    1: 'day-sunny-overcast',
    2: 'day-cloudy',
    3: 'cloudy',
    45: 'fog',
    48: 'fog',
    51: 'sprinkle',
    53: 'showers',
    55: 'rain-mix',
    56: 'sprinkle',
    57: 'rain-mix',
    61: 'rain',
    63: 'rain',
    65: 'rain-wind',
    66: 'rain',
    67: 'rain-wind',
    71: 'snow',
    73: 'snow',
    75: 'snow-wind',
    77: 'snowflake-cold',
    80: 'showers',
    81: 'showers',
    82: 'rain-wind',
    85: 'snow',
    86: 'snow-wind',
    95: 'thunderstorm',
    96: 'thunderstorm',
    99: 'thunderstorm'
  };

  return icons[code] || 'na';
}
