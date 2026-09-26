import { toEmbedUrl } from "@/lib/video";

export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const src = toEmbedUrl(url);
  if (!src) return null;
  return (
    <div className="relative aspect-video w-full overflow-hidden border border-rule bg-ink">
      <iframe
        src={src}
        title={`Video: ${title}`}
        className="absolute inset-0 h-full w-full"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
