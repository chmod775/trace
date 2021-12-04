const Generator = require('./_Generator');
const ELK = require('elkjs');

const { createSVGWindow } = require('svgdom')
const window = createSVGWindow()
const document = window.document
const { SVG, registerWindow } = require('@svgdotjs/svg.js')
registerWindow(window, document)

class Schematic_Generator extends Generator {
  constructor() {
    super();

    this.scale = 1.0;

    this.PinSides = {
      L: 'EAST',
      R: 'WEST',
      U: 'SOUTH',
      D: 'NORTH'
    }

    this.graph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "spacing.baseValue": "40.0"
      },
      children: [],
      edges: []
    };
  }

  AddComponent(component) {
    let newNode = {
      id: component.GetReference(),
      ref: component,
      layoutOptions: {
        "nodeSize.constraints": "[PORTS]",
        "nodeLabels.placement": "[H_CENTER, V_CENTER, OUTSIDE]",
        "portLabels.placement": "INSIDE",
        "portConstraints": "FIXED_ORDER"
      },
      ports: [],
      error: component.render.error
    };

    //if (component.constructor.lib.svg) {
    let cSVG = new SVG();
    component.$Symbol().RenderSVG(cSVG);

    let bbox = cSVG.bbox();
    newNode['width'] = bbox.width * this.scale;
    newNode['height'] = bbox.height * this.scale;
    newNode.svg = cSVG;
    newNode.layoutOptions["nodeSize.constraints"] = "[]";
    //}

    let orderedPins = component.GetPins().sort((a, b) => a.num - b.num);
    let middlePinNum = Math.floor(orderedPins.length / 2);

    for (var p of orderedPins) {
      //let pSide = p.configs.side ? p.configs.side : (p.num > middlePinNum ? "EAST" : "WEST");
      let pSide = p.configs.direction ? this.PinSides[p.configs.direction.toUpperCase()] : (p.num > middlePinNum ? "EAST" : "WEST");

      newNode.ports.push({
        id: `${newNode.id}_${p.num}`,
        labels: [{
          id: `lbl_${newNode.id}_${p.num}`,
          text: p.infos.rawName
        }],
        properties: {
          "port.side": pSide,
          "port.index": p.num
        },
        width: 5,
        height: 5
      });
    }

    this.graph.children.push(newNode);
  }

  AddNet(net) {
    let orderedPins = net.GetPins().sort((a, b) => b.owner.GetPins().length - a.owner.GetPins().length);

    let firstPin = orderedPins[0];
    for (var pIdx = 1; pIdx < orderedPins.length; pIdx++) {
      let p = orderedPins[pIdx];

      let firstPinID = `${firstPin.owner.GetReference()}_${firstPin.num}`;
      let thisPinID = `${p.owner.GetReference()}_${p.num}`;
      let newEdge = {
        id: `e_${firstPinID}_${thisPinID}_${net.name}`,
        sources: [ firstPinID ],
        targets: [ thisPinID ],
        error: net.render.error
      }

      this.graph.edges.push(newEdge);
    }
  }

  ProcessBoard(board) {
    let components = board.components;
    let nets = {};

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
  }

  static async Generate(boardRef) {
    let gen = new Schematic_Generator();
    boardRef = Array.isArray(boardRef) ? boardRef : [boardRef];

    for (var b of boardRef)
      gen.ProcessBoard(b);

    let elk = new ELK();
    return await elk.layout(gen.graph);
  }
}

module.exports = Schematic_Generator;