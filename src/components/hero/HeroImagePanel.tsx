import Image from "next/image";

export interface HeroImage {
  src: string;
  alt: string;
  objectPosition?: string;
}

interface HeroImagePanelProps {
  image?: HeroImage;
  priority?: boolean;
}

/**
 * Right-hand visual. Renders genuine product photography when provided;
 * otherwise a clean ivory panel that reserves exactly the same space, so adding
 * photos later causes no layout change.
 */
export function HeroImagePanel({ image, priority }: HeroImagePanelProps) {
  if (image) {
    return (
      <Image
        src={image.src}
        alt={image.alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 52vw, 100vw"
        className="object-cover"
        style={{ objectPosition: image.objectPosition ?? "50% 50%" }}
      />
    );
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 bg-brand-ivory">
      {/* Fine champagne-gold frame, echoing premium packaging. */}
      <div className="absolute inset-4 border border-brand-gold/35 sm:inset-6 lg:inset-8" />
      <div className="absolute inset-[22px] border border-brand-gold/15 sm:inset-[30px] lg:inset-[38px]" />
      {process.env.NODE_ENV !== "production" && (
        <p className="absolute inset-x-0 bottom-8 text-center text-[10px] uppercase tracking-[0.3em] text-brand-text/40 sm:bottom-10 lg:bottom-14">
          Reserved for product photography
        </p>
      )}
    </div>
  );
}
