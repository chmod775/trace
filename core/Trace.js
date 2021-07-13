const fs = require('fs');
const path = require('path');

const Helpers = require('./Helpers');
const KiCad_Lover = require('./KiCad_Lover');
const Netlist_Generator = require('./Netlist_Generator');

class Project {
	/* ### Nets ### */
	static nets = [];
	static Net_Add(net) { Project.nets.push(net) }
	static Net_Remove(net) {
		var index = Project.nets.indexOf(net);
		if (index !== -1) Project.nets.splice(index, 1);
	}
	static Net_GetUniqueID(prefix) { return Helpers.UniqueID(prefix ?? 'Net_', Project.nets.length + 1) }

	static Net_Print() {
		let out = [];
		for (var n of Project.nets) {
			out.push(`${n.name} - ${n.toString()}`);
		}
		return out.join('\n');
	}

	/* ### Components ### */
	static components = [];
	static Component_Add(component) { Project.components.push(component) }
	static Component_GetUniqueID(prefix) { return Project.components.reduce((a, c) => Math.max(a, c.configs.id + 1), 1) }
	static Component_CheckDuplicates(id) {
		let dup = Project.components.filter( c => c.configs.id == id);
		if (dup.length > 0) throw `Found duplicated id ${id}`;
	}

	/* ### Boards ### */
	static boards = [];
	static Board_Add(group) { Project.boards.push(group) }
	static Board_GetUniqueID(prefix) { return Helpers.UniqueID(prefix ?? 'Board_', Project.boards.length + 1) }

	/* ### Library ### */
	static Library = {};
	static Catalog = {};
	static Library_LoadFromKiCad(libFilePath, safePrefix) {
		var extension = path.extname(libFilePath);
		var file = path.basename(libFilePath,extension);
		
    let parts = KiCad_Lover.LoadLib(libFilePath);

		for (var d of parts.defs) {
			let def = d.parsed;
      let doc = (def.name in parts.docs) ? parts.docs[def.name].parsed : KiCad_Lover.Doc_Empty();

			let newComponent = function() {
				return class extends Component { constructor(_) { super(_); }}
			}();
			newComponent.lib = def;
			newComponent.prefix = def.reference;
			newComponent.pinout = def.pins;

			let name = Helpers.JSSafe(def.name, safePrefix);
			let name_org = name;
			let name_cnt = 1;
			while (name in Project.Library) {
				name = `${name_org}_${name_cnt++}`;
        console.log(`Library name already existing, changing to ${name}`);
      }

			newComponent._name = name;
			newComponent.libraryName = file;
			newComponent.partName = def.name;
			newComponent.doc = doc;
/*
			Project.Catalog[file] = Project.Catalog[file] ?? {};
			Project.Catalog[file][def.name] = newComponent;
*/
			Project.Library[newComponent._name] = newComponent;
		}
	}

  static Library_LoadKiCadFolder() {
    let files = Helpers.ScanDir('C:\\Program Files\\KiCad\\share\\kicad\\library' ?? '.', '.lib');
    for (var fIdx in files) {
      let f = files[fIdx];
      var extension = path.extname(f.path);
      var file = path.join(path.dirname(f.path), path.basename(f.path, extension));
      Project.Library_LoadFromKiCad(file);
      console.log(`[${+fIdx + 1}/${files.length}] Loaded library: ${f.filename}`);
    }
  }

  static Library_FindByRegEx(search) {
    return Object.keys(Project.Library).filter(k => k.match(search)).map(i => Project.Library[i]);
  }

  /* ### Footprint ### */
  static Footprints = {};
  static Footprints_LoadFromKiCad(footprintsFolderPath) {
    let files = Helpers.ScanDir(footprintsFolderPath ?? '.', '.kicad_mod');
    for (var f of files)
      Project.Footprints[f.filename] = KiCad_Lover.LoadFootprint(f.path);
  }

  static Footprints_FindFromFilter(filter, pads) {
    let rex = filter.replace(/\?/g, '.').replace(/\*/g, '.*'); // TODO: Replace with proper Wildchar matcher
    let rexObj = new RegExp(`^${rex}`, 'gi');

    var filteredObj = Object.keys(this.Footprints).reduce((p, c) => {
      if (this.Footprints[c].pads.length == pads) p[c] = this.Footprints[c];
      return p;
    }, {});

    return Object.keys(filteredObj).filter(value => (rexObj.test(value)));
  }

  static Footprints_AutoAssign() {
    for (var c of this.components) {
      if (!c.constructor._cachedFootprints) {
        c.constructor._cachedFootprints = {};
        for (var filter of c.constructor.lib.footprints) {
          let foundFootprints = Project.Footprints_FindFromFilter(filter, c._pins.length);
          for (var f of foundFootprints)
            c.constructor._cachedFootprints[f] = Project.Footprints[f];
        }
      }

      if (!c.footprint) {
        let keys = Object.keys(c.constructor._cachedFootprints);
        if (keys.length == 0) {
          console.error(`Unable to find any footprint for Component ${c.GetReference()} [${c.constructor.libraryName}:${c.constructor.partName}] - (${c.constructor.lib.footprints.join(', ')})`);
          return;
        }
        c.footprint = c.constructor._cachedFootprints[keys[0]];
        console.log(`Assigned ${keys[0]} to Component ${c.GetReference()} [${c.constructor.libraryName}:${c.constructor.partName}] - (${c.constructor.lib.footprints.join(', ')})`);
      }
    }
  }

  /* ### Netlist ### */
  static Netlist_Generate(netlistFilePath) {
    let netlist = new Netlist_Generator();

    // Design
    netlist.SetDesign(netlistFilePath, new Date());

    // Components
		for (var c of Project.components)
      netlist.AddComponent(c);

    // Wiring
    for (var n of Project.nets)
      netlist.AddNet(n);

    // Libraries
    netlist.AddLibrariesFromComponents(Project.components);

    // Generate
		let str = netlist.toString();
		fs.writeFileSync(netlistFilePath, str);
		return str;
  }
}

class Net {
	constructor(name) {
		this.name = name ?? Project.Net_GetUniqueID();
		this._pins = [];
		Project.Net_Add(this);
	}

	destroy() {
		Project.Net_Remove(this);
	}

	AddPinConnection(pin) {
		this._pins.push(pin);
	}

	Raid(targetNet) {
		while(this._pins.length > 0) {
			let p = this._pins.pop();
			p._ConnectToNet(targetNet);
		}
	}

	toString() {
		let out = [];
		for (var p of this._pins) {
			out.push(`(${p.owner.constructor._name}) ${p.owner.GetReference()}.${p.infos.name.clean}`);
		}
		return out.join(', ');
	}
}

class Board {
	constructor(name) {
		this.name = name;
		Project.Board_Add(this);
	}
}

class Pin {
	constructor(configs) {
		this.owner = null;

		this.num = configs.num;
		this.electrical_type = configs.electrical_type;

		this.configs = configs;
		this.infos = {};

		this.net = null;

		let p = Pin.ParseName(configs.name);
		Object.assign(this.infos, p);
	}

	static HasPrefix(rawName, prefix) {
		let p = Pin.ParseName(rawName);
		if (p.name.prefix == prefix) return p;
		return null;
	}

	static ParseName(rawName) {
		var name = rawName;
		var infos = {
			rawName: rawName,

			flags: {
				isInverted: false
			},

			name: {
				clean: '',
				prefix: '',
				postfix: '',
				index: null
			}
		};

		// Get flags
		if (rawName.startsWith('~')) { // Inverted
			name = rawName.substring(1);
			infos.flags.isInverted = true;
		}

		// Get indexes
		let indexes = name.match(/\d+/g) ?? [null];
		if (indexes.length > 1) throw `Multiple numbers found in pin name ${name}. Max allowed 1 number.`;
		infos.name.index = +indexes[0];

		// Get parts
		let parts = name.split(/\d+/g) ?? ['', ''];
		if (parts.length > 2) throw `Multiple text parts found in pin name ${name}. Max allowed 2 text parts if separated by a number.`;
		infos.name.prefix = parts[0];
		infos.name.postfix = parts[1];

		infos.name.clean = name;
		return infos;
	}

	AssignParent(parent) {
		this.configs.parent = parent;
	}

	Connect(target) {
		if (target instanceof Net) {
			if (this.net) throw `Pin already connected [${JSON.stringify(this)}]`;
			this._ConnectToNet(target);
		} else if (target instanceof Pin) {
			if (this.net && target.net) {
				let killNet = this.net;
				killNet.Raid(target.net);
				killNet.destroy();

				this._ConnectToNet(target.net);
			} else {
				let net = (this.net ?? target.net) ?? null;
				if (net == null)
					net = new Net();
				
				this._ConnectToNet(net);
				target._ConnectToNet(net);
			}
		} else if (target instanceof PinCollection) {

		} else
			throw `Target ${target} not recognized for Pin connection [${JSON.stringify(this)}]`;
	}

	_ConnectToNet(net) {
		if (!this.net) {
			this.net = net;
			this.net.AddPinConnection(this);
		}
	}
}

class PinCollection {
	constructor(pins) {
		this.pins = pins;
	}

	toString() {
		return this.pins.toString();
	}
}

class Component {
	constructor(configs) {
		this.constructor._name = this.constructor._name ?? this.constructor.name;

		this.configs = configs ?? Component.ConstructorArguments();

		this.configs.prefix = this.constructor.prefix ?? (this.configs.prefix ?? this.constructor.name.split('_')[0]);
		this.configs.id = this.configs.id ?? Project.Component_GetUniqueID();

		Project.Component_CheckDuplicates(this.configs.id);

    this.value = null;
    this.footprint = null;

		this._pins = [];
		if (this.constructor.pinout)
			this.SetPins(this.constructor.pinout);

		Project.Component_Add(this);

		// Connect connections
		this.configs.connections = this.configs.connections ?? {};
		for (var cKey in this.configs.connections) {
			let cVal = this.configs.connections[cKey];
			this.Pin(cKey).Connect(cVal);
		}
	}

	static ConstructorArguments() {
		return {
			reference: null,
			prefix: null,
			id: null,
			connections: {}
		}
	}

	GetReference() {
		return this.configs.reference ?? (this.configs.prefix + this.configs.id);
	}

	SetPins(items) {
		if (Array.isArray(items)) {
			for (var i of items) {
				var newPin = i;
				if (!(i instanceof Pin)) newPin = new Pin(i);
				newPin.owner = this;
				this._pins.push(newPin);
			}
		} else {
			for (var k in items) {
				let i = items[k];

			}
		}
	}

	_GetPins(infos) {
		var foundPins = this._pins.filter(p => Helpers.ObjectMatch(p.infos, infos));

		if (typeof this.$Pin === "function") {
			let cleanName = infos.name.clean ?? null;
			let computedPins = this.$Pin(cleanName, infos) ?? [];
			if (Array.isArray(computedPins)) {
				foundPins = foundPins.concat(computedPins);
			} else {
				foundPins.push(computedPins);
			}
		}

		if (foundPins.length <= 0) throw `No pin found with ${JSON.stringify(infos)} on component ${this.name} [${this.constructor.name}]`;

		return foundPins;
	}

	_GetPin(infos) {
		let foundPins = this._GetPins(infos);
		if (foundPins.length > 1) throw `Multiple pins found with ${JSON.stringify(infos)} on component ${this.name} [${this.constructor.name}]`;
		return foundPins[0];
	}

	Pin(prefix, index, postfix) {
		if ((index === undefined) && (postfix === undefined)) {
			if (typeof prefix === 'string' || prefix instanceof String)
				return this._GetPin({ name: { clean: prefix }});
			else
				return this._pins.filter(p => p.configs.num == +prefix)[0] ?? null;
		} else {
			let infos = { name: {} };
			if (prefix !== undefined) infos.name.prefix = prefix;
			if (index !== undefined) infos.name.index = index;
			if (postfix !== undefined) infos.name.postfix = postfix;
			return this._GetPin(infos);
		}
	}

	Pins(prefix, postfix) {
		let infos = { name: {} };
		if (prefix !== undefined) infos.name.prefix = prefix;
		if (postfix !== undefined) infos.name.postfix = postfix;
		return new PinCollection(this._GetPins(infos));
	}

	static Describe() {
		return (new this).GetDescription();
	}

	GetDescription() {
		let out = [];
		
		out.push(this.constructor._name);

		for (var p of this._pins.sort((a, b) => a.num - b.num))
			out.push(`\t${p.configs.electrical_type} - [${p.configs.num}] ${p.configs.name}`)

			return out.join('\n');
	}
}

class Block {
	constructor() {

	}
}

module.exports.Project = Project;
module.exports.Net = Net;
module.exports.Board = Board;
module.exports.Pin = Pin;
module.exports.PinCollection = PinCollection;
module.exports.Component = Component;
module.exports.Block = Block;