type Props = {
  url: string | null;
  role: "student" | "teacher";
  teacherName: string;
  /** "stage" for the dark video area, "paper" everywhere else. */
  tone?: "paper" | "stage";
};

/** The teacher's own meeting link, offered only as a fallback when the room won't connect. */
export function BackupLink({ url, role, teacherName, tone = "paper" }: Props) {
  if (!url) return null;
  const whose = role === "teacher" ? "your" : `${teacherName.split(" ")[0]}’s`;
  const text = tone === "stage" ? "text-paper/75" : "text-muted";
  const link = tone === "stage" ? "text-paper decoration-paper/40 hover:decoration-paper" : "text-ink-soft decoration-rule hover:text-ink";
  return (
    <p className={`text-sm ${text}`}>
      Trouble connecting?{" "}
      <a href={url} target="_blank" rel="noopener noreferrer" className={`font-bold underline underline-offset-4 ${link}`}>
        Use {whose} backup meeting link
      </a>
      .
    </p>
  );
}
