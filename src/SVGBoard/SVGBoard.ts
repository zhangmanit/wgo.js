import { BoardBase, BoardViewport, BoardObject } from '../BoardBase';
import makeConfig, { PartialRecursive } from '../utils/makeConfig';
import createGrid from './createGrid';
import createCoordinates from './createCoordinates';
import { SVGDrawHandler, SVGBoardConfig, NS, OBJECTS, BoardObjectSVGElements, GRID_MASK } from './types';
import { defaultBoardBaseConfig } from '../BoardBase/defaultConfig';
import defaultSVGTheme from './defaultSVGTheme';
import generateId from './generateId';

const svgBoardDefaultConfig: SVGBoardConfig = {
  ...defaultBoardBaseConfig,
  theme: defaultSVGTheme,
};

export default class SVGBoard extends BoardBase<SVGDrawHandler> {
  config: SVGBoardConfig;
  svgElement: SVGElement;
  defsElement: SVGElement;
  objectsElementMap: Map<BoardObject<SVGDrawHandler>, BoardObjectSVGElements>;

  /** Drawing contexts - elements to put additional board objects. Similar to layers. */
  contexts: {
    [key: string]: SVGElement;
  } = {};

  constructor (elem: HTMLElement, config: PartialRecursive<SVGBoardConfig> = {}) {
    super(elem, makeConfig(svgBoardDefaultConfig, config));

    this.svgElement = document.createElementNS(NS, 'svg');
    this.svgElement.style.cursor = 'default';
    this.svgElement.style.display = 'block';
    this.element.appendChild(this.svgElement);

    this.defsElement = document.createElementNS(NS, 'defs');
    this.svgElement.appendChild(this.defsElement);

    this.setViewport();
    this.resize();
    this.redraw();
  }

  resize() {
    if (this.config.width && this.config.height) {
      this.svgElement.style.width = `${this.config.width}px`;
      this.svgElement.style.height = `${this.config.height}px`;
    } else if (this.config.width) {
      this.svgElement.style.width = `${this.config.width}px`;
      this.svgElement.style.height = 'auto';
    } else if (this.config.height) {
      this.svgElement.style.width = 'auto';
      this.svgElement.style.height = `${this.config.height}px`;
    } else {
      this.svgElement.style.width = '100%';
      this.svgElement.style.height = 'auto';
    }
  }

  redraw() {
    this.svgElement.style.backgroundColor = this.config.theme.backgroundColor;

    if (this.config.theme.backgroundImage) {
      this.svgElement.style.backgroundImage = `url('${this.config.theme.backgroundImage}')`;
    } else {
      this.svgElement.style.backgroundImage = '';
    }

    this.drawGrid();
    this.drawCoordinates();
    this.drawObjects();
  }

  drawGrid() {
    if (this.contexts[GRID_MASK]) {
      this.svgElement.removeChild(this.contexts[GRID_MASK]);
    }

    if (this.contexts.gridElement) {
      this.svgElement.removeChild(this.contexts.gridElement);
    }

    // create grid mask
    const { size } = this.config;
    this.contexts[GRID_MASK] = document.createElementNS(NS, 'mask');
    this.contexts[GRID_MASK].id = generateId('mask');
    this.contexts[GRID_MASK].innerHTML = `<rect x="-0.5" y="-0.5" width="${size}" height="${size}" fill="white" />`;
    this.svgElement.appendChild(this.contexts[GRID_MASK]);

    // create grid
    this.contexts.gridElement = createGrid(this.config);
    this.contexts.gridElement.setAttribute('mask', `url(#${this.contexts[GRID_MASK].id})`);
    this.svgElement.appendChild(this.contexts.gridElement);
  }

  drawCoordinates() {
    if (this.contexts.coordinatesElement) {
      this.svgElement.removeChild(this.contexts.coordinatesElement);
    }

    this.contexts.coordinatesElement = createCoordinates(this.config);
    this.contexts.coordinatesElement.style.opacity = this.config.coordinates ? '' : '0';
    this.svgElement.appendChild(this.contexts.coordinatesElement);
  }

  drawObjects() {
    if (this.contexts[OBJECTS]) {
      this.svgElement.removeChild(this.contexts[OBJECTS]);
    }

    this.objectsElementMap = new Map();

    this.contexts[OBJECTS] = document.createElementNS(NS, 'g');
    this.svgElement.appendChild(this.contexts[OBJECTS]);

    this.objects.forEach(boardObject => this.createObjectElements(boardObject));
  }

  addObject(boardObject: BoardObject<SVGDrawHandler> | BoardObject<SVGDrawHandler>[]) {
    super.addObject(boardObject);

    if (!Array.isArray(boardObject)) {
      if (this.objectsElementMap.get(boardObject)) {
        // already added - just redraw it
        this.updateObject(boardObject);
        return;
      }

      this.createObjectElements(boardObject);
    }
  }

  protected createObjectElements(boardObject: BoardObject<SVGDrawHandler>) {
    const handler = this.getObjectHandler(boardObject);

    // create element or elements and add them to the svg
    const elem = handler.createElement(this.config, (def: SVGElement) => this.defsElement.appendChild(def));
    let elements: BoardObjectSVGElements;

    if (elem instanceof SVGElement) {
      elements = { [OBJECTS]: elem };
    } else {
      elements = elem;
    }
    this.objectsElementMap.set(boardObject, elements);
    Object.keys(elements).forEach(key => this.contexts[key].appendChild(elements[key]));

    handler.updateElement(elements, boardObject, this.config);
  }

  getObjectHandler(boardObject: BoardObject<SVGDrawHandler>) {
    return typeof boardObject.type === 'string' ? this.config.theme.drawHandlers[boardObject.type] : boardObject.type;
  }

  removeObject(boardObject: BoardObject<SVGDrawHandler> | BoardObject<SVGDrawHandler>[]) {
    super.removeObject(boardObject);

    if (!Array.isArray(boardObject)) {
      const elements = this.objectsElementMap.get(boardObject);
      if (elements) {
        this.objectsElementMap.delete(boardObject);
        Object.keys(elements).forEach(key => this.contexts[key].removeChild(elements[key]));
      }
    }
  }

  updateObject(boardObject: BoardObject<SVGDrawHandler> | BoardObject<SVGDrawHandler>[]) {
    // handling multiple objects
    if (Array.isArray(boardObject)) {
      for (let i = 0; i < boardObject.length; i++) {
        this.updateObject(boardObject[i]);
      }
      return;
    }

    const elements = this.objectsElementMap.get(boardObject);

    if (!elements) {
      // updated object isn't on board - ignore, add or warning?
      return;
    }

    const handler = this.getObjectHandler(boardObject);
    handler.updateElement(elements, boardObject, this.config);
  }

  setViewport(viewport: BoardViewport = this.config.viewport) {
    super.setViewport(viewport);

    const { coordinates, theme, size } = this.config;
    const { marginSize } = theme;
    const { fontSize } = theme.coordinates;

    const top = viewport.top - 0.5 - (coordinates && !viewport.top ? fontSize : 0) - marginSize;
    const left = viewport.left - 0.5 - (coordinates && !viewport.left ? fontSize : 0) - marginSize;
    const bottom = size - 0.5 - top - viewport.bottom + (coordinates && !viewport.bottom ? fontSize : 0) + marginSize;
    const right = size - 0.5 - left - viewport.right + (coordinates && !viewport.right ? fontSize : 0) + marginSize;
    this.svgElement.setAttribute('viewBox', `${left} ${top} ${right} ${bottom}`);
  }

  setSize(size: number = 19) {
    super.setSize(size);
    this.drawGrid();
    this.drawCoordinates();
    this.setViewport();
  }

  setCoordinates(coordinates: boolean) {
    super.setCoordinates(coordinates);
    this.contexts.coordinatesElement.style.opacity = this.config.coordinates ? '' : '0';
    this.setViewport();
  }
}
