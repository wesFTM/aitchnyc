export type SetupTextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
};

export type SetupDraft = {
  address: string;
  neighborhood: string;
  price: string;
  sqft: string;
  totalSqft: string;
  possession: string;
  terms: string;
  frontage: string;
  ceilingHeight: string;
  description: string;
  neighboringTenants: string;
  keyMoney: string;
};

const HEADER_PHRASES = [
  { label: "approximate size", words: ["APPROXIMATE", "SIZE"] },
  { label: "asking rent", words: ["ASKING", "RENT"] },
  { label: "key money", words: ["KEY", "MONEY"] },
  { label: "ceiling height", words: ["CEILING", "HEIGHT"] },
  { label: "neighboring tenants", words: ["NEIGHBORING", "TENANTS"] },
  { label: "possession", words: ["POSSESSION"] },
  { label: "frontage", words: ["FRONTAGE"] },
  { label: "comments", words: ["COMMENTS"] },
  { label: "neighbors", words: ["NEIGHBORS"] },
  { label: "transportation", words: ["TRANSPORTATION"] },
  { label: "ceiling", words: ["CEILING"] },
  { label: "terms", words: ["TERMS"] },
  { label: "term", words: ["TERM"] },
];

type Line = {
  y: number;
  x: number;
  fontSize: number;
  text: string;
  items: SetupTextItem[];
};

type Header = { label: string; x: number; y: number };

function readable(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s\-])([a-z])/g, (_, gap: string, letter: string) => gap + letter.toUpperCase())
    .replace(/\bFt\b/g, "ft")
    .replace(/\bSf\b/g, "sf");
}

function attachOrdinals(items: SetupTextItem[]) {
  const suffixes = items.filter((item) => /^(st|nd|rd|th)$/i.test(item.str.trim()) && item.fontSize <= 8);
  const rest = items.filter((item) => !suffixes.includes(item)).map((item) => ({ ...item }));
  for (const suffix of suffixes) {
    let best: SetupTextItem | null = null;
    let bestDx = 12;
    for (const item of rest) {
      const dx = suffix.x - (item.x + item.width);
      if (Math.abs(item.y - suffix.y) <= 6 && dx >= -6 && dx < bestDx && /\d$/.test(item.str.trim())) {
        best = item;
        bestDx = dx;
      }
    }
    if (best) best.str = `${best.str.trimEnd()}${suffix.str.trim()}`;
  }
  return rest;
}

function linesFrom(items: SetupTextItem[]): Line[] {
  const sorted = attachOrdinals(items)
    .filter((item) => item.str.trim())
    .sort((left, right) => right.y - left.y || left.x - right.x);
  const groups: SetupTextItem[][] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0].y - item.y) <= 2.5) last.push(item);
    else groups.push([item]);
  }
  return groups.map((group) => {
    const ordered = [...group].sort((left, right) => left.x - right.x);
    let text = "";
    for (const item of ordered) {
      const piece = item.str.trim();
      if (!piece) continue;
      text = text ? `${text} ${piece}` : piece;
    }
    return {
      y: ordered[0].y,
      x: ordered[0].x,
      fontSize: Math.max(...ordered.map((item) => item.fontSize)),
      text: text.replace(/\s+/g, " ").trim(),
      items: ordered,
    };
  });
}

function headersOnLine(line: Line): Header[] {
  const words = line.items.flatMap((item) => {
    const parts = item.str.trim().split(/\s+/).filter(Boolean);
    return parts.map((part, index) => ({
      ...item,
      word: part.toUpperCase().replace(/[^A-Z]/g, ""),
      x: item.x + (item.width * index) / Math.max(parts.length, 1),
    }));
  }).filter((item) => item.word);
  const found: Header[] = [];
  let index = 0;
  while (index < words.length) {
    const phrase = HEADER_PHRASES.find((candidate) =>
      candidate.words.every((word, offset) => words[index + offset]?.word === word),
    );
    if (!phrase) {
      index += 1;
      continue;
    }
    found.push({ label: phrase.label, x: words[index].x, y: line.y });
    index += phrase.words.length;
  }
  return found;
}

function sectionLines(lines: Line[], headers: Header[], label: string) {
  const mine = headers.filter((header) => header.label === label);
  if (mine.length === 0) return [];
  const header = mine[0];
  const row = headers.filter((item) => Math.abs(item.y - header.y) <= 2.5).sort((left, right) => left.x - right.x);
  const below = headers
    .map((item) => item.y)
    .filter((y) => y < header.y - 2.5)
    .sort((left, right) => right - left)[0];
  const columnIndex = row.findIndex((item) => item.label === label && item.x === header.x);
  const leftEdge = columnIndex <= 0 ? -Infinity : row[columnIndex].x - 8;
  const rightEdge = columnIndex >= 0 && row[columnIndex + 1] ? row[columnIndex + 1].x - 8 : Infinity;
  const singleColumn = row.length === 1;
  const items = lines
    .filter((line) => line.y < header.y - 1 && (below == null || line.y > below + 1))
    .flatMap((line) => line.items)
    .filter((item) => singleColumn || (item.x >= leftEdge && item.x < rightEdge));
  return linesFrom(items);
}

function sectionText(lines: Line[], headers: Header[], label: string) {
  return sectionLines(lines, headers, label)
    .map((line) => line.text)
    .filter((text) => text && !/property information/i.test(text))
    .join("\n");
}

function moneyAmounts(text: string) {
  const amounts: number[] = [];
  for (const match of text.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)) {
    amounts.push(Number(match[1].replace(/,/g, "")));
  }
  if (amounts.length > 0) return amounts.filter((amount) => Number.isFinite(amount) && amount > 0);
  for (const match of text.matchAll(/([\d,]{3,})\s*\/\s*month/gi)) {
    amounts.push(Number(match[1].replace(/,/g, "")));
  }
  return amounts.filter((amount) => Number.isFinite(amount) && amount > 0);
}

function dollarInput(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  if (Number.isInteger(amount)) return String(amount);
  return amount.toFixed(2);
}

function askingRent(text: string) {
  const amounts = moneyAmounts(text);
  if (amounts.length === 0) return "";
  const amount = /reduced/i.test(text) && amounts.length > 1 ? amounts[amounts.length - 1] : amounts[0];
  return dollarInput(amount);
}

function reducedRentNote(text: string) {
  const amounts = moneyAmounts(text);
  if (!/reduced/i.test(text) || amounts.length < 2 || amounts[0] === amounts[amounts.length - 1]) return "";
  const previous = amounts[0].toLocaleString("en-US");
  return `Asking rent reduced from $${previous}/month.`;
}

function squareFeet(line: string) {
  const match = /([\d,]{2,})\s*(?:SF|sq\.?\s*ft\.?)\b/i.exec(line);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isInteger(value) || value <= 0 || value > 100000) return null;
  return value;
}

function bulletText(lines: string[]) {
  const points: string[] = [];
  for (const line of lines) {
    const bullet = /^[•·●▪‣\-–—]\s*/.test(line);
    const cleaned = line.replace(/^[•·●▪‣\-–—]\s*/, "").trim();
    if (!cleaned || /property information/i.test(cleaned)) continue;
    if (bullet || points.length === 0) points.push(cleaned);
    else points[points.length - 1] = `${points[points.length - 1]} ${cleaned}`;
  }
  return points.map((point) => `• ${point}`).join("\n");
}

function wrappedText(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !/property information/i.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function infoItems(pages: SetupTextItem[][]) {
  for (const page of pages) {
    const text = page.map((item) => item.str).join(" ").toUpperCase();
    if (text.includes("ASKING RENT") || text.includes("APPROXIMATE SIZE")) return page;
  }
  return pages[0] ?? [];
}

function addressFrom(lines: Line[]) {
  const numberLine = lines.find((line) => line.fontSize >= 28 && /^\d+[A-Za-z]?$/.test(line.text));
  if (numberLine) {
    const after = lines.slice(lines.indexOf(numberLine) + 1);
    const street = after.find((line) => /[A-Za-z]{3}/.test(line.text) && !/\bFOR\s+(LEASE|SALE|RENT)\b/i.test(line.text));
    if (!street) return "";
    return `${numberLine.text} ${readable(street.text)}`;
  }
  const combined = lines.find(
    (line) => line.fontSize >= 12 && line.text.length < 80 && /^\d+\s+[A-Za-z]/.test(line.text),
  );
  return combined ? readable(combined.text) : "";
}

function neighborhoodFrom(lines: Line[]) {
  const line = lines.find((item) => /,\s*NYC\b/i.test(item.text) && item.text.length < 60);
  if (!line) return "";
  return readable(line.text.replace(/,\s*NYC\b.*$/i, ""));
}

function sizesFrom(text: string) {
  let ground: number | null = null;
  let total: number | null = null;
  const areas: number[] = [];
  const notes: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const feet = squareFeet(line);
    if (feet == null) {
      if (!/approximate size/i.test(line)) notes.push(readable(line).replace(/\.$/, ""));
      continue;
    }
    if (/total/i.test(line)) total = feet;
    else if (/ground/i.test(line)) ground = feet;
    areas.push(feet);
  }
  if (ground == null && areas.length > 0) ground = areas[0];
  if (total == null && areas.length > 1) total = areas.reduce((sum, area) => sum + area, 0);
  return {
    sqft: ground == null ? "" : String(ground),
    totalSqft: total == null || total > 100000 ? "" : String(total),
    notes,
  };
}

export function parseMeridianSetup(pages: SetupTextItem[][]): SetupDraft {
  const lines = linesFrom(infoItems(pages));
  const headers = lines.flatMap(headersOnLine);
  const cross = lines.find((line) => /^between\b/i.test(line.text));
  const rentText = sectionText(lines, headers, "asking rent");
  const sizes = sizesFrom(sectionText(lines, headers, "approximate size"));
  const comments = bulletText(sectionLines(lines, headers, "comments").map((line) => line.text));
  const description = [
    cross ? `${readable(cross.text).replace(/\.$/, "")}.` : "",
    reducedRentNote(rentText),
    ...sizes.notes.map((note) => `${note}.`),
    comments,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);
  const rent = askingRent(rentText);
  const keyMoney = askingRent(sectionText(lines, headers, "key money"));

  return {
    address: addressFrom(lines),
    neighborhood: neighborhoodFrom(lines),
    price: rent,
    sqft: sizes.sqft,
    totalSqft: sizes.totalSqft,
    possession: readable(wrappedText(sectionLines(lines, headers, "possession").map((line) => line.text))).slice(0, 200),
    terms: readable(wrappedText(sectionLines(lines, headers, "term").concat(sectionLines(lines, headers, "terms")).map((line) => line.text))).slice(0, 200),
    frontage: readable(wrappedText(sectionLines(lines, headers, "frontage").map((line) => line.text))).slice(0, 80),
    ceilingHeight: readable(
      wrappedText(
        sectionLines(lines, headers, "ceiling height")
          .concat(sectionLines(lines, headers, "ceiling"))
          .map((line) => line.text),
      ),
    ).slice(0, 80),
    description,
    neighboringTenants: wrappedText(sectionLines(lines, headers, "neighbors").concat(sectionLines(lines, headers, "neighboring tenants")).map((line) => line.text)).slice(0, 8000),
    keyMoney,
  };
}
