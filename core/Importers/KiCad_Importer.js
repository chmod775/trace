const fs = require('fs');
const path = require('path');

const Helpers = require('../Utils/Helpers');
const Logger = require('../Utils/Logger');

const Importer = require('./_Importer');
const Trace = require('../Trace');

class KiCad_Importer extends Importer {
	/* ### Symbols ### */
	static LibraryFolder() {
		let folders = {
			'win32' : 'C:\\Program Files\\KiCad\\share\\kicad\\library',
			'linux' : '/usr/share/kicad/library'
		}
		return folders[process.platform] ?? '.';
	}

	static LoadLibrary(libFilename) {
		const Trace = require('../Trace');
		
		let libraryName = path.basename(libFilename, path.extname(libFilename));

    let parts = KiCad_Importer.ParseLibrary(libFilename);

		for (var d of parts.defs) {
			let lib = d.parsed;
      lib.doc = (lib.partName in parts.docs) ? parts.docs[lib.partName].parsed : Trace.Symbol.Doc_Empty();
      lib.libraryName = libraryName;

			let newComponent = function() {
				return class extends Trace.Component { constructor(_) { super(_); }}
			}();
			newComponent.lib = lib;

			let name = Helpers.JSSafe(lib.partName, '_');
			let name_org = name;
			let name_cnt = 1;
			while (name in Trace.Library) {
				name = `${name_org}_${name_cnt++}`;
				Logger.Warning('Part name already existing', `changing to ${name}`);
      }

			newComponent._name = name;
/*
			newComponent.libraryName = lib.libraryName;
			newComponent.partName = lib.name;
			newComponent.doc = lib.doc;
			newComponent.prefix = lib.reference;
			newComponent.pinout = lib.pins;
*/
			Trace.Catalog[libraryName] = Trace.Catalog[libraryName] ?? {};
			Trace.Catalog[libraryName][lib.partName] = newComponent;

			Trace.Library[newComponent._name] = newComponent;
		}

		return true;
	}

	static LoadDefaultLibrary(libraryName) {
		let libFilename = path.join(KiCad_Importer.LibraryFolder(), libraryName);
		return KiCad_Importer.LoadLibrary(libFilename);
	}

  static ParseLibrary(filename) {
		let lib_data = fs.readFileSync(filename + '.lib', { encoding: 'utf8' , flag: 'r' });
    let dcm_data = fs.existsSync(filename + '.dcm') ? fs.readFileSync(filename + '.dcm', { encoding: 'utf8' , flag: 'r' }) : null;

		KiCad_Importer.Lib_Check(lib_data);

    let docs = {};
    if (dcm_data) {
      KiCad_Importer.Doc_Check(dcm_data);
      docs = KiCad_Importer.Doc_GetCmps(dcm_data);
    }

    let defs = KiCad_Importer.Lib_GetDefs(lib_data);

		return {
      defs: defs,
      docs: docs
    }
  }


	/* ### Footprints ### */
	static FootprintFolder() {
		let folders = {
			'win32' : 'C:\\Program Files\\KiCad\\share\\kicad\\modules',
			'linux' : '/usr/share/kicad/modules'
		}
		return folders[process.platform] ?? '.';
	}

  static LoadFootprint(filepath) {
    const Trace = require('../Trace');
    
    let data = fs.readFileSync(filepath, { encoding: 'utf8' , flag: 'r' });
		let extension = path.extname(filepath);
		let filename = path.basename(filepath, extension);

    let parentDirectory = path.dirname(filepath);
    let directory = path.basename(parentDirectory, path.extname(parentDirectory));

    let ret = new Trace.Footprint();
    ret.name = filename;
    ret.group = directory;

    // Easy for the moment
    ret.pads.length = KiCad_Importer.Footprint_CountPads(data);

    return ret;
  }

	/* ### .lib ### */
	static scale = 0.15;

	static Lib_Check(data) {
		if (!data.startsWith('EESchema-LIBRARY')) throw 'Lib not recognized';
	}

	static Lib_ParseDef(def) {
    const Trace = require('../Trace');
		let ret = new Trace.Symbol();

		let lines = def.split('\n');

		do {
			let l = lines.shift();
			let parts = Helpers.SplitLine(l);

			let token = parts[0];

			if (token == 'DEF') {
				ret.partName = parts[1].replace(/\"/g, '');
			} else if (token == 'F0') {
				ret.reference = parts[1].replace(/\"/g, '');
			} else if (token == 'F1') {
				ret.value = parts[1].replace(/\"/g, '');
			} else if (token == 'F2') {
        var inlineFilter = parts[1].replace(/\"/g, '');
				ret.footprintFiters = (inlineFilter.length > 0) ? [ inlineFilter ] : [ '*' ];
			} else if (token == 'F3') {
				ret.datasheet = parts[1].replace(/\"/g, '');
			} else if (token == '$FPLIST') {
        ret.footprintFiters = [];
        do {
          l = lines.shift().trim();
          if (l.length > 0)
            ret.footprintFiters.push(l);
        } while (!l.startsWith('$ENDFPLIST'));
        ret.footprintFiters.pop();

			} else if (token == 'X') {
				let newPin = {
					name: parts[1],
					num: parts[2],
					pos: {
						x: parts[3],
						y: parts[4]
					},
					length: parts[5],
					direction: parts[6],
					name_text_size: parts[7],
					num_text_size: parts[8],
					unit_num: parts[9],
					convert: parts[10],
					electrical_type: parts[11]
				}
        ret.AddPin(newPin);
      } else {
        ret._AddShape(token, parts.splice(1));
      }
		} while (lines.length > 0);

		return ret;
	}

	static Lib_GetDefAt(data, at) {
		let def_idx = data.indexOf('\nDEF', at);
		let enddef_idx = data.indexOf('\nENDDEF', at);

		if (def_idx < 0) return null;
		if (enddef_idx < 0) return null;

		if (enddef_idx < def_idx) return null;

		let content = data.substring(def_idx + 1, enddef_idx + 8);

		return {
			content: content,
      parsed: KiCad_Importer.Lib_ParseDef(content),
			def_idx: def_idx + 1,
			enddef_idx: enddef_idx + 8
		}
	}

	static Lib_GetDefs(data) {
		let ret = [];
		var def = { enddef_idx: 0 };
		do {
			def = this.Lib_GetDefAt(data, def.enddef_idx);
			if (def) {
        if (def.parsed.svg) {
          def.parsed.svg.viewbox(def.parsed.svg.bbox());
        }
				ret.push(def);
      }
		} while (def);
		return ret;
	}

  /* ### .dcm ### */
  static Doc_Check(data) {
		if (!data.startsWith('EESchema-DOCLIB')) throw 'Doc not recognized';
  }

  static Doc_ParseCmp(cmp) {
    const Trace = require('../Trace');
		let ret = Trace.Symbol.Doc_Empty();

		let lines = cmp.split('\n');

		for (var l of lines) {
			let parts = Helpers.SplitLine(l);

			let token = parts[0];

			if (token == '$CMP') {
				ret.name = parts[1];
			} else if (token == 'D') {
				ret.description = l.substring(2);
			} else if (token == 'K') {
				ret.usage = l.substring(2);
			} else if (token == 'F') {
				ret.datasheetUrl = l.substring(2);
			}
		}

		return ret;
  }

  static Doc_GetCmpAt(data, at) {
		let cmp_idx = data.indexOf('\n$CMP', at);
		let endcmp_idx = data.indexOf('\n$ENDCMP', at);

    if (cmp_idx < 0) return null;
		if (endcmp_idx < 0) return null;

		if (endcmp_idx < cmp_idx) return null;

		let content = data.substring(cmp_idx + 1, endcmp_idx + 9);
    return {
      content: content,
      parsed: KiCad_Importer.Doc_ParseCmp(content),
			cmp_idx: cmp_idx + 1,
			endcmp_idx: endcmp_idx + 9
    }
  }

  static Doc_GetCmps(data) {
		let ret = {};
		var cmp = { endcmp_idx: 0 };
		do {
			cmp = this.Doc_GetCmpAt(data, cmp.endcmp_idx);
			if (cmp)
				ret[cmp.parsed.name] = cmp;
		} while (cmp);
		return ret;
  }

  /* ### kicad_mod ### */
  static Footprint_CountPads(data) {
    return data.split('(pad').length - 1;
  }
}

module.exports = KiCad_Importer;