import Trace from '../../core/Trace.js';
import BlinkLed from "./src/Boards/BlinkLed.mjs";
import * as fs from 'fs';
import ERC_Checker from '../../core/Checkers/ERC_Checker.js';

Trace.Checkers([
  ERC_Checker
]);

//Trace.Library_LoadKiCadFolder();
Trace.Footprints_LoadFromKiCad('./footprints');

new BlinkLed();

Trace.Netlist_Generate('./examples/Blink/out/netlist/BlinkLed.net');
Trace.Schematic_Generate('./examples/Blink/out/schematic/BlinkLed.svg');