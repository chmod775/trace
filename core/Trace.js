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
const { exit } = require('process');
const Netlist_Exporter = require('./Exporters/Netlist_Exporter');
const { Lisp_Statement } = require('./Utils/Parsers/Lisp_Parser');

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
	constructor() {
		this.components = [];
		this.nets = [];

		this.name = this.constructor.name;
		Trace.Board_Add(this);

		this.$Layout();
		this.$Connect();

		this.AssignComponents();
	}

	$Layout() { throw `$Layout not defined for board ${this.name}`};
	$Connect() {}

	GetComponents() {
		let ret = [];
		for (var k in this) {
			let kVal = this[k];

      if (Array.isArray(kVal)) {
        for (var kItem of kVal) {
          if (kItem instanceof Component) {
            ret.push(kItem);
          } else if (kItem instanceof Block) {
            ret = ret.concat(kItem.GetComponents());
          }
        }
      } else {
        if (kVal instanceof Component) {
          ret.push(kVal);
        } else if (kVal instanceof Block) {
          ret = ret.concat(kVal.GetComponents());
        }
      }
		}
		return ret;
	}

	AssignComponents() {
		this.components = this.GetComponents();
		for (var c of this.components)
			c.owner = this;
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
  constructor(partName) {
    this.partName = (partName instanceof Component) ? `${partName.constructor.name}_${partName.configs.id}` : partName;
    this.libraryName = 'TraceJS';

    this.doc = Symbol.Doc_Empty();

    this.reference = null;
    this.value = null;
    this.footprintFiters = [];
    this.datasheet = null;

		this.shapes = [];
		this.pins = [];
	}

	AddArc() {}
	AddCircle(x0, y0, diameter) {}

	AddPolyline(points) {}
	AddRectangle(startx, starty, endx, endy) {}

	AddText(x0, y0, direction, content) {}
	
	AddPin(pin) {
    this.pins.push(pin);
  }

  _AddShape(type, args) {
    this.shapes.push({
      type: type,
      args: args
    });
  }

  /* ### DOC ### */
  static Doc_Empty() {
    return {
      name: null,
      description: null,
      usage: null,
      datasheetUrl: null
    };
  }

  /* ### SVG ### */

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

  RenderSVG(svg) {
    let drawCallbacks = {
			A: Symbol.Lib_Draw_Arc,
			C: Symbol.Lib_Draw_Circle,
			P: Symbol.Lib_Draw_Polyline,
			S: Symbol.Lib_Draw_Rectangle,
			T: Symbol.Lib_Draw_Text,
			X: Symbol.Lib_Draw_Pin
		};

    for (var sItem of this.shapes) {
      let drawCallback = drawCallbacks[sItem.type];
      if (drawCallback)
        drawCallback(svg, sItem.args);
    }

    return svg;
  }
}

class Footprint {
	constructor(partName) {
    this.name = (partName instanceof Component) ? `${partName.constructor.name}_${partName.configs.id}` : partName;
    this.group = 'TraceJS';

		this.shapes = [];
		this.pads = [];
	}

	static Pad = class {
		static Type = {
			thru_hole: 'thru_hole',
			smd: 'smd',
			connect: 'connect',
			np_thru_hole: 'np_thru_hole'
		};

		static Shape = {
			circle: 'circle',
			rect: 'rect',
			oval: 'oval',
			trapezoid: 'trapezoid'
		};

		constructor(pin, type, shape) {
			this._pin = pin;

			this.name = pin.num;
			this.type = type;
			this.shape = shape;
		}

		Position(x, y, angle) {
			this.pos = {};
			this.pos.x = x;
			this.pos.y = y;
			return this;
		}

		Autosize(margin) {
			if (!this.drill) throw 'Missing Drill parameter for Autosize';
			margin = margin ?? 1;
			
			this.size = {};
			this.size.w = this.drill.size + (margin * 2);
			this.size.h = this.drill.size + (margin * 2);
			return this;
		}

		Size(w, h) {
			this.size = {};
			this.size.w = w;
			this.size.h = h;
			return this;
		}

		Drill(size, ox, oy) {
			this.drill = {};
			this.drill.size = size;

			if (ox || oy) {
				this.drill.offset = {};
				this.drill.offset.x = ox;
				this.drill.offset.y = oy;
			}

			return this;
		}

		Layers(layers) {
			this.layers = layers;
			return this;
		}
	}

	AddPad(pad) {
		this.pads.push(pad);
	}
}

class Component {
	constructor(configs) {
		this.constructor._name = this.constructor._name ?? this.constructor.name;

		this.configs = configs ?? Component.ConstructorArguments();

		this.configs.prefix = this.constructor.lib ? this.constructor.lib.reference : (this.configs.prefix ?? this.constructor.name.split('_')[0]);
		this.configs.id = this.configs.id ?? Trace.Component_GetUniqueID();

		if (Trace.Component_CheckIfExists(this.GetReference())) throw `Component with reference ${this.GetReference()} already exists. Use: Trace.Part.Find('${this.GetReference()}') or create new one with different reference.')`;

		this.owner = null; // Board

    this.value = this.configs.value ?? null;
    this.footprint = null;

		this.render = {
			error: false
		};

		this._pins = [];
		if (this.constructor.lib)
			this.SetPins(this.constructor.lib.pins);

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

		if (foundPins.length > 1) throw `Multiple pins found with number ${number} on component ${this.constructor._name} [${this.constructor.name}]`;
		if (foundPins.length <= 0) throw `No pin found with number ${number} on component ${this.constructor._name} [${this.constructor.name}]`;

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
	$Symbol() {
    return this.constructor.lib ?? new Symbol();
	}

	/* ### Footprint ### */
	$Footprint() {
    if (this.footprint) return this.footprint;
    if (!this.constructor._cachedFootprints) return null;
    let keys = Object.keys(this.constructor._cachedFootprints);
    if (keys.length == 0) null;
		return this.constructor._cachedFootprints[keys[0]];
	}
}

class Block {
	constructor() {

	}

	GetComponents() {
		let ret = [];
		for (var k in this) {
			let kVal = this[k];
      if (Array.isArray(kVal)) {
        for (var kItem of kVal) {
          if (kItem instanceof Component) {
            ret.push(kItem);
          } else if (kItem instanceof Block) {
            ret = ret.concat(kItem.GetComponents());
          }
        }
      } else {
        if (kVal instanceof Component) {
          ret.push(kVal);
        } else if (kVal instanceof Block) {
          ret = ret.concat(kVal.GetComponents());
        }
      }
		}
		return ret;
	}
}

class Trace {
	/* ### Project ### */
	static Project(directory, infos) {
		Trace.directory = directory;
		Trace.infos = infos;
	}

	/* ### Importers ### */
	static importers = [
		KiCad_Importer
	];

	static ImportSymbol(relFilename) {
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
		SVG_Exporter,
		Netlist_Exporter
	];

	static Export() {
		Trace.Validate();
		for (var e of Trace.exporters) {
			e.Export();
		}
	}

	/* ### Checkers ### */
	static checkers = [];
	static Check(classes) {
		Trace.Validate();

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
		Trace.Validate();

		Trace.testers = [];
		for (var c of classes) {
			let cInst = new c();
			if (!(cInst instanceof Tester)) throw `${c.constructor.name} class must extend Tester class`;
			Trace.testers.push(cInst);
		}
	}

	/* ### Validate PROJECT ### */
	static validated = false;
	static Validate() {
		if (Trace.validated) return;

		for (var c of Trace.components) {
			if (!c.owner) {
				Logger.Error('Unassigned component', c.GetReference());
				exit();
			}
		}

		Logger.Ok('PROJECT VALIDATED SUCCESSFULLY');

		Trace.validated = true;
	}


	/* ### Boards ### */
	static boards = [];
	static Board_Add(group) { Trace.boards.push(group) }
	static Board_GetUniqueID(prefix) { return Helpers.UniqueID(prefix ?? 'Board_', Trace.boards.length + 1) }

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
  static AssignedFootprints = {};

  static Footprints_LoadKiCadFolder() {
		Trace.Footprints_LoadFromKiCad(KiCad_Importer.FootprintFolder());
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
    var cLib = component.$Symbol();
    if (!cLib.footprintFiters) return;

		if (!component.constructor._cachedFootprints) {
			component.constructor._cachedFootprints = {};
			for (var filter of cLib.footprintFiters) {
				let foundFootprints = Trace.Footprints_FindFromFilter(filter, component.GetPins().length);
				for (var f of foundFootprints)
					component.constructor._cachedFootprints[f] = Trace.Footprints[f];
			}
		}
		return component.constructor._cachedFootprints;
	}

  static Footprints_AutoAssign() {
    for (var c of this.components) {
      var cLib = c.$Symbol();
      Trace.Footprints_UpdateComponentCache(c);

      c.footprint = c.$Footprint();

      if (!c.footprint) {
        Logger.Warning(`Unable to find any footprint for Component ${c.GetReference()} [${cLib.libraryName}:${cLib.partName}] - (${cLib.footprintFiters.join(', ')})`);
        continue;
      }

      Logger.Info(`Assigned ${c.footprint.name} to Component ${c.GetReference()} [${cLib.libraryName}:${cLib.partName}] - (${cLib.footprintFiters.join(', ')})`);
    }
  }

  static Footprint_Assign(partType, footprintName) {
    if (!(footprintName in this.Footprints)) {
      Logger.Error(`Footprint ${footprintName} not found.`);
      return;
    }

    for (var c of this.components) {
      if (c instanceof partType) {
        c.footprint = this.Footprints[footprintName];
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
Trace.Symbol = Symbol;
Trace.Footprint = Footprint;
Trace.Component = Component;
Trace.Tester = Tester;
Trace.Part = Trace.CatalogProxy;

module.exports = Trace;