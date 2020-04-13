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
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const path = require('path');
function resolveHome(filepath) {
    if (filepath[0] === '~') {
        return path.join(process.env.HOME, filepath.slice(1));
    }
    console.log(filepath);
    return filepath;
}
exports.resolveHome = resolveHome;
function checkStatus(res) {
    if (res.ok) { // res.status >= 200 && res.status < 300
        return res;
    }
    else {
        throw "file not found";
    }
}
function getJson(url) {
    return __awaiter(this, void 0, void 0, function* () {
        var data = yield node_fetch_1.default(url, {
            method: 'GET'
        });
        checkStatus(data);
        return data.json();
    });
}
exports.getJson = getJson;
function getPbf(url) {
    return __awaiter(this, void 0, void 0, function* () {
        var data = yield node_fetch_1.default(url, {
            method: 'GET'
        });
        checkStatus(data);
        return new Uint8Array(yield data.buffer());
    });
}
exports.getPbf = getPbf;
function rmse(values) {
    var sum = 0;
    for (var value of values) {
        sum = sum + Math.pow(value, 2);
    }
    var mean = sum / values.length;
    return Math.sqrt(mean);
}
exports.rmse = rmse;
