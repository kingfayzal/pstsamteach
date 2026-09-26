import { MarkThreadRead } from "@/components/forms/mark-thread-read";
import { MessageForm } from "@/components/forms/message-form";
import { formatInZone } from "@/lib/time-zones";
import { sendMessageAction } from "@/server/actions/tutoring";

type Message = { id: string; body: string; createdAt: Date; senderId: string; readAt: Date | null };

type Props = {
  connectionId: string;
  messages: Message[];
  viewerId: string;
  otherName: string;
  timeZone: string;
  open: boolean;
  returnTo: string;
};

/** The conversation between a student and their teacher. */
export function MessageThread({ connectionId, messages, viewerId, otherName, timeZone, open, returnTo }: Props) {
  const unread = messages.some((m) => m.senderId !== viewerId && !m.readAt);
  return (
    <div className="space-y-5">
      {unread ? <MarkThreadRead connectionId={connectionId} /> : null}
      {messages.length === 0 ? (
        <p className="text-base text-muted">No messages yet. {open ? `Say hello to ${otherName}.` : ""}</p>
      ) : (
        <ol className="space-y-3" aria-label={`Messages with ${otherName}`}>
          {messages.map((m) => {
            const mine = m.senderId === viewerId;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[34rem] rounded-[6px] px-4 py-2.5 ${mine ? "bg-ink text-paper" : "border border-rule bg-sheet text-ink"}`}>
                  <p className={`text-xs ${mine ? "text-paper/70" : "text-muted"}`}>
                    {mine ? "You" : otherName}, {formatInZone(m.createdAt, timeZone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-base whitespace-pre-line">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {open ? (
        <MessageForm action={sendMessageAction.bind(null, connectionId, returnTo)} otherName={otherName} />
      ) : (
        <p className="text-sm text-muted">This conversation is closed.</p>
      )}
    </div>
  );
}
