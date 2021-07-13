const fs = require('fs');
const path = require('path');

const Helpers = require('./Helpers');

class KiCad_Lover {
	constructor() {
	}

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

	static Lib_ParseDef(def) {
		let ret = {
			name: null,
			reference: null,
			value: null,
			footprints: null,
			datasheet: null,
			pins: []
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
			} else if (token == '$FPLIST') {
        ret.footprints = [];
        do {
          l = lines.shift();
          ret.footprints.push(l.trim());
        } while (!l.startsWith('$ENDFPLIST'));
        ret.footprints.pop();
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
			if (def)
				ret.push(def);
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