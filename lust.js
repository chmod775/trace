const { Lisp_Parser } = require("./core/Parsers/Lisp_Parser");
const fs = require('fs');

let raw = fs.readFileSync('./footprints/LED_THT.pretty/LED_BL-FL7680RGB.kicad_mod', 'utf8');

let parser = new Lisp_Parser(raw);
let parsed = parser.Parse();
console.log(parsed.toString());