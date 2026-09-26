"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export function PhotoForm({ upload, remove, hasPhoto }: { upload: Action; remove: Action; hasPhoto: boolean }) {
  const [state, uploadAction] = useActionState(upload, undefined);
  const [removeState, removeAction] = useActionState(remove, undefined);
  return (
    <div className="space-y-3">
      <form action={uploadAction} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="photo" className="mb-1 block text-base font-bold text-ink">
            {hasPhoto ? "Change your photo" : "Add a photo"}
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block text-sm text-ink-soft file:mr-3 file:rounded-control file:border file:border-rule file:bg-sheet file:px-3 file:py-2 file:text-sm file:font-bold file:text-ink"
          />
          <p className="mt-1 text-sm text-muted">A clear, friendly photo of your face. JPEG, PNG or WebP, up to 2 MB.</p>
        </div>
        <SubmitButton size="sm" pendingLabel="Uploading…">
          Upload
        </SubmitButton>
      </form>
      <FormMessage state={state} className="text-sm" />
      {hasPhoto ? (
        <form action={removeAction}>
          <SubmitButton variant="quiet" pendingLabel="Removing…">
            Remove photo
          </SubmitButton>
          <FormMessage state={removeState} className="text-sm" />
        </form>
      ) : null}
    </div>
  );
}
