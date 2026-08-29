// lib/deviceFingerprint.ts
//
// [CHANGED — this pass] Swapped from the hand-rolled canvas+navigator
// hash to the real @fingerprintjs/fingerprintjs open-source library.
// Originally shipped dependency-free specifically to avoid adding a new
// package without asking first — but the actual tradeoff turned out to
// be "one new npm package," not bundle size or hosting cost: this
// library runs entirely client-side (no network calls, no server
// compute), so it doesn't touch Vercel function limits or Render
// compute either. ~20-25KB gzipped, loaded only on pages that call
// getDeviceFingerprint() (register + login) — not a meaningful
// performance cost. Given no real downside, the real library's much
// stronger entropy (canvas + WebGL + audio + fonts + more, actively
// maintained against browser changes that degrade fingerprinting over
// time) is a straightforward upgrade over the hand-rolled version.
//
// PACKAGE — requires @fingerprintjs/fingerprintjs in package.json (open
// source npm package, NOT their paid hosted Pro API — no API key, no
// account, no network calls to FingerprintJS's servers at all; this
// computes everything locally in the browser). Run:
//   npm install @fingerprintjs/fingerprintjs
// before this will typecheck/build — package.json did not have it
// installed as of the last check.
//
// SAME CALL SIGNATURE as the version this replaces — every call site
// (register_page.tsx, login_page.tsx) just awaits getDeviceFingerprint()
// and gets a string back, so nothing downstream needed to change when
// swapping the internals here.

import FingerprintJS from "@fingerprintjs/fingerprintjs";

let cachedAgentPromise: ReturnType<typeof FingerprintJS.load> | null = null;
let cachedFingerprint: string | null = null;

/**
 * Returns a stable hash for this browser/device. The FingerprintJS
 * agent is loaded once and cached in memory (not localStorage — no
 * need to persist across page loads, it's deterministic from the
 * device itself and recomputing is cheap after the initial load).
 * Never throws — worst case returns "unavailable" rather than blocking
 * registration/login over a fingerprinting step failing (the backend
 * already treats this field as optional).
 */
export async function getDeviceFingerprint(): Promise<string> {
    if (cachedFingerprint) return cachedFingerprint;
    try {
        if (!cachedAgentPromise) {
            cachedAgentPromise = FingerprintJS.load();
        }
        const agent = await cachedAgentPromise;
        const result = await agent.get();
        cachedFingerprint = result.visitorId;
    } catch {
        // Fail soft — some privacy-hardened browsers or extensions can
        // block fingerprinting scripts entirely. This should never be a
        // reason to block someone from registering or logging in.
        cachedFingerprint = "unavailable";
    }
    return cachedFingerprint;
}
