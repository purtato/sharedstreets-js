"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("@turf/helpers");
const length_1 = __importDefault(require("@turf/length"));
const fs = __importStar(require("fs"));
const glob = __importStar(require("glob"));
const path = __importStar(require("path"));
const sharedstreetsPbf = __importStar(require("sharedstreets-pbf"));
const sharedstreets = __importStar(require("./src/index"));
const envelope_1 = __importDefault(require("@turf/envelope"));
const turfHelpers = __importStar(require("@turf/helpers"));
const index_1 = require("./src/index");
const index_2 = require("./src/index");
const graph_1 = require("./src/graph");
const tiles_1 = require("./src/tiles");
const geom_1 = require("./src/geom");
const test = require('tape');
const pt1 = [110, 45];
const pt2 = [-74.003388, 40.634538];
const pt3 = [-74.004107, 40.63406];
const BUILD_TEST_OUPUT = false;
test("sharedstreets -- test osrm install", (t) => {
    const osrmPath = require.resolve('osrm');
    t.comment('osrmPath: ' + osrmPath);
    const osrmLibPath = path.dirname(osrmPath);
    const osrmBinPath = path.join(osrmLibPath, '..');
    t.comment('osrmBinPath: ' + osrmBinPath);
    if (fs.existsSync(osrmBinPath)) {
        t.comment('osrmBinPath found');
    }
    else
        t.comment('osrmBinPath not found');
    t.end();
});
// core library tests
test("sharedstreets -- intersection", (t) => {
    t.equal(sharedstreets.intersectionId(pt1), "afd3db07d9baa6deef7acfcaac240607", "intersectionId => pt1");
    t.equal(sharedstreets.intersectionId(pt2), "f22b51a95400e250bff8d889a738c0b0", "intersectionId => pt2");
    t.equal(sharedstreets.intersectionId(pt3), "eed5479e5315e5a2e71760cc70a4ac76", "intersectionId => pt3");
    t.equal(sharedstreets.intersectionMessage(pt1), "Intersection 110.00000 45.00000", "intersectionMessage => pt1");
    t.equal(sharedstreets.intersectionMessage(pt2), "Intersection -74.00339 40.63454", "intersectionMessage => pt2");
    t.equal(sharedstreets.intersectionMessage(pt3), "Intersection -74.00411 40.63406", "intersectionMessage => pt3");
    // Extras
    t.equal(sharedstreets.intersectionId([-74.00962750000001, 40.740100500000004]), "68ea64a9f5be2b3a219898387b3da3e8", "intersectionId => extra1");
    t.equal(sharedstreets.intersectionMessage([-74.00962750000001, 40.740100500000004]), "Intersection -74.00963 40.74010", "intersectionMessage => extra1");
    t.end();
});
test("sharedstreets -- referenceId", (t) => {
    const locationReferenceOutbound = sharedstreets.locationReference([-74.0048213, 40.7416415], { outboundBearing: 208, distanceToNextRef: 9279 });
    const locationReferenceInbound = sharedstreets.locationReference([-74.0051265, 40.7408505], { inboundBearing: 188 });
    const formOfWay = 2; // => "MultipleCarriageway"
    t.equal(locationReferenceOutbound.intersectionId, "6d9fe428bc29b591ca1830d44e73099d", "locationReferenceOutbound => intersectionId");
    t.equal(locationReferenceInbound.intersectionId, "5a44762edbad541f0fb808c44c018105", "locationReferenceInbound => intersectionId");
    var refHash = sharedstreets.generateHash("Reference 2 -74.00482 40.74164 208 93 -74.00513 40.74085");
    t.equal(sharedstreets.referenceMessage([locationReferenceOutbound, locationReferenceInbound], formOfWay), "Reference 2 -74.00482 40.74164 208 93 -74.00513 40.74085", "referenceId => pt1");
    t.equal(sharedstreets.referenceId([locationReferenceOutbound, locationReferenceInbound], formOfWay), refHash, "referenceId => pt1");
    t.end();
});
test("sharedstreets -- locationReference", (t) => {
    const options = {
        distanceToNextRef: 9279,
        outboundBearing: 208,
    };
    const locRef = sharedstreets.locationReference([-74.0048213, 40.7416415], options);
    var intersectionHash = sharedstreets.generateHash("Intersection -74.00482 40.74164");
    t.equal(locRef.intersectionId, intersectionHash, "locRef => intersectionId");
    t.end();
});
test("sharedstreets-pbf -- intersection", (t) => {
    var count = 1;
    for (var filepath of glob.sync(path.join('./', "test", "pbf", `*.intersection.6.pbf`))) {
        const buffer = fs.readFileSync(filepath);
        const intersections = sharedstreetsPbf.intersection(buffer);
        for (var intersection of intersections) {
            count++;
            if (count > 10)
                break;
            const { lon, lat, id, nodeId } = intersection;
            const expectedId = sharedstreets.intersectionId([lon, lat], nodeId);
            const message = sharedstreets.intersectionMessage([lon, lat], nodeId);
            t.equal(expectedId, id, `[${message}] => ${id}`);
        }
    }
    t.end();
});
test("sharedstreets-pbf -- geometry", (t) => {
    var count = 1;
    for (var filepath of glob.sync(path.join('./', "test", "pbf", `*.geometry.6.pbf`))) {
        const buffer = fs.readFileSync(filepath);
        const geometries = sharedstreetsPbf.geometry(buffer);
        for (var geometry of geometries) {
            count++;
            if (count > 10)
                break;
            const { lonlats, id } = geometry;
            const coords = sharedstreets.lonlatsToCoords(lonlats);
            const expectedId = sharedstreets.geometryId(coords);
            const message = sharedstreets.geometryMessage(coords);
            t.equal(expectedId, id, `[${message}] => ${id}`);
        }
    }
    t.end();
});
test("sharedstreets-pbf -- reference", (t) => {
    var count = 1;
    for (var filepath of glob.sync(path.join('./', "test", "pbf", `*.reference.6.pbf`))) {
        const buffer = fs.readFileSync(filepath);
        const references = sharedstreetsPbf.reference(buffer);
        for (var reference of references) {
            count++;
            if (count > 10)
                break;
            const { locationReferences, id, formOfWay } = reference;
            const expectedId = sharedstreets.referenceId(locationReferences, formOfWay);
            const message = sharedstreets.referenceMessage(locationReferences, formOfWay);
            t.equal(expectedId, id, `["${message}":  ${expectedId}] => ${id}`);
        }
    }
    t.end();
});
test("sharedstreets -- coordsToLonlats", (t) => {
    const lonlats = sharedstreets.coordsToLonlats([[110, 45], [120, 55]]);
    t.deepEqual(lonlats, [110, 45, 120, 55]);
    t.end();
});
test("sharedstreets -- geometry", (t) => {
    const line = helpers_1.lineString([[110, 45], [115, 50], [120, 55]]);
    const geom = sharedstreets.geometry(line);
    var geomHash = sharedstreets.generateHash("Geometry 110.00000 45.00000 115.00000 50.00000 120.00000 55.00000");
    t.equal(geom.id, geomHash);
    t.end();
});
test("sharedstreets -- intersection", (t) => {
    const intersect = sharedstreets.intersection([110, 45]);
    t.deepEqual(intersect, {
        id: "afd3db07d9baa6deef7acfcaac240607",
        lat: 45,
        lon: 110,
        inboundReferenceIds: [],
        outboundReferenceIds: [],
    });
    t.end();
});
test("sharedstreets -- reference", (t) => {
    const line = helpers_1.lineString([[110, 45], [115, 50], [120, 55]]);
    const geom = sharedstreets.geometry(line);
    const locationReferences = [
        sharedstreets.locationReference([-74.0048213, 40.7416415], { outboundBearing: 208, distanceToNextRef: 9279 }),
        sharedstreets.locationReference([-74.0051265, 40.7408505], { inboundBearing: 188 }),
    ];
    const formOfWay = 0; // => "Other"
    const ref = sharedstreets.reference(geom, locationReferences, formOfWay);
    const refHash = sharedstreets.generateHash("Reference 0 -74.00482 40.74164 208 93 -74.00513 40.74085");
    t.equal(ref.id, refHash);
    t.end();
});
test("sharedstreets -- metadata", (t) => {
    const line = helpers_1.lineString([[110, 45], [115, 50], [120, 55]]);
    const gisMetadata = [{ source: "sharedstreets", sections: [{ sectionId: "foo", sectionProperties: "bar" }] }];
    const geom = sharedstreets.geometry(line);
    const metadata = sharedstreets.metadata(geom, {}, gisMetadata);
    t.deepEqual(metadata, {
        geometryId: "723cda09fa38e07e0957ae939eb2684f",
        osmMetadata: {},
        gisMetadata: [
            { source: "sharedstreets", sections: [{ sectionId: "foo", sectionProperties: "bar" }] },
        ],
    });
    t.end();
});
test("sharedstreets -- getFormOfWay", (t) => {
    const lineA = helpers_1.lineString([[110, 45], [115, 50], [120, 55]], { formOfWay: 3 });
    const lineB = helpers_1.lineString([[110, 45], [115, 50], [120, 55]]);
    const lineC = helpers_1.lineString([[110, 45], [115, 50], [120, 55]], { formOfWay: "Motorway" });
    t.equal(sharedstreets.getFormOfWay(lineA), 3);
    t.equal(sharedstreets.getFormOfWay(lineB), 0);
    t.equal(sharedstreets.getFormOfWay(lineC), 1);
    t.end();
});
test("sharedstreets -- forwardReference", (t) => {
    const line = helpers_1.lineString([[110, 45], [115, 50], [120, 55]]);
    const forwardReference = sharedstreets.forwardReference(line).id;
    const backReference = sharedstreets.backReference(line).id;
    t.equal(forwardReference, "035dc67e1230f1f6c6ec63997f86ba27");
    t.equal(backReference, "21993e8f0cdb8fa629418b78552a4503");
    t.end();
});
test("sharedstreets -- bearing & distance", (t) => {
    const line = helpers_1.lineString([[-74.006449, 40.739405000000005], [-74.00790070000001, 40.7393884], [-74.00805100000001, 40.7393804]]);
    const lineLength = length_1.default(line);
    const inboundBearing = sharedstreets.inboundBearing(line, lineLength, lineLength);
    const outboundBearing = sharedstreets.outboundBearing(line, lineLength, 0);
    const distanceToNextRef = sharedstreets.distanceToNextRef(line);
    t.equal(outboundBearing, 269); // => 269 Java Implementation
    t.equal(inboundBearing, 269); // => 267 Java Implementation
    t.equal(distanceToNextRef, 13502); // => 13502 Java Implementation
    t.end();
});
test("sharedstreets -- round", (t) => {
    t.equal(Number(sharedstreets.round(10.123456789)), 10.12346);
    t.end();
});
test("sharedstreets -- closed loops - Issue #8", (t) => {
    // https://github.com/sharedstreets/sharedstreets-conflator/issues/8
    const line = helpers_1.lineString([
        [-79.549159053, 43.615639543],
        [-79.548687537, 43.615687142],
        [-79.547733353, 43.615744613],
        [-79.548036429, 43.614913292],
        [-79.549024608, 43.615542992],
        [-79.549159053, 43.615639543],
    ]);
    t.assert(sharedstreets.forwardReference(line));
    t.assert(sharedstreets.backReference(line));
    t.end();
});
// cache module tests
test("tiles -- generate tile ids ", (t) => {
    // test polygon (dc area)
    var poloygon = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [[-77.0511531829834, 38.88588861057251],
                    [-77.00746536254883, 38.88588861057251],
                    [-77.00746536254883, 38.91407701203291],
                    [-77.0511531829834, 38.91407701203291],
                    [-77.0511531829834, 38.88588861057251]]
            ]
        }
    };
    // test tiles for polygon
    var tiles1 = tiles_1.getTileIdsForPolygon(poloygon);
    t.deepEqual(tiles1, ["12-1171-1566", "12-1171-1567"]);
    // test buffering
    var tiles2 = tiles_1.getTileIdsForPolygon(poloygon, 10000);
    t.deepEqual(tiles2, ["12-1170-1566", "12-1170-1567", "12-1171-1566", "12-1171-1567", "12-1172-1566", "12-1172-1567"]);
    // test polygon (dc area)
    var point = turfHelpers.point([-77.0511531829834, 38.88588861057251]);
    // test tiles for point
    var tiles3 = tiles_1.getTileIdsForPoint(point, 10);
    t.deepEqual(tiles3, ["12-1171-1567"]);
    // test buffering  
    var tiles4 = tiles_1.getTileIdsForPoint(point, 10000);
    t.deepEqual(tiles4, ["12-1170-1566", "12-1170-1567", "12-1170-1568", "12-1171-1566", "12-1171-1567", "12-1171-1568", "12-1172-1566", "12-1172-1567", "12-1172-1568"]);
    t.end();
});
test("tiles -- build tile paths ", (t) => {
    var pathString = 'osm/planet-180430/12-1171-1566.geometry.6.pbf';
    // test path parsing 
    var tilePath = new index_2.TilePath(pathString);
    t.deepEqual(tilePath, { "tileId": "12-1171-1566", "tileType": "geometry", "source": "osm/planet-180430", "tileHierarchy": 6 });
    // test path string builder
    var pathString2 = tilePath.toPathString();
    t.equal(pathString, pathString2);
    // test path group
    var pathGroup = new index_2.TilePathGroup([tilePath]);
    t.deepEqual(pathGroup, { source: 'osm/planet-180430', tileHierarchy: 6, tileTypes: ['geometry'], tileIds: ['12-1171-1566'] });
    // test path gruop eumeration
    t.deepEqual([...pathGroup], [{ source: 'osm/planet-180430', tileHierarchy: 6, tileType: 'geometry', tileId: '12-1171-1566' }]);
    t.end();
});
test("tiles -- fetch/parse protobuf filese", (t) => __awaiter(this, void 0, void 0, function* () {
    // get data 
    var tilePath = new index_2.TilePath('osm/planet-180430/12-1171-1566.geometry.6.pbf');
    var data = yield tiles_1.getTile(tilePath);
    t.equal(data.length, 7352);
    t.end();
}));
test("cache -- load data", (t) => __awaiter(this, void 0, void 0, function* () {
    // test polygon (dc area)
    var polygon = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [[-77.0511531829834, 38.88588861057251],
                    [-77.00746536254883, 38.88588861057251],
                    [-77.00746536254883, 38.91407701203291],
                    [-77.0511531829834, 38.91407701203291],
                    [-77.0511531829834, 38.88588861057251]]
            ]
        }
    };
    var tilesIds = tiles_1.getTileIdsForPolygon(polygon);
    var params = new index_2.TilePathParams();
    params.source = 'osm/planet-180430';
    params.tileHierarchy = 6;
    var tilePathGroup = index_2.TilePathGroup.fromPolygon(polygon, 0, params);
    tilePathGroup.addType(index_2.TileType.GEOMETRY);
    var tileIndex = new index_1.TileIndex();
    yield tileIndex.indexTilesByPathGroup(tilePathGroup);
    t.equal(tileIndex.tiles.size, 2);
    tilePathGroup.addType(index_2.TileType.INTERSECTION);
    yield tileIndex.indexTilesByPathGroup(tilePathGroup);
    t.equal(tileIndex.tiles.size, 4);
    var data = yield tileIndex.intersects(polygon, index_2.TileType.GEOMETRY, 0, params);
    t.equal(data.features.length, 2102);
    var data = yield tileIndex.intersects(polygon, index_2.TileType.INTERSECTION, 0, params);
    t.equal(data.features.length, 1162);
    t.end();
}));
test("tileIndex -- point data", (t) => __awaiter(this, void 0, void 0, function* () {
    // test polygon (dc area)
    const content = fs.readFileSync('test/geojson/points_1.in.geojson');
    var points = JSON.parse(content.toLocaleString());
    var params = new index_2.TilePathParams();
    params.source = 'osm/planet-180430';
    params.tileHierarchy = 6;
    // test nearby
    var tileIndex = new index_1.TileIndex();
    var featureCount = 0;
    for (var point of points.features) {
        var foundFeatures = yield tileIndex.nearby(point, index_2.TileType.GEOMETRY, 10, params);
        featureCount += foundFeatures.features.length;
    }
    t.equal(featureCount, 3);
    t.end();
}));
test("match points", (t) => __awaiter(this, void 0, void 0, function* () {
    // test polygon (dc area)
    const content = fs.readFileSync('test/geojson/points_1.in.geojson');
    var pointsIn = JSON.parse(content.toLocaleString());
    var cleanedPoints = new geom_1.CleanedPoints(pointsIn);
    var points = turfHelpers.featureCollection(cleanedPoints.clean);
    var params = new index_2.TilePathParams();
    params.source = 'osm/planet-180430';
    params.tileHierarchy = 6;
    // test matcher point candidates
    var matcher = new graph_1.Graph(null, params);
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
    var params = new index_2.TilePathParams();
    params.source = 'osm/planet-180430';
    params.tileHierarchy = 6;
    //test matcher point candidates
    var matcher = new graph_1.Graph(envelope_1.default(lines), params);
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
    var params = new index_2.TilePathParams();
    params.source = 'osm/planet-180430';
    params.tileHierarchy = 6;
    //test matcher point candidates
    var matcher = new graph_1.Graph(envelope_1.default(lines), params);
    yield matcher.buildGraph();
    matcher.searchRadius = 20;
    matcher.snapIntersections = true;
    var matchedLines = turfHelpers.featureCollection([]);
    for (var line of lines.features) {
        var pathCandidate = yield matcher.matchGeom(line);
        if (pathCandidate)
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
        if (pathCandidate)
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
