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
const sharedstreetsPbf = __importStar(require("sharedstreets-pbf"));
const bbox_1 = __importDefault(require("@turf/bbox"));
const destination_1 = __importDefault(require("@turf/destination"));
const fs_1 = require("fs");
const util_1 = require("./util");
const chalk = require('chalk');
const path = require('path');
const SphericalMercator = require("@mapbox/sphericalmercator");
const sphericalMercator = new SphericalMercator({
    size: 256
});
const DEFAULT_ZLEVEL = 12;
const SHST_ID_API_URL = 'https://api.sharedstreets.io/v0.1.0/id/';
const SHST_TILE_URL = 'https://tiles.sharedstreets.io/';
const USE_LOCAL_CACHE = true;
const SHST_TILE_CACHE_DIR = util_1.resolveHome('/tmp/shst/cache/tiles/');
var TileType;
(function (TileType) {
    TileType["REFERENCE"] = "reference";
    TileType["INTERSECTION"] = "intersection";
    TileType["GEOMETRY"] = "geometry";
    TileType["METADATA"] = "metadata";
})(TileType = exports.TileType || (exports.TileType = {}));
function getTilesForId(id) {
    return __awaiter(this, void 0, void 0, function* () {
        var url = SHST_ID_API_URL + 'shst:' + id;
        return util_1.getJson(url);
    });
}
exports.getTilesForId = getTilesForId;
function getTileIdsForPolygon(polygon, buffer = 0) {
    var polyBound = bbox_1.default(polygon);
    var nwPoint = destination_1.default([polyBound[0], polyBound[1]], buffer, 315, { 'units': 'meters' });
    var sePoint = destination_1.default([polyBound[2], polyBound[3]], buffer, 135, { 'units': 'meters' });
    let bounds = [nwPoint.geometry.coordinates[0], nwPoint.geometry.coordinates[1], sePoint.geometry.coordinates[0], sePoint.geometry.coordinates[1]];
    return getTileIdsForBounds(bounds, false);
}
exports.getTileIdsForPolygon = getTileIdsForPolygon;
function getTileIdsForPoint(point, buffer) {
    if (buffer > 0) {
        var nwPoint = destination_1.default(point, buffer, 315, { 'units': 'meters' });
        var sePoint = destination_1.default(point, buffer, 135, { 'units': 'meters' });
        let bounds = [nwPoint.geometry.coordinates[0], nwPoint.geometry.coordinates[1], sePoint.geometry.coordinates[0], sePoint.geometry.coordinates[1]];
        return getTileIdsForBounds(bounds, false);
    }
    else {
        let bounds = [point.geometry.coordinates[0], point.geometry.coordinates[1], point.geometry.coordinates[0], point.geometry.coordinates[1]];
        return getTileIdsForBounds(bounds, false);
    }
}
exports.getTileIdsForPoint = getTileIdsForPoint;
function getTileIdsForBounds(bounds, bufferEdge) {
    let tileRange = sphericalMercator.xyz(bounds, DEFAULT_ZLEVEL);
    let tileIds = [];
    // if buffer extend tile range to +/- 1
    let bufferSize = 0;
    if (bufferEdge)
        bufferSize = 1;
    for (var x = tileRange.minX - bufferSize; x <= tileRange.maxX + bufferSize; x++) {
        for (var y = tileRange.minY - bufferSize; y <= tileRange.maxY + bufferSize; y++) {
            var tileId = DEFAULT_ZLEVEL + '-' + x + '-' + y;
            tileIds.push(tileId);
        }
    }
    return tileIds;
}
exports.getTileIdsForBounds = getTileIdsForBounds;
function getTile(tilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        // TODO use generator/yield pattern + protobuf decodeDelimited
        var arrayBuffer;
        var tileFilePath = path.join(SHST_TILE_CACHE_DIR, tilePath.toPathString());
        if (USE_LOCAL_CACHE && fs_1.existsSync(tileFilePath)) {
            arrayBuffer = new Uint8Array(fs_1.readFileSync(tileFilePath));
            //console.log(chalk.keyword('lightgreen')("     reading from cached: " + SHST_TILE_CACHE_DIR + tilePath.toPathString()));
        }
        else {
            try {
                arrayBuffer = yield util_1.getPbf(SHST_TILE_URL + tilePath.toPathString());
            }
            catch (e) {
                return [];
            }
            if (USE_LOCAL_CACHE) {
                fs_1.mkdirSync(path.join(SHST_TILE_CACHE_DIR, tilePath.source), { recursive: true });
                fs_1.writeFileSync(tileFilePath, arrayBuffer);
                console.log(chalk.keyword('lightgreen')("     writing to cache: " + tileFilePath));
            }
        }
        if (arrayBuffer) {
            if (tilePath.tileType === TileType.GEOMETRY) {
                var geometries = sharedstreetsPbf.geometry(arrayBuffer);
                return geometries;
            }
            else if (tilePath.tileType === TileType.INTERSECTION) {
                var intersections = sharedstreetsPbf.intersection(arrayBuffer);
                return intersections;
            }
            else if (tilePath.tileType === TileType.REFERENCE) {
                var references = sharedstreetsPbf.reference(arrayBuffer);
                return references;
            }
            else if (tilePath.tileType === TileType.METADATA) {
                var metadata = sharedstreetsPbf.metadata(arrayBuffer);
                return metadata;
            }
        }
    });
}
exports.getTile = getTile;
function getIdFromTilePath(tilePath) {
    var pathParts = tilePath.split("/");
    var fileParts = pathParts[pathParts.length - 1].split(".");
    var tileId = fileParts[fileParts.length - 4];
    return tileId;
}
exports.getIdFromTilePath = getIdFromTilePath;
function getTypeFromTilePath(tilePath) {
    var parts = tilePath.split(".");
    var typeString = parts[parts.length - 3].toUpperCase();
    var type = TileType[typeString];
    return type;
}
exports.getTypeFromTilePath = getTypeFromTilePath;
function getSourceFromTilePath(tilePath) {
    var pathParts = tilePath.split('/');
    var tileSource = pathParts[0] + '/' + pathParts[1];
    return tileSource;
}
exports.getSourceFromTilePath = getSourceFromTilePath;
function getHierarchyFromPath(tilePath) {
    var parts = tilePath.split(".");
    return parseInt(parts[parts.length - 2]);
}
exports.getHierarchyFromPath = getHierarchyFromPath;
class TilePathParams {
    constructor(params = null) {
        if (params)
            this.setParams(params);
    }
    setParams(params) {
        this.source = params.source;
        this.tileHierarchy = params.tileHierarchy;
    }
}
exports.TilePathParams = TilePathParams;
class TilePath extends TilePathParams {
    constructor(path = null) {
        super();
        if (path) {
            this.tileId = getIdFromTilePath(path);
            this.tileType = getTypeFromTilePath(path);
            this.source = getSourceFromTilePath(path);
            this.tileHierarchy = getHierarchyFromPath(path);
        }
    }
    toPathString() {
        return this.source + '/' + this.tileId + '.' + this.tileType + '.' + this.tileHierarchy + '.pbf';
    }
}
exports.TilePath = TilePath;
class TilePathGroup extends TilePathParams {
    constructor(paths = null) {
        super();
        this.tileIds = [];
        this.tileTypes = [];
        if (paths) {
            for (var path of paths) {
                this.addPath(path);
            }
        }
    }
    *[Symbol.iterator]() {
        this.tileTypes.sort();
        this.tileIds.sort();
        for (var tileType of this.tileTypes) {
            for (var tileId of this.tileIds) {
                var tilePath = new TilePath();
                tilePath.setParams(this);
                tilePath.tileId = tileId;
                tilePath.tileType = tileType;
                yield tilePath;
            }
        }
    }
    addType(tileType) {
        var typeSet = new Set(this.tileTypes);
        typeSet.add(tileType);
        this.tileTypes = [...typeSet.values()];
    }
    addTileId(tileId) {
        var idSet = new Set(this.tileIds);
        idSet.add(tileId);
        this.tileIds = [...idSet.values()];
    }
    addPath(path) {
        if (this.source != undefined && this.source !== path.source)
            throw "Path source does not match group";
        else
            this.source = path.source;
        if (this.tileHierarchy != undefined && this.tileHierarchy !== path.tileHierarchy)
            throw "Path source does not match group";
        else
            this.tileHierarchy = path.tileHierarchy;
        this.addType(path.tileType);
        this.addTileId(path.tileId);
    }
    static fromPolygon(polygon, buffer, params) {
        var tilePathGroup = new TilePathGroup();
        tilePathGroup.setParams(params);
        tilePathGroup.tileIds = getTileIdsForPolygon(polygon);
        return tilePathGroup;
    }
    static fromPoint(point, buffer, params) {
        var tilePathGroup = new TilePathGroup();
        tilePathGroup.setParams(params);
        tilePathGroup.tileIds = getTileIdsForPoint(point, buffer);
        return tilePathGroup;
    }
}
exports.TilePathGroup = TilePathGroup;
