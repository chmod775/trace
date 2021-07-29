const elksvg = require('../extern/elkjs-svg/elkjs-svg.js');

class Schematic_Generator {
  constructor(elkLayout) {
    this.elkLayout = elkLayout;
  }

  GenerateSVG() {
    //console.log(JSON.stringify(this.elkLayout));

    let renderer = new elksvg.Renderer();

    // DEBUG injection
    renderer.registerEdges = function(p) {
      (p.edges || []).forEach((e) => {
        e.sources.forEach(source_id => {

          e.targets.forEach(target_id => {
            if (source_id.includes("_")) {
              source_id = source_id.slice(0, source_id.indexOf("_"));
            }
            if (!this.isDescendant(source_id, target_id)) {
              source_id = this._parentIds[source_id];
            }
            this._edgeParents[source_id].push(e);
          });
        });
      });
      (p.children || []).forEach(c => this.registerEdges(c));
    }

    var ret = renderer.toSvg(this.elkLayout);
    return ret;
  }
}

module.exports = Schematic_Generator;