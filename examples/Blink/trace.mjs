import Trace from '../../core/Trace.js';
import BlinkLed from "./src/Boards/BlinkLed.mjs";
import * as fs from 'fs';



//Trace.Library_LoadKiCadFolder();
Trace.Footprints_LoadFromKiCad('./footprints');

new BlinkLed();

Trace.Netlist_Generate('./examples/Blink/out/netlist/BlinkLed.net');
Trace.Schematic_Generate('./examples/Blink/out/schematic/BlinkLed.svg');

let t = Trace.Part['Device']['CP'];
fs.writeFileSync('test_2.svg', t.lib.svg.svg());
