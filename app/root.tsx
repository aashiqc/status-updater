import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import { PostHogProvider, usePostHog } from '@posthog/react';
import { posthog } from "./lib/posthog";
import "./app.css";

export const meta: Route.MetaFunction = () => {
  return [{ title: "Status Updater" }];
};

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap",
  },
  // Favicon configuration
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicon-96x96.png" },
  { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <PostHogProvider client={posthog}>
          {children}
        </PostHogProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <RouteChangeTracker />
      <Outlet />
    </>
  );
}

// Component to track route changes for PostHog
function RouteChangeTracker() {
  const location = useLocation();
  const posthogClient = usePostHog();

  useEffect(() => {
    // Track page view on route change
    if (posthogClient) {
      posthogClient.capture('$pageview', {
        $current_url: window.location.href,
        path: location.pathname,
        search: location.search,
      });
    }
  }, [location, posthogClient]);

  return null;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
