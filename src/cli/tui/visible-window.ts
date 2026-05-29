export function getVisibleWindow(total: number, selectedIndex: number, maxVisible: number) {
  if (total <= maxVisible) {
    return { startIndex: 0, endIndex: total };
  }

  const halfWindow = Math.floor(maxVisible / 2);
  const maxStartIndex = total - maxVisible;
  const startIndex = Math.max(0, Math.min(selectedIndex - halfWindow, maxStartIndex));

  return {
    startIndex,
    endIndex: startIndex + maxVisible,
  };
}
