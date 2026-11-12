import type { PostHog } from "posthog-js";

/**
 * PostHog, loaded lazily after the page is idle so it stays off the critical path
 * (it's ~58 KB gzipped — about a third of the app's JS). Events fired before it
 * loads are queued and flushed once it's ready.
 */
let client: PostHog | null = null;
let started = false;
let enabled = false;
let queue: Array<(ph: PostHog) => void> = [];

export function initAnalytics() {
  if (started || typeof window === "undefined") return;
  started = true;

  const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;
  if (!apiKey) {
    queue = [];
    return;
  }
  enabled = true;

  const load = () =>
    import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(apiKey, {
          api_host: (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com",
          person_profiles: "identified_only",
          autocapture: true,
          capture_pageview: false, // sent manually on route change
          capture_pageleave: true,
          capture_performance: true,
          disable_session_recording: false,
          loaded: (ph) => {
            if (import.meta.env.DEV) ph.debug();
          },
        });
        client = posthog;
        queue.forEach((fn) => fn(posthog));
        queue = [];
      })
      .catch(() => {
        enabled = false;
        queue = [];
      });

  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 4000 });
  else setTimeout(load, 1500);
}

function withClient(fn: (ph: PostHog) => void) {
  if (client) fn(client);
  else if (!started || enabled) queue.length < 50 && queue.push(fn);
}

export const track = (event: string, properties?: Record<string, unknown>) =>
  withClient((ph) => ph.capture(event, properties));

export const setPersonProperties = (properties: Record<string, unknown>) =>
  withClient((ph) => ph.setPersonProperties(properties));
