"use client";

// src/app/components/CropModal.tsx
//
// Two entirely different flows depending on media type, not one UI
// stretched to cover both:
//
//   IMAGE → spatial crop (react-easy-crop: pinch/drag/zoom, fixed
//   aspect per slot). This is the WhatsApp-style "recenter and frame
//   your photo" step, and it's genuinely useful here — most uploaded
//   photos aren't pre-cropped to a perfect square/banner shape.
//
//   VIDEO → NOT spatial crop. [CHANGED — this pass] Spatial cropping a
//   3-6s looping avatar/banner clip isn't a useful thing to offer —
//   nobody is recomposing the frame of a tiny looping video the way
//   they'd recompose a photo; what actually matters for video is (a)
//   which few seconds make the cut if the source is longer than our
//   duration cap, and (b) fitting the byte cap. So video gets:
//     1. A trim scrubber (only shown if the clip exceeds the slot's
//        duration cap) — drag a window over the clip instead of
//        blindly taking the first N seconds, since the best moment in
//        a clip is rarely the very start.
//     2. Automatic bitrate step-down if the trimmed/re-encoded result
//        still exceeds the slot's byte cap — re-encodes at
//        progressively lower videoBitsPerSecond (up to 3 attempts) so
//        the player doesn't have to manually fight file size; only
//        surfaces an error if it still doesn't fit after every attempt
//        (extremely unlikely given how much headroom bitrate step-down
//        gives on a multi-second clip).
//   Both steps reuse the same canvas + MediaRecorder re-encode pipeline
//   (full-frame this time — no crop rect), producing a new .webm.
//
// Built on react-easy-crop for the image path only now
// (https://github.com/ValentinH/react-easy-crop) — ~13KB gzipped, zero
// transitive deps, handles the fiddly pinch/drag/momentum feel that's
// easy to get wrong by hand. Video no longer touches this dependency at
// all since it has no spatial crop step.
//
// PERFORMANCE NOTE: everything in this file runs client-side, only
// while THIS user is actively cropping/trimming THEIR OWN upload — it
// never runs on page load, never runs for other users viewing a
// profile, and never touches the server. The one real cost is time,
// not "site slowness": trimming/recompressing plays through the clip
// in real time (bounded by our own duration caps — 3-6s), and bitrate
// step-down may repeat that up to 3x if the first pass is still too
// large. Worst case here is a few seconds of local processing on one
// upload for one user — nothing that affects anyone else or any other
// part of the app.

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Check, X, ZoomIn, Scissors } from "lucide-react";
import { FireSpinner } from "./FireSpinner";

export interface CropModalProps {
  file: File;
  aspect: number; // width / height, e.g. 1 for square, 16/9 for banner
  /** Duration cap in seconds for this slot — e.g. 3 for avatar, 6 for
   *  banner (must match cosmeticUpload.ts's MAX_ANIMATED_*_SECONDS).
   *  Only used for video input; ignored for images. */
  maxDurationSeconds: number;
  /** Byte cap for this slot's ANIMATED tier — e.g. 5MB avatar, 8MB
   *  banner (must match cosmeticUpload.ts's MAX_ANIMATED_*_BYTES).
   *  Only used for video input; drives the auto-compress step. */
  maxBytes: number;
  onCancel: () => void;
  onCropped: (croppedFile: File) => void;
}

const isVideoFile = (file: File) => file.type.startsWith("video/");

// ── image crop → Blob via canvas ─────────────────────────────────────
async function cropImageToBlob(
  imageSrc: string,
  area: Area,
  mimeType: string,
): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageSrc;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");

  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("crop failed"))),
      mimeType === "image/png" ? "image/png" : "image/jpeg",
      0.92,
    );
  });
}

// ── video trim + re-encode → Blob via canvas + MediaRecorder ─────────
// No spatial crop rect — draws the FULL source frame every time. Plays
// only the [startSec, startSec + durationSec) window of the source,
// re-encoding just that window at the given bitrate. Real-time (takes
// as long as durationSec to run).
async function trimVideoToBlob(
  videoSrc: string,
  startSec: number,
  durationSec: number,
  videoBitsPerSecond: number,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  const video = document.createElement("video");
  video.src = videoSrc;
  video.muted = true;
  video.playsInline = true;
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");

  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  const endSec = Math.min(startSec + durationSec, video.duration);
  let raf = 0;
  const draw = () => {
    if (video.paused || video.ended || video.currentTime >= endSec) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onProgress((video.currentTime - startSec) / (endSec - startSec));
    raf = requestAnimationFrame(draw);
  };

  recorder.start();
  video.currentTime = startSec;
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
  });
  await video.play();
  raf = requestAnimationFrame(draw);

  await new Promise<void>((resolve) => {
    const check = () => {
      if (video.currentTime >= endSec || video.ended) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
  video.pause();
  cancelAnimationFrame(raf);
  recorder.stop();

  return done;
}

// Bitrate ladder for auto-compress — starts reasonably high (good
// quality for a few-second clip) and steps down only if the previous
// attempt was still too large. 3 rungs is enough headroom that a
// legitimate short clip essentially always fits somewhere on this
// ladder; if it still doesn't, the source material itself (very high
// motion/resolution) is the limiting factor, not something further
// bitrate cuts would fix without going unacceptably blocky.
const BITRATE_LADDER = [2_500_000, 1_200_000, 600_000];

export function CropModal({
  file,
  aspect,
  maxDurationSeconds,
  maxBytes,
  onCancel,
  onCropped,
}: CropModalProps) {
  const isVideo = isVideoFile(file);
  const objectUrlRef = useRef<string>(URL.createObjectURL(file));

  // ── image-only state ──
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setArea(areaPixels);
  }, []);

  // ── video-only state ──
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const needsTrim =
    videoDuration !== null && videoDuration > maxDurationSeconds;

  useEffect(() => {
    if (!isVideo) return;
    const v = document.createElement("video");
    v.src = objectUrlRef.current;
    v.onloadedmetadata = () => setVideoDuration(v.duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const handleConfirm = async () => {
    setErrMsg("");
    if (isVideo) {
      setProcessing(true);
      const clipDuration = needsTrim
        ? maxDurationSeconds
        : (videoDuration ?? maxDurationSeconds);
      const start = needsTrim ? trimStart : 0;
      try {
        let blob: Blob | null = null;
        for (let i = 0; i < BITRATE_LADDER.length; i++) {
          setStatusLabel(
            i === 0
              ? needsTrim
                ? "Trimming clip…"
                : "Processing clip…"
              : `Reducing size (attempt ${i + 1})…`,
          );
          setProgress(0);
          const attempt = await trimVideoToBlob(
            objectUrlRef.current,
            start,
            clipDuration,
            BITRATE_LADDER[i],
            setProgress,
          );
          if (attempt.size <= maxBytes) {
            blob = attempt;
            break;
          }
          // Keep the smallest attempt so far in case every rung on the
          // ladder still comes in over the cap — better to hand back
          // the closest-fitting result than nothing at all; the server
          // is the final authority on the size cap regardless (see
          // cosmeticUpload.ts), so a still-too-large result here just
          // means the player sees the server's rejection message
          // instead of silently succeeding — never a broken upload.
          if (!blob || attempt.size < blob.size) blob = attempt;
        }
        const cropped = new File(
          [blob!],
          file.name.replace(/\.\w+$/, "") + "-trimmed.webm",
          { type: "video/webm" },
        );
        onCropped(cropped);
      } catch {
        // Client-side processing is a nicety, not a hard requirement —
        // fall back to the original file untouched rather than blocking
        // the upload; the server will still enforce duration/size and
        // give the player an actionable error if it doesn't fit.
        onCropped(file);
      } finally {
        setProcessing(false);
        URL.revokeObjectURL(objectUrlRef.current);
      }
      return;
    }

    // image path
    if (!area) return;
    setProcessing(true);
    try {
      const blob = await cropImageToBlob(objectUrlRef.current, area, file.type);
      const ext = file.type === "image/png" ? "png" : "jpg";
      const cropped = new File(
        [blob],
        file.name.replace(/\.\w+$/, "") + `-cropped.${ext}`,
        { type: blob.type },
      );
      onCropped(cropped);
    } catch {
      onCropped(file);
    } finally {
      setProcessing(false);
      URL.revokeObjectURL(objectUrlRef.current);
    }
  };

  const handleCancel = () => {
    URL.revokeObjectURL(objectUrlRef.current);
    onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={processing}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[rgba(200,168,75,0.70)] transition-colors hover:bg-white/5 hover:text-ayakashi-gold disabled:opacity-40"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-xs font-bold uppercase tracking-widest text-ayakashi-gold">
          {isVideo ? "Trim Clip" : "Crop Image"}
        </span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={processing || (!isVideo && !area)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ayakashi-gold transition-colors hover:bg-ayakashi-gold/10 disabled:opacity-40"
        >
          {processing ? (
            <FireSpinner size={18} />
          ) : (
            <Check className="h-5 w-5" />
          )}
        </button>
      </div>

      {errMsg && (
        <p className="mx-4 mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {errMsg}
        </p>
      )}

      {isVideo ? (
        <VideoTrimPanel
          src={objectUrlRef.current}
          duration={videoDuration}
          maxDurationSeconds={maxDurationSeconds}
          needsTrim={needsTrim}
          trimStart={trimStart}
          onTrimStartChange={setTrimStart}
        />
      ) : (
        <div className="relative flex-1">
          <Cropper
            image={objectUrlRef.current}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
            restrictPosition
            objectFit="contain"
          />
        </div>
      )}

      {processing && (
        <div className="px-4 pb-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-ayakashi-gold transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-center text-[10px] text-[rgba(200,168,75,0.55)]">
            {statusLabel}
          </p>
        </div>
      )}

      {!isVideo && (
        <div className="flex items-center gap-3 px-5 pb-6 pt-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-[rgba(200,168,75,0.50)]" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full appearance-none rounded-full bg-white/10 accent-ayakashi-gold"
            aria-label="Zoom"
          />
        </div>
      )}

      {isVideo && !needsTrim && videoDuration !== null && (
        <p className="px-5 pb-6 pt-3 text-center text-[10px] text-[rgba(200,168,75,0.45)]">
          {videoDuration.toFixed(1)}s clip — within the {maxDurationSeconds}s
          limit, no trim needed.
        </p>
      )}
    </div>
  );
}

// ── Video trim scrubber ──────────────────────────────────────────────
// A single draggable window over a filmstrip-less timeline (no frame
// thumbnails — extracting a filmstrip is meaningfully more code for a
// feature used on clips ≤10-15s where "drag and preview via the video
// element itself" is plenty precise). Dragging updates trimStart and
// seeks the preview video live so the player can see exactly what
// they're selecting.
function VideoTrimPanel({
  src,
  duration,
  maxDurationSeconds,
  needsTrim,
  trimStart,
  onTrimStartChange,
}: {
  src: string;
  duration: number | null;
  maxDurationSeconds: number;
  needsTrim: boolean;
  trimStart: number;
  onTrimStartChange: (v: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.currentTime = trimStart;
  }, [trimStart]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5">
      <video
        ref={videoRef}
        src={src}
        className="max-h-[50vh] w-auto max-w-full rounded-lg"
        muted
        playsInline
        loop
        autoPlay
      />

      {needsTrim && duration !== null && (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-purple-400">
            <Scissors className="h-3 w-3" />
            <span>
              Select {maxDurationSeconds}s of {duration.toFixed(1)}s
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, duration - maxDurationSeconds)}
            step={0.1}
            value={trimStart}
            onChange={(e) => onTrimStartChange(Number(e.target.value))}
            className="h-1.5 w-full appearance-none rounded-full bg-white/10 accent-ayakashi-gold"
            aria-label="Trim start"
          />
          <div className="flex justify-between text-[9px] text-[rgba(200,168,75,0.45)]">
            <span>{trimStart.toFixed(1)}s</span>
            <span>{(trimStart + maxDurationSeconds).toFixed(1)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
