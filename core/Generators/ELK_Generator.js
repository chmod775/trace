const fs = require('fs');
const path = require('path');

const Helpers = require('../Helpers');

const ELK = require('elkjs');

class ELK_Generator {
  constructor() {
    this.graph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "spacing.baseValue": "40.0"
      },
      children: [],
      edges: []
    };

    this.duplicateAvoider = 0;

    this.scale = 1.0;

    this.PinSides = {
      L: 'EAST',
      R: 'WEST',
      U: 'SOUTH',
      D: 'NORTH'
    }
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
      ports: []
    };

    if (component.constructor.lib.svg) {
      let bbox = component.constructor.lib.svg.bbox();
      console.log(newNode.id, bbox);
      newNode['width'] = bbox.width * this.scale;
      newNode['height'] = bbox.height * this.scale;
      newNode.svg = component.constructor.lib.svg;
      newNode.layoutOptions["nodeSize.constraints"] = "[]";
    }

    let orderedPins = component._pins.sort((a, b) => a.num - b.num);
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
    let orderedPins = net._pins.sort((a, b) => b.owner._pins.length - a.owner._pins.length);

    let firstPin = orderedPins[0];
    for (var pIdx = 1; pIdx < orderedPins.length; pIdx++) {
      let p = orderedPins[pIdx];

      let firstPinID = `${firstPin.owner.GetReference()}_${firstPin.num}`;
      let thisPinID = `${p.owner.GetReference()}_${p.num}`;
      let newEdge = {
        id: `e_${firstPinID}_${thisPinID}`,
        sources: [ firstPinID ],
        targets: [ thisPinID ]
      }

      this.graph.edges.push(newEdge);
    }
  }

  async GenerateLayout() {
    let elk = new ELK();
    return await elk.layout(this.graph);
  }
}

module.exports = ELK_Generator;