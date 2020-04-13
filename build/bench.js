"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Benchmark = __importStar(require("benchmark"));
const sharedstreets_types_1 = require("sharedstreets-types");
const sharedstreets = __importStar(require("./src/"));
// Fixtures
const message = "Intersection 110.000000 45.000000";
const coord = [110, 45];
const geom = [[110, 45], [115, 50], [120, 55]];
const locationReferences = [
    sharedstreets.locationReference([-74.00482177734375, 40.741641998291016], { outboundBearing: 208, distanceToNextRef: 9279 }),
    sharedstreets.locationReference([-74.005126953125, 40.74085235595703], { inboundBearing: 188 }),
];
const formOfWay = sharedstreets_types_1.FormOfWay.MultipleCarriageway;
sharedstreets.referenceId(locationReferences, formOfWay);
/**
 * Benchmark Results
 *
 * generateHash x 475,542 ops/sec ±4.91% (71 runs sampled)
 * intersectionId x 177,663 ops/sec ±17.20% (62 runs sampled)
 * geometryId x 90,787 ops/sec ±15.06% (62 runs sampled)
 * referenceId x 76,479 ops/sec ±5.55% (74 runs sampled)
 */
const suite = new Benchmark.Suite("sharedstreets");
suite
    .add("generateHash", () => sharedstreets.generateHash(message))
    .add("intersectionId", () => sharedstreets.intersectionId(coord))
    .add("geometryId", () => sharedstreets.geometryId(geom))
    .add("referenceId", () => sharedstreets.referenceId(locationReferences, formOfWay))
    .on("cycle", (e) => { process.stdout.write(String(e.target) + "\n"); })
    .run();
