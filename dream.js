/* ### MY WAY ### */
/*
Object.prototype.match = function(objCompare) {
	console.log()
	let ret = true;
	for (var k in objCompare) {
		let v = objCompare[k];
		let myV = this[k];

	console.log(k, v, myV);

		if (myV !== Object(myV))
			ret = (v == myV);
		//else
		//	ret = myV.match(v);
		if (!ret) return false;
	}
	return ret;
}

*/


let uniqueID_cnt = 1;

class Helpers {
	constructor(){}
	static GetUniqueID(prefix) {
		prefix = prefix ?? '_';
		return prefix + (uniqueID_cnt++);
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
}

/* ### CORE ### */
class Net {

}

class Board {

}

class Pin {
	constructor(rawName, pin, mode) {
		this.pin = pin;
		this.mode = mode;

		this.infos = {};
		this.meta = {
			parent: null
		};

		let p = Pin.ParseName(rawName);
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

	Connect() {}
}

class Component {
	constructor(_) {
		_ = _ ?? Component.ConstructorArguments();
		this.id = _.id ?? Helpers.GetUniqueID(_.prefix);
		this._pins = [];
	}

	static ConstructorArguments() {
		return {
			id: null,
			prefix: null
		}
	}

	SetPins(items) {
		if (Array.isArray(items)) {
			for (var i of items) {
				var newPin = i;
				if (!(i instanceof Pin)) newPin = new Pin(i.name, i.pin, i.mode);
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

		if (foundPins.length <= 0) throw `No pin found with ${JSON.stringify(infos)} on component ${this.id} [${this.constructor.name}]`;

		return foundPins;
	}

	_GetPin(infos) {
		let foundPins = this._GetPins(infos);
		if (foundPins.length > 1) throw `Multiple pins found with ${JSON.stringify(infos)} on component ${this.id} [${this.constructor.name}]`;
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
		return this._GetPins(infos);
	}


	static FromKiCad() {}
}

class Group extends Component {
	constructor(_) {
		_ = _ ?? Group.ConstructorArguments();

		_.prefix = _.prefix ?? 'G';

		super(_);
	}

	static ConstructorArguments() {
		return Component.ConstructorArguments();
	}
}

/* ### COMPONENTS ### */
class IC_74xx574 extends Component {
	constructor() {
		super({ prefix: 'IC' });
		this.SetPins([
			{ name: 'VCC', pin: 20, mode: 'W' },
			{ name: '~OE', pin: 1, mode: 'I' },
			{ name: 'CP', pin: 11, mode: 'I' },
			{ name: 'D0', pin: 2, mode: 'I' },
			{ name: 'D1', pin: 3, mode: 'I' },
			{ name: 'D2', pin: 4, mode: 'I' },
			{ name: 'D3', pin: 5, mode: 'I' },
			{ name: 'D4', pin: 6, mode: 'I' },
			{ name: 'D5', pin: 7, mode: 'I' },
			{ name: 'D6', pin: 8, mode: 'I' },
			{ name: 'D7', pin: 9, mode: 'I' },
			{ name: 'GND', pin: 10, mode: 'P' },
			{ name: 'Q0', pin: 19, mode: 'O' },
			{ name: 'Q1', pin: 18, mode: 'O' },
			{ name: 'Q2', pin: 17, mode: 'O' },
			{ name: 'Q3', pin: 16, mode: 'O' },
			{ name: 'Q4', pin: 15, mode: 'O' },
			{ name: 'Q5', pin: 14, mode: 'O' },
			{ name: 'Q6', pin: 13, mode: 'O' },
			{ name: 'Q7', pin: 12, mode: 'O' }
		]);
	}
}

class IC_74xx245 extends Component {
	constructor() {
		super({ prefix: 'IC' });
		this.SetPins([
			{ name: 'VCC', pin: 20, mode: 'W' },
			{ name: 'DIR', pin: 1, mode: 'I' },
			{ name: '~OE', pin: 19, mode: 'I' },
			{ name: 'A0', pin: 2, mode: 'B' },
			{ name: 'A1', pin: 3, mode: 'B' },
			{ name: 'A2', pin: 4, mode: 'B' },
			{ name: 'A3', pin: 5, mode: 'B' },
			{ name: 'A4', pin: 6, mode: 'B' },
			{ name: 'A5', pin: 7, mode: 'B' },
			{ name: 'A6', pin: 8, mode: 'B' },
			{ name: 'A7', pin: 9, mode: 'B' },
			{ name: 'GND', pin: 10, mode: 'P' },
			{ name: 'B0', pin: 18, mode: 'B' },
			{ name: 'B1', pin: 17, mode: 'B' },
			{ name: 'B2', pin: 16, mode: 'B' },
			{ name: 'B3', pin: 15, mode: 'B' },
			{ name: 'B4', pin: 14, mode: 'B' },
			{ name: 'B5', pin: 13, mode: 'B' },
			{ name: 'B6', pin: 12, mode: 'B' },
			{ name: 'B7', pin: 11, mode: 'B' },
		]);
	}
}

class IC_74xx181 extends Component {
	constructor() {
		super({ prefix: 'IC' });
		this.SetPins([
			{ name: "B0", pin: 1, mode: 'I'},
			{ name: "F1", pin: 10, mode: 'O'},
			{ name: "F2", pin: 11, mode: 'O'},
			{ name: "GND", pin: 12, mode: 'W'},
			{ name: "F3", pin: 13, mode: 'O'},
			{ name: "A=B", pin: 14, mode: 'O'},
			{ name: "15", pin: 600, mode: 'O'},
			{ name: "Cn+4", pin: 16, mode: 'I'},
			{ name: "Y", pin: 17, mode: 'O'},
			{ name: "B3", pin: 18, mode: 'I'},
			{ name: "A3", pin: 19, mode: 'I'},
			{ name: "A0", pin: 2, mode: 'I'},
			{ name: "B2", pin: 20, mode: 'I'},
			{ name: "A2", pin: 21, mode: 'I'},
			{ name: "B1", pin: 22, mode: 'I'},
			{ name: "A1", pin: 23, mode: 'I'},
			{ name: "VCC", pin: 24, mode: 'W'},
			{ name: "S3", pin: 3, mode: 'I'},
			{ name: "S2", pin: 4, mode: 'I'},
			{ name: "S1", pin: 5, mode: 'I'},
			{ name: "S0", pin: 6, mode: 'I'},
			{ name: "Cn", pin: 7, mode: 'I'},
			{ name: "M", pin: 8, mode: 'I'},
			{ name: "F0", pin: 9, mode: 'O'}
		]);
	}
}

class IC_74xx193 extends Component {
	constructor() {
		super({ prefix: 'IC' });
		this.SetPins([
			{ name: 'B', pin: 1, mode: 'I' },
			{ name: 'C', pin: 10, mode: 'I' },
			{ name: '~LOAD', pin: 11, mode: 'I' },
			{ name: '~CO', pin: 12, mode: 'O' },
			{ name: '~BO', pin: 13, mode: 'O' },
			{ name: 'CLR', pin: 14, mode: 'I' },
			{ name: 'A', pin: 15, mode: 'I' },
			{ name: 'VCC', pin: 16, mode: 'W' },
			{ name: 'QB', pin: 2, mode: 'O' },
			{ name: 'QA', pin: 3, mode: 'O' },
			{ name: 'DOWN', pin: 4, mode: 'C' },
			{ name: 'UP', pin: 5, mode: 'C' },
			{ name: 'QC', pin: 6, mode: 'O' },
			{ name: 'QD', pin: 7, mode: 'O' },
			{ name: 'GND', pin: 8, mode: 'W' },
			{ name: 'D', pin: 9, mode: 'I' }
		]);
	}
}

class IC_AS6C1008 extends Component {
	constructor() {
		super({ prefix: 'IC' });
		this.SetPins([
			{ name: 'VCC', pin: 32, mode: 'W' },
			{ name: 'CE', pin: 22, mode: 'I' },
			{ name: 'OE', pin: 24, mode: 'I' },
			{ name: 'WE', pin: 29, mode: 'I' },
			{ name: 'CE2', pin: 30, mode: 'I' },
			{ name: 'A0', pin: 12, mode: 'I' },
			{ name: 'A1', pin: 11, mode: 'I' },
			{ name: 'A2', pin: 10, mode: 'I' },
			{ name: 'A3', pin: 9, mode: 'I' },
			{ name: 'A4', pin: 8, mode: 'I' },
			{ name: 'A5', pin: 7, mode: 'I' },
			{ name: 'A6', pin: 6, mode: 'I' },
			{ name: 'A7', pin: 5, mode: 'I' },
			{ name: 'A8', pin: 27, mode: 'I' },
			{ name: 'A9', pin: 26, mode: 'I' },
			{ name: 'A10', pin: 23, mode: 'I' },
			{ name: 'A11', pin: 25, mode: 'I' },
			{ name: 'A12', pin: 4, mode: 'I' },
			{ name: 'A13', pin: 28, mode: 'I' },
			{ name: 'A14', pin: 3, mode: 'I' },
			{ name: 'A16', pin: 2, mode: 'I' },
			{ name: 'A15', pin: 31, mode: 'I' },
			{ name: 'NC', pin: 1, mode: 'N' },
			{ name: 'VSS', pin: 16, mode: 'B' },
			{ name: 'DQ0', pin: 13, mode: 'B' },
			{ name: 'DQ1', pin: 14, mode: 'B' },
			{ name: 'DQ2', pin: 15, mode: 'B' },
			{ name: 'DQ3', pin: 17, mode: 'B' },
			{ name: 'DQ4', pin: 18, mode: 'B' },
			{ name: 'DQ5', pin: 19, mode: 'B' },
			{ name: 'DQ6', pin: 20, mode: 'B' },
			{ name: 'DQ7', pin: 21, mode: 'B' }
		]);
	}
}

class IC_AT28C64B extends Component {
	constructor() {
		super({ prefix: 'IC' });
		this.SetPins([
			{ name: '~CE', pin: 20, mode: 'I' },
			{ name: '~WE', pin: 27, mode: 'I' },
			{ name: 'A0', pin: 10, mode: 'I' },
			{ name: 'A1', pin: 9, mode: 'I' },
			{ name: 'A2', pin: 8, mode: 'I' },
			{ name: 'A3', pin: 7, mode: 'I' },
			{ name: 'A4', pin: 6, mode: 'I' },
			{ name: 'A5', pin: 5, mode: 'I' },
			{ name: 'A6', pin: 4, mode: 'I' },
			{ name: 'A7', pin: 3, mode: 'I' },
			{ name: 'A8', pin: 25, mode: 'I' },
			{ name: 'A9', pin: 24, mode: 'I' },
			{ name: 'A10', pin: 21, mode: 'I' },
			{ name: 'A11', pin: 23, mode: 'I' },
			{ name: 'A12', pin: 2, mode: 'I' },
			{ name: 'VCC', pin: 28, mode: 'W' },
			{ name: '~OE', pin: 22, mode: 'I' },
			{ name: 'I/O0', pin: 11, mode: 'B' },
			{ name: 'I/O1', pin: 12, mode: 'B' },
			{ name: 'I/O2', pin: 13, mode: 'B' },
			{ name: 'I/O3', pin: 15, mode: 'B' },
			{ name: 'I/O4', pin: 16, mode: 'B' },
			{ name: 'I/O5', pin: 17, mode: 'B' },
			{ name: 'I/O6', pin: 18, mode: 'B' },
			{ name: 'I/O7', pin: 19, mode: 'B' },
			{ name: 'GND', pin: 14, mode: 'W' }
		]);
	}
}

class PINHEAD extends Component {
	constructor(count) {
		super();
		count = Math.max(1, count);
		
		let pins = [];
		for (var i = 1; i < count; i++)
			pins.push({ name: `P${i}`, pin: i, mode: B });

		this.SetPins(pins);
	}
}

/* ### GROUPS ### */
class reg_group extends Group {
	constructor() {
		super();

		this.reg_latch = new IC_74xx574();
		this.reg_tri = new IC_74xx245();

		for (var i = 0; i <= 7; i++) {
			this.reg_latch.Pin(`Q${i}`).Connect(this.reg_tri.Pin(`A${i}`));
			this.reg_tri.Pin(`B${i}`).Connect(this.reg_latch.Pin(`D${i}`));
		}

		this.SetPins({
			latch_oe: this.reg_latch.Pin('OE'),
			cp: this.reg_latch.Pin('CP'),

			dir: this.reg_tri.Pin('DIR'),
			tri_oe: this.reg_tri.Pin('OE')
		});
	}

	$Pin(name) {
		let isDB = Pin.HasPrefix(name, 'DB');
		console.log(isDB);
		if (isDB) return this.reg_tri.Pin(`B${isDB.name.index}`);

		let isIB = Pin.HasPrefix(name, 'IB');
		if (isIB) return this.reg_latch.Pin(`Q${isIB.name.index}`);
	}

	ConnectDataBus(dest, prefix) {
		for (var i = 0; i <= 7; i++)
			this.Pin(`DB${i}`).Connect(dest.Pin(`${prefix}${i}`));
	}
}

/* ### MAIN ### */
class fourbit_board extends Board {
	constructor() {
		super();

		this.reg_A = new reg_group();
		this.reg_B = new reg_group();
		this.reg_C = new reg_group();

		this.reg_A.ConnectDataBus(this.reg_B, 'DB');
		this.reg_B.ConnectDataBus(this.reg_C, 'DB');

		this.alu = new IC_74xx181();
		this.reg_A.Pin('IB0').Connect(this.alu.Pin('A0'));
		this.reg_A.Pin('IB1').Connect(this.alu.Pin('A1'));
		this.reg_A.Pin('IB2').Connect(this.alu.Pin('A2'));
		this.reg_A.Pin('IB3').Connect(this.alu.Pin('A3'));

		this.reg_B.Pin('IB0').Connect(this.alu.Pin('B0'));
		this.reg_B.Pin('IB1').Connect(this.alu.Pin('B1'));
		this.reg_B.Pin('IB2').Connect(this.alu.Pin('B2'));
		this.reg_B.Pin('IB3').Connect(this.alu.Pin('B3'));

		// RAM
		this.ram = new IC_AS6C1008();
		for (var i = 0; i < 8; i++)
			this.ram.Pin('A', i).Connect(this.reg_B.Pin(`IB${i}`));
		for (var i = 0; i < 4; i++)
			this.ram.Pin('DQ', i).Connect(this.reg_C.Pin(`DB${i}`));

		console.log(this.ram.Pins('A'));
		//this.ram.ConnectMultiple(['A0', 'A1'], this.reg_B, ['DB0', 'DB1']);

		// this.ram.ConnectMultiple(srcPinsArray, destComponent, destPinsArray);
		// this.ram.ConnectBus(srcPrefix, startIdx, endIdx, destComponent, destPrefix, [destOffset])

		// ??? this.ram.Pin('A').ConnectMultiple(start, end, dest);


	}
}


let mainBoard = new fourbit_board();

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