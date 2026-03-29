import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GeneratedCV } from "../schemas/generated-cv.js";
import { CV_EXPORTS_DIR } from "./paths.js";

interface PdfLine {
  text: string;
  style?: "normal" | "bold" | "title" | "section" | "spacer";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return [value];
  }
  return [];
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function fixMojibake(value: string): string {
  if (!/[ÃÂâ€™â€œâ€]/.test(value)) return value;

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");
    if (!repaired.includes("\uFFFD")) {
      return repaired;
    }
  } catch {
    // fallback below
  }

  return value
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã«/g, "ë")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã®/g, "î")
    .replace(/Ã¯/g, "ï")
    .replace(/Ã´/g, "ô")
    .replace(/Ã¹/g, "ù")
    .replace(/Ã»/g, "û")
    .replace(/Ã§/g, "ç")
    .replace(/Ã‰/g, "É")
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, "\"")
    .replace(/â€|â€�/g, "\"")
    .replace(/â€“|â€”/g, "-");
}

function normalizeLine(value: string): string {
  return fixMojibake(value)
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapLine(value: string, maxLength: number): string[] {
  const normalized = normalizeLine(value);
  if (!normalized) return [];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLength) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function buildCvLines(cv: GeneratedCV): PdfLine[] {
  const lines: PdfLine[] = [];
  const { header } = cv;

  lines.push({ text: header.fullName, style: "title" });
  if (header.headline) {
    lines.push({ text: header.headline, style: "bold" });
  }

  const contact = [header.contact.email, header.contact.phone, header.contact.location]
    .filter(Boolean)
    .join(" | ");
  if (contact) {
    lines.push({ text: contact, style: "normal" });
  }

  if (header.links) {
    const links = [header.links.linkedin, header.links.portfolio, header.links.github]
      .filter(Boolean)
      .join(" | ");
    if (links) {
      lines.push({ text: links, style: "normal" });
    }
  }

  if (cv.summary) {
    lines.push({ text: "", style: "spacer" });
    lines.push({ text: "RESUME", style: "section" });
    lines.push(...wrapLine(cv.summary, 88).map((text) => ({ text, style: "normal" as const })));
  }

  const skillsHighlighted = toStringArray(cv.skillsHighlighted);
  if (skillsHighlighted.length > 0) {
    lines.push({ text: "", style: "spacer" });
    lines.push({ text: "COMPETENCES", style: "section" });
    lines.push(
      ...wrapLine(skillsHighlighted.join(", "), 88).map((text) => ({
        text,
        style: "normal" as const,
      })),
    );
  }

  const experiencesSelected = Array.isArray(cv.experiencesSelected) ? cv.experiencesSelected : [];
  if (experiencesSelected.length > 0) {
    lines.push({ text: "", style: "spacer" });
    lines.push({ text: "EXPERIENCES", style: "section" });
    for (const experience of experiencesSelected) {
      const experienceId =
        typeof experience?.experienceId === "string" && experience.experienceId.trim()
          ? experience.experienceId.trim()
          : "Experience";

      lines.push({ text: experienceId, style: "bold" });

      for (const bullet of toStringArray(experience?.rewrittenBullets)) {
        lines.push(
          ...wrapLine(`• ${bullet}`, 86).map((text) => ({
            text,
            style: "normal" as const,
          })),
        );
      }
    }
  }

  const educationSelected = toStringArray(cv.educationSelected);
  if (educationSelected.length > 0) {
    lines.push({ text: "", style: "spacer" });
    lines.push({ text: "FORMATION", style: "section" });
    for (const item of educationSelected) {
      lines.push(...wrapLine(`• ${item}`, 86).map((text) => ({ text, style: "normal" as const })));
    }
  }

  const certificationsSelected = toStringArray(cv.certificationsSelected);
  if (certificationsSelected.length > 0) {
    lines.push({ text: "", style: "spacer" });
    lines.push({ text: "CERTIFICATIONS", style: "section" });
    for (const item of certificationsSelected) {
      lines.push(...wrapLine(`• ${item}`, 86).map((text) => ({ text, style: "normal" as const })));
    }
  }

  return lines;
}

function getFont(style: PdfLine["style"]): string {
  return style === "title" || style === "bold" || style === "section" ? "/F2" : "/F1";
}

function getFontSize(style: PdfLine["style"]): number {
  if (style === "title") return 18;
  if (style === "section") return 12.5;
  if (style === "bold") return 11.5;
  return 10.5;
}

function getLineStep(style: PdfLine["style"]): number {
  if (style === "spacer") return 12;
  if (style === "title") return 24;
  if (style === "section") return 18;
  if (style === "bold") return 16;
  return 14;
}

function buildPdf(lines: PdfLine[]): Buffer {
  const pageWidth = 595;
  const pageHeight = 842;
  const left = 44;
  const top = 800;
  const maxLinesPerPage = 44;
  const chunks: PdfLine[][] = [];

  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    chunks.push(lines.slice(i, i + maxLinesPerPage));
  }
  if (chunks.length === 0) chunks.push([{ text: "CV vide", style: "normal" }]);

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  const normalFontObjectId = 3;
  const boldFontObjectId = 4;
  let nextObjectId = 5;

  for (const _pageLines of chunks) {
    pageObjectIds.push(nextObjectId++);
    contentObjectIds.push(nextObjectId++);
  }

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>`;
  objects[3] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  for (let i = 0; i < pageObjectIds.length; i++) {
    objects[pageObjectIds[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${normalFontObjectId} 0 R /F2 ${boldFontObjectId} 0 R >> >> /Contents ${contentObjectIds[i]} 0 R >>`;

    const pageLines = chunks[i];
    const streamLines = ["BT", `${left} ${top} Td`];

    for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
      const lineDef = pageLines[lineIndex];
      const line = escapePdfText(normalizeLine(lineDef.text));
      const font = getFont(lineDef.style);
      const fontSize = getFontSize(lineDef.style);

      if (lineIndex === 0) {
        streamLines.push(`${font} ${fontSize} Tf`);
        streamLines.push(`(${line}) Tj`);
      } else {
        streamLines.push(`0 -${getLineStep(lineDef.style)} Td`);
        streamLines.push(`${font} ${fontSize} Tf`);
        streamLines.push(`(${line}) Tj`);
      }
    }

    streamLines.push("ET");

    const stream = streamLines.join("\n");
    objects[contentObjectIds[i]] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (let i = 1; i < objects.length; i++) {
    if (!objects[i]) continue;
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < objects.length; i++) {
    const offset = offsets[i] ?? 0;
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

export async function exportCvToPdf(
  cv: GeneratedCV,
): Promise<{ filePath: string; buffer: Buffer }> {
  const lines = buildCvLines(cv);
  const buffer = buildPdf(lines);

  await mkdir(CV_EXPORTS_DIR, { recursive: true });
  const filePath = join(CV_EXPORTS_DIR, `${cv.id}.pdf`);
  await writeFile(filePath, buffer);

  return { filePath, buffer };
}
