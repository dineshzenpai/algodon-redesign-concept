// Small progressive-enhancement helpers: interactions never depend on a CDN.
const elements = target => typeof target === 'string' ? [...document.querySelectorAll(target)] : target instanceof Element ? [target] : Array.from(target || []);
const easing = value => Array.isArray(value) ? `cubic-bezier(${value.join(',')})` : ({ easeOut:'ease-out', easeIn:'ease-in', easeInOut:'ease-in-out' }[value] || value || 'ease');

export const stagger = interval => index => interval * index;
export function animate(target, properties, options = {}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animations = elements(target).map((element, index) => {
    const count = Math.max(1, ...Object.values(properties).map(value => Array.isArray(value) ? value.length : 1));
    const frames = Array.from({ length:count }, (_, frame) => {
      const values = Object.fromEntries(Object.entries(properties).map(([key,value]) => [key, Array.isArray(value) ? value[Math.min(frame,value.length-1)] : value]));
      const transform = [];
      for (const key of ['x','y']) if (key in values) { transform.push(`translate${key.toUpperCase()}(${typeof values[key] === 'number' ? `${values[key]}px` : values[key]})`); delete values[key]; }
      if ('scale' in values) { transform.push(`scale(${values.scale})`); delete values.scale; }
      if (transform.length) values.transform = transform.join(' ');
      return values;
    });
    if (!element.animate || reduced) {
      Object.assign(element.style, frames[frames.length-1]);
      return null;
    }
    return element.animate(frames, {
      duration:(options.duration ?? .3)*1000,
      delay:(typeof options.delay === 'function' ? options.delay(index) : options.delay || 0)*1000,
      easing:easing(options.ease), fill:'forwards'
    });
  }).filter(Boolean);
  return { finished:Promise.all(animations.map(animation => animation.finished.catch(() => {}))), cancel:() => animations.forEach(animation => animation.cancel()) };
}
export function inView(target, callback) {
  const targets = elements(target);
  if (!('IntersectionObserver' in window)) { targets.forEach(element => callback(element)); return () => {}; }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { observer.unobserve(entry.target); callback(entry.target, entry); } });
  });
  targets.forEach(element => observer.observe(element));
  return () => observer.disconnect();
}
