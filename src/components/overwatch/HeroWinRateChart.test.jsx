import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeroWinRateChart from './HeroWinRateChart';

// ResponsiveContainer requires real DOM dimensions; replace it with a passthrough
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
  };
});

const makeHero = (heroKey, heroName, history = []) => ({ heroKey, heroName, history });

describe('HeroWinRateChart', () => {
  it('renders hero name and latest win rate when data is present', () => {
    const hero = makeHero('mercy', 'Mercy', [
      { label: 'Jan 1', winRate: 62.0 },
      { label: 'Jan 2', winRate: 65.0 },
    ]);

    render(<HeroWinRateChart hero={hero} index={0} />);

    expect(screen.getByText('Mercy')).toBeInTheDocument();
    expect(screen.getByText(/65.*win rate/i)).toBeInTheDocument();
  });

  it('shows no-data message when history is empty', () => {
    const hero = makeHero('kiriko', 'Kiriko', []);

    render(<HeroWinRateChart hero={hero} index={0} />);

    expect(screen.getByText('Kiriko')).toBeInTheDocument();
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it('shows no-data message when history is undefined', () => {
    const hero = makeHero('moira', 'Moira');

    render(<HeroWinRateChart hero={hero} index={1} />);

    expect(screen.getByText('Moira')).toBeInTheDocument();
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it('shows em-dash for the win rate when latest value is null', () => {
    const hero = makeHero('ana', 'Ana', [
      { label: 'Jan 1', winRate: null },
    ]);

    render(<HeroWinRateChart hero={hero} index={0} />);

    expect(screen.getByText(/—.*win rate/i)).toBeInTheDocument();
  });

  it('applies known hero color via inline style on the hero name', () => {
    const hero = makeHero('mercy', 'Mercy', [{ label: 'Jan 1', winRate: 60 }]);
    const { container } = render(<HeroWinRateChart hero={hero} index={0} />);

    const label = container.querySelector('.role-chart-label');
    expect(label.style.color).toBe('rgb(0, 191, 255)'); // #00bfff = Mercy blue
  });

  it('falls back to a default color for an unknown hero key', () => {
    const hero = makeHero('unknown_hero', 'Unknown', [{ label: 'Jan 1', winRate: 50 }]);
    const { container } = render(<HeroWinRateChart hero={hero} index={0} />);

    const label = container.querySelector('.role-chart-label');
    // Default colors: ['#7ee8a2', '#ff9c00', '#e040fb'] — index 0 = #7ee8a2
    expect(label.style.color).toBe('rgb(126, 232, 162)');
  });

  it('cycles through default colors based on index', () => {
    const hero = makeHero('unknown_hero', 'Unknown', [{ label: 'Jan 1', winRate: 50 }]);
    const { container } = render(<HeroWinRateChart hero={hero} index={1} />);

    const label = container.querySelector('.role-chart-label');
    // index 1 = #ff9c00
    expect(label.style.color).toBe('rgb(255, 156, 0)');
  });
});
