import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  exchangeGoogleAuthCode,
  fetchGoogleUserInfo,
  getGoogleRedirectUri,
  googleOAuthConfigured,
} from "@/lib/google-oauth";
import { createSession } from "@/lib/session";

const STATE_COOKIE = "google_oauth_state";

function redirectLogin(req: NextRequest, error: string) {
  return NextResponse.redirect(new URL(`/login?error=${error}`, req.url));
}

export async function GET(req: NextRequest) {
  if (!googleOAuthConfigured()) {
    return redirectLogin(req, "google_config");
  }

  const err = req.nextUrl.searchParams.get("error");
  if (err === "access_denied") {
    return redirectLogin(req, "google_denied");
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectLogin(req, "google_invalid");
  }

  const origin = req.nextUrl.origin;
  const redirectUri = getGoogleRedirectUri(origin);
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!.trim();

  const token = await exchangeGoogleAuthCode({
    code,
    clientId,
    clientSecret,
    redirectUri,
  });
  if (!token) {
    return redirectLogin(req, "google_invalid");
  }

  const profile = await fetchGoogleUserInfo(token.access_token);
  if (!profile || profile.email_verified !== true) {
    return redirectLogin(req, "google_unverified");
  }

  const email = profile.email.trim().toLowerCase();
  const name = (profile.name?.trim() || profile.email.split("@")[0] || "משתמש").slice(0, 120);

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name, passwordHash: null },
    });
  } else if (name && user.name !== name) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name },
    });
  }

  await createSession({ userId: user.id, email: user.email, name: user.name });

  const ok = NextResponse.redirect(new URL("/", req.url));
  ok.cookies.delete(STATE_COOKIE);
  return ok;
}
