/**
 * Web Contact Picker API — בחירת איש קשר מהמכשיר (בעיקר Chrome באנדרואיד).
 * Safari באייפון לא חושף API זה לאתרים.
 */

export type PickedContactFields = {
  name: string;
  phones: string[];
  role: string | null;
  notes: string | null;
};

type ContactPickerResult = {
  name?: string[];
  email?: string[];
  tel?: string[];
  address?: string[];
};

type ContactsManagerLike = {
  select(properties: string[], options?: { multiple?: boolean }): Promise<ContactPickerResult[]>;
};

function getContactsManager(): ContactsManagerLike | null {
  const n = navigator as Navigator & { contacts?: ContactsManagerLike };
  return n.contacts ?? null;
}

export function isContactPickerSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof getContactsManager()?.select === "function";
}

/** מחזיר null אם המשתמש ביטל או אין תמיכה. */
export async function pickContactFromDevice(): Promise<PickedContactFields | null> {
  const cm = getContactsManager();
  if (!cm?.select) return null;

  const selected = await cm.select(["name", "tel", "email", "address"], { multiple: false });
  if (!selected?.length) return null;

  const c = selected[0];
  const rawName = (c.name ?? []).map((s: string) => s.trim()).filter(Boolean);
  const name = rawName[0] ?? "ללא שם";

  const phones = (c.tel ?? []).map((s: string) => s.trim()).filter(Boolean);
  const emails = (c.email ?? []).map((s: string) => s.trim()).filter(Boolean);
  const addresses = (c.address ?? []).map((s: string) => s.trim()).filter(Boolean);

  const noteParts: string[] = [];
  for (const e of emails) noteParts.push(`דוא״ל: ${e}`);
  for (const a of addresses) noteParts.push(`כתובת: ${a}`);

  return {
    name,
    phones,
    role: null,
    notes: noteParts.length ? noteParts.join("\n") : null,
  };
}
