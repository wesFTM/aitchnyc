import type { ListingPdfSource } from "@/lib/listing-pdf-source";

function pdfSafe(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00B7/g, "|")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function wrapText(text: string, widthOf: (line: string) => number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of pdfSafe(text).split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (widthOf(next) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      if (widthOf(word) <= maxWidth) {
        line = word;
        continue;
      }
      let chunk = "";
      for (const character of word) {
        const longer = chunk + character;
        if (widthOf(longer) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = character;
        } else {
          chunk = longer;
        }
      }
      line = chunk;
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function jpegBytes(url: string) {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const maxEdge = 1400;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!jpeg) return null;
    return new Uint8Array(await jpeg.arrayBuffer());
  } catch {
    return null;
  }
}

export async function downloadListingsPdf(listings: ListingPdfSource[], filename: string) {
  if (listings.length === 0) throw new Error("Choose at least one listing.");
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const ink = rgb(0.07, 0.07, 0.07);
  const muted = rgb(0.38, 0.38, 0.38);
  const contact =
    "Hyunhee Fulghum - Lic. Real Estate Salesperson - (718)-288-5882 - hfulghum@findrealestate.com";
  const disclaimer =
    "All information supplied in this marketing presentation and/or flyer is from sources deemed reliable and is furnished subject to errors, omissions, modifications, removal of listings from sale/lease and to any listing condition. Any square footage, dimensions, floor plans and/or technical data set forth are approximations and are subject to further elaboration/ confirmation.";
  const contactSize = 8;
  const disclaimerSize = 6.5;
  const contactLines = wrapText(contact, (line) => bold.widthOfTextAtSize(line, contactSize), contentWidth);
  const disclaimerLines = wrapText(disclaimer, (line) => font.widthOfTextAtSize(line, disclaimerSize), contentWidth + 24);
  const footerBottom = 28;
  const footerHeight =
    footerBottom +
    contactLines.length * (contactSize + 3) +
    6 +
    disclaimerLines.length * (disclaimerSize + 2) +
    14;
  const contentFloor = footerHeight;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function newPage() {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }

  function ensure(height: number) {
    if (y - height < contentFloor) newPage();
  }

  function drawLines(lines: string[], size: number, face: typeof font, color: typeof ink, gap = 4) {
    const lineHeight = size + gap;
    for (const line of lines) {
      ensure(lineHeight);
      if (line) page.drawText(pdfSafe(line), { x: margin, y: y - size, size, font: face, color });
      y -= lineHeight;
    }
  }

  for (let listingIndex = 0; listingIndex < listings.length; listingIndex += 1) {
    if (listingIndex > 0) newPage();
    const listing = listings[listingIndex];
    drawLines(["Aitch NYC"], 10, bold, ink, 6);
    drawLines(wrapText(listing.eyebrow, (line) => font.widthOfTextAtSize(line, 10), contentWidth), 10, font, muted, 8);
    drawLines(wrapText(listing.heading, (line) => bold.widthOfTextAtSize(line, 18), contentWidth), 18, bold, ink, 6);
    drawLines([listing.price], 14, bold, ink, listing.priceNote ? 2 : 8);
    if (listing.priceNote) drawLines([listing.priceNote], 10, font, muted, 6);
    if (listing.neighborhood) {
      drawLines(wrapText(listing.neighborhood, (line) => font.widthOfTextAtSize(line, 11), contentWidth), 11, font, ink, 10);
    }

    const loaded = await Promise.all(listing.imageUrls.slice(0, 4).map((url) => jpegBytes(url)));
    const images: Uint8Array[] = [];
    for (const bytes of loaded) {
      if (bytes) images.push(bytes);
    }
    if (images[0]) {
      try {
        const embedded = await pdf.embedJpg(images[0]);
        const maxHeight = 250;
        const scale = Math.min(contentWidth / embedded.width, maxHeight / embedded.height);
        const width = embedded.width * scale;
        const height = embedded.height * scale;
        ensure(height + 12);
        page.drawImage(embedded, { x: margin, y: y - height, width, height });
        y -= height + 14;
      } catch {
        // Skip a photo that cannot be embedded.
      }
    }
    const thumbs = images.slice(1, 4);
    if (thumbs.length > 0) {
      const gap = 8;
      const thumbWidth = (contentWidth - gap * (thumbs.length - 1)) / thumbs.length;
      const thumbHeight = 78;
      ensure(thumbHeight + 12);
      for (let index = 0; index < thumbs.length; index += 1) {
        try {
          const bytes = thumbs[index];
          if (!bytes) continue;
          const embedded = await pdf.embedJpg(bytes);
          const scale = Math.min(thumbWidth / embedded.width, thumbHeight / embedded.height);
          const width = embedded.width * scale;
          const height = embedded.height * scale;
          page.drawImage(embedded, {
            x: margin + index * (thumbWidth + gap) + (thumbWidth - width) / 2,
            y: y - thumbHeight + (thumbHeight - height) / 2,
            width,
            height,
          });
        } catch {
          // Skip a photo that cannot be embedded.
        }
      }
      y -= thumbHeight + 16;
    }

    const columnWidth = (contentWidth - 12) / 2;
    for (let index = 0; index < listing.facts.length; index += 2) {
      const row = listing.facts.slice(index, index + 2);
      const rowLines = row.map((fact) =>
        wrapText(`${fact.label}: ${fact.value}`, (line) => font.widthOfTextAtSize(line, 10), columnWidth),
      );
      const height = Math.max(...rowLines.map((lines) => lines.length), 1) * 14;
      ensure(height);
      rowLines.forEach((lines, column) => {
        lines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: margin + column * (columnWidth + 12),
            y: y - 10 - lineIndex * 14,
            size: 10,
            font,
            color: ink,
          });
        });
      });
      y -= height + 4;
    }
    y -= 6;

    if (listing.amenities.length > 0) {
      drawLines(
        wrapText(listing.amenities.join("  ·  "), (line) => font.widthOfTextAtSize(line, 10), contentWidth),
        10,
        font,
        ink,
        8,
      );
    }
    if (listing.description) {
      drawLines(wrapText(listing.description, (line) => font.widthOfTextAtSize(line, 11), contentWidth), 11, font, ink, 5);
      y -= 6;
    }
    if (listing.extra) {
      drawLines([listing.extraLabel], 10, bold, muted, 4);
      drawLines(wrapText(listing.extra, (line) => font.widthOfTextAtSize(line, 11), contentWidth), 11, font, ink, 5);
    }
  }

  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    let cursor = footerHeight - 14;
    for (const line of contactLines) {
      const width = bold.widthOfTextAtSize(line, contactSize);
      item.drawText(line, {
        x: (pageWidth - width) / 2,
        y: cursor - contactSize,
        size: contactSize,
        font: bold,
        color: ink,
      });
      cursor -= contactSize + 3;
    }
    cursor -= 4;
    for (const line of disclaimerLines) {
      const width = font.widthOfTextAtSize(line, disclaimerSize);
      item.drawText(line, {
        x: (pageWidth - width) / 2,
        y: cursor - disclaimerSize,
        size: disclaimerSize,
        font,
        color: muted,
      });
      cursor -= disclaimerSize + 2;
    }
    const pageLabel = `${index + 1} / ${pages.length}`;
    item.drawText(pageLabel, {
      x: pageWidth - margin - font.widthOfTextAtSize(pageLabel, 8),
      y: pageHeight - 32,
      size: 8,
      font,
      color: muted,
    });
  });

  pdf.setTitle(filename.replace(/\.pdf$/i, ""));
  const bytes = await pdf.save();
  const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
