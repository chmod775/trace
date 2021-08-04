const Trace = require("../../../../core/Trace");

class PinHead extends Trace.Component {
  constructor(count) {
    super();

		count = Math.max(1, count);
		
		let pins = [];
		for (var i = 1; i <= count; i++)
			pins.push({ name: `P${i}`, num: i, electrical_type: 'B', direction: 'R' });

		this.SetPins(pins);
/*
    this.FootprintParameters({
      pinCount: count,
      pinDiameter: 2.54,
      pinSpacing: 2.54
    });
*/
  }

  $Footprint(parameters) {
    this.Footprint.AddPad()
  }

  static doc = {
    description: 'PinHead automagic component'
  };
  static lib = {
    footprints: ['test'],
    svg: null
  };
}
module.exports = PinHead;