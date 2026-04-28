import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthorizeUrl, getGoogleRedirectUri, googleOAuthConfigured } from "@/lib/google-oauth";

const STATE_COOKIE = "google_oauth_state";

function randomState(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function GET(req: NextRequest) {
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_config", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const redirectUri = getGoogleRedirectUri(req.nextUrl.origin);
  const state = randomState();

  const url = buildGoogleAuthorizeUrl({ clientId, redirectUri, state });
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
