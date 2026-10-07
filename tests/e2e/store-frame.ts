import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// HTML templates for Chrome Web Store / GitHub marketing images. Colors are ADS
// (atlassian-light / atlassian-dark) token values so the frames match the product UI.
const LIGHT = {
  canvas: '#F8F8F8',
  surface: '#FFFFFF',
  tint: '#E9F2FE',
  tintStrong: '#CFE1FD',
  fg: '#292A2E',
  fgMuted: '#505258',
  fgSubtlest: '#6B6E76',
  line: '#0B120E24',
  accent: '#1868DB',
  successBg: '#EFFFD6',
  success: '#4C6B1F',
};
const DARK = {
  canvas: '#18191A',
  surface: '#1F1F21',
  tint: '#1C2B42',
  tintStrong: '#123263',
  fg: '#CECFD2',
  fgMuted: '#A9ABAF',
  fgSubtlest: '#96999E',
  line: '#E3E4F21F',
  accent: '#669DF1',
  successBg: '#28311B',
  success: '#B3DF72',
};
type Theme = typeof LIGHT;

const FONT =
  "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Ubuntu, 'Helvetica Neue', sans-serif";

const svg = (name: string) =>
  readFileSync(resolve(import.meta.dirname, '../../assets/brand', name), 'utf8').replace(
    /<!--[\s\S]*?-->/g,
    '',
  );
const dataUri = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;
const svgUri = (name: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg(name)).toString('base64')}`;

// Shared trust strip. Keep it in sync with the store listing copy.
export const TAGLINE = 'See everything. Touch nothing.';
const TRUST_LINE = 'Free &amp; open source · No server · No tracking · Production-safe';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const check = (c: Theme) =>
  `<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="${c.success}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="7" fill="${c.successBg}" stroke="none"/><path d="m5 8.25 2 2 4-4.5"/></svg>`;

/** A Chrome-style side panel window around a raw panel capture. */
function panelWindow(c: Theme, png: Buffer, width: number) {
  return `
    <div style="width:${width}px;border-radius:12px;overflow:hidden;background:${c.surface};
      box-shadow:0 0 0 1px ${c.line},0 24px 48px -12px #1E1F2140,0 8px 16px -8px #1E1F2126">
      <div style="height:36px;display:flex;align-items:center;gap:8px;padding:0 12px;
        border-bottom:1px solid ${c.line};font-size:13px;font-weight:500;color:${c.fgMuted}">
        <img src="${svgUri('logo-tile.svg')}" width="16" height="16">
        <span style="flex:1">SuiteLens for NetSuite</span>
        <span style="letter-spacing:2px;color:${c.fgSubtlest}">⋮ ✕</span>
      </div>
      <img src="${dataUri(png)}" style="display:block;width:${width}px">
    </div>`;
}

function page(c: Theme, width: number, height: number, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} html,body{margin:0}
    body{width:${width}px;height:${height}px;overflow:hidden;position:relative;background:${c.canvas};
      font-family:${FONT};color:${c.fg};-webkit-font-smoothing:antialiased}
    .lozenge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:12px;line-height:16px;
      font-weight:700;text-transform:uppercase;background:${c.tint};color:${c.accent}}
  </style></head><body>${body}</body></html>`;
}

export type Slide = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  panel: Buffer;
  dark?: boolean;
};

/** 1280×800 store screenshot: copy on the left, the real panel on the right. */
export function slideHtml(slide: Slide) {
  const c = slide.dark ? DARK : LIGHT;
  return page(
    c,
    1280,
    800,
    `
    <div style="position:absolute;right:-180px;top:-160px;width:820px;height:820px;border-radius:50%;background:${c.tint}"></div>
    <div style="position:absolute;right:120px;bottom:-260px;width:520px;height:520px;border-radius:50%;background:${c.tintStrong};opacity:.55"></div>
    <div style="position:absolute;left:88px;top:72px;display:flex;align-items:center;gap:12px">
      <img src="${svgUri('logo-tile.svg')}" width="36" height="36">
      <span style="font-size:18px;font-weight:600">SuiteLens <span style="font-weight:400;color:${c.fgMuted}">for NetSuite</span></span>
    </div>
    <div style="position:absolute;left:88px;top:208px;width:540px">
      <span class="lozenge">${escape(slide.eyebrow)}</span>
      <h1 style="margin:16px 0 0;font-size:44px;line-height:52px;font-weight:650;letter-spacing:-0.5px">${escape(slide.title)}</h1>
      <p style="margin:16px 0 0;font-size:19px;line-height:28px;color:${c.fgMuted}">${escape(slide.body)}</p>
      <ul style="margin:32px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px">
        ${slide.bullets
          .map(
            (b) =>
              `<li style="display:flex;gap:12px;align-items:center;font-size:16px;line-height:24px">${check(c)}<span>${escape(b)}</span></li>`,
          )
          .join('')}
      </ul>
    </div>
    <div style="position:absolute;left:88px;bottom:48px;font-size:13px;color:${c.fgSubtlest}">
      ${TRUST_LINE}
    </div>
    <div style="position:absolute;right:88px;top:56px">${panelWindow(c, slide.panel, 420)}</div>`,
  );
}

/** Small promo tile (440×280) and marquee (1400×560) on the brand-bold background. */
export function promoHtml(kind: 'small' | 'marquee', panel?: Buffer) {
  const small = kind === 'small';
  const [w, h] = small ? [440, 280] : [1400, 560];
  const brand = `
    <div style="display:flex;align-items:center;gap:${small ? 14 : 20}px">
      <img src="${svgUri('logo-tile.svg')}" width="${small ? 56 : 80}" height="${small ? 56 : 80}"
        style="border-radius:${small ? 14 : 20}px;box-shadow:0 0 0 2px #FFFFFF59,0 12px 24px -8px #0000004D">
      <div>
        <div style="font-size:${small ? 30 : 48}px;line-height:1.1;font-weight:700;letter-spacing:-0.5px">SuiteLens</div>
        <div style="font-size:${small ? 15 : 22}px;opacity:.85">for NetSuite</div>
      </div>
    </div>`;
  const subline = small
    ? 'Fields, scripts and SuiteQL beside every record.'
    : 'Field IDs, scripts, workflows and SuiteQL beside any NetSuite record.';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0} body{width:${w}px;height:${h}px;overflow:hidden;position:relative;color:#FFFFFF;
    font-family:${FONT};-webkit-font-smoothing:antialiased;background:linear-gradient(135deg,#1868DB 0%,#144794 100%)}
  </style></head><body>
    <div style="position:absolute;right:${small ? -90 : -120}px;top:${small ? -110 : -200}px;width:${small ? 300 : 640}px;height:${small ? 300 : 640}px;border-radius:50%;background:#FFFFFF14"></div>
    <div style="position:absolute;left:${small ? 32 : 96}px;top:${small ? 48 : 148}px;width:${small ? 380 : 620}px">
      ${brand}
      <p style="margin:${small ? 20 : 32}px 0 0;font-size:${small ? 24 : 40}px;line-height:1.15;font-weight:700;letter-spacing:-0.5px">${TAGLINE}</p>
      <p style="margin:${small ? 6 : 12}px 0 0;font-size:${small ? 15 : 24}px;line-height:1.35;font-weight:500">${subline}</p>
      <p style="margin:${small ? 10 : 20}px 0 0;font-size:${small ? 12 : 16}px;opacity:.8">${small ? 'Free · Open source · No server · Production-safe' : TRUST_LINE}</p>
    </div>
    ${
      panel
        ? `<div style="position:absolute;right:96px;top:56px;width:420px;height:560px;border-radius:12px 12px 0 0;overflow:hidden;box-shadow:0 0 0 1px #FFFFFF33,0 24px 48px -12px #00000066">
            <img src="${dataUri(panel)}" style="display:block;width:420px"></div>`
        : ''
    }
  </body></html>`;
}

/** 1280×640 GitHub social preview. */
export function socialHtml(panel: Buffer) {
  const c = LIGHT;
  return page(
    c,
    1280,
    640,
    `
    <div style="position:absolute;right:-160px;top:-200px;width:760px;height:760px;border-radius:50%;background:${c.tint}"></div>
    <div style="position:absolute;left:88px;top:150px;width:600px">
      <div style="display:flex;align-items:center;gap:20px">
        <img src="${svgUri('logo-tile.svg')}" width="88" height="88">
        <div>
          <div style="font-size:52px;line-height:1.05;font-weight:700;letter-spacing:-0.75px">SuiteLens</div>
          <div style="font-size:24px;color:${c.fgMuted}">for NetSuite</div>
        </div>
      </div>
      <p style="margin:32px 0 0;font-size:28px;line-height:38px;font-weight:500">Understand any NetSuite record without leaving the page.</p>
      <p style="margin:16px 0 0;font-size:18px;color:${c.fgSubtlest}">${TAGLINE} · No server · Open source</p>
    </div>
    <div style="position:absolute;right:88px;top:64px;width:420px;height:576px;border-radius:12px 12px 0 0;overflow:hidden;
      box-shadow:0 0 0 1px ${c.line},0 24px 48px -12px #1E1F2140">
      <img src="${dataUri(panel)}" style="display:block;width:420px"></div>`,
  );
}

export const LINKEDIN = { width: 1080, height: 1350 };

/** Header shared by every LinkedIn carousel page: logo, name and page counter. */
function linkedinHeader(c: Theme, index: number, total: number) {
  return `
    <div style="position:absolute;left:80px;right:80px;top:72px;display:flex;align-items:center;gap:14px">
      <img src="${svgUri('logo-tile.svg')}" width="44" height="44">
      <span style="flex:1;font-size:24px;font-weight:600">SuiteLens <span style="font-weight:400;color:${c.fgMuted}">for NetSuite</span></span>
      <span style="font-size:20px;color:${c.fgSubtlest}">${index} / ${total}</span>
    </div>`;
}

/**
 * 1080×1350 LinkedIn carousel page (4:5 portrait, the feed's largest format): copy on top,
 * the real panel cropped below.
 */
export function linkedinSlideHtml(slide: Slide, index: number, total: number) {
  const c = slide.dark ? DARK : LIGHT;
  return page(
    c,
    LINKEDIN.width,
    LINKEDIN.height,
    `
    <div style="position:absolute;right:-220px;top:-240px;width:760px;height:760px;border-radius:50%;background:${c.tint}"></div>
    ${linkedinHeader(c, index, total)}
    <div style="position:absolute;left:80px;right:80px;top:196px">
      <span class="lozenge" style="font-size:16px;line-height:22px;padding:3px 10px">${escape(slide.eyebrow)}</span>
      <h1 style="margin:20px 0 0;font-size:60px;line-height:68px;font-weight:700;letter-spacing:-1px">${escape(slide.title)}</h1>
      <p style="margin:20px 0 0;font-size:28px;line-height:40px;color:${c.fgMuted}">${escape(slide.body)}</p>
    </div>
    <div style="position:absolute;left:50%;transform:translateX(-50%);top:560px;height:790px;overflow:hidden">
      ${panelWindow(c, slide.panel, 600)}
    </div>`,
  );
}

/** First carousel page: the hook. */
export function linkedinCoverHtml(total: number) {
  const c = LIGHT;
  return page(
    c,
    LINKEDIN.width,
    LINKEDIN.height,
    `
    <div style="position:absolute;inset:0;background:linear-gradient(160deg,#1868DB 0%,#144794 100%)"></div>
    <div style="position:absolute;right:-200px;top:-200px;width:760px;height:760px;border-radius:50%;background:#FFFFFF14"></div>
    <div style="position:absolute;left:80px;right:80px;top:72px;display:flex;justify-content:flex-end;font-size:20px;color:#FFFFFFB3">1 / ${total}</div>
    <div style="position:absolute;left:80px;right:80px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;color:#FFFFFF">
      <img src="${svgUri('logo-tile.svg')}" width="112" height="112"
        style="border-radius:26px;box-shadow:0 0 0 3px #FFFFFF59,0 16px 32px -8px #0000004D">
      <p style="margin:56px 0 0;font-size:30px;font-weight:500;opacity:.85">SuiteLens for NetSuite</p>
      <h1 style="margin:16px 0 0;font-size:96px;line-height:100px;font-weight:800;letter-spacing:-2px">${TAGLINE}</h1>
      <p style="margin:40px 0 0;font-size:34px;line-height:48px;font-weight:500">Field IDs, scripts, workflows and SuiteQL beside any NetSuite record.</p>
      <p style="margin:64px 0 0;font-size:26px;opacity:.8">Swipe →</p>
    </div>
    <div style="position:absolute;left:80px;right:80px;bottom:80px;font-size:24px;color:#FFFFFFCC">Free &amp; open source · No server · No tracking · Production-safe</div>`,
  );
}

/** Trust page: the four trust pillars, worded as in the store listing. */
export function linkedinTrustHtml(index: number, total: number) {
  const c = LIGHT;
  const pillars: [string, string][] = [
    [
      'No server. No account. No tracking.',
      'SuiteLens has no backend and does not collect your data.',
    ],
    [
      'Your session, your role.',
      'It sees only what your NetSuite role already sees. No stored passwords, cookies or tokens.',
    ],
    [
      'Production-safe.',
      'It reads by default. Writes need your confirmation and are blocked on production.',
    ],
    ["Don't trust us. Read the code.", 'MIT licensed: github.com/andynur/suitelens'],
  ];
  return page(
    c,
    LINKEDIN.width,
    LINKEDIN.height,
    `
    <div style="position:absolute;right:-220px;top:-240px;width:760px;height:760px;border-radius:50%;background:${c.tint}"></div>
    ${linkedinHeader(c, index, total)}
    <div style="position:absolute;left:80px;right:80px;top:196px">
      <span class="lozenge" style="font-size:16px;line-height:22px;padding:3px 10px">Is it safe?</span>
      <h1 style="margin:20px 0 0;font-size:60px;line-height:68px;font-weight:700;letter-spacing:-1px">Safe to install on a client's production account.</h1>
      <div style="margin:56px 0 0;display:flex;flex-direction:column;gap:24px">
        ${pillars
          .map(
            ([head, proof]) => `
          <div style="display:flex;gap:24px;padding:28px 32px;border-radius:16px;background:${c.surface};box-shadow:0 0 0 1px ${c.line}">
            <div style="flex:none;transform:scale(1.6);transform-origin:top left;width:32px;height:32px">${check(c)}</div>
            <div>
              <div style="font-size:32px;line-height:40px;font-weight:700">${escape(head)}</div>
              <div style="margin-top:6px;font-size:24px;line-height:34px;color:${c.fgMuted}">${escape(proof)}</div>
            </div>
          </div>`,
          )
          .join('')}
      </div>
    </div>
    <p style="position:absolute;left:80px;right:80px;bottom:72px;margin:0;font-size:22px;line-height:32px;color:${c.fgSubtlest}">AI Assist and the local MCP bridge are optional and send data only after you turn them on and approve it.</p>`,
  );
}

/** Last carousel page: call to action. */
export function linkedinOutroHtml(total: number) {
  const c = LIGHT;
  return page(
    c,
    LINKEDIN.width,
    LINKEDIN.height,
    `
    <div style="position:absolute;inset:0;background:linear-gradient(160deg,#1868DB 0%,#144794 100%)"></div>
    <div style="position:absolute;left:80px;right:80px;top:72px;display:flex;justify-content:flex-end;font-size:20px;color:#FFFFFFB3">${total} / ${total}</div>
    <div style="position:absolute;left:80px;right:80px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;color:#FFFFFF">
      <h1 style="margin:0;font-size:80px;line-height:88px;font-weight:800;letter-spacing:-1.5px">Free. Open source.<br>Yours to audit.</h1>
      <p style="margin:48px 0 0;font-size:34px;line-height:48px;font-weight:500">Search "SuiteLens for NetSuite" in the Chrome Web Store.</p>
      <p style="margin:24px 0 0;font-size:30px;line-height:42px;opacity:.85">github.com/andynur/suitelens</p>
    </div>
    <p style="position:absolute;left:80px;right:80px;bottom:72px;margin:0;font-size:20px;line-height:30px;color:#FFFFFFB3">NetSuite is a trademark of Oracle Corporation. SuiteLens is not affiliated with Oracle.</p>`,
  );
}

/** One document with each rendered carousel page as a full sheet, for the PDF upload. */
export function linkedinPdfHtml(pages: Buffer[]) {
  const { width, height } = LINKEDIN;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:${width}px ${height}px;margin:0} html,body{margin:0}
    img{display:block;width:${width}px;height:${height}px;break-after:page}
  </style></head><body>${pages.map((png) => `<img src="${dataUri(png)}">`).join('')}</body></html>`;
}
