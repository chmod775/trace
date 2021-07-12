const fs = require('fs');
const path = require('path');

const VERSION = 'TRACE - JavaScript Schematic Generator [v0.1]';

/* ### MY WAY ### */
class Helpers {
	constructor(){}
	static UniqueID(prefix, cnt) {
		prefix = prefix ?? '_';
		return prefix + cnt;
	}

	static ObjectMatch(obj, objCompare) {
		for (var k in objCompare) {
			let v = objCompare[k];
			let myV = obj[k];
	
			var ret = false;
			if (myV !== Object(myV))
				ret = (v == myV);
			else
				ret = Helpers.ObjectMatch(myV, v);
			if (!ret) return false;
		}
		return true;
	}

	static JSSafe(name, prefix) {
		prefix = prefix ?? '$';
		let safeName = name.replace(/[^\w\d\$\_]/g, '_');
		if (safeName.match(/^\d/))
			safeName = prefix + safeName;
		return safeName;
	}

	static SplitLine(line) {
		let parts = line.trim().split(' ');
		// remove empty parts
		parts = parts.filter(p => p.length > 0);
		// join literal parts
		let finalParts = [];
		do {
			let p = parts.shift();
			if (!p) break;
			if (p.split('"').length == 2) {
				let joinedParts = [];
				joinedParts.push(p);

				do {
					let pp = parts.shift();
					joinedParts.push(pp);
					if (pp.split('"').length == 2) break;
				} while (parts.length > 0);

				finalParts.push(joinedParts.join(' '));
			} else
				finalParts.push(p);
		} while (parts.length > 0);

		return finalParts;
	}
}

class KiCad_Lover {
	constructor() {
	}

	static CheckLibrary(data) {
		if (!data.startsWith('EESchema-LIBRARY')) throw 'Library not recognized';
	}

	/* ### Load ### */
	static ParseDef(def) {
		let ret = {
			name: null,
			reference: null,
			value: null,
			footprint: null,
			datasheet: null,
			pins: []
		};

		let lines = def.split('\n');

		for (var l of lines) {
			let parts = Helpers.SplitLine(l);

			let token = parts[0];

			if (token == 'DEF') {
				ret.name = parts[1].replace(/\"/g, '');
			} else if (token == 'F0') {
				ret.reference = parts[1].replace(/\"/g, '');
			} else if (token == 'F1') {
				ret.value = parts[1].replace(/\"/g, '');
			} else if (token == 'F2') {
				ret.footprint = parts[1].replace(/\"/g, '');
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
			}
		}

		return ret;
	}

	static GetDefAt(data, at) {
		let def_idx = data.indexOf('\nDEF', at);
		let enddef_idx = data.indexOf('\nENDDEF', at);

		if (def_idx < 0) return null;
		if (enddef_idx < 0) return null;

		if (enddef_idx < def_idx) return null;

		let content = data.substring(def_idx + 1, enddef_idx + 8);

		return {
			content: content,
      parsed: KiCad_Lover.ParseDef(content),
			def_idx: def_idx + 1,
			enddef_idx: enddef_idx + 8
		}
	}

	static GetDefs(data) {
		let ret = [];
		var def = { enddef_idx: 0 };
		do {
			def = this.GetDefAt(data, def.enddef_idx);
			if (def)
				ret.push(def);
		} while (def);
		return ret;
	}

  static LoadLibrary(filename) {
		let data = fs.readFileSync(filename, { encoding: 'utf8' , flag: 'r' });
		KiCad_Lover.CheckLibrary(data);
		return KiCad_Lover.GetDefs(data);
  }
}

class Netlist_Statement {
  constructor(keyword, args) {
    if (!keyword || (keyword.length < 1)) throw 'Invalid keyword';
    this.keyword = keyword.toLowerCase();
    this.args = args ?? [];
  }

  SetArgument(arg) {
    let statementArgs = this.args.filter(a => a instanceof Netlist_Statement);
    let foundArgIndex = statementArgs.findIndex(a => a.keyword == arg.keyword);
    if (foundArgIndex < 0)
      this.AddArgument(arg);
    else
      this.args[foundArgIndex] = arg;
  }

  AddArgument(arg) {
    this.args.push(arg);
    return arg;
  }

  toString() {
    let out = [this.keyword];
    for (var a of this.args)
      out.push(a.toString());
    return `${this.args.length > 1 ? '\n' : ''}(${out.join(' ')})`;
  }
}

class Netlist_Generator {
  constructor() {
    this.rootStatement = new Netlist_Statement('export');
    this.rootStatement.AddArgument(new Netlist_Statement('version', ['D']));

    this.statements = {
      design: this.rootStatement.AddArgument(new Netlist_Statement('design')),
      components: this.rootStatement.AddArgument(new Netlist_Statement('components')),
      libparts: this.rootStatement.AddArgument(new Netlist_Statement('libparts')),
      libraries: this.rootStatement.AddArgument(new Netlist_Statement('libraries')),
      nets: this.rootStatement.AddArgument(new Netlist_Statement('nets'))
    }

    this.uniqueTimeStamp = Math.floor(+new Date() / 1000);
  }

  toString() {
    return this.rootStatement.toString();
  }

  SetDesign(source, date) {
    this.statements.design.SetArgument(new Netlist_Statement('source', [source]));
    this.statements.design.SetArgument(new Netlist_Statement('date', [ `"${date}"` ]));
    this.statements.design.SetArgument(new Netlist_Statement('tool', [ `"${VERSION}"` ]));
  }

/*

		out.push(`L ${component.constructor.libraryName}:${component.constructor.partName} ${component.GetReference()}`);
		out.push(`U 1 1 ${Math.floor(+new Date() / 1000).toString(16).toUpperCase()}`);
		out.push(`P ${pos.x} ${pos.y}`);

		out.push(`F 0 "${component.GetReference()}" H ${pos.x} ${pos.y} 50  0000 C CNN`);
		out.push(`F 1 "${component.constructor.lib.value}" H ${pos.x} ${pos.y} 50  0000 C CNN`);
		out.push(`F 2 "${component.constructor.lib.footprint}" H ${pos.x} ${pos.y} 50  0001 L BNN`);
		out.push(`F 3 "${component.constructor.lib.datasheet}" H ${pos.x} ${pos.y} 50  0001 L BNN`);
*/

  AddComponent(component) {
    let newComp = new Netlist_Statement('comp');

    newComp.SetArgument(new Netlist_Statement('ref', [ component.GetReference() ]));
    if (component.value) newComp.SetArgument(new Netlist_Statement('value', [ component.value ]));
    if (component.value) newComp.SetArgument(new Netlist_Statement('footprint', [ component.footprint ]));
    newComp.SetArgument(new Netlist_Statement('libsource', [
      new Netlist_Statement('lib', [ component.constructor.libraryName ]),
      new Netlist_Statement('part', [ component.constructor.partName ]),
      new Netlist_Statement('description', [ '""' ]),
    ]));
    newComp.SetArgument(new Netlist_Statement('tstamp', [ this.uniqueTimeStamp.toString(16).toUpperCase() ]));


    this.uniqueTimeStamp++;
    this.statements.components.AddArgument(newComp);
    return newComp;
  }
}

/* ### CORE ### */
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
		
    let defs = KiCad_Lover.LoadLibrary(libFilePath);

		for (var d of defs) {
			let def = d.parsed;

			let newComponent = function() {
				return class extends Component { constructor(_) { super(_); }}
			}();
			newComponent.lib = def;
			newComponent.prefix = def.reference;
			newComponent.pinout = def.pins;

			let name = Helpers.JSSafe(def.name, safePrefix);
			let name_org = name;
			let name_cnt = 1;
			while (name in Project.Library)
				name = `${name_org}_${name_cnt++}`;

			newComponent._name = name;
			newComponent.libraryName = file;
			newComponent.partName = def.name;
/*
			Project.Catalog[file] = Project.Catalog[file] ?? {};
			Project.Catalog[file][def.name] = newComponent;
*/
			Project.Library[newComponent._name] = newComponent;
		}
	}

	/* ### Schematic ### 
	static Schematic_Generate(schFilePath) {
		let out = [KiCad_Lover.Generate_SchematicHeader()];

		// Components
		let pos = { x: 0, y: 1000 };
		for (var c of Project.components) {
			c.meta.pos = c.meta.pos ?? {};
			c.meta.pos.x = pos.x;
			c.meta.pos.y = pos.y;

			out.push(KiCad_Lover.Generate_SchematicComponent(c, pos));
			let dim = c.GetDimensions();
			pos.x += dim.w + 200;
			//pos.y += dim.h + 200;
		}

		// Wiring
		for (var n of Project.nets) {
			for (var pIdx = 0; pIdx < (n._pins.length - 1); pIdx++) {
				let pinFrom = n._pins[pIdx];
				let pinTo = n._pins[pIdx + 1];

				console.log(pinFrom.owner.meta);

				let pFrom = {
					x: +pinFrom.owner.meta.pos.x + +pinFrom.configs.pos.x,
					y: +pinFrom.owner.meta.pos.y - +pinFrom.configs.pos.y
				}

				let pTo = {
					x: +pinTo.owner.meta.pos.x + +pinTo.configs.pos.x,
					y: +pinTo.owner.meta.pos.y - +pinTo.configs.pos.y
				}

				out.push(KiCad_Lover.Generate_SchematicWire(pFrom, pTo));
			}
		}

		out.push('$EndSCHEMATC');
		let str = out.join('\n');
		fs.writeFileSync(schFilePath, str);
		return str;
	}
*/
  /* ### Netlist ### */
  static Netlist_Generate(netlistFilePath) {
    let netlist = new Netlist_Generator();

    // Design
    netlist.SetDesign(netlistFilePath, new Date());

    // Components
		for (var c of Project.components)
      netlist.AddComponent(c);

    // Wiring

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

class Group {
	constructor() {

	}
}

/* ### COMPONENTS ### */
class PINHEAD extends Component {
	constructor(count) {
		super();
		count = Math.max(1, count);
		
		let pins = [];
		for (var i = 1; i < count; i++)
			pins.push({ name: `P${i}`, num: i, electrical_type: B });

		this.SetPins(pins);
	}
}

/* ### GROUPS ### */
class reg_group extends Group {
	constructor(startID, nets) {
		super();

		this.reg_latch = new Project.Library.SN74LS574({ id: startID });
		this.reg_tri = new Project.Library.SN74LS245({ id: startID + 1 });

		for (var i = 0; i <= 7; i++) {
			this.reg_latch.Pin(`Q${i}`).Connect(this.reg_tri.Pin(`A${i}`));
			this.reg_tri.Pin(`B${i}`).Connect(this.reg_latch.Pin(`D${i}`));
		}

		this.reg_latch.Pin('GND').Connect(nets.GND);
		this.reg_tri.Pin('VCC').Connect(nets.VCC);

		this.reg_latch.Pin('GND').Connect(nets.GND);
		this.reg_tri.Pin('GND').Connect(nets.GND);

		// Shared pins
		this.latch_oe = this.reg_latch.Pin('OE'),
		this.cp = this.reg_latch.Pin('Cp'),

		this.dir = this.reg_tri.Pin('A->B'),
		this.tri_oe = this.reg_tri.Pin('CE')
	}

	DataBus(index) {
		return this.reg_tri.Pin(`B${index}`);
	}

	InternalBus(index) {
		return this.reg_latch.Pin(`Q${index}`);
	}

	ConnectEntireDataBus(dest) {
		for (var i = 0; i <= 7; i++)
			this.DataBus(i).Connect(dest.DataBus(i));
	}
}

/* ### MAIN ### */
class fourbit_board extends Board {
	constructor() {
		super('fourbit');

		let net_VCC = new Net('VCC');
		let net_GND = new Net('GND');

		let reg_A = new reg_group(1, { VCC: net_VCC, GND: net_GND });
		let reg_B = new reg_group(3, { VCC: net_VCC, GND: net_GND });
		let reg_C = new reg_group(5, { VCC: net_VCC, GND: net_GND });

		reg_A.ConnectEntireDataBus(reg_B);
		reg_B.ConnectEntireDataBus(reg_C);

		let alu = new Project.Library.SN74LS181({ id: 7 });
		reg_A.InternalBus(0).Connect(alu.Pin('A0'));
		reg_A.InternalBus(1).Connect(alu.Pin('A1'));
		reg_A.InternalBus(2).Connect(alu.Pin('A2'));
		reg_A.InternalBus(3).Connect(alu.Pin('A3'));

		reg_B.InternalBus(0).Connect(alu.Pin('B0'));
		reg_B.InternalBus(1).Connect(alu.Pin('B1'));
		reg_B.InternalBus(2).Connect(alu.Pin('B2'));
		reg_B.InternalBus(3).Connect(alu.Pin('B3'));

		// RAM
		let ram = new Project.Library.AS6C1008_55PCN({ id: 9 });
		for (var i = 0; i < 8; i++)
			ram.Pin('A', i).Connect(reg_B.InternalBus(i));
		for (var i = 0; i < 4; i++)
			ram.Pin('DQ', i).Connect(reg_C.DataBus(i));

		//console.log(ram);

		//this.ram.ConnectMultiple(['A0', 'A1'], this.reg_B, ['DB0', 'DB1']);

		// this.ram.ConnectMultiple(srcPinsArray, destComponent, destPinsArray);
		// this.ram.ConnectBus(srcPrefix, startIdx, endIdx, destComponent, destPrefix, [destOffset])

		// ??? this.ram.Pin('A').ConnectMultiple(start, end, dest);


	}
}

class led_group extends Group {
	constructor(net_GND, size) {
		super();

		this.size = size;
		this.net_GND = net_GND;

		for (var i = 0; i < size; i++) {
			let led = new Project.Library.LED();
			let r = new Project.Library.R();

			led.Pin('A').Connect(r.Pin(1));
			led.Pin('K').Connect(this.net_GND);
			
			this[`R_${i}`] = r;
		}
	}

	PinByIndex(index) {
		return this[`R_${index}`].Pin(2);
	}
	ConnectToRegister(reg) {
		for (var i = 0; i < this.size; i++)
			this.PinByIndex(i).Connect(reg.Pin('Q', i));
	}
}

class test_board extends Board {
	constructor() {
		super('test_board');

		let net_VCC = new Net('VCC');
		let net_GND = new Net('GND');

		let reg_A = new Project.Library.SN74LS574({ connections: { VCC: net_VCC, GND: net_GND }});
		let reg_B = new Project.Library.SN74LS574({ connections: { VCC: net_VCC, GND: net_GND }});

		let alu = new Project.Library.SN74LS181({ connections: { VCC: net_VCC, GND: net_GND }});

		reg_A.Pin('Q', 0).Connect(alu.Pin('A0'));
		reg_A.Pin('Q', 1).Connect(alu.Pin('A1'));
		reg_A.Pin('Q', 2).Connect(alu.Pin('A2'));
		reg_A.Pin('Q', 3).Connect(alu.Pin('A3'));

		reg_B.Pin('Q', 0).Connect(alu.Pin('B0'));
		reg_B.Pin('Q', 1).Connect(alu.Pin('B1'));
		reg_B.Pin('Q', 2).Connect(alu.Pin('B2'));
		reg_B.Pin('Q', 3).Connect(alu.Pin('B3'));

		let led_reg_A = new led_group(net_GND, 4);
		led_reg_A.ConnectToRegister(reg_A);

		let led_reg_B = new led_group(net_GND, 4);
		led_reg_B.ConnectToRegister(reg_B);

	}
}

//let lib_A = Library.LoadFromKiCad('74xx.lib');

Project.Library_LoadFromKiCad('libs/AT28C64B-15PU.lib');
Project.Library_LoadFromKiCad('libs/AS6C1008-55PCN.lib');
Project.Library_LoadFromKiCad('libs/74xx.lib', 'SN');
Project.Library_LoadFromKiCad('libs/Device.lib', 'DEV');

let mainBoard = new test_board();

console.log(Project.Net_Print());
//console.log(Project.Library.SN74LS574.Describe());



console.log(Project.Netlist_Generate('examples/test_22.net'));

//console.log(Project.Library.LED);

/*

var infos_A = {
	rawName: '!hello123world',

	flags: {
		isInverted: true
	},

	name: {
		clean: 'hello123world',
		prefix: null,
		postfix: 'world',
		index: 123
	}
}

var check_A = {
	flags: {
		isInverted: true
	},
	name: {}
}

var res = Helpers.ObjectMatch(infos_A, check_A);
console.log(res);
*/