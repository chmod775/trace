
import Trace from "../../../../core/Trace.js";
import Oscillator from "../Blocks/Oscillator.mjs";
import PinHead from "../Components/PinHead.mjs";

export default class BlinkLed extends Trace.Board {
  constructor() {
    super('BlinkLed');

    this.net_VCC = new Trace.Net('VCC');
    this.power_VCC = new Trace.Part['power']['VCC'];
    this.net_GND = new Trace.Net('GND');
    this.power_GND = new Trace.Part['power']['GND'];
    this.oscillator = new Oscillator(5);
    this.debugLed = new Trace.Part['Device']['LED']();
    this.debugLed_R = new Trace.Library.R_US();
    this.pinout = new PinHead(3);

    this.Connect();
  }

  Connect() {
    this.power_VCC.Pin(1).Connect(this.net_VCC);

    this.power_GND.Pin(1).Connect(this.net_GND);

    this.oscillator.ConnectPower(this.net_VCC, this.net_GND);

    this.debugLed.Pin('K').Connect(this.net_GND);

    this.debugLed_R.Pin(1).Connect(this.debugLed.Pin('A'));
    this.debugLed_R.Pin(2).Connect(this.oscillator.Out);

    this.pinout.Pin(1).Connect(this.net_VCC);
    this.pinout.Pin(2).Connect(this.oscillator.Out);
    this.pinout.Pin(3).Connect(this.net_GND);
  }
}