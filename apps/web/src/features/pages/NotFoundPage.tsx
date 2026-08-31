import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="bg-bg-canvas flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="text-text-primary mb-4 text-4xl font-bold tracking-tight">404 - Not Found</h1>
      <p className="text-text-muted mb-8 max-w-md text-lg">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="bg-accent-primary hover:bg-accent-primary/90 rounded-md px-6 py-2.5 text-sm font-semibold text-white transition-colors"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
