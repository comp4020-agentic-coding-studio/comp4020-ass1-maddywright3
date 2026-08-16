# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## Commit guidelines

Never commit without asking first. Show the proposed commit message and why,
then wait for approval before running `git commit`.

## Hard constraints

- Static, client-side only. No backend.
- No build step beyond what the starter template already has.
- Vanilla HTML/CSS/TypeScript per the starter template.
- Must work at both viewports: 1920x1080 (laptop/desktop) and 390x844 (phone,
  Chrome DevTools iPhone preset).

## Verification before acceptance

Check this file every run. Before saying something works, state how it was
checked:

- Price/logic changes: walk through the maths for at least 3 sample states
  (early, half sold, near full) and confirm the price is non-decreasing on the
  normal path.
- UI changes: confirm both 1920x1080 and 390x844 were checked.

## When something is wrong

Don't just retry. Propose a rule to add to this file that would prevent that
class of mistake, wait for approval, add it, then fix the issue.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## The checks

`typecheck`, `build`, `deploy`, `spec`, `lint`, `tests`, `evidence`, `links`,
`secrets`. Run `pnpm check`. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out, a fact
about the stack that is easy to get wrong --- write it down here. Growing this
file is the work.
