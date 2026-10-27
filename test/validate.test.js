import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAudit } from "../lib/validate.js";
import { computeLeanings } from "../lib/drives.js";
import { sampleAudit } from "./fixtures.js";

const clone = () => structuredClone(sampleAudit);

test("accepts a well-formed audit and sorts drives by id", () => {
  const input = clone();
  input.drives.reverse();
  const result = validateAudit(input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.drives.map((d) => d.id), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("rejects non-objects", () => {
  for (const bad of [null, [], "text", 42]) {
    assert.equal(validateAudit(bad).ok, false);
  }
});

test("rejects missing and duplicated drives", () => {
  const short = clone();
  short.drives.pop();
  assert.match(validateAudit(short).errors.join(), /must have 8 entries/);

  const dup = clone();
  dup.drives[7] = { ...dup.drives[0] };
  const errors = validateAudit(dup).errors.join(" ");
  assert.match(errors, /Drive 1 appears more than once/);
  assert.match(errors, /Missing drive\(s\): 8/);
});

test("rejects out-of-range and non-integer scores", () => {
  for (const score of [-1, 11, 7.5, "7", null]) {
    const input = clone();
    input.drives[2].score = score;
    const result = validateAudit(input);
    assert.equal(result.ok, false, `score ${JSON.stringify(score)} should fail`);
    assert.match(result.errors[0], /drives\[2\]\.score/);
  }
});

test("rejects empty justifications and bad leanings", () => {
  const input = clone();
  input.drives[0].justification = "  ";
  input.hat.lean = "grey";
  delete input.motivation;
  const errors = validateAudit(input).errors.join(" ");
  assert.match(errors, /justification must be a non-empty string/);
  assert.match(errors, /`hat.lean` must be one of white, black/);
  assert.match(errors, /`motivation` must be an object/);
});

test("requires exactly 3 mechanics targeting real drives", () => {
  const input = clone();
  input.mechanics.push({ ...input.mechanics[0] });
  input.mechanics[0].target_drive = 9;
  const errors = validateAudit(input).errors.join(" ");
  assert.match(errors, /exactly 3 entries, got 4/);
  assert.match(errors, /mechanics\[0\]\.target_drive/);
});

test("computeLeanings averages Chou's groups", () => {
  const scores = { 1: 4, 2: 9, 3: 3, 4: 6, 5: 7, 6: 5, 7: 4, 8: 9 };
  const l = computeLeanings(scores);
  assert.equal(l.white, (4 + 9 + 3) / 3);
  assert.equal(l.black, (5 + 4 + 9) / 3);
  assert.equal(l.extrinsic, (9 + 6 + 5) / 3);
  assert.equal(l.intrinsic, (3 + 7 + 4) / 3);
});
