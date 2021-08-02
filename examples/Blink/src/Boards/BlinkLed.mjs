
import Trace from "../../../../core/Trace.js";
import Oscillator from "../Blocks/Oscillator.mjs";
import PinHead from "../Components/PinHead.mjs";

export default class BlinkLed extends Trace.Board {
  constructor() {
    super('BlinkLed');

    let net_VCC = new Trace.Net('VCC');
    let power_VCC = new Trace.Part['power']['VCC'];
    power_VCC.Pin(1).Connect(net_VCC);

		let net_GND = new Trace.Net('GND');
    let power_GND = new Trace.Part['power']['GND'];
    power_GND.Pin(1).Connect(net_GND);

    let oscillator = new Oscillator(5);
    oscillator.ConnectPower(net_VCC, net_GND);

    let debugLed = new Trace.Part['Device']['LED']();
    debugLed.Pin('K').Connect(net_GND);

    let debugLed_R = new Trace.Library.R_US();
    debugLed_R.Pin(1).Connect(debugLed.Pin('A'));
    debugLed_R.Pin(2).Connect(oscillator.Out);

    let pinout = new PinHead(3);
    pinout.Pin(1).Connect(net_VCC);
    pinout.Pin(2).Connect(oscillator.Out);
    pinout.Pin(3).Connect(net_GND);
  }
}