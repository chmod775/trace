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
  }

  toString() {
    return this.rootStatement.toString();
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
    if (component.footprint) newComp.SetArgument(new Lisp_Statement('footprint', [ `${component.footprint.group}:${component.footprint.name}` ]));

    let componentLib = component.$Symbol();

    if (componentLib) {
      newComp.SetArgument(new Lisp_Statement('libsource', [
        new Lisp_Statement('lib', [ componentLib.libraryName ]),
        new Lisp_Statement('part', [ componentLib.partName ]),
        new Lisp_Statement('description', [ `"${componentLib.doc.description ?? ''}"` ]),
      ]));
    } else {
      console.log("test", componentLib);
    }


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
      let cLib = cVal.$Symbol();

      let newLibPart = new Lisp_Statement('libpart');
      newLibPart.SetArgument(new Lisp_Statement('lib', [ cLib.libraryName ]));
      newLibPart.SetArgument(new Lisp_Statement('part', [ cLib.partName ]));
      newLibPart.SetArgument(new Lisp_Statement('description', [ `"${cLib.doc.description ?? ''}"` ]));

      // Footprints
      let newLibPart_footprints = new Lisp_Statement('footprints');
      if (Array.isArray(cLib.footprintFiters)) {
        for (var f of cLib.footprintFiters) {
          newLibPart_footprints.AddArgument(
            new Lisp_Statement('fp', [ f ])
          );
        }
      } else {
        console.log(cLib.footprintFiters, Array.isArray(cLib.footprintFiters));
        newLibPart_footprints.AddArgument(
          new Lisp_Statement('fp', [ cLib.footprintFiters ?? '*' ])
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

  ProcessBoard(board) {
    let components = board.components;
    let nets = {};

    // Design data
    this.SetDesign(board.name);

    // Components
    for (var c of components.sort((a, b) => a.GetReference().includes('D') ? 1 : -1)) {
      this.AddComponent(c);
      for (var p of c.GetPins()) {
        if (p.net)
          nets[p.net.name] = p.net;
      }
    }
    
    // Wiring
    for (var n of Object.values(nets))
      this.AddNet(n);

    // Libraries
    this.AddLibrariesFromComponents(components);
  }

  static Generate(boardRef) {
    let gen = new Netlist_Generator();
    boardRef = Array.isArray(boardRef) ? boardRef : [boardRef];

    for (var b of boardRef)
      gen.ProcessBoard(b);

    return gen.toString();
  }
}

module.exports = Netlist_Generator;