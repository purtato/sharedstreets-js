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
const turfHelpers = __importStar(require("@turf/helpers"));
const index_1 = require("./src/index");
const geom_1 = require("./src/geom");
const index_2 = require("./src/index");
const envelope_1 = __importDefault(require("@turf/envelope"));
const test = require('tape');
const BUILD_TEST_OUPUT = false;
test("match points", (t) => __awaiter(this, void 0, void 0, function* () {
    // test polygon (dc area)
    const content = fs.readFileSync('test/geojson/points_1.in.geojson');
    var pointsIn = JSON.parse(content.toLocaleString());
    var cleanedPoints = new geom_1.CleanedPoints(pointsIn);
    var points = turfHelpers.featureCollection(cleanedPoints.clean);
    var params = new index_1.TilePathParams();
    params.source = 'osm/planet-180430';
    params.tileHierarchy = 6;
    // test matcher point candidates
    var matcher = new index_2.Graph(null, params);
    var matchedPoints = [];
    for (let searchPoint of points.features) {
        let matches = yield matcher.matchPoint(searchPoint, null, 3);
        for (let match of matches) {
            matchedPoints.push(match.toFeature());
        }
    }
    const matchedPointFeatureCollection_1a = turfHelpers.featureCollection(matchedPoints);
    const expected_1a_file = 'test/geojson/points_1a.out.geojson';
    if (BUILD_TEST_OUPUT) {
        var expected_1a_out = JSON.stringify(matchedPointFeatureCollection_1a);
        fs.writeFileSync(expected_1a_file, expected_1a_out);
    }
    const expected_1a_in = fs.readFileSync(expected_1a_file);
    const expected_1a = JSON.parse(expected_1a_in.toLocaleString());
    t.deepEqual(expected_1a, matchedPointFeatureCollection_1a);
    matcher.searchRadius = 1000;
    var matchedPoints = [];
    let matches = yield matcher.matchPoint(points.features[0], null, 10);
    for (let match of matches) {
        matchedPoints.push(match.toFeature());
    }
    const matchedPointFeatureCollection_1b = turfHelpers.featureCollection(matchedPoints);
    const expected_1b_file = 'test/geojson/points_1b.out.geojson';
    if (BUILD_TEST_OUPUT) {
        var expected_1b_out = JSON.stringify(matchedPointFeatureCollection_1b);
        fs.writeFileSync(expected_1b_file, expected_1b_out);
    }
    const expected_1b_in = fs.readFileSync(expected_1b_file);
    const expected_1b = JSON.parse(expected_1b_in.toLocaleString());
    t.deepEqual(expected_1b, matchedPointFeatureCollection_1b);
    t.end();
}));
test("match lines 1", (t) => __awaiter(this, void 0, void 0, function* () {
    // test polygon (dc area)
    const content = fs.readFileSync('test/geojson/sf_centerlines.sample.geojson');
    var linesIn = JSON.parse(content.toLocaleString());
    var cleanedLines = new geom_1.CleanedLines(linesIn);
    var lines = turfHelpers.featureCollection(cleanedLines.clean);
    var params = new index_1.TilePathParams();
    params.source = 'osm/planet-180430';
    params.tileHierarchy = 6;
    //test matcher point candidates
    var matcher = new index_2.Graph(envelope_1.default(lines), params);
    yield matcher.buildGraph();
    var matchedLines = turfHelpers.featureCollection([]);
    for (var line of lines.features) {
        var pathCandidate = yield matcher.matchGeom(line);
        matchedLines.features.push(pathCandidate.matchedPath);
    }
    const expected_1a_file = 'test/geojson/sf_centerlines.sample.out.geojson';
    if (BUILD_TEST_OUPUT) {
        var expected_1a_out = JSON.stringify(matchedLines);
        fs.writeFileSync(expected_1a_file, expected_1a_out);
    }
    const expected_1a_in = fs.readFileSync(expected_1a_file);
    const expected_1a = JSON.parse(expected_1a_in.toLocaleString());
    t.deepEqual(matchedLines, expected_1a);
    t.end();
}));
test("match lines 2 -- snapping and directed edges", (t) => __awaiter(this, void 0, void 0, function* () {
    // test polygon (dc area)
    const content = fs.readFileSync('test/geojson/line-directed-test.in.geojson');
    var linesIn = JSON.parse(content.toLocaleString());
    var cleanedLines = new geom_1.CleanedLines(linesIn);
    var lines = turfHelpers.featureCollection(cleanedLines.clean);
    var params = new index_1.TilePathParams();
    params.source = 'osm/planet-180430';
    params.tileHierarchy = 6;
    //test matcher point candidates
    var matcher = new index_2.Graph(envelope_1.default(lines), params);
    yield matcher.buildGraph();
    var matchedLines = turfHelpers.featureCollection([]);
    for (var line of lines.features) {
        var pathCandidate = yield matcher.matchGeom(line);
        matchedLines.features.push(pathCandidate.matchedPath);
    }
    const expected_1a_file = 'test/geojson/line-directed-test-snapped.out.geojson';
    if (BUILD_TEST_OUPUT) {
        var expected_1a_out = JSON.stringify(matchedLines);
        fs.writeFileSync(expected_1a_file, expected_1a_out);
    }
    const expected_1a_in = fs.readFileSync(expected_1a_file);
    const expected_1a = JSON.parse(expected_1a_in.toLocaleString());
    t.deepEqual(matchedLines, expected_1a);
    matcher.snapIntersections = false;
    var matchedLines = turfHelpers.featureCollection([]);
    for (var line of lines.features) {
        var pathCandidate = yield matcher.matchGeom(line);
        matchedLines.features.push(pathCandidate.matchedPath);
    }
    const expected_1b_file = 'test/geojson/line-directed-test-unsnapped.out.geojson';
    if (BUILD_TEST_OUPUT) {
        var expected_1b_out = JSON.stringify(matchedLines);
        fs.writeFileSync(expected_1b_file, expected_1b_out);
    }
    const expected_1b_in = fs.readFileSync(expected_1b_file);
    const expected_1b = JSON.parse(expected_1b_in.toLocaleString());
    t.deepEqual(matchedLines, expected_1b);
    t.end();
}));
// test("match grid", async (t:any) => { 
//   // test polygon (dc area)
//   const content = fs.readFileSync('test/geojson/sf_centerlines.sample.geojson');
//   var linesIn:turfHelpers.FeatureCollection<turfHelpers.LineString> = JSON.parse(content.toLocaleString());
//   var cleanedLines = new CleanedLines(linesIn);  
//   var lines:turfHelpers.FeatureCollection<turfHelpers.LineString> = turfHelpers.featureCollection(cleanedLines.clean);
//   var params = new TilePathParams();
//   params.source = 'osm/planet-180430';
//   params.tileHierarchy = 6;
//  //test matcher point candidates
//  var matcher = new Graph(envelope(lines), params);
//  await matcher.buildGraph();
//  var matchedLines = turfHelpers.featureCollection([]);
//  for(var line of lines.features) {
//    var pathCandidate = await matcher.match(line);
//    matchedLines.features.push(pathCandidate.matchedPath);
//  }
//  const expected_1a_file = 'test/geojson/sf_centerlines.1a.out.geojson';
//  if(BUILD_TEST_OUPUT) {
//    var expected_1a_out:string = JSON.stringify(matchedLines);
//    fs.writeFileSync(expected_1a_file, expected_1a_out);
//  }
//  const expected_1a_in = fs.readFileSync(expected_1a_file);
//  const expected_1a:{} = JSON.parse(expected_1a_in.toLocaleString());
//  t.deepEqual(matchedLines, expected_1a);
//  matcher.snapIntersections = false;
//  var matchedLines = turfHelpers.featureCollection([]);
//  for(var line of lines.features) {
//    var pathCandidate = await matcher.match(line);
//    matchedLines.features.push(pathCandidate.matchedPath);
//  }
//  const expected_1b_file = 'test/geojson/sf_centerlines.1b.out.geojson';
//  if(BUILD_TEST_OUPUT) {
//    var expected_1b_out:string = JSON.stringify(matchedLines);
//    fs.writeFileSync(expected_1b_file, expected_1b_out);
//  }
//  const expected_1b_in = fs.readFileSync(expected_1b_file);
//  const expected_1b:{} = JSON.parse(expected_1b_in.toLocaleString());
//  t.deepEqual(matchedLines, expected_1b);
//  t.end();
// });
// test("match roundabout", async (t:any) => { 
//   // test polygon (dc area)
//   const content = fs.readFileSync('test/geojson/roundabout.1a.geojson');
//   var linesIn:turfHelpers.FeatureCollection<turfHelpers.LineString> = JSON.parse(content.toLocaleString());
//   var cleanedLines = new CleanedLines(linesIn);  
//   var lines:turfHelpers.FeatureCollection<turfHelpers.LineString> = turfHelpers.featureCollection(cleanedLines.clean);
//   var params = new TilePathParams();
//   params.source = 'osm/planet-180430';
//   params.tileHierarchy = 6;
//  //test matcher point candidates
//  var matcher = new Graph(envelope(lines), params);
//  await matcher.buildGraph();
//  var matchedLines = turfHelpers.featureCollection([]);
//  for(var line of lines.features) {
//    var pathCandidate = await matcher.match(line);
//    matchedLines.features.push(pathCandidate.matchedPath);
//  }
//  const expected_1a_file = 'test/geojson/roundabout.1a.out.geojson';
//  if(BUILD_TEST_OUPUT) {
//    var expected_1a_out:string = JSON.stringify(matchedLines);
//    fs.writeFileSync(expected_1a_file, expected_1a_out);
//  }
//  const expected_1a_in = fs.readFileSync(expected_1a_file);
//  const expected_1a:{} = JSON.parse(expected_1a_in.toLocaleString());
//  t.deepEqual(matchedLines, expected_1a);
//  matcher.snapIntersections = false;
//  var matchedLines = turfHelpers.featureCollection([]);
//  for(var line of lines.features) {
//    var pathCandidate = await matcher.match(line);
//    matchedLines.features.push(pathCandidate.matchedPath);
//  }
//  const expected_1b_file = 'test/geojson/roundabout.1b.out.geojson';
//  if(BUILD_TEST_OUPUT) {
//    var expected_1b_out:string = JSON.stringify(matchedLines);
//    fs.writeFileSync(expected_1b_file, expected_1b_out);
//  }
//  const expected_1b_in = fs.readFileSync(expected_1b_file);
//  const expected_1b:{} = JSON.parse(expected_1b_in.toLocaleString());
//  t.deepEqual(matchedLines, expected_1b);
//  t.end();
// });
// test("match long paths", async (t:any) => { 
//   // test polygon (dc area)
//   const content = fs.readFileSync('test/geojson/long-paths.geojson');
//   var linesIn:turfHelpers.FeatureCollection<turfHelpers.LineString> = JSON.parse(content.toLocaleString());
//   console.log("1");
//   var cleanedLines = new CleanedLines(linesIn);  
//   var lines:turfHelpers.FeatureCollection<turfHelpers.LineString> = turfHelpers.featureCollection(cleanedLines.clean);
//   var params = new TilePathParams();
//   params.source = 'osm/planet-180430';
//   params.tileHierarchy = 6;
//  //test matcher point candidates
//  var matcher = new Graph(envelope(lines), params);
//  matcher.searchRadius = 20;
//  await matcher.buildGraph();
//  var matchedLines = turfHelpers.featureCollection([]);
//  for(var line of lines.features) {
//    if(line.properties['analysis_id'] == 1454853)
//     console.log('1454853')
//    var pathCandidate = await matcher.match(line);
//    //matchedLines.features.push(pathCandidate.matchedPath);
//  }
//  const BUILD_TEST_OUPUT = false;
// //  const expected_1a_file = 'test/geojson/line-directed-test-snapped.out.geojson';
// //  if(BUILD_TEST_OUPUT) {
// //    var expected_1a_out:string = JSON.stringify(matchedLines);
// //    fs.writeFileSync(expected_1a_file, expected_1a_out);
// //  }
// //  const expected_1a_in = fs.readFileSync(expected_1a_file);
// //  const expected_1a:{} = JSON.parse(expected_1a_in.toLocaleString());
// //  t.deepEqual(matchedLines, expected_1a);
// //  matcher.snapIntersections = false;
// //  var matchedLines = turfHelpers.featureCollection([]);
// //  for(var line of lines.features) {
// //    var pathCandidate = await matcher.match(line);
// //    matchedLines.features.push(pathCandidate.matchedPath);
// //  }
// //  const expected_1b_file = 'test/geojson/line-directed-test-unsnapped.out.geojson';
// //  if(BUILD_TEST_OUPUT) {
// //    var expected_1b_out:string = JSON.stringify(matchedLines);
// //    fs.writeFileSync(expected_1b_file, expected_1b_out);
// //  }
// //  const expected_1b_in = fs.readFileSync(expected_1b_file);
// //  const expected_1b:{} = JSON.parse(expected_1b_in.toLocaleString());
// //  t.deepEqual(matchedLines, expected_1b);
//  t.end();
// });
// test("match long paths", async (t:any) => { 
//   // test polygon (dc area)
//   const content = fs.readFileSync('test/geojson/expressways.geojson');
//   var linesIn:turfHelpers.FeatureCollection<turfHelpers.LineString> = JSON.parse(content.toLocaleString());
//   console.log("1");
//   var cleanedLines = new CleanedLines(linesIn);  
//   var lines:turfHelpers.FeatureCollection<turfHelpers.LineString> = turfHelpers.featureCollection(cleanedLines.clean);
//   var params = new TilePathParams();
//   params.source = 'osm/planet-180430';
//   params.tileHierarchy = 6;
//  //test matcher point candidates
//  var matcher = new Graph(envelope(lines), params);
//  matcher.graphMode = GraphMode.CAR_MOTORWAY_ONLY;
//  matcher.searchRadius = 20;
//  await matcher.buildGraph();
//  var matchedLines = turfHelpers.featureCollection([]);
//  for(var line of lines.features) {
//    if(line.properties['analysis_id'] == 1454853)
//     console.log('1454853')
//    var pathCandidate = await matcher.match(line);
//    //matchedLines.features.push(pathCandidate.matchedPath);
//  }
//  const BUILD_TEST_OUPUT = false;
// //  const expected_1a_file = 'test/geojson/line-directed-test-snapped.out.geojson';
// //  if(BUILD_TEST_OUPUT) {
// //    var expected_1a_out:string = JSON.stringify(matchedLines);
// //    fs.writeFileSync(expected_1a_file, expected_1a_out);
// //  }
// //  const expected_1a_in = fs.readFileSync(expected_1a_file);
// //  const expected_1a:{} = JSON.parse(expected_1a_in.toLocaleString());
// //  t.deepEqual(matchedLines, expected_1a);
// //  matcher.snapIntersections = false;
// //  var matchedLines = turfHelpers.featureCollection([]);
// //  for(var line of lines.features) {
// //    var pathCandidate = await matcher.match(line);
// //    matchedLines.features.push(pathCandidate.matchedPath);
// //  }
// //  const expected_1b_file = 'test/geojson/line-directed-test-unsnapped.out.geojson';
// //  if(BUILD_TEST_OUPUT) {
// //    var expected_1b_out:string = JSON.stringify(matchedLines);
// //    fs.writeFileSync(expected_1b_file, expected_1b_out);
// //  }
// //  const expected_1b_in = fs.readFileSync(expected_1b_file);
// //  const expected_1b:{} = JSON.parse(expected_1b_in.toLocaleString());
// //  t.deepEqual(matchedLines, expected_1b);
//  t.end();
// });
