import Trace from "../../../../core/Trace.js";

export default class RCL extends Trace.Board {
  constructor() {
    super('RCL');

    let net_VCC = new Trace.Net('VCC');
    let power_VCC = new Trace.Part['power']['VCC'];
    power_VCC.Pin(1).Connect(net_VCC);

		let net_GND = new Trace.Net('GND');
    let power_GND = new Trace.Part['power']['GND'];
    power_GND.Pin(1).Connect(net_GND);
    
    let R1 = new Trace.Part['Device']['R']({ id: 1 });
    let R2 = new Trace.Part['Device']['R']({ id: 2 });

    R1.Pin(1).Connect(net_VCC);
    R1.Pin(2).Connect(R2.Pin(1));
    R2.Pin(2).Connect(net_GND);
  }
}