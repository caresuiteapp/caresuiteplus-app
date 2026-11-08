import { useEffect, useState } from 'react';

/** Keep local time aligned to minute boundaries, with an empty SSR snapshot. */
export function useLocalMinute() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const timestamp = Date.now();
      setNow(new Date(timestamp));
      timer = setTimeout(tick, 60_000 - (timestamp % 60_000));
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  return now;
}
