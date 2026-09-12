import { Suspense } from "react";
import VerifyEmailPage from "../../components/auth/VerifyEmailPage";

// useSearchParams (used to read the ?mode=verifyEmail&oobCode=... Firebase
// appends to the emailed link) requires a Suspense boundary for this
// otherwise-static route.
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-gradient-to-br from-red-950 via-slate-900 to-red-900 text-sm text-white/80">
          Loading…
        </main>
      }
    >
      <VerifyEmailPage />
    </Suspense>
  );
}
