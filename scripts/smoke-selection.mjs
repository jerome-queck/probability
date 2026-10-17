export function selectSmokeStates(states, only, viewportNames, feature) {
  if (only !== undefined && feature !== undefined)
    throw new Error('Choose --only FEATURE/STATE or --feature ID.');
  const selected = states.filter((step) =>
    only !== undefined
      ? `${step.feature}/${step.id}` === only
      : feature === undefined || step.feature === feature,
  );
  if (!selected.length)
    throw new Error(
      only !== undefined
        ? `unknown smoke state “${only}”; use an exact feature/state from smoke.json`
        : feature !== undefined
          ? `unknown smoke feature “${feature}”`
          : 'smoke has no states to run',
    );
  for (const step of selected) {
    const widths = step.viewports ?? viewportNames;
    if (!widths.length || widths.some((vp) => !viewportNames.includes(vp)))
      throw new Error(`invalid viewports for ${step.feature}/${step.id}`);
  }
  return selected;
}
