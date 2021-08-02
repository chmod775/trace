const Helpers = require('../Helpers');
const { Lust_Statement } = require('../Parsers/Lust_Parser');
const VERSION = 'TRACE - JavaScript PCB Netlist Generator [v0.1]';

class Netlist_Generator {
  constructor() {
    this.rootStatement = new Lust_Statement('export');
    this.rootStatement.AddArgument(new Lust_Statement('version', ['D']));

    this.statements = {
      design: this.rootStatement.AddArgument(new Lust_Statement('design')),
      components: this.rootStatement.AddArgument(new Lust_Statement('components')),
      libparts: this.rootStatement.AddArgument(new Lust_Statement('libparts')),
      libraries: this.rootStatement.AddArgument(new Lust_Statement('libraries')),
      nets: this.rootStatement.AddArgument(new Lust_Statement('nets'))
    }

    this.uniqueTimeStamp = Math.floor(+new Date() / 1000);
  }

  toString() {
    return this.rootStatement.toString();
  }

  SetDesign(source, date) {
    this.statements.design.SetArgument(new Lust_Statement('source', [source]));
    this.statements.design.SetArgument(new Lust_Statement('date', [ `"${date}"` ]));
    this.statements.design.SetArgument(new Lust_Statement('tool', [ `"${VERSION}"` ]));
  }

  AddComponent(component) {
    let newComp = new Lust_Statement('comp');

    newComp.SetArgument(new Lust_Statement('ref', [ component.GetReference() ]));
    if (component.value) newComp.SetArgument(new Lust_Statement('value', [ component.value ]));
    if (component.footprint) newComp.SetArgument(new Lust_Statement('footprint', [ `${component.footprint.directory}:${component.footprint.filename}` ]));
    newComp.SetArgument(new Lust_Statement('libsource', [
      new Lust_Statement('lib', [ component.constructor.libraryName ]),
      new Lust_Statement('part', [ component.constructor.partName ]),
      new Lust_Statement('description', [ `"${component.constructor.doc.description ?? ''}"` ]),
    ]));
    newComp.SetArgument(new Lust_Statement('tstamp', [ this.uniqueTimeStamp.toString(16).toUpperCase() ]));

    this.uniqueTimeStamp++;
    this.statements.components.AddArgument(newComp);
    return newComp;
  }

  static ConvertPinType(electrical_type) {
    return {
      I: 'input',
      O: 'output',
      B: 'BiDi',
      T: '3state',
      P: 'passive',
      U: 'unspc',
      W: 'power_in',
      w: 'power_out',
      C: 'openCol',
      E: 'openEm',
      N: 'NotConnected'
    }[electrical_type.toUpperCase()];
  }

  AddLibrariesFromComponents(components) {
    let parts = {};

    for (var c of components)
      parts[c.constructor._name] = c;

    for (var cKey in parts) {
      let cVal = parts[cKey];
      let newLibPart = new Lust_Statement('libpart');
      newLibPart.SetArgument(new Lust_Statement('lib', [ cVal.constructor.libraryName ]));
      newLibPart.SetArgument(new Lust_Statement('part', [ cVal.constructor.partName ]));
      newLibPart.SetArgument(new Lust_Statement('description', [ `"${cVal.constructor.doc.description ?? ''}"` ]));

      // Footprints
      let newLibPart_footprints = new Lust_Statement('footprints');
      if (Array.isArray(cVal.constructor.lib.footprints)) {
        for (var f of cVal.constructor.lib.footprints) {
          newLibPart_footprints.AddArgument(
            new Lust_Statement('fp', [ f ])
          );
        }
      } else {
        newLibPart_footprints.AddArgument(
          new Lust_Statement('fp', [ cVal.constructor.lib.footprints ])
        );
      }
      newLibPart.SetArgument(newLibPart_footprints);
      
      // Fields
      let newLibPart_fields = new Lust_Statement('fields');
      newLibPart.SetArgument(newLibPart_fields);

      // Pins
      let newLibPart_pins = new Lust_Statement('pins');
      for (var p of cVal.GetPins()) {
        let newLibPart_pin = new Lust_Statement('pin');
        newLibPart_pin.SetArgument(new Lust_Statement('num', [ p.num ]));
        newLibPart_pin.SetArgument(new Lust_Statement('name', [ p.infos.rawName ]));
        newLibPart_pin.SetArgument(new Lust_Statement('type', [ Netlist_Generator.ConvertPinType(p.electrical_type) ]));

        newLibPart_pins.AddArgument(newLibPart_pin);
      }
      newLibPart.SetArgument(newLibPart_pins);

      this.statements.libparts.AddArgument(newLibPart);
    }
  }

  AddNet(net) {
    let newNet = new Lust_Statement('net');
    newNet.SetArgument(new Lust_Statement('code', [ this.statements.nets.length + 1 ]));
    newNet.SetArgument(new Lust_Statement('name', [ `"${net.name}"` ]));

    for (var p of net.GetPins()) {
      let newNode = new Lust_Statement('node');
      newNode.SetArgument(new Lust_Statement('ref', [ p.owner.GetReference() ]));
      newNode.SetArgument(new Lust_Statement('pin', [ p.num ]));

      newNet.AddArgument(newNode);
    }

    this.statements.nets.AddArgument(newNet);
  }
}

module.exports = Netlist_Generator;