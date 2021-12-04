const { Checker, Checker_Report } = require("./_Checker");

class ERC_Checker extends Checker {
  static PinDefinition

  $CheckNet(net) {
    let results = {
      multipleOutputs: { inError: false, message: 'Multiple outputs connected to net' },
      floating: { inError: false, message: 'Floating net' },
      shortPower: { inError: false, message: 'Power connected to outputs' },
    };

    // Filter network pins
    let filters = {
      'Input': [],
      'Output': [],
      'Bidi': [],
      'Tristate': [],
      'Passive': [],
      'Unspecified': [],
      'PowerIn': [],
      'PowerOut': [],
      'OpenCollector': [],
      'OpenEmitter': [],
      'NotConnected': []
    };
    for (var p of net.GetPins()) {
      let p_ElectricalDef = p.electrical_def;
      filters[p_ElectricalDef].push(p);
    }

    // Multiple outputs on same network
    if (filters.Output.length > 1) results.multipleOutputs.inError = true;
    // Short circuit power with outputs
    if ((filters.Output.length > 0) && ((filters['PowerIn'].length > 0) || (filters['PowerOut'].length > 0))) results.shortPower.inError = true;

    // Report results
    let errorOutput = Object.values(results).filter(r => r.inError).map(e => e.message);
    return errorOutput.length > 0 ? Checker_Report.Error(`NET ${net.name} - ${errorOutput.join(', ')}`) : Checker_Report.Ok(`NET: ${net.name} passed ERC`);
  }

  $CheckComponent(component) {
    let results = {
      noPower: { inError: false, message: 'Missing power connection to component' },
    };

    let cPins = component.GetPins();
    let filters = {
      'Input': [],
      'Output': [],
      'Bidi': [],
      'Tristate': [],
      'Passive': [],
      'Unspecified': [],
      'PowerIn': [],
      'PowerOut': [],
      'OpenCollector': [],
      'OpenEmitter': [],
      'NotConnected': []
    };
    for (var p of cPins) {
      let p_ElectricalDef = p.electrical_def;
      filters[p_ElectricalDef].push(p);
    }

    // Missing connection to power pins
    let unconnectedPowerPins = [];
    let sourcesPowerPins = {};
    for (var p of filters['PowerIn']) {
      if (!p.net)
        unconnectedPowerPins.push(p);
      else {
        sourcesPowerPins[p.num] = sourcesPowerPins[p.num] ?? { pin: p, sources: {} };
        let netPins = p.net.GetPins();
        for (let np of netPins) {
          if ((np.electrical_type == 'w') || (np.owner.constructor.lib.libraryName == 'power'))
            sourcesPowerPins[p.num].sources[np.owner.GetReference()] = true;
        }
      }
    }
    if (unconnectedPowerPins.length > 0) results.noPower.inError = true;
    if (Object.values(sourcesPowerPins).filter(p => Object.keys(p.sources).length == 0).length > 0) results.noPower.inError = true;

    // Report results
    let errorOutput = Object.values(results).filter(r => r.inError).map(e => e.message);
    return errorOutput.length > 0 ? Checker_Report.Error(`COMPONENT ${component.GetReference()} - ${errorOutput.join(', ')}`) : Checker_Report.Ok(`COMPONENT: ${component.GetReference()} passed ERC`);
  }
}

module.exports = ERC_Checker;