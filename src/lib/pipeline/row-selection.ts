// Spreadsheet-style shift-click range selection: click row 3, shift-click
// row 30, and everything between gets selected/deselected together instead
// of clicking one by one.
export function applyShiftRangeSelection(
  current: Record<string, boolean>,
  orderedIds: string[],
  anchorIndex: number,
  targetIndex: number,
  select: boolean
): Record<string, boolean> {
  const [start, end] =
    anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  const next = { ...current };
  for (let i = start; i <= end; i++) {
    const id = orderedIds[i];
    if (!id) continue;
    if (select) next[id] = true;
    else delete next[id];
  }
  return next;
}
