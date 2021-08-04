const Exporter = require("./_Exporter");
const elksvg = require('../../extern/elkjs-svg/elkjs-svg.js');
const Schematic_Generator = require("../Generators/Schematic_Generator");
const path = require("path");
const fs = require("fs");

class SVG_Exporter extends Exporter {
  static async Export() {
    let elkGen = new Schematic_Generator();
    let elkLayout = await elkGen.Generate();

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

    var ret = renderer.toSvg(elkLayout);
    console.log(Trace.project);
		fs.writeFileSync(path.join(Trace.project.directory, 'test.svg'), ret);

    return ret;
  }
}

module.exports = SVG_Exporter;