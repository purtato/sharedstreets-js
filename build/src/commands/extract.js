"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const command_1 = require("@oclif/command");
const fs_1 = require("fs");
const index_1 = require("../index");
const index_2 = require("../index");
const chalk = require('chalk');
class Extract extends command_1.Command {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const { args, flags } = this.parse(Extract);
            if (flags.out)
                this.log(chalk.bold.keyword('green')('  🌏  Loading polygon...'));
            var inFile = args.file;
            var content = fs_1.readFileSync(inFile);
            var polygon = JSON.parse(content.toLocaleString());
            var outFile = flags.out;
            if (!outFile)
                outFile = inFile;
            if (outFile.toLocaleLowerCase().endsWith(".geojson"))
                outFile = outFile.split(".").slice(0, -1).join(".");
            this.log(chalk.bold.keyword('green')('  🗄️  Loading SharedStreets tiles...'));
            var params = new index_1.TilePathParams();
            params.source = flags['tile-source'];
            params.tileHierarchy = flags['tile-hierarchy'];
            var tileIndex = new index_2.TileIndex();
            this.log(chalk.bold.keyword('green')('  🔍  Searching data...'));
            if (flags.metadata)
                tileIndex.addTileType(index_1.TileType.METADATA);
            var data = yield tileIndex.intersects(polygon, index_1.TileType.GEOMETRY, 0, params);
            for (var feature of data.features) {
                var geometryProperties = tileIndex.objectIndex.get(feature.properties.id);
                feature.properties = geometryProperties;
                if (flags.metadata) {
                    feature.properties.metadata = tileIndex.metadataIndex.get(feature.properties.id);
                }
            }
            console.log(chalk.bold.keyword('blue')('  ✏️  Writing ' + data.features.length + ' features to: ' + outFile + '.out.geojson'));
            var jsonOut = JSON.stringify(data);
            fs_1.writeFileSync(outFile + '.out.geojson', jsonOut);
            if (flags['tiles']) {
                var tiles = Array.from(tileIndex.tiles.values());
                console.log(chalk.bold.keyword('blue')('  ✏️  Writing ' + tiles.length + ' tile paths to: ' + outFile + '.tiles.txt'));
                fs_1.writeFileSync(outFile + '.tiles.txt', tiles.join('\n'));
            }
        });
    }
}
Extract.description = 'extracts SharedStreets streets using polygon boundary and returns GeoJSON output of all intersecting features';
Extract.examples = [
    `$ shst extract polygon.geojson --out=output.geojson
  🌏 Loading polygon...
  🗄️ Loading SharedStreets tiles...
  🔍 Searching data...
    `,
];
Extract.flags = {
    help: command_1.flags.help({ char: 'h' }),
    out: command_1.flags.string({ char: 'o', description: 'output file' }),
    'tile-source': command_1.flags.string({ description: 'SharedStreets tile source', default: 'osm/planet-181224' }),
    'tile-hierarchy': command_1.flags.integer({ description: 'SharedStreets tile hierarchy', default: 6 }),
    metadata: command_1.flags.boolean({ description: 'Include SharedStreets OpenStreetMap metadata in output', default: false }),
    tiles: command_1.flags.boolean({ description: 'Export list of tiles intersecting with bounding box', default: false })
};
Extract.args = [{ name: 'file' }];
exports.default = Extract;
