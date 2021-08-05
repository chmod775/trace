const Trace = require("../../../../core/Trace");
const Oscillator = require("../Blocks/Oscillator");
const PinHead = require("../Components/PinHead");

class Blink extends Trace.Board {
  $Layout() {
    this.net_VCC = new Trace.Net('VCC');
    this.power_VCC = new Trace.Part['power']['VCC'];
    this.power_VCC.Pin(1).Connect(this.net_VCC);

    this.net_GND = new Trace.Net('GND');
    this.power_GND = new Trace.Part['power']['GND'];
    this.power_GND.Pin(1).Connect(this.net_GND);

    this.oscillator = new Oscillator(5);
    this.oscillator.ConnectPower(this.net_VCC, this.net_GND);

    this.pinout = new PinHead(3);
    this.pinout.Pin(1).Connect(this.net_VCC);
    this.pinout.Pin(2).Connect(this.oscillator.Out);
    this.pinout.Pin(3).Connect(this.net_GND);
  }
}
module.exports = Blink;