"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { LANGUAGES } from "@/lib/languages";
import { SESSION_LENGTHS } from "@/lib/scheduling";
import type { FormState } from "@/lib/validation/form";

type Subject = { id: string; name: string; color: string; topics: { id: string; name: string }[] };

type Profile = {
  headline: string;
  about: string;
  teachingStyle: string | null;
  experienceYears: number | null;
  qualifications: string | null;
  videoUrl: string | null;
  meetingUrl: string | null;
  timeZone: string;
  sessionMinutes: number;
  acceptingStudents: boolean;
  topicIds: string[];
  languageList: string[];
};

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  profile: Profile;
  subjects: Subject[];
  timeZones: string[];
};

function arrayValue(state: FormState, key: string, fallback: string[]): string[] {
  const echoed = state?.values?.[key];
  if (Array.isArray(echoed)) return echoed;
  if (typeof echoed === "string") return [echoed];
  return state?.values ? [] : fallback;
}

function Fieldset({ legend, hint, error, children }: { legend: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-bold text-ink">{legend}</legend>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      {children}
      {error ? <p className="text-sm font-bold text-danger">{error}</p> : null}
    </fieldset>
  );
}

export function TeacherProfileForm({ action, profile, subjects, timeZones }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const topics = new Set(arrayValue(state, "topicIds", profile.topicIds));
  const languages = new Set(arrayValue(state, "languages", profile.languageList));
  const accepting = state?.values ? state.values.acceptingStudents === "on" : profile.acceptingStudents;

  return (
    <form action={formAction} className="max-w-3xl space-y-10">
      <section className="space-y-6">
        <h2 className="text-xl text-ink">Introduce yourself</h2>
        <TextField
          name="headline"
          label="Headline"
          hint="One line students see first, e.g. “Nurse educator who makes dosage calculations click”."
          defaultValue={profile.headline}
          state={state}
        />
        <TextAreaField name="about" label="About you" hint="Who you are, who you teach best, and why you teach. At least 80 characters." rows={7} defaultValue={profile.about} state={state} />
        <TextAreaField name="teachingStyle" label="How you teach (optional)" hint="What a session with you is like." rows={4} defaultValue={profile.teachingStyle} state={state} />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[10rem_1fr]">
          <TextField name="experienceYears" type="number" inputMode="numeric" min={0} max={60} label="Years teaching" defaultValue={profile.experienceYears} state={state} />
          <TextAreaField name="qualifications" label="Qualifications (optional)" rows={3} defaultValue={profile.qualifications} state={state} />
        </div>
        <TextField
          name="videoUrl"
          type="url"
          label="Introduction video (optional)"
          hint="A YouTube or Vimeo link. A short hello helps students choose you."
          defaultValue={profile.videoUrl}
          state={state}
        />
      </section>

      <section className="space-y-6">
        <h2 className="text-xl text-ink">What you teach</h2>
        <Fieldset legend="Topics" hint="Students filter by these. Choose up to 12." error={state?.errors?.topicIds?.[0]}>
          <div className="space-y-4">
            {subjects.map((subject) => (
              <div key={subject.id}>
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-soft">
                  <span aria-hidden="true" className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: subject.color }} />
                  {subject.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {subject.topics.map((topic) => (
                    <label
                      key={topic.id}
                      className="flex cursor-pointer items-center gap-2 rounded-full border border-rule bg-sheet px-3 py-1.5 text-sm text-ink has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-3 has-focus-visible:outline-focus"
                    >
                      <input type="checkbox" name="topicIds" value={topic.id} defaultChecked={topics.has(topic.id)} className="sr-only" />
                      {topic.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Fieldset>
        <Fieldset legend="Languages you teach in" error={state?.errors?.languages?.[0]}>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((language) => (
              <label
                key={language}
                className="flex cursor-pointer items-center gap-2 rounded-full border border-rule bg-sheet px-3 py-1.5 text-sm text-ink has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-3 has-focus-visible:outline-focus"
              >
                <input type="checkbox" name="languages" value={language} defaultChecked={languages.has(language)} className="sr-only" />
                {language}
              </label>
            ))}
          </div>
        </Fieldset>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl text-ink">Sessions</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SelectField
            name="sessionMinutes"
            label="Session length"
            options={SESSION_LENGTHS.map((m) => ({ value: String(m), label: `${m} minutes` }))}
            defaultValue={String(profile.sessionMinutes)}
            state={state}
          />
          <SelectField name="timeZone" label="Your time zone" hint="Your availability is set in this zone." options={timeZones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))} defaultValue={profile.timeZone} state={state} />
        </div>
        <TextField
          name="meetingUrl"
          type="url"
          label="Meeting link"
          hint="Your Zoom, Google Meet or Teams link. Only students with a confirmed session see it."
          defaultValue={profile.meetingUrl}
          placeholder="https://"
          state={state}
        />
        <label className="flex items-start gap-3 text-base text-ink">
          <input type="checkbox" name="acceptingStudents" defaultChecked={accepting} className="mt-1 h-4 w-4 accent-ink" />
          <span>
            <span className="font-bold">Taking new students</span>
            <span className="block text-sm text-muted">Untick to stop new requests. Your current students can still book with you.</span>
          </span>
        </label>
      </section>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}
