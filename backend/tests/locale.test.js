import { resolveDestination, destinationCountry } from '../utils/locale.js';

describe('resolveDestination', () => {
  it('matches Nigerian cities', () => {
    expect(destinationCountry('Lagos, Nigeria')).toBe('Nigeria');
    expect(destinationCountry('Port Harcourt')).toBe('Nigeria');
    expect(resolveDestination('Abuja, Nigeria').estimate).toBe(false);
  });

  it('matches a neighbour as a labeled estimate', () => {
    const d = resolveDestination('Accra, Ghana');
    expect(d.country).toBe('Ghana');
    expect(d.estimate).toBe(true);
    expect(d.effectiveDutyPct).toBeGreaterThan(0);
    expect(d.contact.protocol).toBeTruthy();
  });

  it('defaults an empty locale to Nigeria (primary market)', () => {
    expect(destinationCountry('')).toBe('Nigeria');
  });

  it('falls back to a generic International estimate for the unknown', () => {
    const d = resolveDestination('Paris, France');
    expect(d.country).toBe('International');
    expect(d.estimate).toBe(true);
  });
});
