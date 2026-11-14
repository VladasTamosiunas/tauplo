import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { vilniusDateKey } from "../progress/streak";

export type CertificateInput = {
  learnerName: string;
  courseTitle: string;
  issuedAt: Date;
  /** Public certificate code, e.g. TS-4H7K2M9QXB. */
  code: string;
};

const FOREST = rgb(0x0f / 255, 0x3d / 255, 0x2e / 255);
const INK = rgb(0x0f / 255, 0x17 / 255, 0x2a / 255);
const MUTED = rgb(0x47 / 255, 0x55 / 255, 0x69 / 255);
const LINE = rgb(0xe2 / 255, 0xe8 / 255, 0xf0 / 255);
const AMBER = rgb(0xf5 / 255, 0x9e / 255, 0x0b / 255);
const PAPER = rgb(0xf6 / 255, 0xf7 / 255, 0xf4 / 255);

const MONTHS_GENITIVE = [
  "sausio", "vasario", "kovo", "balandžio", "gegužės", "birželio",
  "liepos", "rugpjūčio", "rugsėjo", "spalio", "lapkričio", "gruodžio",
];

/** `2026 m. lapkričio 1 d.` in Vilnius time. */
export function formatLithuanianDate(d: Date): string {
  const [y, m, day] = vilniusDateKey(d).split("-").map(Number);
  return `${y} m. ${MONTHS_GENITIVE[m - 1]} ${day} d.`;
}

let fontBytes: Promise<Buffer> | undefined;
function loadFont(): Promise<Buffer> {
  fontBytes ??= readFile(path.join(process.cwd(), "src", "assets", "fonts", "Geist-Regular.ttf"));
  return fontBytes;
}

/** Keeps only characters the embedded font can draw, so an emoji in a name cannot crash a download. */
function drawable(text: string, font: PDFFont): string {
  const known = new Set(font.getCharacterSet());
  const cleaned = [...text.normalize("NFC")]
    .map((ch) => (known.has(ch.codePointAt(0)!) ? ch : ch.trim() === "" ? " " : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

/** Largest size (down to `min`) at which the text fits `maxWidth`. */
function fitSize(font: PDFFont, text: string, maxWidth: number, start: number, min: number): number {
  let size = start;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

/** Splits text over at most `maxLines` lines no wider than `maxWidth`. The last line ends with "..." if cut. */
function wrap(font: PDFFont, text: string, size: number, maxWidth: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(tryLine, size) <= maxWidth || !line) line = tryLine;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}...`;
  return kept;
}

function centered(page: PDFPage, font: PDFFont, text: string, y: number, size: number, color = INK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (page.getWidth() - w) / 2, y, size, font, color });
}

/** A4 landscape certificate with an embedded font that covers every Lithuanian letter. */
export async function renderCertificate(input: CertificateInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle("Tauplo sertifikatas");
  pdf.setAuthor("Tauplo");
  pdf.setProducer("Tauplo");
  const font = await pdf.embedFont(await loadFont(), { subset: true });

  const page = pdf.addPage([842, 595]);
  const { width: W, height: H } = page.getSize();

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
  page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56, borderColor: FOREST, borderWidth: 3 });
  page.drawRectangle({ x: 38, y: 38, width: W - 76, height: H - 76, borderColor: LINE, borderWidth: 1 });

  // Brand mark
  page.drawRectangle({ x: W / 2 - 17, y: H - 108, width: 34, height: 34, color: FOREST });
  centered(page, font, "T", H - 99, 22, rgb(1, 1, 1));
  centered(page, font, "Tauplo", H - 130, 16, FOREST);

  centered(page, font, "SERTIFIKATAS", H - 190, 34, FOREST);
  page.drawRectangle({ x: W / 2 - 30, y: H - 204, width: 60, height: 3, color: AMBER });

  centered(page, font, "Šis sertifikatas patvirtina, kad", H - 242, 14, MUTED);

  const name = drawable(input.learnerName, font) || "Tauplo mokinys";
  const nameSize = fitSize(font, name, W - 160, 38, 16);
  const shownName = font.widthOfTextAtSize(name, nameSize) > W - 160 ? wrap(font, name, nameSize, W - 160, 1)[0] : name;
  centered(page, font, shownName, H - 292, nameSize, INK);
  page.drawLine({ start: { x: 160, y: H - 304 }, end: { x: W - 160, y: H - 304 }, thickness: 1, color: LINE });

  centered(page, font, "sėkmingai baigė kursą ir išlaikė baigiamąjį testą", H - 334, 14, MUTED);

  const title = drawable(input.courseTitle, font) || "Finansinio raštingumo kursas";
  const titleLines = wrap(font, title, 24, W - 180, 2);
  titleLines.forEach((line, i) => centered(page, font, line, H - 376 - i * 30, 24, FOREST));

  const footY = 92;
  page.drawText("Data", { x: 90, y: footY + 22, size: 11, font, color: MUTED });
  page.drawText(formatLithuanianDate(input.issuedAt), { x: 90, y: footY, size: 14, font, color: INK });

  const codeLabel = "Sertifikato kodas";
  const labelW = font.widthOfTextAtSize(codeLabel, 11);
  const code = drawable(input.code, font);
  const codeW = font.widthOfTextAtSize(code, 14);
  page.drawText(codeLabel, { x: W - 90 - labelW, y: footY + 22, size: 11, font, color: MUTED });
  page.drawText(code, { x: W - 90 - codeW, y: footY, size: 14, font, color: INK });

  centered(page, font, "Tauplo yra mokymo priemonė. Sertifikatas patvirtina kurso baigimą, o ne profesinę kvalifikaciją.", 60, 9.5, MUTED);

  return pdf.save();
}

/** ASCII-only file name, safe in a Content-Disposition header. */
export function certificateFileName(input: CertificateInput): string {
  const code = input.code.replace(/[^A-Za-z0-9-]/g, "");
  return `tauplo-sertifikatas-${code}.pdf`;
}
