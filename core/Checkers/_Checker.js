const Logger = require("../Utils/Logger");

class Checker_Report {
  static Ok(message, payload) {
    let ret = new Checker_Report();
    ret.result = true;
    ret.message = message ?? 'Satisfied checker.';
    ret.payload = payload ?? null;
    return ret;
  }

  static Error(message, payload) {
    let ret = new Checker_Report();
    ret.result = false;
    ret.message = message ?? 'Unsatisfied checker.';
    ret.payload = payload ?? null;
    return ret;
  }
}

class Checker {
  constructor() {
  }

  $Check(dest) {
    let end = true;

    for (var c of dest.components) {
      let ret = this.$CheckComponent(c);
      this.LogReport(ret);
      c.render.error = !ret.result;
      if (!ret.result) end = false;
    }

    for (var n of dest.nets) {
      let ret = this.$CheckNet(n);
      this.LogReport(ret);
      n.render.error = !ret.result;
      if (!ret.result) end = false;
    }

    return end;
  }

  LogReport(report) {
    if (!(report instanceof Checker_Report)) throw 'Checker must report result using Checker_Report class.';
    if (!report.result)
      Logger.Error(`${this.constructor.name}`, report.message, report.payload);
    else
      Logger.Ok(`${this.constructor.name}`, report.message, report.payload);
  }

  $CheckComponent(component) {
    return Checker_Report.Ok();
  }

  $CheckNet(net) {
    return Checker_Report.Ok();
  }
}

module.exports.Checker = Checker;
module.exports.Checker_Report = Checker_Report;