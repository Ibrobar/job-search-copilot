<!-- Copy of resume-tailoring/docs/BASE_FACTS.md for evals. Contact details and removed entries stripped. -->
# Base facts — SOURCE OF TRUTH

This file is THE authority for all resume facts (experience, dates, projects, skills, education, extras).
It supersedes `base/Ibrahim_Barney_SE.docx`, which is now an archived artifact only. If anything else
(CAPABILITIES.md, a generated resume) disagrees with this file, THIS FILE WINS — fix the other one.
Never state a job, date, degree, metric, or technology that is not recorded here.


## Summary (canonical, above Experience — Ibrahim's own voice: plain, first-person, causal)
Full-stack software engineer (B.S. in Software Engineering, UT Dallas) who likes owning a feature from
the Figma file to the deployed service. Day to day that means React, Next.js, and TypeScript on the front
end with Tailwind CSS and HTML5/CSS3; JavaScript (ES6+), REST APIs, and OAuth2 in the middle; and Supabase,
Laravel (PHP), Docker, and Linux underneath, all managed through Git/GitHub. Built for 10,000+
Chrome extension users at Boycat, after shipping for 150,000+ users at TNZ International.

(Tailored summaries are re-authored per job, but stay in this voice and claim only facts below.)

## Professional Experience (reverse chronological)
- Software Engineer, Boycat (Contract) — Sept 2025 to Aug 2026 — Remote.
  Conscious-consumer shopping app (iOS/Android). Chrome extension (describe as 10,000+ users — NEVER
  millions), Next.js web app, Supabase edge-function backend. Owned the Price Watch feature end-to-end
  across three GitHub repos (Amazon price tracking + email alerts): extension UI in JavaScript (ES6+)
  and HTML5/CSS3, React dashboard pages on the Next.js site with Tailwind CSS, Supabase edge function
  behind OAuth2 sign-in. Deno/TypeScript edge function (action-routed REST API) with concurrency
  control, alert dedup, templated HTML emails on cron. Fixed production extension bugs (JavaScript
  ES6+ codebase) through release 3.1.21 via the Git/GitHub review flow. Migrated Amazon data layer
  PA-API -> Creators API via a recursive response transformer. Built the TypeScript Price Tracker
  dashboard, reusable React pagination, Framer Motion landing page; led the extension popup/modal
  brand redesign from Figma mockups to shipped UI.
- Junior Software Developer, TNZ International (Contract) — June 2024 to Aug 2025 — Remote.
  Laravel (PHP) app serving 150,000+ users. Built a RESTful API with OAuth2 authentication and webhook
  integration; helped drive $500K+ revenue; Figma UI design; HTML5/CSS3 views in the Laravel web app;
  Flutter mobile front-end.
- Lane Controller Analyst, QuarterHill — March 2024 to Present.
  Distributed Docker/Linux tolling systems. Diagnoses production issues in containerized Docker apps
  on Linux via SSH/CLI/log analysis; triages 50+ daily alerts (Zenoss, ServiceNow).
  Also (confirmed by Ibrahim 2026-10-04): troubleshoots lane hardware / field devices, and writes and
  edits scripts and configuration files on lane systems. (No specific protocols/buses confirmed --
  do not claim CAN/UART/SPI/I2C/RS-232.)
  Built the Ticket Queue Automation tool (below) FOR THE QUARTERHILL TEAM; it improved the team's
  ticket-handling efficiency (confirmed by Ibrahim 2026-10-08; no number -- do not invent one).
- Internal Help Desk, US Foods — Feb 2023 to Mar 2024.
- Technical Support II, Securus Technologies — June 2022 to Jan 2023.

## Projects
- Ticket Queue Automation — built for the QuarterHill team — June 2026 to Sept 2026. Built with AI coding agents
  (Claude Code) from Ibrahim's own specs/rules. Two Chrome extensions (Manifest V3, JavaScript): one
  auto-acknowledges new tasks, one auto-assigns new tickets to himself in a web-based IT ticketing
  system. Then replaced both with a headless Node.js + Playwright runner on a Raspberry Pi: config-driven
  queues + rules, cron gate so it runs only during his shifts, dry-run mode, fail-closed rules (stop
  instead of guessing), push alerts (ntfy), session login without storing passwords, and scripted tests
  (schedule logic + runner/rules against a mock ticket page in headless Chromium).
  FRAMING (updated 2026-10-08): listed under the QuarterHill role, not Projects. Say it was built for the
  team and improved efficiency. Do NOT name ServiceNow or clients. No metrics -- do not invent any. A planned routing extension is NOT built.
- Cribbage Card Game (Java) — team of 3 — Aug 2022 to Dec 2022. 3-player CLI game, full SDLC, UML/domain/
  sequence models, VCS, unit testing, cohesion & coupling.
- Connect Four (MIPS assembly) — Jan 2022 to May 2022. 2-player CLI game, full SDLC, UML, VCS.

## Legacy / support roles (from prior resume PDFs, not the current SE docx)
- Technical Support Engineer Tier 2, Securus Technologies — June 2022 to Jan 2023 — VOIP/ADTRAN, Salesforce, 160+ tickets/mo.
- Technical Support Specialist Associate, Omnitracs LLC — Apr 2018 to Aug 2020 — trucking app support, docs/process, 40+ tickets/day.
- Technical Support Associate, Telvista — Mar 2017 to Apr 2018 — 15+ tickets/day.
- QuarterHill also framed on prior resume as "Technical Support Specialist II" (TOCC ticket triage). SE resume uses Lane Controller / Docker framing.
- Extras: U.S. Citizen. Languages: English, Classical Arabic. YM Irving (Young Muslims) leadership 2015–2018.

## Skills
- Languages: TypeScript, JavaScript (ES6+), Python, C++, Java, MIPS, PHP, SQL, HTML5/CSS3
- Frameworks: React, Next.js, React Native, Flutter, Laravel, Deno, Flask, Tailwind CSS, Node.js
- Tools & Platforms: Supabase, PostgreSQL, Docker, Linux/UNIX, Azure, Git/GitHub, REST APIs, OAuth2, Figma
- IDEs: VS Code, IntelliJ IDEA, Eclipse, NetBeans, Android Studio, MARS
- Practices (academic): UML/sequence/domain modeling, unit testing, cohesion & coupling, full SDLC

## Education
University of Texas at Dallas — Aug 2021 to May 2024 — B.S. in Software Engineering
Coursework: Algorithms, Data Structures, Computer Architecture, Software Engineering, Database Systems, Operating Systems

Note: this snapshot uses em dashes for readability ONLY. Generated resumes must contain NO em dashes.
