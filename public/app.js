const $ = (id) => document.getElementById(id);
const SVG_NS = "http://www.w3.org/2000/svg";

const form = $("audit-form");
const submitBtn = $("submit");
const statusEl = $("status");
const errorEl = $("error");
const resultsEl = $("results");

const { drives: DRIVES, limits: LIMITS } = await fetch("/api/config").then((r) => r.json());
const driveById = Object.fromEntries(DRIVES.map((d) => [d.id, d]));

// --- Form -------------------------------------------------------------------

const desc = $("description");
const updateCount = () => ($("char-count").textContent = `${desc.value.length} / ${LIMITS.description}`);
desc.addEventListener("input", updateCount);
updateCount();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("name").value.trim();
  const description = desc.value.trim();

  const problems = [];
  if (!name) problems.push("Product name is required.");
  if (description.length < LIMITS.minDescription) {
    problems.push(`Description must be at least ${LIMITS.minDescription} characters.`);
  }
  if (problems.length) {
    return showError({ message: "Please fix the form and try again.", details: problems }, "Check your input");
  }

  setBusy(true);
  try {
    const res = await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      return showError(body?.error ?? { message: `The server responded with ${res.status}.` });
    }
    showResults(body);
  } catch {
    showError({ message: "Couldn't reach the server. Is it still running?" });
  } finally {
    setBusy(false);
  }
});

function setBusy(busy) {
  submitBtn.disabled = busy;
  submitBtn.textContent = busy ? "Analysing…" : "Run audit";
  statusEl.textContent = busy ? "Asking Claude to audit the product. This can take a little while." : "";
}

const TITLES = {
  malformed_output: "The model's answer was malformed",
  invalid_input: "Check your input",
  model_refused: "The model declined",
};

function showError(error, title) {
  resultsEl.hidden = true;
  $("error-title").textContent = title ?? TITLES[error.code] ?? "Something went wrong";
  $("error-message").textContent = error.message;
  $("error-details").replaceChildren(
    ...(error.details ?? []).map((d) => Object.assign(document.createElement("li"), { textContent: d })),
  );
  errorEl.hidden = false;
}

// --- Results ----------------------------------------------------------------

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const fmt = (n) => n.toFixed(1);

function showResults(audit) {
  errorEl.hidden = true;
  const scores = Object.fromEntries(audit.drives.map((d) => [d.id, d]));

  $("results-title").textContent = `Audit: ${audit.product.name}`;
  drawRadar(scores);

  const { white, black, extrinsic, intrinsic } = audit.computed;
  $("hat-verdict").textContent = `${cap(audit.hat.lean)} Hat`;
  $("hat-reason").textContent = audit.hat.reason;
  $("hat-computed").textContent = leanNote(
    `White Hat drives (1–3) average ${fmt(white)}, Black Hat drives (6–8) average ${fmt(black)}.`,
    audit.hat.lean === "white" ? white >= black : black >= white,
  );

  $("motivation-verdict").textContent = cap(audit.motivation.lean);
  $("motivation-reason").textContent = audit.motivation.reason;
  $("motivation-computed").textContent = leanNote(
    `Intrinsic drives (3, 5, 7) average ${fmt(intrinsic)}, extrinsic drives (2, 4, 6) average ${fmt(extrinsic)}.`,
    audit.motivation.lean === "intrinsic" ? intrinsic >= extrinsic : extrinsic >= intrinsic,
  );

  $("scores-body").replaceChildren(
    ...DRIVES.map((d) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><span class="drive-num">${d.id}</span></td><td></td><td></td>`;
      tr.cells[0].append(d.name);
      tr.cells[1].textContent = `${scores[d.id].score} / 10`;
      tr.cells[2].textContent = scores[d.id].justification;
      return tr;
    }),
  );

  $("mechanics").replaceChildren(
    ...audit.mechanics.map((m) => {
      const li = document.createElement("li");
      const target = driveById[m.target_drive];
      li.innerHTML = "<strong></strong><span></span><div class='target'></div>";
      li.children[0].textContent = m.title;
      li.children[1].textContent = m.description;
      li.children[2].textContent = `Targets drive ${target.id}, ${target.name} (currently ${scores[target.id].score} / 10)`;
      return li;
    }),
  );

  $("model-note").textContent = `Analysed by ${audit.model}. Scores are an AI judgement from a short description, not a measurement.`;
  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function leanNote(text, agrees) {
  return agrees ? `Scores agree: ${text}` : `Note: the scores point the other way. ${text}`;
}

// --- Radar chart --------------------------------------------------------------

// Chou's octagon layout: drive 1 at the top, 8 at the bottom, left-brain
// (extrinsic) drives on the left and right-brain (intrinsic) on the right.
const ANGLE_DEG = { 1: -90, 3: -45, 5: 0, 7: 45, 8: 90, 6: 135, 4: 180, 2: -135 };
const ORDER = [1, 3, 5, 7, 8, 6, 4, 2]; // clockwise from the top
const CX = 260, CY = 220, R = 150, MAX = 10;

function point(id, value) {
  const a = (ANGLE_DEG[id] * Math.PI) / 180;
  const r = (value / MAX) * R;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

function drawRadar(scores) {
  const svg = $("radar");
  svg.replaceChildren(el("title", { id: "radar-title" }, "Octalysis scores by core drive"));

  // Grid: octagon rings at 2, 4, 6, 8, 10 and one spoke per drive.
  for (const v of [2, 4, 6, 8, 10]) {
    const pts = ORDER.map((id) => point(id, v).join(",")).join(" ");
    svg.append(el("polygon", { class: "ring", points: pts }));
  }
  for (const id of ORDER) {
    const [x, y] = point(id, MAX);
    svg.append(el("line", { class: "spoke", x1: CX, y1: CY, x2: x, y2: y }));
  }
  for (const v of [5, 10]) {
    svg.append(el("text", { class: "ring-label", x: CX + 4, y: CY - (v / MAX) * R + 12 }, v));
  }

  // The data shape.
  const shape = ORDER.map((id) => point(id, scores[id].score).join(",")).join(" ");
  svg.append(el("polygon", { class: "area", points: shape }));

  // Axis labels: drive short name + score.
  for (const id of ORDER) {
    const [x, y] = point(id, MAX * 1.13);
    const dx = x - CX;
    const anchor = Math.abs(dx) < 1 ? "middle" : dx > 0 ? "start" : "end";
    const dy = y < CY - 1 ? -6 : y > CY + 1 ? 14 : 4;
    const label = el("text", { class: "axis-label", x, y: y + dy, "text-anchor": anchor });
    label.append(el("tspan", {}, `${id}. ${driveById[id].short} `));
    label.append(el("tspan", { class: "axis-score" }, scores[id].score));
    svg.append(label);
  }

  // Vertices with a larger, focusable hit target for the tooltip.
  for (const id of ORDER) {
    const [x, y] = point(id, scores[id].score);
    const hit = el("circle", {
      class: "hit", cx: x, cy: y, r: 16, tabindex: 0,
      "aria-label": `${driveById[id].name}: ${scores[id].score} out of 10. ${scores[id].justification}`,
    });
    const dot = el("circle", { class: "dot", cx: x, cy: y, r: 5 });
    const show = () => { dot.classList.add("active"); showTooltip(id, scores[id], x, y); };
    const hide = () => { dot.classList.remove("active"); $("tooltip").hidden = true; };
    hit.addEventListener("mouseenter", show);
    hit.addEventListener("focus", show);
    hit.addEventListener("mouseleave", hide);
    hit.addEventListener("blur", hide);
    svg.append(hit, dot);
  }
}

function showTooltip(id, entry, x, y) {
  const tip = $("tooltip");
  const svg = $("radar");
  tip.innerHTML = "<strong></strong><span></span>";
  tip.children[0].textContent = `${driveById[id].name}: ${entry.score} / 10`;
  tip.children[1].textContent = entry.justification;
  tip.hidden = false;

  // Convert SVG coordinates to pixels within the figure.
  const fig = svg.parentElement;
  const svgBox = svg.getBoundingClientRect();
  const figBox = fig.getBoundingClientRect();
  const scale = svgBox.width / svg.viewBox.baseVal.width;
  const left = svgBox.left - figBox.left + x * scale;
  const top = svgBox.top - figBox.top + y * scale;
  const maxLeft = fig.clientWidth - tip.offsetWidth - 8;
  tip.style.left = `${Math.max(8, Math.min(left + 12, maxLeft))}px`;
  tip.style.top = `${top + 14}px`;
}
