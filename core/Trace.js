const fs = require('fs');
const path = require('path');
const ELK_Generator = require('./Generators/Schematic_Generator');

const Helpers = require('./Utils/Helpers');
const KiCad_Importer = require('./Importers/KiCad_Importer');
const Netlist_Generator = require('./Generators/Netlist_Generator');
const Schematic_Generator = require('./Exporters/SVG_Exporter');
const { Checker } = require('./Checkers/_Checker');
const Logger = require('./Utils/Logger.js');
const Tester = require('./Testers/Tester');
const Importer = require('./Importers/_Importer');
const KiCad_Exporter = require('./Exporters/KiCad_Exporter');
const SVG_Exporter = require('./Exporters/SVG_Exporter');

class Net {
	constructor(name) {
		this.name = name ?? Trace.Net_GetUniqueName();
		if (Trace.Net_CheckIfExists(this.name)) throw `Net with name ${this.name} already exists. Use: Trace.Net.Find('${this.name}) or create new one with different name.')`;
		
		this._pins = [];
		this.render = {
			error: false
		};

		Trace.Net_Add(this);
	}

	static FindAll(query, flags) {
		return Trace.Net_FindAll(query, flags);
	}

	static Find(query, flags) {
		return Trace.Net_Find(query, flags);
	}

	destroy() {
		Trace.Net_Remove(this);
	}

	AddPinConnection(pin) {
		this._pins.push(pin);
	}

	Raid(targetNet) {
		while(this._pins.length > 0) {
			let p = this._pins.pop();
			p.net = null;
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

	GetPins() {
		return this._pins;
	}
}

class Board {
	constructor(name) {
		this.name = name;
		Trace.Board_Add(this);
	}

	

}

class Pin {
	constructor(configs) {
		this.owner = null;

		this.num = configs.num;
		this.electrical_type = configs.electrical_type;
		this.electrical_def = Pin.ElectricalDefinitions[(this.electrical_type ?? 'N').toUpperCase()];

		this.configs = configs;
		this.infos = {};

		this.parameters = {
			voltages: {
				required: null,
				max: null,
				min: null
			},
			currents: {
				required: null,
				min: null,
				max: null
			}
		};

		this.net = null;

		this.render = {
			error: false
		};

		let p = Pin.ParseName(configs.name);
		Object.assign(this.infos, p);
	}

	static _types = {
		'input': 'I',
		'output': 'O',
		'bidi': 'B',
		'tristate': 'T',
		'passive': 'P',
		'unspecified': 'U',
		'powerin': 'W',
		'powerout': 'w',
		'opencollector': 'C',
		'openemitter': 'E',
		'notconnected': 'N'
	}
	static _type_Handler = {
		get: function(target, prop, receiver) {
			return target[prop.toLowerCase()];
		}
	}
	static Type = new Proxy(Pin._types, Pin._type_Handler);

	static ElectricalDefinitions = {
		'I': 'Input',
		'O': 'Output',
		'B': 'Bidi',
		'T': 'Tristate',
		'P': 'Passive',
		'U': 'Unspecified',
		'W': 'PowerIn',
		'w': 'PowerOut',
		'C': 'OpenCollector',
		'E': 'OpenEmitter',
		'N': 'NotConnected'		
	};

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
			if (this.net) { // Merge nets (to be checked)
				let killNet = this.net;
				killNet.Raid(target);
				killNet.destroy();
			}
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

class Symbol {
	constructor() {
		this.size = { w: 0, h: 0 };
		this.shapes = [];
		this.pins = [];
	}

	AddArc() {}
	AddCircle(x0, y0, diameter) {}

	AddPolyline(points) {}
	AddRectangle(startx, starty, endx, endy) {}

	AddText(x0, y0, direction, content) {}
	
	AddPin() {}
}

class Footprint {
	constructor() {
		this.size = { w: 0, h: 0 };
		this.shapes = [];
		this.pads = [];
	}

	//AddPad()
}

class Component {
	constructor(configs) {
		this.constructor._name = this.constructor._name ?? this.constructor.name;

		this.configs = configs ?? Component.ConstructorArguments();

		this.configs.prefix = this.constructor.prefix ?? (this.configs.prefix ?? this.constructor.name.split('_')[0]);
		this.configs.id = this.configs.id ?? Trace.Component_GetUniqueID();

		if (Trace.Component_CheckIfExists(this.GetReference())) throw `Component with reference ${this.GetReference()} already exists. Use: Trace.Part.Find('${this.GetReference()}') or create new one with different reference.')`;

    this.value = this.configs.value ?? null;
    this.footprint = null;

		this.render = {
			error: false
		};

		this._pins = [];
		if (this.constructor.pinout)
			this.SetPins(this.constructor.pinout);

		Trace.Component_Add(this);

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

		if (typeof this.$Pins === "function") {
			let cleanName = infos.name.clean ?? null;
			let computedPins = this.$Pins(cleanName, infos) ?? [];
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

	_GetPinByNumber(number) {
		let foundPins = this._pins.filter(p => p.configs.num == +number);

		if (typeof this.$PinByNumber === "function") {
			let computedPin = this.$PinByNumber(number);
			foundPins.push(computedPin);
		}

		if (foundPins.length > 1) throw `Multiple pins found with number ${number} on component ${this.name} [${this.constructor.name}]`;
		if (foundPins.length <= 0) throw `No pin found with number ${number} on component ${this.name} [${this.constructor.name}]`;

		return foundPins[0];
	}

	Pin(prefix, index, postfix) {
		if ((index === undefined) && (postfix === undefined)) {
			if (typeof prefix === 'string' || prefix instanceof String)
				return this._GetPin({ name: { clean: prefix }});
			else
				return this._GetPinByNumber(+prefix);
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

	GetPins(types) {
		if (!types)
			return this._pins;
		else {
			if (Array.isArray(types))
				return this._pins.filter(p => types.includes(p.electrical_type));
			else
				return this._pins.filter(p => p.electrical_type == types);
		}
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

	/* ### Symbol ### */
	GenerateSymbol() {

	}

	/* ### Footprint ### */
	GenerateFootprint() {
		
	}
}

class Block {
	constructor() {

	}
}

class Trace {
	/* ### Project ### */
	static project = {
		directory: null,
		infos: null
	};

	static Project(directory, infos) {
		Trace.directory = directory;
		Trace.infos = infos;
	}

	/* ### Importers ### */
	static importers = [
		KiCad_Importer
	];

	static Import(relFilename) {
		let filepath = path.resolve(Trace.directory, relFilename);
		for (var i of Trace.importers) {
			if (i.LoadLibrary(filepath)) {
				Logger.Info('Imported library', filepath);
				break;
			}
		}
	}

	/* ### Exporters ### */
	static exporters = [
		KiCad_Exporter,
		SVG_Exporter
	];

	static Export() {
		for (var e of Trace.exporters) {
			e.Export();
		}
	}

	/* ### Checkers ### */
	static checkers = [];
	static Check(classes) {
		Trace.checkers = [];
		for (var c of classes) {
			let cInst = new c();
			if (!(cInst instanceof Checker)) throw `${c.constructor.name} class must extend Checker class`;
			Trace.checkers.push(cInst);
		}

		let ret = true;
		for (var c of Trace.checkers)
			if (!c.$Check(Trace)) ret = false;
		
		if (!ret)
			Logger.Error("TRACE CHECK FAILED!", 'Check log for detailed informations');
		else
			Logger.Ok("TRACE CHECKED SUCCESSFULLY!");
	}

	/* ### Testers ### */
	static testers = [];
	static Test(classes) {
		Trace.testers = [];
		for (var c of classes) {
			let cInst = new c();
			if (!(cInst instanceof Tester)) throw `${c.constructor.name} class must extend Tester class`;
			Trace.testers.push(cInst);
		}
	}

	/* ### Nets ### */
	static nets = [];
	static netID = 1;
	static Net_Add(net) { Trace.nets.push(net); }
	static Net_Remove(net) {
		var index = Trace.nets.indexOf(net);
		if (index !== -1) Trace.nets.splice(index, 1);
	}
	static Net_GetUniqueName(prefix) { return Helpers.UniqueID(prefix ?? 'Net_', Trace.netID++) }

	static Net_FindAll(query, flags) {
		flags = flags ?? 'gi';
		let nameRegEx = query instanceof RegExp ? query : new RegExp(query, flags);
		return Trace.nets.filter(n => nameRegEx.test(n.name));
	}

	static Net_Find(query, flags) {
		let founds = Trace.Net_FindAll(query, flags);
		if (founds.length == 0) throw `No nets found with query ${query}`;
		if (founds.length > 1) throw `Multiple nets found with query ${query}`;
		return founds[0];
	}

	static Net_CheckIfExists(name) { return Trace.Net_FindAll(name).length > 0 }

	static Net_Print() {
		let out = [];
		for (var n of Trace.nets) {
			out.push(`${n.name} - ${n.toString()}`);
		}
		return out.join('\n');
	}

	/* ### Components ### */
	static components = [];
	static Component_Add(component) { Trace.components.push(component) }
	static Component_GetUniqueID(prefix) { return Trace.components.reduce((a, c) => Math.max(a, c.configs.id + 1), 1) }
	static Component_CheckIfExists(ref) { return Trace.Component_FindAll('^' + ref).length > 0 }

	static Component_FindAll(query, flags) {
		flags = flags ?? 'gi';
		let nameRegEx = query instanceof RegExp ? query : new RegExp(query, flags);
		return Trace.components.filter(c => nameRegEx.test(c.GetReference()));
	}

	static Component_Find(query, flags) {
		let founds = Trace.Component_FindAll(query, flags);
		if (founds.length == 0) throw `No components found with query ${query}`;
		if (founds.length > 1) throw `Multiple components found with query ${query}`;
		return founds[0];
	}

	/* ### Boards ### */
	static boards = [];
	static Board_Add(group) { Trace.boards.push(group) }
	static Board_GetUniqueID(prefix) { return Helpers.UniqueID(prefix ?? 'Board_', Trace.boards.length + 1) }

	/* ### Library ### */
	static Library = {};
	static Catalog = {};

	static CatalogStaticFunctions = {
		'Find': Trace.Component_Find,
		'FindAll': Trace.Component_FindAll
	};

	static CatalogProxy_Handler = {
		get: function(target, prop, receiver) {
			if (prop in Trace.CatalogStaticFunctions) return Trace.CatalogStaticFunctions[prop];

			let lib = target[prop];
			if (lib) return lib;
			
			Trace.Library_Import(prop);

			return target[prop];
		}
	}

	static CatalogProxy = new Proxy(Trace.Catalog, Trace.CatalogProxy_Handler);

	static Library_Import(libraryName) {
		for (var i of Trace.importers) {
			if (i.LoadDefaultLibrary(libraryName)) {
				Logger.Info('Imported library', libraryName);
				break;
			}
		}
	}
/*
  static Library_LoadKiCadFolder() {
    let files = Helpers.ScanDir(Trace.Library_KiCadFolder(), '.lib');
    for (var fIdx in files) {
      let f = files[fIdx];
      var extension = path.extname(f.path);
      var file = path.join(path.dirname(f.path), path.basename(f.path, extension));
      Trace.Library_LoadFromKiCad(file);
      Logger.Info(`[${+fIdx + 1}/${files.length}] Loaded library`, f.filename);
    }
  }
*/
  static Library_FindByRegEx(search) {
    return Object.keys(Trace.Library).filter(k => k.match(search)).map(i => Trace.Library[i]);
  }


  /* ### Footprint ### */
  static Footprints = {};

	static Footprints_KiCadFolder() {
		let folders = {
			'win32' : 'C:\\Program Files\\KiCad\\share\\kicad\\modules',
			'linux' : '/usr/share/kicad/modules'
		}
		return folders[process.platform] ?? '.';
	}

  static Footprints_LoadKiCadFolder() {
		Trace.Footprints_LoadFromKiCad(Trace.Footprints_KiCadFolder());
	}

  static Footprints_LoadFromKiCad(footprintsFolderPath) {
    let files = Helpers.ScanDir(footprintsFolderPath ?? '.', '.kicad_mod');
    for (var f of files)
      Trace.Footprints[f.filename] = KiCad_Importer.LoadFootprint(f.path);
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

	static Footprints_UpdateComponentCache(component) {
		if (!component.constructor._cachedFootprints) {
			component.constructor._cachedFootprints = {};
			for (var filter of component.constructor.lib.footprints) {
				let foundFootprints = Trace.Footprints_FindFromFilter(filter, component.GetPins().length);
				for (var f of foundFootprints)
					component.constructor._cachedFootprints[f] = Trace.Footprints[f];
			}
		}
		return component.constructor._cachedFootprints;
	}

  static Footprints_AutoAssign() {
    for (var c of this.components) {
			Trace.Footprints_UpdateComponentCache(c);

      if (!c.footprint) {
        let keys = Object.keys(c.constructor._cachedFootprints);
        if (keys.length == 0) {
          console.error(`Unable to find any footprint for Component ${c.GetReference()} [${c.constructor.libraryName}:${c.constructor.partName}] - (${c.constructor.lib.footprints.join(', ')})`);
          continue;
        }
        c.footprint = c.constructor._cachedFootprints[keys[0]];
        Logger.Info(`Assigned ${keys[0]} to Component ${c.GetReference()} [${c.constructor.libraryName}:${c.constructor.partName}] - (${c.constructor.lib.footprints.join(', ')})`);
      }
    }
  }

  /* ### Netlist ### */
  static Netlist_Generate(netlistFilePath) {
		let gen = new Netlist_Generator(Trace);

    // Generate
		let str = gen.Generate();
		fs.writeFileSync(netlistFilePath, str);
		return str;
  }


  /* ### Schematic ### */
  static async Schematic_Generate(schematicFilePath) {
    let gen = new ELK_Generator(Trace);

		let layoutData = await elkGen.GenerateLayout();
		let svgGen = new Schematic_Generator(layoutData);
		let svg = svgGen.GenerateSVG();
		fs.writeFileSync(schematicFilePath, svg);
    return layoutData;
  }
}

Trace.Net = Net;
Trace.Board = Board;
Trace.Pin = Pin;
Trace.PinCollection = PinCollection;
Trace.Block = Block;
Trace.Component = Component;
Trace.Tester = Tester;
Trace.Part = Trace.CatalogProxy;

module.exports = Trace;