const fs = require('fs');
const path = require('path');
const ERC_Checker = require('./core/Checkers/ERC_Checker');

const Trace = require('./core/Trace');

/* ### COMPONENTS ### */
class PINHEAD extends Trace.Component {
	constructor(count) {
		super();
		count = Math.max(1, count);
		
		let pins = [];
		for (var i = 1; i < count; i++)
			pins.push({ name: `P${i}`, num: i, electrical_type: B });

		this.SetPins(pins);
	}
}

/* ### BLOCKS ### */
class reg_group extends Trace.Block {
	constructor(startID, nets) {
		super();

		this.reg_latch = new Trace.Part['74xx'].SN74LS574({ id: startID });
		this.reg_tri = new Trace.Part['74xx'].SN74LS245({ id: startID + 1 });

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
class fourbit_board extends Trace.Board {
	constructor() {
		super('fourbit');

		let net_VCC = new Trace.Net('VCC');
		let net_GND = new Trace.Net('GND');

		let reg_A = new reg_group(1, { VCC: net_VCC, GND: net_GND });
		let reg_B = new reg_group(3, { VCC: net_VCC, GND: net_GND });
		let reg_C = new reg_group(5, { VCC: net_VCC, GND: net_GND });

		reg_A.ConnectEntireDataBus(reg_B);
		reg_B.ConnectEntireDataBus(reg_C);

		let alu = new Trace.Part['74xx'].SN74LS181({ id: 7 });
		reg_A.InternalBus(0).Connect(alu.Pin('A0'));
		reg_A.InternalBus(1).Connect(alu.Pin('A1'));
		reg_A.InternalBus(2).Connect(alu.Pin('A2'));
		reg_A.InternalBus(3).Connect(alu.Pin('A3'));

		reg_B.InternalBus(0).Connect(alu.Pin('B0'));
		reg_B.InternalBus(1).Connect(alu.Pin('B1'));
		reg_B.InternalBus(2).Connect(alu.Pin('B2'));
		reg_B.InternalBus(3).Connect(alu.Pin('B3'));

		// RAM
		let ram = new Trace.Part['AS6C1008-55PCN'].AS6C1008_55PCN({ id: 9 });
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

class led_group extends Trace.Block {
	constructor(net_GND, size) {
		super();

		this.size = size;
		this.net_GND = net_GND;

		for (var i = 0; i < size; i++) {
			let led = new Trace.Part['Device'].LED();
			let r = new Trace.Part['Device'].R();

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

class test_board extends Trace.Board {
	constructor() {
		super('test_board');

    let net_VCC = new Trace.Net('VCC');
    let power_VCC = new Trace.Part['power']['VCC'];
    power_VCC.Pin(1).Connect(net_VCC);

		let net_GND = new Trace.Net('GND');
    let power_GND = new Trace.Part['power']['GND'];
    power_GND.Pin(1).Connect(net_GND);

		let reg_A = new Trace.Part['74xx']['74LS574']({ connections: { VCC: net_VCC, GND: net_GND }});
		let reg_B = new Trace.Part['74xx']['74LS574']({ connections: { VCC: net_VCC, GND: net_GND }});

		let alu = new Trace.Part['74xx']['74LS181']({ connections: { VCC: net_VCC, GND: net_GND }});

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
/*
Trace.Library_LoadFromKiCad('libs/AT28C64B-15PU');
Trace.Library_LoadFromKiCad('libs/AS6C1008-55PCN');
Trace.Library_LoadFromKiCad('libs/74xx', 'SN');
Trace.Library_LoadFromKiCad('libs/Device', 'DEV');
Trace.Library_LoadFromKiCad('libs/Device', 'DEV');
*/
//Trace.Library_LoadKiCadFolder();

Trace.Footprints_LoadFromKiCad('./footprints');

console.log(Trace.Library_FindByRegEx(/NE555/gi));
//console.log(Object.keys(Trace.Library).length);
console.log(Trace.Part['Timer']['NE555D'].lib.svg);

let mainBoard = new test_board();

Trace.Check([
  ERC_Checker
]);
//console.log(Trace.Net_Print());

Trace.Footprints_AutoAssign();
//console.log(Trace.components.sort((a, b) => a.GetReference().includes('D') ? 1 : -1));



//console.log(Trace.Netlist_Generate('examples/test_22.net'));
Trace.Schematic_Generate('examples/test_22.svg')

//console.log(Trace.Footprints);
//console.log(Trace.Library.SN74LS574);

//console.log(Trace.Library.LED);

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
