import Trace from "../../core/Trace.js";
import Divider from "./src/Boards/Divider.mjs";
import RCL from "./src/Boards/RCL.mjs";
import ERC_Checker from '../../core/Checkers/ERC_Checker.js';

let dividerBoard = new Divider();

Trace.Check([
  ERC_Checker
]);

Trace.Schematic_Generate('./examples/Spicy/out/schematic/Divider.svg');
