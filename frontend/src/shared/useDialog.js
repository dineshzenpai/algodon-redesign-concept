import { useEffect } from 'react';

export function useDialog(open, container, close) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const focusables = () => [...(container.current?.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]') || [])].filter(element => !element.disabled && element.getClientRects().length);
    focusables()[0]?.focus();
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const items = focusables(), first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, [open, container, close]);
}
