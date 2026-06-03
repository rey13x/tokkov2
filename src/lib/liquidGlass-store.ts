import { proxy } from 'valtio';

export const liquidGlassState = proxy({
  hovered: false,
  clicked: false,
  isDragging: false,
  reflectivity: 0.45,
  mouseX: 0,
  mouseY: 0,
});
