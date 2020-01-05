/* global window */

import shadow from './stoneShadow';
import CanvasBoard from '..';
import { Color } from '../../types';
import { DrawHandler } from '../types';

// Check if image has been loaded properly
// see https://stereochro.me/ideas/detecting-broken-images-js
function isOkay(img: any) {
  if (typeof img === 'string') { return false; }
  if (!img.complete) { return false; }
  if (typeof img.naturalWidth !== 'undefined' && img.naturalWidth === 0) {
    return false;
  }
  return true;
}

// Shadow handler for the 'REALISTIC' rendering mode
// handler for image based stones
export default function (graphic: any[], fallback: DrawHandler) {
  const randSeed = Math.ceil(Math.random() * 9999999);
  let redrawRequest: number;

  return {
    stone: {
      draw (canvasCtx: CanvasRenderingContext2D, args: any, board: CanvasBoard) {
        const stoneRadius = board.config.theme.stoneSize;
        const count = graphic.length;
        const idx = randSeed % (count + args.x * board.size + args.y) % count;

        if (typeof graphic[idx] === 'string') {
          // The image has not been loaded yet
          const stoneGraphic = new Image();
          // Redraw the whole board after the image has been loaded.
          // This prevents 'missing stones' and similar graphical errors
          // especially on slower internet connections.
          stoneGraphic.onload = () => {
            // make sure board will be redraw just once, and after every stone is processed
            if (redrawRequest != null) {
              window.clearTimeout(redrawRequest);
            }
            redrawRequest = window.setTimeout(() => {
              board.redraw();
              redrawRequest = null;
            }, 1);
          };
          stoneGraphic.src = board.config.theme.imageFolder + graphic[idx];
          graphic[idx] = stoneGraphic;
        }

        if (isOkay(graphic[idx])) {
          canvasCtx.drawImage(graphic[idx], -stoneRadius, -stoneRadius, 2 * stoneRadius, 2 * stoneRadius);
        } else {
          // Fall back to SHELL handler if there was a problem loading the image
          fallback.stone.draw(canvasCtx, args, board);
        }
      },
    },
    shadow,
  };
}
