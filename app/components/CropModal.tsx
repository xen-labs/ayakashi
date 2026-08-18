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
//   VIDEO → NOT spatial crop. Spatial cropping a 3-6s looping
//   avatar/banner clip isn't a useful thing to offer — nobody is
//   recomposing the frame of a tiny looping video the way they'd
//   recompose a photo; what actually matters for video is (a) which
//   few seconds make the cut if the source is longer than our duration
//   cap, and (b) fitting the byte cap. So video gets:
//     1. A two-handle trim scrubber (only shown if the clip exceeds the
//        slot's duration cap) — WhatsApp-style: drag either edge of the
//        selection independently, any length from MIN_TRIM_SECONDS up
//        to the slot's cap, live-looping preview of just the selected
//        window. [REBUILT — this pass] Previously a single native range
//        input that only moved a FIXED-length window — couldn't pick a
//        shorter clip or control the end independently from the start.
//        See VideoTrimPanel below for the full rebuild rationale.
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

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent
} from "react";
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
    mimeType: string
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
        area.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => (blob ? resolve(blob) : reject(new Error("crop failed"))),
            mimeType === "image/png" ? "image/png" : "image/jpeg",
            0.92
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
    onProgress: (pct: number) => void
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
    const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    const done = new Promise<Blob>(resolve => {
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
    await new Promise<void>(resolve => {
        video.onseeked = () => resolve();
    });
    await video.play();
    raf = requestAnimationFrame(draw);

    await new Promise<void>(resolve => {
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
    onCropped
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
    const [trimEnd, setTrimEnd] = useState(0); // set once duration loads, see effect below
    const needsTrim =
        videoDuration !== null && videoDuration > maxDurationSeconds;

    useEffect(() => {
        if (!isVideo) return;
        const v = document.createElement("video");
        v.src = objectUrlRef.current;
        v.onloadedmetadata = () => {
            setVideoDuration(v.duration);
            // Default window: the first maxDurationSeconds of the clip — same
            // starting point as before, just now adjustable from BOTH ends
            // instead of only the start.
            setTrimEnd(Math.min(v.duration, maxDurationSeconds));
        };
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
            // Variable-length window now — the player can select ANY duration
            // up to maxDurationSeconds, not just an exact maxDurationSeconds
            // slice. (trimEnd - trimStart) is clamped by the trim panel's own
            // drag handlers, so this is already ≤ maxDurationSeconds by the
            // time we get here.
            const clipDuration = needsTrim
                ? trimEnd - trimStart
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
                            : `Reducing size (attempt ${i + 1})…`
                    );
                    setProgress(0);
                    const attempt = await trimVideoToBlob(
                        objectUrlRef.current,
                        start,
                        clipDuration,
                        BITRATE_LADDER[i],
                        setProgress
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
                    { type: "video/webm" }
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
            const blob = await cropImageToBlob(
                objectUrlRef.current,
                area,
                file.type
            );
            const ext = file.type === "image/png" ? "png" : "jpg";
            const cropped = new File(
                [blob],
                file.name.replace(/\.\w+$/, "") + `-cropped.${ext}`,
                { type: blob.type }
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
            onClick={e => e.stopPropagation()}
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
                    trimEnd={trimEnd}
                    onTrimChange={(start, end) => {
                        setTrimStart(start);
                        setTrimEnd(end);
                    }}
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
                        onChange={e => setZoom(Number(e.target.value))}
                        className="h-1.5 w-full appearance-none rounded-full bg-white/10 accent-ayakashi-gold"
                        aria-label="Zoom"
                    />
                </div>
            )}

            {isVideo && !needsTrim && videoDuration !== null && (
                <p className="px-5 pb-6 pt-3 text-center text-[10px] text-[rgba(200,168,75,0.45)]">
                    {videoDuration.toFixed(1)}s clip — within the{" "}
                    {maxDurationSeconds}s limit, no trim needed.
                </p>
            )}
        </div>
    );
}

// ── Video trim scrubber ──────────────────────────────────────────────
//
// [REBUILT — this pass] Was a single native <input type="range"> that
// only moved a FIXED-length window (always exactly maxDurationSeconds)
// left/right — the player couldn't pick a shorter clip or control where
// it ENDS independently from where it starts, which is exactly what
// made it feel clunky. Rebuilt as a real two-handle scrubber
// (WhatsApp-style): drag either edge of the selection independently,
// window can be any length from MIN_TRIM_SECONDS up to
// maxDurationSeconds, and the preview loops ONLY the selected window
// (not the whole clip) so what you see playing is exactly what you'll
// get — not "seek to a point," but "watch your actual selection."
//
// Built on pointer events directly (pointerdown/move/up on the track
// div) rather than two overlapping range inputs — two native ranges on
// one track fight each other for hit-testing when their handles get
// close together (a well-known browser quirk), and pointer events give
// full control over which handle a given touch/drag point should grab.
const MIN_TRIM_SECONDS = 1; // shortest window a player can select — near-zero clips aren't a meaningful "moment"

function VideoTrimPanel({
    src,
    duration,
    maxDurationSeconds,
    needsTrim,
    trimStart,
    trimEnd,
    onTrimChange
}: {
    src: string;
    duration: number | null;
    maxDurationSeconds: number;
    needsTrim: boolean;
    trimStart: number;
    trimEnd: number;
    onTrimChange: (start: number, end: number) => void;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<"start" | "end" | "band" | null>(
        null
    );
    // Captured at the moment a band-drag begins: the pointer's start
    // position and the window's start/end at that instant. Band dragging
    // needs to move the window by a POINTER DELTA (preserving its exact
    // length), not jump the window so its start snaps to the pointer —
    // that jump-to-cursor behavior is exactly what feels wrong about a
    // naive port of the single-handle drag logic to a two-point band.
    const bandDragOrigin = useRef<{
        pointerTime: number;
        trimStart: number;
        trimEnd: number;
    } | null>(null);

    // Loop playback within [trimStart, trimEnd) only, so the preview shows
    // exactly the selected window rather than the whole source clip.
    useEffect(() => {
        const v = videoRef.current;
        if (!v || !needsTrim || dragging) return;
        if (v.currentTime < trimStart || v.currentTime >= trimEnd) {
            v.currentTime = trimStart;
        }
        const onTimeUpdate = () => {
            if (v.currentTime >= trimEnd) v.currentTime = trimStart;
        };
        v.addEventListener("timeupdate", onTimeUpdate);
        return () => v.removeEventListener("timeupdate", onTimeUpdate);
    }, [trimStart, trimEnd, needsTrim, dragging]);

    const timeFromClientX = useCallback(
        (clientX: number): number => {
            if (!trackRef.current || !duration) return 0;
            const rect = trackRef.current.getBoundingClientRect();
            const frac = Math.min(
                1,
                Math.max(0, (clientX - rect.left) / rect.width)
            );
            return frac * duration;
        },
        [duration]
    );

    const handlePointerDown = useCallback(
        (which: "start" | "end" | "band") => (e: ReactPointerEvent) => {
            e.preventDefault();
            e.stopPropagation();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            if (which === "band") {
                bandDragOrigin.current = {
                    pointerTime: timeFromClientX(e.clientX),
                    trimStart,
                    trimEnd
                };
            }
            setDragging(which);
        },
        [timeFromClientX, trimStart, trimEnd]
    );

    useEffect(() => {
        if (!dragging || !duration) return;

        const handleMove = (e: PointerEvent) => {
            const t = timeFromClientX(e.clientX);

            if (dragging === "start") {
                // Clamp order: can't pass the end handle minus the minimum
                // window (upper bound), can't push the window past
                // maxDurationSeconds long (lower bound relative to trimEnd),
                // can't go below 0.
                const upperBound = trimEnd - MIN_TRIM_SECONDS;
                const lowerBound = Math.max(0, trimEnd - maxDurationSeconds);
                const clamped = Math.min(upperBound, Math.max(lowerBound, t));
                onTrimChange(clamped, trimEnd);
                // Live preview: show the frame at the point being dragged, so
                // the player sees exactly where the clip will start.
                if (videoRef.current) videoRef.current.currentTime = clamped;
            } else if (dragging === "end") {
                const lowerBound = trimStart + MIN_TRIM_SECONDS;
                const upperBound = Math.min(
                    duration,
                    trimStart + maxDurationSeconds
                );
                const clamped = Math.max(lowerBound, Math.min(upperBound, t));
                onTrimChange(trimStart, clamped);
                // Live preview: show the frame at the point being dragged (the
                // new end), not the start — seeing the start here would defeat
                // the purpose of dragging the end handle at all.
                if (videoRef.current) videoRef.current.currentTime = clamped;
            } else {
                // "band" — drag the whole selection as a unit, preserving its
                // length exactly. Computed as a delta from where the drag
                // began (not a jump-to-cursor), same as dragging a selection
                // in a native video editor.
                const origin = bandDragOrigin.current;
                if (!origin) return;
                const delta = t - origin.pointerTime;
                const windowLen = origin.trimEnd - origin.trimStart;
                const lowerBound = 0;
                const upperBound = duration - windowLen;
                const newStart = Math.min(
                    upperBound,
                    Math.max(lowerBound, origin.trimStart + delta)
                );
                const newEnd = newStart + windowLen;
                onTrimChange(newStart, newEnd);
                // Live preview: show the new start of the window as it's
                // dragged into place.
                if (videoRef.current) videoRef.current.currentTime = newStart;
            }
        };

        const handleUp = () => {
            setDragging(null);
            bandDragOrigin.current = null;
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
        return () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };
    }, [
        dragging,
        duration,
        trimStart,
        trimEnd,
        maxDurationSeconds,
        timeFromClientX,
        onTrimChange
    ]);

    const selectedSeconds = trimEnd - trimStart;
    const startPct = duration ? (trimStart / duration) * 100 : 0;
    const endPct = duration ? (trimEnd / duration) * 100 : 100;

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
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-purple-400">
                        <span className="flex items-center gap-2">
                            <Scissors className="h-3 w-3" />
                            Drag edges to trim, or drag the middle to move
                        </span>
                        <span
                            className={
                                selectedSeconds > maxDurationSeconds + 0.05
                                    ? "text-red-400"
                                    : "text-purple-400"
                            }
                        >
                            {selectedSeconds.toFixed(1)}s / {maxDurationSeconds}
                            s
                        </span>
                    </div>

                    {/* Track: full clip length, with a highlighted selection band
              and two draggable handles at its edges. touch-none prevents
              the browser's own scroll/pan gesture from fighting the drag
              on mobile. */}
                    <div
                        ref={trackRef}
                        className="relative h-10 w-full touch-none select-none rounded-md bg-white/5"
                    >
                        {/* dimmed regions outside the selection */}
                        <div
                            className="absolute inset-y-0 left-0 rounded-l-md bg-black/50"
                            style={{ width: `${startPct}%` }}
                        />
                        <div
                            className="absolute inset-y-0 right-0 rounded-r-md bg-black/50"
                            style={{ width: `${100 - endPct}%` }}
                        />
                        {/* selected window — draggable as a whole to reposition
                without resizing, same as WhatsApp/Instagram/TikTok's
                trim UI. touch-none stops the browser's own scroll/pan
                gesture from fighting the drag on mobile. */}
                        <div
                            onPointerDown={handlePointerDown("band")}
                            className={`absolute inset-y-0 touch-none border-y-2 border-ayakashi-gold bg-ayakashi-gold/15 ${
                                dragging === "band"
                                    ? "cursor-grabbing"
                                    : "cursor-grab"
                            }`}
                            style={{
                                left: `${startPct}%`,
                                width: `${endPct - startPct}%`
                            }}
                        />
                        {/* start handle */}
                        <div
                            onPointerDown={handlePointerDown("start")}
                            className="absolute inset-y-0 z-10 flex w-5 -translate-x-1/2 cursor-ew-resize items-center justify-center"
                            style={{ left: `${startPct}%` }}
                            role="slider"
                            aria-label="Trim start"
                            aria-valuemin={0}
                            aria-valuemax={duration}
                            aria-valuenow={trimStart}
                        >
                            <div className="h-full w-1.5 rounded-full bg-ayakashi-gold shadow-[0_0_6px_rgba(200,168,75,0.6)]" />
                        </div>
                        {/* end handle */}
                        <div
                            onPointerDown={handlePointerDown("end")}
                            className="absolute inset-y-0 z-10 flex w-5 -translate-x-1/2 cursor-ew-resize items-center justify-center"
                            style={{ left: `${endPct}%` }}
                            role="slider"
                            aria-label="Trim end"
                            aria-valuemin={0}
                            aria-valuemax={duration}
                            aria-valuenow={trimEnd}
                        >
                            <div className="h-full w-1.5 rounded-full bg-ayakashi-gold shadow-[0_0_6px_rgba(200,168,75,0.6)]" />
                        </div>
                    </div>

                    <div className="flex justify-between text-[9px] text-[rgba(200,168,75,0.45)]">
                        <span>{trimStart.toFixed(1)}s</span>
                        <span>{duration.toFixed(1)}s total</span>
                        <span>{trimEnd.toFixed(1)}s</span>
                    </div>
                </div>
            )}
        </div>
    );
}
