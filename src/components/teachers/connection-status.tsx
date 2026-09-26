import { Pill } from "@/components/ui/badges";

const COPY = {
  PENDING: { label: "Waiting for a reply", tone: "warn" },
  ACTIVE: { label: "Working together", tone: "good" },
  DECLINED: { label: "Declined", tone: "bad" },
  ENDED: { label: "Ended", tone: "neutral" },
} as const;

export function ConnectionStatus({ status }: { status: keyof typeof COPY }) {
  return <Pill tone={COPY[status].tone}>{COPY[status].label}</Pill>;
}
