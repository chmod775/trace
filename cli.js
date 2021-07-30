const Trace = require('./core/Trace');
var repl = require("repl");

Trace.Library_LoadKiCadFolder();
Trace.Footprints_LoadFromKiCad('./footprints');

function FindComponents(search) {
  let searchRegex = new RegExp(search, 'gi');
  return Trace.Library_FindByRegEx(searchRegex, true);
}


var local = repl.start("Trace> ");

local.defineCommand('find', {
  help: 'Find component in library',
  action(search) {
    this.clearBufferedCommand();

    let founds = FindComponents(search);

    let out = [];
    for (var f of founds)
      out.push(`[${f.libraryName}] ${f.lib.name}: ${f.doc ? f.doc.description : ''}`);

    console.log(out.join('\n'));

    this.displayPrompt();
  }
});

local.context.Trace = Trace;