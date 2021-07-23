import Trace from '../../core/Trace.js';
import BlinkLed from "./src/Boards/BlinkLed.mjs";

Trace.Library_LoadKiCadFolder();
Trace.Footprints_LoadFromKiCad('./footprints');

new BlinkLed();

Trace.Netlist_Generate('./examples/Blink LED/out/netlist/BlinkLed.net');
Trace.Schematic_Generate('./examples/Blink LED/out/schematic/BlinkLed.svg');
