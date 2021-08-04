const { Checker, Checker_Report } = require("../../../../core/Checkers/_Checker");
const Trace = require("../../../../core/Trace");
const { Pin } = Trace;

class AllOutputsConnected_Checker extends Checker {
  $CheckComponent(component) {
    let componentPins = component.GetPins(Pin.Type.Output);
    for (let p of componentPins)
      if (!p.net) return Checker_Report.Error(`Output pin [${p.num}] ${p.infos.rawName} of component ${component.GetReference()} not connected!`);
    return Checker_Report.Ok();
  }
}

module.exports = AllOutputsConnected_Checker;