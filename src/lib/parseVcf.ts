/**
 * vCard import: iOS, Android, Windows, Gmail exports — UTF-8/UTF-16, 2.1/3.0/4.0,
 * grouped properties (ITEM1.TEL), Quoted-Printable names/notes, Android X- fields.
 */

/** Decode file bytes — iPhone/Android may use UTF-16 LE/BE or UTF-8 BOM. */
export function decodeVcfFileBytes(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  if (u8.length === 0) return "";

  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(u8.slice(3));
  }
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(u8.slice(2));
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(u8.slice(2));
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(u8);
}

function unfoldVcfLines(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    if (/^[ \t]/.test(line) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/**
 * Join Quoted-Printable soft line breaks (= at end of line) for FN/N/NOTE etc.
 * Only runs on lines that declare QUOTED-PRINTABLE — avoids corrupting PHOTO base64.
 */
function mergeQpContinuationLines(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    i += 1;
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) {
      out.push(line);
      continue;
    }
    const left = line.slice(0, colonIdx);
    if (!/QUOTED-PRINTABLE/i.test(left)) {
      out.push(line);
      continue;
    }
    while (i < lines.length) {
      const end = line.replace(/\s+$/, "");
      if (!end.endsWith("=") || end.endsWith("==")) break;
      const next = lines[i];
      const nc = next.indexOf(":");
      if (nc > 0 && /^[A-Za-z0-9]/i.test(next) && !/^[ \t]/.test(next)) {
        const firstSeg = next.slice(0, nc).split(";")[0]?.trim() ?? "";
        const looksLikeNewProp =
          /^[A-Za-z][A-Za-z0-9.-]*$/.test(firstSeg) ||
          /^item\d+\.[A-Za-z]/i.test(firstSeg) ||
          /^[A-Za-z][A-Za-z0-9.-]*\.[A-Za-z]/i.test(firstSeg);
        const nextVal = next.slice(nc + 1);
        if (looksLikeNewProp && nextVal !== "" && !/^=\s*$/.test(nextVal) && !nextVal.startsWith("=")) {
          break;
        }
      }
      i += 1;
      line = end.slice(0, -1) + next;
    }
    out.push(line);
  }
  return out;
}

function unescapeVcfValue(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function splitVcardBlocks(text: string): string[] {
  const blocks: string[] = [];
  const re = /\bBEGIN\s*:\s*VCARD\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const fromStart = text.slice(start);
    const endMatch = fromStart.match(/\bEND\s*:\s*VCARD\b/i);
    if (!endMatch || endMatch.index === undefined) break;
    const endExclusive = start + endMatch.index + endMatch[0].length;
    blocks.push(text.slice(start, endExclusive));
    re.lastIndex = endExclusive;
  }
  return blocks;
}

function parseNameFromN(value: string): string {
  const parts = value.split(";");
  const family = (parts[0] ?? "").trim();
  const given = (parts[1] ?? "").trim();
  const extra = (parts[2] ?? "").trim();
  const pieces = [given, extra, family].filter(Boolean);
  return pieces.join(" ").trim() || family || given || "";
}

function basePropertyName(rawPropFirst: string): string {
  const u = rawPropFirst.trim();
  const i = u.lastIndexOf(".");
  return (i >= 0 ? u.slice(i + 1) : u).toUpperCase();
}

function lineProperty(line: string): { rawLeft: string; rawName: string; value: string } | null {
  const idx = line.indexOf(":");
  if (idx <= 0) return null;
  const rawLeft = line.slice(0, idx);
  let value = line.slice(idx + 1).trim();
  const rawName = rawLeft.split(";")[0] ?? "";

  if (/ENCODING=QUOTED-PRINTABLE/i.test(rawLeft) || /QUOTED-PRINTABLE/i.test(rawLeft)) {
    value = decodeQuotedPrintableValue(value);
  } else {
    value = unescapeVcfValue(value);
  }

  return { rawLeft, rawName, value };
}

function decodeQuotedPrintableValue(s: string): string {
  const cleaned = s.replace(/=\r?\n/g, "").replace(/=\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; ) {
    if (cleaned[i] === "=" && i + 2 < cleaned.length && /^[0-9A-Fa-f]{2}$/.test(cleaned.slice(i + 1, i + 3))) {
      bytes.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 3;
    } else if (cleaned[i] === "=") {
      i += 1;
    } else {
      bytes.push(cleaned.charCodeAt(i) & 0xff);
      i += 1;
    }
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
}

function normalizeTelValue(v: string): string {
  const t = v.trim();
  if (t.toLowerCase().startsWith("tel:")) return t.slice(4).trim();
  return t;
}

/** Android exports notes as X-ANDROID-CUSTOM:vnd.android.cursor.item/note;note;<text>;… */
function parseAndroidCustom(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const parts = v.split(";");
  const head = parts[0]?.toLowerCase() ?? "";
  if (head.includes("vnd.android.cursor.item/note")) {
    const text = parts[2]?.trim();
    return text || null;
  }
  return null;
}

const BINARY_SKIP = new Set(["PHOTO", "LOGO", "SOUND", "KEY"]);

export type ParsedVcfContact = {
  name: string;
  phones: string[];
  role: string | null;
  notes: string | null;
};

export function parseVcfText(raw: string): { contact: ParsedVcfContact; cardCount: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let blocks = splitVcardBlocks(trimmed);
  if (blocks.length === 0 && /\b(FN|N|TEL):/i.test(trimmed)) {
    blocks = [trimmed];
  }
  if (blocks.length === 0) return null;

  const firstBlock = blocks[0];

  const lines = mergeQpContinuationLines(unfoldVcfLines(firstBlock));
  const phones: string[] = [];
  const emails: string[] = [];
  const noteParts: string[] = [];
  let fn = "";
  let n = "";
  let title = "";
  let org = "";
  let note = "";

  for (const line of lines) {
    if (!line.trim() || /^BEGIN\s*:\s*VCARD/i.test(line) || /^END\s*:\s*VCARD/i.test(line)) continue;
    const prop = lineProperty(line);
    if (!prop) continue;

    const key0 = prop.rawName.split(";")[0] ?? "";
    const base = basePropertyName(key0);

    if (BINARY_SKIP.has(base)) continue;

    if (base === "TEL") {
      const tv = normalizeTelValue(prop.value);
      if (tv) phones.push(tv);
      continue;
    }

    switch (base) {
      case "FN":
        fn = prop.value;
        break;
      case "N":
        n = prop.value;
        break;
      case "TITLE":
        title = prop.value;
        break;
      case "ORG":
        org = prop.value.replace(/\\,/g, ",").split(";")[0]?.trim() ?? prop.value;
        break;
      case "EMAIL":
        if (prop.value) emails.push(prop.value);
        break;
      case "NOTE":
        note = prop.value;
        break;
      case "ADR":
        noteParts.push(`כתובת: ${prop.value.replace(/;/g, ", ").replace(/,\s*,/g, ",").trim()}`);
        break;
      case "URL":
        noteParts.push(`אתר: ${prop.value}`);
        break;
      case "BDAY":
        noteParts.push(`יום הולדת: ${prop.value}`);
        break;
      case "NICKNAME":
        noteParts.push(`כינוי: ${prop.value}`);
        break;
      default:
        if (base.startsWith("X-ANDROID-CUSTOM") || key0.toUpperCase().startsWith("X-ANDROID-CUSTOM")) {
          const parsed = parseAndroidCustom(prop.value);
          if (parsed) noteParts.push(parsed);
        } else if (base.startsWith("X-") && /NOTE|ANNIVERSARY|RELATION/i.test(base)) {
          if (prop.value) noteParts.push(prop.value);
        }
        break;
    }
  }

  let name = fn.trim() || parseNameFromN(n);
  if (!name.trim()) name = "ללא שם";

  const seen = new Set<string>();
  const uniquePhones = phones.map((p) => p.trim()).filter((p) => {
    const k = p.replace(/\s/g, "");
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let role: string | null = null;
  if (title && org) role = `${title} · ${org}`;
  else if (title) role = title;
  else if (org) role = org;

  if (note) noteParts.unshift(note);
  for (const e of emails) noteParts.push(`דוא״ל: ${e}`);

  const notes = noteParts.length > 0 ? noteParts.join("\n") : null;

  return {
    contact: {
      name,
      phones: uniquePhones,
      role,
      notes,
    },
    cardCount: blocks.length,
  };
}
