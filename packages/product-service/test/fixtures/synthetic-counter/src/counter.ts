export function advanceCounter(current: { value: number }, amount: number): { value: number } {
  if (amount < 0) throw new RangeError("amount must not be negative");
  return { value: current.value + amount };
}
