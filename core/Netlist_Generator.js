const { pid } = require('process');
const Helpers = require('./Helpers');
const VERSION = 'TRACE - JavaScript PCB Netlist Generator [v0.1]';

class Netlist_Statement {
  constructor(keyword, args) {
    if (!keyword || (keyword.length < 1)) throw 'Invalid keyword';
    this.keyword = keyword.toLowerCase();
    this.args = args ?? [];
  }

  SetArgument(arg) {
    let statementArgs = this.args.filter(a => a instanceof Netlist_Statement);
    let foundArgIndex = statementArgs.findIndex(a => a.keyword == arg.keyword);
    if (foundArgIndex < 0)
      this.AddArgument(arg);
    else
      this.args[foundArgIndex] = arg;
  }

  AddArgument(arg) {
    this.args.push(arg);
    return arg;
  }

  toString() {
    let out = [this.keyword];
    for (var a of this.args)
      out.push(a.toString());
    return `${this.args.length > 1 ? '\n' : ''}(${out.join(' ')})`;
  }

  get length() {
    return this.args.length;
  }
}

class Netlist_Generator {
  constructor() {
    this.rootStatement = new Netlist_Statement('export');
    this.rootStatement.AddArgument(new Netlist_Statement('version', ['D']));

    this.statements = {
      design: this.rootStatement.AddArgument(new Netlist_Statement('design')),
      components: this.rootStatement.AddArgument(new Netlist_Statement('components')),
      libparts: this.rootStatement.AddArgument(new Netlist_Statement('libparts')),
      libraries: this.rootStatement.AddArgument(new Netlist_Statement('libraries')),
      nets: this.rootStatement.AddArgument(new Netlist_Statement('nets'))
    }

    this.uniqueTimeStamp = Math.floor(+new Date() / 1000);
  }

  toString() {
    return this.rootStatement.toString();
  }

  SetDesign(source, date) {
    this.statements.design.SetArgument(new Netlist_Statement('source', [source]));
    this.statements.design.SetArgument(new Netlist_Statement('date', [ `"${date}"` ]));
    this.statements.design.SetArgument(new Netlist_Statement('tool', [ `"${VERSION}"` ]));
  }

  AddComponent(component) {
    let newComp = new Netlist_Statement('comp');

    newComp.SetArgument(new Netlist_Statement('ref', [ component.GetReference() ]));
    if (component.value) newComp.SetArgument(new Netlist_Statement('value', [ component.value ]));
    if (component.footprint) newComp.SetArgument(new Netlist_Statement('footprint', [ `${component.footprint.directory}:${component.footprint.filename}` ]));
    newComp.SetArgument(new Netlist_Statement('libsource', [
      new Netlist_Statement('lib', [ component.constructor.libraryName ]),
      new Netlist_Statement('part', [ component.constructor.partName ]),
      new Netlist_Statement('description', [ `"${component.constructor.doc.description ?? ''}"` ]),
    ]));
    newComp.SetArgument(new Netlist_Statement('tstamp', [ this.uniqueTimeStamp.toString(16).toUpperCase() ]));

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
      let newLibPart = new Netlist_Statement('libpart');
      newLibPart.SetArgument(new Netlist_Statement('lib', [ cVal.constructor.libraryName ]));
      newLibPart.SetArgument(new Netlist_Statement('part', [ cVal.constructor.partName ]));
      newLibPart.SetArgument(new Netlist_Statement('description', [ `"${cVal.constructor.doc.description ?? ''}"` ]));

      // Footprints
      let newLibPart_footprints = new Netlist_Statement('footprints');
      if (Array.isArray(cVal.constructor.lib.footprints)) {
        for (var f of cVal.constructor.lib.footprints) {
          newLibPart_footprints.AddArgument(
            new Netlist_Statement('fp', [ f ])
          );
        }
      } else {
        newLibPart_footprints.AddArgument(
          new Netlist_Statement('fp', [ cVal.constructor.lib.footprints ])
        );
      }
      newLibPart.SetArgument(newLibPart_footprints);
      
      // Fields
      let newLibPart_fields = new Netlist_Statement('fields');
      newLibPart.SetArgument(newLibPart_fields);

      // Pins
      let newLibPart_pins = new Netlist_Statement('pins');
      for (var p of cVal._pins) {
        let newLibPart_pin = new Netlist_Statement('pin');
        newLibPart_pin.SetArgument(new Netlist_Statement('num', [ p.num ]));
        newLibPart_pin.SetArgument(new Netlist_Statement('name', [ p.infos.rawName ]));
        newLibPart_pin.SetArgument(new Netlist_Statement('type', [ Netlist_Generator.ConvertPinType(p.electrical_type) ]));

        newLibPart_pins.AddArgument(newLibPart_pin);
      }
      newLibPart.SetArgument(newLibPart_pins);

      this.statements.libparts.AddArgument(newLibPart);
    }
  }

  AddNet(net) {
    let newNet = new Netlist_Statement('net');
    newNet.SetArgument(new Netlist_Statement('code', [ this.statements.nets.length + 1 ]));
    newNet.SetArgument(new Netlist_Statement('name', [ `"${net.name}"` ]));

    for (var p of net._pins) {
      let newNode = new Netlist_Statement('node');
      newNode.SetArgument(new Netlist_Statement('ref', [ p.owner.GetReference() ]));
      newNode.SetArgument(new Netlist_Statement('pin', [ p.num ]));

      newNet.AddArgument(newNode);
    }

    this.statements.nets.AddArgument(newNet);
  }
}

module.exports = Netlist_Generator;