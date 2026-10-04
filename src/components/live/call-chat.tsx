"use client";

import { useDataChannel } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { type FormEvent, type KeyboardEvent, memo, useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { CallMessage } from "@/lib/live-sessions";
import { formatClock } from "@/lib/time-zones";
import { loadCallMessagesAction, sendCallMessageAction } from "@/server/actions/live-sessions";

/** Only a "something new" ping travels through LiveKit; the message itself is saved and fetched from our server. */
const CHAT_TOPIC = "xcel-chat";
const PING = new Uint8Array([1]);
const LOAD_FAILED = "We couldn't load the chat. Check your internet connection.";
const MIN_REFRESH_GAP_MS = 2_000;

type Props = {
  sessionId: string;
  viewerId: string;
  otherName: string;
  timeZone: string;
  visible: boolean;
  onClose: () => void;
  onUnread: () => void;
};

/** Chat beside the call. It is the pair's normal message thread, so it's still there after the session. */
export const CallChat = memo(function CallChat({ sessionId, viewerId, otherName, timeZone, visible, onClose, onUnread }: Props) {
  const [messages, setMessages] = useState<CallMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [sending, startSending] = useTransition();
  const listRef = useRef<HTMLOListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const visibleRef = useRef(visible);
  const onUnreadRef = useRef(onUnread);
  const newestId = useRef<string | null>(null);
  const announced = useRef(0);
  const loading = useRef(false);
  const loadAgain = useRef(false);
  const firstName = otherName.split(" ")[0];

  useEffect(() => {
    visibleRef.current = visible;
    onUnreadRef.current = onUnread;
  });

  /** Show the thread, and announce a new message from the other person to screen readers. */
  const show = useCallback(
    (latest: CallMessage[]) => {
      setMessages(latest);
      setLoadError(null);
      const newest = latest.at(-1);
      if (!newest || newest.id === newestId.current) return;
      if (newestId.current !== null && newest.senderId !== viewerId) {
        // A trailing space on every other message, so "ok" then "ok" is still a change screen readers announce.
        announced.current += 1;
        setAnnouncement(`${firstName}: ${newest.body}${announced.current % 2 ? " " : ""}`);
      }
      newestId.current = newest.id;
    },
    [viewerId, firstName],
  );

  /**
   * One request at a time, at most every couple of seconds: pings that arrive
   * meanwhile are folded into one more refresh, so a flood of them can't flood the server.
   */
  const refresh = useCallback(async () => {
    if (loading.current) {
      loadAgain.current = true;
      return;
    }
    loading.current = true;
    try {
      do {
        loadAgain.current = false;
        const result = await loadCallMessagesAction(sessionId, true);
        if (!result) return; // Signed out: the page is on its way to the login screen.
        if (result.ok) show(result.messages);
        else setLoadError(result.message);
        if (loadAgain.current) await new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_GAP_MS));
      } while (loadAgain.current);
    } catch {
      setLoadError(LOAD_FAILED);
    } finally {
      loading.current = false;
    }
  }, [sessionId, show]);

  const onPing = useCallback(
    (message: { from?: Participant }) => {
      if (message.from?.isLocal) return;
      if (visibleRef.current) void refresh();
      else onUnreadRef.current();
    },
    [refresh],
  );
  const { send } = useDataChannel(CHAT_TOPIC, onPing);

  // Opening the panel loads the thread and marks the other person's messages read. With a keyboard the
  // cursor goes in the box; on a touch screen focus goes to the heading, so reading doesn't pop the keyboard up.
  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia("(pointer: fine)").matches) textareaRef.current?.focus();
    else headingRef.current?.focus();
    let current = true;
    loadCallMessagesAction(sessionId, true).then(
      (result) => {
        if (!current || !result) return;
        if (result.ok) show(result.messages);
        else setLoadError(result.message);
      },
      () => {
        if (current) setLoadError(LOAD_FAILED);
      },
    );
    return () => {
      current = false;
    };
  }, [visible, sessionId, show]);

  // Keep the newest message in view, scrolling the list rather than the page.
  useEffect(() => {
    const list = listRef.current;
    if (visible && list) list.scrollTop = list.scrollHeight;
  }, [messages, visible]);

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    startSending(async () => {
      try {
        const result = await sendCallMessageAction(sessionId, body);
        if (!result) return;
        if (!result.ok) {
          setSendError(result.message);
          return;
        }
        setSendError(null);
        setDraft("");
        show(result.messages);
      } catch {
        setSendError("We couldn't send that. Check your internet connection and try again.");
        return;
      }
      // Tell the other side to fetch it. If this fails they'll still see it in their messages.
      await send(PING, { reliable: true }).catch(() => undefined);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      if (event.nativeEvent.isComposing) return; // Escape cancels the IME composition, not the panel.
      event.preventDefault();
      onClose();
      return;
    }
    if (!(event.target instanceof HTMLTextAreaElement) || event.key !== "Enter" || event.shiftKey) return;
    // Mid-composition (an IME), or on a touch screen where Enter makes a new line and the button sends.
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || !window.matchMedia("(pointer: fine)").matches) return;
    event.preventDefault();
    submit();
  }

  return (
    <aside
      id="call-chat"
      hidden={!visible}
      aria-label={`Chat with ${firstName}`}
      onKeyDown={onKeyDown}
      className="flex min-h-0 w-full flex-col border-paper/15 bg-ink text-paper sm:w-80 sm:border-l"
    >
      <div className="flex items-center justify-between gap-3 border-b border-paper/15 px-4 py-2">
        <h2 ref={headingRef} tabIndex={-1} className="text-base font-bold text-paper">
          Chat with {firstName}
        </h2>
        <button type="button" onClick={onClose} className="py-2 text-sm font-bold text-paper/80 underline decoration-paper/40 underline-offset-4 hover:text-paper">
          Close chat
        </button>
      </div>
      <p className="px-4 pt-3 text-xs text-paper/65">Saved to your messages with {firstName}.</p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {loadError ? (
        <p role="alert" className="mx-4 mt-3 rounded-control bg-danger px-3 py-2 text-sm text-paper">
          {loadError}{" "}
          <button type="button" onClick={() => void refresh()} className="py-1 font-bold underline underline-offset-4">
            Try again
          </button>
        </p>
      ) : null}
      <ol ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages === null ? (
          <li className="text-sm text-paper/65">Loading messages…</li>
        ) : messages.length === 0 ? (
          <li className="text-sm text-paper/65">No messages yet. Links and notes you send here stay in your thread.</li>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === viewerId;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-control px-3 py-2 ${mine ? "bg-paper text-ink" : "bg-ink-soft text-paper"}`}>
                  <p className={`text-xs ${mine ? "text-muted" : "text-paper/70"}`}>
                    {mine ? "You" : firstName}, {formatClock(new Date(m.createdAt), timeZone)}
                  </p>
                  <p className="text-sm break-words whitespace-pre-line">{m.body}</p>
                </div>
              </li>
            );
          })
        )}
      </ol>
      <form onSubmit={submit} className="space-y-2 border-t border-paper/15 p-3">
        <label htmlFor="call-chat-body" className="sr-only">
          Message {firstName}
        </label>
        <textarea
          ref={textareaRef}
          id="call-chat-body"
          rows={2}
          maxLength={2000}
          value={draft}
          enterKeyHint="send"
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Write to ${firstName}…`}
          className="block w-full resize-none rounded-control border border-paper/25 bg-ink-deep px-3 py-2 text-base text-paper placeholder:text-paper/50"
        />
        <div className="flex items-center justify-between gap-3">
          {sendError ? (
            <p role="alert" className="text-xs text-paper">
              {sendError}
            </p>
          ) : (
            <span className="hidden text-xs text-paper/55 pointer-fine:inline">Enter to send, Shift+Enter for a new line</span>
          )}
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="ml-auto rounded-control bg-paper px-4 py-2 text-sm font-bold text-ink hover:bg-rule-soft disabled:cursor-not-allowed disabled:opacity-55"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
});
