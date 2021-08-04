const path = require("path");
const Trace = require("../../core/Trace");
const BlinkLed = require("./src/Boards/BlinkLed");
const AllOutputsConnected_Checker = require("./src/Checkers/AllOutputsConnected_Checker");

Trace.Project(__dirname, {
  name: 'BlinkLed',
  description: 'Blink an LED at 1Hz',
  version: '1.0.0'
});

// Import
Trace.Import('./src/Components/Timer');

// Layout
let b = new BlinkLed();



console.log(Object.keys(b).filter(k => b[k] instanceof Trace.Component));

/*
// Check
Trace.Check([
  AllOutputsConnected_Checker
]);


// Test
Trace.Test([
  OutputFrequency_Tester
])


// Export
Trace.Export();
*/