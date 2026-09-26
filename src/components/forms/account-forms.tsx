"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { changePasswordAction, setTimeZoneAction, updateProfileAction } from "@/server/actions/account";

export function ProfileForm({ name, bio, showBio }: { name: string; bio: string | null; showBio: boolean }) {
  const [state, action] = useActionState(updateProfileAction, undefined);
  return (
    <form action={action} className="max-w-xl space-y-5">
      <TextField name="name" label="Full name" autoComplete="name" defaultValue={name} required state={state} />
      {showBio ? (
        <TextAreaField name="bio" label="Bio" hint="Shown on your course pages. A couple of sentences about how you teach." rows={4} defaultValue={bio} state={state} />
      ) : (
        <input type="hidden" name="bio" value={bio ?? ""} />
      )}
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="max-w-xl space-y-5">
      <TextField name="currentPassword" type="password" label="Current password" autoComplete="current-password" required state={state} />
      <TextField
        name="newPassword"
        type="password"
        label="New password"
        hint="At least 8 characters, with a letter and a number."
        autoComplete="new-password"
        required
        state={state}
      />
      <TextField name="confirmPassword" type="password" label="Confirm new password" autoComplete="new-password" required state={state} />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
    </form>
  );
}

export function TimeZoneForm({ current, suggested, zones }: { current: string | null; suggested: string; zones: string[] }) {
  const [state, action] = useActionState(setTimeZoneAction, undefined);
  return (
    <form action={action} className="max-w-xl space-y-5">
      <SelectField
        name="timeZone"
        label="Time zone"
        hint={current ? undefined : "Not saved yet. This is our best guess from your browser."}
        options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))}
        defaultValue={current ?? suggested}
        state={state}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save time zone</SubmitButton>
    </form>
  );
}
