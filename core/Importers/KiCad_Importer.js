const fs = require('fs');
const path = require('path');

const { createSVGWindow } = require('svgdom')
const window = createSVGWindow()
const document = window.document
const { SVG, registerWindow } = require('@svgdotjs/svg.js')
registerWindow(window, document)

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

	static Lib_Draw_Arc(svg, args) {
	}

	static Lib_Draw_Circle(svg, args) {
		let defParams = [
			{ name: 'posx', type: 'number', default: 0 },
			{ name: 'posy', type: 'number', default: 0 },
			{ name: 'radius', type: 'number', default: 0 },
			{ name: 'unit', type: 'number', default: 0 },
			{ name: 'convert', type: 'number', default: 0 },
			{ name: 'thickness', type: 'number', default: 0 },
			{ name: 'fill', type: 'string', default: null }					
		];
		let params = Helpers.ArgsToObject(args, defParams);

		let d = (params.radius * 2) * KiCad_Importer.scale;
		let px = (params.posx - params.radius) * KiCad_Importer.scale;
		let py = (params.posy - params.radius) * KiCad_Importer.scale;

		svg.circle(d).move(px, py).fill('none').stroke({ width: 1 });
	}

	static Lib_Draw_Polyline(svg, args) {
		let defParams = [
			{ name: 'point_count', type: 'number', default: 0 },
			{ name: 'unit', type: 'number', default: 0 },
			{ name: 'convert', type: 'number', default: 0 },
			{ name: 'thickness', type: 'number', default: 0 }			
		];
		let params = Helpers.ArgsToObject(args, defParams);

		let points = [];
		for (var pIdx = 0; pIdx < params.point_count; pIdx++) {
			let px = +args[(pIdx * 2) + 4] * KiCad_Importer.scale;
			let py = +args[(pIdx * 2) + 5] * KiCad_Importer.scale;

			points.push([px, py]);
		}

		svg.polyline(points).fill('none').stroke({ width: 1 });
	}

	static Lib_Draw_Rectangle(svg, args) {
		let defParams = [
			{ name: 'startx', type: 'number', default: 0 },
			{ name: 'starty', type: 'number', default: 0 },
			{ name: 'endx', type: 'number', default: 0 },
			{ name: 'endy', type: 'number', default: 0 },
			{ name: 'unit', type: 'number', default: 0 },
			{ name: 'convert', type: 'number', default: 0 },
			{ name: 'thickness', type: 'number', default: 0 },
			{ name: 'fill', type: 'string', default: null }
		];
		let params = Helpers.ArgsToObject(args, defParams);

		let px = Math.min(params.startx, params.endx) * KiCad_Importer.scale;
		let py = Math.min(params.starty, params.endy) * KiCad_Importer.scale;
		let w = Math.abs(params.startx - params.endx) * KiCad_Importer.scale;
		let h = Math.abs(params.starty - params.endy) * KiCad_Importer.scale;

		svg.rect(w, h).move(px, py).fill('none').stroke({ width: 1 });
	}

	static Lib_Draw_Text(svg, args) {

	}

	static Lib_Draw_Pin(svg, args) {
		let defParams = [
			{ name: 'name', type: 'string', default: null },
			{ name: 'num', type: 'number', default: 0 },
			{ name: 'posx', type: 'number', default: 0 },
			{ name: 'posy', type: 'number', default: 0 },
			{ name: 'length', type: 'number', default: 0 },
			{ name: 'direction', type: 'string', default: null },
			{ name: 'name_text_size', type: 'number', default: 0 },
			{ name: 'num_text_size', type: 'number', default: 0 },
			{ name: 'unit', type: 'number', default: 0 },
			{ name: 'convert', type: 'number', default: 0 },
			{ name: 'electrical_type', type: 'string', default: null },
			{ name: 'pin_type', type: 'string', default: null }			
		];
		let params = Helpers.ArgsToObject(args, defParams);
/*
		let l = params.length * KiCad_Importer.scale;
		let lh = l / 2;
		let px = params.posx * KiCad_Importer.scale;
		let py = params.posy * KiCad_Importer.scale;

		var ex = px;
		var ey = py;
		var dx = px;
		var dy = py;

		switch (params.direction.toUpperCase()) {
			case 'D':
				dx = ex = px;
				ey = py - lh;
				dy = py - l;
				break;
			case 'U':
				dx = ex = px;
				ey = py + lh;
				dy = py + l;
				break;
			case 'L':
				ex = px - lh;
				dx = px - l;
				dy = ey = py;
				break;
			case 'R':
				ex = px + lh;
				dx = px + l;
				dy = ey = py;
				break;
		}

		svg.line(px, py, ex, ey).stroke({ width: 1 });

		svg.line(ex, ey, dx, dy).stroke({ width: 1 });*/
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