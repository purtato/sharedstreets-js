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
const turfHelpers = __importStar(require("@turf/helpers"));
const tiles_1 = require("./tiles");
const fs_1 = require("fs");
const tile_index_1 = require("./tile_index");
const index_1 = require("./index");
const child_process_1 = require("child_process");
const length_1 = __importDefault(require("@turf/length"));
const distance_1 = __importDefault(require("@turf/distance"));
const along_1 = __importDefault(require("@turf/along"));
const bearing_1 = __importDefault(require("@turf/bearing"));
const nearest_point_on_line_1 = __importDefault(require("@turf/nearest-point-on-line"));
const fs = __importStar(require("fs"));
const util_1 = require("./util");
const { exec } = require('child_process');
const OSRM = require("osrm");
const xml = require('xml');
const stream = require('stream');
const levelup = require('levelup');
const leveldown = require('leveldown');
const chalk = require('chalk');
const path = require('path');
const util = require('util');
const uuidHash = require('uuid-by-string');
const DEFAULT_SEARCH_RADIUS = 10;
const MIN_CONFIDENCE = 0.5;
const OPTIMIZE_GRAPH = true;
const USE_LOCAL_CACHE = true;
const SHST_GRAPH_CACHE_DIR = util_1.resolveHome('/tmp/cache/graphs/');
function getOSRMDirectory() {
    const osrmPath = require.resolve('osrm');
    const osrmLibPath = path.dirname(osrmPath);
    const osrmDirPath = path.join(osrmLibPath, '..');
    if (fs.existsSync(osrmDirPath)) {
        return osrmDirPath;
    }
    else
        return null;
}
const OSRM_DIR = getOSRMDirectory();
var MatchType;
(function (MatchType) {
    MatchType["DIRECT"] = "direct";
    MatchType["HMM"] = "hmm";
})(MatchType = exports.MatchType || (exports.MatchType = {}));
var GraphMode;
(function (GraphMode) {
    GraphMode["CAR_ALL"] = "car_all";
    GraphMode["CAR_SURFACE_ONLY"] = "car_surface_only";
    GraphMode["CAR_MOTORWAY_ONLY"] = "car_motorway_only";
    GraphMode["BIKE"] = "bike";
    GraphMode["PEDESTRIAN"] = "ped";
})(GraphMode = exports.GraphMode || (exports.GraphMode = {}));
// interface typecheck for SharedStreetsGeometry
function geomInstance(object) {
    return 'forwardReferenceId' in object;
}
function getReferenceLength(ref) {
    var length = 0;
    for (var lr of ref.locationReferences) {
        if (lr.distanceToNextRef)
            length += lr.distanceToNextRef;
    }
    return length / 100;
}
const DEFAULT_LENGTH_TOLERANCE = 0.1;
const DEFUALT_CANDIDATES = 10;
const DEFAULT_BEARING_TOLERANCE = 15; // 360 +/- tolerance
const MAX_FEATURE_LENGTH = 15000; // 1km
const MAX_SEARCH_RADIUS = 100;
const MAX_LENGTH_TOLERANCE = 0.5;
const MAX_CANDIDATES = 10;
const MAX_BEARING_TOLERANCE = 180; // 360 +/- tolerance
const REFERNECE_GEOMETRY_OFFSET = 2;
const MAX_ROUTE_QUERIES = 16;
// TODO need to pull this from PBF enum defintion 
// @property {number} Motorway=0 Motorway value
//  * @property {number} Trunk=1 Trunk value
//  * @property {number} Primary=2 Primary value
//  * @property {number} Secondary=3 Secondary value
//  * @property {number} Tertiary=4 Tertiary value
//  * @property {number} Residential=5 Residential value
//  * @property {number} Unclassified=6 Unclassified value
//  * @property {number} Service=7 Service value
//  * @property {number} Other=8 Other value
function roadClassConverter(roadClass) {
    if (roadClass === 'Motorway')
        return 0;
    else if (roadClass === 'Trunk')
        return 1;
    else if (roadClass === 'Primary')
        return 2;
    else if (roadClass === 'Secondary')
        return 3;
    else if (roadClass === 'Tertiary')
        return 4;
    else if (roadClass === 'Residential')
        return 5;
    else if (roadClass === 'Unclassified')
        return 6;
    else if (roadClass === 'Service')
        return 7;
    else
        return null;
}
function angleDelta(a1, a2) {
    var delta = 180 - Math.abs(Math.abs(a1 - a2) - 180);
    return delta;
}
function normalizeAngle(a) {
    if (a < 0)
        return a + 360;
    return a;
}
var ReferenceDirection;
(function (ReferenceDirection) {
    ReferenceDirection["FORWARD"] = "forward";
    ReferenceDirection["BACKWARD"] = "backward";
})(ReferenceDirection = exports.ReferenceDirection || (exports.ReferenceDirection = {}));
var ReferenceSideOfStreet;
(function (ReferenceSideOfStreet) {
    ReferenceSideOfStreet["RIGHT"] = "right";
    ReferenceSideOfStreet["LEFT"] = "left";
    ReferenceSideOfStreet["CENTER"] = "center";
    ReferenceSideOfStreet["UNKNOWN"] = "unknown";
})(ReferenceSideOfStreet = exports.ReferenceSideOfStreet || (exports.ReferenceSideOfStreet = {}));
class PointCandidate {
    calcScore() {
        if (!this.score) {
            // score for snapped points are average of distance to point on line distance and distance to snapped ponit
            if (this.snappedPoint)
                this.score = (this.pointOnLine.properties.dist + distance_1.default(this.searchPoint, this.snappedPoint, { units: 'meters' })) / 2;
            else
                this.score = this.pointOnLine.properties.dist;
        }
        return this.score;
    }
    toFeature() {
        this.calcScore();
        var feature = turfHelpers.feature(this.pointOnLine.geometry, {
            score: this.score,
            location: this.location,
            referenceLength: this.referenceLength,
            geometryId: this.geometryId,
            referenceId: this.referenceId,
            direction: this.direction,
            bearing: this.bearing,
            sideOfStreet: this.sideOfStreet,
            interceptAngle: this.interceptAngle
        });
        return feature;
    }
}
exports.PointCandidate = PointCandidate;
class GraphNode {
}
class GraphEdge {
}
class GraphNodeEdgeRelations {
}
class PathSegment {
    constructor() {
        this.section = [];
    }
    isIdentical(otherSegment) {
        if (this.referenceId === otherSegment.referenceId) {
            if ((otherSegment.section[0] === this.section[0] && otherSegment.section[1] === this.section[1]))
                return true;
        }
        return false;
    }
    isIntersecting(otherSegment) {
        if (this.referenceId === otherSegment.referenceId) {
            if ((otherSegment.section[0] <= this.section[1] && otherSegment.section[0] >= this.section[0]) ||
                (otherSegment.section[1] <= this.section[1] && otherSegment.section[1] >= this.section[0]))
                return true;
        }
        return false;
    }
    toFeature() {
        var feature = turfHelpers.feature(this.geometry.geometry, {
            referenceLength: this.referenceLength,
            geometryId: this.geometryId,
            referenceId: this.referenceId,
            direction: this.direction,
            sideOfStreet: this.sideOfStreet,
            section: this.section,
            roadClass: this.roadClass,
            streetname: this.streetname,
            fromIntersectionId: this.fromIntersectionId,
            toIntersectionId: this.toIntersectionId,
            fromStreetnames: this.fromStreetnames,
            toStreetnames: this.toStreetnames,
        });
        return feature;
    }
}
exports.PathSegment = PathSegment;
class PathCandidate {
    toDebugView() {
        var debugCollection = turfHelpers.featureCollection([this.originalFeature, this.matchedPath]);
        return debugCollection;
    }
    getOriginalFeatureLength() {
        if (!this.originalFeatureLength)
            this.originalFeatureLength = length_1.default(this.originalFeature, { "units": "meters" });
        return this.originalFeatureLength;
    }
    getPathLength() {
        if (!this.pathLength) {
            this.pathLength = 0;
            for (var segment of this.segments) {
                if (segment.section)
                    this.pathLength = this.pathLength + (segment.section[1] - segment.section[0]);
                else
                    this.pathLength = this.pathLength + segment.referenceLength;
            }
        }
        return this.pathLength;
    }
    getLengthDelta() {
        return this.getPathLength() - this.getOriginalFeatureLength();
    }
    isColinear(candidate) {
        if (this.segments.length > 0 && candidate.segments.length > 0 && this.segments.length == candidate.segments.length) {
            var path1GeometryIds = new Set();
            var path2GeometryIds = new Set();
            for (var segment of this.segments) {
                path1GeometryIds.add(segment.geometryId);
            }
            for (var segment of candidate.segments) {
                path2GeometryIds.add(segment.geometryId);
                if (!path1GeometryIds.has(segment.geometryId))
                    return false;
            }
            for (var segment of this.segments) {
                if (!path2GeometryIds.has(segment.geometryId))
                    return false;
            }
        }
        else
            return false;
        return true;
    }
}
exports.PathCandidate = PathCandidate;
class LevelDB {
    constructor(directory) {
        console.log("LEVELUPPER");
        try {
            this.db = levelup(leveldown(directory));
        }
        catch (e) {
            console.log("LEVELCATCHER");
        }
        console.log("LEVELDOWNER2");
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var data = yield this.db.get(key);
                return data.toString();
            }
            catch (error) {
                return null;
            }
        });
    }
    put(key, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.db.put(key, data);
        });
    }
    has(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.db.get(key);
                return true;
            }
            catch (error) {
                return null;
            }
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.db.close();
        });
    }
}
exports.LevelDB = LevelDB;
function streamPromise(stream) {
    return new Promise((resolve, reject) => {
        stream.on('end', () => {
            resolve('end');
        });
        stream.on('error', (error) => {
            reject(error);
        });
    });
}
class Graph {
    constructor(extent, tileParams, graphMode = GraphMode.CAR_ALL, existingTileIndex = null) {
        // options
        this.searchRadius = DEFAULT_SEARCH_RADIUS;
        this.snapIntersections = false;
        this.useHMM = true;
        this.useDirect = true;
        this.includeStreetnames = true;
        this.bearingTolerance = DEFAULT_BEARING_TOLERANCE;
        this.tileParams = tileParams;
        this.tilePathGroup = tiles_1.TilePathGroup.fromPolygon(extent, 1000, tileParams);
        this.tilePathGroup.addType(tiles_1.TileType.GEOMETRY);
        this.tilePathGroup.addType(tiles_1.TileType.REFERENCE);
        if (this.includeStreetnames) {
            this.tilePathGroup.addType(tiles_1.TileType.METADATA);
            this.tilePathGroup.addType(tiles_1.TileType.INTERSECTION);
        }
        this.graphMode = graphMode;
        var paths = [];
        for (var path of this.tilePathGroup) {
            paths.push(path.toPathString());
        }
        if (existingTileIndex) {
            this.tileIndex = existingTileIndex;
        }
        else {
            this.tileIndex = new tile_index_1.TileIndex();
        }
        // create id from tile path hash  
        this.id = uuidHash(this.graphMode + ' node-pair.sv1 ' + paths.join(" "));
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.db) {
                yield this.db.close();
            }
        });
    }
    createGraphXml() {
        return __awaiter(this, void 0, void 0, function* () {
            // build xml representation of graph + leveldb id map
            var graphPath = path.join(SHST_GRAPH_CACHE_DIR, this.id);
            var nextNodeId = 1;
            var nextEdgeId = 1;
            var xmlPath = path.join(graphPath, '/graph.xml');
            // create xml stream
            const pipeline = util.promisify(stream.pipeline);
            var xmlStreamWriter = fs_1.createWriteStream(xmlPath);
            var osmRootElem = xml.element({ _attr: { version: '0.6', generator: 'shst cli v1.0' } });
            var xmlStream = xml({ osm: osmRootElem }, { stream: true });
            xmlStream.on('data', function (chunk) { xmlStreamWriter.write(chunk); });
            const writeNode = (lon, lat, shstIntersectionId = null) => __awaiter(this, void 0, void 0, function* () {
                var nodeId;
                // check if intersection node already written
                if (shstIntersectionId && (yield this.db.has(shstIntersectionId))) {
                    var node = JSON.parse(yield this.db.get(shstIntersectionId));
                    nodeId = node.nodeId;
                }
                else {
                    nodeId = nextNodeId;
                    var newNode = new GraphNode();
                    newNode.nodeId = nodeId;
                    if (shstIntersectionId) {
                        newNode.shstIntersectionId = shstIntersectionId;
                        yield this.db.put(shstIntersectionId, JSON.stringify(newNode));
                    }
                    yield this.db.put('node:' + nodeId, JSON.stringify(newNode));
                    // write node xml
                    osmRootElem.push({ node: [{ _attr: { id: nodeId, lat: lat, lon: lon } }] });
                    nextNodeId++;
                }
                return nodeId;
            });
            const pushNodePair = (nodePairId, refId) => __awaiter(this, void 0, void 0, function* () {
                if (yield this.db.has(nodePairId)) {
                    var existingEdges = JSON.parse(yield this.db.get(nodePairId));
                    existingEdges.push(refId);
                    yield this.db.put(nodePairId, JSON.stringify(existingEdges));
                }
                else {
                    yield this.db.put(nodePairId, JSON.stringify([refId]));
                }
            });
            for (var obj of this.tileIndex.objectIndex.values()) {
                if (geomInstance(obj)) {
                    if (obj.roadClass == 'Motorway') {
                        if (this.graphMode != GraphMode.CAR_ALL && this.graphMode != GraphMode.CAR_MOTORWAY_ONLY) {
                            continue;
                        }
                    }
                    else {
                        if (this.graphMode == GraphMode.CAR_MOTORWAY_ONLY) {
                            continue;
                        }
                    }
                    if (obj.roadClass == 'Other') {
                        if (this.graphMode != GraphMode.BIKE && this.graphMode != GraphMode.PEDESTRIAN) {
                            continue;
                        }
                    }
                    // iterate through coordinates and build nodes
                    var coords = index_1.lonlatsToCoords(obj.lonlats);
                    var nodeIds = [];
                    for (var i = 0; i < coords.length; i++) {
                        var shstIntersectionId = null;
                        if (i === 0)
                            shstIntersectionId = obj.fromIntersectionId;
                        else if (i === coords.length - 1)
                            shstIntersectionId = obj.toIntersectionId;
                        var nodeId = yield writeNode(coords[i][0], coords[i][1], shstIntersectionId);
                        nodeIds.push(nodeId);
                    }
                    // var edge:GraphEdge = new GraphEdge();
                    // edge.shstGeometryId = obj.id;
                    // edge.edgeId = nextEdgeId;
                    // await this.db.put(obj.id, JSON.stringify(edge));
                    // await this.db.put('edge:' + edge.edgeId, JSON.stringify(edge));
                    var nodeIdElems = [];
                    var previousNode = null;
                    for (nodeId of nodeIds) {
                        //var nodeEdgeRelation:GraphNodeEdgeRelations;
                        // if(await this.db.has('node-edges:' + nodeId)){
                        //     // insert new edge into existing node-edge relation set for node id
                        //     nodeEdgeRelation = JSON.parse(await this.db.get('node-edges:' + nodeId))
                        //     var edgeIds = new Set(nodeEdgeRelation.edgeIds);
                        //     edgeIds.add(edge.edgeId);
                        //     nodeEdgeRelation.edgeIds = [...edgeIds.values()];
                        // }
                        // else {
                        //      // create node-edge relation set for node id
                        //     nodeEdgeRelation = new GraphNodeEdgeRelations();
                        //     nodeEdgeRelation.nodeId = nodeId;
                        //     nodeEdgeRelation.edgeIds = [edge.edgeId];
                        // }
                        // await this.db.put('node-edges:' + nodeId, JSON.stringify(nodeEdgeRelation));
                        nodeIdElems.push({ nd: [{ _attr: { ref: nodeId } }] });
                        if (previousNode) {
                            pushNodePair('node-pair:' + nodeId + '-' + previousNode, obj.forwardReferenceId);
                            if (obj.backReferenceId)
                                pushNodePair('node-pair:' + previousNode + '-' + nodeId, obj.backReferenceId);
                        }
                        previousNode = nodeId;
                    }
                    var oneWay = obj.backReferenceId ? 'no' : 'yes';
                    var roadClass = obj.roadClass.toLocaleLowerCase();
                    if (roadClass == "other")
                        roadClass = "path"; // TODO add bike/ped modal restrictions to paths 
                    osmRootElem.push({ way: [{ _attr: { id: nextEdgeId } }, { tag: { _attr: { k: 'highway', v: roadClass } } }, { tag: { _attr: { k: 'oneway', v: oneWay } } }, ...nodeIdElems] });
                    nextEdgeId++;
                }
            }
            const writeFinished = new Promise((resolve, reject) => {
                xmlStreamWriter.on('finish', () => {
                    resolve(xmlPath);
                });
            });
            osmRootElem.close();
            xmlStreamWriter.close();
            //xmlStream.end();
            return writeFinished;
        });
    }
    buildGraph() {
        return __awaiter(this, void 0, void 0, function* () {
            // check if graph is already built;
            if (this.osrm)
                return;
            try {
                var graphPath = path.join(SHST_GRAPH_CACHE_DIR, this.id);
                var dbPath = path.join(graphPath, '/db');
                yield this.tileIndex.indexTilesByPathGroup(this.tilePathGroup);
                if (USE_LOCAL_CACHE && fs_1.existsSync(dbPath)) {
                    var osrmPath = path.join(graphPath, '/graph.xml.osrm');
                    console.log(chalk.keyword('lightgreen')("     loading pre-built " + this.graphMode + " graph from: " + osrmPath));
                    this.db = new LevelDB(dbPath);
                    if (OPTIMIZE_GRAPH)
                        this.osrm = new OSRM({ path: osrmPath });
                    else
                        this.osrm = new OSRM({ path: osrmPath, algorithm: "MLD" });
                }
                else {
                    if (!OSRM_DIR) {
                        console.log("unable to locate OSRM module.");
                        throw "unable to locate OSRM module.";
                    }
                    // TODO before building, check if this graph is a subset of an existing graph
                    console.log(chalk.keyword('lightgreen')("     building graph using OSRM from: " + OSRM_DIR));
                    fs_1.mkdirSync(dbPath, { recursive: true });
                    this.db = new LevelDB(dbPath);
                    console.log(chalk.keyword('lightgreen')("     building " + this.graphMode + " graph  xml..."));
                    var xmlPath = yield this.createGraphXml();
                    //extract 
                    console.log(chalk.keyword('lightgreen')("     building " + this.graphMode + " graph from: " + xmlPath));
                    var profile;
                    if (this.graphMode === GraphMode.CAR_ALL || this.graphMode === GraphMode.CAR_SURFACE_ONLY || this.graphMode === GraphMode.CAR_MOTORWAY_ONLY)
                        profile = path.join(OSRM_DIR, 'profiles/car.lua');
                    else if (this.graphMode === GraphMode.BIKE)
                        profile = path.join(OSRM_DIR, 'profiles/bicycle.lua');
                    else if (this.graphMode === GraphMode.PEDESTRIAN)
                        profile = path.join(OSRM_DIR, 'profiles/foot.lua');
                    child_process_1.execSync(path.join(OSRM_DIR, 'lib/binding/osrm-extract') + ' ' + xmlPath + ' -p ' + profile);
                    var osrmPath = xmlPath + '.osrm';
                    if (OPTIMIZE_GRAPH) {
                        console.log(chalk.keyword('lightgreen')("     optimizing graph..."));
                        child_process_1.execSync(path.join(OSRM_DIR, 'lib/binding/osrm-contract') + ' ' + osrmPath);
                        this.osrm = new OSRM({ path: osrmPath });
                    }
                    else {
                        child_process_1.execSync(path.join(OSRM_DIR, 'lib/binding/osrm-partition') + ' ' + osrmPath);
                        child_process_1.execSync(path.join(OSRM_DIR, 'lib/binding/osrm-customize') + ' ' + osrmPath);
                        console.log(chalk.keyword('lightgreen')("     skipping graph optimization..."));
                        this.osrm = new OSRM({ path: osrmPath, algorithm: "MLD" });
                    }
                }
            }
            catch (e) {
                console.log("Unable to build graph: " + e);
                console.log("Try deleting existing cached graph: " + graphPath);
            }
        });
    }
    matchTrace(feature) {
        return __awaiter(this, void 0, void 0, function* () {
            // fall back to hmm for probabilistic path discovery
            if (!this.osrm)
                throw "Graph not buit. call buildGraph() before running queries.";
            var hmmOptions = {
                coordinates: feature.geometry.coordinates,
                annotations: true,
                geometries: 'geojson',
                radiuses: Array(feature.geometry.coordinates.length).fill(this.searchRadius)
            };
            try {
                var matches = yield new Promise((resolve, reject) => {
                    this.osrm.match(hmmOptions, function (err, response) {
                        if (err)
                            reject(err);
                        else
                            resolve(response);
                    });
                });
                var visitedEdges = new Set();
                var visitedEdgeList = [];
                if (matches['matchings'] && matches['matchings'].length > 0) {
                    var match = matches['matchings'][0];
                    if (0 < match.confidence) {
                        // this is kind of convoluted due to the sparse info returned in the OSRM annotations...
                        // write out sequence of nodes and edges as emitted from walking OSRM-returned nodes
                        // finding the actual posistion and directionality of the OSRM-edge within the ShSt graph 
                        // edge means that we have to snap start/end points in the OSRM geom
                        //console.log(JSON.stringify(match.geometry));
                        var edgeCandidates;
                        var nodes = [];
                        var visitedNodes = new Set();
                        // ooof this is brutual -- need to unpack legs and reduce list... 
                        for (var leg of match['legs']) {
                            //console.log(leg['annotation']['nodes'])
                            for (var n of leg['annotation']['nodes']) {
                                if (!visitedNodes.has(n) || nodes.length == 0)
                                    nodes.push(n);
                                visitedNodes.add(n);
                            }
                        }
                        // then group node pairs into unique edges...
                        var previousNode = null;
                        for (var nodeId of nodes) {
                            if (yield this.db.has('node:' + nodeId)) {
                                if (previousNode) {
                                    if (yield this.db.has('node-pair:' + nodeId + '-' + previousNode)) {
                                        var edges = JSON.parse(yield this.db.get('node-pair:' + nodeId + '-' + previousNode));
                                        for (var edge of edges) {
                                            if (!visitedEdges.has(edge))
                                                visitedEdgeList.push(edge);
                                            visitedEdges.add(edge);
                                        }
                                    }
                                }
                                previousNode = nodeId;
                            }
                        }
                    }
                }
                var pathCandidate = new PathCandidate();
                pathCandidate.matchType = MatchType.HMM;
                pathCandidate.confidence = match.confidence;
                pathCandidate.originalFeature = feature;
                pathCandidate.segments = [];
                var segmentGeoms = turfHelpers.multiLineString([]);
                for (var edgeReferenceId of visitedEdgeList) {
                    var edgeRef = this.tileIndex.objectIndex.get(edgeReferenceId);
                    var edgeGeom = this.tileIndex.objectIndex.get(edgeRef.geometryId);
                    var pathSegment = new PathSegment();
                    pathSegment.geometryId = edgeGeom.id;
                    pathSegment.referenceId = edgeReferenceId;
                    // TODO calc directionality from graph edge trajectory possible...
                    pathCandidate.segments.push(pathSegment);
                    var segementGeom = this.tileIndex.featureIndex.get(edgeGeom.id);
                    segmentGeoms.geometry.coordinates.push(segementGeom.geometry.coordinates);
                }
                if (pathCandidate.segments.length > 0)
                    pathCandidate.matchedPath = segmentGeoms;
                return pathCandidate;
            }
            catch (e) {
                return null;
            }
        });
    }
    matchGeom(feature) {
        return __awaiter(this, void 0, void 0, function* () {
            var pathCandidates = [];
            // fall back to hmm for probabilistic path discovery
            if (!this.osrm)
                throw "Graph not buit. call buildGraph() before running queries.";
            var hmmOptions = {
                coordinates: feature.geometry.coordinates,
                annotations: true,
                geometries: 'geojson',
                radiuses: Array(feature.geometry.coordinates.length).fill(this.searchRadius)
            };
            try {
                var matches = yield new Promise((resolve, reject) => {
                    this.osrm.match(hmmOptions, function (err, response) {
                        if (err)
                            reject(err);
                        else
                            resolve(response);
                    });
                });
                var visitedEdges = new Set();
                var visitedEdgeList = [];
                if (matches['matchings'] && matches['matchings'].length > 0) {
                    var match = matches['matchings'][0];
                    if (0 < match.confidence) {
                        // this is kind of convoluted due to the sparse info returned in the OSRM annotations...
                        // write out sequence of nodes and edges as emitted from walking OSRM-returned nodes
                        // finding the actual posistion and directionality of the OSRM-edge within the ShSt graph 
                        // edge means that we have to snap start/end points in the OSRM geom
                        //console.log(JSON.stringify(match.geometry));
                        var edgeCandidates;
                        var nodes = [];
                        var visitedNodes = new Set();
                        // ooof this is brutual -- need to unpack legs and reduce list... 
                        for (var leg of match['legs']) {
                            //console.log(leg['annotation']['nodes'])
                            for (var n of leg['annotation']['nodes']) {
                                if (!visitedNodes.has(n) || nodes.length == 0)
                                    nodes.push(n);
                                visitedNodes.add(n);
                            }
                        }
                        // then group node pairs into unique edges...
                        var previousNode = null;
                        for (var nodeId of nodes) {
                            if (yield this.db.has('node:' + nodeId)) {
                                if (previousNode) {
                                    if (yield this.db.has('node-pair:' + nodeId + '-' + previousNode)) {
                                        var edges = JSON.parse(yield this.db.get('node-pair:' + nodeId + '-' + previousNode));
                                        for (var edge of edges) {
                                            if (!visitedEdges.has(edge))
                                                visitedEdgeList.push(edge);
                                            visitedEdges.add(edge);
                                        }
                                    }
                                }
                                previousNode = nodeId;
                            }
                        }
                    }
                }
                if (visitedEdgeList.length > 0) {
                    var startPoint = turfHelpers.point(feature.geometry.coordinates[0]);
                    var endPoint = turfHelpers.point(feature.geometry.coordinates[feature.geometry.coordinates.length - 1]);
                    var startCandidate = yield this.getPointCandidateFromRefId(startPoint, visitedEdgeList[0], null);
                    var endCandidate = yield this.getPointCandidateFromRefId(endPoint, visitedEdgeList[visitedEdgeList.length - 1], null);
                    var alreadyIncludedPaths = new Set();
                    var pathCandidate = new PathCandidate();
                    var matchWorked = true;
                    pathCandidate.matchType = MatchType.HMM;
                    pathCandidate.score = match.confidence;
                    pathCandidate.originalFeature = feature;
                    pathCandidate.matchedPath = turfHelpers.feature(match.geometry);
                    //console.log(JSON.stringify(pathCandidate.matchedPath));
                    pathCandidate.segments = [];
                    var length = pathCandidate.getOriginalFeatureLength();
                    for (var k = 0; k < visitedEdgeList.length; k++) {
                        var pathSegment = new PathSegment();
                        pathSegment.referenceId = visitedEdgeList[k];
                        var shstRef = this.tileIndex.objectIndex.get(visitedEdgeList[k]);
                        pathSegment.referenceId = visitedEdgeList[k];
                        pathSegment.geometryId = shstRef.geometryId;
                        pathCandidate.segments.push(pathSegment);
                        pathCandidate.segments[k].referenceLength = getReferenceLength(shstRef);
                    }
                    if (pathCandidate.segments.length > 0) {
                        pathCandidate.startPoint = startCandidate;
                        // build directionality into edge sequences   
                        for (var k = 0; k < pathCandidate.segments.length; k++) {
                            var edgeGeom = this.tileIndex.objectIndex.get(pathCandidate.segments[k].geometryId);
                            pathCandidate.segments[k].roadClass = roadClassConverter(edgeGeom.roadClass);
                            // if start and end are on the same graph edge make sure they're the same referenceId/direction
                            if (startCandidate.referenceId == endCandidate.referenceId) {
                                pathCandidate.endPoint = endCandidate;
                                pathCandidate.segments[k].section = [startCandidate.location, endCandidate.location];
                            }
                            else {
                                if (k == pathCandidate.segments.length - 1) {
                                    pathCandidate.endPoint = endCandidate;
                                    pathCandidate.segments[k].section = [0, endCandidate.location];
                                }
                                else if (k == 0) {
                                    pathCandidate.segments[k].section = [pathCandidate.startPoint.location, pathCandidate.segments[k].referenceLength];
                                }
                                else {
                                    pathCandidate.segments[k].section = [0, pathCandidate.segments[k].referenceLength];
                                }
                            }
                            // put to/from on semgnet
                            if (edgeGeom.forwardReferenceId == pathCandidate.segments[k].referenceId) {
                                pathCandidate.segments[k].fromIntersectionId = edgeGeom.fromIntersectionId;
                                pathCandidate.segments[k].toIntersectionId = edgeGeom.toIntersectionId;
                            }
                            else {
                                // reverse to/from for back references
                                pathCandidate.segments[k].fromIntersectionId = edgeGeom.toIntersectionId;
                                pathCandidate.segments[k].toIntersectionId = edgeGeom.fromIntersectionId;
                            }
                        }
                        if (pathCandidate.startPoint.sideOfStreet == pathCandidate.endPoint.sideOfStreet)
                            pathCandidate.sideOfStreet = pathCandidate.startPoint.sideOfStreet;
                        else
                            pathCandidate.sideOfStreet = ReferenceSideOfStreet.UNKNOWN;
                        var startDist = distance_1.default(startPoint, startCandidate.pointOnLine, { "units": "meters" });
                        var endDist = distance_1.default(endPoint, endCandidate.pointOnLine, { "units": "meters" });
                        pathCandidate.score = Math.round((util_1.rmse([startDist, endDist, pathCandidate.getLengthDelta()]) * 100)) / 100;
                        pathCandidates.push(pathCandidate);
                        // var refIdHash = uuidHash(pathCandidate.segments.map((value):string => {return value.referenceId; }).join(' '));
                        // if(matchWorked && !alreadyIncludedPaths.has(refIdHash)) {
                        //     alreadyIncludedPaths.add(refIdHash);
                        //     bestPathCandidate = pathCandidate;
                        // }   
                    }
                }
            }
            catch (e) {
                // no-op failed to match
            }
            if (pathCandidates.length > 0) {
                var bestPathCandidate = pathCandidates[0];
                var cleanedPath = [];
                var segCoords = [];
                var totalPathLength = 0;
                for (var i = 0; i < bestPathCandidate.segments.length; i++) {
                    totalPathLength += bestPathCandidate.segments[i].section[1] - bestPathCandidate.segments[i].section[0];
                }
                for (var i = 0; i < bestPathCandidate.segments.length; i++) {
                    var segment = bestPathCandidate.segments[i];
                    // adding fudge factor for decimal precision issues
                    if (segment.section[0] < segment.section[1] + this.searchRadius && segment.section[1] <= segment.referenceLength + this.searchRadius && segment.section[0] + this.searchRadius >= 0) {
                        if (this.snapIntersections && (totalPathLength > this.searchRadius)) {
                            if (i == 0 && segment.referenceLength - segment.section[0] < this.searchRadius)
                                continue;
                            if (i == 0 && segment.section[0] < this.searchRadius)
                                segment.section[0] = 0;
                            if (i == bestPathCandidate.segments.length - 1 && segment.section[1] < this.searchRadius)
                                continue;
                            if (i == bestPathCandidate.segments.length - 1 && segment.referenceLength - segment.section[1] < this.searchRadius)
                                segment.section[1] = segment.referenceLength;
                            if (i > 0 && i < bestPathCandidate.segments.length - 1) {
                                segment.section[0] = 0;
                                segment.section[1] = segment.referenceLength;
                            }
                        }
                        if (segment.section[0] == segment.section[1])
                            continue;
                        segment.geometry = yield this.tileIndex.geom(segment.referenceId, segment.section[0], segment.section[1]);
                        if (segment.geometry) {
                            cleanedPath.push(segment);
                            segCoords.push(segment.geometry.geometry.coordinates);
                        }
                    }
                }
                bestPathCandidate.segments = cleanedPath;
                if (cleanedPath.length == 0)
                    return null;
                if (segCoords.length > 0) {
                    var segmentGeoms = turfHelpers.multiLineString([]);
                    segmentGeoms.geometry.coordinates = [...segCoords];
                    bestPathCandidate.matchedPath = segmentGeoms;
                }
            }
            return bestPathCandidate;
        });
    }
    directionForRefId(refId) {
        var ref = this.tileIndex.objectIndex.get(refId);
        if (ref) {
            var geom = this.tileIndex.objectIndex.get(ref['geometryId']);
            if (geom) {
                if (geom['forwardReferenceId'] === ref['id'])
                    return ReferenceDirection.FORWARD;
                else if (geom['backReferenceId'] === ref['id'])
                    return ReferenceDirection.BACKWARD;
            }
        }
        return null;
    }
    toIntersectionIdForRefId(refId) {
        var ref = this.tileIndex.objectIndex.get(refId);
        return ref.locationReferences[ref.locationReferences.length - 1].intersectionId;
    }
    fromIntersectionIdForRefId(refId) {
        var ref = this.tileIndex.objectIndex.get(refId);
        return ref.locationReferences[0].intersectionId;
    }
    getPointCandidateFromRefId(searchPoint, refId, searchBearing) {
        return __awaiter(this, void 0, void 0, function* () {
            var reference = this.tileIndex.objectIndex.get(refId);
            var geometry = this.tileIndex.objectIndex.get(reference.geometryId);
            var geometryFeature = this.tileIndex.featureIndex.get(reference.geometryId);
            var direction = ReferenceDirection.FORWARD;
            if (geometry.backReferenceId && geometry.backReferenceId === refId)
                direction = ReferenceDirection.BACKWARD;
            var pointOnLine = nearest_point_on_line_1.default(geometryFeature, searchPoint, { units: 'meters' });
            if (pointOnLine.properties.dist < this.searchRadius) {
                var refLength = 0;
                for (var lr of reference.locationReferences) {
                    if (lr.distanceToNextRef)
                        refLength = refLength + (lr.distanceToNextRef / 100);
                }
                var interceptBearing = normalizeAngle(bearing_1.default(pointOnLine, searchPoint));
                var i = pointOnLine.properties.index;
                if (geometryFeature.geometry.coordinates.length <= i + 1)
                    i = i - 1;
                var lineBearing = bearing_1.default(geometryFeature.geometry.coordinates[i], geometryFeature.geometry.coordinates[i + 1]);
                if (direction === ReferenceDirection.BACKWARD)
                    lineBearing += 180;
                lineBearing = normalizeAngle(lineBearing);
                var pointCandidate = new PointCandidate();
                pointCandidate.searchPoint = searchPoint;
                pointCandidate.pointOnLine = pointOnLine;
                pointCandidate.geometryId = geometryFeature.properties.id;
                pointCandidate.referenceId = reference.id;
                pointCandidate.roadClass = roadClassConverter(geometry.roadClass);
                // if(this.includeStreetnames) {
                // 	var metadata = await this.cache.metadataById(pointCandidate.geometryId);
                // 	pointCandidate.streetname = metadata.name;
                // }
                pointCandidate.direction = direction;
                pointCandidate.referenceLength = refLength;
                if (direction === ReferenceDirection.FORWARD)
                    pointCandidate.location = pointOnLine.properties.location;
                else
                    pointCandidate.location = refLength - pointOnLine.properties.location;
                pointCandidate.bearing = normalizeAngle(lineBearing);
                pointCandidate.interceptAngle = normalizeAngle(interceptBearing - lineBearing);
                pointCandidate.sideOfStreet = ReferenceSideOfStreet.UNKNOWN;
                if (pointCandidate.interceptAngle < 180) {
                    pointCandidate.sideOfStreet = ReferenceSideOfStreet.RIGHT;
                }
                if (pointCandidate.interceptAngle > 180) {
                    pointCandidate.sideOfStreet = ReferenceSideOfStreet.LEFT;
                }
                if (geometry.backReferenceId)
                    pointCandidate.oneway = false;
                else
                    pointCandidate.oneway = true;
                // check bearing and add to candidate list
                if (!searchBearing || angleDelta(searchBearing, lineBearing) < this.bearingTolerance)
                    return pointCandidate;
            }
            return null;
        });
    }
    getPointCandidateFromGeom(searchPoint, pointOnLine, candidateGeom, candidateGeomFeature, searchBearing, direction) {
        if (pointOnLine.properties.dist < this.searchRadius) {
            var reference;
            if (direction === ReferenceDirection.FORWARD) {
                reference = this.tileIndex.objectIndex.get(candidateGeom.forwardReferenceId);
            }
            else {
                if (candidateGeom.backReferenceId)
                    reference = this.tileIndex.objectIndex.get(candidateGeom.backReferenceId);
                else
                    return null; // no back-reference
            }
            var refLength = 0;
            for (var lr of reference.locationReferences) {
                if (lr.distanceToNextRef)
                    refLength = refLength + (lr.distanceToNextRef / 100);
            }
            var interceptBearing = normalizeAngle(bearing_1.default(pointOnLine, searchPoint));
            var i = pointOnLine.properties.index;
            if (candidateGeomFeature.geometry.coordinates.length <= i + 1)
                i = i - 1;
            var lineBearing = bearing_1.default(candidateGeomFeature.geometry.coordinates[i], candidateGeomFeature.geometry.coordinates[i + 1]);
            if (direction === ReferenceDirection.BACKWARD)
                lineBearing += 180;
            lineBearing = normalizeAngle(lineBearing);
            var pointCandidate = new PointCandidate();
            pointCandidate.searchPoint = searchPoint;
            pointCandidate.pointOnLine = pointOnLine;
            pointCandidate.geometryId = candidateGeomFeature.properties.id;
            pointCandidate.referenceId = reference.id;
            pointCandidate.roadClass = roadClassConverter(candidateGeom.roadClass);
            // if(this.includeStreetnames) {
            // 	var metadata = await this.cache.metadataById(pointCandidate.geometryId);
            // 	pointCandidate.streetname = metadata.name;
            // }
            pointCandidate.direction = direction;
            pointCandidate.referenceLength = refLength;
            if (direction === ReferenceDirection.FORWARD)
                pointCandidate.location = pointOnLine.properties.location;
            else
                pointCandidate.location = refLength - pointOnLine.properties.location;
            pointCandidate.bearing = normalizeAngle(lineBearing);
            pointCandidate.interceptAngle = normalizeAngle(interceptBearing - lineBearing);
            pointCandidate.sideOfStreet = ReferenceSideOfStreet.UNKNOWN;
            if (pointCandidate.interceptAngle < 180) {
                pointCandidate.sideOfStreet = ReferenceSideOfStreet.RIGHT;
            }
            if (pointCandidate.interceptAngle > 180) {
                pointCandidate.sideOfStreet = ReferenceSideOfStreet.LEFT;
            }
            if (candidateGeom.backReferenceId)
                pointCandidate.oneway = false;
            else
                pointCandidate.oneway = true;
            // check bearing and add to candidate list
            if (!searchBearing || angleDelta(searchBearing, lineBearing) < this.bearingTolerance)
                return pointCandidate;
        }
        return null;
    }
    joinPoints(startPoint, endPoint, intersectionBuffer, offsetLine) {
        return __awaiter(this, void 0, void 0, function* () {
            let segmentStart = startPoint.location;
            let segmentEnd = endPoint.location;
            let segmentLength = segmentEnd - segmentStart;
            if (intersectionBuffer * 2 < startPoint.referenceLength) {
                if (segmentStart < intersectionBuffer) {
                    segmentStart = intersectionBuffer;
                    if (segmentStart > segmentEnd) {
                        segmentEnd = segmentStart + segmentLength;
                        if (segmentEnd > startPoint.referenceLength) {
                            segmentEnd = startPoint.referenceLength - intersectionBuffer;
                        }
                    }
                }
                if (startPoint.referenceLength - segmentEnd < intersectionBuffer)
                    segmentEnd = startPoint.referenceLength - intersectionBuffer;
                if (segmentStart > segmentEnd) {
                    segmentStart = segmentEnd - segmentLength;
                    if (segmentStart < 0)
                        segmentStart = intersectionBuffer;
                }
            }
            var joinedPoint = new PathSegment();
            joinedPoint.section[0] = segmentStart;
            joinedPoint.section[1] = segmentEnd;
            joinedPoint.geometryId = startPoint.geometryId;
            joinedPoint.referenceId = startPoint.referenceId;
            joinedPoint.referenceLength = startPoint.referenceLength;
            joinedPoint.sideOfStreet = startPoint.sideOfStreet;
            if (joinedPoint.sideOfStreet == ReferenceSideOfStreet.LEFT)
                offsetLine = 0 - offsetLine;
            joinedPoint.geometry = (yield this.tileIndex.geom(joinedPoint.referenceId, joinedPoint.section[0], joinedPoint.section[1], offsetLine));
            if (!joinedPoint.geometry) {
                joinedPoint.geometry = (yield this.tileIndex.geom(joinedPoint.referenceId, joinedPoint.section[0], joinedPoint.section[1]));
            }
            return joinedPoint;
        });
    }
    bufferPoint(point, bufferLength, offsetLine = null) {
        return __awaiter(this, void 0, void 0, function* () {
            var bufferStart = point.location - (bufferLength / 2);
            var bufferEnd = point.location + (bufferLength / 2);
            if (bufferStart < 0) {
                bufferEnd += Math.abs(bufferStart);
                bufferStart = 0;
            }
            if (bufferEnd > point.referenceLength) {
                bufferStart -= Math.abs(bufferEnd - point.referenceLength);
                bufferEnd = point.referenceLength;
                if (bufferStart < 0) {
                    bufferStart = 0;
                }
            }
            var bufferedPoint = new PathSegment();
            bufferedPoint.section[0] = bufferStart;
            bufferedPoint.section[1] = bufferEnd;
            bufferedPoint.geometryId = point.geometryId;
            bufferedPoint.referenceId = point.referenceId;
            bufferedPoint.referenceLength = point.referenceLength;
            bufferedPoint.sideOfStreet = point.sideOfStreet;
            if (bufferedPoint.sideOfStreet == ReferenceSideOfStreet.LEFT)
                offsetLine = 0 - offsetLine;
            bufferedPoint.geometry = (yield this.tileIndex.geom(bufferedPoint.referenceId, bufferedPoint.section[0], bufferedPoint.section[1], offsetLine));
            if (!bufferedPoint.geometry) {
                bufferedPoint.geometry = (yield this.tileIndex.geom(bufferedPoint.referenceId, bufferedPoint.section[0], bufferedPoint.section[1]));
            }
            return bufferedPoint;
        });
    }
    union(pathSegment, otherSegment, bufferIntersectionRaidus, offsetLine) {
        return __awaiter(this, void 0, void 0, function* () {
            if (pathSegment.isIntersecting(otherSegment)) {
                pathSegment.section[0] = Math.min(pathSegment.section[0], otherSegment.section[0]);
                pathSegment.section[1] = Math.max(pathSegment.section[1], otherSegment.section[1]);
                if (bufferIntersectionRaidus * 2 < pathSegment.referenceLength) {
                    if (pathSegment.section[0] < bufferIntersectionRaidus)
                        pathSegment.section[0] = bufferIntersectionRaidus;
                    if (pathSegment.referenceLength - pathSegment.section[1] < bufferIntersectionRaidus)
                        pathSegment.section[1] = pathSegment.referenceLength - bufferIntersectionRaidus;
                }
                pathSegment.referenceLength = pathSegment.section[1] - pathSegment.section[0];
            }
            pathSegment.geometry = (yield this.tileIndex.geom(pathSegment.referenceId, pathSegment.section[0], pathSegment.section[1], offsetLine));
            if (!pathSegment.geometry) {
                pathSegment.geometry = (yield this.tileIndex.geom(pathSegment.referenceId, pathSegment.section[0], pathSegment.section[1]));
            }
            return pathSegment;
        });
    }
    matchPoint(searchPoint, searchBearing, maxCandidates, leftSideDrive = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this.tileIndex.addTileType(tiles_1.TileType.REFERENCE);
            var candidateFeatures = yield this.tileIndex.nearby(searchPoint, tiles_1.TileType.GEOMETRY, this.searchRadius, this.tileParams);
            var candidates = new Array();
            if (candidateFeatures && candidateFeatures.features) {
                for (var candidateFeature of candidateFeatures.features) {
                    var candidateGeom = this.tileIndex.objectIndex.get(candidateFeature.properties.id);
                    var candidateGeomFeature = this.tileIndex.featureIndex.get(candidateFeature.properties.id);
                    var pointOnLine = nearest_point_on_line_1.default(candidateGeomFeature, searchPoint, { units: 'meters' });
                    var forwardCandidate = yield this.getPointCandidateFromGeom(searchPoint, pointOnLine, candidateGeom, candidateGeomFeature, searchBearing, ReferenceDirection.FORWARD);
                    var backwardCandidate = yield this.getPointCandidateFromGeom(searchPoint, pointOnLine, candidateGeom, candidateGeomFeature, searchBearing, ReferenceDirection.BACKWARD);
                    if (forwardCandidate != null) {
                        var snapped = false;
                        if (this.snapIntersections) {
                            if (forwardCandidate.location < this.searchRadius) {
                                var snappedForwardCandidate1 = Object.assign(new PointCandidate, forwardCandidate);
                                snappedForwardCandidate1.location = 0;
                                snappedForwardCandidate1.snappedPoint = along_1.default(candidateGeomFeature, 0, { "units": "meters" });
                                candidates.push(snappedForwardCandidate1);
                                snapped = true;
                            }
                            if (forwardCandidate.referenceLength - forwardCandidate.location < this.searchRadius) {
                                var snappedForwardCandidate2 = Object.assign(new PointCandidate, forwardCandidate);
                                snappedForwardCandidate2.location = snappedForwardCandidate2.referenceLength;
                                snappedForwardCandidate2.snappedPoint = along_1.default(candidateGeomFeature, snappedForwardCandidate2.referenceLength, { "units": "meters" });
                                candidates.push(snappedForwardCandidate2);
                                snapped = true;
                            }
                        }
                        if (!snapped) {
                            candidates.push(forwardCandidate);
                        }
                    }
                    if (backwardCandidate != null) {
                        var snapped = false;
                        if (this.snapIntersections) {
                            if (backwardCandidate.location < this.searchRadius) {
                                var snappedBackwardCandidate1 = Object.assign(new PointCandidate, backwardCandidate);
                                snappedBackwardCandidate1.location = 0;
                                // not reversing the geom so snap to end on backRefs
                                snappedBackwardCandidate1.snappedPoint = along_1.default(candidateGeomFeature, snappedBackwardCandidate1.referenceLength, { "units": "meters" });
                                candidates.push(snappedBackwardCandidate1);
                                snapped = true;
                            }
                            if (backwardCandidate.referenceLength - backwardCandidate.location < this.searchRadius) {
                                var snappedBackwardCandidate2 = Object.assign(new PointCandidate, backwardCandidate);
                                snappedBackwardCandidate2.location = snappedBackwardCandidate2.referenceLength;
                                // not reversing the geom so snap to start on backRefs
                                snappedBackwardCandidate2.snappedPoint = along_1.default(candidateGeomFeature, 0, { "units": "meters" });
                                candidates.push(snappedBackwardCandidate2);
                                snapped = true;
                            }
                        }
                        if (!snapped) {
                            candidates.push(backwardCandidate);
                        }
                    }
                }
            }
            var sortedCandidates = candidates.sort((p1, p2) => {
                p1.calcScore();
                p2.calcScore();
                if (p1.score === p2.score) {
                    if (leftSideDrive) {
                        if (p1.sideOfStreet === ReferenceSideOfStreet.LEFT && p2.sideOfStreet === ReferenceSideOfStreet.RIGHT)
                            return -1;
                        else if (p2.sideOfStreet === ReferenceSideOfStreet.LEFT && p1.sideOfStreet === ReferenceSideOfStreet.RIGHT)
                            return 1;
                    }
                    else {
                        if (p1.sideOfStreet === ReferenceSideOfStreet.RIGHT && p2.sideOfStreet === ReferenceSideOfStreet.LEFT)
                            return -1;
                        else if (p2.sideOfStreet === ReferenceSideOfStreet.RIGHT && p1.sideOfStreet === ReferenceSideOfStreet.LEFT)
                            return 1;
                    }
                }
                if (p1.score > p2.score) {
                    return 1;
                }
                if (p1.score < p2.score) {
                    return -1;
                }
                return 0;
            });
            if (sortedCandidates.length > maxCandidates) {
                sortedCandidates = sortedCandidates.slice(0, maxCandidates);
            }
            return sortedCandidates;
        });
    }
}
exports.Graph = Graph;
