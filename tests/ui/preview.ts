import { createInitialState } from '../../src/data/defaults';
import { deriveFrame } from '../../src/render/frame';
import { canvasRenderer } from '../../src/render/canvas-renderer';
import { createStore } from '../../src/state/store';
import { mountWorkspace } from '../../src/ui/workspace';

const root = document.querySelector<HTMLElement>('#preview');
if (!root) throw new Error('Falta el nodo de vista previa');
const store = createStore(createInitialState());
mountWorkspace(root, store, {
  capture: () => undefined,
  render(state) {
    const canvas = root.querySelector<HTMLCanvasElement>('.co-canvas');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvasRenderer.renderView(context, deriveFrame(state.project, state.runtime.timeSeconds, state.ui.activeView), { guides: state.ui.showGuides });
  },
});
