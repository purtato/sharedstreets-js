"use strict";
//import redis = require('redis');
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
//import { SharedStreetsMetadata, SharedStreetsIntersection, SharedStreetsGeometry, SharedStreetsReference, RoadClass  } from 'sharedstreets-types';
const turfHelpers = __importStar(require("@turf/helpers"));
const buffer_1 = __importDefault(require("@turf/buffer"));
const along_1 = __importDefault(require("@turf/along"));
const line_slice_along_1 = __importDefault(require("@turf/line-slice-along"));
const distance_1 = __importDefault(require("@turf/distance"));
const line_offset_1 = __importDefault(require("@turf/line-offset"));
const rbush_1 = __importDefault(require("rbush"));
const index_1 = require("../src/index");
const tiles_1 = require("./tiles");
const geom_1 = require("./geom");
const helpers_1 = require("@turf/helpers");
const SHST_ID_API_URL = 'https://api.sharedstreets.io/v0.1.0/id/';
// maintains unified spaital and id indexes for tiled data
function createIntersectionGeometry(data) {
    var point = turfHelpers.point([data.lon, data.lat]);
    return turfHelpers.feature(point.geometry, { id: data.id });
}
exports.createIntersectionGeometry = createIntersectionGeometry;
function getReferenceLength(ref) {
    var refLength = 0;
    for (var locationRef of ref.locationReferences) {
        if (locationRef.distanceToNextRef)
            refLength = refLength = locationRef.distanceToNextRef;
    }
    return refLength / 100;
}
exports.getReferenceLength = getReferenceLength;
function createGeometry(data) {
    var line = turfHelpers.lineString(index_1.lonlatsToCoords(data.lonlats));
    var feature = turfHelpers.feature(line.geometry, { id: data.id });
    return feature;
}
exports.createGeometry = createGeometry;
class TileIndex {
    constructor() {
        this.additionalTileTypes = [];
        this.tiles = new Set();
        this.objectIndex = new Map();
        this.featureIndex = new Map();
        this.metadataIndex = new Map();
        this.osmNodeIntersectionIndex = new Map();
        this.osmNodeIndex = new Map();
        this.osmWayIndex = new Map();
        this.binIndex = new Map();
        this.intersectionIndex = new rbush_1.default(9);
        this.geometryIndex = new rbush_1.default(9);
    }
    addTileType(tileType) {
        this.additionalTileTypes.push(tileType);
    }
    isIndexed(tilePath) {
        if (this.tiles.has(tilePath.toPathString()))
            return true;
        else
            return false;
    }
    indexTilesByPathGroup(tilePathGroup) {
        return __awaiter(this, void 0, void 0, function* () {
            for (var tilePath of tilePathGroup) {
                yield this.indexTileByPath(tilePath);
            }
            return false;
        });
    }
    indexTileByPath(tilePath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isIndexed(tilePath))
                return true;
            var data = yield tiles_1.getTile(tilePath);
            if (tilePath.tileType === tiles_1.TileType.GEOMETRY) {
                var geometryFeatures = [];
                for (var geometry of data) {
                    if (!this.objectIndex.has(geometry.id)) {
                        this.objectIndex.set(geometry.id, geometry);
                        var geometryFeature = createGeometry(geometry);
                        this.featureIndex.set(geometry.id, geometryFeature);
                        var bboxCoords = geom_1.bboxFromPolygon(geometryFeature);
                        bboxCoords['id'] = geometry.id;
                        geometryFeatures.push(bboxCoords);
                    }
                }
                this.geometryIndex.load(geometryFeatures);
            }
            else if (tilePath.tileType === tiles_1.TileType.INTERSECTION) {
                var intersectionFeatures = [];
                for (var intersection of data) {
                    if (!this.objectIndex.has(intersection.id)) {
                        this.objectIndex.set(intersection.id, intersection);
                        var intesectionFeature = createIntersectionGeometry(intersection);
                        this.featureIndex.set(intersection.id, intesectionFeature);
                        this.osmNodeIntersectionIndex.set(intersection.nodeId, intersection);
                        var bboxCoords = geom_1.bboxFromPolygon(intesectionFeature);
                        bboxCoords['id'] = intersection.id;
                        intersectionFeatures.push(bboxCoords);
                    }
                }
                this.intersectionIndex.load(intersectionFeatures);
            }
            else if (tilePath.tileType === tiles_1.TileType.REFERENCE) {
                for (var reference of data) {
                    this.objectIndex.set(reference.id, reference);
                }
            }
            else if (tilePath.tileType === tiles_1.TileType.METADATA) {
                for (var metadata of data) {
                    this.metadataIndex.set(metadata.geometryId, metadata);
                    if (metadata.osmMetadata) {
                        for (var waySection of metadata.osmMetadata.waySections) {
                            if (!this.osmWayIndex.has("" + waySection.wayId))
                                this.osmWayIndex.set("" + waySection.wayId, []);
                            var ways = this.osmWayIndex.get("" + waySection.wayId);
                            ways.push(metadata);
                            this.osmWayIndex.set("" + waySection.wayId, ways);
                            for (var nodeId of waySection.nodeIds) {
                                if (!this.osmNodeIndex.has("" + nodeId))
                                    this.osmNodeIndex.set("" + nodeId, []);
                                var nodes = this.osmNodeIndex.get("" + nodeId);
                                nodes.push(metadata);
                                this.osmNodeIndex.set("" + nodeId, nodes);
                            }
                        }
                    }
                }
            }
            this.tiles.add(tilePath.toPathString());
        });
    }
    getGraph(polygon, params) {
        return __awaiter(this, void 0, void 0, function* () {
            return null;
        });
    }
    intersects(polygon, searchType, buffer, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var tilePaths = tiles_1.TilePathGroup.fromPolygon(polygon, buffer, params);
            if (searchType === tiles_1.TileType.GEOMETRY)
                tilePaths.addType(tiles_1.TileType.GEOMETRY);
            else if (searchType === tiles_1.TileType.INTERSECTION)
                tilePaths.addType(tiles_1.TileType.INTERSECTION);
            else
                throw "invalid search type must be GEOMETRY or INTERSECTION";
            if (this.additionalTileTypes.length > 0) {
                for (var type of this.additionalTileTypes) {
                    tilePaths.addType(type);
                }
            }
            yield this.indexTilesByPathGroup(tilePaths);
            var data = helpers_1.featureCollection([]);
            if (searchType === tiles_1.TileType.GEOMETRY) {
                var bboxCoords = geom_1.bboxFromPolygon(polygon);
                var rbushMatches = this.geometryIndex.search(bboxCoords);
                for (var rbushMatch of rbushMatches) {
                    var matchedGeom = this.featureIndex.get(rbushMatch.id);
                    data.features.push(matchedGeom);
                }
            }
            else if (searchType === tiles_1.TileType.INTERSECTION) {
                var bboxCoords = geom_1.bboxFromPolygon(polygon);
                var rbushMatches = this.intersectionIndex.search(bboxCoords);
                for (var rbushMatch of rbushMatches) {
                    var matchedGeom = this.featureIndex.get(rbushMatch.id);
                    data.features.push(matchedGeom);
                }
            }
            return data;
        });
    }
    nearby(point, searchType, searchRadius, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var tilePaths = tiles_1.TilePathGroup.fromPoint(point, searchRadius * 2, params);
            if (searchType === tiles_1.TileType.GEOMETRY)
                tilePaths.addType(tiles_1.TileType.GEOMETRY);
            else if (searchType === tiles_1.TileType.INTERSECTION)
                tilePaths.addType(tiles_1.TileType.INTERSECTION);
            else
                throw "invalid search type must be GEOMETRY or INTERSECTION";
            if (this.additionalTileTypes.length > 0) {
                for (var type of this.additionalTileTypes) {
                    tilePaths.addType(type);
                }
            }
            yield this.indexTilesByPathGroup(tilePaths);
            var bufferedPoint = buffer_1.default(point, searchRadius, { 'units': 'meters' });
            var data = helpers_1.featureCollection([]);
            if (searchType === tiles_1.TileType.GEOMETRY) {
                var bboxCoords = geom_1.bboxFromPolygon(bufferedPoint);
                var rbushMatches = this.geometryIndex.search(bboxCoords);
                for (var rbushMatch of rbushMatches) {
                    var matchedGeom = this.featureIndex.get(rbushMatch.id);
                    data.features.push(matchedGeom);
                }
            }
            else if (searchType === tiles_1.TileType.INTERSECTION) {
                var bboxCoords = geom_1.bboxFromPolygon(bufferedPoint);
                var rbushMatches = this.intersectionIndex.search(bboxCoords);
                for (var rbushMatch of rbushMatches) {
                    var matchedGeom = this.featureIndex.get(rbushMatch.id);
                    data.features.push(matchedGeom);
                }
            }
            return data;
        });
    }
    geomFromOsm(wayId, nodeId1, nodeId2, offset = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.osmNodeIntersectionIndex.has(nodeId1) && this.osmNodeIntersectionIndex.has(nodeId2)) {
                var intersection1 = this.osmNodeIntersectionIndex.get(nodeId1);
                var intersection2 = this.osmNodeIntersectionIndex.get(nodeId2);
                var referenceCandidates = new Set();
                for (var refId of intersection1.outboundReferenceIds) {
                    referenceCandidates.add(refId);
                }
                for (var refId of intersection2.inboundReferenceIds) {
                    if (referenceCandidates.has(refId)) {
                        var geom = yield this.geom(refId, null, null, offset);
                        if (geom) {
                            geom.properties['referenceId'] = refId;
                            return geom;
                        }
                    }
                }
            }
            else if (this.osmWayIndex.has(wayId)) {
                var metadataList = this.osmWayIndex.get(wayId);
                for (var metadata of metadataList) {
                    var nodeIds = [];
                    var previousNode = null;
                    var nodeIndex = 0;
                    var startNodeIndex = null;
                    var endNodeIndex = null;
                    for (var waySection of metadata.osmMetadata.waySections) {
                        for (var nodeId of waySection.nodeIds) {
                            var nodeIdStr = nodeId + "";
                            if (previousNode != nodeIdStr) {
                                nodeIds.push(nodeIdStr);
                                if (nodeIdStr == nodeId1)
                                    startNodeIndex = nodeIndex;
                                if (nodeIdStr == nodeId2)
                                    endNodeIndex = nodeIndex;
                                nodeIndex++;
                            }
                            previousNode = nodeIdStr;
                        }
                    }
                    if (startNodeIndex != null && endNodeIndex != null) {
                        var geometry = this.objectIndex.get(metadata.geometryId);
                        var geometryFeature = this.featureIndex.get(metadata.geometryId);
                        var reference = this.objectIndex.get(geometry.forwardReferenceId);
                        if (startNodeIndex > endNodeIndex) {
                            if (geometry.backReferenceId) {
                                nodeIds.reverse();
                                startNodeIndex = (nodeIds.length - 1) - startNodeIndex;
                                endNodeIndex = (nodeIds.length - 1) - endNodeIndex;
                                reference = this.objectIndex.get(geometry.backReferenceId);
                                geometryFeature = JSON.parse(JSON.stringify(geometryFeature));
                                geometryFeature.geometry.coordinates = geometryFeature.geometry.coordinates.reverse();
                            }
                        }
                        var startLocation = 0;
                        var endLocation = 0;
                        var previousCoord = null;
                        for (var j = 0; j <= endNodeIndex; j++) {
                            if (previousCoord) {
                                try {
                                    var coordDistance = distance_1.default(previousCoord, geometryFeature.geometry.coordinates[j], { units: 'meters' });
                                    if (j <= startNodeIndex)
                                        startLocation += coordDistance;
                                    endLocation += coordDistance;
                                }
                                catch (e) {
                                    console.log(e);
                                }
                            }
                            previousCoord = geometryFeature.geometry.coordinates[j];
                        }
                        //console.log(wayId + " " + nodeId1 + " " + nodeId2 + ": " + reference.id + " " + startLocation + " " + endLocation);
                        var geom = yield this.geom(reference.id, startLocation, endLocation, offset);
                        if (geom) {
                            geom.properties['referenceId'] = reference.id;
                            geom.properties['section'] = [startLocation, endLocation];
                            return geom;
                        }
                    }
                }
            }
            return null;
        });
    }
    referenceToBins(referenceId, numBins, offset, sideOfStreet) {
        var binIndexId = referenceId + ':' + numBins + ':' + offset;
        if (this.binIndex.has(binIndexId))
            return this.binIndex.get(binIndexId);
        var ref = this.objectIndex.get(referenceId);
        var geom = this.objectIndex.get(ref.geometryId);
        var feature = this.featureIndex.get(ref.geometryId);
        var binLength = getReferenceLength(ref) / numBins;
        var binPoints = {
            "type": "Feature",
            "properties": { "id": referenceId },
            "geometry": {
                "type": "MultiPoint",
                "coordinates": []
            }
        };
        try {
            if (offset) {
                if (referenceId === geom.forwardReferenceId)
                    feature = line_offset_1.default(feature, offset, { units: 'meters' });
                else {
                    var reverseGeom = geom_1.reverseLineString(feature);
                    feature = line_offset_1.default(reverseGeom, offset, { units: 'meters' });
                }
            }
            for (var binPosition = 0; binPosition < numBins; binPosition++) {
                try {
                    var point = along_1.default(feature, (binLength * binPosition) + (binLength / 2), { units: 'meters' });
                    point.geometry.coordinates[0] = Math.round(point.geometry.coordinates[0] * 10000000) / 10000000;
                    point.geometry.coordinates[1] = Math.round(point.geometry.coordinates[1] * 10000000) / 10000000;
                    binPoints.geometry.coordinates.push(point.geometry.coordinates);
                }
                catch (e) {
                    console.log(e);
                }
            }
            this.binIndex.set(binIndexId, binPoints);
        }
        catch (e) {
            console.log(e);
        }
        return binPoints;
    }
    geom(referenceId, p1, p2, offset = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.objectIndex.has(referenceId)) {
                var ref = this.objectIndex.get(referenceId);
                var geom = this.objectIndex.get(ref.geometryId);
                var geomFeature = JSON.parse(JSON.stringify(this.featureIndex.get(ref.geometryId)));
                if (geom.backReferenceId && geom.backReferenceId === referenceId) {
                    geomFeature.geometry.coordinates = geomFeature.geometry.coordinates.reverse();
                }
                if (offset) {
                    geomFeature = line_offset_1.default(geomFeature, offset, { units: 'meters' });
                }
                if (p1 < 0)
                    p1 = 0;
                if (p2 < 0)
                    p2 = 0;
                if (p1 == null && p2 == null) {
                    return geomFeature;
                }
                else if (p1 && p2 == null) {
                    return along_1.default(geomFeature, p1, { "units": "meters" });
                }
                else if (p1 != null && p2 != null) {
                    try {
                        return line_slice_along_1.default(geomFeature, p1, p2, { "units": "meters" });
                    }
                    catch (e) {
                        //console.log(p1, p2)
                    }
                }
            }
            // TODO find missing IDs via look up
            return null;
        });
    }
}
exports.TileIndex = TileIndex;
