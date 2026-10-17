export function selectSmokeStates(states, only, viewportNames) {
  const selected =
    only === undefined
      ? states
      : states.filter((step) => `${step.feature}/${step.id}` === only);
  if (selected.length === 0)
    throw new Error(
      only === undefined
        ? 'smoke has no states to run'
        : `unknown smoke state “${only}”; use an exact feature/state from smoke.json`,
    );
  for (const step of selected) {
    const widths = step.viewports ?? viewportNames;
    if (widths.length === 0 || widths.some((vp) => !viewportNames.includes(vp)))
      throw new Error(`invalid viewports for ${step.feature}/${step.id}`);
  }
  return selected;
}
