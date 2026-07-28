import { expect, test, type Page } from '@playwright/test';

/**
 * Systematic UI audit: overflow, overlap, tap targets and contrast, across
 * three widths and both colour modes.
 *
 * Written as checks rather than eyeballing, because "is anything overlapping"
 * is exactly the kind of question that is easy to miss by looking and trivial
 * to answer by measuring.
 */
const SCREENS = ['today', 'train', 'library', 'body', 'coach'] as const;

const NAV: Record<(typeof SCREENS)[number], RegExp> = {
  today: /^(Today|Hoy)$/,
  train: /^(Train|Entrenar)$/,
  library: /^(Find|Buscar)$/,
  body: /^(Body|Cuerpo)$/,
  coach: /^Coach$/,
};

/** 320 is the narrowest phone still in use; 430 is a Pro Max. */
const WIDTHS = [320, 390, 430];
const MIN_TAP = 44;

async function boot(page: Page) {
  await page.goto('/?db=local');
  const name = page.getByLabel('Name');
  if (await name.isVisible().catch(() => false)) {
    await name.fill('Marche');
    await page.getByRole('radio', { name: 'Male', exact: true }).click();
    await page.getByLabel('Birth date').fill('1990-01-01');
    await page.getByLabel('Height').fill('178');
    await page.getByRole('button', { name: /create profile/i }).click();
  }
  await expect(page.getByRole('button', { name: NAV.today })).toBeVisible({ timeout: 20000 });
  await page.waitForSelector('.at-splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

/** Everything measured in one pass in the page, to keep the round-trips down. */
async function audit(page: Page, label: string) {
  return page.evaluate((ctx) => {
    const findings: string[] = [];

    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/[\d.]+/g)?.map(Number) ?? [];
      return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, m[3] ?? 1];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    /** Walks up for the first non-transparent background. */
    const backdrop = (el: Element): number[] => {
      let node: Element | null = el;
      while (node) {
        const [r, g, b, a] = parse(getComputedStyle(node).backgroundColor);
        if (a > 0.5) return [r, g, b];
        node = node.parentElement;
      }
      return [243, 236, 226];
    };

    // 1. Horizontal overflow.
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      findings.push(`overflow-x: page is ${document.documentElement.scrollWidth}px wide in a ${window.innerWidth}px viewport`);
    }
    /** Children of a horizontal scroller are meant to extend past the viewport. */
    const inScroller = (el: Element) => {
      let node: Element | null = el.parentElement;
      while (node && node !== document.body) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
        node = node.parentElement;
      }
      return false;
    };

    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.app-scroll *'))) {
      if (inScroller(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > window.innerWidth + 1) {
        const cls = el.className?.toString().split(' ')[0] ?? el.tagName;
        if (!findings.some(f => f.includes(`bleeds: .${cls}`))) {
          findings.push(`bleeds: .${cls} extends to ${Math.round(r.right)}px past ${window.innerWidth}px`);
        }
      }
    }

    // 2. Content unreachable behind the floating dock.
    //
    // The dock floats over the scrolling body by design, so anything mid-page
    // crosses it geometrically — measuring that flags the whole catalogue. What
    // actually matters is whether the *last* item can be scrolled clear of it,
    // which is a question about bottom padding.
    const dock = document.querySelector('.at-dock')?.getBoundingClientRect();
    const scroller = document.querySelector<HTMLElement>('.app-scroll');
    if (dock && scroller) {
      scroller.scrollTop = scroller.scrollHeight;
      const interactive = Array.from(
        scroller.querySelectorAll<HTMLElement>('button, a, input'),
      ).filter(el => el.getBoundingClientRect().height > 0);
      const last = interactive[interactive.length - 1];
      if (last) {
        const r = last.getBoundingClientRect();
        if (r.bottom > dock.top && r.top < dock.bottom) {
          const cls = last.className?.toString().split(' ')[0] || last.tagName;
          findings.push(`under dock: .${cls} cannot be scrolled clear of the nav`);
        }
      }
      scroller.scrollTop = 0;
    }

    // 3. Tap targets.
    //
    // The body-map regions are excluded: their size is the anatomy they depict,
    // so it cannot be padded without the diagram ceasing to be a body. WCAG
    // 2.5.8 allows this where the presentation is essential, and every muscle is
    // also reachable through the filter chips in the picker.
    const small = new Map<string, number>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], [role="radio"], input'))) {
      if (el.closest('.at-map-region') || el.classList.contains('at-map-region')) continue;
      if (el instanceof SVGElement) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < ctx.minTap || r.height < ctx.minTap) {
        const cls = el.className?.toString().split(' ')[0] || el.tagName.toLowerCase();
        small.set(cls, Math.min(small.get(cls) ?? 99, Math.round(Math.min(r.width, r.height))));
      }
    }
    for (const [cls, size] of small) findings.push(`tap target: .${cls} is ${size}px (min ${ctx.minTap})`);

    // 4. Text contrast.
    const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.app *'))) {
      const text = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent?.trim());
      if (!text) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.opacity === '0') continue;
      // Inactive controls are explicitly out of scope for WCAG 1.4.3.
      if ((el as HTMLButtonElement).disabled || el.closest('button:disabled')) continue;
      const size = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const need = large ? 3 : 4.5;
      const got = ratio(parse(style.color), backdrop(el));
      if (got < need) {
        const cls = el.className?.toString().split(' ')[0] || el.tagName.toLowerCase();
        const key = `${cls}:${Math.round(got * 10)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push(`contrast: .${cls} at ${got.toFixed(2)}:1 (needs ${need}:1, ${Math.round(size)}px)`);
      }
    }

    return findings;
  }, { minTap: MIN_TAP }).then(findings => findings.map(f => `${label} — ${f}`));
}

test('ui audit', async ({ page }) => {
  const all: string[] = [];

  // Boot once. Re-running onboarding per iteration raced the shell: the form is
  // briefly visible before the profile loads, so `isVisible()` won and then the
  // element vanished mid-fill.
  await page.setViewportSize({ width: WIDTHS[1], height: 844 });
  await boot(page);

  for (const mode of ['light', 'dark'] as const) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(m => localStorage.setItem('morphiq_theme', m), mode);
      await page.reload();
      await expect(page.getByRole('button', { name: NAV.today })).toBeVisible({ timeout: 20000 });
      await page.waitForSelector('.at-splash', { state: 'detached', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);

      for (const screen of SCREENS) {
        await page.getByRole('button', { name: NAV[screen] }).click();
        await page.waitForTimeout(screen === 'library' ? 1800 : 400);
        all.push(...await audit(page, `${mode}/${width}/${screen}`));
      }
    }
  }

  const unique = [...new Set(all.map(f => f.replace(/^\S+ — /, '')))].sort();
  console.log(`\n===== ${all.length} findings, ${unique.length} distinct =====`);
  for (const f of unique) console.log('  ' + f);
  console.log('\n----- with context -----');
  for (const f of all.slice(0, 60)) console.log('  ' + f);
});
