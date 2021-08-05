const Generator = require('./_Generator');

class BOM_Generator extends Generator {
  constructor() {
    super();

    this.components = [];
  }

  Group() {
    let ret = {};

    for (var c of this.components) {
      let key = `${(c.constructor.libraryName ?? '').toLowerCase()}_${(c.constructor.partName ?? '').toLowerCase()}_${(c.value ?? '').toLowerCase()}`;
      ret[key] = ret[key] ?? [];
      ret[key].push(c);
    }

    return ret;
  }

  AddComponent(component) {
    this.components.push(component);
  }

  ProcessBoard(board) {
    this.components = this.components.concat(board.components);
  }

  static Generate(boardRef) {
    let gen = new BOM_Generator();
    boardRef = Array.isArray(boardRef) ? boardRef : [boardRef];

    for (var b of boardRef)
      gen.ProcessBoard(b);

    return gen.Group();
  }
}
module.exports = BOM_Generator;