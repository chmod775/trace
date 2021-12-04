const path = require("path");
const BOM_Generator = require("../../core/Generators/BOM_Generator");
const Trace = require("../../core/Trace");
const Blink = require("./src/Boards/Blink");
const Led = require("./src/Boards/Led");
const AllOutputsConnected_Checker = require("./src/Checkers/AllOutputsConnected_Checker");

Trace.Project(__dirname, {
  name: 'Blink+Led',
  description: 'Blink an LED at 1Hz',
  version: '1.0.0'
});

// Import
Trace.ImportSymbol('./src/Components/Timer');
Trace.Footprints_LoadKiCadFolder();

// Layout
let b = new Blink();
let l = new Led();

console.log(BOM_Generator.Generate([b,l]));


// Check
Trace.Check([
  AllOutputsConnected_Checker
]);

/*
// Test
Trace.Test([
  OutputFrequency_Tester
])
*/
Trace.Footprints_AutoAssign();

// Export
Trace.Export();
