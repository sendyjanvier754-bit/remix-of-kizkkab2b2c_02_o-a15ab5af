import { Suspense, type ReactNode } from "react";
import { PageLoader } from "@/components/ui/PageLoader";

/** Suspense boundary used around page components (shows the brand loader). */
const LazyRoute = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

export default LazyRoute;
