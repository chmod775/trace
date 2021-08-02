const { Lust_Parser } = require("./core/Parsers/Lust_Parser");
const fs = require('fs');

let raw = fs.readFileSync('./footprints/LED_THT.pretty/LED_BL-FL7680RGB.kicad_mod', 'utf8');

let parser = new Lust_Parser(raw);
let parsed = parser.Parse();
console.log(parsed.toString());