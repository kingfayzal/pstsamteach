import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
      <Wordmark />
      <div className="mt-24 max-w-xl space-y-5">
        <p className="hand text-3xl text-danger">Page not found</p>
        <h1 className="text-4xl text-ink">That page doesn&rsquo;t exist, or you don&rsquo;t have access to it.</h1>
        <p className="text-lg text-ink-soft">Check the address, or head back to somewhere you know.</p>
        <div className="flex flex-wrap items-center gap-6">
          <LinkButton href="/">Go to the home page</LinkButton>
          <Link href="/courses" className="text-base font-bold underline decoration-rule underline-offset-4">
            Browse courses
          </Link>
        </div>
      </div>
    </div>
  );
}
