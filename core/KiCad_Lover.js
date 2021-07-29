const fs = require('fs');
const path = require('path');

const { createSVGWindow } = require('svgdom')
const window = createSVGWindow()
const document = window.document
const { SVG, registerWindow } = require('@svgdotjs/svg.js')
registerWindow(window, document)

const Helpers = require('./Helpers');
const { argv } = require('process');

class KiCad_Lover {
	constructor() {
	}

	static scale = 0.15;

  static LoadLib(filename) {
		let lib_data = fs.readFileSync(filename + '.lib', { encoding: 'utf8' , flag: 'r' });
    let dcm_data = fs.existsSync(filename + '.dcm') ? fs.readFileSync(filename + '.dcm', { encoding: 'utf8' , flag: 'r' }) : null;

		KiCad_Lover.Lib_Check(lib_data);

    let docs = {};
    if (dcm_data) {
      KiCad_Lover.Doc_Check(dcm_data);
      docs = KiCad_Lover.Doc_GetCmps(dcm_data);
    }

    let defs = KiCad_Lover.Lib_GetDefs(lib_data);

		return {
      defs: defs,
      docs: docs
    }
  }

  static LoadFootprint(filepath) {
		let data = fs.readFileSync(filepath, { encoding: 'utf8' , flag: 'r' });
		let extension = path.extname(filepath);
		let filename = path.basename(filepath, extension);

    let parentDirectory = path.dirname(filepath);
    let directory = path.basename(parentDirectory, path.extname(parentDirectory));

    let ret = {
      filename: filename,
      directory: directory,
      pads: []
    };

    // Easy for the moment
    ret.pads.length = KiCad_Lover.Footprint_CountPads(data);

    return ret;
  }

	/* ### .lib ### */
	static Lib_Check(data) {
		if (!data.startsWith('EESchema-LIBRARY')) throw 'Lib not recognized';
	}

	static Lib_Draw_Arc(svg, args) {
	}

	static Lib_Draw_Circle(svg, args) {
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
			let px = +args[(pIdx * 2) + 4] * KiCad_Lover.scale;
			let py = +args[(pIdx * 2) + 5] * KiCad_Lover.scale;

			points.push([px, py]);
		}

		svg.polyline(points).fill('none').stroke({ color: 'black', width: 2 });
	}

	static Lib_Draw_Rectangle(svg, args) {
		let defParams = [
			{ name: 'startx', type: 'number', default: null },
			{ name: 'starty', type: 'number', default: null },
			{ name: 'endx', type: 'number', default: null },
			{ name: 'endy', type: 'number', default: null },
			{ name: 'unit', type: 'number', default: null },
			{ name: 'convert', type: 'number', default: null },
			{ name: 'thickness', type: 'number', default: null },
			{ name: 'fill', type: 'string', default: null }
		];
		let params = Helpers.ArgsToObject(args, defParams);

		let px = Math.min(params.startx, params.endx) * KiCad_Lover.scale;
		let py = Math.min(params.starty, params.endy) * KiCad_Lover.scale;
		let w = Math.abs(params.startx - params.endx) * KiCad_Lover.scale;
		let h = Math.abs(params.starty - params.endy) * KiCad_Lover.scale;

		svg.rect(w, h).move(px, py).fill('none').stroke({ color: 'black', width: 2 });
	}

	static Lib_Draw_Text(svg, args) {

	}

	static Lib_Draw_Pin(svg, args) {
		let defParams = [
			{ name: 'name', type: 'string', default: null },
			{ name: 'num', type: 'number', default: null },
			{ name: 'posx', type: 'number', default: null },
			{ name: 'posy', type: 'number', default: null },
			{ name: 'length', type: 'number', default: null },
			{ name: 'direction', type: 'string', default: null },
			{ name: 'name_text_size', type: 'number', default: null },
			{ name: 'num_text_size', type: 'number', default: null },
			{ name: 'unit', type: 'number', default: null },
			{ name: 'convert', type: 'number', default: null },
			{ name: 'electrical_type', type: 'string', default: null },
			{ name: 'pin_type', type: 'string', default: null }			
		];
		let params = Helpers.ArgsToObject(args, defParams);
	}

	static Lib_ParseDef(def) {
		let ret = {
			name: null,
			reference: null,
			value: null,
			footprints: null,
			datasheet: null,
			pins: [],
			svg: new SVG()
		};

		let drawCallbacks = {
			A: this.Lib_Draw_Arc,
			C: this.Lib_Draw_Circle,
			P: this.Lib_Draw_Polyline,
			S: this.Lib_Draw_Rectangle,
			T: this.Lib_Draw_Text
		};

		let lines = def.split('\n');

		do {
			let l = lines.shift();
			let parts = Helpers.SplitLine(l);

			let token = parts[0];

			if (token == 'DEF') {
				ret.name = parts[1].replace(/\"/g, '');
			} else if (token == 'F0') {
				ret.reference = parts[1].replace(/\"/g, '');
			} else if (token == 'F1') {
				ret.value = parts[1].replace(/\"/g, '');
			} else if (token == 'F2') {
				ret.footprints = [ parts[1].replace(/\"/g, '') ];
			} else if (token == 'F3') {
				ret.datasheet = parts[1].replace(/\"/g, '');
			} else if (token == '$FPLIST') {
        ret.footprints = [];
        do {
          l = lines.shift();
          ret.footprints.push(l.trim());
        } while (!l.startsWith('$ENDFPLIST'));
        ret.footprints.pop();

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
				ret.pins.push(newPin);

				this.Lib_Draw_Pin(ret.svg, parts.splice(1));
      } else {
				let drawCallback = drawCallbacks[token];
				if (drawCallback) {
					drawCallback(ret.svg, parts.splice(1));
				}
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
      parsed: KiCad_Lover.Lib_ParseDef(content),
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
  static Doc_Empty() {
    return {
			name: null,
			description: null,
			usage: null,
			datasheetUrl: null
		};
  }

  static Doc_Check(data) {
		if (!data.startsWith('EESchema-DOCLIB')) throw 'Doc not recognized';
  }

  static Doc_ParseCmp(cmp) {
		let ret = KiCad_Lover.Doc_Empty();

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
      parsed: KiCad_Lover.Doc_ParseCmp(content),
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

module.exports = KiCad_Lover;