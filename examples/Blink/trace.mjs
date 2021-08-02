import Trace from '../../core/Trace.js';
import BlinkLed from "./src/Boards/BlinkLed.mjs";
import * as fs from 'fs';
import ERC_Checker from '../../core/Checkers/ERC_Checker.js';
import AllOutputsConnected_Checker from "./src/Checkers/AllOutputsConnected_Checker.mjs";

//Trace.Library_LoadKiCadFolder();
Trace.Footprints_LoadKiCadFolder();

new BlinkLed();

Trace.Check([
  ERC_Checker,
  AllOutputsConnected_Checker
]);

Trace.Footprints_AutoAssign();

Trace.Netlist_Generate('./examples/Blink/out/netlist/BlinkLed.net');
Trace.Schematic_Generate('./examples/Blink/out/schematic/BlinkLed.svg');