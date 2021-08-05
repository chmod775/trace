const Trace = require("../../../../core/Trace");
const PinHead = require("../Components/PinHead");

class Led extends Trace.Board {
  $Layout() {
    this.debugLed = new Trace.Part['Device']['LED']();
    this.debugLed_R = new Trace.Library.R_US({ value: '10k' });
    this.pinout = new PinHead(3);

    this.debugLed_R.Pin(1).Connect(this.debugLed.Pin('A'));
    this.debugLed_R.Pin(2).Connect(this.pinout.Pin(2));
    this.debugLed.Pin('K').Connect(this.pinout.Pin(3));
  }
}
module.exports = Led;