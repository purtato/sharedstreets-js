'use strict';
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
const along_1 = __importDefault(require("@turf/along"));
const bearing_1 = __importDefault(require("@turf/bearing"));
const distance_1 = __importDefault(require("@turf/distance"));
const nearest_point_on_line_1 = __importDefault(require("@turf/nearest-point-on-line"));
const tile_index_1 = require("./tile_index");
const tiles_1 = require("./tiles");
// import { start } from 'repl';
// import { normalize } from 'path';
const DEFAULT_SEARCH_RADIUS = 25;
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
class PointMatcher {
    constructor(extent = null, params, existingTileIndex = null) {
        this.searchRadius = DEFAULT_SEARCH_RADIUS;
        this.bearingTolerance = DEFAULT_BEARING_TOLERANCE;
        this.lengthTolerance = DEFAULT_LENGTH_TOLERANCE;
        this.includeIntersections = false;
        this.includeStreetnames = false;
        this.ignoreDirection = false;
        this.snapToIntersections = false;
        this.snapTopology = false;
        this.snapSideOfStreet = ReferenceSideOfStreet.UNKNOWN;
        this.tileParams = params;
        if (existingTileIndex)
            this.tileIndex = existingTileIndex;
        else
            this.tileIndex = new tile_index_1.TileIndex();
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
                pointCandidate.roadClass = geometry.roadClass;
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
            pointCandidate.roadClass = candidateGeom.roadClass;
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
    getPointCandidates(searchPoint, searchBearing, maxCandidates) {
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
                        if (this.snapToIntersections) {
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
                        if (this.snapToIntersections) {
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
exports.PointMatcher = PointMatcher;
