import { NextResponse } from "next/server";
import { getSession } from "./session";

export async function requireUser() {
  const session = await getSession();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 }) };
  }
  return { session, response: null as NextResponse | null };
}
