const fs = require('fs');

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

	static JSSafe(name) {
		return name.replace(/[^\w\d\$\_]/g, '_');
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
	static Library_LoadFromKiCad(libFilePath) {
		let data = fs.readFileSync(libFilePath, { encoding: 'utf8' , flag: 'r' });

		let loader = new KiCad_Loader(data);

		let defs = loader.GetDefs();
		for (var d of defs) {
			let def = KiCad_Loader.ParseDef(d.content);

			let newComponent = function() {
				return class extends Component { constructor(_) { super(_); }}
			}();
			newComponent.prefix = def.reference;
			newComponent.pinout = def.pins;
	
			Project.Library[Helpers.JSSafe(def.name)] = newComponent;
		}
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
			out.push(`(${p.owner.constructor.name}) ${p.owner.GetName()}.${p.infos.name.clean}`);
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
		this.meta = {
			parent: null
		};

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
		this.net = net;
		this.net.AddPinConnection(this);
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
		this.configs = configs ?? Component.ConstructorArguments();

		this.configs.prefix = this.constructor.prefix ?? (this.configs.prefix ?? this.constructor.name.split('_')[0]);
		this.configs.id = this.configs.id ?? Project.Component_GetUniqueID();

		Project.Component_CheckDuplicates(this.configs.id);

		this._pins = [];
		if (this.constructor.pinout)
			this.SetPins(this.constructor.pinout);

		Project.Component_Add(this);
	}

	static ConstructorArguments() {
		return {
			name: null,
			prefix: null,
			id: null
		}
	}

	GetName() {
		return this.configs.name ?? (this.configs.prefix + this.configs.id);
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
		let cleanName = infos.name.clean ?? null;

		var foundPins = this._pins.filter(p => Helpers.ObjectMatch(p.infos, infos));

		if (typeof this.$Pin === "function") {
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
			return this._GetPin({ name: { clean: prefix }});
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


	static FromKiCad() {}
}

class Group {
	constructor() {

	}
}



/* ### COMPONENTS ### */
class IC_74xx574 extends Component {
	constructor(_) {
		super(_);
	}
	static pinout = [
		{ name: 'VCC', num: 20, electrical_type: 'W' },
		{ name: '~OE', num: 1, electrical_type: 'I' },
		{ name: 'CP', num: 11, electrical_type: 'I' },
		{ name: 'D0', num: 2, electrical_type: 'I' },
		{ name: 'D1', num: 3, electrical_type: 'I' },
		{ name: 'D2', num: 4, electrical_type: 'I' },
		{ name: 'D3', num: 5, electrical_type: 'I' },
		{ name: 'D4', num: 6, electrical_type: 'I' },
		{ name: 'D5', num: 7, electrical_type: 'I' },
		{ name: 'D6', num: 8, electrical_type: 'I' },
		{ name: 'D7', num: 9, electrical_type: 'I' },
		{ name: 'GND', num: 10, electrical_type: 'P' },
		{ name: 'Q0', num: 19, electrical_type: 'O' },
		{ name: 'Q1', num: 18, electrical_type: 'O' },
		{ name: 'Q2', num: 17, electrical_type: 'O' },
		{ name: 'Q3', num: 16, electrical_type: 'O' },
		{ name: 'Q4', num: 15, electrical_type: 'O' },
		{ name: 'Q5', num: 14, electrical_type: 'O' },
		{ name: 'Q6', num: 13, electrical_type: 'O' },
		{ name: 'Q7', num: 12, electrical_type: 'O' }
	];
}

class IC_74xx245 extends Component {
	constructor(_) {
		super(_);
	}
	static pinout = [
			{ name: 'VCC', num: 20, electrical_type: 'W' },
			{ name: 'DIR', num: 1, electrical_type: 'I' },
			{ name: '~OE', num: 19, electrical_type: 'I' },
			{ name: 'A0', num: 2, electrical_type: 'B' },
			{ name: 'A1', num: 3, electrical_type: 'B' },
			{ name: 'A2', num: 4, electrical_type: 'B' },
			{ name: 'A3', num: 5, electrical_type: 'B' },
			{ name: 'A4', num: 6, electrical_type: 'B' },
			{ name: 'A5', num: 7, electrical_type: 'B' },
			{ name: 'A6', num: 8, electrical_type: 'B' },
			{ name: 'A7', num: 9, electrical_type: 'B' },
			{ name: 'GND', num: 10, electrical_type: 'P' },
			{ name: 'B0', num: 18, electrical_type: 'B' },
			{ name: 'B1', num: 17, electrical_type: 'B' },
			{ name: 'B2', num: 16, electrical_type: 'B' },
			{ name: 'B3', num: 15, electrical_type: 'B' },
			{ name: 'B4', num: 14, electrical_type: 'B' },
			{ name: 'B5', num: 13, electrical_type: 'B' },
			{ name: 'B6', num: 12, electrical_type: 'B' },
			{ name: 'B7', num: 11, electrical_type: 'B' },
		];
}

class IC_74xx181 extends Component {
	constructor(_) {
		super(_);
	}
	static pinout = [
			{ name: "B0", num: 1, electrical_type: 'I'},
			{ name: "F1", num: 10, electrical_type: 'O'},
			{ name: "F2", num: 11, electrical_type: 'O'},
			{ name: "GND", num: 12, electrical_type: 'W'},
			{ name: "F3", num: 13, electrical_type: 'O'},
			{ name: "A=B", num: 14, electrical_type: 'O'},
			{ name: "15", num: 600, electrical_type: 'O'},
			{ name: "Cn+4", num: 16, electrical_type: 'I'},
			{ name: "Y", num: 17, electrical_type: 'O'},
			{ name: "B3", num: 18, electrical_type: 'I'},
			{ name: "A3", num: 19, electrical_type: 'I'},
			{ name: "A0", num: 2, electrical_type: 'I'},
			{ name: "B2", num: 20, electrical_type: 'I'},
			{ name: "A2", num: 21, electrical_type: 'I'},
			{ name: "B1", num: 22, electrical_type: 'I'},
			{ name: "A1", num: 23, electrical_type: 'I'},
			{ name: "VCC", num: 24, electrical_type: 'W'},
			{ name: "S3", num: 3, electrical_type: 'I'},
			{ name: "S2", num: 4, electrical_type: 'I'},
			{ name: "S1", num: 5, electrical_type: 'I'},
			{ name: "S0", num: 6, electrical_type: 'I'},
			{ name: "Cn", num: 7, electrical_type: 'I'},
			{ name: "M", num: 8, electrical_type: 'I'},
			{ name: "F0", num: 9, electrical_type: 'O'}
		];
}

class IC_74xx193 extends Component {
	constructor(_) {
		super(_);
	}
	static pinout = [
			{ name: 'B', num: 1, electrical_type: 'I' },
			{ name: 'C', num: 10, electrical_type: 'I' },
			{ name: '~LOAD', num: 11, electrical_type: 'I' },
			{ name: '~CO', num: 12, electrical_type: 'O' },
			{ name: '~BO', num: 13, electrical_type: 'O' },
			{ name: 'CLR', num: 14, electrical_type: 'I' },
			{ name: 'A', num: 15, electrical_type: 'I' },
			{ name: 'VCC', num: 16, electrical_type: 'W' },
			{ name: 'QB', num: 2, electrical_type: 'O' },
			{ name: 'QA', num: 3, electrical_type: 'O' },
			{ name: 'DOWN', num: 4, electrical_type: 'C' },
			{ name: 'UP', num: 5, electrical_type: 'C' },
			{ name: 'QC', num: 6, electrical_type: 'O' },
			{ name: 'QD', num: 7, electrical_type: 'O' },
			{ name: 'GND', num: 8, electrical_type: 'W' },
			{ name: 'D', num: 9, electrical_type: 'I' }
		];
}

class IC_AS6C1008 extends Component {
	constructor(_) {
		super(_);
	}
	static pinout = [
			{ name: 'VCC', num: 32, electrical_type: 'W' },
			{ name: 'CE', num: 22, electrical_type: 'I' },
			{ name: 'OE', num: 24, electrical_type: 'I' },
			{ name: 'WE', num: 29, electrical_type: 'I' },
			{ name: 'CE2', num: 30, electrical_type: 'I' },
			{ name: 'A0', num: 12, electrical_type: 'I' },
			{ name: 'A1', num: 11, electrical_type: 'I' },
			{ name: 'A2', num: 10, electrical_type: 'I' },
			{ name: 'A3', num: 9, electrical_type: 'I' },
			{ name: 'A4', num: 8, electrical_type: 'I' },
			{ name: 'A5', num: 7, electrical_type: 'I' },
			{ name: 'A6', num: 6, electrical_type: 'I' },
			{ name: 'A7', num: 5, electrical_type: 'I' },
			{ name: 'A8', num: 27, electrical_type: 'I' },
			{ name: 'A9', num: 26, electrical_type: 'I' },
			{ name: 'A10', num: 23, electrical_type: 'I' },
			{ name: 'A11', num: 25, electrical_type: 'I' },
			{ name: 'A12', num: 4, electrical_type: 'I' },
			{ name: 'A13', num: 28, electrical_type: 'I' },
			{ name: 'A14', num: 3, electrical_type: 'I' },
			{ name: 'A16', num: 2, electrical_type: 'I' },
			{ name: 'A15', num: 31, electrical_type: 'I' },
			{ name: 'NC', num: 1, electrical_type: 'N' },
			{ name: 'VSS', num: 16, electrical_type: 'B' },
			{ name: 'DQ0', num: 13, electrical_type: 'B' },
			{ name: 'DQ1', num: 14, electrical_type: 'B' },
			{ name: 'DQ2', num: 15, electrical_type: 'B' },
			{ name: 'DQ3', num: 17, electrical_type: 'B' },
			{ name: 'DQ4', num: 18, electrical_type: 'B' },
			{ name: 'DQ5', num: 19, electrical_type: 'B' },
			{ name: 'DQ6', num: 20, electrical_type: 'B' },
			{ name: 'DQ7', num: 21, electrical_type: 'B' }
		];
}

class IC_AT28C64B extends Component {
	constructor(_) {
		super(_);
	}
	static pinout = [
			{ name: '~CE', num: 20, electrical_type: 'I' },
			{ name: '~WE', num: 27, electrical_type: 'I' },
			{ name: 'A0', num: 10, electrical_type: 'I' },
			{ name: 'A1', num: 9, electrical_type: 'I' },
			{ name: 'A2', num: 8, electrical_type: 'I' },
			{ name: 'A3', num: 7, electrical_type: 'I' },
			{ name: 'A4', num: 6, electrical_type: 'I' },
			{ name: 'A5', num: 5, electrical_type: 'I' },
			{ name: 'A6', num: 4, electrical_type: 'I' },
			{ name: 'A7', num: 3, electrical_type: 'I' },
			{ name: 'A8', num: 25, electrical_type: 'I' },
			{ name: 'A9', num: 24, electrical_type: 'I' },
			{ name: 'A10', num: 21, electrical_type: 'I' },
			{ name: 'A11', num: 23, electrical_type: 'I' },
			{ name: 'A12', num: 2, electrical_type: 'I' },
			{ name: 'VCC', num: 28, electrical_type: 'W' },
			{ name: '~OE', num: 22, electrical_type: 'I' },
			{ name: 'I/O0', num: 11, electrical_type: 'B' },
			{ name: 'I/O1', num: 12, electrical_type: 'B' },
			{ name: 'I/O2', num: 13, electrical_type: 'B' },
			{ name: 'I/O3', num: 15, electrical_type: 'B' },
			{ name: 'I/O4', num: 16, electrical_type: 'B' },
			{ name: 'I/O5', num: 17, electrical_type: 'B' },
			{ name: 'I/O6', num: 18, electrical_type: 'B' },
			{ name: 'I/O7', num: 19, electrical_type: 'B' },
			{ name: 'GND', num: 14, electrical_type: 'W' }
		];
}

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

		this.reg_latch = new IC_74xx574({ id: startID });
		this.reg_tri = new IC_74xx245({ id: startID + 1 });

		for (var i = 0; i <= 7; i++) {
			this.reg_latch.Pin(`Q${i}`).Connect(this.reg_tri.Pin(`A${i}`));
			this.reg_tri.Pin(`B${i}`).Connect(this.reg_latch.Pin(`D${i}`));
		}

		this.reg_latch.Pin('VCC').Connect(nets.VCC);
		this.reg_tri.Pin('VCC').Connect(nets.VCC);

		this.reg_latch.Pin('GND').Connect(nets.GND);
		this.reg_tri.Pin('GND').Connect(nets.GND);

		// Shared pins
		this.latch_oe = this.reg_latch.Pin('OE'),
		this.cp = this.reg_latch.Pin('CP'),

		this.dir = this.reg_tri.Pin('DIR'),
		this.tri_oe = this.reg_tri.Pin('OE')
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

		let alu = new IC_74xx181({ id: 7 });
		reg_A.InternalBus(0).Connect(alu.Pin('A0'));
		reg_A.InternalBus(1).Connect(alu.Pin('A1'));
		reg_A.InternalBus(2).Connect(alu.Pin('A2'));
		reg_A.InternalBus(3).Connect(alu.Pin('A3'));

		reg_B.InternalBus(0).Connect(alu.Pin('B0'));
		reg_B.InternalBus(1).Connect(alu.Pin('B1'));
		reg_B.InternalBus(2).Connect(alu.Pin('B2'));
		reg_B.InternalBus(3).Connect(alu.Pin('B3'));

		// RAM
		let ram = new IC_AS6C1008({ id: 9 });
		for (var i = 0; i < 8; i++)
			ram.Pin('A', i).Connect(reg_B.InternalBus(i));
		for (var i = 0; i < 4; i++)
			ram.Pin('DQ', i).Connect(reg_C.DataBus(i));

		//console.log(ram.Pins('A'));

		//this.ram.ConnectMultiple(['A0', 'A1'], this.reg_B, ['DB0', 'DB1']);

		// this.ram.ConnectMultiple(srcPinsArray, destComponent, destPinsArray);
		// this.ram.ConnectBus(srcPrefix, startIdx, endIdx, destComponent, destPrefix, [destOffset])

		// ??? this.ram.Pin('A').ConnectMultiple(start, end, dest);


	}
}

class KiCad_Loader {
	constructor(data) {
		if (!data.startsWith('EESchema-LIBRARY')) throw 'Library not recognized';
		this.data = data;
	}

	static splitLine(line) {
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

	GetDefAt(at) {
		let def_idx = this.data.indexOf('\nDEF', at);
		let enddef_idx = this.data.indexOf('\nENDDEF', at);

		if (def_idx < 0) return null;
		if (enddef_idx < 0) return null;

		if (enddef_idx < def_idx) return null;

		let content = this.data.substring(def_idx + 1, enddef_idx + 8);

		return {
			content: content,
			def_idx: def_idx + 1,
			enddef_idx: enddef_idx + 8
		}
	}

	GetDefs() {
		let ret = [];
		var def = { enddef_idx: 0 };
		do {
			def = this.GetDefAt(def.enddef_idx);
			if (def)
				ret.push(def);
		} while (def);
		return ret;
	}

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
			let parts = KiCad_Loader.splitLine(l);

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
}


//let lib_A = Library.LoadFromKiCad('74xx.lib');

Project.Library_LoadFromKiCad('AT28C64B-15PU.lib');
Project.Library_LoadFromKiCad('74xx.lib');

let mainBoard = new fourbit_board();

console.log(Project.Net_Print());

console.log(Project.Library.AT28C64B_15PU);

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