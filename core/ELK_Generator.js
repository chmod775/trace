const fs = require('fs');
const path = require('path');

const Helpers = require('./Helpers');

const ELK = require('elkjs');
const elksvg = require('elkjs-svg');

class ELK_Generator {
  constructor() {
    this.graph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered"
      },
      children: [],
      edges: []
    };

    this.duplicateAvoider = 0;
  }

  AddComponent(component) {
    let newNode = {
      id: component.GetReference(),
      layoutOptions: {
        "nodeSize.constraints": "[PORTS MINIMUM_SIZE]",
        "nodeLabels.placement": "[H_CENTER, V_CENTER, OUTSIDE]",
        "portLabels.placement": "INSIDE",
        "portConstraints": "FIXED_ORDER"
      },
      ports: []
    };

    let orderedPins = component._pins.sort((a, b) => a.num - b.num);
    let middlePinNum = Math.floor(orderedPins.length / 2);

    for (var p of orderedPins) {
      newNode.ports.push({
        id: `${newNode.id}_${p.num}`,
        labels: [{
          id: `lbl_${newNode.id}_${p.num}`,
          text: p.infos.rawName
        }],
        properties: {
          "port.side": p.num > middlePinNum ? "EAST" : "WEST",
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

  async GenerateSVG() {
    console.log(JSON.stringify(this.graph));
    let elk = new ELK();
    let renderer = new elksvg.Renderer();

    // DEBUG injection
    renderer.registerEdges = function(p) {
    (p.edges || []).forEach((e) => {
      e.sources.forEach(source_id => {

        e.targets.forEach(target_id => {
          if (source_id.includes("_")) {
            source_id = source_id.slice(0, source_id.indexOf("_"));
          }
          if (!this.isDescendant(source_id, target_id)) {
            source_id = this._parentIds[source_id];
          }
          this._edgeParents[source_id].push(e);
        });
      });
    });
    (p.children || []).forEach(c => this.registerEdges(c));
  }


    let layoutData = await elk.layout(this.graph);
    var ret = renderer.toSvg(layoutData);
    return ret;
  }
}

module.exports = ELK_Generator;