// A well-formed audit, as the model would return it.
export const sampleAudit = {
  drives: [
    { id: 1, score: 4, justification: "Framed as learning for self-improvement, but there is no larger mission users join." },
    { id: 2, score: 9, justification: "XP, levels, leagues and a visible skill tree make progress constant and legible." },
    { id: 3, score: 3, justification: "Lessons are fixed sequences with little room for learners to experiment or create." },
    { id: 4, score: 6, justification: "Gems, streak freezes and outfits give users things to collect and protect." },
    { id: 5, score: 7, justification: "Friends, leaderboards and friend quests add competition and light accountability." },
    { id: 6, score: 5, justification: "Limited hearts and time-boxed league promotions create some urgency." },
    { id: 7, score: 4, justification: "Occasional chests and random rewards add a little surprise." },
    { id: 8, score: 9, justification: "The streak, and the fear of losing it, is the main reason many users return daily." },
  ],
  hat: { lean: "black", reason: "Retention leans heavily on streak-loss anxiety and scarcity rather than empowerment." },
  motivation: { lean: "extrinsic", reason: "Points, levels and streak counts drive behaviour more than enjoyment of the language itself." },
  mechanics: [
    { title: "Story-mode conversations", target_drive: 3, description: "Let learners steer branching dialogues with characters, choosing replies that change the outcome." },
    { title: "Learner-made challenge decks", target_drive: 3, description: "Let users build and share their own sentence sets with friends, who earn XP for completing them." },
    { title: "Mystery phrase of the week", target_drive: 7, description: "Unlock a hidden idiom with a short cultural story after each week of lessons." },
  ],
};

// A stand-in for the Anthropic client: returns `text` as the model's answer.
export function stubClient(text, overrides = {}) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        async create(params) {
          calls.push(params);
          return {
            model: params.model,
            stop_reason: "end_turn",
            stop_details: null,
            content: [{ type: "text", text }],
            ...overrides,
          };
        },
      },
    },
  };
}
