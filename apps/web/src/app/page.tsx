import { matchBand } from "@jsc/core";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Job Search Copilot</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Paste a job description. Get a fit score, your skill gaps, and a tailored resume where every
        line cites a real fact from your profile.
      </p>
      <p className="text-sm text-zinc-500">Bands: 80+ {matchBand(80)} / 60-79 {matchBand(60)} / below 60 {matchBand(0)}</p>
    </main>
  );
}
