const Trace = require('./core/Trace');
var repl = require("repl");
const Helpers = require('./core/Utils/Helpers');
const path = require('path');
const fs = require('fs');
const { Component } = require('./core/Trace');
const KiCad_Importer = require('./core/Importers/KiCad_Importer');

const { createSVGWindow } = require('svgdom')
const window = createSVGWindow()
const document = window.document
const { SVG, registerWindow } = require('@svgdotjs/svg.js')
registerWindow(window, document)

Trace.Library_LoadKiCadFolder();
Trace.Footprints_LoadKiCadFolder();

function FindComponents(search) {
  let searchRegex = new RegExp(search, 'gi');
  return Trace.Library_FindByRegEx(searchRegex, true);
}

function ListLibraryFiles() {
  let ret = [];
  let files = Helpers.ScanDir(KiCad_Importer.LibraryFolder(), '.lib');
  for (var fIdx in files) {
    let f = files[fIdx];
    var extension = path.extname(f.path);
    var file = path.join(path.dirname(f.path), path.basename(f.path, extension));
    ret.push(f.filename);
  }
  return ret;
}

var local = repl.start("Trace> ");

local.defineCommand('find', {
  help: 'Find component in library',
  action(search) {
    this.clearBufferedCommand();

    let founds = FindComponents(search);

    let out = [];
    for (var f of founds)
      out.push(`[${f.lib.libraryName}] ${f.lib.partName}: ${f.lib.doc ? f.lib.doc.description : ''}`);

    console.log(out.join('\n'));

    this.displayPrompt();
  }
});

local.defineCommand('libraries', {
  help: 'List found libraries in KiCad folder',
  action() {
    this.clearBufferedCommand();

    let founds = ListLibraryFiles();
    console.log(founds.join('\n'));

    this.displayPrompt();
  }
});

local.defineCommand('components', {
  help: 'List components of KiCad library',
  action(libraryName) {
    this.clearBufferedCommand();

    try {
      let parts = Trace.Part[libraryName];

      let out = [];
      for (var pKey in parts) {
        let pVal = parts[pKey];
        out.push(`${pKey}`);
      }
      console.log(out.join('\n'));
    } catch (ex) {
      console.error(`ERROR: Library name "${libraryName}" not found in KiCad folder.`);
    }

    this.displayPrompt();
  }
});

local.defineCommand('describe', {
  help: 'Describe component',
  action(args) {
    this.clearBufferedCommand();

    [libraryName, componentName] = args.split(' ');

    try {
      let part = Trace.Part[libraryName][componentName];
      if (!part) throw 'Component not found';
      console.log(part);
    } catch (ex) {
      console.error(`ERROR: Component named "${componentName}" not found in library named "${libraryName}".`);
    }

    this.displayPrompt();
  }
});

local.defineCommand('footprints', {
  help: 'List compatible footprints for component',
  action(args) {
    this.clearBufferedCommand();

    [libraryName, componentName] = args.split(' ');

    let component = libraryName;

    if (!(component instanceof Component)) {
      let part = Trace.Part[libraryName][componentName];
      if (!part) throw 'Component not found';
      component = new part();
    }

    let ret = Trace.Footprints_UpdateComponentCache(component);

    console.log(ret);
    this.displayPrompt();
  }
});

var comp = null;

local.defineCommand('svg', {
  help: 'Save SVG of component',
  action(args) {
    this.clearBufferedCommand();

    [libraryName, componentName, filename] = args.split(' ');

    if (!filename.includes('.svg')) filename += '.svg';

    if (!(libraryName in Trace.Part)) { console.error(`ERROR: Library named "${libraryName}" not found.`); this.displayPrompt(); return; }
    if (!(componentName in Trace.Part[libraryName])) { console.error(`ERROR: Component named "${componentName}" not found in library named "${libraryName}".`); this.displayPrompt(); return; }
    
    let part = Trace.Part[libraryName][componentName];
    if (!part) throw 'Component not found';

    let component = new part;
    let cSVG = new SVG();
    component.$Symbol().RenderSVG(cSVG);
    local.context.comp = component;

    fs.writeFileSync(filename, cSVG.svg());
    console.log(`Saved SVG of component named "${componentName}" as ${filename}`);

    this.displayPrompt();
  }
});


local.context.Trace = Trace;