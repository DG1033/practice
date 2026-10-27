import { DRIVE_IDS } from "./drives.js";

// Strict validator for the model's audit JSON. Structured outputs already
// constrain the shape, but not numeric ranges or array lengths, and we never
// want to render something half-valid. Returns { ok: true, value } with drives
// sorted by id, or { ok: false, errors: [...] } listing every problem found.
export function validateAudit(data) {
  const errors = [];
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isText = (v) => typeof v === "string" && v.trim().length > 0;

  if (!isObj(data)) {
    return { ok: false, errors: ["Response is not a JSON object."] };
  }

  // Drives: exactly one entry for each of the 8 ids, integer score 0-10.
  if (!Array.isArray(data.drives)) {
    errors.push("`drives` must be an array.");
  } else {
    if (data.drives.length !== DRIVE_IDS.length) {
      errors.push(`\`drives\` must have ${DRIVE_IDS.length} entries, got ${data.drives.length}.`);
    }
    const seen = new Set();
    data.drives.forEach((d, i) => {
      const at = `drives[${i}]`;
      if (!isObj(d)) {
        errors.push(`${at} must be an object.`);
        return;
      }
      if (!DRIVE_IDS.includes(d.id)) {
        errors.push(`${at}.id must be one of ${DRIVE_IDS.join(", ")}, got ${JSON.stringify(d.id)}.`);
      } else if (seen.has(d.id)) {
        errors.push(`Drive ${d.id} appears more than once.`);
      } else {
        seen.add(d.id);
      }
      if (!Number.isInteger(d.score) || d.score < 0 || d.score > 10) {
        errors.push(`${at}.score must be a whole number from 0 to 10, got ${JSON.stringify(d.score)}.`);
      }
      if (!isText(d.justification)) {
        errors.push(`${at}.justification must be a non-empty string.`);
      }
    });
    const missing = DRIVE_IDS.filter((id) => !seen.has(id));
    if (missing.length && data.drives.length === DRIVE_IDS.length) {
      errors.push(`Missing drive(s): ${missing.join(", ")}.`);
    }
  }

  // Leanings.
  const checkLean = (key, allowed) => {
    const v = data[key];
    if (!isObj(v)) {
      errors.push(`\`${key}\` must be an object.`);
      return;
    }
    if (!allowed.includes(v.lean)) {
      errors.push(`\`${key}.lean\` must be one of ${allowed.join(", ")}, got ${JSON.stringify(v.lean)}.`);
    }
    if (!isText(v.reason)) errors.push(`\`${key}.reason\` must be a non-empty string.`);
  };
  checkLean("hat", ["white", "black"]);
  checkLean("motivation", ["intrinsic", "extrinsic"]);

  // Mechanics: exactly 3, each targeting a valid drive.
  if (!Array.isArray(data.mechanics)) {
    errors.push("`mechanics` must be an array.");
  } else {
    if (data.mechanics.length !== 3) {
      errors.push(`\`mechanics\` must have exactly 3 entries, got ${data.mechanics.length}.`);
    }
    data.mechanics.forEach((m, i) => {
      const at = `mechanics[${i}]`;
      if (!isObj(m)) {
        errors.push(`${at} must be an object.`);
        return;
      }
      if (!isText(m.title)) errors.push(`${at}.title must be a non-empty string.`);
      if (!isText(m.description)) errors.push(`${at}.description must be a non-empty string.`);
      if (!DRIVE_IDS.includes(m.target_drive)) {
        errors.push(`${at}.target_drive must be one of ${DRIVE_IDS.join(", ")}, got ${JSON.stringify(m.target_drive)}.`);
      }
    });
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      drives: [...data.drives]
        .sort((a, b) => a.id - b.id)
        .map(({ id, score, justification }) => ({ id, score, justification: justification.trim() })),
      hat: { lean: data.hat.lean, reason: data.hat.reason.trim() },
      motivation: { lean: data.motivation.lean, reason: data.motivation.reason.trim() },
      mechanics: data.mechanics.map(({ title, target_drive, description }) => ({
        title: title.trim(),
        target_drive,
        description: description.trim(),
      })),
    },
  };
}
