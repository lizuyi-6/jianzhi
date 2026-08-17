import { useEffect, useState } from 'react';

let showFn: ((msg: string) => void) | null = null;

export function showToast(message: string) {
  showFn?.(message);
}

export default function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    showFn = (m: string) => {
      setMsg(m);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2400);
    };
    return () => { showFn = null; if (timer) clearTimeout(timer); };
  }, []);

  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}
