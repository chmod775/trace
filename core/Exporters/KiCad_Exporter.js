const fs = require("fs");
const path = require("path");
const Logger = require("../Utils/Logger");
const Exporter = require("./_Exporter");

const Netlist_Generator = require("../Generators/Netlist_Generator");
const { Lisp_Statement } = require("../Utils/Parsers/Lisp_Parser");

class KiCad_Exporter extends Exporter {
  static Export() {
    const Trace = require('../Trace');

    // Netlists
    for (var b of Trace.boards) {
      let gen = Netlist_Generator.Generate(b);

      let filename = `out/kicad/${b.name}.net`;
      fs.writeFileSync(path.join(Trace.directory, filename), gen);
      Logger.Info('Exported Netlist', filename);
    }

    // Custom-Libraries
    for (var b of Trace.boards) {
      let components = b.components;
      for (var c of components) {
        let generatedFootprint = KiCad_Exporter.GenerateFootprint(c);
        console.log(generatedFootprint);
      }
    }
    

  }

  static GenerateFootprint(component) {
    let footprint = component.$Footprint();
    if (!footprint) return;

    let root = new Lisp_Statement('module');
    root.AddArgument(component.constructor.name);
    root.AddArgument(new Lisp_Statement('layer', ['F.Cu']));

    for (let pad of footprint.pads) {
      let newPad = new Lisp_Statement('pad', [pad.name, pad.type, pad.shape]);

      if (pad.pos)
        newPad.AddArgument(new Lisp_Statement('at', pad.pos.angle ? [pad.pos.x, pad.pos.y, pad.pos.angle] : [pad.pos.x, pad.pos.y]));
      
      if (pad.size)
        newPad.AddArgument(new Lisp_Statement('size', [pad.size.w, pad.size.h]));

      if (pad.drill) {
        let drillStatement = new Lisp_Statement('drill', [pad.drill.size]);
        if (pad.drill.offset) {
          drillStatement.AddArgument(new Lisp_Statement('offset', [pad.drill.offset.x, pad.drill.offset.y]));
        }
        newPad.AddArgument(drillStatement);
      }

      root.AddArgument(newPad);
    }

    return root.toString();
  }
}
module.exports = KiCad_Exporter;