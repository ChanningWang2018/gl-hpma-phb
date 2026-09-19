import { describe, expect, it } from 'vitest';
import { ThemeTokens } from '../../src/services/themeTokens.js';

describe('ThemeTokens', () => {
  it('falls back to the paper palette when CSS custom properties are unavailable', () => {
    // jsdom has no stylesheet with our tokens — resolve() must return fallbacks
    const { colors, fonts } = ThemeTokens.resolve();

    expect(colors.paper).toBe('#efe5cf');
    expect(colors.ink).toBe('#2a2118');
    expect(colors.oxblood).toBe('#8a2f2b');
    expect(colors.tealInk).toBe('#1f5f5b');
    expect(colors.goldLeaf).toBe('#b08d3f');

    expect(fonts.serif).toContain('IM Fell English');
    expect(fonts.typewriter).toContain('Special Elite');
  });

  it('caches the resolved tokens until refresh()', () => {
    const first = ThemeTokens.tokens;
    const second = ThemeTokens.tokens;

    expect(second).toBe(first);

    ThemeTokens.refresh();
    const third = ThemeTokens.tokens;
    expect(third).not.toBe(first);
    expect(third.colors).toEqual(first.colors);
  });

  it('converts hex tokens to rgba strings', () => {
    expect(ThemeTokens.withAlpha('#8a2f2b', 0.1)).toBe('rgba(138, 47, 43, 0.1)');
    expect(ThemeTokens.withAlpha('#efe5cf', 0.55)).toBe('rgba(239, 229, 207, 0.55)');
  });

  it('builds shared chart paper fragments from the palette', () => {
    const paper = ThemeTokens.chartPaper();

    expect(paper.grid.color).toContain('rgba(201, 184, 150');
    expect(paper.tooltip.backgroundColor).toBe('#f7f0e1');
    expect(paper.tooltip.titleFont.family).toContain('Special Elite');
    expect(paper.ticks.font.family).toContain('Special Elite');
    expect(paper.scaleBorder).toEqual({ display: false });
  });
});
