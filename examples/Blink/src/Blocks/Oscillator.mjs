import Trace from "../../../../core/Trace.js";
export default class Oscillator extends Trace.Block {
  constructor(freqHz) {
    super();

    this.ic = new Trace.Part['Timer']['NE555D'];
    this.r1 = new Trace.Part['Device'].R_US({ value: '10k' });
    this.r2 = new Trace.Part['Device'].R_US({ value: '715k' });
    this.c1 = new Trace.Part['Device'].C({ value: '1uF' });
    this.c2 = new Trace.Part['Device'].C({ value: '10nF' });

    this.t1 = new Trace.Part['Device'].Q_PNP_EBC();

    this.Out = this.ic.Pin('Q');

    this.ic.Pin(4).Connect(this.ic.Pin('VCC'));
    this.ic.Pin(2).Connect(this.ic.Pin(6));

    this.r1.Pin(1).Connect(this.ic.Pin(7));
    this.r1.Pin(2).Connect(this.ic.Pin('VCC'));

    this.r2.Pin(1).Connect(this.ic.Pin(7));
    this.r2.Pin(2).Connect(this.ic.Pin(6));

    this.c1.Pin(1).Connect(this.ic.Pin(6));
    this.c1.Pin(2).Connect(this.ic.Pin('GND'));

    this.c2.Pin(1).Connect(this.ic.Pin(5));
    this.c2.Pin(2).Connect(this.ic.Pin('GND'));
  }

  ConnectPower(vcc, gnd) {
    this.ic.Pin('VCC').Connect(vcc);
    this.ic.Pin('GND').Connect(gnd);
  }
}