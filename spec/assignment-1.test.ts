import { describe, expect, it } from "vitest";

// Assignment 1 spec (https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/assignment-1/)
// sorted into what a test can hold and what a person judges at the crit:
//
// - "static and client-side throughout, and the starter's invariant checks
//   pass" -- covered by spec/invariants.test.ts, nothing new needed here.
// - "evidence of process is in the repo" -- enforced by `pnpm check:evidence`.
// - "deployed and live at its public GitHub Pages URL" -- checked against the
//   live URL by the course's preflight/ship tooling, not against dist/ here.
// - "it works at both marking viewports (desktop and phone)" and "one strong
//   idea with a point of view, and nothing else" -- judged by a person at the
//   crit; no test can hold these. Verify the viewports yourself before then.
//
// That leaves one line this file exists to cover: "the visitor does something
// that changes what they see -- state the core interaction plainly enough to
// write a test for it". Replace the placeholder below once the topic and
// interaction are chosen -- assert the contract (what changes, and how the
// visitor triggers it), not the implementation.

describe("core interaction", () => {
  it("TODO: replace with the actual core interaction once chosen", () => {
    throw new Error(
      "No topic/interaction chosen yet. Replace this test with an assertion " +
        "that the visitor's action (click/drag/type/etc.) changes what's on " +
        "the built page -- see spec/README.md for the shape of a spec test.",
    );
  });
});
