import { SITE } from "@/lib/site";
import type { EmailContent } from "./templates";

/**
 * The one email layout, in the site's exercise-book language (docs/DESIGN.md):
 * ink on a white sheet with the pink margin line, on paper. Tables and inline
 * styles because that's what email clients render reliably.
 */

const FONT = "'Atkinson Hyperlegible Next','Atkinson Hyperlegible',Arial,Helvetica,sans-serif";
const C = { paper: "#F5F8FC", sheet: "#FFFFFF", ink: "#15213F", muted: "#5B6784", rule: "#C8D5EA", margin: "#E79AA6" } as const;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const text = (size: number, color: string, extra = "") =>
  `margin:0 0 16px;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color};${extra}`;

function paragraph(value: string, style = text(17, C.ink)): string {
  return `<p style="${style}">${escapeHtml(value)}</p>`;
}

function button(label: string, url: string): string {
  const href = escapeHtml(url);
  return [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;"><tr>`,
    `<td style="background:${C.ink};border-radius:6px;">`,
    `<a href="${href}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:17px;font-weight:700;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>`,
    `</td></tr></table>`,
    `<p style="${text(15, C.muted, "word-break:break-all;")}">If the button doesn't work, copy this address into your browser:<br>${href}</p>`,
  ].join("");
}

export function toHtml(content: EmailContent): string {
  // Inbox previews read on past a short preview line into the body; padding stops that.
  const previewPad = "&#847;&zwnj;&nbsp;".repeat(60);
  const body = [
    paragraph(content.greeting),
    ...content.paragraphs.map((p) => paragraph(p)),
    content.action ? button(content.action.label, content.action.url) : "",
    ...content.smallPrint.map((p) => paragraph(p, text(15, C.muted))),
  ].join("");

  return [
    "<!DOCTYPE html>",
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">',
    `<title>${escapeHtml(content.subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:${C.paper};">`,
    `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.paper};opacity:0;">${escapeHtml(content.preview)}${previewPad}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};"><tr><td align="center" style="padding:32px 16px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">`,
    `<tr><td style="padding:0 0 20px 4px;font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.01em;color:${C.ink};">${escapeHtml(SITE.name)}</td></tr>`,
    `<tr><td style="background:${C.sheet};border:1px solid ${C.rule};border-left:3px solid ${C.margin};padding:32px 32px 16px;">${body}</td></tr>`,
    `<tr><td style="padding:20px 4px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${C.muted};">`,
    `${escapeHtml(`${SITE.name}, ${SITE.tagline.toLowerCase()}`)}<br>${escapeHtml(content.footer)}`,
    `</td></tr></table></td></tr></table></body></html>`,
  ].join("");
}

export function toText(content: EmailContent): string {
  const sections = [
    content.greeting,
    ...content.paragraphs,
    content.action ? `${content.action.label}: ${content.action.url}` : null,
    content.smallPrint.length > 0 ? content.smallPrint.join("\n") : null,
    `--\n${SITE.name}, ${SITE.tagline.toLowerCase()}\n${content.footer}`,
  ];
  return `${sections.filter((s): s is string => s !== null).join("\n\n")}\n`;
}
