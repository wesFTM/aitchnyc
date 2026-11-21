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
    cross ? `${readable(cross.text).replace(/\s*\|.*$/, "").replace(/\.$/, "")}.` : "",
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

const STREET_SUFFIX = /^(street|st|avenue|ave|boulevard|blvd|place|pl|road|rd|drive|dr|lane|ln|broadway|way|plaza|square|slip|alley)$/i;
const ADDRESS_STOP = new Set([
  "FOR", "LEASE", "SALE", "RENT", "RETAIL", "RESTAURANT", "SPACE", "FLOOR", "PLANS", "PROPERTY", "HIGHLIGHTS",
  "INFORMATION", "ASKING", "SIZE", "COMMENTS", "AVAILABLE", "EXCLUSIVE", "THE", "AND", "NEW", "YORK", "NYC", "NY",
  "CONTACT", "BROKER", "UPON", "REQUEST", "GROUND", "BASEMENT", "TOTAL", "APPROXIMATE",
]);
const NEIGHBORHOODS = [
  "Battery Park City", "Bowery", "Brooklyn Heights", "Carnegie Hill", "Carroll Gardens", "Chelsea", "Chinatown",
  "Civic Center", "Clinton Hill", "Cobble Hill", "Downtown Brooklyn", "DUMBO", "East Harlem", "East Village",
  "Financial District", "Flatiron", "Forest Hills", "Fort Greene", "Gramercy", "Greenpoint", "Greenwich Village",
  "Harlem", "Hell's Kitchen", "Hudson Square", "Hudson Yards", "Inwood", "Kips Bay", "Lenox Hill", "Little Italy",
  "Long Island City", "Lower East Side", "Meatpacking District", "Midtown East", "Midtown West", "Midtown",
  "Murray Hill", "NoHo", "Nolita", "Park Slope", "SoHo", "Times Square", "Tribeca", "Turtle Bay", "Two Bridges",
  "Union Square", "Upper East Side", "Upper West Side", "Washington Heights", "West Village", "Williamsburg",
  "Yorkville",
].sort((left, right) => right.length - left.length);

const FIELD_LABELS: { field: string; pattern: RegExp }[] = [
  { field: "price", pattern: /^(?:asking\s+rent|monthly\s+rent|asking\s+price|price)\b\s*:?\s*(.*)$/i },
  { field: "keyMoney", pattern: /^key\s+money\b\s*:?\s*(.*)$/i },
  { field: "ceilingHeight", pattern: /^ceiling\s+heights?\b\s*:?\s*(.*)$/i },
  { field: "frontage", pattern: /^frontage\b\s*:?\s*(.*)$/i },
  { field: "possession", pattern: /^possession\b\s*:?\s*(.*)$/i },
  { field: "terms", pattern: /^terms?\b\s*:?\s*(.*)$/i },
  { field: "size", pattern: /^(?:approximate\s+size|square\s+footage|size)\b\s*:?\s*(.*)$/i },
  { field: "neighbors", pattern: /^(?:neighboring\s+tenants|neighbors(?:\s+include)?)\b\s*:?\s*(.*)$/i },
  { field: "highlights", pattern: /^(?:property\s+highlights|highlights|comments|description)\b\s*:?\s*(.*)$/i },
  { field: "skip", pattern: /^(?:transportation|contact|contacts|presented\s+by|exclusive)\b/i },
];

function blankDraft(): SetupDraft {
  return {
    address: "",
    neighborhood: "",
    price: "",
    sqft: "",
    totalSqft: "",
    possession: "",
    terms: "",
    frontage: "",
    ceilingHeight: "",
    description: "",
    neighboringTenants: "",
    keyMoney: "",
  };
}

function tidy(value: string) {
  return value.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

function addressScore(address: string) {
  const parts = address.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || !/^\d/.test(parts[0])) return 0;
  let score = parts.length;
  if (parts.some((part) => STREET_SUFFIX.test(part))) score += 4;
  if (parts.length >= 3) score += 2;
  return score;
}

function chooseAddress(primary: string, secondary: string) {
  if (addressScore(secondary) > addressScore(primary)) return secondary;
  return primary || secondary;
}

function clusterAddress(items: SetupTextItem[]) {
  const numbers = items.filter((item) => /^\d{1,5}$/.test(item.str.trim()) && item.fontSize >= 20);
  if (numbers.length === 0) return null;
  numbers.sort((left, right) => right.fontSize - left.fontSize || right.y - left.y);
  const number = numbers[0];
  const words = items
    .filter((item) => {
      if (item === number) return false;
      if (Math.abs(item.y - number.y) > 70 || item.x < number.x - 12 || item.x > number.x + 460) return false;
      if (item.fontSize < 14) return false;
      const word = item.str.trim();
      if (!/^[A-Za-z][A-Za-z'.-]*$/.test(word)) return false;
      return !ADDRESS_STOP.has(word.toUpperCase());
    })
    .sort((left, right) => right.y - left.y || left.x - right.x);
  const kept: string[] = [];
  for (const word of words) {
    kept.push(readable(word.str));
    if (kept.length >= 2 && STREET_SUFFIX.test(word.str)) break;
    if (kept.length >= 4) break;
  }
  if (kept.length === 0) return null;
  return { address: `${number.str.trim()} ${kept.join(" ")}`, fontSize: number.fontSize };
}

function addressCandidates(pages: SetupTextItem[][]) {
  const candidates: { address: string; fontSize: number }[] = [];
  for (const items of pages) {
    const cluster = clusterAddress(items);
    if (cluster) candidates.push(cluster);
    for (const line of linesFrom(items)) {
      if (line.fontSize < 10 || line.text.length > 70) continue;
      const text = tidy(readable(line.text)).replace(/\s*[|,].*$/, "").trim();
      if (addressScore(text) > 0) candidates.push({ address: text, fontSize: line.fontSize });
    }
  }
  candidates.sort((left, right) => addressScore(right.address) - addressScore(left.address) || right.fontSize - left.fontSize);
  return candidates[0]?.address ?? "";
}

function neighborhoodName(lines: Line[]) {
  const nyc = lines.find((line) => /,\s*nyc\b/i.test(line.text) && line.text.length < 80 && line.fontSize >= 8);
  if (nyc) return readable(nyc.text.replace(/,\s*NYC\b.*$/i, ""));
  const short = lines.filter((line) => line.text.length < 90 && line.fontSize >= 7 && !/^[•·●▪‣\-–—]/.test(line.text));
  for (const line of short) {
    for (const name of NEIGHBORHOODS) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|[^A-Za-z])${escaped}\\s*$`, "i").test(line.text)) return name;
    }
  }
  return "";
}

function labelOf(text: string) {
  const cleaned = tidy(text).replace(/^[•·●▪‣\-–—]\s*/, "");
  for (const label of FIELD_LABELS) {
    const match = label.pattern.exec(cleaned);
    if (match) return { field: label.field, value: tidy(match[1] ?? "") };
  }
  return null;
}

function highlightLines(lines: string[]) {
  const points: string[] = [];
  for (const raw of lines) {
    const bullet = /^[•·●▪‣\-–—]/.test(tidy(raw));
    const cleaned = tidy(readable(raw)).replace(/^[•·●▪‣\-–—]\s*/, "");
    if (cleaned.length < 3 || /^neighbors?\b/i.test(cleaned)) continue;
    if (bullet || points.length === 0) points.push(cleaned);
    else points[points.length - 1] = `${points[points.length - 1]} ${cleaned}`;
  }
  return points.map((point) => `• ${point}`).join("\n");
}

function draftFromLines(lines: Line[]): SetupDraft {
  const draft = blankDraft();
  draft.neighborhood = neighborhoodName(lines);
  const sizeLines: string[] = [];
  const highlights: string[] = [];
  let cross = "";
  let rentText = "";
  let collectingSize = false;
  let collectingHighlights = false;

  for (const line of lines) {
    if (line.fontSize > 0 && line.fontSize < 7) continue;
    const label = labelOf(line.text);
    if (label) {
      collectingSize = label.field === "size";
      collectingHighlights = label.field === "highlights";
      if (label.field === "price") rentText = label.value;
      if (label.field === "size" && label.value) sizeLines.push(label.value);
      if (label.field === "neighbors") draft.neighboringTenants = label.value.slice(0, 8000);
      if (label.field === "highlights" && label.value) highlights.push(label.value);
      if (label.field === "possession") draft.possession = readable(label.value).slice(0, 200);
      if (label.field === "terms") draft.terms = readable(label.value).slice(0, 200);
      if (label.field === "frontage") draft.frontage = readable(label.value).slice(0, 80);
      if (label.field === "ceilingHeight" && /\d/.test(label.value)) draft.ceilingHeight = readable(label.value).slice(0, 80);
      if (label.field === "keyMoney") draft.keyMoney = askingRent(label.value);
      continue;
    }
    if (collectingSize && /[\d,]+\s*(?:SF|sq\.?\s*ft)/i.test(line.text)) {
      sizeLines.push(line.text);
      continue;
    }
    collectingSize = false;
    if (collectingHighlights) {
      if (/@|www\.|\(\d{3}\)|\d{3}[-.\s]\d{3}/.test(line.text)) {
        collectingHighlights = false;
        continue;
      }
      highlights.push(line.text);
      continue;
    }
    if (!cross && /^between\b/i.test(line.text)) cross = line.text;
  }

  const sizes = sizesFrom(sizeLines.join("\n"));
  draft.sqft = sizes.sqft;
  draft.totalSqft = sizes.totalSqft;
  draft.price = askingRent(rentText);
  const crossStreet = cross ? `${tidy(readable(cross)).replace(/\s*[|•].*$/, "").replace(/\.$/, "")}.` : "";
  draft.description = [crossStreet, reducedRentNote(rentText), ...sizes.notes.map((note) => `${note}.`), highlightLines(highlights)]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);
  if (/\bSF\b|\bSIZE\b|\bASKING\b/i.test(draft.neighboringTenants)) draft.neighboringTenants = "";
  return draft;
}

function filledScore(draft: SetupDraft) {
  return [draft.price, draft.sqft, draft.possession, draft.frontage, draft.terms, draft.ceilingHeight, draft.keyMoney, draft.neighboringTenants].filter(Boolean).length;
}

function parseGenericFlyer(pages: SetupTextItem[][]): SetupDraft {
  const drafts = pages.map((items) => draftFromLines(linesFrom(items))).sort((left, right) => filledScore(right) - filledScore(left));
  const merged = blankDraft();
  merged.address = addressCandidates(pages);
  for (const draft of drafts) {
    merged.neighborhood ||= draft.neighborhood;
    merged.price ||= draft.price;
    merged.sqft ||= draft.sqft;
    merged.totalSqft ||= draft.totalSqft;
    merged.possession ||= draft.possession;
    merged.terms ||= draft.terms;
    merged.frontage ||= draft.frontage;
    merged.ceilingHeight ||= draft.ceilingHeight;
    merged.keyMoney ||= draft.keyMoney;
    merged.neighboringTenants ||= draft.neighboringTenants;
    if (!merged.description && draft.description) merged.description = draft.description;
  }
  return merged;
}

function spilled(value: string) {
  if (!value) return false;
  const hits = ["SIZE", "FRONTAGE", "ASKING", "POSSESSION", "TRANSPORTATION", "HIGHLIGHTS"].filter((word) =>
    new RegExp(`\\b${word}\\b`, "i").test(value),
  );
  return hits.length >= 2;
}

function comparable(value: string) {
  return value
    .replace(/^•\s*/, "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function mergeDescription(primary: string, extra: string) {
  const base = spilled(primary) ? "" : primary;
  const existing = comparable(base);
  const additions = extra
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      const probe = comparable(line).slice(0, 32);
      return probe.length > 2 && !existing.includes(probe);
    });
  return [base, ...additions].filter(Boolean).join("\n").slice(0, 8000);
}

export function parseListingFlyer(pages: SetupTextItem[][]): SetupDraft {
  const meridian = parseMeridianSetup(pages);
  const generic = parseGenericFlyer(pages);
  return {
    address: chooseAddress(meridian.address, generic.address),
    neighborhood: meridian.neighborhood || generic.neighborhood,
    price: meridian.price || generic.price,
    sqft: meridian.sqft || generic.sqft,
    totalSqft: meridian.totalSqft || generic.totalSqft,
    possession: spilled(meridian.possession) ? generic.possession : meridian.possession || generic.possession,
    terms: spilled(meridian.terms) ? generic.terms : meridian.terms || generic.terms,
    frontage: spilled(meridian.frontage) ? generic.frontage : meridian.frontage || generic.frontage,
    ceilingHeight: spilled(meridian.ceilingHeight) ? generic.ceilingHeight : meridian.ceilingHeight || generic.ceilingHeight,
    description: mergeDescription(meridian.description, generic.description),
    neighboringTenants: spilled(meridian.neighboringTenants) || /\bSF\b|\bSIZE\b/i.test(meridian.neighboringTenants)
      ? generic.neighboringTenants
      : meridian.neighboringTenants || generic.neighboringTenants,
    keyMoney: meridian.keyMoney || generic.keyMoney,
  };
}
