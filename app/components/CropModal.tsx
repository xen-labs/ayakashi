"use client";

// src/app/components/CropModal.tsx
//
// WhatsApp-style crop step inserted between file-select and upload.
// Built on react-easy-crop (https://github.com/ValentinH/react-easy-crop)
// — chosen over a hand-rolled canvas-drag implementation because pinch-
// zoom, momentum drag, and touch-vs-mouse handling are exactly the kind
// of "feels smooth or feels broken, no in-between" surface area that's
// not worth re-solving ourselves. ~13KB gzipped, zero transitive deps,
// actively maintained, and — the reason it's a genuine fit here, not
// just "a cropper" — it natively supports cropping VIDEO the same way
// as images (see the `mediaType` prop below), which matters now that
// avatar/banner uploads accept MP4/WEBM/MOV alongside GIF.
//
// Output is always a single flat asset uploaded through the existing
// uploadCosmetic() flow unchanged:
//   - image in  → cropped image out (canvas draw of the source at the
//     selected crop rect, re-encoded via canvas.toBlob)
//   - video in  → cropped video out. There is no client-side video
//     re-encode here (that needs ffmpeg.wasm, which is multiple MB and
//     a meaningfully heavier dependency than this whole feature
//     justifies) — instead we capture the crop rect as CSS-level
//     object-position/object-fit metadata is NOT sent anywhere; what we
//     actually do is re-record the cropped viewport into a new video
//     file client-side via MediaRecorder + a <canvas> playback loop.
//     This runs entirely in-browser, costs no server changes, and
//     produces a real cropped video file — see cropVideoToBlob() below.
//     It re-encodes to webm (MediaRecorder's most universally supported
//     output), which is already one of our accepted upload mimetypes.
//
// Aspect ratio is fixed per slot by the caller (square for avatar, wide
// for banner/deck) — this modal doesn't expose free-aspect cropping,
// matching how WhatsApp's own profile-photo cropper works (one fixed
// shape, drag-to-position + pinch-to-zoom, nothing else to configure).

import { useCallback, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Check, X, ZoomIn } from "lucide-react";
import { FireSpinner } from "./FireSpinner";

export interface CropModalProps {
  file: File;
  aspect: number; // width / height, e.g. 1 for square, 16/9 for banner
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

// ── video crop → Blob via canvas + MediaRecorder ─────────────────────
// Plays the source video once, drawing only the cropped rect of each
// frame into a canvas, and records that canvas' stream to a new webm
// file. Real-time (takes as long as the clip's own duration to run) —
// acceptable here since our own duration caps keep clips to a few
// seconds max (see cosmeticUpload.ts's MAX_ANIMATED_*_SECONDS), so this
// never blocks the user for more than ~6s.
async function cropVideoToBlob(
  videoSrc: string,
  area: Area,
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
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");

  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  let raf = 0;
  const draw = () => {
    if (video.paused || video.ended) return;
    ctx.drawImage(
      video,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      area.width,
      area.height,
    );
    onProgress(video.duration ? video.currentTime / video.duration : 0);
    raf = requestAnimationFrame(draw);
  };

  recorder.start();
  video.currentTime = 0;
  await video.play();
  raf = requestAnimationFrame(draw);

  await new Promise<void>((resolve) => {
    video.onended = () => resolve();
  });
  cancelAnimationFrame(raf);
  recorder.stop();

  return done;
}

export function CropModal({
  file,
  aspect,
  onCancel,
  onCropped,
}: CropModalProps) {
  const isVideo = isVideoFile(file);
  const objectUrlRef = useRef<string>(URL.createObjectURL(file));
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setArea(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!area) return;
    setProcessing(true);
    try {
      if (isVideo) {
        const blob = await cropVideoToBlob(
          objectUrlRef.current,
          area,
          setProgress,
        );
        const cropped = new File(
          [blob],
          file.name.replace(/\.\w+$/, "") + "-cropped.webm",
          { type: "video/webm" },
        );
        onCropped(cropped);
      } else {
        const blob = await cropImageToBlob(
          objectUrlRef.current,
          area,
          file.type,
        );
        const ext = file.type === "image/png" ? "png" : "jpg";
        const cropped = new File(
          [blob],
          file.name.replace(/\.\w+$/, "") + `-cropped.${ext}`,
          { type: blob.type },
        );
        onCropped(cropped);
      }
    } catch {
      // Cropping is a client-side nicety, not a hard requirement — if
      // it fails for any reason (unsupported codec, canvas tainted,
      // etc.) fall back to uploading the original, untouched file
      // rather than blocking the player entirely.
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
          {isVideo ? "Crop Video" : "Crop Image"}
        </span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={processing || !area}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ayakashi-gold transition-colors hover:bg-ayakashi-gold/10 disabled:opacity-40"
        >
          {processing ? (
            <FireSpinner size={18} />
          ) : (
            <Check className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="relative flex-1">
        <Cropper
          image={!isVideo ? objectUrlRef.current : undefined}
          video={isVideo ? objectUrlRef.current : undefined}
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

      {processing && isVideo && (
        <div className="px-4 pb-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-ayakashi-gold transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-center text-[10px] text-[rgba(200,168,75,0.55)]">
            Rendering cropped clip…
          </p>
        </div>
      )}

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
    </div>
  );
}
