/** Match native fractional layout metrics; RN Web's offsetWidth rounds them. */
export function nativePreviewLayout(event) {
  const target = event.nativeEvent?.target;
  const rect = target?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return event;
  return { ...event, nativeEvent: { ...event.nativeEvent, layout: { ...event.nativeEvent.layout, width: rect.width, height: rect.height } } };
}
