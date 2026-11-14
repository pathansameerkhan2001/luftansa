/**
 * "The Luftansa Story" homepage section.
 *
 * The left column is reserved for Luftansa's own brand video. Until one is
 * supplied it renders as an empty ivory frame (no stock media, text or icons).
 *
 * To add the video later, upload it to S3 under "about/" and set e.g.
 *   video: {
 *     key: "about/luftansa-story.mp4",
 *     poster: { key: "about/luftansa-story-poster.jpg" }, // optional first frame
 *     label: "Luftansa fragrance craftsmanship",            // accessible description
 *   }
 * The video fills the existing frame (object-cover) at FRAME_ASPECT_RATIO, so
 * the section layout does not change. Export the video at this ratio for a
 * perfect fit (e.g. 1080×1080 for 1 / 1).
 *
 * Streaming note: browsers (Safari in particular) need HTTP Range support for
 * video. Serve it via CloudFront (ASSET_CDN_URL), which supports ranges; the
 * fallback /media route streams whole objects only.
 */
export interface StoryVideoConfig {
  /** S3 key (preferred), e.g. "about/luftansa-story.mp4". */
  key?: string;
  /** Absolute URL alternative. */
  src?: string;
  /** MIME type of the video file. */
  type?: string;
  poster?: { key?: string; src?: string };
  /** Short accessible description of what the video shows. */
  label: string;
}

/** Width / height of the video frame (CSS aspect-ratio). */
export const FRAME_ASPECT_RATIO = "1 / 1";

export const BRAND_STORY = {
  label: "Our Brand",
  heading: "The Luftansa Story",
  description:
    "At Luftansa Fragrance Craft Hub, we believe every fragrance tells a story. Our collection brings together distinctive scents, thoughtful craftsmanship and memorable fragrance experiences, created for every mood, moment and personality.",
  cta: "Discover Our Story",
  /** Brand video for the left column. Unset until Luftansa provides one. */
  video: undefined as StoryVideoConfig | undefined,
};
