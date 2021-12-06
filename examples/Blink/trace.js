const path = require("path");
const BOM_Generator = require("../../core/Generators/BOM_Generator");
const ERC_Checker = require("../../core/Checkers/ERC_Checker");
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

Trace.Footprint_Assign(Trace.Part['Device'].R_US, "R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal");
Trace.Footprint_Assign(Trace.Part['Device'].C, "CP_Radial_D5.0mm_P2.50mm");
Trace.Footprint_Assign(Trace.Part['Timer']['NE555D'], "DIP-8_W10.16mm");

Trace.Footprints_AutoAssign();

// Generate BOM
console.log(BOM_Generator.Generate([b,l]));

// Check
Trace.Check([
  ERC_Checker,
  AllOutputsConnected_Checker
]);

/*
// Test
Trace.Test([
  OutputFrequency_Tester
])
*/

Trace.GenerateMap();

// Export
Trace.Export();
