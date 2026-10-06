import { type NextRequest, NextResponse } from "next/server";
import { homePathFor } from "@/lib/routes";
import { getCurrentUser } from "@/server/auth/session";
import { confirmEmail } from "@/server/services/email-confirmation";

/**
 * The link in a confirmation email. Confirming is safe to repeat, so it happens
 * on GET (a mail scanner opening it first does no harm), then sends the person
 * on to their next step: their own dashboard if they're signed in, otherwise to log in.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const result = await confirmEmail(request.nextUrl.searchParams.get("token"));
  const user = await getCurrentUser();
  const target = !result.ok ? "/confirm-email/expired" : user ? `${homePathFor(user)}?notice=email-confirmed` : "/login?notice=email-confirmed";
  const response = NextResponse.redirect(new URL(target, request.url), 303);
  // The token is in this URL: keep it out of caches and referrers.
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
