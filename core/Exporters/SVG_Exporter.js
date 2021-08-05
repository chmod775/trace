const path = require("path");
const fs = require("fs");
const Logger = require("../Utils/Logger");
const Exporter = require("./_Exporter");

const elksvg = require('../../extern/elkjs-svg/elkjs-svg.js');
const Schematic_Generator = require("../Generators/Schematic_Generator");

class SVG_Exporter extends Exporter {
  static async Export() {
    const Trace = require('../Trace');

    for (var b of Trace.boards) {
      let elkLayout = await Schematic_Generator.Generate(b);

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
  
      let ret = renderer.toSvg(elkLayout);
      let filename = `out/svg/${b.name}.svg`;
      fs.writeFileSync(path.join(Trace.directory, filename), ret);
      Logger.Info('Exported SVG', filename);
    }
  }
}

module.exports = SVG_Exporter;