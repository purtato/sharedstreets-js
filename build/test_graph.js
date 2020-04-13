"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const envelope_1 = __importDefault(require("@turf/envelope"));
const index_1 = require("./src/index");
const graph_1 = require("./src/graph");
const test = require('tape');
test("sharedstreets -- graph test", (t) => __awaiter(this, void 0, void 0, function* () {
    var params = new index_1.TilePathParams();
    params.source = 'osm/planet-181224';
    params.tileHierarchy = 7;
    // test polygon (dc area)
    const content = fs.readFileSync('test/geojson/test_route.geojson');
    var lineIn = JSON.parse(content.toLocaleString());
    var graph = new graph_1.Graph(envelope_1.default(lineIn), params);
    yield graph.buildGraph();
    t.equal(graph.id, 'd626d5b0-0dec-3e6f-97ff-d9712228a282');
    var results = yield graph.matchGeom(lineIn.features[0]);
    lineIn.features[0].geometry.coordinates.reverse();
    var results2 = yield graph.matchGeom(lineIn.features[0]);
    t.end();
}));
