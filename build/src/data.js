"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const linearProto = require('./proto/linear.js');
var fs = require('fs');
const tileHierarchy = 6;
const tileSource = 'osm';
const tileBuild = 'planet-180430';
function getBinCountFromLength(referenceLength, binSize) {
    var numBins = Math.floor(referenceLength / binSize) + 1;
    return numBins;
}
exports.getBinCountFromLength = getBinCountFromLength;
function getBinLength(referenceLength, binSize) {
    return referenceLength / getBinCountFromLength(referenceLength, binSize);
}
exports.getBinLength = getBinLength;
function getBinPositionFromLocation(referenceLength, binSize, location) {
    var bin = Math.floor(location / getBinLength(referenceLength, binSize)) + 1;
    return bin;
}
exports.getBinPositionFromLocation = getBinPositionFromLocation;
function generateBinId(referenceId, binCount, binPosition) {
    var binId = referenceId + "{" + binCount;
    if (binPosition)
        binId = binId + ":" + binPosition;
    return binId;
}
exports.generateBinId = generateBinId;
var PeriodSize;
(function (PeriodSize) {
    PeriodSize[PeriodSize["OneSecond"] = 0] = "OneSecond";
    PeriodSize[PeriodSize["FiveSeconds"] = 1] = "FiveSeconds";
    PeriodSize[PeriodSize["TenSeconds"] = 2] = "TenSeconds";
    PeriodSize[PeriodSize["FifteenSeconds"] = 3] = "FifteenSeconds";
    PeriodSize[PeriodSize["ThirtySeconds"] = 4] = "ThirtySeconds";
    PeriodSize[PeriodSize["OneMinute"] = 5] = "OneMinute";
    PeriodSize[PeriodSize["FiveMinutes"] = 6] = "FiveMinutes";
    PeriodSize[PeriodSize["TenMinutes"] = 7] = "TenMinutes";
    PeriodSize[PeriodSize["FifteenMinutes"] = 8] = "FifteenMinutes";
    PeriodSize[PeriodSize["ThirtyMinutes"] = 9] = "ThirtyMinutes";
    PeriodSize[PeriodSize["OneHour"] = 10] = "OneHour";
    PeriodSize[PeriodSize["OneDay"] = 11] = "OneDay";
    PeriodSize[PeriodSize["OneWeek"] = 12] = "OneWeek";
    PeriodSize[PeriodSize["OneMonth"] = 13] = "OneMonth";
    PeriodSize[PeriodSize["OneYear"] = 14] = "OneYear";
})(PeriodSize = exports.PeriodSize || (exports.PeriodSize = {}));
class SharedStreetsBin {
}
class SharedStreetsLinearBins {
    constructor(referenceId, referenceLength, numberOfBins) {
        this.referenceId = referenceId;
        this.referenceLength = referenceLength;
        this.numberOfBins = numberOfBins; // defaults to one bin
        this.bins = {};
    }
    getId() {
        return generateBinId(this.referenceId, this.numberOfBins, null);
    }
    addBin(binPosition, type, count, value) {
        var bin = new SharedStreetsBin();
        bin.type = type;
        bin.count = count;
        bin.value = value;
        this.bins[binPosition] = bin;
    }
}
class WeeklySharedStreetsLinearBins extends SharedStreetsLinearBins {
    constructor(referenceId, referenceLength, numberOfBins, periodSize) {
        super(referenceId, referenceLength, numberOfBins);
        this.periodSize = periodSize;
    }
    addPeriodBin(binPosition, period, type, count, value) {
        var bin = new SharedStreetsBin();
        bin.type = type;
        bin.count = count;
        bin.value = value;
        if (!this.bins[binPosition]) {
            this.bins[binPosition] = {};
        }
        this.bins[binPosition][period] = bin;
    }
    getFilteredBins(binPosition, typeFilter, periodFilter) {
        var filteredBins = [];
        if (this.bins[binPosition]) {
            for (var period of Object.keys(this.bins[binPosition])) {
                if (periodFilter) {
                    if (parseInt(period) < periodFilter[0] || parseInt(period) > periodFilter[1])
                        continue;
                }
                if (typeFilter) {
                    if (typeFilter !== this.bins[binPosition][period].type)
                        continue;
                }
                filteredBins.push(this.bins[binPosition][period]);
            }
        }
        return filteredBins;
    }
    getHourOfDaySummary(typeFilter) {
        var filteredBins = new Map();
        for (var binPosition of Object.keys(this.bins)) {
            for (var period of Object.keys(this.bins[binPosition])) {
                var hourOfDay = (parseInt(period) % 23);
                if (hourOfDay > 23)
                    hourOfDay = hourOfDay - 23;
                if (hourOfDay <= 0)
                    hourOfDay = hourOfDay + 23;
                if (typeFilter) {
                    if (typeFilter !== this.bins[binPosition][period].type)
                        continue;
                }
                if (!filteredBins[hourOfDay])
                    filteredBins[hourOfDay] = [];
                filteredBins[hourOfDay].push(this.bins[binPosition][period]);
            }
        }
        return filteredBins;
    }
    getValueForBin(binPosition, typeFilter, periodFilter) {
        var sum = 0;
        var filteredBins = this.getFilteredBins(binPosition, typeFilter, periodFilter);
        for (var bin of filteredBins) {
            sum = sum + bin.value;
        }
        return sum;
    }
    getCountForHoursOfDay(typeFilter) {
        var summary = this.getHourOfDaySummary(typeFilter);
        var hourOfDayCount = {};
        for (var hourOfDay of Object.keys(summary)) {
            hourOfDayCount[hourOfDay] = 0;
            for (var bin of summary[hourOfDay]) {
                hourOfDayCount[hourOfDay] = hourOfDayCount[hourOfDay] + bin.count;
            }
        }
        return hourOfDayCount;
    }
    getCountForBin(binPosition, typeFilter, periodFilter) {
        var sum = 0;
        var filteredBins = this.getFilteredBins(binPosition, typeFilter, periodFilter);
        for (var bin of filteredBins) {
            sum = sum + bin.count;
        }
        return sum;
    }
    getCountForEdge(typeFilter, periodFilter) {
        var sum = 0;
        for (var binPosition = 0; binPosition < this.numberOfBins; binPosition++) {
            var filteredBins = this.getFilteredBins(binPosition, typeFilter, periodFilter);
            for (var bin of filteredBins) {
                sum = sum + bin.count;
            }
        }
        return sum;
    }
}
exports.WeeklySharedStreetsLinearBins = WeeklySharedStreetsLinearBins;
function processTile(reader) {
    var tileData = [];
    while (reader.pos < reader.len) {
        try {
            var result = linearProto.SharedStreetsWeeklyBinnedLinearReferences.decodeDelimited(reader).toJSON();
            var linearBins = new WeeklySharedStreetsLinearBins(result.referenceId, result.referenceLength, result.numberOfBins, PeriodSize.OneHour);
            for (var i = 0; i < result.binPosition.length; i++) {
                var binPosition = result.binPosition[i];
                for (var j = 0; j < result.binnedPeriodicData[i].bins.length; j++) {
                    var period = result.binnedPeriodicData[i].periodOffset[j];
                    var bin = result.binnedPeriodicData[i].bins[j];
                    for (var h in bin.dataType) {
                        linearBins.addPeriodBin(binPosition, period, bin.dataType[h], parseInt(bin.count[h]), parseInt(bin.value[h]));
                    }
                }
            }
            tileData.push(linearBins);
        }
        catch (e) {
            console.log(e);
        }
    }
    return tileData;
}
class BinReferenceData {
}
//export async function query(event, cache:LocalCache, callback) {
//     var sourceTest = new RegExp("[a-z]{1,10}");
//     var source = undefined;
//     if(sourceTest.test(event.pathParameters.source)) {
//         source = event.pathParameters.source;
//         if(source === "dc_pudo" && event.queryStringParameters.authKey != "c890c855-b968-4952-8c0a-64cc2ca446c3") {
//             callback(401, "Not authorized");
//             return;
//         }
//     }
//     var weekTest = new RegExp("([12]\\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01]))");
//     var week = undefined;
//     if(event.pathParameters.week === '2017-09-11'  || weekTest.test(event.pathParameters.week))
//         week = event.pathParameters.week;
//     var tileKeyTest = new RegExp("^[0-9\-]*$");
//     var tileKeys = undefined;
//     if(tileKeyTest.test(event.pathParameters.tileKey)) {
//         tileKeys = [];
//         tileKeys.push(event.pathParameters.tileKey);
//     }
//     var typeFilter = null;
//     if(event.queryStringParameters.typeFilter) {
//         typeFilter = event.queryStringParameters.typeFilter;
//     }
//     var offset = 4;
//     if(event.queryStringParameters.offset) {
//         offset = parseInt(event.queryStringParameters.offset);
//     }
//     var normalizeByLength = false;
//     if(event.queryStringParameters.normalizeByLength) {
//         normalizeByLength = JSON.parse(event.queryStringParameters.normalizeByLength);
//     }
//     var periodFilter = null;
//     if(event.queryStringParameters.periodFilter) {
//         var periodFilterParts = event.queryStringParameters.periodFilter.split('-');
//         periodFilter = [];
//         periodFilter[0] = parseInt(periodFilterParts[0]);
//         periodFilter[1] = parseInt(periodFilterParts[1]);
//     }
//     var bboxPolygon = undefined;
//     if(event.queryStringParameters && event.queryStringParameters.bounds) {
//         var bboxString = event.queryStringParameters.bounds;
//         var bboxParts = bboxString.split(",").map((s) => {return Number.parseFloat(s)});
//         if(bboxParts.length == 4) {
//             var line = turfHelpers.lineString([[bboxParts[0],bboxParts[1]],[bboxParts[2],bboxParts[3]]]);
//             var bbox = turfBbox(line);
//             bboxPolygon = turfBboxPolygon(bbox);
//         }
//         tileKeys = getTileIdsForPolygon(bboxPolygon);
//     }    
//     if(!source || !week || (!tileKeys && !bbox)) {
//         callback(400, "Invalid request");
//         return;
//     }
//     var indexedGeoms = undefined;
//     var referenceIds = new Set<string>();
//     var resultType = "bin";
//     if(event.queryStringParameters && event.queryStringParameters.resultType) {
//         if(event.queryStringParameters.resultType === "bin")
//             resultType = "bin";
//         else if(event.queryStringParameters.resultType === "summary")
//             resultType = "summary";
//         else if(event.queryStringParameters.resultType === "rank")
//             resultType = "rank";
//         else {
//             callback(400, "Invalid request");
//             return;
//         }
//     }
//     if(event.queryStringParameters && event.queryStringParameters.referenceIds) {
//         var referenceIdStrings  = event.queryStringParameters.referenceIds.split(",");
//         for(var referenceId of referenceIdStrings) {
//             referenceIds.add(referenceId);
//         }
//     }
//     else if(bboxPolygon) {
//         var geometries = await cache.within('geometries', bboxPolygon,true, tileSource, tileBuild, tileHierarchy);
//         for(var geometry of geometries) {
//             var geomData = cache.idIndex[geometry.properties.id];
//             referenceIds.add(geomData.forwardReferenceId);
//             if(geomData.backReferenceId)
//                 referenceIds.add(geomData.backReferenceId);
//         }       
//     }
//     try {
//         var results;
//         if(resultType === "bin") {
//             results = {type:"FeatureCollection", features:[]};
//             var selectedCount = 0;
//             for(var tileKey of tileKeys ) {
//                 var data:Uint8Array = await downloadPath(source + '/b/' + week +  '/' + tileKey + '.events.pbf');
//                 var reader = new probuf_minimal.Reader(data)            
//                 var tileData = processTile(reader);
//                 for(var linearBin of tileData) {
//                     if(!referenceIds.has(linearBin.referenceId))
//                         continue;
//                     var refData = cache.idIndex[linearBin.referenceId];
//                     var geomData = cache.idIndex[refData.geometryId];
//                     var refLength = getReferenceLength(refData);
//                     var binLength = refLength / linearBin.numberOfBins;
//                     var direction = ReferenceDirection.FORWARD;
//                     if(linearBin.referenceId === geomData.backReferenceId)
//                         direction = ReferenceDirection.BACKWARD;
//                     var binPoints = geometryToBins(geomData.feature, 
//                                                     linearBin.referenceId, 
//                                                     refLength, 
//                                                     linearBin.numberOfBins, 
//                                                     offset, 
//                                                     direction,  
//                                                     ReferenceSideOfStreet.RIGHT);
//                     for(var binPoint of binPoints) {
//                         var binPosition = binPoint.properties.bin;
//                         if(typeFilter)
//                             binPoint.properties['type'] = typeFilter;
//                         var periodRange = periodFilter[1] - periodFilter[0];
//                         var value = linearBin.getValueForBin(binPosition, typeFilter, periodFilter);
//                         var binCount = linearBin.getCountForBin(binPosition, typeFilter, periodFilter);
//                         var binCountByLength =  binCount / binLength;
//                         var periodAverageCount =  binCount / periodRange;
//                         binPoint.properties['binLength'] = Math.round(binLength * 100) / 100;
//                         binPoint.properties['periodAverageCount'] = Math.round(periodAverageCount * 100) / 100;
//                         if(binCount > 10)
//                             results.features.push(binPoint);
//                     }
//                 }
//             }
//         }
//         else if(resultType === "rank") {
//             results = {type:"FeatureCollection", features:[]};
//             var unfilteredResults = {type:"FeatureCollection", features:[]};
//             var edgeCounts:number[] = [];
//             var selectedCount = 0;
//             for(var tileKey of tileKeys ) {
//                 var data:Uint8Array = await downloadPath(source + '/b/' + week +  '/' + tileKey + '.events.pbf');
//                 var reader = new probuf_minimal.Reader(data)            
//                 var tileData = processTile(reader);
//                 for(var linearBin of tileData) {
//                     if(!referenceIds.has(linearBin.referenceId))
//                         continue;
//                     var refData = cache.idIndex[linearBin.referenceId];
//                     var geomData = cache.idIndex[refData.geometryId];
//                     var refLength = getReferenceLength(refData);
//                     var direction = ReferenceDirection.FORWARD;
//                     if(linearBin.referenceId === geomData.backReferenceId)
//                         direction = ReferenceDirection.BACKWARD;
//                     var edgeTotal = linearBin.getCountForEdge(typeFilter, periodFilter);
//                     if(normalizeByLength) 
//                         edgeTotal = edgeTotal / refLength;
//                     edgeCounts.push(edgeTotal);
//                     if(edgeTotal > 0) {
//                         var curbGeom;
//                         if(direction === ReferenceDirection.FORWARD)
//                             curbGeom = lineOffset(geomData.feature, offset, {units: 'meters'});
//                         else {
//                             var reverseGeom = geomUtils.reverseLineString(geomData.feature);
//                             curbGeom = lineOffset(reverseGeom, offset, {units: 'meters'});
//                         }
//                         curbGeom.properties.edgeTotal = edgeTotal;
//                         unfilteredResults.features.push(curbGeom);
//                     }   
//                 }
//             }
//             var sortedEdgeCounts = edgeCounts.sort();
//             for(var edge of unfilteredResults.features) {
//                 var rank:number = quantileRankSorted(sortedEdgeCounts, edge.properties.edgeTotal);
//                 edge.properties['rank'] = Math.round(rank * 100) / 100;
//                 delete edge.properties['edgeTotal'];
//                 if(edge.properties['rank'] > 0.5) {
//                     results.features.push(edge);
//                 }
//             }
//         }
//         else if(resultType === "summary") {
//             results = {};
//             var selectedCount = 0;
//             for(var tileKey of tileKeys ) {
//                 var data:Uint8Array = await downloadPath(source + '/b/' + week +  '/' + tileKey + '.events.pbf');
//                 var reader = new probuf_minimal.Reader(data)            
//                 var tileData = processTile(reader);
//                 for(var linearBin of Object.values(tileData)) {
//                     if(!referenceIds.has(linearBin.referenceId))
//                         continue;
//                     var hourOfDayCount = linearBin.getCountForHoursOfDay(typeFilter);
//                     for(var hourOfDay of Object.keys(hourOfDayCount)) {
//                         if(!results[hourOfDay])
//                             results[hourOfDay] = 0;
//                         results[hourOfDay] = results[hourOfDay] + hourOfDayCount[hourOfDay];
//                     }
//                 }
//             }
//             for(var hourOfDay of Object.keys(results)) {
//                 results[hourOfDay] =  results[hourOfDay] / 8000;
//             }
//         }
//         callback(null, results);
//     }
//     catch(e) {
//         console.log(e)
//         callback(400, "Invalid request");
//         return;
//     } 
// }
