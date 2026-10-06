import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IsolatedText } from './IsolatedText';

describe('IsolatedText', () => {
  it('wraps numbers and ranges in <bdi> and keeps the text intact', () => {
    const { container } = render(
      <p>
        <IsolatedText text="הטווח הנפוץ הוא 100–150 גר׳ לשבוע, ירידה של 7–10% ומעל 11.4%" />
      </p>,
    );
    expect(container.textContent).toBe(
      'הטווח הנפוץ הוא 100–150 גר׳ לשבוע, ירידה של 7–10% ומעל 11.4%',
    );
    expect([...container.querySelectorAll('bdi')].map((b) => b.textContent)).toEqual([
      '100–150',
      '7–10',
      '11.4',
    ]);
  });

  it('renders text without numbers unchanged', () => {
    const { container } = render(<IsolatedText text="משקל הלידה חזר" />);
    expect(container.innerHTML).toBe('משקל הלידה חזר');
  });
});
