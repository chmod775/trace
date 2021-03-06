const { Footprint } = require("../../../../core/Trace");
const Trace = require("../../../../core/Trace");

class PinHead extends Trace.Component {
  constructor(count) {
    super();

		count = Math.max(1, count);
		
		let pins = [];
		for (var i = 1; i <= count; i++)
			pins.push({ name: `P${i}`, num: i, electrical_type: 'B', direction: 'R' });

		this.SetPins(pins);
  }

  $Footprint() {
    let spacing = 2.54;
    let drill = 0.8;

    let newFootprint = new Trace.Footprint(this);

    for (var p of this.GetPins()) {
      let newPad = new Footprint.Pad(p, Footprint.Pad.Type.thru_hole, Footprint.Pad.Shape.circle);
      newPad.Position(0, (+p.num - 1) * spacing).Drill(drill).Autosize(0.4).Layers();
      newFootprint.AddPad(newPad);
    }

    return newFootprint;
  }

  $Symbol() {
    let newSymbol = new Trace.Symbol(this);

    return newSymbol;
  }

  static doc = {
    description: 'PinHead automagic component'
  };
}
module.exports = PinHead;