import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App shell', () => {
  it.each([
    ['', 'מעקב האכלה'],
    ['#/history', 'היסטוריה'],
    ['#/growth', 'גדילה'],
    ['#/stats', 'סטטיסטיקה'],
    ['#/settings', 'הגדרות'],
    ['#/onboarding', 'ברוכים הבאים'],
    ['#/nope', 'מעקב האכלה'],
  ])('route "%s" renders %s', (hash, title) => {
    window.location.hash = hash;
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });
});
