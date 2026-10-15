import test from 'node:test';
import assert from 'node:assert/strict';
import { animate, inView, stagger } from '../frontend/src/shared/motion.js';

test('native animations preserve transforms, timing and reduced-motion behavior', async () => {
  const original = { window:globalThis.window, Element:globalThis.Element };
  class FakeElement { style = {}; }
  globalThis.Element = FakeElement;
  globalThis.window = { matchMedia:() => ({ matches:false }) };
  try {
    const element = new FakeElement();
    let captured;
    element.animate = (frames, options) => {
      captured = { frames, options };
      return { finished:Promise.resolve(), cancel() {} };
    };
    await animate(element, { opacity:[0,1], y:[30,0] }, { duration:.8, delay:stagger(.15), ease:[.22,1,.36,1] }).finished;
    assert.deepEqual(captured.frames, [{ opacity:0, transform:'translateY(30px)' }, { opacity:1, transform:'translateY(0px)' }]);
    assert.equal(captured.options.duration, 800);
    assert.equal(captured.options.easing, 'cubic-bezier(0.22,1,0.36,1)');
    globalThis.window.matchMedia = () => ({ matches:true });
    element.animate = () => { throw new Error('Reduced motion must avoid animation'); };
    await animate(element, { opacity:[0,1], scale:[.95,1] }).finished;
    assert.deepEqual(element.style, { opacity:1, transform:'scale(1)' });
    let observed;
    inView(element, target => { observed = target; });
    assert.equal(observed, element);
  } finally {
    for (const [name,value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  }
});
