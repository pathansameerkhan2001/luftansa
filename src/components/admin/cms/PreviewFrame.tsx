"use client";

/**
 * Device preview for CMS pages (Phase 3B).
 *
 * The preview is a real page (an admin-only, noindex route that renders the
 * actual storefront component) inside an iframe of the device's true width,
 * scaled down to fit. Because the iframe really is 390, 768 or 1280px wide,
 * the storefront's responsive rules behave exactly as on that device; a narrow
 * box inside the admin page could not trigger them.
 */
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ADMIN_FOCUS, BTN_ICON, FilterTabs } from "./ui";

export const PREVIEW_DEVICES = [
  { id: "desktop", label: "Desktop", width: 1280, height: 800, Icon: Monitor },
  { id: "tablet", label: "Tablet", width: 768, height: 1024, Icon: Tablet },
  { id: "mobile", label: "Mobile", width: 390, height: 844, Icon: Smartphone },
] as const;
type DeviceId = (typeof PREVIEW_DEVICES)[number]["id"];

export function PreviewFrame({
  title,
  draftSrc,
  liveSrc,
  reloadKey,
  note,
  hasLive = true,
  frameHeight,
}: {
  title: string;
  /** Preview of the saved draft. */
  draftSrc: string;
  /** Preview of what is live now. */
  liveSrc: string;
  /** Change to reload the frame (e.g. after each save). */
  reloadKey: string | number;
  note?: string;
  hasLive?: boolean;
  /** Fixed frame height in CSS px for short previews (default: the device height). */
  frameHeight?: number;
}) {
  const [device, setDevice] = useState<DeviceId>("desktop");
  const [version, setVersion] = useState<"draft" | "live">("draft");
  const [manual, setManual] = useState(0);
  const [boxWidth, setBoxWidth] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const d = PREVIEW_DEVICES.find((x) => x.id === device)!;
  const height = frameHeight ?? d.height;
  const scale = boxWidth ? Math.min(1, boxWidth / d.width) : 0;
  const src = version === "draft" ? draftSrc : liveSrc;

  return (
    <div data-preview-frame>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <FilterTabs
          label="Preview device"
          value={device}
          onChange={setDevice}
          options={PREVIEW_DEVICES.map((x) => ({ value: x.id, label: `${x.label} · ${x.width}px` }))}
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterTabs
            label="Version to preview"
            value={version}
            onChange={setVersion}
            options={[
              { value: "draft", label: "Saved draft" },
              ...(hasLive ? [{ value: "live" as const, label: "Live now" }] : []),
            ]}
          />
          <button type="button" onClick={() => setManual((n) => n + 1)} className={`${BTN_ICON}`} aria-label="Reload preview">
            <RefreshCw aria-hidden="true" className="size-4" />
          </button>
          <a href={src} target="_blank" rel="noopener noreferrer" className={`${BTN_ICON} ${ADMIN_FOCUS}`} aria-label="Open preview in a new tab">
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>
      {note ? <p className="mt-2 text-[12.5px] text-brand-text/60">{note}</p> : null}
      <div ref={boxRef} className="mt-3 w-full">
        {scale > 0 ? (
          <div className="mx-auto overflow-hidden rounded-xl border border-[#d9c79f] bg-white shadow-sm" style={{ width: d.width * scale, height: height * scale }}>
            <iframe
              key={`${src}|${reloadKey}|${manual}`}
              src={src}
              title={`${title} preview, ${d.label.toLowerCase()} ${d.width}px, ${version === "draft" ? "saved draft" : "live version"}`}
              width={d.width}
              height={height}
              loading="lazy"
              className="origin-top-left border-0 bg-white"
              style={{ transform: `scale(${scale})`, width: d.width, height }}
              data-preview-device={d.id}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
