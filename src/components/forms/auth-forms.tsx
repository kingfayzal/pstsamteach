"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { applyToTeachAction, loginAction, signupAction } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <TextField name="email" type="email" label="Email" autoComplete="email" required state={state} />
      <TextField name="password" type="password" label="Password" autoComplete="current-password" required state={state} />
      <SubmitButton pendingLabel="Logging in…" className="w-full">
        Log in
      </SubmitButton>
      <p className="text-base text-ink-soft">
        New here?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-bold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
          Create a student account
        </Link>
      </p>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signupAction, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <TextField name="name" label="Full name" autoComplete="name" required state={state} />
      <TextField name="email" type="email" label="Email" autoComplete="email" required state={state} />
      <TextField
        name="password"
        type="password"
        label="Password"
        hint="At least 8 characters, with a letter and a number."
        autoComplete="new-password"
        required
        state={state}
      />
      <SubmitButton pendingLabel="Creating your account…" className="w-full">
        Create student account
      </SubmitButton>
      <p className="text-base text-ink-soft">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-bold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
          Log in
        </Link>
      </p>
    </form>
  );
}

export function ApplyForm({ subjects }: { subjects: { id: string; name: string }[] }) {
  const [state, action] = useActionState(applyToTeachAction, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <TextField name="name" label="Full name" autoComplete="name" required state={state} />
      <TextField name="email" type="email" label="Email" autoComplete="email" required state={state} />
      <TextField
        name="password"
        type="password"
        label="Password"
        hint="At least 8 characters, with a letter and a number."
        autoComplete="new-password"
        required
        state={state}
      />
      <SelectField
        name="subjectId"
        label="Subject you want to teach"
        placeholder="Choose a subject"
        options={subjects.map((s) => ({ value: s.id, label: s.name }))}
        required
        state={state}
      />
      <TextAreaField
        name="applicationNote"
        label="Your teaching experience"
        hint="Where you've taught, who you've taught, and any qualifications. Our team reads this before approving you."
        rows={6}
        required
        state={state}
      />
      <SubmitButton pendingLabel="Sending application…" className="w-full">
        Send application
      </SubmitButton>
    </form>
  );
}
