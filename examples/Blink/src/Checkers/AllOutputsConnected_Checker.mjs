import { Checker, Checker_Report } from "../../../../core/Checkers/Checker.js";
import Trace from "../../../../core/Trace.js";
const { Pin } = Trace;

export default class AllOutputsConnected_Checker extends Checker {
  $CheckComponent(component) {
    let componentPins = component.GetPins(Pin.Type.Output);
    for (let p of componentPins)
      if (!p.net) return Checker_Report.Error(`Output pin [${p.num}] ${p.infos.rawName} of component ${component.GetReference()} not connected!`);
    return Checker_Report.Ok();
  }
}