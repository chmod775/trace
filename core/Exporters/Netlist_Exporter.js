const fs = require("fs");
const path = require("path");
const Logger = require("../Utils/Logger");
const Exporter = require("./_Exporter");

const Netlist_Generator = require("../Generators/Netlist_Generator");

class Netlist_Exporter extends Exporter {
  static Export() {
    const Trace = require('../Trace');
    for (var b of Trace.boards) {
      let gen = Netlist_Generator.Generate(b);

      let filename = `out/netlist/${b.name}.net`;
      fs.writeFileSync(path.join(Trace.directory, filename), gen);
      Logger.Info('Exported Netlist', filename);
    }
  }
}
module.exports = Netlist_Exporter;