/** Visual-only local cover selection; does not invent or persist speech metadata. */
export function speechCover(title: string) {
  const name = /health|健康/i.test(title)
    ? "health"
    : /challenge|挑战/i.test(title)
      ? "challenges"
      : /interview|dialogue|面试/i.test(title)
        ? "interview"
        : /focus|专注/i.test(title)
          ? "focus"
          : /future|work|未来|工作/i.test(title)
            ? "future"
            : "small-actions";
  return `./assets/convergence/cover-${name}.png`;
}
