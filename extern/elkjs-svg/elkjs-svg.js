"use strict";

const { SVG, G } = require("@svgdotjs/svg.js");
const {Xml, Text, Cdata} = require("./helpers/xml.js");

function Renderer() {
  // configuration
  this._style = `
    rect {
      stroke-width: 1;
      shape-rendering: crispEdges;
    }
    rect.port {
      opacity: 1;
      fill: #326CB2;
    }
    text {
      font-size: 10px;
      font-family: sans-serif;
      text-align: left;
    }
    g.port > text {
      font-size: 8px;
    }
    polyline {
      fill: none;
      stroke: black;
      stroke-width: 1;
      shape-rendering: crispEdges;
    }
    path {
      fill: none;
      stroke: black;
      stroke-width: 1;
      shape-rendering: crispEdges;
    }
    line {
      fill: none;
      shape-rendering: crispEdges;
    }
    rect {
      stroke: black;
    }
    circle {
      stroke: black;
    }
    .error { 
      stroke: red !important;
    }
  `;
  this._defs = new Xml(
    "marker",
    {
      "id": "arrow",
      "markerWidth": "10",
      "markerHeight": "8",
      "refX": "10",
      "refY": "4",
      "orient": "auto"
      },
      [
        new Xml("path", {"d": "M0,7 L10,4 L0,1 L0,7", "style": "fill: #000000;"})
      ]
  );

  this.reset();
}

Renderer.prototype = {
  constructor: Renderer,

  reset() {
    // internal housekeeping
    this._edgeRoutingStyle = {
      __global: "POLYLINE"
    };
    this._parentIds = {};
    this._edgeParents = {};
  },

  init(root) {
    // reset
    this.reset();
    this.registerParentIds(root);
    this.registerEdges(root);
  },

  /* Utility methods. */

  // edges can be specified anywhere, there coordinates however are relative
  //  a) to the source node's parent
  //  b) the source node, if the target is a descendant of the source node
  isDescendant(parent, node) {
    var current = node.id;
    while (this._parentIds[current]) {
      current = this._parentIds[current];
      if (current == parent.id) {
          return true;
      }
    }
    return false;
  },

  getOption(e, id) {
    if (!e) {
      return undefined;
    }
    if (e.id) {
      return e.id;
    }
    var suffix = id.substr(id.lastIndexOf('.') + 1);
    if (e[suffix]) {
      return e[suffix];
    }
    return undefined;
  },

  registerParentIds(p) {
    this._edgeParents[p.id] = [];
    if (p.properties) {
      var er = this.getOption(p.properties);
      if (er) {
        this._edgeRoutingStyle[p.id] = er;
      }
    }
    (p.children || []).forEach((c) => {
      this._parentIds[c.id] = p.id;
      this.registerParentIds(c);
    });
  },

  registerEdges(p) {
    (p.edges || []).forEach((e) => {
      e.sources.forEach(source_id => {
        e.targets.forEach(target_id => {
          if (source_id.includes(":")) {
            source_id = source_id.slice(0, source_id.indexOf(":"));
          }
          if (!this.isDescendant(source_id, target_id)) {
            source_id = this._parentIds[source_id];
          }
          this._edgeParents[source_id].push(e);
        });
      });
    });
    (p.children || []).forEach(c => this.registerEdges(c));
  },

  /*
   * Rendering methods.
   */

  renderRoot(root, styles="DEFAULT", defs="DEFAULT") {
    var children = [];

    var defsChildren = [];
    if (styles != null || defs != null) {
      if (styles != null) {
        defsChildren.push(this.svgCss(styles == "DEFAULT"? this._style: styles));
      }
      if (defs != null) {
        defsChildren.push(defs == "DEFAULT"? this._defs: new Text(defs));
      }
      children.push(new Xml("defs", {}, defsChildren));
    }

    children.push(this.renderGraph(root));

    return new Xml(
      "svg",
      {
          "version": "1.1",
          "xmlns": "http://www.w3.org/2000/svg",
          "width": root.width || 100,
          "height": root.height || 100,
          "xmlns:xlink": "http://www.w3.org/1999/xlink",
          "xmlns:svgjs": "http://svgjs.dev/svgjs"
      },
      children
    );
  },

  renderGraph(graph) {
    var children = [];

    // paint edges first so that ports are drawn on top of them
    for (const edge of this._edgeParents[graph.id]) {
      children.push(this.renderEdge(edge, graph));
      if (edge.labels) {
        children.push(this.renderLabels(edge.labels));
      }
      if (edge.junctionPoints) {
        children.push(this.renderJunctionPoints(edge.junctionPoints));
      }
    }
    for (const child of graph.children) {
      children.push(this.renderNode(child));

      if (child.ports || child.labels) {
        children.push(this.renderPortsAndLabels(child))
      }

      if (child.children != null && child.children.length > 0) {
        children.push(this.renderGraph(child));
      }
    }
    var properties = {};
    if (graph.x || graph.y) {
      properties["transform"] = `translate(${graph.x || 0},${graph.y || 0})`;
    }
    return new Xml("g", properties, children);
  },

  renderPortsAndLabels(node) {
    var children = [];

    for (const p of node.ports) {
      children.push(this.renderRect(p));
      if (p.labels) {
        children.push(this.renderPort(p));
      }
    }
    if (node.labels) {
      for (const l of node.labels) {
        children.push(this.renderLabel(l));
      }
    }

    return new Xml("g", {"transform": `translate(${node.x || 0},${node.y || 0})`}, children);
  },

  renderNode(node) {
    if (node.svg) {
      let svg = new G();
      if (node.error)
        svg.addClass('error');
      for (var c of node.svg.children())
        svg.add(c.clone());
      svg.text(node.id).font({anchor: 'end'}).translate(-(node.width / 2), -(node.height / 2) - 10);
      if (node.ref.value) svg.text(node.ref.value).font({anchor: 'start'}).translate(+(node.width / 2), -(node.height / 2) - 10);
      svg.translate(node.x + (node.width / 2), node.y + (node.height / 2));
      return svg.svg();
    } else
      return this.renderRect(node);
  },

  renderRect(node) {
    return new Xml("rect", {
      ...this.idClass(node, "node"),
      ...this.posSize(node),
      ...this.style(node),
      ...this.attributes(node)
    })
  },

  renderPort(port) {
    let pSide = port.properties['port.side'];
    let attr = {
      "dominant-baseline": "middle",
      "text-anchor": "middle"
    };

    switch (pSide.toUpperCase()) {
      case 'EAST':
        attr["text-anchor"] = "end";
        break;
      case 'WEST':
        attr["text-anchor"] = "start";
        break;
      case 'NORTH':
        attr["dominant-baseline"] = "hanging";
        break;
      case 'SOUTH':
        attr["dominant-baseline"] = "bottom";
        break;
    }

    return new Xml(
      "g",
      {
          ...this.idClass(port, "port"),
          "transform": `translate(${port.x || 0},${port.y || 0})`
      },
      this.renderLabels(port.labels, attr)
    )
  },

  renderJunctionPoints(junctionPoints) {
    var children = [];

    for (var j of junctionPoints) {
      children.push(this.renderJunction(j));
    }

    return new Xml("g", {}, children);
  },

  renderJunction(junction) {
    return new Xml("circle", {
      "cx": junction.x,
      "cy": junction.y,
      "r": 3,
      ...this.idClass(junction, "junction"),
      ...this.style(junction),
      ...this.attributes(junction),
    });
  },

  renderEdge(edge, node) {
    var bends = this.getBends(edge.sections);

    if (this._edgeRoutingStyle[node.id] == "SPLINES" || this._edgeRoutingStyle.__global == "SPLINES") {
      return this.renderPath(edge, bends);
    }
    return this.renderPolyline(edge, bends);
  },

  renderPath(edge, bends) {
    return new Xml("path", {
      "d": this.bendsToSpline(bends),
      ...this.idClass(edge, "edge"),
      ...this.style(edge),
      ...this.attributes(edge),
    });
  },

  renderPolyline(edge, bends) {
    return new Xml("polyline", {
      "points": this.bendsToPolyline(bends),
      ...this.idClass(edge, "edge"),
      ...this.style(edge),
      ...this.attributes(edge),
    });
  },

  getBends(sections) {
    var bends = [];
    if (sections && sections.length > 0) {
      sections.forEach(section => {
        if (section.startPoint) {
          bends.push(section.startPoint);
        }
        if (section.bendPoints) {
          bends = bends.concat(section.bendPoints);
        }
        if (section.endPoint) {
          bends.push(section.endPoint);
        }
      });
    }
    return bends;
  },

  renderLabels(labels, attr) {
    return (labels || []).map(l => l.text == '~' ? '' : this.renderLabel(l, attr))
  },

  renderLabel(label, attr) {
    return new Xml("text", {
      ...this.idClass(label, "label"),
      ...attr,
      ...this.posSize(label),
      ...this.style(label),
      ...this.attributes(label)
    }, [
      new Text(label.text)
    ]);
  },

  bendsToPolyline(bends) {
    return bends.map(bend => `${Math.floor(bend.x)},${Math.floor(bend.y)}`).join(" ")
  },

  bendsToSpline(bends) {
    if (!bends.length) {
      return ""
    }

    let {x, y} = bends[0];
    points = [`M${x} ${y}`]

    for (let i = 1; i < bends.length; i = i+3) {
      var left = bends.length - i;
      if (left == 1) {
        points.push(`L${bends[i].x + " " + bends[i].y}`);
      } else if (left == 2) {
        points.push(`Q${bends[i].x + " " + bends[i].y}`);
        points.push(bends[i+1].x + " " + bends[i+1].y);
      } else {
        points.push(`C${bends[i].x + " " + bends[i].y}`);
        points.push(bends[i+1].x + " " + bends[i+1].y);
        points.push(bends[i+2].x + " " + bends[i+2].y);
      }
    }
    return points.join(" ");
  },

  svgCss(css) {
    if (css == "") {
      return "";
    }
    return new Xml("style", {"type": "text/css"}, [
      new Cdata(
        new Text(css)
      )
    ]);
  },

  posSize(e) {
    return {
      "x": e.x || 0,
      "y": e.y || 0,
      "width": e.width || 0,
      "height": e.height || 0,
    };
  },

  idClass(e, className) {
    var elemClasses = Array.isArray(e.class)? e.class.join(" "): e.class;
    var classes = [elemClasses, className, e.error ? 'error' : ''].filter(c => c).join(" ")

    var properties = {}
    if (e.id) {
      properties["id"] = e.id;
    }
    if (classes) {
      properties["class"] = classes;
    }
    return properties;
  },

  style(e) {
    if (!e.style) {
      return {}
    }
    return {
      "style": e.style
    }
  },

  attributes(e) {
    return e.attributes;
  },


  /*
   * Public API
   */

  toSvg(json, styles="DEFAULT", defs="DEFAULT") {
   this.init(json);
   var tree = this.renderRoot(json, styles, defs);
   return tree.render();
  }
};


exports = module.exports = {
  Renderer
};
