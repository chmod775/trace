const Helpers = require('../Utils/Helpers');
const { Lisp_Statement } = require('../Utils/Parsers/Lisp_Parser');
const Generator = require('./_Generator');
const VERSION = 'TRACE - JavaScript PCB Netlist Generator [v0.1]';

class Netlist_Generator extends Generator {
  constructor() {
    super();
    this.rootStatement = new Lisp_Statement('export');
    this.rootStatement.AddArgument(new Lisp_Statement('version', ['D']));

    this.statements = {
      design: this.rootStatement.AddArgument(new Lisp_Statement('design')),
      components: this.rootStatement.AddArgument(new Lisp_Statement('components')),
      libparts: this.rootStatement.AddArgument(new Lisp_Statement('libparts')),
      libraries: this.rootStatement.AddArgument(new Lisp_Statement('libraries')),
      nets: this.rootStatement.AddArgument(new Lisp_Statement('nets'))
    }

    this.uniqueTimeStamp = Math.floor(+new Date() / 1000);

    this.Populate();
  }

  Populate() {
    const Trace = require('../Trace');
    // Components
		for (var c of Trace.components)
      this.AddComponent(c);

    // Wiring
    for (var n of Trace.nets)
      this.AddNet(n);

    // Libraries
    this.AddLibrariesFromComponents(Trace.components);
  }

  SetDesign(source, date) {
    date = date ?? new Date();
    this.statements.design.SetArgument(new Lisp_Statement('source', [source]));
    this.statements.design.SetArgument(new Lisp_Statement('date', [ `"${date}"` ]));
    this.statements.design.SetArgument(new Lisp_Statement('tool', [ `"${VERSION}"` ]));
  }

  AddComponent(component) {
    let newComp = new Lisp_Statement('comp');

    newComp.SetArgument(new Lisp_Statement('ref', [ component.GetReference() ]));
    if (component.value) newComp.SetArgument(new Lisp_Statement('value', [ component.value ]));
    if (component.footprint) newComp.SetArgument(new Lisp_Statement('footprint', [ `${component.footprint.directory}:${component.footprint.filename}` ]));
    newComp.SetArgument(new Lisp_Statement('libsource', [
      new Lisp_Statement('lib', [ component.constructor.libraryName ]),
      new Lisp_Statement('part', [ component.constructor.partName ]),
      new Lisp_Statement('description', [ `"${component.constructor.doc.description ?? ''}"` ]),
    ]));
    newComp.SetArgument(new Lisp_Statement('tstamp', [ this.uniqueTimeStamp.toString(16).toUpperCase() ]));

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
      let newLibPart = new Lisp_Statement('libpart');
      newLibPart.SetArgument(new Lisp_Statement('lib', [ cVal.constructor.libraryName ]));
      newLibPart.SetArgument(new Lisp_Statement('part', [ cVal.constructor.partName ]));
      newLibPart.SetArgument(new Lisp_Statement('description', [ `"${cVal.constructor.doc.description ?? ''}"` ]));

      // Footprints
      let newLibPart_footprints = new Lisp_Statement('footprints');
      if (Array.isArray(cVal.constructor.lib.footprints)) {
        for (var f of cVal.constructor.lib.footprints) {
          newLibPart_footprints.AddArgument(
            new Lisp_Statement('fp', [ f ])
          );
        }
      } else {
        newLibPart_footprints.AddArgument(
          new Lisp_Statement('fp', [ cVal.constructor.lib.footprints ])
        );
      }
      newLibPart.SetArgument(newLibPart_footprints);
      
      // Fields
      let newLibPart_fields = new Lisp_Statement('fields');
      newLibPart.SetArgument(newLibPart_fields);

      // Pins
      let newLibPart_pins = new Lisp_Statement('pins');
      for (var p of cVal.GetPins()) {
        let newLibPart_pin = new Lisp_Statement('pin');
        newLibPart_pin.SetArgument(new Lisp_Statement('num', [ p.num ]));
        newLibPart_pin.SetArgument(new Lisp_Statement('name', [ p.infos.rawName ]));
        newLibPart_pin.SetArgument(new Lisp_Statement('type', [ Netlist_Generator.ConvertPinType(p.electrical_type) ]));

        newLibPart_pins.AddArgument(newLibPart_pin);
      }
      newLibPart.SetArgument(newLibPart_pins);

      this.statements.libparts.AddArgument(newLibPart);
    }
  }

  AddNet(net) {
    let newNet = new Lisp_Statement('net');
    newNet.SetArgument(new Lisp_Statement('code', [ this.statements.nets.length + 1 ]));
    newNet.SetArgument(new Lisp_Statement('name', [ `"${net.name}"` ]));

    for (var p of net.GetPins()) {
      let newNode = new Lisp_Statement('node');
      newNode.SetArgument(new Lisp_Statement('ref', [ p.owner.GetReference() ]));
      newNode.SetArgument(new Lisp_Statement('pin', [ p.num ]));

      newNet.AddArgument(newNode);
    }

    this.statements.nets.AddArgument(newNet);
  }

  Generate() {
    return this.rootStatement.toString();
  }
}

module.exports = Netlist_Generator;