import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { orphanProblems } from './orphans.mjs';

export const viewports = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

export async function renderingProblems(page) {
  const { problems, inline } = await page.evaluate(async () => {
    await document.fonts.ready;
    const problems = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1)
      problems.push(
        `horizontal overflow: page is ${document.documentElement.scrollWidth}px wide in a ${window.innerWidth}px viewport`,
      );
    for (const text of document.querySelectorAll('main svg text')) {
      const bounds = text.getBoundingClientRect();
      const chart = text.ownerSVGElement?.getBoundingClientRect();
      if (
        chart &&
        bounds.width &&
        (bounds.left < chart.left - 1 ||
          bounds.right > chart.right + 1 ||
          bounds.top < chart.top - 1 ||
          bounds.bottom > chart.bottom + 1)
      )
        problems.push(`clipped chart label: “${text.textContent}”`);
    }
    for (const figure of document.querySelectorAll('.experiment-figure')) {
      const outside = figure.getBoundingClientRect();
      for (const label of figure.querySelectorAll('.chart-axis span')) {
        const bounds = label.getBoundingClientRect();
        if (!bounds.width) continue;
        if (
          parseFloat(getComputedStyle(label).fontSize) < 12 ||
          bounds.left < outside.left - 1 ||
          bounds.right > outside.right + 1 ||
          bounds.top < outside.top - 1 ||
          bounds.bottom > outside.bottom + 1
        )
          problems.push(`unreadable chart label: “${label.textContent}”`);
      }
      const ticks = [...figure.querySelectorAll('.chart-x-axis span')]
        .map((label) => label.getBoundingClientRect())
        .filter((bounds) => bounds.width);
      if (
        ticks.some(
          (bounds, index) => index && bounds.left < ticks[index - 1].right,
        )
      )
        problems.push('overlapping chart labels');
      for (const swatch of figure.querySelectorAll('.chart-legend i')) {
        const bar = figure.querySelector(
          `rect.${CSS.escape(swatch.className)}`,
        );
        if (
          !bar ||
          getComputedStyle(bar).fill !==
            getComputedStyle(swatch).backgroundColor ||
          getComputedStyle(bar).opacity !== getComputedStyle(swatch).opacity
        )
          problems.push('chart legend does not match its series');
      }
    }
    // A display formula wider than its box is clipped on screen even when the page
    // itself does not scroll sideways, so check each one.
    for (const el of document.querySelectorAll('.katex-display, .math-block')) {
      if (el.getClientRects().length && el.scrollWidth > el.clientWidth + 1)
        problems.push(
          `clipped display math: ${el.scrollWidth}px formula in a ${el.clientWidth}px box (“${el.textContent.slice(0, 40)}”)`,
        );
    }
    // Each inline formula's width on every line it spans; scripts/orphans.mjs judges them.
    const inline = [...document.querySelectorAll('.math-inline .katex-html')]
      .map((el) => ({
        text: el.textContent,
        widths: [...el.getClientRects()]
          .filter((r) => r.width > 0)
          .map((r) => Math.round(r.width)),
      }))
      .filter((f) => f.widths.length > 1);
    if (document.querySelector('.math-error'))
      problems.push('KaTeX reported invalid mathematics');
    const families = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length || el.closest('.katex')) continue;
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim(),
      );
      if (!own || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      families.add(
        `${cs.fontStyle}|${cs.fontWeight}|${cs.fontFamily.split(',')[0].trim().replace(/"/g, '')}`,
      );
    }
    for (const key of families) {
      const [style, weight, family] = key.split('|');
      if (
        ['Inter', 'Source Serif 4'].includes(family) &&
        !document.fonts.check(`${style} ${weight} 16px "${family}"`)
      )
        problems.push(`font not loaded: ${family} ${weight} ${style}`);
      else if (
        !['Inter', 'Source Serif 4'].includes(family) &&
        family !== 'inherit'
      )
        problems.push(`text uses an unbundled font: ${family}`);
    }
    const used = [...document.fonts]
      .filter((f) => f.status === 'loaded')
      .map((f) => f.family.replace(/"/g, ''));
    if (
      document.querySelector('.katex') &&
      !used.some((f) => f.startsWith('KaTeX'))
    )
      problems.push('KaTeX fonts did not load');
    const rgb = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]) => {
      const f = (raw) => {
        const v = raw / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const background = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== 'none') return null;
        const c = rgb(cs.backgroundColor);
        if (c.length === 3 || (c.length === 4 && c[3] > 0.9))
          return c.slice(0, 3);
      }
      return [255, 255, 255];
    };
    const seen = new Set();
    for (const el of document.querySelectorAll('main *, aside *')) {
      if (el.closest('.katex-mathml, svg, [aria-hidden="true"]')) continue;
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim(),
      );
      if (!own) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (
        r.width === 0 ||
        cs.visibility === 'hidden' ||
        Number(cs.opacity) < 0.5
      )
        continue;
      const bg = background(el);
      if (!bg) continue;
      const fg = rgb(cs.color);
      if (fg.length === 4 && fg[3] < 0.9) continue;
      const [a, b] = [lum(fg.slice(0, 3)), lum(bg)].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      const size = parseFloat(cs.fontSize);
      const large =
        size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) {
        const key = `${cs.color}/${bg}/${el.textContent.trim().slice(0, 30)}`;
        if (!seen.has(key)) {
          seen.add(key);
          problems.push(
            `low contrast ${ratio.toFixed(2)}:1 for “${el.textContent.trim().slice(0, 40)}”`,
          );
        }
      }
    }
    return { problems, inline };
  });
  return [...problems, ...orphanProblems(inline)];
}

export function watchErrors(page, expectedConsole = () => false) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on(
    'console',
    (message) =>
      message.type() === 'error' &&
      !expectedConsole(message) &&
      errors.push(message.text()),
  );
  return errors;
}

export async function capturePage(page, path, selector, beforeCapture) {
  mkdirSync(dirname(path), { recursive: true });
  const region = selector ? page.locator(selector) : page.locator('body');
  const viewport = page.viewportSize();
  const content =
    selector &&
    (await region.evaluate(
      (node) => !!node.closest('main') && !node.closest('.topbar'),
    ));
  if (selector) await region.scrollIntoViewIfNeeded();
  await page.addStyleTag({
    content:
      '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}',
  });
  const chrome =
    selector && !(await region.evaluate((node) => node.closest('.topbar')))
      ? await page.addStyleTag({
          content: '.topbar{visibility:hidden!important}',
        })
      : null;
  try {
    if (content && viewport) {
      const box = await region.boundingBox();
      if (box && box.height + 32 > viewport.height)
        await page.setViewportSize({
          width: viewport.width,
          height: Math.ceil(box.height + 32),
        });
      await region.evaluate((node) =>
        window.scrollTo({
          top: window.scrollY + node.getBoundingClientRect().top - 16,
          behavior: 'instant',
        }),
      );
    }
    await beforeCapture?.();
    if (content && viewport) {
      const visible = await region.boundingBox();
      if (
        !visible ||
        visible.y < -1 ||
        visible.y + visible.height > page.viewportSize().height + 1
      )
        throw new Error(
          `capture region is not fully visible: ${selector} ${JSON.stringify({ visible, viewport: page.viewportSize() })}`,
        );
    }
    if (selector) await region.screenshot({ path, animations: 'disabled' });
    else
      await page.screenshot({ path, fullPage: false, animations: 'disabled' });
  } finally {
    await chrome?.evaluate((node) => node.remove());
    if (viewport) await page.setViewportSize(viewport);
  }
  writeFileSync(
    path.replace(/\.png$/, '.aria.txt'),
    await page.locator('body').ariaSnapshot(),
  );
}

export async function openDetails(page) {
  const closed = page.locator(
    'main details:not(.account-menu):not([open]) > summary',
  );
  const count = await page.locator('main details:not(.account-menu)').count();
  for (let remaining = count; await closed.count(); remaining--) {
    if (remaining <= 0) throw new Error('details did not remain open');
    await closed.first().click();
  }
}
