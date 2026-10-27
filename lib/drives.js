// Yu-kai Chou's 8 Octalysis core drives.
//
// `hat` and `brain` follow Chou's own grouping: the top three drives are
// "White Hat" (feel good, empowering), the bottom three are "Black Hat"
// (urgency, obsession, anxiety). Left-brain drives are extrinsic (logic,
// ownership, reward); right-brain drives are intrinsic (creativity, social,
// curiosity). Drives 1 and 8 sit on the vertical axis and belong to neither
// brain side; drives 4 and 5 sit on the horizontal axis and belong to neither hat.
export const DRIVES = [
  {
    id: 1,
    name: "Epic Meaning & Calling",
    short: "Meaning",
    hat: "white",
    brain: null,
    blurb: "The user believes they are part of something bigger than themselves.",
  },
  {
    id: 2,
    name: "Development & Accomplishment",
    short: "Accomplishment",
    hat: "white",
    brain: "left",
    blurb: "Making progress, developing skills, achieving mastery, overcoming challenges.",
  },
  {
    id: 3,
    name: "Empowerment of Creativity & Feedback",
    short: "Empowerment",
    hat: "white",
    brain: "right",
    blurb: "Engaging in a creative process, trying combinations, and seeing the results.",
  },
  {
    id: 4,
    name: "Ownership & Possession",
    short: "Ownership",
    hat: null,
    brain: "left",
    blurb: "Feeling that you own or control something and want to improve or protect it.",
  },
  {
    id: 5,
    name: "Social Influence & Relatedness",
    short: "Social",
    hat: null,
    brain: "right",
    blurb: "Mentorship, acceptance, companionship, competition and envy.",
  },
  {
    id: 6,
    name: "Scarcity & Impatience",
    short: "Scarcity",
    hat: "black",
    brain: "left",
    blurb: "Wanting something because it is rare, exclusive, or not available right now.",
  },
  {
    id: 7,
    name: "Unpredictability & Curiosity",
    short: "Curiosity",
    hat: "black",
    brain: "right",
    blurb: "Being hooked because you don't know what will happen next.",
  },
  {
    id: 8,
    name: "Loss & Avoidance",
    short: "Avoidance",
    hat: "black",
    brain: null,
    blurb: "Acting to avoid losing something or to avoid a negative outcome.",
  },
];

export const DRIVE_IDS = DRIVES.map((d) => d.id);

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Average scores per Octalysis group, computed from the per-drive scores.
// Shown next to the model's own verdict so contradictions are visible.
export function computeLeanings(scoresById) {
  const avg = (pred) => mean(DRIVES.filter(pred).map((d) => scoresById[d.id]));
  return {
    white: avg((d) => d.hat === "white"),
    black: avg((d) => d.hat === "black"),
    extrinsic: avg((d) => d.brain === "left"),
    intrinsic: avg((d) => d.brain === "right"),
  };
}
