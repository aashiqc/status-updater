import posthog from 'posthog-js';

// Only initialize on the client
if (typeof window !== 'undefined') {
    const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
    const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (apiKey) {
        posthog.init(apiKey, {
            api_host: apiHost,
            person_profiles: 'identified_only',
            // Enable automatic capturing
            autocapture: true,
            // Capture page views automatically
            capture_pageview: true,
            // Capture page leave events
            capture_pageleave: true,
            // Capture performance metrics
            capture_performance: true,
            // Enable session recording (optional but useful)
            disable_session_recording: false,
            // Enable debug mode in development
            loaded: (posthog) => {
                if (import.meta.env.DEV) posthog.debug();
            },
        });
    }
}

// Helper function to track custom events with consistent formatting
export const trackEvent = (eventName: string, properties?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && posthog) {
        posthog.capture(eventName, properties);
    }
};

// Helper function to identify users
export const identifyUser = (userId: string, properties?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && posthog) {
        posthog.identify(userId, properties);
    }
};

// Helper function to set user properties
export const setUserProperties = (properties: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && posthog) {
        posthog.setPersonProperties(properties);
    }
};

// Helper function to track page views manually (useful for SPA navigation)
export const trackPageView = (pageName?: string, properties?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && posthog) {
        posthog.capture('$pageview', {
            $current_url: window.location.href,
            page_name: pageName,
            ...properties,
        });
    }
};

export { posthog };
