"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};

// node_modules/chardet/lib/fs/node.js
var require_node = __commonJS({
  "node_modules/chardet/lib/fs/node.js"(exports2, module2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    var fsModule;
    exports2.default = () => {
      if (typeof module2 === "object" && typeof module2.exports === "object") {
        fsModule = fsModule ? fsModule : require("fs");
        return fsModule;
      }
      throw new Error("File system is not available");
    };
  }
});

// node_modules/chardet/lib/match.js
var require_match = __commonJS({
  "node_modules/chardet/lib/match.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = (ctx, rec, confidence) => ({
      confidence,
      name: rec.name(ctx),
      lang: rec.language ? rec.language() : void 0
    });
  }
});

// node_modules/chardet/lib/encoding/ascii.js
var require_ascii = __commonJS({
  "node_modules/chardet/lib/encoding/ascii.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    var match_1 = __importDefault(require_match());
    var Ascii = class {
      name() {
        return "ASCII";
      }
      match(det) {
        const input = det.rawInput;
        for (let i = 0; i < det.rawLen; i++) {
          const b = input[i];
          if (b < 32 || b > 126) {
            return (0, match_1.default)(det, this, 0);
          }
        }
        return (0, match_1.default)(det, this, 100);
      }
    };
    exports2.default = Ascii;
  }
});

// node_modules/chardet/lib/encoding/utf8.js
var require_utf8 = __commonJS({
  "node_modules/chardet/lib/encoding/utf8.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    var match_1 = __importDefault(require_match());
    var Utf8 = class {
      name() {
        return "UTF-8";
      }
      match(det) {
        let hasBOM = false, numValid = 0, numInvalid = 0, trailBytes = 0, confidence;
        const input = det.rawInput;
        if (det.rawLen >= 3 && (input[0] & 255) == 239 && (input[1] & 255) == 187 && (input[2] & 255) == 191) {
          hasBOM = true;
        }
        for (let i = 0; i < det.rawLen; i++) {
          const b = input[i];
          if ((b & 128) == 0)
            continue;
          if ((b & 224) == 192) {
            trailBytes = 1;
          } else if ((b & 240) == 224) {
            trailBytes = 2;
          } else if ((b & 248) == 240) {
            trailBytes = 3;
          } else {
            numInvalid++;
            if (numInvalid > 5)
              break;
            trailBytes = 0;
          }
          for (; ; ) {
            i++;
            if (i >= det.rawLen)
              break;
            if ((input[i] & 192) != 128) {
              numInvalid++;
              break;
            }
            if (--trailBytes == 0) {
              numValid++;
              break;
            }
          }
        }
        confidence = 0;
        if (hasBOM && numInvalid == 0)
          confidence = 100;
        else if (hasBOM && numValid > numInvalid * 10)
          confidence = 80;
        else if (numValid > 3 && numInvalid == 0)
          confidence = 100;
        else if (numValid > 0 && numInvalid == 0)
          confidence = 80;
        else if (numValid == 0 && numInvalid == 0)
          confidence = 10;
        else if (numValid > numInvalid * 10)
          confidence = 25;
        else
          return null;
        return (0, match_1.default)(det, this, confidence);
      }
    };
    exports2.default = Utf8;
  }
});

// node_modules/chardet/lib/encoding/unicode.js
var require_unicode = __commonJS({
  "node_modules/chardet/lib/encoding/unicode.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.UTF_32LE = exports2.UTF_32BE = exports2.UTF_16LE = exports2.UTF_16BE = void 0;
    var match_1 = __importDefault(require_match());
    var UTF_16BE = class {
      name() {
        return "UTF-16BE";
      }
      match(det) {
        const input = det.rawInput;
        if (input.length >= 2 && (input[0] & 255) == 254 && (input[1] & 255) == 255) {
          return (0, match_1.default)(det, this, 100);
        }
        return null;
      }
    };
    exports2.UTF_16BE = UTF_16BE;
    var UTF_16LE = class {
      name() {
        return "UTF-16LE";
      }
      match(det) {
        const input = det.rawInput;
        if (input.length >= 2 && (input[0] & 255) == 255 && (input[1] & 255) == 254) {
          if (input.length >= 4 && input[2] == 0 && input[3] == 0) {
            return null;
          }
          return (0, match_1.default)(det, this, 100);
        }
        return null;
      }
    };
    exports2.UTF_16LE = UTF_16LE;
    var UTF_32 = class {
      name() {
        return "UTF-32";
      }
      getChar(_input, _index) {
        return -1;
      }
      match(det) {
        let numValid = 0, numInvalid = 0, hasBOM = false, confidence = 0;
        const limit = det.rawLen / 4 * 4;
        const input = det.rawInput;
        if (limit == 0) {
          return null;
        }
        if (this.getChar(input, 0) == 65279) {
          hasBOM = true;
        }
        for (let i = 0; i < limit; i += 4) {
          const ch = this.getChar(input, i);
          if (ch < 0 || ch >= 1114111 || ch >= 55296 && ch <= 57343) {
            numInvalid += 1;
          } else {
            numValid += 1;
          }
        }
        if (hasBOM && numInvalid == 0) {
          confidence = 100;
        } else if (hasBOM && numValid > numInvalid * 10) {
          confidence = 80;
        } else if (numValid > 3 && numInvalid == 0) {
          confidence = 100;
        } else if (numValid > 0 && numInvalid == 0) {
          confidence = 80;
        } else if (numValid > numInvalid * 10) {
          confidence = 25;
        }
        return confidence == 0 ? null : (0, match_1.default)(det, this, confidence);
      }
    };
    var UTF_32BE = class extends UTF_32 {
      name() {
        return "UTF-32BE";
      }
      getChar(input, index) {
        return (input[index + 0] & 255) << 24 | (input[index + 1] & 255) << 16 | (input[index + 2] & 255) << 8 | input[index + 3] & 255;
      }
    };
    exports2.UTF_32BE = UTF_32BE;
    var UTF_32LE = class extends UTF_32 {
      name() {
        return "UTF-32LE";
      }
      getChar(input, index) {
        return (input[index + 3] & 255) << 24 | (input[index + 2] & 255) << 16 | (input[index + 1] & 255) << 8 | input[index + 0] & 255;
      }
    };
    exports2.UTF_32LE = UTF_32LE;
  }
});

// node_modules/chardet/lib/encoding/mbcs.js
var require_mbcs = __commonJS({
  "node_modules/chardet/lib/encoding/mbcs.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.gb_18030 = exports2.euc_kr = exports2.euc_jp = exports2.big5 = exports2.sjis = void 0;
    var match_1 = __importDefault(require_match());
    function binarySearch(arr, searchValue) {
      const find = (arr2, searchValue2, left, right) => {
        if (right < left)
          return -1;
        const mid = Math.floor(left + right >>> 1);
        if (searchValue2 > arr2[mid])
          return find(arr2, searchValue2, mid + 1, right);
        if (searchValue2 < arr2[mid])
          return find(arr2, searchValue2, left, mid - 1);
        return mid;
      };
      return find(arr, searchValue, 0, arr.length - 1);
    }
    var IteratedChar = class {
      constructor() {
        this.charValue = 0;
        this.index = 0;
        this.nextIndex = 0;
        this.error = false;
        this.done = false;
      }
      reset() {
        this.charValue = 0;
        this.index = -1;
        this.nextIndex = 0;
        this.error = false;
        this.done = false;
      }
      nextByte(det) {
        if (this.nextIndex >= det.rawLen) {
          this.done = true;
          return -1;
        }
        const byteValue = det.rawInput[this.nextIndex++] & 255;
        return byteValue;
      }
    };
    var mbcs = class {
      constructor() {
        this.commonChars = [];
      }
      name() {
        return "mbcs";
      }
      match(det) {
        let doubleByteCharCount = 0, commonCharCount = 0, badCharCount = 0, totalCharCount = 0, confidence = 0;
        const iter = new IteratedChar();
        detectBlock: {
          for (iter.reset(); this.nextChar(iter, det); ) {
            totalCharCount++;
            if (iter.error) {
              badCharCount++;
            } else {
              const cv = iter.charValue & 4294967295;
              if (cv > 255) {
                doubleByteCharCount++;
                if (this.commonChars != null) {
                  if (binarySearch(this.commonChars, cv) >= 0) {
                    commonCharCount++;
                  }
                }
              }
            }
            if (badCharCount >= 2 && badCharCount * 5 >= doubleByteCharCount) {
              break detectBlock;
            }
          }
          if (doubleByteCharCount <= 10 && badCharCount == 0) {
            if (doubleByteCharCount == 0 && totalCharCount < 10) {
              confidence = 0;
            } else {
              confidence = 10;
            }
            break detectBlock;
          }
          if (doubleByteCharCount < 20 * badCharCount) {
            confidence = 0;
            break detectBlock;
          }
          if (this.commonChars == null) {
            confidence = 30 + doubleByteCharCount - 20 * badCharCount;
            if (confidence > 100) {
              confidence = 100;
            }
          } else {
            const maxVal = Math.log(doubleByteCharCount / 4);
            const scaleFactor = 90 / maxVal;
            confidence = Math.floor(Math.log(commonCharCount + 1) * scaleFactor + 10);
            confidence = Math.min(confidence, 100);
          }
        }
        return confidence == 0 ? null : (0, match_1.default)(det, this, confidence);
      }
      nextChar(_iter, _det) {
        return true;
      }
    };
    var sjis = class extends mbcs {
      constructor() {
        super(...arguments);
        this.commonChars = [
          33088,
          33089,
          33090,
          33093,
          33115,
          33129,
          33130,
          33141,
          33142,
          33440,
          33442,
          33444,
          33449,
          33450,
          33451,
          33453,
          33455,
          33457,
          33459,
          33461,
          33463,
          33469,
          33470,
          33473,
          33476,
          33477,
          33478,
          33480,
          33481,
          33484,
          33485,
          33500,
          33504,
          33511,
          33512,
          33513,
          33514,
          33520,
          33521,
          33601,
          33603,
          33614,
          33615,
          33624,
          33630,
          33634,
          33639,
          33653,
          33654,
          33673,
          33674,
          33675,
          33677,
          33683,
          36502,
          37882,
          38314
        ];
      }
      name() {
        return "Shift_JIS";
      }
      language() {
        return "ja";
      }
      nextChar(iter, det) {
        iter.index = iter.nextIndex;
        iter.error = false;
        const firstByte = iter.charValue = iter.nextByte(det);
        if (firstByte < 0)
          return false;
        if (firstByte <= 127 || firstByte > 160 && firstByte <= 223)
          return true;
        const secondByte = iter.nextByte(det);
        if (secondByte < 0)
          return false;
        iter.charValue = firstByte << 8 | secondByte;
        if (!(secondByte >= 64 && secondByte <= 127 || secondByte >= 128 && secondByte <= 255)) {
          iter.error = true;
        }
        return true;
      }
    };
    exports2.sjis = sjis;
    var big5 = class extends mbcs {
      constructor() {
        super(...arguments);
        this.commonChars = [
          41280,
          41281,
          41282,
          41283,
          41287,
          41289,
          41333,
          41334,
          42048,
          42054,
          42055,
          42056,
          42065,
          42068,
          42071,
          42084,
          42090,
          42092,
          42103,
          42147,
          42148,
          42151,
          42177,
          42190,
          42193,
          42207,
          42216,
          42237,
          42304,
          42312,
          42328,
          42345,
          42445,
          42471,
          42583,
          42593,
          42594,
          42600,
          42608,
          42664,
          42675,
          42681,
          42707,
          42715,
          42726,
          42738,
          42816,
          42833,
          42841,
          42970,
          43171,
          43173,
          43181,
          43217,
          43219,
          43236,
          43260,
          43456,
          43474,
          43507,
          43627,
          43706,
          43710,
          43724,
          43772,
          44103,
          44111,
          44208,
          44242,
          44377,
          44745,
          45024,
          45290,
          45423,
          45747,
          45764,
          45935,
          46156,
          46158,
          46412,
          46501,
          46525,
          46544,
          46552,
          46705,
          47085,
          47207,
          47428,
          47832,
          47940,
          48033,
          48593,
          49860,
          50105,
          50240,
          50271
        ];
      }
      name() {
        return "Big5";
      }
      language() {
        return "zh";
      }
      nextChar(iter, det) {
        iter.index = iter.nextIndex;
        iter.error = false;
        const firstByte = iter.charValue = iter.nextByte(det);
        if (firstByte < 0)
          return false;
        if (firstByte <= 127 || firstByte == 255)
          return true;
        const secondByte = iter.nextByte(det);
        if (secondByte < 0)
          return false;
        iter.charValue = iter.charValue << 8 | secondByte;
        if (secondByte < 64 || secondByte == 127 || secondByte == 255)
          iter.error = true;
        return true;
      }
    };
    exports2.big5 = big5;
    function eucNextChar(iter, det) {
      iter.index = iter.nextIndex;
      iter.error = false;
      let firstByte = 0;
      let secondByte = 0;
      let thirdByte = 0;
      buildChar: {
        firstByte = iter.charValue = iter.nextByte(det);
        if (firstByte < 0) {
          iter.done = true;
          break buildChar;
        }
        if (firstByte <= 141) {
          break buildChar;
        }
        secondByte = iter.nextByte(det);
        iter.charValue = iter.charValue << 8 | secondByte;
        if (firstByte >= 161 && firstByte <= 254) {
          if (secondByte < 161) {
            iter.error = true;
          }
          break buildChar;
        }
        if (firstByte == 142) {
          if (secondByte < 161) {
            iter.error = true;
          }
          break buildChar;
        }
        if (firstByte == 143) {
          thirdByte = iter.nextByte(det);
          iter.charValue = iter.charValue << 8 | thirdByte;
          if (thirdByte < 161) {
            iter.error = true;
          }
        }
      }
      return iter.done == false;
    }
    var euc_jp = class extends mbcs {
      constructor() {
        super(...arguments);
        this.commonChars = [
          41377,
          41378,
          41379,
          41382,
          41404,
          41418,
          41419,
          41430,
          41431,
          42146,
          42148,
          42150,
          42152,
          42154,
          42155,
          42156,
          42157,
          42159,
          42161,
          42163,
          42165,
          42167,
          42169,
          42171,
          42173,
          42175,
          42176,
          42177,
          42179,
          42180,
          42182,
          42183,
          42184,
          42185,
          42186,
          42187,
          42190,
          42191,
          42192,
          42206,
          42207,
          42209,
          42210,
          42212,
          42216,
          42217,
          42218,
          42219,
          42220,
          42223,
          42226,
          42227,
          42402,
          42403,
          42404,
          42406,
          42407,
          42410,
          42413,
          42415,
          42416,
          42419,
          42421,
          42423,
          42424,
          42425,
          42431,
          42435,
          42438,
          42439,
          42440,
          42441,
          42443,
          42448,
          42453,
          42454,
          42455,
          42462,
          42464,
          42465,
          42469,
          42473,
          42474,
          42475,
          42476,
          42477,
          42483,
          47273,
          47572,
          47854,
          48072,
          48880,
          49079,
          50410,
          50940,
          51133,
          51896,
          51955,
          52188,
          52689
        ];
        this.nextChar = eucNextChar;
      }
      name() {
        return "EUC-JP";
      }
      language() {
        return "ja";
      }
    };
    exports2.euc_jp = euc_jp;
    var euc_kr = class extends mbcs {
      constructor() {
        super(...arguments);
        this.commonChars = [
          45217,
          45235,
          45253,
          45261,
          45268,
          45286,
          45293,
          45304,
          45306,
          45308,
          45496,
          45497,
          45511,
          45527,
          45538,
          45994,
          46011,
          46274,
          46287,
          46297,
          46315,
          46501,
          46517,
          46527,
          46535,
          46569,
          46835,
          47023,
          47042,
          47054,
          47270,
          47278,
          47286,
          47288,
          47291,
          47337,
          47531,
          47534,
          47564,
          47566,
          47613,
          47800,
          47822,
          47824,
          47857,
          48103,
          48115,
          48125,
          48301,
          48314,
          48338,
          48374,
          48570,
          48576,
          48579,
          48581,
          48838,
          48840,
          48863,
          48878,
          48888,
          48890,
          49057,
          49065,
          49088,
          49124,
          49131,
          49132,
          49144,
          49319,
          49327,
          49336,
          49338,
          49339,
          49341,
          49351,
          49356,
          49358,
          49359,
          49366,
          49370,
          49381,
          49403,
          49404,
          49572,
          49574,
          49590,
          49622,
          49631,
          49654,
          49656,
          50337,
          50637,
          50862,
          51151,
          51153,
          51154,
          51160,
          51173,
          51373
        ];
        this.nextChar = eucNextChar;
      }
      name() {
        return "EUC-KR";
      }
      language() {
        return "ko";
      }
    };
    exports2.euc_kr = euc_kr;
    var gb_18030 = class extends mbcs {
      constructor() {
        super(...arguments);
        this.commonChars = [
          41377,
          41378,
          41379,
          41380,
          41392,
          41393,
          41457,
          41459,
          41889,
          41900,
          41914,
          45480,
          45496,
          45502,
          45755,
          46025,
          46070,
          46323,
          46525,
          46532,
          46563,
          46767,
          46804,
          46816,
          47010,
          47016,
          47037,
          47062,
          47069,
          47284,
          47327,
          47350,
          47531,
          47561,
          47576,
          47610,
          47613,
          47821,
          48039,
          48086,
          48097,
          48122,
          48316,
          48347,
          48382,
          48588,
          48845,
          48861,
          49076,
          49094,
          49097,
          49332,
          49389,
          49611,
          49883,
          50119,
          50396,
          50410,
          50636,
          50935,
          51192,
          51371,
          51403,
          51413,
          51431,
          51663,
          51706,
          51889,
          51893,
          51911,
          51920,
          51926,
          51957,
          51965,
          52460,
          52728,
          52906,
          52932,
          52946,
          52965,
          53173,
          53186,
          53206,
          53442,
          53445,
          53456,
          53460,
          53671,
          53930,
          53938,
          53941,
          53947,
          53972,
          54211,
          54224,
          54269,
          54466,
          54490,
          54754,
          54992
        ];
      }
      name() {
        return "GB18030";
      }
      language() {
        return "zh";
      }
      nextChar(iter, det) {
        iter.index = iter.nextIndex;
        iter.error = false;
        let firstByte = 0;
        let secondByte = 0;
        let thirdByte = 0;
        let fourthByte = 0;
        buildChar: {
          firstByte = iter.charValue = iter.nextByte(det);
          if (firstByte < 0) {
            iter.done = true;
            break buildChar;
          }
          if (firstByte <= 128) {
            break buildChar;
          }
          secondByte = iter.nextByte(det);
          iter.charValue = iter.charValue << 8 | secondByte;
          if (firstByte >= 129 && firstByte <= 254) {
            if (secondByte >= 64 && secondByte <= 126 || secondByte >= 80 && secondByte <= 254) {
              break buildChar;
            }
            if (secondByte >= 48 && secondByte <= 57) {
              thirdByte = iter.nextByte(det);
              if (thirdByte >= 129 && thirdByte <= 254) {
                fourthByte = iter.nextByte(det);
                if (fourthByte >= 48 && fourthByte <= 57) {
                  iter.charValue = iter.charValue << 16 | thirdByte << 8 | fourthByte;
                  break buildChar;
                }
              }
            }
            iter.error = true;
            break buildChar;
          }
        }
        return iter.done == false;
      }
    };
    exports2.gb_18030 = gb_18030;
  }
});

// node_modules/chardet/lib/encoding/sbcs.js
var require_sbcs = __commonJS({
  "node_modules/chardet/lib/encoding/sbcs.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.KOI8_R = exports2.windows_1256 = exports2.windows_1251 = exports2.ISO_8859_9 = exports2.ISO_8859_8 = exports2.ISO_8859_7 = exports2.ISO_8859_6 = exports2.ISO_8859_5 = exports2.ISO_8859_2 = exports2.ISO_8859_1 = void 0;
    var match_1 = __importDefault(require_match());
    var N_GRAM_MASK = 16777215;
    var NGramParser = class {
      constructor(theNgramList, theByteMap) {
        this.byteIndex = 0;
        this.ngram = 0;
        this.ngramCount = 0;
        this.hitCount = 0;
        this.spaceChar = 32;
        this.ngramList = theNgramList;
        this.byteMap = theByteMap;
      }
      search(table, value) {
        let index = 0;
        if (table[index + 32] <= value)
          index += 32;
        if (table[index + 16] <= value)
          index += 16;
        if (table[index + 8] <= value)
          index += 8;
        if (table[index + 4] <= value)
          index += 4;
        if (table[index + 2] <= value)
          index += 2;
        if (table[index + 1] <= value)
          index += 1;
        if (table[index] > value)
          index -= 1;
        if (index < 0 || table[index] != value)
          return -1;
        return index;
      }
      lookup(thisNgram) {
        this.ngramCount += 1;
        if (this.search(this.ngramList, thisNgram) >= 0) {
          this.hitCount += 1;
        }
      }
      addByte(b) {
        this.ngram = (this.ngram << 8) + (b & 255) & N_GRAM_MASK;
        this.lookup(this.ngram);
      }
      nextByte(det) {
        if (this.byteIndex >= det.inputLen)
          return -1;
        return det.inputBytes[this.byteIndex++] & 255;
      }
      parse(det, spaceCh) {
        let b, ignoreSpace = false;
        this.spaceChar = spaceCh;
        while ((b = this.nextByte(det)) >= 0) {
          const mb = this.byteMap[b];
          if (mb != 0) {
            if (!(mb == this.spaceChar && ignoreSpace)) {
              this.addByte(mb);
            }
            ignoreSpace = mb == this.spaceChar;
          }
        }
        this.addByte(this.spaceChar);
        const rawPercent = this.hitCount / this.ngramCount;
        if (rawPercent > 0.33)
          return 98;
        return Math.floor(rawPercent * 300);
      }
    };
    var NGramsPlusLang = class {
      constructor(la, ng) {
        this.fLang = la;
        this.fNGrams = ng;
      }
    };
    var isFlatNgrams = (val) => Array.isArray(val) && isFinite(val[0]);
    var sbcs = class {
      constructor() {
        this.spaceChar = 32;
        this.nGramLang = void 0;
      }
      ngrams() {
        return [];
      }
      byteMap() {
        return [];
      }
      name(_input) {
        return "sbcs";
      }
      language() {
        return this.nGramLang;
      }
      match(det) {
        this.nGramLang = void 0;
        const ngrams = this.ngrams();
        if (isFlatNgrams(ngrams)) {
          const parser = new NGramParser(ngrams, this.byteMap());
          const confidence = parser.parse(det, this.spaceChar);
          return confidence <= 0 ? null : (0, match_1.default)(det, this, confidence);
        }
        let bestConfidence = -1;
        for (let i = ngrams.length - 1; i >= 0; i--) {
          const ngl = ngrams[i];
          const parser = new NGramParser(ngl.fNGrams, this.byteMap());
          const confidence = parser.parse(det, this.spaceChar);
          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            this.nGramLang = ngl.fLang;
          }
        }
        return bestConfidence <= 0 ? null : (0, match_1.default)(det, this, bestConfidence);
      }
    };
    var ISO_8859_1 = class extends sbcs {
      byteMap() {
        return [
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          0,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          170,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          181,
          32,
          32,
          32,
          32,
          186,
          32,
          32,
          32,
          32,
          32,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          242,
          243,
          244,
          245,
          246,
          32,
          248,
          249,
          250,
          251,
          252,
          253,
          254,
          223,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          242,
          243,
          244,
          245,
          246,
          32,
          248,
          249,
          250,
          251,
          252,
          253,
          254,
          255
        ];
      }
      ngrams() {
        return [
          new NGramsPlusLang("da", [
            2122086,
            2122100,
            2122853,
            2123118,
            2123122,
            2123375,
            2123873,
            2124064,
            2125157,
            2125671,
            2126053,
            2126697,
            2126708,
            2126953,
            2127465,
            6383136,
            6385184,
            6385252,
            6386208,
            6386720,
            6579488,
            6579566,
            6579570,
            6579572,
            6627443,
            6644768,
            6644837,
            6647328,
            6647396,
            6648352,
            6648421,
            6648608,
            6648864,
            6713202,
            6776096,
            6776174,
            6776178,
            6907749,
            6908960,
            6909543,
            7038240,
            7039845,
            7103858,
            7104871,
            7105637,
            7169380,
            7234661,
            7234848,
            7235360,
            7235429,
            7300896,
            7302432,
            7303712,
            7398688,
            7479396,
            7479397,
            7479411,
            7496992,
            7566437,
            7610483,
            7628064,
            7628146,
            7629164,
            7759218
          ]),
          new NGramsPlusLang("de", [
            2122094,
            2122101,
            2122341,
            2122849,
            2122853,
            2122857,
            2123113,
            2123621,
            2123873,
            2124142,
            2125161,
            2126691,
            2126693,
            2127214,
            2127461,
            2127471,
            2127717,
            2128501,
            6448498,
            6514720,
            6514789,
            6514804,
            6578547,
            6579566,
            6579570,
            6580581,
            6627428,
            6627443,
            6646126,
            6646132,
            6647328,
            6648352,
            6648608,
            6776174,
            6841710,
            6845472,
            6906728,
            6907168,
            6909472,
            6909541,
            6911008,
            7104867,
            7105637,
            7217249,
            7217252,
            7217267,
            7234592,
            7234661,
            7234848,
            7235360,
            7235429,
            7238757,
            7479396,
            7496805,
            7497065,
            7562088,
            7566437,
            7610468,
            7628064,
            7628142,
            7628146,
            7695972,
            7695975,
            7759218
          ]),
          new NGramsPlusLang("en", [
            2122016,
            2122094,
            2122341,
            2122607,
            2123375,
            2123873,
            2123877,
            2124142,
            2125153,
            2125670,
            2125938,
            2126437,
            2126689,
            2126708,
            2126952,
            2126959,
            2127720,
            6383972,
            6384672,
            6385184,
            6385252,
            6386464,
            6386720,
            6386789,
            6386793,
            6561889,
            6561908,
            6627425,
            6627443,
            6627444,
            6644768,
            6647412,
            6648352,
            6648608,
            6713202,
            6840692,
            6841632,
            6841714,
            6906912,
            6909472,
            6909543,
            6909806,
            6910752,
            7217249,
            7217268,
            7234592,
            7235360,
            7238688,
            7300640,
            7302688,
            7303712,
            7496992,
            7500576,
            7544929,
            7544948,
            7561577,
            7566368,
            7610484,
            7628146,
            7628897,
            7628901,
            7629167,
            7630624,
            7631648
          ]),
          new NGramsPlusLang("es", [
            2122016,
            2122593,
            2122607,
            2122853,
            2123116,
            2123118,
            2123123,
            2124142,
            2124897,
            2124911,
            2125921,
            2125935,
            2125938,
            2126197,
            2126437,
            2126693,
            2127214,
            2128160,
            6365283,
            6365284,
            6365285,
            6365292,
            6365296,
            6382441,
            6382703,
            6384672,
            6386208,
            6386464,
            6515187,
            6516590,
            6579488,
            6579564,
            6582048,
            6627428,
            6627429,
            6627436,
            6646816,
            6647328,
            6647412,
            6648608,
            6648692,
            6907246,
            6943598,
            7102752,
            7106419,
            7217253,
            7238757,
            7282788,
            7282789,
            7302688,
            7303712,
            7303968,
            7364978,
            7435621,
            7495968,
            7497075,
            7544932,
            7544933,
            7544944,
            7562528,
            7628064,
            7630624,
            7693600,
            15953440
          ]),
          new NGramsPlusLang("fr", [
            2122101,
            2122607,
            2122849,
            2122853,
            2122869,
            2123118,
            2123124,
            2124897,
            2124901,
            2125921,
            2125935,
            2125938,
            2126197,
            2126693,
            2126703,
            2127214,
            2154528,
            6385268,
            6386793,
            6513952,
            6516590,
            6579488,
            6579571,
            6583584,
            6627425,
            6627427,
            6627428,
            6627429,
            6627436,
            6627440,
            6627443,
            6647328,
            6647412,
            6648352,
            6648608,
            6648864,
            6649202,
            6909806,
            6910752,
            6911008,
            7102752,
            7103776,
            7103859,
            7169390,
            7217252,
            7234848,
            7238432,
            7238688,
            7302688,
            7302772,
            7304562,
            7435621,
            7479404,
            7496992,
            7544929,
            7544932,
            7544933,
            7544940,
            7544944,
            7610468,
            7628064,
            7629167,
            7693600,
            7696928
          ]),
          new NGramsPlusLang("it", [
            2122092,
            2122600,
            2122607,
            2122853,
            2122857,
            2123040,
            2124140,
            2124142,
            2124897,
            2125925,
            2125938,
            2127214,
            6365283,
            6365284,
            6365296,
            6365299,
            6386799,
            6514789,
            6516590,
            6579564,
            6580512,
            6627425,
            6627427,
            6627428,
            6627433,
            6627436,
            6627440,
            6627443,
            6646816,
            6646892,
            6647412,
            6648352,
            6841632,
            6889569,
            6889571,
            6889572,
            6889587,
            6906144,
            6908960,
            6909472,
            6909806,
            7102752,
            7103776,
            7104800,
            7105633,
            7234848,
            7235872,
            7237408,
            7238757,
            7282785,
            7282788,
            7282793,
            7282803,
            7302688,
            7302757,
            7366002,
            7495968,
            7496992,
            7563552,
            7627040,
            7628064,
            7629088,
            7630624,
            8022383
          ]),
          new NGramsPlusLang("nl", [
            2122092,
            2122341,
            2122849,
            2122853,
            2122857,
            2123109,
            2123118,
            2123621,
            2123877,
            2124142,
            2125153,
            2125157,
            2125680,
            2126949,
            2127457,
            2127461,
            2127471,
            2127717,
            2128489,
            6381934,
            6381938,
            6385184,
            6385252,
            6386208,
            6386720,
            6514804,
            6579488,
            6579566,
            6579570,
            6627426,
            6627446,
            6645102,
            6645106,
            6647328,
            6648352,
            6648435,
            6648864,
            6776174,
            6841716,
            6907168,
            6909472,
            6909543,
            6910752,
            7217250,
            7217252,
            7217253,
            7217256,
            7217263,
            7217270,
            7234661,
            7235360,
            7302756,
            7303026,
            7303200,
            7303712,
            7562088,
            7566437,
            7610468,
            7628064,
            7628142,
            7628146,
            7758190,
            7759218,
            7761775
          ]),
          new NGramsPlusLang("no", [
            2122100,
            2122102,
            2122853,
            2123118,
            2123122,
            2123375,
            2123873,
            2124064,
            2125157,
            2125671,
            2126053,
            2126693,
            2126699,
            2126703,
            2126708,
            2126953,
            2127465,
            2155808,
            6385252,
            6386208,
            6386720,
            6579488,
            6579566,
            6579572,
            6627443,
            6644768,
            6647328,
            6647397,
            6648352,
            6648421,
            6648864,
            6648948,
            6713202,
            6776174,
            6908779,
            6908960,
            6909543,
            7038240,
            7039845,
            7103776,
            7105637,
            7169380,
            7169390,
            7217267,
            7234848,
            7235360,
            7235429,
            7237221,
            7300896,
            7302432,
            7303712,
            7398688,
            7479411,
            7496992,
            7565165,
            7566437,
            7610483,
            7628064,
            7628142,
            7628146,
            7629164,
            7631904,
            7631973,
            7759218
          ]),
          new NGramsPlusLang("pt", [
            2122016,
            2122607,
            2122849,
            2122853,
            2122863,
            2123040,
            2123123,
            2125153,
            2125423,
            2125600,
            2125921,
            2125935,
            2125938,
            2126197,
            2126437,
            2126693,
            2127213,
            6365281,
            6365283,
            6365284,
            6365296,
            6382693,
            6382703,
            6384672,
            6386208,
            6386273,
            6386464,
            6516589,
            6516590,
            6578464,
            6579488,
            6582048,
            6582131,
            6627425,
            6627428,
            6647072,
            6647412,
            6648608,
            6648692,
            6906144,
            6906721,
            7169390,
            7238757,
            7238767,
            7282785,
            7282787,
            7282788,
            7282789,
            7282800,
            7303968,
            7364978,
            7435621,
            7495968,
            7497075,
            7544929,
            7544932,
            7544933,
            7544944,
            7566433,
            7628064,
            7630624,
            7693600,
            14905120,
            15197039
          ]),
          new NGramsPlusLang("sv", [
            2122100,
            2122102,
            2122853,
            2123118,
            2123510,
            2123873,
            2124064,
            2124142,
            2124655,
            2125157,
            2125667,
            2126053,
            2126699,
            2126703,
            2126708,
            2126953,
            2127457,
            2127465,
            2155634,
            6382693,
            6385184,
            6385252,
            6386208,
            6386804,
            6514720,
            6579488,
            6579566,
            6579570,
            6579572,
            6644768,
            6647328,
            6648352,
            6648864,
            6747762,
            6776174,
            6909036,
            6909543,
            7037216,
            7105568,
            7169380,
            7217267,
            7233824,
            7234661,
            7235360,
            7235429,
            7235950,
            7299944,
            7302432,
            7302688,
            7398688,
            7479393,
            7479411,
            7495968,
            7564129,
            7565165,
            7610483,
            7627040,
            7628064,
            7628146,
            7629164,
            7631904,
            7758194,
            14971424,
            16151072
          ])
        ];
      }
      name(input) {
        return input && input.c1Bytes ? "windows-1252" : "ISO-8859-1";
      }
    };
    exports2.ISO_8859_1 = ISO_8859_1;
    var ISO_8859_2 = class extends sbcs {
      byteMap() {
        return [
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          0,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          177,
          32,
          179,
          32,
          181,
          182,
          32,
          32,
          185,
          186,
          187,
          188,
          32,
          190,
          191,
          32,
          177,
          32,
          179,
          32,
          181,
          182,
          183,
          32,
          185,
          186,
          187,
          188,
          32,
          190,
          191,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          242,
          243,
          244,
          245,
          246,
          32,
          248,
          249,
          250,
          251,
          252,
          253,
          254,
          223,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          242,
          243,
          244,
          245,
          246,
          32,
          248,
          249,
          250,
          251,
          252,
          253,
          254,
          32
        ];
      }
      ngrams() {
        return [
          new NGramsPlusLang("cs", [
            2122016,
            2122361,
            2122863,
            2124389,
            2125409,
            2125413,
            2125600,
            2125668,
            2125935,
            2125938,
            2126072,
            2126447,
            2126693,
            2126703,
            2126708,
            2126959,
            2127392,
            2127481,
            2128481,
            6365296,
            6513952,
            6514720,
            6627440,
            6627443,
            6627446,
            6647072,
            6647533,
            6844192,
            6844260,
            6910836,
            6972704,
            7042149,
            7103776,
            7104800,
            7233824,
            7268640,
            7269408,
            7269664,
            7282800,
            7300206,
            7301737,
            7304052,
            7304480,
            7304801,
            7368548,
            7368554,
            7369327,
            7403621,
            7562528,
            7565173,
            7566433,
            7566441,
            7566446,
            7628146,
            7630573,
            7630624,
            7676016,
            12477728,
            14773997,
            15296623,
            15540336,
            15540339,
            15559968,
            16278884
          ]),
          new NGramsPlusLang("hu", [
            2122016,
            2122106,
            2122341,
            2123111,
            2123116,
            2123365,
            2123873,
            2123887,
            2124147,
            2124645,
            2124649,
            2124790,
            2124901,
            2125153,
            2125157,
            2125161,
            2125413,
            2126714,
            2126949,
            2156915,
            6365281,
            6365291,
            6365293,
            6365299,
            6384416,
            6385184,
            6388256,
            6447470,
            6448494,
            6645625,
            6646560,
            6646816,
            6646885,
            6647072,
            6647328,
            6648421,
            6648864,
            6648933,
            6648948,
            6781216,
            6844263,
            6909556,
            6910752,
            7020641,
            7075450,
            7169383,
            7170414,
            7217249,
            7233899,
            7234923,
            7234925,
            7238688,
            7300985,
            7544929,
            7567973,
            7567988,
            7568097,
            7596391,
            7610465,
            7631904,
            7659891,
            8021362,
            14773792,
            15299360
          ]),
          new NGramsPlusLang("pl", [
            2122618,
            2122863,
            2124064,
            2124389,
            2124655,
            2125153,
            2125161,
            2125409,
            2125417,
            2125668,
            2125935,
            2125938,
            2126697,
            2127648,
            2127721,
            2127737,
            2128416,
            2128481,
            6365296,
            6365303,
            6385257,
            6514720,
            6519397,
            6519417,
            6582048,
            6584937,
            6627440,
            6627443,
            6627447,
            6627450,
            6645615,
            6646304,
            6647072,
            6647401,
            6778656,
            6906144,
            6907168,
            6907242,
            7037216,
            7039264,
            7039333,
            7170405,
            7233824,
            7235937,
            7235941,
            7282800,
            7305057,
            7305065,
            7368556,
            7369313,
            7369327,
            7369338,
            7502437,
            7502457,
            7563754,
            7564137,
            7566433,
            7825765,
            7955304,
            7957792,
            8021280,
            8022373,
            8026400,
            15955744
          ]),
          new NGramsPlusLang("ro", [
            2122016,
            2122083,
            2122593,
            2122597,
            2122607,
            2122613,
            2122853,
            2122857,
            2124897,
            2125153,
            2125925,
            2125938,
            2126693,
            2126819,
            2127214,
            2144873,
            2158190,
            6365283,
            6365284,
            6386277,
            6386720,
            6386789,
            6386976,
            6513010,
            6516590,
            6518048,
            6546208,
            6579488,
            6627425,
            6627427,
            6627428,
            6627440,
            6627443,
            6644e3,
            6646048,
            6646885,
            6647412,
            6648692,
            6889569,
            6889571,
            6889572,
            6889584,
            6907168,
            6908192,
            6909472,
            7102752,
            7103776,
            7106418,
            7107945,
            7234848,
            7238770,
            7303712,
            7365998,
            7496992,
            7497057,
            7501088,
            7594784,
            7628064,
            7631477,
            7660320,
            7694624,
            7695392,
            12216608,
            15625760
          ])
        ];
      }
      name(det) {
        return det && det.c1Bytes ? "windows-1250" : "ISO-8859-2";
      }
    };
    exports2.ISO_8859_2 = ISO_8859_2;
    var ISO_8859_5 = class extends sbcs {
      byteMap() {
        return [
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          0,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          241,
          242,
          243,
          244,
          245,
          246,
          247,
          248,
          249,
          250,
          251,
          252,
          32,
          254,
          255,
          208,
          209,
          210,
          211,
          212,
          213,
          214,
          215,
          216,
          217,
          218,
          219,
          220,
          221,
          222,
          223,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          208,
          209,
          210,
          211,
          212,
          213,
          214,
          215,
          216,
          217,
          218,
          219,
          220,
          221,
          222,
          223,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          32,
          241,
          242,
          243,
          244,
          245,
          246,
          247,
          248,
          249,
          250,
          251,
          252,
          32,
          254,
          255
        ];
      }
      ngrams() {
        return [
          2150944,
          2151134,
          2151646,
          2152400,
          2152480,
          2153168,
          2153182,
          2153936,
          2153941,
          2154193,
          2154462,
          2154464,
          2154704,
          2154974,
          2154978,
          2155230,
          2156514,
          2158050,
          13688280,
          13689580,
          13884960,
          14015468,
          14015960,
          14016994,
          14017056,
          14164191,
          14210336,
          14211104,
          14216992,
          14407133,
          14407712,
          14413021,
          14536736,
          14538016,
          14538965,
          14538991,
          14540320,
          14540498,
          14557394,
          14557407,
          14557409,
          14602784,
          14602960,
          14603230,
          14604576,
          14605292,
          14605344,
          14606818,
          14671579,
          14672085,
          14672088,
          14672094,
          14733522,
          14734804,
          14803664,
          14803666,
          14803672,
          14806816,
          14865883,
          14868e3,
          14868192,
          14871584,
          15196894,
          15459616
        ];
      }
      name() {
        return "ISO-8859-5";
      }
      language() {
        return "ru";
      }
    };
    exports2.ISO_8859_5 = ISO_8859_5;
    var ISO_8859_6 = class extends sbcs {
      byteMap() {
        return [
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          0,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          193,
          194,
          195,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          210,
          211,
          212,
          213,
          214,
          215,
          216,
          217,
          218,
          32,
          32,
          32,
          32,
          32,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32
        ];
      }
      ngrams() {
        return [
          2148324,
          2148326,
          2148551,
          2152932,
          2154986,
          2155748,
          2156006,
          2156743,
          13050055,
          13091104,
          13093408,
          13095200,
          13100064,
          13100227,
          13100231,
          13100232,
          13100234,
          13100236,
          13100237,
          13100239,
          13100243,
          13100249,
          13100258,
          13100261,
          13100264,
          13100266,
          13100320,
          13100576,
          13100746,
          13115591,
          13181127,
          13181153,
          13181156,
          13181157,
          13181160,
          13246663,
          13574343,
          13617440,
          13705415,
          13748512,
          13836487,
          14229703,
          14279913,
          14805536,
          14950599,
          14993696,
          15001888,
          15002144,
          15016135,
          15058720,
          15059232,
          15066656,
          15081671,
          15147207,
          15189792,
          15255524,
          15263264,
          15278279,
          15343815,
          15343845,
          15343848,
          15386912,
          15388960,
          15394336
        ];
      }
      name() {
        return "ISO-8859-6";
      }
      language() {
        return "ar";
      }
    };
    exports2.ISO_8859_6 = ISO_8859_6;
    var ISO_8859_7 = class extends sbcs {
      byteMap() {
        return [
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          0,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          161,
          162,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          220,
          32,
          221,
          222,
          223,
          32,
          252,
          32,
          253,
          254,
          192,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          32,
          243,
          244,
          245,
          246,
          247,
          248,
          249,
          250,
          251,
          220,
          221,
          222,
          223,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          242,
          243,
          244,
          245,
          246,
          247,
          248,
          249,
          250,
          251,
          252,
          253,
          254,
          32
        ];
      }
      ngrams() {
        return [
          2154989,
          2154992,
          2155497,
          2155753,
          2156016,
          2156320,
          2157281,
          2157797,
          2158049,
          2158368,
          2158817,
          2158831,
          2158833,
          2159604,
          2159605,
          2159847,
          2159855,
          14672160,
          14754017,
          14754036,
          14805280,
          14806304,
          14807292,
          14807584,
          14936545,
          15067424,
          15069728,
          15147252,
          15199520,
          15200800,
          15278324,
          15327520,
          15330014,
          15331872,
          15393257,
          15393268,
          15525152,
          15540449,
          15540453,
          15540464,
          15589664,
          15725088,
          15725856,
          15790069,
          15790575,
          15793184,
          15868129,
          15868133,
          15868138,
          15868144,
          15868148,
          15983904,
          15984416,
          15987951,
          16048416,
          16048617,
          16050157,
          16050162,
          16050666,
          16052e3,
          16052213,
          16054765,
          16379168,
          16706848
        ];
      }
      name(det) {
        return det && det.c1Bytes ? "windows-1253" : "ISO-8859-7";
      }
      language() {
        return "el";
      }
    };
    exports2.ISO_8859_7 = ISO_8859_7;
    var ISO_8859_8 = class extends sbcs {
      byteMap() {
        return [
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          0,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          181,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          242,
          243,
          244,
          245,
          246,
          247,
          248,
          249,
          250,
          32,
          32,
          32,
          32,
          32
        ];
      }
      ngrams() {
        return [
          new NGramsPlusLang("he", [
            2154725,
            2154727,
            2154729,
            2154746,
            2154985,
            2154990,
            2155744,
            2155749,
            2155753,
            2155758,
            2155762,
            2155769,
            2155770,
            2157792,
            2157796,
            2158304,
            2159340,
            2161132,
            14744096,
            14950624,
            14950625,
            14950628,
            14950636,
            14950638,
            14950649,
            15001056,
            15065120,
            15068448,
            15068960,
            15071264,
            15071776,
            15278308,
            15328288,
            15328762,
            15329773,
            15330592,
            15331104,
            15333408,
            15333920,
            15474912,
            15474916,
            15523872,
            15524896,
            15540448,
            15540449,
            15540452,
            15540460,
            15540462,
            15540473,
            15655968,
            15671524,
            15787040,
            15788320,
            15788525,
            15920160,
            16261348,
            16312813,
            16378912,
            16392416,
            16392417,
            16392420,
            16392428,
            16392430,
            16392441
          ]),
          new NGramsPlusLang("he", [
            2154725,
            2154732,
            2155753,
            2155756,
            2155758,
            2155760,
            2157040,
            2157810,
            2157817,
            2158053,
            2158057,
            2158565,
            2158569,
            2160869,
            2160873,
            2161376,
            2161381,
            2161385,
            14688484,
            14688492,
            14688493,
            14688506,
            14738464,
            14738916,
            14740512,
            14741024,
            14754020,
            14754029,
            14754042,
            14950628,
            14950633,
            14950636,
            14950637,
            14950639,
            14950648,
            14950650,
            15002656,
            15065120,
            15066144,
            15196192,
            15327264,
            15327520,
            15328288,
            15474916,
            15474925,
            15474938,
            15528480,
            15530272,
            15591913,
            15591920,
            15591928,
            15605988,
            15605997,
            15606010,
            15655200,
            15655968,
            15918112,
            16326884,
            16326893,
            16326906,
            16376864,
            16441376,
            16442400,
            16442857
          ])
        ];
      }
      name(det) {
        return det && det.c1Bytes ? "windows-1255" : "ISO-8859-8";
      }
      language() {
        return "he";
      }
    };
    exports2.ISO_8859_8 = ISO_8859_8;
    var ISO_8859_9 = class extends sbcs {
      byteMap() {
        return [
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          0,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          170,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          181,
          32,
          32,
          32,
          32,
          186,
          32,
          32,
          32,
          32,
          32,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          242,
          243,
          244,
          245,
          246,
          32,
          248,
          249,
          250,
          251,
          252,
          105,
          254,
          223,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          242,
          243,
          244,
          245,
          246,
          32,
          248,
          249,
          250,
          251,
          252,
          253,
          254,
          255
        ];
      }
      ngrams() {
        return [
          2122337,
          2122345,
          2122357,
          2122849,
          2122853,
          2123621,
          2123873,
          2124140,
          2124641,
          2124655,
          2125153,
          2125676,
          2126689,
          2126945,
          2127461,
          2128225,
          6365282,
          6384416,
          6384737,
          6384993,
          6385184,
          6385405,
          6386208,
          6386273,
          6386429,
          6386685,
          6388065,
          6449522,
          6578464,
          6579488,
          6580512,
          6627426,
          6627435,
          6644841,
          6647328,
          6648352,
          6648425,
          6648681,
          6909029,
          6909472,
          6909545,
          6910496,
          7102830,
          7102834,
          7103776,
          7103858,
          7217249,
          7217250,
          7217259,
          7234657,
          7234661,
          7234848,
          7235872,
          7235950,
          7273760,
          7498094,
          7535982,
          7759136,
          7954720,
          7958386,
          16608800,
          16608868,
          16609021,
          16642301
        ];
      }
      name(det) {
        return det && det.c1Bytes ? "windows-1254" : "ISO-8859-9";
      }
      language() {
        return "tr";
      }
    };
    exports2.ISO_8859_9 = ISO_8859_9;
    var windows_1251 = class extends sbcs {
      byteMap() {
        return [
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          0,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          144,
          131,
          32,
          131,
          32,
          32,
          32,
          32,
          32,
          32,
          154,
          32,
          156,
          157,
          158,
          159,
          144,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          154,
          32,
          156,
          157,
          158,
          159,
          32,
          162,
          162,
          188,
          32,
          180,
          32,
          32,
          184,
          32,
          186,
          32,
          32,
          32,
          32,
          191,
          32,
          32,
          179,
          179,
          180,
          181,
          32,
          32,
          184,
          32,
          186,
          32,
          188,
          190,
          190,
          191,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          242,
          243,
          244,
          245,
          246,
          247,
          248,
          249,
          250,
          251,
          252,
          253,
          254,
          255,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          240,
          241,
          242,
          243,
          244,
          245,
          246,
          247,
          248,
          249,
          250,
          251,
          252,
          253,
          254,
          255
        ];
      }
      ngrams() {
        return [
          2155040,
          2155246,
          2155758,
          2156512,
          2156576,
          2157280,
          2157294,
          2158048,
          2158053,
          2158305,
          2158574,
          2158576,
          2158816,
          2159086,
          2159090,
          2159342,
          2160626,
          2162162,
          14740968,
          14742268,
          14937632,
          15068156,
          15068648,
          15069682,
          15069728,
          15212783,
          15263008,
          15263776,
          15269664,
          15459821,
          15460384,
          15465709,
          15589408,
          15590688,
          15591653,
          15591679,
          15592992,
          15593186,
          15605986,
          15605999,
          15606001,
          15655456,
          15655648,
          15655918,
          15657248,
          15657980,
          15658016,
          15659506,
          15724267,
          15724773,
          15724776,
          15724782,
          15786210,
          15787492,
          15856352,
          15856354,
          15856360,
          15859488,
          15918571,
          15920672,
          15920880,
          15924256,
          16249582,
          16512288
        ];
      }
      name() {
        return "windows-1251";
      }
      language() {
        return "ru";
      }
    };
    exports2.windows_1251 = windows_1251;
    var windows_1256 = class extends sbcs {
      byteMap() {
        return [
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          0,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          129,
          32,
          131,
          32,
          32,
          32,
          32,
          136,
          32,
          138,
          32,
          156,
          141,
          142,
          143,
          144,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          152,
          32,
          154,
          32,
          156,
          32,
          32,
          159,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          170,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          181,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          192,
          193,
          194,
          195,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          210,
          211,
          212,
          213,
          214,
          32,
          216,
          217,
          218,
          219,
          220,
          221,
          222,
          223,
          224,
          225,
          226,
          227,
          228,
          229,
          230,
          231,
          232,
          233,
          234,
          235,
          236,
          237,
          238,
          239,
          32,
          32,
          32,
          32,
          244,
          32,
          32,
          32,
          32,
          249,
          32,
          251,
          252,
          32,
          32,
          255
        ];
      }
      ngrams() {
        return [
          2148321,
          2148324,
          2148551,
          2153185,
          2153965,
          2154977,
          2155492,
          2156231,
          13050055,
          13091104,
          13093408,
          13095200,
          13099296,
          13099459,
          13099463,
          13099464,
          13099466,
          13099468,
          13099469,
          13099471,
          13099475,
          13099482,
          13099486,
          13099491,
          13099494,
          13099501,
          13099808,
          13100064,
          13100234,
          13115591,
          13181127,
          13181149,
          13181153,
          13181155,
          13181158,
          13246663,
          13574343,
          13617440,
          13705415,
          13748512,
          13836487,
          14295239,
          14344684,
          14544160,
          14753991,
          14797088,
          14806048,
          14806304,
          14885063,
          14927648,
          14928160,
          14935072,
          14950599,
          15016135,
          15058720,
          15124449,
          15131680,
          15474887,
          15540423,
          15540451,
          15540454,
          15583520,
          15585568,
          15590432
        ];
      }
      name() {
        return "windows-1256";
      }
      language() {
        return "ar";
      }
    };
    exports2.windows_1256 = windows_1256;
    var KOI8_R = class extends sbcs {
      byteMap() {
        return [
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          0,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          97,
          98,
          99,
          100,
          101,
          102,
          103,
          104,
          105,
          106,
          107,
          108,
          109,
          110,
          111,
          112,
          113,
          114,
          115,
          116,
          117,
          118,
          119,
          120,
          121,
          122,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          163,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          163,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          32,
          192,
          193,
          194,
          195,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          210,
          211,
          212,
          213,
          214,
          215,
          216,
          217,
          218,
          219,
          220,
          221,
          222,
          223,
          192,
          193,
          194,
          195,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          210,
          211,
          212,
          213,
          214,
          215,
          216,
          217,
          218,
          219,
          220,
          221,
          222,
          223
        ];
      }
      ngrams() {
        return [
          2147535,
          2148640,
          2149313,
          2149327,
          2150081,
          2150085,
          2150338,
          2150607,
          2150610,
          2151105,
          2151375,
          2151380,
          2151631,
          2152224,
          2152399,
          2153153,
          2153684,
          2154196,
          12701385,
          12702936,
          12963032,
          12963529,
          12964820,
          12964896,
          13094688,
          13181136,
          13223200,
          13224224,
          13226272,
          13419982,
          13420832,
          13424846,
          13549856,
          13550880,
          13552069,
          13552081,
          13553440,
          13553623,
          13574352,
          13574355,
          13574359,
          13617103,
          13617696,
          13618392,
          13618464,
          13620180,
          13621024,
          13621185,
          13684684,
          13685445,
          13685449,
          13685455,
          13812183,
          13813188,
          13881632,
          13882561,
          13882569,
          13882583,
          13944268,
          13946656,
          13946834,
          13948960,
          14272544,
          14603471
        ];
      }
      name() {
        return "KOI8-R";
      }
      language() {
        return "ru";
      }
    };
    exports2.KOI8_R = KOI8_R;
  }
});

// node_modules/chardet/lib/encoding/iso2022.js
var require_iso2022 = __commonJS({
  "node_modules/chardet/lib/encoding/iso2022.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ISO_2022_CN = exports2.ISO_2022_KR = exports2.ISO_2022_JP = void 0;
    var match_1 = __importDefault(require_match());
    var ISO_2022 = class {
      constructor() {
        this.escapeSequences = [];
      }
      name() {
        return "ISO_2022";
      }
      match(det) {
        let i, j;
        let escN;
        let hits = 0;
        let misses = 0;
        let shifts = 0;
        let confidence;
        const text = det.inputBytes;
        const textLen = det.inputLen;
        scanInput: for (i = 0; i < textLen; i++) {
          if (text[i] == 27) {
            checkEscapes: for (escN = 0; escN < this.escapeSequences.length; escN++) {
              const seq = this.escapeSequences[escN];
              if (textLen - i < seq.length)
                continue checkEscapes;
              for (j = 1; j < seq.length; j++)
                if (seq[j] != text[i + j])
                  continue checkEscapes;
              hits++;
              i += seq.length - 1;
              continue scanInput;
            }
            misses++;
          }
          if (text[i] == 14 || text[i] == 15)
            shifts++;
        }
        if (hits == 0)
          return null;
        confidence = (100 * hits - 100 * misses) / (hits + misses);
        if (hits + shifts < 5)
          confidence -= (5 - (hits + shifts)) * 10;
        return confidence <= 0 ? null : (0, match_1.default)(det, this, confidence);
      }
    };
    var ISO_2022_JP = class extends ISO_2022 {
      constructor() {
        super(...arguments);
        this.escapeSequences = [
          [27, 36, 40, 67],
          [27, 36, 40, 68],
          [27, 36, 64],
          [27, 36, 65],
          [27, 36, 66],
          [27, 38, 64],
          [27, 40, 66],
          [27, 40, 72],
          [27, 40, 73],
          [27, 40, 74],
          [27, 46, 65],
          [27, 46, 70]
        ];
      }
      name() {
        return "ISO-2022-JP";
      }
      language() {
        return "ja";
      }
    };
    exports2.ISO_2022_JP = ISO_2022_JP;
    var ISO_2022_KR = class extends ISO_2022 {
      constructor() {
        super(...arguments);
        this.escapeSequences = [[27, 36, 41, 67]];
      }
      name() {
        return "ISO-2022-KR";
      }
      language() {
        return "kr";
      }
    };
    exports2.ISO_2022_KR = ISO_2022_KR;
    var ISO_2022_CN = class extends ISO_2022 {
      constructor() {
        super(...arguments);
        this.escapeSequences = [
          [27, 36, 41, 65],
          [27, 36, 41, 71],
          [27, 36, 42, 72],
          [27, 36, 41, 69],
          [27, 36, 43, 73],
          [27, 36, 43, 74],
          [27, 36, 43, 75],
          [27, 36, 43, 76],
          [27, 36, 43, 77],
          [27, 78],
          [27, 79]
        ];
      }
      name() {
        return "ISO-2022-CN";
      }
      language() {
        return "zh";
      }
    };
    exports2.ISO_2022_CN = ISO_2022_CN;
  }
});

// node_modules/chardet/lib/utils.js
var require_utils = __commonJS({
  "node_modules/chardet/lib/utils.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.isByteArray = void 0;
    var isByteArray = (input) => {
      if (input == null || typeof input != "object")
        return false;
      return isFinite(input.length) && input.length >= 0;
    };
    exports2.isByteArray = isByteArray;
  }
});

// node_modules/chardet/lib/index.js
var require_lib = __commonJS({
  "node_modules/chardet/lib/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    });
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    } : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    }();
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.detectFileSync = exports2.detectFile = exports2.analyse = exports2.detect = void 0;
    var node_1 = __importDefault(require_node());
    var ascii_1 = __importDefault(require_ascii());
    var utf8_1 = __importDefault(require_utf8());
    var unicode = __importStar(require_unicode());
    var mbcs = __importStar(require_mbcs());
    var sbcs = __importStar(require_sbcs());
    var iso2022 = __importStar(require_iso2022());
    var utils_1 = require_utils();
    var recognisers = [
      new utf8_1.default(),
      new unicode.UTF_16BE(),
      new unicode.UTF_16LE(),
      new unicode.UTF_32BE(),
      new unicode.UTF_32LE(),
      new mbcs.sjis(),
      new mbcs.big5(),
      new mbcs.euc_jp(),
      new mbcs.euc_kr(),
      new mbcs.gb_18030(),
      new iso2022.ISO_2022_JP(),
      new iso2022.ISO_2022_KR(),
      new iso2022.ISO_2022_CN(),
      new sbcs.ISO_8859_1(),
      new sbcs.ISO_8859_2(),
      new sbcs.ISO_8859_5(),
      new sbcs.ISO_8859_6(),
      new sbcs.ISO_8859_7(),
      new sbcs.ISO_8859_8(),
      new sbcs.ISO_8859_9(),
      new sbcs.windows_1251(),
      new sbcs.windows_1256(),
      new sbcs.KOI8_R(),
      new ascii_1.default()
    ];
    var detect = (buffer) => {
      const matches = (0, exports2.analyse)(buffer);
      return matches.length > 0 ? matches[0].name : null;
    };
    exports2.detect = detect;
    var analyse2 = (buffer) => {
      if (!(0, utils_1.isByteArray)(buffer)) {
        throw new Error("Input must be a byte array, e.g. Buffer or Uint8Array");
      }
      const byteStats = [];
      for (let i = 0; i < 256; i++)
        byteStats[i] = 0;
      for (let i = buffer.length - 1; i >= 0; i--)
        byteStats[buffer[i] & 255]++;
      let c1Bytes = false;
      for (let i = 128; i <= 159; i += 1) {
        if (byteStats[i] !== 0) {
          c1Bytes = true;
          break;
        }
      }
      const context = {
        byteStats,
        c1Bytes,
        rawInput: buffer,
        rawLen: buffer.length,
        inputBytes: buffer,
        inputLen: buffer.length
      };
      const matches = recognisers.map((rec) => {
        return rec.match(context);
      }).filter((match3) => {
        return !!match3;
      }).sort((a, b) => {
        return b.confidence - a.confidence;
      });
      return matches;
    };
    exports2.analyse = analyse2;
    var detectFile = (filepath, opts = {}) => new Promise((resolve2, reject) => {
      let fd;
      const fs = (0, node_1.default)();
      const handler = (err, buffer) => {
        if (fd) {
          fs.closeSync(fd);
        }
        if (err) {
          reject(err);
        } else if (buffer) {
          resolve2((0, exports2.detect)(buffer));
        } else {
          reject(new Error("No error and no buffer received"));
        }
      };
      const sampleSize = (opts === null || opts === void 0 ? void 0 : opts.sampleSize) || 0;
      if (sampleSize > 0) {
        fd = fs.openSync(filepath, "r");
        let sample = Buffer.allocUnsafe(sampleSize);
        fs.read(fd, sample, 0, sampleSize, opts.offset, (err, bytesRead) => {
          if (err) {
            handler(err, null);
          } else {
            if (bytesRead < sampleSize) {
              sample = sample.subarray(0, bytesRead);
            }
            handler(null, sample);
          }
        });
        return;
      }
      fs.readFile(filepath, handler);
    });
    exports2.detectFile = detectFile;
    var detectFileSync = (filepath, opts = {}) => {
      const fs = (0, node_1.default)();
      if (opts && opts.sampleSize) {
        const fd = fs.openSync(filepath, "r");
        let sample = Buffer.allocUnsafe(opts.sampleSize);
        const bytesRead = fs.readSync(fd, sample, 0, opts.sampleSize, opts.offset);
        if (bytesRead < opts.sampleSize) {
          sample = sample.subarray(0, bytesRead);
        }
        fs.closeSync(fd);
        return (0, exports2.detect)(sample);
      }
      return (0, exports2.detect)(fs.readFileSync(filepath));
    };
    exports2.detectFileSync = detectFileSync;
    exports2.default = {
      analyse: exports2.analyse,
      detect: exports2.detect,
      detectFileSync: exports2.detectFileSync,
      detectFile: exports2.detectFile
    };
  }
});

// node_modules/xml2js/lib/defaults.js
var require_defaults = __commonJS({
  "node_modules/xml2js/lib/defaults.js"(exports2) {
    (function() {
      exports2.defaults = {
        "0.1": {
          explicitCharkey: false,
          trim: true,
          normalize: true,
          normalizeTags: false,
          attrkey: "@",
          charkey: "#",
          explicitArray: false,
          ignoreAttrs: false,
          mergeAttrs: false,
          explicitRoot: false,
          validator: null,
          xmlns: false,
          explicitChildren: false,
          childkey: "@@",
          charsAsChildren: false,
          includeWhiteChars: false,
          async: false,
          strict: true,
          attrNameProcessors: null,
          attrValueProcessors: null,
          tagNameProcessors: null,
          valueProcessors: null,
          emptyTag: ""
        },
        "0.2": {
          explicitCharkey: false,
          trim: false,
          normalize: false,
          normalizeTags: false,
          attrkey: "$",
          charkey: "_",
          explicitArray: true,
          ignoreAttrs: false,
          mergeAttrs: false,
          explicitRoot: true,
          validator: null,
          xmlns: false,
          explicitChildren: false,
          preserveChildrenOrder: false,
          childkey: "$$",
          charsAsChildren: false,
          includeWhiteChars: false,
          async: false,
          strict: true,
          attrNameProcessors: null,
          attrValueProcessors: null,
          tagNameProcessors: null,
          valueProcessors: null,
          rootName: "root",
          xmldec: {
            "version": "1.0",
            "encoding": "UTF-8",
            "standalone": true
          },
          doctype: null,
          renderOpts: {
            "pretty": true,
            "indent": "  ",
            "newline": "\n"
          },
          headless: false,
          chunkSize: 1e4,
          emptyTag: "",
          cdata: false
        }
      };
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/Utility.js
var require_Utility = __commonJS({
  "node_modules/xmlbuilder/lib/Utility.js"(exports2, module2) {
    (function() {
      var assign, getValue, isArray, isEmpty, isFunction, isObject, isPlainObject, slice = [].slice, hasProp = {}.hasOwnProperty;
      assign = function() {
        var i, key, len, source, sources, target;
        target = arguments[0], sources = 2 <= arguments.length ? slice.call(arguments, 1) : [];
        if (isFunction(Object.assign)) {
          Object.assign.apply(null, arguments);
        } else {
          for (i = 0, len = sources.length; i < len; i++) {
            source = sources[i];
            if (source != null) {
              for (key in source) {
                if (!hasProp.call(source, key)) continue;
                target[key] = source[key];
              }
            }
          }
        }
        return target;
      };
      isFunction = function(val) {
        return !!val && Object.prototype.toString.call(val) === "[object Function]";
      };
      isObject = function(val) {
        var ref;
        return !!val && ((ref = typeof val) === "function" || ref === "object");
      };
      isArray = function(val) {
        if (isFunction(Array.isArray)) {
          return Array.isArray(val);
        } else {
          return Object.prototype.toString.call(val) === "[object Array]";
        }
      };
      isEmpty = function(val) {
        var key;
        if (isArray(val)) {
          return !val.length;
        } else {
          for (key in val) {
            if (!hasProp.call(val, key)) continue;
            return false;
          }
          return true;
        }
      };
      isPlainObject = function(val) {
        var ctor, proto;
        return isObject(val) && (proto = Object.getPrototypeOf(val)) && (ctor = proto.constructor) && typeof ctor === "function" && ctor instanceof ctor && Function.prototype.toString.call(ctor) === Function.prototype.toString.call(Object);
      };
      getValue = function(obj) {
        if (isFunction(obj.valueOf)) {
          return obj.valueOf();
        } else {
          return obj;
        }
      };
      module2.exports.assign = assign;
      module2.exports.isFunction = isFunction;
      module2.exports.isObject = isObject;
      module2.exports.isArray = isArray;
      module2.exports.isEmpty = isEmpty;
      module2.exports.isPlainObject = isPlainObject;
      module2.exports.getValue = getValue;
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDOMImplementation.js
var require_XMLDOMImplementation = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDOMImplementation.js"(exports2, module2) {
    (function() {
      var XMLDOMImplementation;
      module2.exports = XMLDOMImplementation = function() {
        function XMLDOMImplementation2() {
        }
        XMLDOMImplementation2.prototype.hasFeature = function(feature, version) {
          return true;
        };
        XMLDOMImplementation2.prototype.createDocumentType = function(qualifiedName, publicId, systemId) {
          throw new Error("This DOM method is not implemented.");
        };
        XMLDOMImplementation2.prototype.createDocument = function(namespaceURI, qualifiedName, doctype) {
          throw new Error("This DOM method is not implemented.");
        };
        XMLDOMImplementation2.prototype.createHTMLDocument = function(title) {
          throw new Error("This DOM method is not implemented.");
        };
        XMLDOMImplementation2.prototype.getFeature = function(feature, version) {
          throw new Error("This DOM method is not implemented.");
        };
        return XMLDOMImplementation2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDOMErrorHandler.js
var require_XMLDOMErrorHandler = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDOMErrorHandler.js"(exports2, module2) {
    (function() {
      var XMLDOMErrorHandler;
      module2.exports = XMLDOMErrorHandler = function() {
        function XMLDOMErrorHandler2() {
        }
        XMLDOMErrorHandler2.prototype.handleError = function(error) {
          throw new Error(error);
        };
        return XMLDOMErrorHandler2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDOMStringList.js
var require_XMLDOMStringList = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDOMStringList.js"(exports2, module2) {
    (function() {
      var XMLDOMStringList;
      module2.exports = XMLDOMStringList = function() {
        function XMLDOMStringList2(arr) {
          this.arr = arr || [];
        }
        Object.defineProperty(XMLDOMStringList2.prototype, "length", {
          get: function() {
            return this.arr.length;
          }
        });
        XMLDOMStringList2.prototype.item = function(index) {
          return this.arr[index] || null;
        };
        XMLDOMStringList2.prototype.contains = function(str) {
          return this.arr.indexOf(str) !== -1;
        };
        return XMLDOMStringList2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDOMConfiguration.js
var require_XMLDOMConfiguration = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDOMConfiguration.js"(exports2, module2) {
    (function() {
      var XMLDOMConfiguration, XMLDOMErrorHandler, XMLDOMStringList;
      XMLDOMErrorHandler = require_XMLDOMErrorHandler();
      XMLDOMStringList = require_XMLDOMStringList();
      module2.exports = XMLDOMConfiguration = function() {
        function XMLDOMConfiguration2() {
          var clonedSelf;
          this.defaultParams = {
            "canonical-form": false,
            "cdata-sections": false,
            "comments": false,
            "datatype-normalization": false,
            "element-content-whitespace": true,
            "entities": true,
            "error-handler": new XMLDOMErrorHandler(),
            "infoset": true,
            "validate-if-schema": false,
            "namespaces": true,
            "namespace-declarations": true,
            "normalize-characters": false,
            "schema-location": "",
            "schema-type": "",
            "split-cdata-sections": true,
            "validate": false,
            "well-formed": true
          };
          this.params = clonedSelf = Object.create(this.defaultParams);
        }
        Object.defineProperty(XMLDOMConfiguration2.prototype, "parameterNames", {
          get: function() {
            return new XMLDOMStringList(Object.keys(this.defaultParams));
          }
        });
        XMLDOMConfiguration2.prototype.getParameter = function(name) {
          if (this.params.hasOwnProperty(name)) {
            return this.params[name];
          } else {
            return null;
          }
        };
        XMLDOMConfiguration2.prototype.canSetParameter = function(name, value) {
          return true;
        };
        XMLDOMConfiguration2.prototype.setParameter = function(name, value) {
          if (value != null) {
            return this.params[name] = value;
          } else {
            return delete this.params[name];
          }
        };
        return XMLDOMConfiguration2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/NodeType.js
var require_NodeType = __commonJS({
  "node_modules/xmlbuilder/lib/NodeType.js"(exports2, module2) {
    (function() {
      module2.exports = {
        Element: 1,
        Attribute: 2,
        Text: 3,
        CData: 4,
        EntityReference: 5,
        EntityDeclaration: 6,
        ProcessingInstruction: 7,
        Comment: 8,
        Document: 9,
        DocType: 10,
        DocumentFragment: 11,
        NotationDeclaration: 12,
        Declaration: 201,
        Raw: 202,
        AttributeDeclaration: 203,
        ElementDeclaration: 204,
        Dummy: 205
      };
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLAttribute.js
var require_XMLAttribute = __commonJS({
  "node_modules/xmlbuilder/lib/XMLAttribute.js"(exports2, module2) {
    (function() {
      var NodeType, XMLAttribute, XMLNode;
      NodeType = require_NodeType();
      XMLNode = require_XMLNode();
      module2.exports = XMLAttribute = function() {
        function XMLAttribute2(parent, name, value) {
          this.parent = parent;
          if (this.parent) {
            this.options = this.parent.options;
            this.stringify = this.parent.stringify;
          }
          if (name == null) {
            throw new Error("Missing attribute name. " + this.debugInfo(name));
          }
          this.name = this.stringify.name(name);
          this.value = this.stringify.attValue(value);
          this.type = NodeType.Attribute;
          this.isId = false;
          this.schemaTypeInfo = null;
        }
        Object.defineProperty(XMLAttribute2.prototype, "nodeType", {
          get: function() {
            return this.type;
          }
        });
        Object.defineProperty(XMLAttribute2.prototype, "ownerElement", {
          get: function() {
            return this.parent;
          }
        });
        Object.defineProperty(XMLAttribute2.prototype, "textContent", {
          get: function() {
            return this.value;
          },
          set: function(value) {
            return this.value = value || "";
          }
        });
        Object.defineProperty(XMLAttribute2.prototype, "namespaceURI", {
          get: function() {
            return "";
          }
        });
        Object.defineProperty(XMLAttribute2.prototype, "prefix", {
          get: function() {
            return "";
          }
        });
        Object.defineProperty(XMLAttribute2.prototype, "localName", {
          get: function() {
            return this.name;
          }
        });
        Object.defineProperty(XMLAttribute2.prototype, "specified", {
          get: function() {
            return true;
          }
        });
        XMLAttribute2.prototype.clone = function() {
          return Object.create(this);
        };
        XMLAttribute2.prototype.toString = function(options) {
          return this.options.writer.attribute(this, this.options.writer.filterOptions(options));
        };
        XMLAttribute2.prototype.debugInfo = function(name) {
          name = name || this.name;
          if (name == null) {
            return "parent: <" + this.parent.name + ">";
          } else {
            return "attribute: {" + name + "}, parent: <" + this.parent.name + ">";
          }
        };
        XMLAttribute2.prototype.isEqualNode = function(node) {
          if (node.namespaceURI !== this.namespaceURI) {
            return false;
          }
          if (node.prefix !== this.prefix) {
            return false;
          }
          if (node.localName !== this.localName) {
            return false;
          }
          if (node.value !== this.value) {
            return false;
          }
          return true;
        };
        return XMLAttribute2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLNamedNodeMap.js
var require_XMLNamedNodeMap = __commonJS({
  "node_modules/xmlbuilder/lib/XMLNamedNodeMap.js"(exports2, module2) {
    (function() {
      var XMLNamedNodeMap;
      module2.exports = XMLNamedNodeMap = function() {
        function XMLNamedNodeMap2(nodes) {
          this.nodes = nodes;
        }
        Object.defineProperty(XMLNamedNodeMap2.prototype, "length", {
          get: function() {
            return Object.keys(this.nodes).length || 0;
          }
        });
        XMLNamedNodeMap2.prototype.clone = function() {
          return this.nodes = null;
        };
        XMLNamedNodeMap2.prototype.getNamedItem = function(name) {
          return this.nodes[name];
        };
        XMLNamedNodeMap2.prototype.setNamedItem = function(node) {
          var oldNode;
          oldNode = this.nodes[node.nodeName];
          this.nodes[node.nodeName] = node;
          return oldNode || null;
        };
        XMLNamedNodeMap2.prototype.removeNamedItem = function(name) {
          var oldNode;
          oldNode = this.nodes[name];
          delete this.nodes[name];
          return oldNode || null;
        };
        XMLNamedNodeMap2.prototype.item = function(index) {
          return this.nodes[Object.keys(this.nodes)[index]] || null;
        };
        XMLNamedNodeMap2.prototype.getNamedItemNS = function(namespaceURI, localName) {
          throw new Error("This DOM method is not implemented.");
        };
        XMLNamedNodeMap2.prototype.setNamedItemNS = function(node) {
          throw new Error("This DOM method is not implemented.");
        };
        XMLNamedNodeMap2.prototype.removeNamedItemNS = function(namespaceURI, localName) {
          throw new Error("This DOM method is not implemented.");
        };
        return XMLNamedNodeMap2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLElement.js
var require_XMLElement = __commonJS({
  "node_modules/xmlbuilder/lib/XMLElement.js"(exports2, module2) {
    (function() {
      var NodeType, XMLAttribute, XMLElement, XMLNamedNodeMap, XMLNode, getValue, isFunction, isObject, ref, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      ref = require_Utility(), isObject = ref.isObject, isFunction = ref.isFunction, getValue = ref.getValue;
      XMLNode = require_XMLNode();
      NodeType = require_NodeType();
      XMLAttribute = require_XMLAttribute();
      XMLNamedNodeMap = require_XMLNamedNodeMap();
      module2.exports = XMLElement = function(superClass) {
        extend(XMLElement2, superClass);
        function XMLElement2(parent, name, attributes) {
          var child, j, len, ref1;
          XMLElement2.__super__.constructor.call(this, parent);
          if (name == null) {
            throw new Error("Missing element name. " + this.debugInfo());
          }
          this.name = this.stringify.name(name);
          this.type = NodeType.Element;
          this.attribs = {};
          this.schemaTypeInfo = null;
          if (attributes != null) {
            this.attribute(attributes);
          }
          if (parent.type === NodeType.Document) {
            this.isRoot = true;
            this.documentObject = parent;
            parent.rootObject = this;
            if (parent.children) {
              ref1 = parent.children;
              for (j = 0, len = ref1.length; j < len; j++) {
                child = ref1[j];
                if (child.type === NodeType.DocType) {
                  child.name = this.name;
                  break;
                }
              }
            }
          }
        }
        Object.defineProperty(XMLElement2.prototype, "tagName", {
          get: function() {
            return this.name;
          }
        });
        Object.defineProperty(XMLElement2.prototype, "namespaceURI", {
          get: function() {
            return "";
          }
        });
        Object.defineProperty(XMLElement2.prototype, "prefix", {
          get: function() {
            return "";
          }
        });
        Object.defineProperty(XMLElement2.prototype, "localName", {
          get: function() {
            return this.name;
          }
        });
        Object.defineProperty(XMLElement2.prototype, "id", {
          get: function() {
            throw new Error("This DOM method is not implemented." + this.debugInfo());
          }
        });
        Object.defineProperty(XMLElement2.prototype, "className", {
          get: function() {
            throw new Error("This DOM method is not implemented." + this.debugInfo());
          }
        });
        Object.defineProperty(XMLElement2.prototype, "classList", {
          get: function() {
            throw new Error("This DOM method is not implemented." + this.debugInfo());
          }
        });
        Object.defineProperty(XMLElement2.prototype, "attributes", {
          get: function() {
            if (!this.attributeMap || !this.attributeMap.nodes) {
              this.attributeMap = new XMLNamedNodeMap(this.attribs);
            }
            return this.attributeMap;
          }
        });
        XMLElement2.prototype.clone = function() {
          var att, attName, clonedSelf, ref1;
          clonedSelf = Object.create(this);
          if (clonedSelf.isRoot) {
            clonedSelf.documentObject = null;
          }
          clonedSelf.attribs = {};
          ref1 = this.attribs;
          for (attName in ref1) {
            if (!hasProp.call(ref1, attName)) continue;
            att = ref1[attName];
            clonedSelf.attribs[attName] = att.clone();
          }
          clonedSelf.children = [];
          this.children.forEach(function(child) {
            var clonedChild;
            clonedChild = child.clone();
            clonedChild.parent = clonedSelf;
            return clonedSelf.children.push(clonedChild);
          });
          return clonedSelf;
        };
        XMLElement2.prototype.attribute = function(name, value) {
          var attName, attValue;
          if (name != null) {
            name = getValue(name);
          }
          if (isObject(name)) {
            for (attName in name) {
              if (!hasProp.call(name, attName)) continue;
              attValue = name[attName];
              this.attribute(attName, attValue);
            }
          } else {
            if (isFunction(value)) {
              value = value.apply();
            }
            if (this.options.keepNullAttributes && value == null) {
              this.attribs[name] = new XMLAttribute(this, name, "");
            } else if (value != null) {
              this.attribs[name] = new XMLAttribute(this, name, value);
            }
          }
          return this;
        };
        XMLElement2.prototype.removeAttribute = function(name) {
          var attName, j, len;
          if (name == null) {
            throw new Error("Missing attribute name. " + this.debugInfo());
          }
          name = getValue(name);
          if (Array.isArray(name)) {
            for (j = 0, len = name.length; j < len; j++) {
              attName = name[j];
              delete this.attribs[attName];
            }
          } else {
            delete this.attribs[name];
          }
          return this;
        };
        XMLElement2.prototype.toString = function(options) {
          return this.options.writer.element(this, this.options.writer.filterOptions(options));
        };
        XMLElement2.prototype.att = function(name, value) {
          return this.attribute(name, value);
        };
        XMLElement2.prototype.a = function(name, value) {
          return this.attribute(name, value);
        };
        XMLElement2.prototype.getAttribute = function(name) {
          if (this.attribs.hasOwnProperty(name)) {
            return this.attribs[name].value;
          } else {
            return null;
          }
        };
        XMLElement2.prototype.setAttribute = function(name, value) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.getAttributeNode = function(name) {
          if (this.attribs.hasOwnProperty(name)) {
            return this.attribs[name];
          } else {
            return null;
          }
        };
        XMLElement2.prototype.setAttributeNode = function(newAttr) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.removeAttributeNode = function(oldAttr) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.getElementsByTagName = function(name) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.getAttributeNS = function(namespaceURI, localName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.setAttributeNS = function(namespaceURI, qualifiedName, value) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.removeAttributeNS = function(namespaceURI, localName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.getAttributeNodeNS = function(namespaceURI, localName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.setAttributeNodeNS = function(newAttr) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.getElementsByTagNameNS = function(namespaceURI, localName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.hasAttribute = function(name) {
          return this.attribs.hasOwnProperty(name);
        };
        XMLElement2.prototype.hasAttributeNS = function(namespaceURI, localName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.setIdAttribute = function(name, isId) {
          if (this.attribs.hasOwnProperty(name)) {
            return this.attribs[name].isId;
          } else {
            return isId;
          }
        };
        XMLElement2.prototype.setIdAttributeNS = function(namespaceURI, localName, isId) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.setIdAttributeNode = function(idAttr, isId) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.getElementsByTagName = function(tagname) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.getElementsByTagNameNS = function(namespaceURI, localName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.getElementsByClassName = function(classNames) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLElement2.prototype.isEqualNode = function(node) {
          var i, j, ref1;
          if (!XMLElement2.__super__.isEqualNode.apply(this, arguments).isEqualNode(node)) {
            return false;
          }
          if (node.namespaceURI !== this.namespaceURI) {
            return false;
          }
          if (node.prefix !== this.prefix) {
            return false;
          }
          if (node.localName !== this.localName) {
            return false;
          }
          if (node.attribs.length !== this.attribs.length) {
            return false;
          }
          for (i = j = 0, ref1 = this.attribs.length - 1; 0 <= ref1 ? j <= ref1 : j >= ref1; i = 0 <= ref1 ? ++j : --j) {
            if (!this.attribs[i].isEqualNode(node.attribs[i])) {
              return false;
            }
          }
          return true;
        };
        return XMLElement2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLCharacterData.js
var require_XMLCharacterData = __commonJS({
  "node_modules/xmlbuilder/lib/XMLCharacterData.js"(exports2, module2) {
    (function() {
      var XMLCharacterData, XMLNode, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      XMLNode = require_XMLNode();
      module2.exports = XMLCharacterData = function(superClass) {
        extend(XMLCharacterData2, superClass);
        function XMLCharacterData2(parent) {
          XMLCharacterData2.__super__.constructor.call(this, parent);
          this.value = "";
        }
        Object.defineProperty(XMLCharacterData2.prototype, "data", {
          get: function() {
            return this.value;
          },
          set: function(value) {
            return this.value = value || "";
          }
        });
        Object.defineProperty(XMLCharacterData2.prototype, "length", {
          get: function() {
            return this.value.length;
          }
        });
        Object.defineProperty(XMLCharacterData2.prototype, "textContent", {
          get: function() {
            return this.value;
          },
          set: function(value) {
            return this.value = value || "";
          }
        });
        XMLCharacterData2.prototype.clone = function() {
          return Object.create(this);
        };
        XMLCharacterData2.prototype.substringData = function(offset, count) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLCharacterData2.prototype.appendData = function(arg) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLCharacterData2.prototype.insertData = function(offset, arg) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLCharacterData2.prototype.deleteData = function(offset, count) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLCharacterData2.prototype.replaceData = function(offset, count, arg) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLCharacterData2.prototype.isEqualNode = function(node) {
          if (!XMLCharacterData2.__super__.isEqualNode.apply(this, arguments).isEqualNode(node)) {
            return false;
          }
          if (node.data !== this.data) {
            return false;
          }
          return true;
        };
        return XMLCharacterData2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLCData.js
var require_XMLCData = __commonJS({
  "node_modules/xmlbuilder/lib/XMLCData.js"(exports2, module2) {
    (function() {
      var NodeType, XMLCData, XMLCharacterData, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      NodeType = require_NodeType();
      XMLCharacterData = require_XMLCharacterData();
      module2.exports = XMLCData = function(superClass) {
        extend(XMLCData2, superClass);
        function XMLCData2(parent, text) {
          XMLCData2.__super__.constructor.call(this, parent);
          if (text == null) {
            throw new Error("Missing CDATA text. " + this.debugInfo());
          }
          this.name = "#cdata-section";
          this.type = NodeType.CData;
          this.value = this.stringify.cdata(text);
        }
        XMLCData2.prototype.clone = function() {
          return Object.create(this);
        };
        XMLCData2.prototype.toString = function(options) {
          return this.options.writer.cdata(this, this.options.writer.filterOptions(options));
        };
        return XMLCData2;
      }(XMLCharacterData);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLComment.js
var require_XMLComment = __commonJS({
  "node_modules/xmlbuilder/lib/XMLComment.js"(exports2, module2) {
    (function() {
      var NodeType, XMLCharacterData, XMLComment, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      NodeType = require_NodeType();
      XMLCharacterData = require_XMLCharacterData();
      module2.exports = XMLComment = function(superClass) {
        extend(XMLComment2, superClass);
        function XMLComment2(parent, text) {
          XMLComment2.__super__.constructor.call(this, parent);
          if (text == null) {
            throw new Error("Missing comment text. " + this.debugInfo());
          }
          this.name = "#comment";
          this.type = NodeType.Comment;
          this.value = this.stringify.comment(text);
        }
        XMLComment2.prototype.clone = function() {
          return Object.create(this);
        };
        XMLComment2.prototype.toString = function(options) {
          return this.options.writer.comment(this, this.options.writer.filterOptions(options));
        };
        return XMLComment2;
      }(XMLCharacterData);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDeclaration.js
var require_XMLDeclaration = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDeclaration.js"(exports2, module2) {
    (function() {
      var NodeType, XMLDeclaration, XMLNode, isObject, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      isObject = require_Utility().isObject;
      XMLNode = require_XMLNode();
      NodeType = require_NodeType();
      module2.exports = XMLDeclaration = function(superClass) {
        extend(XMLDeclaration2, superClass);
        function XMLDeclaration2(parent, version, encoding, standalone) {
          var ref;
          XMLDeclaration2.__super__.constructor.call(this, parent);
          if (isObject(version)) {
            ref = version, version = ref.version, encoding = ref.encoding, standalone = ref.standalone;
          }
          if (!version) {
            version = "1.0";
          }
          this.type = NodeType.Declaration;
          this.version = this.stringify.xmlVersion(version);
          if (encoding != null) {
            this.encoding = this.stringify.xmlEncoding(encoding);
          }
          if (standalone != null) {
            this.standalone = this.stringify.xmlStandalone(standalone);
          }
        }
        XMLDeclaration2.prototype.toString = function(options) {
          return this.options.writer.declaration(this, this.options.writer.filterOptions(options));
        };
        return XMLDeclaration2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDTDAttList.js
var require_XMLDTDAttList = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDTDAttList.js"(exports2, module2) {
    (function() {
      var NodeType, XMLDTDAttList, XMLNode, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      XMLNode = require_XMLNode();
      NodeType = require_NodeType();
      module2.exports = XMLDTDAttList = function(superClass) {
        extend(XMLDTDAttList2, superClass);
        function XMLDTDAttList2(parent, elementName, attributeName, attributeType, defaultValueType, defaultValue) {
          XMLDTDAttList2.__super__.constructor.call(this, parent);
          if (elementName == null) {
            throw new Error("Missing DTD element name. " + this.debugInfo());
          }
          if (attributeName == null) {
            throw new Error("Missing DTD attribute name. " + this.debugInfo(elementName));
          }
          if (!attributeType) {
            throw new Error("Missing DTD attribute type. " + this.debugInfo(elementName));
          }
          if (!defaultValueType) {
            throw new Error("Missing DTD attribute default. " + this.debugInfo(elementName));
          }
          if (defaultValueType.indexOf("#") !== 0) {
            defaultValueType = "#" + defaultValueType;
          }
          if (!defaultValueType.match(/^(#REQUIRED|#IMPLIED|#FIXED|#DEFAULT)$/)) {
            throw new Error("Invalid default value type; expected: #REQUIRED, #IMPLIED, #FIXED or #DEFAULT. " + this.debugInfo(elementName));
          }
          if (defaultValue && !defaultValueType.match(/^(#FIXED|#DEFAULT)$/)) {
            throw new Error("Default value only applies to #FIXED or #DEFAULT. " + this.debugInfo(elementName));
          }
          this.elementName = this.stringify.name(elementName);
          this.type = NodeType.AttributeDeclaration;
          this.attributeName = this.stringify.name(attributeName);
          this.attributeType = this.stringify.dtdAttType(attributeType);
          if (defaultValue) {
            this.defaultValue = this.stringify.dtdAttDefault(defaultValue);
          }
          this.defaultValueType = defaultValueType;
        }
        XMLDTDAttList2.prototype.toString = function(options) {
          return this.options.writer.dtdAttList(this, this.options.writer.filterOptions(options));
        };
        return XMLDTDAttList2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDTDEntity.js
var require_XMLDTDEntity = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDTDEntity.js"(exports2, module2) {
    (function() {
      var NodeType, XMLDTDEntity, XMLNode, isObject, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      isObject = require_Utility().isObject;
      XMLNode = require_XMLNode();
      NodeType = require_NodeType();
      module2.exports = XMLDTDEntity = function(superClass) {
        extend(XMLDTDEntity2, superClass);
        function XMLDTDEntity2(parent, pe, name, value) {
          XMLDTDEntity2.__super__.constructor.call(this, parent);
          if (name == null) {
            throw new Error("Missing DTD entity name. " + this.debugInfo(name));
          }
          if (value == null) {
            throw new Error("Missing DTD entity value. " + this.debugInfo(name));
          }
          this.pe = !!pe;
          this.name = this.stringify.name(name);
          this.type = NodeType.EntityDeclaration;
          if (!isObject(value)) {
            this.value = this.stringify.dtdEntityValue(value);
            this.internal = true;
          } else {
            if (!value.pubID && !value.sysID) {
              throw new Error("Public and/or system identifiers are required for an external entity. " + this.debugInfo(name));
            }
            if (value.pubID && !value.sysID) {
              throw new Error("System identifier is required for a public external entity. " + this.debugInfo(name));
            }
            this.internal = false;
            if (value.pubID != null) {
              this.pubID = this.stringify.dtdPubID(value.pubID);
            }
            if (value.sysID != null) {
              this.sysID = this.stringify.dtdSysID(value.sysID);
            }
            if (value.nData != null) {
              this.nData = this.stringify.dtdNData(value.nData);
            }
            if (this.pe && this.nData) {
              throw new Error("Notation declaration is not allowed in a parameter entity. " + this.debugInfo(name));
            }
          }
        }
        Object.defineProperty(XMLDTDEntity2.prototype, "publicId", {
          get: function() {
            return this.pubID;
          }
        });
        Object.defineProperty(XMLDTDEntity2.prototype, "systemId", {
          get: function() {
            return this.sysID;
          }
        });
        Object.defineProperty(XMLDTDEntity2.prototype, "notationName", {
          get: function() {
            return this.nData || null;
          }
        });
        Object.defineProperty(XMLDTDEntity2.prototype, "inputEncoding", {
          get: function() {
            return null;
          }
        });
        Object.defineProperty(XMLDTDEntity2.prototype, "xmlEncoding", {
          get: function() {
            return null;
          }
        });
        Object.defineProperty(XMLDTDEntity2.prototype, "xmlVersion", {
          get: function() {
            return null;
          }
        });
        XMLDTDEntity2.prototype.toString = function(options) {
          return this.options.writer.dtdEntity(this, this.options.writer.filterOptions(options));
        };
        return XMLDTDEntity2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDTDElement.js
var require_XMLDTDElement = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDTDElement.js"(exports2, module2) {
    (function() {
      var NodeType, XMLDTDElement, XMLNode, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      XMLNode = require_XMLNode();
      NodeType = require_NodeType();
      module2.exports = XMLDTDElement = function(superClass) {
        extend(XMLDTDElement2, superClass);
        function XMLDTDElement2(parent, name, value) {
          XMLDTDElement2.__super__.constructor.call(this, parent);
          if (name == null) {
            throw new Error("Missing DTD element name. " + this.debugInfo());
          }
          if (!value) {
            value = "(#PCDATA)";
          }
          if (Array.isArray(value)) {
            value = "(" + value.join(",") + ")";
          }
          this.name = this.stringify.name(name);
          this.type = NodeType.ElementDeclaration;
          this.value = this.stringify.dtdElementValue(value);
        }
        XMLDTDElement2.prototype.toString = function(options) {
          return this.options.writer.dtdElement(this, this.options.writer.filterOptions(options));
        };
        return XMLDTDElement2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDTDNotation.js
var require_XMLDTDNotation = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDTDNotation.js"(exports2, module2) {
    (function() {
      var NodeType, XMLDTDNotation, XMLNode, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      XMLNode = require_XMLNode();
      NodeType = require_NodeType();
      module2.exports = XMLDTDNotation = function(superClass) {
        extend(XMLDTDNotation2, superClass);
        function XMLDTDNotation2(parent, name, value) {
          XMLDTDNotation2.__super__.constructor.call(this, parent);
          if (name == null) {
            throw new Error("Missing DTD notation name. " + this.debugInfo(name));
          }
          if (!value.pubID && !value.sysID) {
            throw new Error("Public or system identifiers are required for an external entity. " + this.debugInfo(name));
          }
          this.name = this.stringify.name(name);
          this.type = NodeType.NotationDeclaration;
          if (value.pubID != null) {
            this.pubID = this.stringify.dtdPubID(value.pubID);
          }
          if (value.sysID != null) {
            this.sysID = this.stringify.dtdSysID(value.sysID);
          }
        }
        Object.defineProperty(XMLDTDNotation2.prototype, "publicId", {
          get: function() {
            return this.pubID;
          }
        });
        Object.defineProperty(XMLDTDNotation2.prototype, "systemId", {
          get: function() {
            return this.sysID;
          }
        });
        XMLDTDNotation2.prototype.toString = function(options) {
          return this.options.writer.dtdNotation(this, this.options.writer.filterOptions(options));
        };
        return XMLDTDNotation2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDocType.js
var require_XMLDocType = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDocType.js"(exports2, module2) {
    (function() {
      var NodeType, XMLDTDAttList, XMLDTDElement, XMLDTDEntity, XMLDTDNotation, XMLDocType, XMLNamedNodeMap, XMLNode, isObject, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      isObject = require_Utility().isObject;
      XMLNode = require_XMLNode();
      NodeType = require_NodeType();
      XMLDTDAttList = require_XMLDTDAttList();
      XMLDTDEntity = require_XMLDTDEntity();
      XMLDTDElement = require_XMLDTDElement();
      XMLDTDNotation = require_XMLDTDNotation();
      XMLNamedNodeMap = require_XMLNamedNodeMap();
      module2.exports = XMLDocType = function(superClass) {
        extend(XMLDocType2, superClass);
        function XMLDocType2(parent, pubID, sysID) {
          var child, i, len, ref, ref1, ref2;
          XMLDocType2.__super__.constructor.call(this, parent);
          this.type = NodeType.DocType;
          if (parent.children) {
            ref = parent.children;
            for (i = 0, len = ref.length; i < len; i++) {
              child = ref[i];
              if (child.type === NodeType.Element) {
                this.name = child.name;
                break;
              }
            }
          }
          this.documentObject = parent;
          if (isObject(pubID)) {
            ref1 = pubID, pubID = ref1.pubID, sysID = ref1.sysID;
          }
          if (sysID == null) {
            ref2 = [pubID, sysID], sysID = ref2[0], pubID = ref2[1];
          }
          if (pubID != null) {
            this.pubID = this.stringify.dtdPubID(pubID);
          }
          if (sysID != null) {
            this.sysID = this.stringify.dtdSysID(sysID);
          }
        }
        Object.defineProperty(XMLDocType2.prototype, "entities", {
          get: function() {
            var child, i, len, nodes, ref;
            nodes = {};
            ref = this.children;
            for (i = 0, len = ref.length; i < len; i++) {
              child = ref[i];
              if (child.type === NodeType.EntityDeclaration && !child.pe) {
                nodes[child.name] = child;
              }
            }
            return new XMLNamedNodeMap(nodes);
          }
        });
        Object.defineProperty(XMLDocType2.prototype, "notations", {
          get: function() {
            var child, i, len, nodes, ref;
            nodes = {};
            ref = this.children;
            for (i = 0, len = ref.length; i < len; i++) {
              child = ref[i];
              if (child.type === NodeType.NotationDeclaration) {
                nodes[child.name] = child;
              }
            }
            return new XMLNamedNodeMap(nodes);
          }
        });
        Object.defineProperty(XMLDocType2.prototype, "publicId", {
          get: function() {
            return this.pubID;
          }
        });
        Object.defineProperty(XMLDocType2.prototype, "systemId", {
          get: function() {
            return this.sysID;
          }
        });
        Object.defineProperty(XMLDocType2.prototype, "internalSubset", {
          get: function() {
            throw new Error("This DOM method is not implemented." + this.debugInfo());
          }
        });
        XMLDocType2.prototype.element = function(name, value) {
          var child;
          child = new XMLDTDElement(this, name, value);
          this.children.push(child);
          return this;
        };
        XMLDocType2.prototype.attList = function(elementName, attributeName, attributeType, defaultValueType, defaultValue) {
          var child;
          child = new XMLDTDAttList(this, elementName, attributeName, attributeType, defaultValueType, defaultValue);
          this.children.push(child);
          return this;
        };
        XMLDocType2.prototype.entity = function(name, value) {
          var child;
          child = new XMLDTDEntity(this, false, name, value);
          this.children.push(child);
          return this;
        };
        XMLDocType2.prototype.pEntity = function(name, value) {
          var child;
          child = new XMLDTDEntity(this, true, name, value);
          this.children.push(child);
          return this;
        };
        XMLDocType2.prototype.notation = function(name, value) {
          var child;
          child = new XMLDTDNotation(this, name, value);
          this.children.push(child);
          return this;
        };
        XMLDocType2.prototype.toString = function(options) {
          return this.options.writer.docType(this, this.options.writer.filterOptions(options));
        };
        XMLDocType2.prototype.ele = function(name, value) {
          return this.element(name, value);
        };
        XMLDocType2.prototype.att = function(elementName, attributeName, attributeType, defaultValueType, defaultValue) {
          return this.attList(elementName, attributeName, attributeType, defaultValueType, defaultValue);
        };
        XMLDocType2.prototype.ent = function(name, value) {
          return this.entity(name, value);
        };
        XMLDocType2.prototype.pent = function(name, value) {
          return this.pEntity(name, value);
        };
        XMLDocType2.prototype.not = function(name, value) {
          return this.notation(name, value);
        };
        XMLDocType2.prototype.up = function() {
          return this.root() || this.documentObject;
        };
        XMLDocType2.prototype.isEqualNode = function(node) {
          if (!XMLDocType2.__super__.isEqualNode.apply(this, arguments).isEqualNode(node)) {
            return false;
          }
          if (node.name !== this.name) {
            return false;
          }
          if (node.publicId !== this.publicId) {
            return false;
          }
          if (node.systemId !== this.systemId) {
            return false;
          }
          return true;
        };
        return XMLDocType2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLRaw.js
var require_XMLRaw = __commonJS({
  "node_modules/xmlbuilder/lib/XMLRaw.js"(exports2, module2) {
    (function() {
      var NodeType, XMLNode, XMLRaw, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      NodeType = require_NodeType();
      XMLNode = require_XMLNode();
      module2.exports = XMLRaw = function(superClass) {
        extend(XMLRaw2, superClass);
        function XMLRaw2(parent, text) {
          XMLRaw2.__super__.constructor.call(this, parent);
          if (text == null) {
            throw new Error("Missing raw text. " + this.debugInfo());
          }
          this.type = NodeType.Raw;
          this.value = this.stringify.raw(text);
        }
        XMLRaw2.prototype.clone = function() {
          return Object.create(this);
        };
        XMLRaw2.prototype.toString = function(options) {
          return this.options.writer.raw(this, this.options.writer.filterOptions(options));
        };
        return XMLRaw2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLText.js
var require_XMLText = __commonJS({
  "node_modules/xmlbuilder/lib/XMLText.js"(exports2, module2) {
    (function() {
      var NodeType, XMLCharacterData, XMLText, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      NodeType = require_NodeType();
      XMLCharacterData = require_XMLCharacterData();
      module2.exports = XMLText = function(superClass) {
        extend(XMLText2, superClass);
        function XMLText2(parent, text) {
          XMLText2.__super__.constructor.call(this, parent);
          if (text == null) {
            throw new Error("Missing element text. " + this.debugInfo());
          }
          this.name = "#text";
          this.type = NodeType.Text;
          this.value = this.stringify.text(text);
        }
        Object.defineProperty(XMLText2.prototype, "isElementContentWhitespace", {
          get: function() {
            throw new Error("This DOM method is not implemented." + this.debugInfo());
          }
        });
        Object.defineProperty(XMLText2.prototype, "wholeText", {
          get: function() {
            var next, prev, str;
            str = "";
            prev = this.previousSibling;
            while (prev) {
              str = prev.data + str;
              prev = prev.previousSibling;
            }
            str += this.data;
            next = this.nextSibling;
            while (next) {
              str = str + next.data;
              next = next.nextSibling;
            }
            return str;
          }
        });
        XMLText2.prototype.clone = function() {
          return Object.create(this);
        };
        XMLText2.prototype.toString = function(options) {
          return this.options.writer.text(this, this.options.writer.filterOptions(options));
        };
        XMLText2.prototype.splitText = function(offset) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLText2.prototype.replaceWholeText = function(content) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        return XMLText2;
      }(XMLCharacterData);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLProcessingInstruction.js
var require_XMLProcessingInstruction = __commonJS({
  "node_modules/xmlbuilder/lib/XMLProcessingInstruction.js"(exports2, module2) {
    (function() {
      var NodeType, XMLCharacterData, XMLProcessingInstruction, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      NodeType = require_NodeType();
      XMLCharacterData = require_XMLCharacterData();
      module2.exports = XMLProcessingInstruction = function(superClass) {
        extend(XMLProcessingInstruction2, superClass);
        function XMLProcessingInstruction2(parent, target, value) {
          XMLProcessingInstruction2.__super__.constructor.call(this, parent);
          if (target == null) {
            throw new Error("Missing instruction target. " + this.debugInfo());
          }
          this.type = NodeType.ProcessingInstruction;
          this.target = this.stringify.insTarget(target);
          this.name = this.target;
          if (value) {
            this.value = this.stringify.insValue(value);
          }
        }
        XMLProcessingInstruction2.prototype.clone = function() {
          return Object.create(this);
        };
        XMLProcessingInstruction2.prototype.toString = function(options) {
          return this.options.writer.processingInstruction(this, this.options.writer.filterOptions(options));
        };
        XMLProcessingInstruction2.prototype.isEqualNode = function(node) {
          if (!XMLProcessingInstruction2.__super__.isEqualNode.apply(this, arguments).isEqualNode(node)) {
            return false;
          }
          if (node.target !== this.target) {
            return false;
          }
          return true;
        };
        return XMLProcessingInstruction2;
      }(XMLCharacterData);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDummy.js
var require_XMLDummy = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDummy.js"(exports2, module2) {
    (function() {
      var NodeType, XMLDummy, XMLNode, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      XMLNode = require_XMLNode();
      NodeType = require_NodeType();
      module2.exports = XMLDummy = function(superClass) {
        extend(XMLDummy2, superClass);
        function XMLDummy2(parent) {
          XMLDummy2.__super__.constructor.call(this, parent);
          this.type = NodeType.Dummy;
        }
        XMLDummy2.prototype.clone = function() {
          return Object.create(this);
        };
        XMLDummy2.prototype.toString = function(options) {
          return "";
        };
        return XMLDummy2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLNodeList.js
var require_XMLNodeList = __commonJS({
  "node_modules/xmlbuilder/lib/XMLNodeList.js"(exports2, module2) {
    (function() {
      var XMLNodeList;
      module2.exports = XMLNodeList = function() {
        function XMLNodeList2(nodes) {
          this.nodes = nodes;
        }
        Object.defineProperty(XMLNodeList2.prototype, "length", {
          get: function() {
            return this.nodes.length || 0;
          }
        });
        XMLNodeList2.prototype.clone = function() {
          return this.nodes = null;
        };
        XMLNodeList2.prototype.item = function(index) {
          return this.nodes[index] || null;
        };
        return XMLNodeList2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/DocumentPosition.js
var require_DocumentPosition = __commonJS({
  "node_modules/xmlbuilder/lib/DocumentPosition.js"(exports2, module2) {
    (function() {
      module2.exports = {
        Disconnected: 1,
        Preceding: 2,
        Following: 4,
        Contains: 8,
        ContainedBy: 16,
        ImplementationSpecific: 32
      };
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLNode.js
var require_XMLNode = __commonJS({
  "node_modules/xmlbuilder/lib/XMLNode.js"(exports2, module2) {
    (function() {
      var DocumentPosition, NodeType, XMLCData, XMLComment, XMLDeclaration, XMLDocType, XMLDummy, XMLElement, XMLNamedNodeMap, XMLNode, XMLNodeList, XMLProcessingInstruction, XMLRaw, XMLText, getValue, isEmpty, isFunction, isObject, ref1, hasProp = {}.hasOwnProperty;
      ref1 = require_Utility(), isObject = ref1.isObject, isFunction = ref1.isFunction, isEmpty = ref1.isEmpty, getValue = ref1.getValue;
      XMLElement = null;
      XMLCData = null;
      XMLComment = null;
      XMLDeclaration = null;
      XMLDocType = null;
      XMLRaw = null;
      XMLText = null;
      XMLProcessingInstruction = null;
      XMLDummy = null;
      NodeType = null;
      XMLNodeList = null;
      XMLNamedNodeMap = null;
      DocumentPosition = null;
      module2.exports = XMLNode = function() {
        function XMLNode2(parent1) {
          this.parent = parent1;
          if (this.parent) {
            this.options = this.parent.options;
            this.stringify = this.parent.stringify;
          }
          this.value = null;
          this.children = [];
          this.baseURI = null;
          if (!XMLElement) {
            XMLElement = require_XMLElement();
            XMLCData = require_XMLCData();
            XMLComment = require_XMLComment();
            XMLDeclaration = require_XMLDeclaration();
            XMLDocType = require_XMLDocType();
            XMLRaw = require_XMLRaw();
            XMLText = require_XMLText();
            XMLProcessingInstruction = require_XMLProcessingInstruction();
            XMLDummy = require_XMLDummy();
            NodeType = require_NodeType();
            XMLNodeList = require_XMLNodeList();
            XMLNamedNodeMap = require_XMLNamedNodeMap();
            DocumentPosition = require_DocumentPosition();
          }
        }
        Object.defineProperty(XMLNode2.prototype, "nodeName", {
          get: function() {
            return this.name;
          }
        });
        Object.defineProperty(XMLNode2.prototype, "nodeType", {
          get: function() {
            return this.type;
          }
        });
        Object.defineProperty(XMLNode2.prototype, "nodeValue", {
          get: function() {
            return this.value;
          }
        });
        Object.defineProperty(XMLNode2.prototype, "parentNode", {
          get: function() {
            return this.parent;
          }
        });
        Object.defineProperty(XMLNode2.prototype, "childNodes", {
          get: function() {
            if (!this.childNodeList || !this.childNodeList.nodes) {
              this.childNodeList = new XMLNodeList(this.children);
            }
            return this.childNodeList;
          }
        });
        Object.defineProperty(XMLNode2.prototype, "firstChild", {
          get: function() {
            return this.children[0] || null;
          }
        });
        Object.defineProperty(XMLNode2.prototype, "lastChild", {
          get: function() {
            return this.children[this.children.length - 1] || null;
          }
        });
        Object.defineProperty(XMLNode2.prototype, "previousSibling", {
          get: function() {
            var i;
            i = this.parent.children.indexOf(this);
            return this.parent.children[i - 1] || null;
          }
        });
        Object.defineProperty(XMLNode2.prototype, "nextSibling", {
          get: function() {
            var i;
            i = this.parent.children.indexOf(this);
            return this.parent.children[i + 1] || null;
          }
        });
        Object.defineProperty(XMLNode2.prototype, "ownerDocument", {
          get: function() {
            return this.document() || null;
          }
        });
        Object.defineProperty(XMLNode2.prototype, "textContent", {
          get: function() {
            var child, j, len, ref2, str;
            if (this.nodeType === NodeType.Element || this.nodeType === NodeType.DocumentFragment) {
              str = "";
              ref2 = this.children;
              for (j = 0, len = ref2.length; j < len; j++) {
                child = ref2[j];
                if (child.textContent) {
                  str += child.textContent;
                }
              }
              return str;
            } else {
              return null;
            }
          },
          set: function(value) {
            throw new Error("This DOM method is not implemented." + this.debugInfo());
          }
        });
        XMLNode2.prototype.setParent = function(parent) {
          var child, j, len, ref2, results;
          this.parent = parent;
          if (parent) {
            this.options = parent.options;
            this.stringify = parent.stringify;
          }
          ref2 = this.children;
          results = [];
          for (j = 0, len = ref2.length; j < len; j++) {
            child = ref2[j];
            results.push(child.setParent(this));
          }
          return results;
        };
        XMLNode2.prototype.element = function(name, attributes, text) {
          var childNode, item, j, k, key, lastChild, len, len1, ref2, ref3, val;
          lastChild = null;
          if (attributes === null && text == null) {
            ref2 = [{}, null], attributes = ref2[0], text = ref2[1];
          }
          if (attributes == null) {
            attributes = {};
          }
          attributes = getValue(attributes);
          if (!isObject(attributes)) {
            ref3 = [attributes, text], text = ref3[0], attributes = ref3[1];
          }
          if (name != null) {
            name = getValue(name);
          }
          if (Array.isArray(name)) {
            for (j = 0, len = name.length; j < len; j++) {
              item = name[j];
              lastChild = this.element(item);
            }
          } else if (isFunction(name)) {
            lastChild = this.element(name.apply());
          } else if (isObject(name)) {
            for (key in name) {
              if (!hasProp.call(name, key)) continue;
              val = name[key];
              if (isFunction(val)) {
                val = val.apply();
              }
              if (!this.options.ignoreDecorators && this.stringify.convertAttKey && key.indexOf(this.stringify.convertAttKey) === 0) {
                lastChild = this.attribute(key.substr(this.stringify.convertAttKey.length), val);
              } else if (!this.options.separateArrayItems && Array.isArray(val) && isEmpty(val)) {
                lastChild = this.dummy();
              } else if (isObject(val) && isEmpty(val)) {
                lastChild = this.element(key);
              } else if (!this.options.keepNullNodes && val == null) {
                lastChild = this.dummy();
              } else if (!this.options.separateArrayItems && Array.isArray(val)) {
                for (k = 0, len1 = val.length; k < len1; k++) {
                  item = val[k];
                  childNode = {};
                  childNode[key] = item;
                  lastChild = this.element(childNode);
                }
              } else if (isObject(val)) {
                if (!this.options.ignoreDecorators && this.stringify.convertTextKey && key.indexOf(this.stringify.convertTextKey) === 0) {
                  lastChild = this.element(val);
                } else {
                  lastChild = this.element(key);
                  lastChild.element(val);
                }
              } else {
                lastChild = this.element(key, val);
              }
            }
          } else if (!this.options.keepNullNodes && text === null) {
            lastChild = this.dummy();
          } else {
            if (!this.options.ignoreDecorators && this.stringify.convertTextKey && name.indexOf(this.stringify.convertTextKey) === 0) {
              lastChild = this.text(text);
            } else if (!this.options.ignoreDecorators && this.stringify.convertCDataKey && name.indexOf(this.stringify.convertCDataKey) === 0) {
              lastChild = this.cdata(text);
            } else if (!this.options.ignoreDecorators && this.stringify.convertCommentKey && name.indexOf(this.stringify.convertCommentKey) === 0) {
              lastChild = this.comment(text);
            } else if (!this.options.ignoreDecorators && this.stringify.convertRawKey && name.indexOf(this.stringify.convertRawKey) === 0) {
              lastChild = this.raw(text);
            } else if (!this.options.ignoreDecorators && this.stringify.convertPIKey && name.indexOf(this.stringify.convertPIKey) === 0) {
              lastChild = this.instruction(name.substr(this.stringify.convertPIKey.length), text);
            } else {
              lastChild = this.node(name, attributes, text);
            }
          }
          if (lastChild == null) {
            throw new Error("Could not create any elements with: " + name + ". " + this.debugInfo());
          }
          return lastChild;
        };
        XMLNode2.prototype.insertBefore = function(name, attributes, text) {
          var child, i, newChild, refChild, removed;
          if (name != null ? name.type : void 0) {
            newChild = name;
            refChild = attributes;
            newChild.setParent(this);
            if (refChild) {
              i = children.indexOf(refChild);
              removed = children.splice(i);
              children.push(newChild);
              Array.prototype.push.apply(children, removed);
            } else {
              children.push(newChild);
            }
            return newChild;
          } else {
            if (this.isRoot) {
              throw new Error("Cannot insert elements at root level. " + this.debugInfo(name));
            }
            i = this.parent.children.indexOf(this);
            removed = this.parent.children.splice(i);
            child = this.parent.element(name, attributes, text);
            Array.prototype.push.apply(this.parent.children, removed);
            return child;
          }
        };
        XMLNode2.prototype.insertAfter = function(name, attributes, text) {
          var child, i, removed;
          if (this.isRoot) {
            throw new Error("Cannot insert elements at root level. " + this.debugInfo(name));
          }
          i = this.parent.children.indexOf(this);
          removed = this.parent.children.splice(i + 1);
          child = this.parent.element(name, attributes, text);
          Array.prototype.push.apply(this.parent.children, removed);
          return child;
        };
        XMLNode2.prototype.remove = function() {
          var i, ref2;
          if (this.isRoot) {
            throw new Error("Cannot remove the root element. " + this.debugInfo());
          }
          i = this.parent.children.indexOf(this);
          [].splice.apply(this.parent.children, [i, i - i + 1].concat(ref2 = [])), ref2;
          return this.parent;
        };
        XMLNode2.prototype.node = function(name, attributes, text) {
          var child, ref2;
          if (name != null) {
            name = getValue(name);
          }
          attributes || (attributes = {});
          attributes = getValue(attributes);
          if (!isObject(attributes)) {
            ref2 = [attributes, text], text = ref2[0], attributes = ref2[1];
          }
          child = new XMLElement(this, name, attributes);
          if (text != null) {
            child.text(text);
          }
          this.children.push(child);
          return child;
        };
        XMLNode2.prototype.text = function(value) {
          var child;
          if (isObject(value)) {
            this.element(value);
          }
          child = new XMLText(this, value);
          this.children.push(child);
          return this;
        };
        XMLNode2.prototype.cdata = function(value) {
          var child;
          child = new XMLCData(this, value);
          this.children.push(child);
          return this;
        };
        XMLNode2.prototype.comment = function(value) {
          var child;
          child = new XMLComment(this, value);
          this.children.push(child);
          return this;
        };
        XMLNode2.prototype.commentBefore = function(value) {
          var child, i, removed;
          i = this.parent.children.indexOf(this);
          removed = this.parent.children.splice(i);
          child = this.parent.comment(value);
          Array.prototype.push.apply(this.parent.children, removed);
          return this;
        };
        XMLNode2.prototype.commentAfter = function(value) {
          var child, i, removed;
          i = this.parent.children.indexOf(this);
          removed = this.parent.children.splice(i + 1);
          child = this.parent.comment(value);
          Array.prototype.push.apply(this.parent.children, removed);
          return this;
        };
        XMLNode2.prototype.raw = function(value) {
          var child;
          child = new XMLRaw(this, value);
          this.children.push(child);
          return this;
        };
        XMLNode2.prototype.dummy = function() {
          var child;
          child = new XMLDummy(this);
          return child;
        };
        XMLNode2.prototype.instruction = function(target, value) {
          var insTarget, insValue, instruction, j, len;
          if (target != null) {
            target = getValue(target);
          }
          if (value != null) {
            value = getValue(value);
          }
          if (Array.isArray(target)) {
            for (j = 0, len = target.length; j < len; j++) {
              insTarget = target[j];
              this.instruction(insTarget);
            }
          } else if (isObject(target)) {
            for (insTarget in target) {
              if (!hasProp.call(target, insTarget)) continue;
              insValue = target[insTarget];
              this.instruction(insTarget, insValue);
            }
          } else {
            if (isFunction(value)) {
              value = value.apply();
            }
            instruction = new XMLProcessingInstruction(this, target, value);
            this.children.push(instruction);
          }
          return this;
        };
        XMLNode2.prototype.instructionBefore = function(target, value) {
          var child, i, removed;
          i = this.parent.children.indexOf(this);
          removed = this.parent.children.splice(i);
          child = this.parent.instruction(target, value);
          Array.prototype.push.apply(this.parent.children, removed);
          return this;
        };
        XMLNode2.prototype.instructionAfter = function(target, value) {
          var child, i, removed;
          i = this.parent.children.indexOf(this);
          removed = this.parent.children.splice(i + 1);
          child = this.parent.instruction(target, value);
          Array.prototype.push.apply(this.parent.children, removed);
          return this;
        };
        XMLNode2.prototype.declaration = function(version, encoding, standalone) {
          var doc, xmldec;
          doc = this.document();
          xmldec = new XMLDeclaration(doc, version, encoding, standalone);
          if (doc.children.length === 0) {
            doc.children.unshift(xmldec);
          } else if (doc.children[0].type === NodeType.Declaration) {
            doc.children[0] = xmldec;
          } else {
            doc.children.unshift(xmldec);
          }
          return doc.root() || doc;
        };
        XMLNode2.prototype.dtd = function(pubID, sysID) {
          var child, doc, doctype, i, j, k, len, len1, ref2, ref3;
          doc = this.document();
          doctype = new XMLDocType(doc, pubID, sysID);
          ref2 = doc.children;
          for (i = j = 0, len = ref2.length; j < len; i = ++j) {
            child = ref2[i];
            if (child.type === NodeType.DocType) {
              doc.children[i] = doctype;
              return doctype;
            }
          }
          ref3 = doc.children;
          for (i = k = 0, len1 = ref3.length; k < len1; i = ++k) {
            child = ref3[i];
            if (child.isRoot) {
              doc.children.splice(i, 0, doctype);
              return doctype;
            }
          }
          doc.children.push(doctype);
          return doctype;
        };
        XMLNode2.prototype.up = function() {
          if (this.isRoot) {
            throw new Error("The root node has no parent. Use doc() if you need to get the document object.");
          }
          return this.parent;
        };
        XMLNode2.prototype.root = function() {
          var node;
          node = this;
          while (node) {
            if (node.type === NodeType.Document) {
              return node.rootObject;
            } else if (node.isRoot) {
              return node;
            } else {
              node = node.parent;
            }
          }
        };
        XMLNode2.prototype.document = function() {
          var node;
          node = this;
          while (node) {
            if (node.type === NodeType.Document) {
              return node;
            } else {
              node = node.parent;
            }
          }
        };
        XMLNode2.prototype.end = function(options) {
          return this.document().end(options);
        };
        XMLNode2.prototype.prev = function() {
          var i;
          i = this.parent.children.indexOf(this);
          if (i < 1) {
            throw new Error("Already at the first node. " + this.debugInfo());
          }
          return this.parent.children[i - 1];
        };
        XMLNode2.prototype.next = function() {
          var i;
          i = this.parent.children.indexOf(this);
          if (i === -1 || i === this.parent.children.length - 1) {
            throw new Error("Already at the last node. " + this.debugInfo());
          }
          return this.parent.children[i + 1];
        };
        XMLNode2.prototype.importDocument = function(doc) {
          var clonedRoot;
          clonedRoot = doc.root().clone();
          clonedRoot.parent = this;
          clonedRoot.isRoot = false;
          this.children.push(clonedRoot);
          return this;
        };
        XMLNode2.prototype.debugInfo = function(name) {
          var ref2, ref3;
          name = name || this.name;
          if (name == null && !((ref2 = this.parent) != null ? ref2.name : void 0)) {
            return "";
          } else if (name == null) {
            return "parent: <" + this.parent.name + ">";
          } else if (!((ref3 = this.parent) != null ? ref3.name : void 0)) {
            return "node: <" + name + ">";
          } else {
            return "node: <" + name + ">, parent: <" + this.parent.name + ">";
          }
        };
        XMLNode2.prototype.ele = function(name, attributes, text) {
          return this.element(name, attributes, text);
        };
        XMLNode2.prototype.nod = function(name, attributes, text) {
          return this.node(name, attributes, text);
        };
        XMLNode2.prototype.txt = function(value) {
          return this.text(value);
        };
        XMLNode2.prototype.dat = function(value) {
          return this.cdata(value);
        };
        XMLNode2.prototype.com = function(value) {
          return this.comment(value);
        };
        XMLNode2.prototype.ins = function(target, value) {
          return this.instruction(target, value);
        };
        XMLNode2.prototype.doc = function() {
          return this.document();
        };
        XMLNode2.prototype.dec = function(version, encoding, standalone) {
          return this.declaration(version, encoding, standalone);
        };
        XMLNode2.prototype.e = function(name, attributes, text) {
          return this.element(name, attributes, text);
        };
        XMLNode2.prototype.n = function(name, attributes, text) {
          return this.node(name, attributes, text);
        };
        XMLNode2.prototype.t = function(value) {
          return this.text(value);
        };
        XMLNode2.prototype.d = function(value) {
          return this.cdata(value);
        };
        XMLNode2.prototype.c = function(value) {
          return this.comment(value);
        };
        XMLNode2.prototype.r = function(value) {
          return this.raw(value);
        };
        XMLNode2.prototype.i = function(target, value) {
          return this.instruction(target, value);
        };
        XMLNode2.prototype.u = function() {
          return this.up();
        };
        XMLNode2.prototype.importXMLBuilder = function(doc) {
          return this.importDocument(doc);
        };
        XMLNode2.prototype.replaceChild = function(newChild, oldChild) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.removeChild = function(oldChild) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.appendChild = function(newChild) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.hasChildNodes = function() {
          return this.children.length !== 0;
        };
        XMLNode2.prototype.cloneNode = function(deep) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.normalize = function() {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.isSupported = function(feature, version) {
          return true;
        };
        XMLNode2.prototype.hasAttributes = function() {
          return this.attribs.length !== 0;
        };
        XMLNode2.prototype.compareDocumentPosition = function(other) {
          var ref, res;
          ref = this;
          if (ref === other) {
            return 0;
          } else if (this.document() !== other.document()) {
            res = DocumentPosition.Disconnected | DocumentPosition.ImplementationSpecific;
            if (Math.random() < 0.5) {
              res |= DocumentPosition.Preceding;
            } else {
              res |= DocumentPosition.Following;
            }
            return res;
          } else if (ref.isAncestor(other)) {
            return DocumentPosition.Contains | DocumentPosition.Preceding;
          } else if (ref.isDescendant(other)) {
            return DocumentPosition.Contains | DocumentPosition.Following;
          } else if (ref.isPreceding(other)) {
            return DocumentPosition.Preceding;
          } else {
            return DocumentPosition.Following;
          }
        };
        XMLNode2.prototype.isSameNode = function(other) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.lookupPrefix = function(namespaceURI) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.isDefaultNamespace = function(namespaceURI) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.lookupNamespaceURI = function(prefix) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.isEqualNode = function(node) {
          var i, j, ref2;
          if (node.nodeType !== this.nodeType) {
            return false;
          }
          if (node.children.length !== this.children.length) {
            return false;
          }
          for (i = j = 0, ref2 = this.children.length - 1; 0 <= ref2 ? j <= ref2 : j >= ref2; i = 0 <= ref2 ? ++j : --j) {
            if (!this.children[i].isEqualNode(node.children[i])) {
              return false;
            }
          }
          return true;
        };
        XMLNode2.prototype.getFeature = function(feature, version) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.setUserData = function(key, data, handler) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.getUserData = function(key) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLNode2.prototype.contains = function(other) {
          if (!other) {
            return false;
          }
          return other === this || this.isDescendant(other);
        };
        XMLNode2.prototype.isDescendant = function(node) {
          var child, isDescendantChild, j, len, ref2;
          ref2 = this.children;
          for (j = 0, len = ref2.length; j < len; j++) {
            child = ref2[j];
            if (node === child) {
              return true;
            }
            isDescendantChild = child.isDescendant(node);
            if (isDescendantChild) {
              return true;
            }
          }
          return false;
        };
        XMLNode2.prototype.isAncestor = function(node) {
          return node.isDescendant(this);
        };
        XMLNode2.prototype.isPreceding = function(node) {
          var nodePos, thisPos;
          nodePos = this.treePosition(node);
          thisPos = this.treePosition(this);
          if (nodePos === -1 || thisPos === -1) {
            return false;
          } else {
            return nodePos < thisPos;
          }
        };
        XMLNode2.prototype.isFollowing = function(node) {
          var nodePos, thisPos;
          nodePos = this.treePosition(node);
          thisPos = this.treePosition(this);
          if (nodePos === -1 || thisPos === -1) {
            return false;
          } else {
            return nodePos > thisPos;
          }
        };
        XMLNode2.prototype.treePosition = function(node) {
          var found, pos;
          pos = 0;
          found = false;
          this.foreachTreeNode(this.document(), function(childNode) {
            pos++;
            if (!found && childNode === node) {
              return found = true;
            }
          });
          if (found) {
            return pos;
          } else {
            return -1;
          }
        };
        XMLNode2.prototype.foreachTreeNode = function(node, func) {
          var child, j, len, ref2, res;
          node || (node = this.document());
          ref2 = node.children;
          for (j = 0, len = ref2.length; j < len; j++) {
            child = ref2[j];
            if (res = func(child)) {
              return res;
            } else {
              res = this.foreachTreeNode(child, func);
              if (res) {
                return res;
              }
            }
          }
        };
        return XMLNode2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLStringifier.js
var require_XMLStringifier = __commonJS({
  "node_modules/xmlbuilder/lib/XMLStringifier.js"(exports2, module2) {
    (function() {
      var XMLStringifier, bind = function(fn, me) {
        return function() {
          return fn.apply(me, arguments);
        };
      }, hasProp = {}.hasOwnProperty;
      module2.exports = XMLStringifier = function() {
        function XMLStringifier2(options) {
          this.assertLegalName = bind(this.assertLegalName, this);
          this.assertLegalChar = bind(this.assertLegalChar, this);
          var key, ref, value;
          options || (options = {});
          this.options = options;
          if (!this.options.version) {
            this.options.version = "1.0";
          }
          ref = options.stringify || {};
          for (key in ref) {
            if (!hasProp.call(ref, key)) continue;
            value = ref[key];
            this[key] = value;
          }
        }
        XMLStringifier2.prototype.name = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalName("" + val || "");
        };
        XMLStringifier2.prototype.text = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalChar(this.textEscape("" + val || ""));
        };
        XMLStringifier2.prototype.cdata = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          val = "" + val || "";
          val = val.replace("]]>", "]]]]><![CDATA[>");
          return this.assertLegalChar(val);
        };
        XMLStringifier2.prototype.comment = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          val = "" + val || "";
          if (val.match(/--/)) {
            throw new Error("Comment text cannot contain double-hypen: " + val);
          }
          return this.assertLegalChar(val);
        };
        XMLStringifier2.prototype.raw = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return "" + val || "";
        };
        XMLStringifier2.prototype.attValue = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalChar(this.attEscape(val = "" + val || ""));
        };
        XMLStringifier2.prototype.insTarget = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalChar("" + val || "");
        };
        XMLStringifier2.prototype.insValue = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          val = "" + val || "";
          if (val.match(/\?>/)) {
            throw new Error("Invalid processing instruction value: " + val);
          }
          return this.assertLegalChar(val);
        };
        XMLStringifier2.prototype.xmlVersion = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          val = "" + val || "";
          if (!val.match(/1\.[0-9]+/)) {
            throw new Error("Invalid version number: " + val);
          }
          return val;
        };
        XMLStringifier2.prototype.xmlEncoding = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          val = "" + val || "";
          if (!val.match(/^[A-Za-z](?:[A-Za-z0-9._-])*$/)) {
            throw new Error("Invalid encoding: " + val);
          }
          return this.assertLegalChar(val);
        };
        XMLStringifier2.prototype.xmlStandalone = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          if (val) {
            return "yes";
          } else {
            return "no";
          }
        };
        XMLStringifier2.prototype.dtdPubID = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalChar("" + val || "");
        };
        XMLStringifier2.prototype.dtdSysID = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalChar("" + val || "");
        };
        XMLStringifier2.prototype.dtdElementValue = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalChar("" + val || "");
        };
        XMLStringifier2.prototype.dtdAttType = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalChar("" + val || "");
        };
        XMLStringifier2.prototype.dtdAttDefault = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalChar("" + val || "");
        };
        XMLStringifier2.prototype.dtdEntityValue = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalChar("" + val || "");
        };
        XMLStringifier2.prototype.dtdNData = function(val) {
          if (this.options.noValidation) {
            return val;
          }
          return this.assertLegalChar("" + val || "");
        };
        XMLStringifier2.prototype.convertAttKey = "@";
        XMLStringifier2.prototype.convertPIKey = "?";
        XMLStringifier2.prototype.convertTextKey = "#text";
        XMLStringifier2.prototype.convertCDataKey = "#cdata";
        XMLStringifier2.prototype.convertCommentKey = "#comment";
        XMLStringifier2.prototype.convertRawKey = "#raw";
        XMLStringifier2.prototype.assertLegalChar = function(str) {
          var regex, res;
          if (this.options.noValidation) {
            return str;
          }
          regex = "";
          if (this.options.version === "1.0") {
            regex = /[\0-\x08\x0B\f\x0E-\x1F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
            if (res = str.match(regex)) {
              throw new Error("Invalid character in string: " + str + " at index " + res.index);
            }
          } else if (this.options.version === "1.1") {
            regex = /[\0\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
            if (res = str.match(regex)) {
              throw new Error("Invalid character in string: " + str + " at index " + res.index);
            }
          }
          return str;
        };
        XMLStringifier2.prototype.assertLegalName = function(str) {
          var regex;
          if (this.options.noValidation) {
            return str;
          }
          this.assertLegalChar(str);
          regex = /^([:A-Z_a-z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])([\x2D\.0-:A-Z_a-z\xB7\xC0-\xD6\xD8-\xF6\xF8-\u037D\u037F-\u1FFF\u200C\u200D\u203F\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])*$/;
          if (!str.match(regex)) {
            throw new Error("Invalid character in name");
          }
          return str;
        };
        XMLStringifier2.prototype.textEscape = function(str) {
          var ampregex;
          if (this.options.noValidation) {
            return str;
          }
          ampregex = this.options.noDoubleEncoding ? /(?!&\S+;)&/g : /&/g;
          return str.replace(ampregex, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#xD;");
        };
        XMLStringifier2.prototype.attEscape = function(str) {
          var ampregex;
          if (this.options.noValidation) {
            return str;
          }
          ampregex = this.options.noDoubleEncoding ? /(?!&\S+;)&/g : /&/g;
          return str.replace(ampregex, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace(/\t/g, "&#x9;").replace(/\n/g, "&#xA;").replace(/\r/g, "&#xD;");
        };
        return XMLStringifier2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/WriterState.js
var require_WriterState = __commonJS({
  "node_modules/xmlbuilder/lib/WriterState.js"(exports2, module2) {
    (function() {
      module2.exports = {
        None: 0,
        OpenTag: 1,
        InsideTag: 2,
        CloseTag: 3
      };
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLWriterBase.js
var require_XMLWriterBase = __commonJS({
  "node_modules/xmlbuilder/lib/XMLWriterBase.js"(exports2, module2) {
    (function() {
      var NodeType, WriterState, XMLCData, XMLComment, XMLDTDAttList, XMLDTDElement, XMLDTDEntity, XMLDTDNotation, XMLDeclaration, XMLDocType, XMLDummy, XMLElement, XMLProcessingInstruction, XMLRaw, XMLText, XMLWriterBase, assign, hasProp = {}.hasOwnProperty;
      assign = require_Utility().assign;
      NodeType = require_NodeType();
      XMLDeclaration = require_XMLDeclaration();
      XMLDocType = require_XMLDocType();
      XMLCData = require_XMLCData();
      XMLComment = require_XMLComment();
      XMLElement = require_XMLElement();
      XMLRaw = require_XMLRaw();
      XMLText = require_XMLText();
      XMLProcessingInstruction = require_XMLProcessingInstruction();
      XMLDummy = require_XMLDummy();
      XMLDTDAttList = require_XMLDTDAttList();
      XMLDTDElement = require_XMLDTDElement();
      XMLDTDEntity = require_XMLDTDEntity();
      XMLDTDNotation = require_XMLDTDNotation();
      WriterState = require_WriterState();
      module2.exports = XMLWriterBase = function() {
        function XMLWriterBase2(options) {
          var key, ref, value;
          options || (options = {});
          this.options = options;
          ref = options.writer || {};
          for (key in ref) {
            if (!hasProp.call(ref, key)) continue;
            value = ref[key];
            this["_" + key] = this[key];
            this[key] = value;
          }
        }
        XMLWriterBase2.prototype.filterOptions = function(options) {
          var filteredOptions, ref, ref1, ref2, ref3, ref4, ref5, ref6;
          options || (options = {});
          options = assign({}, this.options, options);
          filteredOptions = {
            writer: this
          };
          filteredOptions.pretty = options.pretty || false;
          filteredOptions.allowEmpty = options.allowEmpty || false;
          filteredOptions.indent = (ref = options.indent) != null ? ref : "  ";
          filteredOptions.newline = (ref1 = options.newline) != null ? ref1 : "\n";
          filteredOptions.offset = (ref2 = options.offset) != null ? ref2 : 0;
          filteredOptions.dontPrettyTextNodes = (ref3 = (ref4 = options.dontPrettyTextNodes) != null ? ref4 : options.dontprettytextnodes) != null ? ref3 : 0;
          filteredOptions.spaceBeforeSlash = (ref5 = (ref6 = options.spaceBeforeSlash) != null ? ref6 : options.spacebeforeslash) != null ? ref5 : "";
          if (filteredOptions.spaceBeforeSlash === true) {
            filteredOptions.spaceBeforeSlash = " ";
          }
          filteredOptions.suppressPrettyCount = 0;
          filteredOptions.user = {};
          filteredOptions.state = WriterState.None;
          return filteredOptions;
        };
        XMLWriterBase2.prototype.indent = function(node, options, level) {
          var indentLevel;
          if (!options.pretty || options.suppressPrettyCount) {
            return "";
          } else if (options.pretty) {
            indentLevel = (level || 0) + options.offset + 1;
            if (indentLevel > 0) {
              return new Array(indentLevel).join(options.indent);
            }
          }
          return "";
        };
        XMLWriterBase2.prototype.endline = function(node, options, level) {
          if (!options.pretty || options.suppressPrettyCount) {
            return "";
          } else {
            return options.newline;
          }
        };
        XMLWriterBase2.prototype.attribute = function(att, options, level) {
          var r;
          this.openAttribute(att, options, level);
          r = " " + att.name + '="' + att.value + '"';
          this.closeAttribute(att, options, level);
          return r;
        };
        XMLWriterBase2.prototype.cdata = function(node, options, level) {
          var r;
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level) + "<![CDATA[";
          options.state = WriterState.InsideTag;
          r += node.value;
          options.state = WriterState.CloseTag;
          r += "]]>" + this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.comment = function(node, options, level) {
          var r;
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level) + "<!-- ";
          options.state = WriterState.InsideTag;
          r += node.value;
          options.state = WriterState.CloseTag;
          r += " -->" + this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.declaration = function(node, options, level) {
          var r;
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level) + "<?xml";
          options.state = WriterState.InsideTag;
          r += ' version="' + node.version + '"';
          if (node.encoding != null) {
            r += ' encoding="' + node.encoding + '"';
          }
          if (node.standalone != null) {
            r += ' standalone="' + node.standalone + '"';
          }
          options.state = WriterState.CloseTag;
          r += options.spaceBeforeSlash + "?>";
          r += this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.docType = function(node, options, level) {
          var child, i, len, r, ref;
          level || (level = 0);
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level);
          r += "<!DOCTYPE " + node.root().name;
          if (node.pubID && node.sysID) {
            r += ' PUBLIC "' + node.pubID + '" "' + node.sysID + '"';
          } else if (node.sysID) {
            r += ' SYSTEM "' + node.sysID + '"';
          }
          if (node.children.length > 0) {
            r += " [";
            r += this.endline(node, options, level);
            options.state = WriterState.InsideTag;
            ref = node.children;
            for (i = 0, len = ref.length; i < len; i++) {
              child = ref[i];
              r += this.writeChildNode(child, options, level + 1);
            }
            options.state = WriterState.CloseTag;
            r += "]";
          }
          options.state = WriterState.CloseTag;
          r += options.spaceBeforeSlash + ">";
          r += this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.element = function(node, options, level) {
          var att, child, childNodeCount, firstChildNode, i, j, len, len1, name, prettySuppressed, r, ref, ref1, ref2;
          level || (level = 0);
          prettySuppressed = false;
          r = "";
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r += this.indent(node, options, level) + "<" + node.name;
          ref = node.attribs;
          for (name in ref) {
            if (!hasProp.call(ref, name)) continue;
            att = ref[name];
            r += this.attribute(att, options, level);
          }
          childNodeCount = node.children.length;
          firstChildNode = childNodeCount === 0 ? null : node.children[0];
          if (childNodeCount === 0 || node.children.every(function(e) {
            return (e.type === NodeType.Text || e.type === NodeType.Raw) && e.value === "";
          })) {
            if (options.allowEmpty) {
              r += ">";
              options.state = WriterState.CloseTag;
              r += "</" + node.name + ">" + this.endline(node, options, level);
            } else {
              options.state = WriterState.CloseTag;
              r += options.spaceBeforeSlash + "/>" + this.endline(node, options, level);
            }
          } else if (options.pretty && childNodeCount === 1 && (firstChildNode.type === NodeType.Text || firstChildNode.type === NodeType.Raw) && firstChildNode.value != null) {
            r += ">";
            options.state = WriterState.InsideTag;
            options.suppressPrettyCount++;
            prettySuppressed = true;
            r += this.writeChildNode(firstChildNode, options, level + 1);
            options.suppressPrettyCount--;
            prettySuppressed = false;
            options.state = WriterState.CloseTag;
            r += "</" + node.name + ">" + this.endline(node, options, level);
          } else {
            if (options.dontPrettyTextNodes) {
              ref1 = node.children;
              for (i = 0, len = ref1.length; i < len; i++) {
                child = ref1[i];
                if ((child.type === NodeType.Text || child.type === NodeType.Raw) && child.value != null) {
                  options.suppressPrettyCount++;
                  prettySuppressed = true;
                  break;
                }
              }
            }
            r += ">" + this.endline(node, options, level);
            options.state = WriterState.InsideTag;
            ref2 = node.children;
            for (j = 0, len1 = ref2.length; j < len1; j++) {
              child = ref2[j];
              r += this.writeChildNode(child, options, level + 1);
            }
            options.state = WriterState.CloseTag;
            r += this.indent(node, options, level) + "</" + node.name + ">";
            if (prettySuppressed) {
              options.suppressPrettyCount--;
            }
            r += this.endline(node, options, level);
            options.state = WriterState.None;
          }
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.writeChildNode = function(node, options, level) {
          switch (node.type) {
            case NodeType.CData:
              return this.cdata(node, options, level);
            case NodeType.Comment:
              return this.comment(node, options, level);
            case NodeType.Element:
              return this.element(node, options, level);
            case NodeType.Raw:
              return this.raw(node, options, level);
            case NodeType.Text:
              return this.text(node, options, level);
            case NodeType.ProcessingInstruction:
              return this.processingInstruction(node, options, level);
            case NodeType.Dummy:
              return "";
            case NodeType.Declaration:
              return this.declaration(node, options, level);
            case NodeType.DocType:
              return this.docType(node, options, level);
            case NodeType.AttributeDeclaration:
              return this.dtdAttList(node, options, level);
            case NodeType.ElementDeclaration:
              return this.dtdElement(node, options, level);
            case NodeType.EntityDeclaration:
              return this.dtdEntity(node, options, level);
            case NodeType.NotationDeclaration:
              return this.dtdNotation(node, options, level);
            default:
              throw new Error("Unknown XML node type: " + node.constructor.name);
          }
        };
        XMLWriterBase2.prototype.processingInstruction = function(node, options, level) {
          var r;
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level) + "<?";
          options.state = WriterState.InsideTag;
          r += node.target;
          if (node.value) {
            r += " " + node.value;
          }
          options.state = WriterState.CloseTag;
          r += options.spaceBeforeSlash + "?>";
          r += this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.raw = function(node, options, level) {
          var r;
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level);
          options.state = WriterState.InsideTag;
          r += node.value;
          options.state = WriterState.CloseTag;
          r += this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.text = function(node, options, level) {
          var r;
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level);
          options.state = WriterState.InsideTag;
          r += node.value;
          options.state = WriterState.CloseTag;
          r += this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.dtdAttList = function(node, options, level) {
          var r;
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level) + "<!ATTLIST";
          options.state = WriterState.InsideTag;
          r += " " + node.elementName + " " + node.attributeName + " " + node.attributeType;
          if (node.defaultValueType !== "#DEFAULT") {
            r += " " + node.defaultValueType;
          }
          if (node.defaultValue) {
            r += ' "' + node.defaultValue + '"';
          }
          options.state = WriterState.CloseTag;
          r += options.spaceBeforeSlash + ">" + this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.dtdElement = function(node, options, level) {
          var r;
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level) + "<!ELEMENT";
          options.state = WriterState.InsideTag;
          r += " " + node.name + " " + node.value;
          options.state = WriterState.CloseTag;
          r += options.spaceBeforeSlash + ">" + this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.dtdEntity = function(node, options, level) {
          var r;
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level) + "<!ENTITY";
          options.state = WriterState.InsideTag;
          if (node.pe) {
            r += " %";
          }
          r += " " + node.name;
          if (node.value) {
            r += ' "' + node.value + '"';
          } else {
            if (node.pubID && node.sysID) {
              r += ' PUBLIC "' + node.pubID + '" "' + node.sysID + '"';
            } else if (node.sysID) {
              r += ' SYSTEM "' + node.sysID + '"';
            }
            if (node.nData) {
              r += " NDATA " + node.nData;
            }
          }
          options.state = WriterState.CloseTag;
          r += options.spaceBeforeSlash + ">" + this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.dtdNotation = function(node, options, level) {
          var r;
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          r = this.indent(node, options, level) + "<!NOTATION";
          options.state = WriterState.InsideTag;
          r += " " + node.name;
          if (node.pubID && node.sysID) {
            r += ' PUBLIC "' + node.pubID + '" "' + node.sysID + '"';
          } else if (node.pubID) {
            r += ' PUBLIC "' + node.pubID + '"';
          } else if (node.sysID) {
            r += ' SYSTEM "' + node.sysID + '"';
          }
          options.state = WriterState.CloseTag;
          r += options.spaceBeforeSlash + ">" + this.endline(node, options, level);
          options.state = WriterState.None;
          this.closeNode(node, options, level);
          return r;
        };
        XMLWriterBase2.prototype.openNode = function(node, options, level) {
        };
        XMLWriterBase2.prototype.closeNode = function(node, options, level) {
        };
        XMLWriterBase2.prototype.openAttribute = function(att, options, level) {
        };
        XMLWriterBase2.prototype.closeAttribute = function(att, options, level) {
        };
        return XMLWriterBase2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLStringWriter.js
var require_XMLStringWriter = __commonJS({
  "node_modules/xmlbuilder/lib/XMLStringWriter.js"(exports2, module2) {
    (function() {
      var XMLStringWriter, XMLWriterBase, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      XMLWriterBase = require_XMLWriterBase();
      module2.exports = XMLStringWriter = function(superClass) {
        extend(XMLStringWriter2, superClass);
        function XMLStringWriter2(options) {
          XMLStringWriter2.__super__.constructor.call(this, options);
        }
        XMLStringWriter2.prototype.document = function(doc, options) {
          var child, i, len, r, ref;
          options = this.filterOptions(options);
          r = "";
          ref = doc.children;
          for (i = 0, len = ref.length; i < len; i++) {
            child = ref[i];
            r += this.writeChildNode(child, options, 0);
          }
          if (options.pretty && r.slice(-options.newline.length) === options.newline) {
            r = r.slice(0, -options.newline.length);
          }
          return r;
        };
        return XMLStringWriter2;
      }(XMLWriterBase);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDocument.js
var require_XMLDocument = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDocument.js"(exports2, module2) {
    (function() {
      var NodeType, XMLDOMConfiguration, XMLDOMImplementation, XMLDocument, XMLNode, XMLStringWriter, XMLStringifier, isPlainObject, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      isPlainObject = require_Utility().isPlainObject;
      XMLDOMImplementation = require_XMLDOMImplementation();
      XMLDOMConfiguration = require_XMLDOMConfiguration();
      XMLNode = require_XMLNode();
      NodeType = require_NodeType();
      XMLStringifier = require_XMLStringifier();
      XMLStringWriter = require_XMLStringWriter();
      module2.exports = XMLDocument = function(superClass) {
        extend(XMLDocument2, superClass);
        function XMLDocument2(options) {
          XMLDocument2.__super__.constructor.call(this, null);
          this.name = "#document";
          this.type = NodeType.Document;
          this.documentURI = null;
          this.domConfig = new XMLDOMConfiguration();
          options || (options = {});
          if (!options.writer) {
            options.writer = new XMLStringWriter();
          }
          this.options = options;
          this.stringify = new XMLStringifier(options);
        }
        Object.defineProperty(XMLDocument2.prototype, "implementation", {
          value: new XMLDOMImplementation()
        });
        Object.defineProperty(XMLDocument2.prototype, "doctype", {
          get: function() {
            var child, i, len, ref;
            ref = this.children;
            for (i = 0, len = ref.length; i < len; i++) {
              child = ref[i];
              if (child.type === NodeType.DocType) {
                return child;
              }
            }
            return null;
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "documentElement", {
          get: function() {
            return this.rootObject || null;
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "inputEncoding", {
          get: function() {
            return null;
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "strictErrorChecking", {
          get: function() {
            return false;
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "xmlEncoding", {
          get: function() {
            if (this.children.length !== 0 && this.children[0].type === NodeType.Declaration) {
              return this.children[0].encoding;
            } else {
              return null;
            }
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "xmlStandalone", {
          get: function() {
            if (this.children.length !== 0 && this.children[0].type === NodeType.Declaration) {
              return this.children[0].standalone === "yes";
            } else {
              return false;
            }
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "xmlVersion", {
          get: function() {
            if (this.children.length !== 0 && this.children[0].type === NodeType.Declaration) {
              return this.children[0].version;
            } else {
              return "1.0";
            }
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "URL", {
          get: function() {
            return this.documentURI;
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "origin", {
          get: function() {
            return null;
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "compatMode", {
          get: function() {
            return null;
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "characterSet", {
          get: function() {
            return null;
          }
        });
        Object.defineProperty(XMLDocument2.prototype, "contentType", {
          get: function() {
            return null;
          }
        });
        XMLDocument2.prototype.end = function(writer) {
          var writerOptions;
          writerOptions = {};
          if (!writer) {
            writer = this.options.writer;
          } else if (isPlainObject(writer)) {
            writerOptions = writer;
            writer = this.options.writer;
          }
          return writer.document(this, writer.filterOptions(writerOptions));
        };
        XMLDocument2.prototype.toString = function(options) {
          return this.options.writer.document(this, this.options.writer.filterOptions(options));
        };
        XMLDocument2.prototype.createElement = function(tagName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createDocumentFragment = function() {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createTextNode = function(data) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createComment = function(data) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createCDATASection = function(data) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createProcessingInstruction = function(target, data) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createAttribute = function(name) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createEntityReference = function(name) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.getElementsByTagName = function(tagname) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.importNode = function(importedNode, deep) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createElementNS = function(namespaceURI, qualifiedName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createAttributeNS = function(namespaceURI, qualifiedName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.getElementsByTagNameNS = function(namespaceURI, localName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.getElementById = function(elementId) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.adoptNode = function(source) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.normalizeDocument = function() {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.renameNode = function(node, namespaceURI, qualifiedName) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.getElementsByClassName = function(classNames) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createEvent = function(eventInterface) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createRange = function() {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createNodeIterator = function(root, whatToShow, filter2) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        XMLDocument2.prototype.createTreeWalker = function(root, whatToShow, filter2) {
          throw new Error("This DOM method is not implemented." + this.debugInfo());
        };
        return XMLDocument2;
      }(XMLNode);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLDocumentCB.js
var require_XMLDocumentCB = __commonJS({
  "node_modules/xmlbuilder/lib/XMLDocumentCB.js"(exports2, module2) {
    (function() {
      var NodeType, WriterState, XMLAttribute, XMLCData, XMLComment, XMLDTDAttList, XMLDTDElement, XMLDTDEntity, XMLDTDNotation, XMLDeclaration, XMLDocType, XMLDocument, XMLDocumentCB, XMLElement, XMLProcessingInstruction, XMLRaw, XMLStringWriter, XMLStringifier, XMLText, getValue, isFunction, isObject, isPlainObject, ref, hasProp = {}.hasOwnProperty;
      ref = require_Utility(), isObject = ref.isObject, isFunction = ref.isFunction, isPlainObject = ref.isPlainObject, getValue = ref.getValue;
      NodeType = require_NodeType();
      XMLDocument = require_XMLDocument();
      XMLElement = require_XMLElement();
      XMLCData = require_XMLCData();
      XMLComment = require_XMLComment();
      XMLRaw = require_XMLRaw();
      XMLText = require_XMLText();
      XMLProcessingInstruction = require_XMLProcessingInstruction();
      XMLDeclaration = require_XMLDeclaration();
      XMLDocType = require_XMLDocType();
      XMLDTDAttList = require_XMLDTDAttList();
      XMLDTDEntity = require_XMLDTDEntity();
      XMLDTDElement = require_XMLDTDElement();
      XMLDTDNotation = require_XMLDTDNotation();
      XMLAttribute = require_XMLAttribute();
      XMLStringifier = require_XMLStringifier();
      XMLStringWriter = require_XMLStringWriter();
      WriterState = require_WriterState();
      module2.exports = XMLDocumentCB = function() {
        function XMLDocumentCB2(options, onData, onEnd) {
          var writerOptions;
          this.name = "?xml";
          this.type = NodeType.Document;
          options || (options = {});
          writerOptions = {};
          if (!options.writer) {
            options.writer = new XMLStringWriter();
          } else if (isPlainObject(options.writer)) {
            writerOptions = options.writer;
            options.writer = new XMLStringWriter();
          }
          this.options = options;
          this.writer = options.writer;
          this.writerOptions = this.writer.filterOptions(writerOptions);
          this.stringify = new XMLStringifier(options);
          this.onDataCallback = onData || function() {
          };
          this.onEndCallback = onEnd || function() {
          };
          this.currentNode = null;
          this.currentLevel = -1;
          this.openTags = {};
          this.documentStarted = false;
          this.documentCompleted = false;
          this.root = null;
        }
        XMLDocumentCB2.prototype.createChildNode = function(node) {
          var att, attName, attributes, child, i, len, ref1, ref2;
          switch (node.type) {
            case NodeType.CData:
              this.cdata(node.value);
              break;
            case NodeType.Comment:
              this.comment(node.value);
              break;
            case NodeType.Element:
              attributes = {};
              ref1 = node.attribs;
              for (attName in ref1) {
                if (!hasProp.call(ref1, attName)) continue;
                att = ref1[attName];
                attributes[attName] = att.value;
              }
              this.node(node.name, attributes);
              break;
            case NodeType.Dummy:
              this.dummy();
              break;
            case NodeType.Raw:
              this.raw(node.value);
              break;
            case NodeType.Text:
              this.text(node.value);
              break;
            case NodeType.ProcessingInstruction:
              this.instruction(node.target, node.value);
              break;
            default:
              throw new Error("This XML node type is not supported in a JS object: " + node.constructor.name);
          }
          ref2 = node.children;
          for (i = 0, len = ref2.length; i < len; i++) {
            child = ref2[i];
            this.createChildNode(child);
            if (child.type === NodeType.Element) {
              this.up();
            }
          }
          return this;
        };
        XMLDocumentCB2.prototype.dummy = function() {
          return this;
        };
        XMLDocumentCB2.prototype.node = function(name, attributes, text) {
          var ref1;
          if (name == null) {
            throw new Error("Missing node name.");
          }
          if (this.root && this.currentLevel === -1) {
            throw new Error("Document can only have one root node. " + this.debugInfo(name));
          }
          this.openCurrent();
          name = getValue(name);
          if (attributes == null) {
            attributes = {};
          }
          attributes = getValue(attributes);
          if (!isObject(attributes)) {
            ref1 = [attributes, text], text = ref1[0], attributes = ref1[1];
          }
          this.currentNode = new XMLElement(this, name, attributes);
          this.currentNode.children = false;
          this.currentLevel++;
          this.openTags[this.currentLevel] = this.currentNode;
          if (text != null) {
            this.text(text);
          }
          return this;
        };
        XMLDocumentCB2.prototype.element = function(name, attributes, text) {
          var child, i, len, oldValidationFlag, ref1, root;
          if (this.currentNode && this.currentNode.type === NodeType.DocType) {
            this.dtdElement.apply(this, arguments);
          } else {
            if (Array.isArray(name) || isObject(name) || isFunction(name)) {
              oldValidationFlag = this.options.noValidation;
              this.options.noValidation = true;
              root = new XMLDocument(this.options).element("TEMP_ROOT");
              root.element(name);
              this.options.noValidation = oldValidationFlag;
              ref1 = root.children;
              for (i = 0, len = ref1.length; i < len; i++) {
                child = ref1[i];
                this.createChildNode(child);
                if (child.type === NodeType.Element) {
                  this.up();
                }
              }
            } else {
              this.node(name, attributes, text);
            }
          }
          return this;
        };
        XMLDocumentCB2.prototype.attribute = function(name, value) {
          var attName, attValue;
          if (!this.currentNode || this.currentNode.children) {
            throw new Error("att() can only be used immediately after an ele() call in callback mode. " + this.debugInfo(name));
          }
          if (name != null) {
            name = getValue(name);
          }
          if (isObject(name)) {
            for (attName in name) {
              if (!hasProp.call(name, attName)) continue;
              attValue = name[attName];
              this.attribute(attName, attValue);
            }
          } else {
            if (isFunction(value)) {
              value = value.apply();
            }
            if (this.options.keepNullAttributes && value == null) {
              this.currentNode.attribs[name] = new XMLAttribute(this, name, "");
            } else if (value != null) {
              this.currentNode.attribs[name] = new XMLAttribute(this, name, value);
            }
          }
          return this;
        };
        XMLDocumentCB2.prototype.text = function(value) {
          var node;
          this.openCurrent();
          node = new XMLText(this, value);
          this.onData(this.writer.text(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          return this;
        };
        XMLDocumentCB2.prototype.cdata = function(value) {
          var node;
          this.openCurrent();
          node = new XMLCData(this, value);
          this.onData(this.writer.cdata(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          return this;
        };
        XMLDocumentCB2.prototype.comment = function(value) {
          var node;
          this.openCurrent();
          node = new XMLComment(this, value);
          this.onData(this.writer.comment(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          return this;
        };
        XMLDocumentCB2.prototype.raw = function(value) {
          var node;
          this.openCurrent();
          node = new XMLRaw(this, value);
          this.onData(this.writer.raw(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          return this;
        };
        XMLDocumentCB2.prototype.instruction = function(target, value) {
          var i, insTarget, insValue, len, node;
          this.openCurrent();
          if (target != null) {
            target = getValue(target);
          }
          if (value != null) {
            value = getValue(value);
          }
          if (Array.isArray(target)) {
            for (i = 0, len = target.length; i < len; i++) {
              insTarget = target[i];
              this.instruction(insTarget);
            }
          } else if (isObject(target)) {
            for (insTarget in target) {
              if (!hasProp.call(target, insTarget)) continue;
              insValue = target[insTarget];
              this.instruction(insTarget, insValue);
            }
          } else {
            if (isFunction(value)) {
              value = value.apply();
            }
            node = new XMLProcessingInstruction(this, target, value);
            this.onData(this.writer.processingInstruction(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          }
          return this;
        };
        XMLDocumentCB2.prototype.declaration = function(version, encoding, standalone) {
          var node;
          this.openCurrent();
          if (this.documentStarted) {
            throw new Error("declaration() must be the first node.");
          }
          node = new XMLDeclaration(this, version, encoding, standalone);
          this.onData(this.writer.declaration(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          return this;
        };
        XMLDocumentCB2.prototype.doctype = function(root, pubID, sysID) {
          this.openCurrent();
          if (root == null) {
            throw new Error("Missing root node name.");
          }
          if (this.root) {
            throw new Error("dtd() must come before the root node.");
          }
          this.currentNode = new XMLDocType(this, pubID, sysID);
          this.currentNode.rootNodeName = root;
          this.currentNode.children = false;
          this.currentLevel++;
          this.openTags[this.currentLevel] = this.currentNode;
          return this;
        };
        XMLDocumentCB2.prototype.dtdElement = function(name, value) {
          var node;
          this.openCurrent();
          node = new XMLDTDElement(this, name, value);
          this.onData(this.writer.dtdElement(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          return this;
        };
        XMLDocumentCB2.prototype.attList = function(elementName, attributeName, attributeType, defaultValueType, defaultValue) {
          var node;
          this.openCurrent();
          node = new XMLDTDAttList(this, elementName, attributeName, attributeType, defaultValueType, defaultValue);
          this.onData(this.writer.dtdAttList(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          return this;
        };
        XMLDocumentCB2.prototype.entity = function(name, value) {
          var node;
          this.openCurrent();
          node = new XMLDTDEntity(this, false, name, value);
          this.onData(this.writer.dtdEntity(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          return this;
        };
        XMLDocumentCB2.prototype.pEntity = function(name, value) {
          var node;
          this.openCurrent();
          node = new XMLDTDEntity(this, true, name, value);
          this.onData(this.writer.dtdEntity(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          return this;
        };
        XMLDocumentCB2.prototype.notation = function(name, value) {
          var node;
          this.openCurrent();
          node = new XMLDTDNotation(this, name, value);
          this.onData(this.writer.dtdNotation(node, this.writerOptions, this.currentLevel + 1), this.currentLevel + 1);
          return this;
        };
        XMLDocumentCB2.prototype.up = function() {
          if (this.currentLevel < 0) {
            throw new Error("The document node has no parent.");
          }
          if (this.currentNode) {
            if (this.currentNode.children) {
              this.closeNode(this.currentNode);
            } else {
              this.openNode(this.currentNode);
            }
            this.currentNode = null;
          } else {
            this.closeNode(this.openTags[this.currentLevel]);
          }
          delete this.openTags[this.currentLevel];
          this.currentLevel--;
          return this;
        };
        XMLDocumentCB2.prototype.end = function() {
          while (this.currentLevel >= 0) {
            this.up();
          }
          return this.onEnd();
        };
        XMLDocumentCB2.prototype.openCurrent = function() {
          if (this.currentNode) {
            this.currentNode.children = true;
            return this.openNode(this.currentNode);
          }
        };
        XMLDocumentCB2.prototype.openNode = function(node) {
          var att, chunk, name, ref1;
          if (!node.isOpen) {
            if (!this.root && this.currentLevel === 0 && node.type === NodeType.Element) {
              this.root = node;
            }
            chunk = "";
            if (node.type === NodeType.Element) {
              this.writerOptions.state = WriterState.OpenTag;
              chunk = this.writer.indent(node, this.writerOptions, this.currentLevel) + "<" + node.name;
              ref1 = node.attribs;
              for (name in ref1) {
                if (!hasProp.call(ref1, name)) continue;
                att = ref1[name];
                chunk += this.writer.attribute(att, this.writerOptions, this.currentLevel);
              }
              chunk += (node.children ? ">" : "/>") + this.writer.endline(node, this.writerOptions, this.currentLevel);
              this.writerOptions.state = WriterState.InsideTag;
            } else {
              this.writerOptions.state = WriterState.OpenTag;
              chunk = this.writer.indent(node, this.writerOptions, this.currentLevel) + "<!DOCTYPE " + node.rootNodeName;
              if (node.pubID && node.sysID) {
                chunk += ' PUBLIC "' + node.pubID + '" "' + node.sysID + '"';
              } else if (node.sysID) {
                chunk += ' SYSTEM "' + node.sysID + '"';
              }
              if (node.children) {
                chunk += " [";
                this.writerOptions.state = WriterState.InsideTag;
              } else {
                this.writerOptions.state = WriterState.CloseTag;
                chunk += ">";
              }
              chunk += this.writer.endline(node, this.writerOptions, this.currentLevel);
            }
            this.onData(chunk, this.currentLevel);
            return node.isOpen = true;
          }
        };
        XMLDocumentCB2.prototype.closeNode = function(node) {
          var chunk;
          if (!node.isClosed) {
            chunk = "";
            this.writerOptions.state = WriterState.CloseTag;
            if (node.type === NodeType.Element) {
              chunk = this.writer.indent(node, this.writerOptions, this.currentLevel) + "</" + node.name + ">" + this.writer.endline(node, this.writerOptions, this.currentLevel);
            } else {
              chunk = this.writer.indent(node, this.writerOptions, this.currentLevel) + "]>" + this.writer.endline(node, this.writerOptions, this.currentLevel);
            }
            this.writerOptions.state = WriterState.None;
            this.onData(chunk, this.currentLevel);
            return node.isClosed = true;
          }
        };
        XMLDocumentCB2.prototype.onData = function(chunk, level) {
          this.documentStarted = true;
          return this.onDataCallback(chunk, level + 1);
        };
        XMLDocumentCB2.prototype.onEnd = function() {
          this.documentCompleted = true;
          return this.onEndCallback();
        };
        XMLDocumentCB2.prototype.debugInfo = function(name) {
          if (name == null) {
            return "";
          } else {
            return "node: <" + name + ">";
          }
        };
        XMLDocumentCB2.prototype.ele = function() {
          return this.element.apply(this, arguments);
        };
        XMLDocumentCB2.prototype.nod = function(name, attributes, text) {
          return this.node(name, attributes, text);
        };
        XMLDocumentCB2.prototype.txt = function(value) {
          return this.text(value);
        };
        XMLDocumentCB2.prototype.dat = function(value) {
          return this.cdata(value);
        };
        XMLDocumentCB2.prototype.com = function(value) {
          return this.comment(value);
        };
        XMLDocumentCB2.prototype.ins = function(target, value) {
          return this.instruction(target, value);
        };
        XMLDocumentCB2.prototype.dec = function(version, encoding, standalone) {
          return this.declaration(version, encoding, standalone);
        };
        XMLDocumentCB2.prototype.dtd = function(root, pubID, sysID) {
          return this.doctype(root, pubID, sysID);
        };
        XMLDocumentCB2.prototype.e = function(name, attributes, text) {
          return this.element(name, attributes, text);
        };
        XMLDocumentCB2.prototype.n = function(name, attributes, text) {
          return this.node(name, attributes, text);
        };
        XMLDocumentCB2.prototype.t = function(value) {
          return this.text(value);
        };
        XMLDocumentCB2.prototype.d = function(value) {
          return this.cdata(value);
        };
        XMLDocumentCB2.prototype.c = function(value) {
          return this.comment(value);
        };
        XMLDocumentCB2.prototype.r = function(value) {
          return this.raw(value);
        };
        XMLDocumentCB2.prototype.i = function(target, value) {
          return this.instruction(target, value);
        };
        XMLDocumentCB2.prototype.att = function() {
          if (this.currentNode && this.currentNode.type === NodeType.DocType) {
            return this.attList.apply(this, arguments);
          } else {
            return this.attribute.apply(this, arguments);
          }
        };
        XMLDocumentCB2.prototype.a = function() {
          if (this.currentNode && this.currentNode.type === NodeType.DocType) {
            return this.attList.apply(this, arguments);
          } else {
            return this.attribute.apply(this, arguments);
          }
        };
        XMLDocumentCB2.prototype.ent = function(name, value) {
          return this.entity(name, value);
        };
        XMLDocumentCB2.prototype.pent = function(name, value) {
          return this.pEntity(name, value);
        };
        XMLDocumentCB2.prototype.not = function(name, value) {
          return this.notation(name, value);
        };
        return XMLDocumentCB2;
      }();
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/XMLStreamWriter.js
var require_XMLStreamWriter = __commonJS({
  "node_modules/xmlbuilder/lib/XMLStreamWriter.js"(exports2, module2) {
    (function() {
      var NodeType, WriterState, XMLStreamWriter, XMLWriterBase, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      NodeType = require_NodeType();
      XMLWriterBase = require_XMLWriterBase();
      WriterState = require_WriterState();
      module2.exports = XMLStreamWriter = function(superClass) {
        extend(XMLStreamWriter2, superClass);
        function XMLStreamWriter2(stream, options) {
          this.stream = stream;
          XMLStreamWriter2.__super__.constructor.call(this, options);
        }
        XMLStreamWriter2.prototype.endline = function(node, options, level) {
          if (node.isLastRootNode && options.state === WriterState.CloseTag) {
            return "";
          } else {
            return XMLStreamWriter2.__super__.endline.call(this, node, options, level);
          }
        };
        XMLStreamWriter2.prototype.document = function(doc, options) {
          var child, i, j, k, len, len1, ref, ref1, results;
          ref = doc.children;
          for (i = j = 0, len = ref.length; j < len; i = ++j) {
            child = ref[i];
            child.isLastRootNode = i === doc.children.length - 1;
          }
          options = this.filterOptions(options);
          ref1 = doc.children;
          results = [];
          for (k = 0, len1 = ref1.length; k < len1; k++) {
            child = ref1[k];
            results.push(this.writeChildNode(child, options, 0));
          }
          return results;
        };
        XMLStreamWriter2.prototype.attribute = function(att, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.attribute.call(this, att, options, level));
        };
        XMLStreamWriter2.prototype.cdata = function(node, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.cdata.call(this, node, options, level));
        };
        XMLStreamWriter2.prototype.comment = function(node, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.comment.call(this, node, options, level));
        };
        XMLStreamWriter2.prototype.declaration = function(node, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.declaration.call(this, node, options, level));
        };
        XMLStreamWriter2.prototype.docType = function(node, options, level) {
          var child, j, len, ref;
          level || (level = 0);
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          this.stream.write(this.indent(node, options, level));
          this.stream.write("<!DOCTYPE " + node.root().name);
          if (node.pubID && node.sysID) {
            this.stream.write(' PUBLIC "' + node.pubID + '" "' + node.sysID + '"');
          } else if (node.sysID) {
            this.stream.write(' SYSTEM "' + node.sysID + '"');
          }
          if (node.children.length > 0) {
            this.stream.write(" [");
            this.stream.write(this.endline(node, options, level));
            options.state = WriterState.InsideTag;
            ref = node.children;
            for (j = 0, len = ref.length; j < len; j++) {
              child = ref[j];
              this.writeChildNode(child, options, level + 1);
            }
            options.state = WriterState.CloseTag;
            this.stream.write("]");
          }
          options.state = WriterState.CloseTag;
          this.stream.write(options.spaceBeforeSlash + ">");
          this.stream.write(this.endline(node, options, level));
          options.state = WriterState.None;
          return this.closeNode(node, options, level);
        };
        XMLStreamWriter2.prototype.element = function(node, options, level) {
          var att, child, childNodeCount, firstChildNode, j, len, name, prettySuppressed, ref, ref1;
          level || (level = 0);
          this.openNode(node, options, level);
          options.state = WriterState.OpenTag;
          this.stream.write(this.indent(node, options, level) + "<" + node.name);
          ref = node.attribs;
          for (name in ref) {
            if (!hasProp.call(ref, name)) continue;
            att = ref[name];
            this.attribute(att, options, level);
          }
          childNodeCount = node.children.length;
          firstChildNode = childNodeCount === 0 ? null : node.children[0];
          if (childNodeCount === 0 || node.children.every(function(e) {
            return (e.type === NodeType.Text || e.type === NodeType.Raw) && e.value === "";
          })) {
            if (options.allowEmpty) {
              this.stream.write(">");
              options.state = WriterState.CloseTag;
              this.stream.write("</" + node.name + ">");
            } else {
              options.state = WriterState.CloseTag;
              this.stream.write(options.spaceBeforeSlash + "/>");
            }
          } else if (options.pretty && childNodeCount === 1 && (firstChildNode.type === NodeType.Text || firstChildNode.type === NodeType.Raw) && firstChildNode.value != null) {
            this.stream.write(">");
            options.state = WriterState.InsideTag;
            options.suppressPrettyCount++;
            prettySuppressed = true;
            this.writeChildNode(firstChildNode, options, level + 1);
            options.suppressPrettyCount--;
            prettySuppressed = false;
            options.state = WriterState.CloseTag;
            this.stream.write("</" + node.name + ">");
          } else {
            this.stream.write(">" + this.endline(node, options, level));
            options.state = WriterState.InsideTag;
            ref1 = node.children;
            for (j = 0, len = ref1.length; j < len; j++) {
              child = ref1[j];
              this.writeChildNode(child, options, level + 1);
            }
            options.state = WriterState.CloseTag;
            this.stream.write(this.indent(node, options, level) + "</" + node.name + ">");
          }
          this.stream.write(this.endline(node, options, level));
          options.state = WriterState.None;
          return this.closeNode(node, options, level);
        };
        XMLStreamWriter2.prototype.processingInstruction = function(node, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.processingInstruction.call(this, node, options, level));
        };
        XMLStreamWriter2.prototype.raw = function(node, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.raw.call(this, node, options, level));
        };
        XMLStreamWriter2.prototype.text = function(node, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.text.call(this, node, options, level));
        };
        XMLStreamWriter2.prototype.dtdAttList = function(node, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.dtdAttList.call(this, node, options, level));
        };
        XMLStreamWriter2.prototype.dtdElement = function(node, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.dtdElement.call(this, node, options, level));
        };
        XMLStreamWriter2.prototype.dtdEntity = function(node, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.dtdEntity.call(this, node, options, level));
        };
        XMLStreamWriter2.prototype.dtdNotation = function(node, options, level) {
          return this.stream.write(XMLStreamWriter2.__super__.dtdNotation.call(this, node, options, level));
        };
        return XMLStreamWriter2;
      }(XMLWriterBase);
    }).call(exports2);
  }
});

// node_modules/xmlbuilder/lib/index.js
var require_lib2 = __commonJS({
  "node_modules/xmlbuilder/lib/index.js"(exports2, module2) {
    (function() {
      var NodeType, WriterState, XMLDOMImplementation, XMLDocument, XMLDocumentCB, XMLStreamWriter, XMLStringWriter, assign, isFunction, ref;
      ref = require_Utility(), assign = ref.assign, isFunction = ref.isFunction;
      XMLDOMImplementation = require_XMLDOMImplementation();
      XMLDocument = require_XMLDocument();
      XMLDocumentCB = require_XMLDocumentCB();
      XMLStringWriter = require_XMLStringWriter();
      XMLStreamWriter = require_XMLStreamWriter();
      NodeType = require_NodeType();
      WriterState = require_WriterState();
      module2.exports.create = function(name, xmldec, doctype, options) {
        var doc, root;
        if (name == null) {
          throw new Error("Root element needs a name.");
        }
        options = assign({}, xmldec, doctype, options);
        doc = new XMLDocument(options);
        root = doc.element(name);
        if (!options.headless) {
          doc.declaration(options);
          if (options.pubID != null || options.sysID != null) {
            doc.dtd(options);
          }
        }
        return root;
      };
      module2.exports.begin = function(options, onData, onEnd) {
        var ref1;
        if (isFunction(options)) {
          ref1 = [options, onData], onData = ref1[0], onEnd = ref1[1];
          options = {};
        }
        if (onData) {
          return new XMLDocumentCB(options, onData, onEnd);
        } else {
          return new XMLDocument(options);
        }
      };
      module2.exports.stringWriter = function(options) {
        return new XMLStringWriter(options);
      };
      module2.exports.streamWriter = function(stream, options) {
        return new XMLStreamWriter(stream, options);
      };
      module2.exports.implementation = new XMLDOMImplementation();
      module2.exports.nodeType = NodeType;
      module2.exports.writerState = WriterState;
    }).call(exports2);
  }
});

// node_modules/xml2js/lib/builder.js
var require_builder = __commonJS({
  "node_modules/xml2js/lib/builder.js"(exports2) {
    (function() {
      "use strict";
      var builder, defaults2, escapeCDATA, requiresCDATA, wrapCDATA, hasProp = {}.hasOwnProperty;
      builder = require_lib2();
      defaults2 = require_defaults().defaults;
      requiresCDATA = function(entry) {
        return typeof entry === "string" && (entry.indexOf("&") >= 0 || entry.indexOf(">") >= 0 || entry.indexOf("<") >= 0);
      };
      wrapCDATA = function(entry) {
        return "<![CDATA[" + escapeCDATA(entry) + "]]>";
      };
      escapeCDATA = function(entry) {
        return entry.replace("]]>", "]]]]><![CDATA[>");
      };
      exports2.Builder = function() {
        function Builder(opts) {
          var key, ref, value;
          this.options = {};
          ref = defaults2["0.2"];
          for (key in ref) {
            if (!hasProp.call(ref, key)) continue;
            value = ref[key];
            this.options[key] = value;
          }
          for (key in opts) {
            if (!hasProp.call(opts, key)) continue;
            value = opts[key];
            this.options[key] = value;
          }
        }
        Builder.prototype.buildObject = function(rootObj) {
          var attrkey, charkey, render, rootElement, rootName;
          attrkey = this.options.attrkey;
          charkey = this.options.charkey;
          if (Object.keys(rootObj).length === 1 && this.options.rootName === defaults2["0.2"].rootName) {
            rootName = Object.keys(rootObj)[0];
            rootObj = rootObj[rootName];
          } else {
            rootName = this.options.rootName;
          }
          render = /* @__PURE__ */ function(_this) {
            return function(element, obj) {
              var attr, child, entry, index, key, value;
              if (typeof obj !== "object") {
                if (_this.options.cdata && requiresCDATA(obj)) {
                  element.raw(wrapCDATA(obj));
                } else {
                  element.txt(obj);
                }
              } else if (Array.isArray(obj)) {
                for (index in obj) {
                  if (!hasProp.call(obj, index)) continue;
                  child = obj[index];
                  for (key in child) {
                    entry = child[key];
                    element = render(element.ele(key), entry).up();
                  }
                }
              } else {
                for (key in obj) {
                  if (!hasProp.call(obj, key)) continue;
                  child = obj[key];
                  if (key === attrkey) {
                    if (typeof child === "object") {
                      for (attr in child) {
                        value = child[attr];
                        element = element.att(attr, value);
                      }
                    }
                  } else if (key === charkey) {
                    if (_this.options.cdata && requiresCDATA(child)) {
                      element = element.raw(wrapCDATA(child));
                    } else {
                      element = element.txt(child);
                    }
                  } else if (Array.isArray(child)) {
                    for (index in child) {
                      if (!hasProp.call(child, index)) continue;
                      entry = child[index];
                      if (typeof entry === "string") {
                        if (_this.options.cdata && requiresCDATA(entry)) {
                          element = element.ele(key).raw(wrapCDATA(entry)).up();
                        } else {
                          element = element.ele(key, entry).up();
                        }
                      } else {
                        element = render(element.ele(key), entry).up();
                      }
                    }
                  } else if (typeof child === "object") {
                    element = render(element.ele(key), child).up();
                  } else {
                    if (typeof child === "string" && _this.options.cdata && requiresCDATA(child)) {
                      element = element.ele(key).raw(wrapCDATA(child)).up();
                    } else {
                      if (child == null) {
                        child = "";
                      }
                      element = element.ele(key, child.toString()).up();
                    }
                  }
                }
              }
              return element;
            };
          }(this);
          rootElement = builder.create(rootName, this.options.xmldec, this.options.doctype, {
            headless: this.options.headless,
            allowSurrogateChars: this.options.allowSurrogateChars
          });
          return render(rootElement, rootObj).end(this.options.renderOpts);
        };
        return Builder;
      }();
    }).call(exports2);
  }
});

// node_modules/sax/lib/sax.js
var require_sax = __commonJS({
  "node_modules/sax/lib/sax.js"(exports2) {
    (function(sax) {
      sax.parser = function(strict, opt) {
        return new SAXParser(strict, opt);
      };
      sax.SAXParser = SAXParser;
      sax.SAXStream = SAXStream;
      sax.createStream = createStream;
      sax.MAX_BUFFER_LENGTH = 64 * 1024;
      var buffers = [
        "comment",
        "sgmlDecl",
        "textNode",
        "tagName",
        "doctype",
        "procInstName",
        "procInstBody",
        "entity",
        "attribName",
        "attribValue",
        "cdata",
        "script"
      ];
      sax.EVENTS = [
        "text",
        "processinginstruction",
        "sgmldeclaration",
        "doctype",
        "comment",
        "opentagstart",
        "attribute",
        "opentag",
        "closetag",
        "opencdata",
        "cdata",
        "closecdata",
        "error",
        "end",
        "ready",
        "script",
        "opennamespace",
        "closenamespace"
      ];
      function SAXParser(strict, opt) {
        if (!(this instanceof SAXParser)) {
          return new SAXParser(strict, opt);
        }
        var parser = this;
        clearBuffers(parser);
        parser.q = parser.c = "";
        parser.bufferCheckPosition = sax.MAX_BUFFER_LENGTH;
        parser.opt = opt || {};
        parser.opt.lowercase = parser.opt.lowercase || parser.opt.lowercasetags;
        parser.looseCase = parser.opt.lowercase ? "toLowerCase" : "toUpperCase";
        parser.tags = [];
        parser.closed = parser.closedRoot = parser.sawRoot = false;
        parser.tag = parser.error = null;
        parser.strict = !!strict;
        parser.noscript = !!(strict || parser.opt.noscript);
        parser.state = S.BEGIN;
        parser.strictEntities = parser.opt.strictEntities;
        parser.ENTITIES = parser.strictEntities ? Object.create(sax.XML_ENTITIES) : Object.create(sax.ENTITIES);
        parser.attribList = [];
        if (parser.opt.xmlns) {
          parser.ns = Object.create(rootNS);
        }
        if (parser.opt.unquotedAttributeValues === void 0) {
          parser.opt.unquotedAttributeValues = !strict;
        }
        parser.trackPosition = parser.opt.position !== false;
        if (parser.trackPosition) {
          parser.position = parser.line = parser.column = 0;
        }
        emit(parser, "onready");
      }
      if (!Object.create) {
        Object.create = function(o) {
          function F() {
          }
          F.prototype = o;
          var newf = new F();
          return newf;
        };
      }
      if (!Object.keys) {
        Object.keys = function(o) {
          var a = [];
          for (var i in o) if (o.hasOwnProperty(i)) a.push(i);
          return a;
        };
      }
      function checkBufferLength(parser) {
        var maxAllowed = Math.max(sax.MAX_BUFFER_LENGTH, 10);
        var maxActual = 0;
        for (var i = 0, l = buffers.length; i < l; i++) {
          var len = parser[buffers[i]].length;
          if (len > maxAllowed) {
            switch (buffers[i]) {
              case "textNode":
                closeText(parser);
                break;
              case "cdata":
                emitNode(parser, "oncdata", parser.cdata);
                parser.cdata = "";
                break;
              case "script":
                emitNode(parser, "onscript", parser.script);
                parser.script = "";
                break;
              default:
                error(parser, "Max buffer length exceeded: " + buffers[i]);
            }
          }
          maxActual = Math.max(maxActual, len);
        }
        var m = sax.MAX_BUFFER_LENGTH - maxActual;
        parser.bufferCheckPosition = m + parser.position;
      }
      function clearBuffers(parser) {
        for (var i = 0, l = buffers.length; i < l; i++) {
          parser[buffers[i]] = "";
        }
      }
      function flushBuffers(parser) {
        closeText(parser);
        if (parser.cdata !== "") {
          emitNode(parser, "oncdata", parser.cdata);
          parser.cdata = "";
        }
        if (parser.script !== "") {
          emitNode(parser, "onscript", parser.script);
          parser.script = "";
        }
      }
      SAXParser.prototype = {
        end: function() {
          end(this);
        },
        write,
        resume: function() {
          this.error = null;
          return this;
        },
        close: function() {
          return this.write(null);
        },
        flush: function() {
          flushBuffers(this);
        }
      };
      var Stream;
      try {
        Stream = require("stream").Stream;
      } catch (ex) {
        Stream = function() {
        };
      }
      if (!Stream) Stream = function() {
      };
      var streamWraps = sax.EVENTS.filter(function(ev) {
        return ev !== "error" && ev !== "end";
      });
      function createStream(strict, opt) {
        return new SAXStream(strict, opt);
      }
      function SAXStream(strict, opt) {
        if (!(this instanceof SAXStream)) {
          return new SAXStream(strict, opt);
        }
        Stream.apply(this);
        this._parser = new SAXParser(strict, opt);
        this.writable = true;
        this.readable = true;
        var me = this;
        this._parser.onend = function() {
          me.emit("end");
        };
        this._parser.onerror = function(er) {
          me.emit("error", er);
          me._parser.error = null;
        };
        this._decoder = null;
        streamWraps.forEach(function(ev) {
          Object.defineProperty(me, "on" + ev, {
            get: function() {
              return me._parser["on" + ev];
            },
            set: function(h) {
              if (!h) {
                me.removeAllListeners(ev);
                me._parser["on" + ev] = h;
                return h;
              }
              me.on(ev, h);
            },
            enumerable: true,
            configurable: false
          });
        });
      }
      SAXStream.prototype = Object.create(Stream.prototype, {
        constructor: {
          value: SAXStream
        }
      });
      SAXStream.prototype.write = function(data) {
        if (typeof Buffer === "function" && typeof Buffer.isBuffer === "function" && Buffer.isBuffer(data)) {
          if (!this._decoder) {
            var SD = require("string_decoder").StringDecoder;
            this._decoder = new SD("utf8");
          }
          data = this._decoder.write(data);
        }
        this._parser.write(data.toString());
        this.emit("data", data);
        return true;
      };
      SAXStream.prototype.end = function(chunk) {
        if (chunk && chunk.length) {
          this.write(chunk);
        }
        this._parser.end();
        return true;
      };
      SAXStream.prototype.on = function(ev, handler) {
        var me = this;
        if (!me._parser["on" + ev] && streamWraps.indexOf(ev) !== -1) {
          me._parser["on" + ev] = function() {
            var args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
            args.splice(0, 0, ev);
            me.emit.apply(me, args);
          };
        }
        return Stream.prototype.on.call(me, ev, handler);
      };
      var CDATA = "[CDATA[";
      var DOCTYPE = "DOCTYPE";
      var XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
      var XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
      var rootNS = { xml: XML_NAMESPACE, xmlns: XMLNS_NAMESPACE };
      var nameStart = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
      var nameBody = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
      var entityStart = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
      var entityBody = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
      function isWhitespace(c) {
        return c === " " || c === "\n" || c === "\r" || c === "	";
      }
      function isQuote(c) {
        return c === '"' || c === "'";
      }
      function isAttribEnd(c) {
        return c === ">" || isWhitespace(c);
      }
      function isMatch(regex, c) {
        return regex.test(c);
      }
      function notMatch(regex, c) {
        return !isMatch(regex, c);
      }
      var S = 0;
      sax.STATE = {
        BEGIN: S++,
        // leading byte order mark or whitespace
        BEGIN_WHITESPACE: S++,
        // leading whitespace
        TEXT: S++,
        // general stuff
        TEXT_ENTITY: S++,
        // &amp and such.
        OPEN_WAKA: S++,
        // <
        SGML_DECL: S++,
        // <!BLARG
        SGML_DECL_QUOTED: S++,
        // <!BLARG foo "bar
        DOCTYPE: S++,
        // <!DOCTYPE
        DOCTYPE_QUOTED: S++,
        // <!DOCTYPE "//blah
        DOCTYPE_DTD: S++,
        // <!DOCTYPE "//blah" [ ...
        DOCTYPE_DTD_QUOTED: S++,
        // <!DOCTYPE "//blah" [ "foo
        COMMENT_STARTING: S++,
        // <!-
        COMMENT: S++,
        // <!--
        COMMENT_ENDING: S++,
        // <!-- blah -
        COMMENT_ENDED: S++,
        // <!-- blah --
        CDATA: S++,
        // <![CDATA[ something
        CDATA_ENDING: S++,
        // ]
        CDATA_ENDING_2: S++,
        // ]]
        PROC_INST: S++,
        // <?hi
        PROC_INST_BODY: S++,
        // <?hi there
        PROC_INST_ENDING: S++,
        // <?hi "there" ?
        OPEN_TAG: S++,
        // <strong
        OPEN_TAG_SLASH: S++,
        // <strong /
        ATTRIB: S++,
        // <a
        ATTRIB_NAME: S++,
        // <a foo
        ATTRIB_NAME_SAW_WHITE: S++,
        // <a foo _
        ATTRIB_VALUE: S++,
        // <a foo=
        ATTRIB_VALUE_QUOTED: S++,
        // <a foo="bar
        ATTRIB_VALUE_CLOSED: S++,
        // <a foo="bar"
        ATTRIB_VALUE_UNQUOTED: S++,
        // <a foo=bar
        ATTRIB_VALUE_ENTITY_Q: S++,
        // <foo bar="&quot;"
        ATTRIB_VALUE_ENTITY_U: S++,
        // <foo bar=&quot
        CLOSE_TAG: S++,
        // </a
        CLOSE_TAG_SAW_WHITE: S++,
        // </a   >
        SCRIPT: S++,
        // <script> ...
        SCRIPT_ENDING: S++
        // <script> ... <
      };
      sax.XML_ENTITIES = {
        amp: "&",
        gt: ">",
        lt: "<",
        quot: '"',
        apos: "'"
      };
      sax.ENTITIES = {
        amp: "&",
        gt: ">",
        lt: "<",
        quot: '"',
        apos: "'",
        AElig: 198,
        Aacute: 193,
        Acirc: 194,
        Agrave: 192,
        Aring: 197,
        Atilde: 195,
        Auml: 196,
        Ccedil: 199,
        ETH: 208,
        Eacute: 201,
        Ecirc: 202,
        Egrave: 200,
        Euml: 203,
        Iacute: 205,
        Icirc: 206,
        Igrave: 204,
        Iuml: 207,
        Ntilde: 209,
        Oacute: 211,
        Ocirc: 212,
        Ograve: 210,
        Oslash: 216,
        Otilde: 213,
        Ouml: 214,
        THORN: 222,
        Uacute: 218,
        Ucirc: 219,
        Ugrave: 217,
        Uuml: 220,
        Yacute: 221,
        aacute: 225,
        acirc: 226,
        aelig: 230,
        agrave: 224,
        aring: 229,
        atilde: 227,
        auml: 228,
        ccedil: 231,
        eacute: 233,
        ecirc: 234,
        egrave: 232,
        eth: 240,
        euml: 235,
        iacute: 237,
        icirc: 238,
        igrave: 236,
        iuml: 239,
        ntilde: 241,
        oacute: 243,
        ocirc: 244,
        ograve: 242,
        oslash: 248,
        otilde: 245,
        ouml: 246,
        szlig: 223,
        thorn: 254,
        uacute: 250,
        ucirc: 251,
        ugrave: 249,
        uuml: 252,
        yacute: 253,
        yuml: 255,
        copy: 169,
        reg: 174,
        nbsp: 160,
        iexcl: 161,
        cent: 162,
        pound: 163,
        curren: 164,
        yen: 165,
        brvbar: 166,
        sect: 167,
        uml: 168,
        ordf: 170,
        laquo: 171,
        not: 172,
        shy: 173,
        macr: 175,
        deg: 176,
        plusmn: 177,
        sup1: 185,
        sup2: 178,
        sup3: 179,
        acute: 180,
        micro: 181,
        para: 182,
        middot: 183,
        cedil: 184,
        ordm: 186,
        raquo: 187,
        frac14: 188,
        frac12: 189,
        frac34: 190,
        iquest: 191,
        times: 215,
        divide: 247,
        OElig: 338,
        oelig: 339,
        Scaron: 352,
        scaron: 353,
        Yuml: 376,
        fnof: 402,
        circ: 710,
        tilde: 732,
        Alpha: 913,
        Beta: 914,
        Gamma: 915,
        Delta: 916,
        Epsilon: 917,
        Zeta: 918,
        Eta: 919,
        Theta: 920,
        Iota: 921,
        Kappa: 922,
        Lambda: 923,
        Mu: 924,
        Nu: 925,
        Xi: 926,
        Omicron: 927,
        Pi: 928,
        Rho: 929,
        Sigma: 931,
        Tau: 932,
        Upsilon: 933,
        Phi: 934,
        Chi: 935,
        Psi: 936,
        Omega: 937,
        alpha: 945,
        beta: 946,
        gamma: 947,
        delta: 948,
        epsilon: 949,
        zeta: 950,
        eta: 951,
        theta: 952,
        iota: 953,
        kappa: 954,
        lambda: 955,
        mu: 956,
        nu: 957,
        xi: 958,
        omicron: 959,
        pi: 960,
        rho: 961,
        sigmaf: 962,
        sigma: 963,
        tau: 964,
        upsilon: 965,
        phi: 966,
        chi: 967,
        psi: 968,
        omega: 969,
        thetasym: 977,
        upsih: 978,
        piv: 982,
        ensp: 8194,
        emsp: 8195,
        thinsp: 8201,
        zwnj: 8204,
        zwj: 8205,
        lrm: 8206,
        rlm: 8207,
        ndash: 8211,
        mdash: 8212,
        lsquo: 8216,
        rsquo: 8217,
        sbquo: 8218,
        ldquo: 8220,
        rdquo: 8221,
        bdquo: 8222,
        dagger: 8224,
        Dagger: 8225,
        bull: 8226,
        hellip: 8230,
        permil: 8240,
        prime: 8242,
        Prime: 8243,
        lsaquo: 8249,
        rsaquo: 8250,
        oline: 8254,
        frasl: 8260,
        euro: 8364,
        image: 8465,
        weierp: 8472,
        real: 8476,
        trade: 8482,
        alefsym: 8501,
        larr: 8592,
        uarr: 8593,
        rarr: 8594,
        darr: 8595,
        harr: 8596,
        crarr: 8629,
        lArr: 8656,
        uArr: 8657,
        rArr: 8658,
        dArr: 8659,
        hArr: 8660,
        forall: 8704,
        part: 8706,
        exist: 8707,
        empty: 8709,
        nabla: 8711,
        isin: 8712,
        notin: 8713,
        ni: 8715,
        prod: 8719,
        sum: 8721,
        minus: 8722,
        lowast: 8727,
        radic: 8730,
        prop: 8733,
        infin: 8734,
        ang: 8736,
        and: 8743,
        or: 8744,
        cap: 8745,
        cup: 8746,
        int: 8747,
        there4: 8756,
        sim: 8764,
        cong: 8773,
        asymp: 8776,
        ne: 8800,
        equiv: 8801,
        le: 8804,
        ge: 8805,
        sub: 8834,
        sup: 8835,
        nsub: 8836,
        sube: 8838,
        supe: 8839,
        oplus: 8853,
        otimes: 8855,
        perp: 8869,
        sdot: 8901,
        lceil: 8968,
        rceil: 8969,
        lfloor: 8970,
        rfloor: 8971,
        lang: 9001,
        rang: 9002,
        loz: 9674,
        spades: 9824,
        clubs: 9827,
        hearts: 9829,
        diams: 9830
      };
      Object.keys(sax.ENTITIES).forEach(function(key) {
        var e = sax.ENTITIES[key];
        var s2 = typeof e === "number" ? String.fromCharCode(e) : e;
        sax.ENTITIES[key] = s2;
      });
      for (var s in sax.STATE) {
        sax.STATE[sax.STATE[s]] = s;
      }
      S = sax.STATE;
      function emit(parser, event, data) {
        parser[event] && parser[event](data);
      }
      function emitNode(parser, nodeType, data) {
        if (parser.textNode) closeText(parser);
        emit(parser, nodeType, data);
      }
      function closeText(parser) {
        parser.textNode = textopts(parser.opt, parser.textNode);
        if (parser.textNode) emit(parser, "ontext", parser.textNode);
        parser.textNode = "";
      }
      function textopts(opt, text) {
        if (opt.trim) text = text.trim();
        if (opt.normalize) text = text.replace(/\s+/g, " ");
        return text;
      }
      function error(parser, er) {
        closeText(parser);
        if (parser.trackPosition) {
          er += "\nLine: " + parser.line + "\nColumn: " + parser.column + "\nChar: " + parser.c;
        }
        er = new Error(er);
        parser.error = er;
        emit(parser, "onerror", er);
        return parser;
      }
      function end(parser) {
        if (parser.sawRoot && !parser.closedRoot)
          strictFail(parser, "Unclosed root tag");
        if (parser.state !== S.BEGIN && parser.state !== S.BEGIN_WHITESPACE && parser.state !== S.TEXT) {
          error(parser, "Unexpected end");
        }
        closeText(parser);
        parser.c = "";
        parser.closed = true;
        emit(parser, "onend");
        SAXParser.call(parser, parser.strict, parser.opt);
        return parser;
      }
      function strictFail(parser, message) {
        if (typeof parser !== "object" || !(parser instanceof SAXParser)) {
          throw new Error("bad call to strictFail");
        }
        if (parser.strict) {
          error(parser, message);
        }
      }
      function newTag(parser) {
        if (!parser.strict) parser.tagName = parser.tagName[parser.looseCase]();
        var parent = parser.tags[parser.tags.length - 1] || parser;
        var tag = parser.tag = { name: parser.tagName, attributes: {} };
        if (parser.opt.xmlns) {
          tag.ns = parent.ns;
        }
        parser.attribList.length = 0;
        emitNode(parser, "onopentagstart", tag);
      }
      function qname(name, attribute) {
        var i = name.indexOf(":");
        var qualName = i < 0 ? ["", name] : name.split(":");
        var prefix = qualName[0];
        var local = qualName[1];
        if (attribute && name === "xmlns") {
          prefix = "xmlns";
          local = "";
        }
        return { prefix, local };
      }
      function attrib(parser) {
        if (!parser.strict) {
          parser.attribName = parser.attribName[parser.looseCase]();
        }
        if (parser.attribList.indexOf(parser.attribName) !== -1 || parser.tag.attributes.hasOwnProperty(parser.attribName)) {
          parser.attribName = parser.attribValue = "";
          return;
        }
        if (parser.opt.xmlns) {
          var qn = qname(parser.attribName, true);
          var prefix = qn.prefix;
          var local = qn.local;
          if (prefix === "xmlns") {
            if (local === "xml" && parser.attribValue !== XML_NAMESPACE) {
              strictFail(
                parser,
                "xml: prefix must be bound to " + XML_NAMESPACE + "\nActual: " + parser.attribValue
              );
            } else if (local === "xmlns" && parser.attribValue !== XMLNS_NAMESPACE) {
              strictFail(
                parser,
                "xmlns: prefix must be bound to " + XMLNS_NAMESPACE + "\nActual: " + parser.attribValue
              );
            } else {
              var tag = parser.tag;
              var parent = parser.tags[parser.tags.length - 1] || parser;
              if (tag.ns === parent.ns) {
                tag.ns = Object.create(parent.ns);
              }
              tag.ns[local] = parser.attribValue;
            }
          }
          parser.attribList.push([parser.attribName, parser.attribValue]);
        } else {
          parser.tag.attributes[parser.attribName] = parser.attribValue;
          emitNode(parser, "onattribute", {
            name: parser.attribName,
            value: parser.attribValue
          });
        }
        parser.attribName = parser.attribValue = "";
      }
      function openTag(parser, selfClosing) {
        if (parser.opt.xmlns) {
          var tag = parser.tag;
          var qn = qname(parser.tagName);
          tag.prefix = qn.prefix;
          tag.local = qn.local;
          tag.uri = tag.ns[qn.prefix] || "";
          if (tag.prefix && !tag.uri) {
            strictFail(
              parser,
              "Unbound namespace prefix: " + JSON.stringify(parser.tagName)
            );
            tag.uri = qn.prefix;
          }
          var parent = parser.tags[parser.tags.length - 1] || parser;
          if (tag.ns && parent.ns !== tag.ns) {
            Object.keys(tag.ns).forEach(function(p) {
              emitNode(parser, "onopennamespace", {
                prefix: p,
                uri: tag.ns[p]
              });
            });
          }
          for (var i = 0, l = parser.attribList.length; i < l; i++) {
            var nv = parser.attribList[i];
            var name = nv[0];
            var value = nv[1];
            var qualName = qname(name, true);
            var prefix = qualName.prefix;
            var local = qualName.local;
            var uri = prefix === "" ? "" : tag.ns[prefix] || "";
            var a = {
              name,
              value,
              prefix,
              local,
              uri
            };
            if (prefix && prefix !== "xmlns" && !uri) {
              strictFail(
                parser,
                "Unbound namespace prefix: " + JSON.stringify(prefix)
              );
              a.uri = prefix;
            }
            parser.tag.attributes[name] = a;
            emitNode(parser, "onattribute", a);
          }
          parser.attribList.length = 0;
        }
        parser.tag.isSelfClosing = !!selfClosing;
        parser.sawRoot = true;
        parser.tags.push(parser.tag);
        emitNode(parser, "onopentag", parser.tag);
        if (!selfClosing) {
          if (!parser.noscript && parser.tagName.toLowerCase() === "script") {
            parser.state = S.SCRIPT;
          } else {
            parser.state = S.TEXT;
          }
          parser.tag = null;
          parser.tagName = "";
        }
        parser.attribName = parser.attribValue = "";
        parser.attribList.length = 0;
      }
      function closeTag(parser) {
        if (!parser.tagName) {
          strictFail(parser, "Weird empty close tag.");
          parser.textNode += "</>";
          parser.state = S.TEXT;
          return;
        }
        if (parser.script) {
          if (parser.tagName !== "script") {
            parser.script += "</" + parser.tagName + ">";
            parser.tagName = "";
            parser.state = S.SCRIPT;
            return;
          }
          emitNode(parser, "onscript", parser.script);
          parser.script = "";
        }
        var t = parser.tags.length;
        var tagName = parser.tagName;
        if (!parser.strict) {
          tagName = tagName[parser.looseCase]();
        }
        var closeTo = tagName;
        while (t--) {
          var close = parser.tags[t];
          if (close.name !== closeTo) {
            strictFail(parser, "Unexpected close tag");
          } else {
            break;
          }
        }
        if (t < 0) {
          strictFail(parser, "Unmatched closing tag: " + parser.tagName);
          parser.textNode += "</" + parser.tagName + ">";
          parser.state = S.TEXT;
          return;
        }
        parser.tagName = tagName;
        var s2 = parser.tags.length;
        while (s2-- > t) {
          var tag = parser.tag = parser.tags.pop();
          parser.tagName = parser.tag.name;
          emitNode(parser, "onclosetag", parser.tagName);
          var x = {};
          for (var i in tag.ns) {
            x[i] = tag.ns[i];
          }
          var parent = parser.tags[parser.tags.length - 1] || parser;
          if (parser.opt.xmlns && tag.ns !== parent.ns) {
            Object.keys(tag.ns).forEach(function(p) {
              var n = tag.ns[p];
              emitNode(parser, "onclosenamespace", { prefix: p, uri: n });
            });
          }
        }
        if (t === 0) parser.closedRoot = true;
        parser.tagName = parser.attribValue = parser.attribName = "";
        parser.attribList.length = 0;
        parser.state = S.TEXT;
      }
      function parseEntity(parser) {
        var entity = parser.entity;
        var entityLC = entity.toLowerCase();
        var num;
        var numStr = "";
        if (parser.ENTITIES[entity]) {
          return parser.ENTITIES[entity];
        }
        if (parser.ENTITIES[entityLC]) {
          return parser.ENTITIES[entityLC];
        }
        entity = entityLC;
        if (entity.charAt(0) === "#") {
          if (entity.charAt(1) === "x") {
            entity = entity.slice(2);
            num = parseInt(entity, 16);
            numStr = num.toString(16);
          } else {
            entity = entity.slice(1);
            num = parseInt(entity, 10);
            numStr = num.toString(10);
          }
        }
        entity = entity.replace(/^0+/, "");
        if (isNaN(num) || numStr.toLowerCase() !== entity || num < 0 || num > 1114111) {
          strictFail(parser, "Invalid character entity");
          return "&" + parser.entity + ";";
        }
        return String.fromCodePoint(num);
      }
      function beginWhiteSpace(parser, c) {
        if (c === "<") {
          parser.state = S.OPEN_WAKA;
          parser.startTagPosition = parser.position;
        } else if (!isWhitespace(c)) {
          strictFail(parser, "Non-whitespace before first tag.");
          parser.textNode = c;
          parser.state = S.TEXT;
        }
      }
      function charAt(chunk, i) {
        var result = "";
        if (i < chunk.length) {
          result = chunk.charAt(i);
        }
        return result;
      }
      function write(chunk) {
        var parser = this;
        if (this.error) {
          throw this.error;
        }
        if (parser.closed) {
          return error(
            parser,
            "Cannot write after close. Assign an onready handler."
          );
        }
        if (chunk === null) {
          return end(parser);
        }
        if (typeof chunk === "object") {
          chunk = chunk.toString();
        }
        var i = 0;
        var c = "";
        while (true) {
          c = charAt(chunk, i++);
          parser.c = c;
          if (!c) {
            break;
          }
          if (parser.trackPosition) {
            parser.position++;
            if (c === "\n") {
              parser.line++;
              parser.column = 0;
            } else {
              parser.column++;
            }
          }
          switch (parser.state) {
            case S.BEGIN:
              parser.state = S.BEGIN_WHITESPACE;
              if (c === "\uFEFF") {
                continue;
              }
              beginWhiteSpace(parser, c);
              continue;
            case S.BEGIN_WHITESPACE:
              beginWhiteSpace(parser, c);
              continue;
            case S.TEXT:
              if (parser.sawRoot && !parser.closedRoot) {
                var starti = i - 1;
                while (c && c !== "<" && c !== "&") {
                  c = charAt(chunk, i++);
                  if (c && parser.trackPosition) {
                    parser.position++;
                    if (c === "\n") {
                      parser.line++;
                      parser.column = 0;
                    } else {
                      parser.column++;
                    }
                  }
                }
                parser.textNode += chunk.substring(starti, i - 1);
              }
              if (c === "<" && !(parser.sawRoot && parser.closedRoot && !parser.strict)) {
                parser.state = S.OPEN_WAKA;
                parser.startTagPosition = parser.position;
              } else {
                if (!isWhitespace(c) && (!parser.sawRoot || parser.closedRoot)) {
                  strictFail(parser, "Text data outside of root node.");
                }
                if (c === "&") {
                  parser.state = S.TEXT_ENTITY;
                } else {
                  parser.textNode += c;
                }
              }
              continue;
            case S.SCRIPT:
              if (c === "<") {
                parser.state = S.SCRIPT_ENDING;
              } else {
                parser.script += c;
              }
              continue;
            case S.SCRIPT_ENDING:
              if (c === "/") {
                parser.state = S.CLOSE_TAG;
              } else {
                parser.script += "<" + c;
                parser.state = S.SCRIPT;
              }
              continue;
            case S.OPEN_WAKA:
              if (c === "!") {
                parser.state = S.SGML_DECL;
                parser.sgmlDecl = "";
              } else if (isWhitespace(c)) {
              } else if (isMatch(nameStart, c)) {
                parser.state = S.OPEN_TAG;
                parser.tagName = c;
              } else if (c === "/") {
                parser.state = S.CLOSE_TAG;
                parser.tagName = "";
              } else if (c === "?") {
                parser.state = S.PROC_INST;
                parser.procInstName = parser.procInstBody = "";
              } else {
                strictFail(parser, "Unencoded <");
                if (parser.startTagPosition + 1 < parser.position) {
                  var pad = parser.position - parser.startTagPosition;
                  c = new Array(pad).join(" ") + c;
                }
                parser.textNode += "<" + c;
                parser.state = S.TEXT;
              }
              continue;
            case S.SGML_DECL:
              if (parser.sgmlDecl + c === "--") {
                parser.state = S.COMMENT;
                parser.comment = "";
                parser.sgmlDecl = "";
                continue;
              }
              if (parser.doctype && parser.doctype !== true && parser.sgmlDecl) {
                parser.state = S.DOCTYPE_DTD;
                parser.doctype += "<!" + parser.sgmlDecl + c;
                parser.sgmlDecl = "";
              } else if ((parser.sgmlDecl + c).toUpperCase() === CDATA) {
                emitNode(parser, "onopencdata");
                parser.state = S.CDATA;
                parser.sgmlDecl = "";
                parser.cdata = "";
              } else if ((parser.sgmlDecl + c).toUpperCase() === DOCTYPE) {
                parser.state = S.DOCTYPE;
                if (parser.doctype || parser.sawRoot) {
                  strictFail(
                    parser,
                    "Inappropriately located doctype declaration"
                  );
                }
                parser.doctype = "";
                parser.sgmlDecl = "";
              } else if (c === ">") {
                emitNode(parser, "onsgmldeclaration", parser.sgmlDecl);
                parser.sgmlDecl = "";
                parser.state = S.TEXT;
              } else if (isQuote(c)) {
                parser.state = S.SGML_DECL_QUOTED;
                parser.sgmlDecl += c;
              } else {
                parser.sgmlDecl += c;
              }
              continue;
            case S.SGML_DECL_QUOTED:
              if (c === parser.q) {
                parser.state = S.SGML_DECL;
                parser.q = "";
              }
              parser.sgmlDecl += c;
              continue;
            case S.DOCTYPE:
              if (c === ">") {
                parser.state = S.TEXT;
                emitNode(parser, "ondoctype", parser.doctype);
                parser.doctype = true;
              } else {
                parser.doctype += c;
                if (c === "[") {
                  parser.state = S.DOCTYPE_DTD;
                } else if (isQuote(c)) {
                  parser.state = S.DOCTYPE_QUOTED;
                  parser.q = c;
                }
              }
              continue;
            case S.DOCTYPE_QUOTED:
              parser.doctype += c;
              if (c === parser.q) {
                parser.q = "";
                parser.state = S.DOCTYPE;
              }
              continue;
            case S.DOCTYPE_DTD:
              if (c === "]") {
                parser.doctype += c;
                parser.state = S.DOCTYPE;
              } else if (c === "<") {
                parser.state = S.OPEN_WAKA;
                parser.startTagPosition = parser.position;
              } else if (isQuote(c)) {
                parser.doctype += c;
                parser.state = S.DOCTYPE_DTD_QUOTED;
                parser.q = c;
              } else {
                parser.doctype += c;
              }
              continue;
            case S.DOCTYPE_DTD_QUOTED:
              parser.doctype += c;
              if (c === parser.q) {
                parser.state = S.DOCTYPE_DTD;
                parser.q = "";
              }
              continue;
            case S.COMMENT:
              if (c === "-") {
                parser.state = S.COMMENT_ENDING;
              } else {
                parser.comment += c;
              }
              continue;
            case S.COMMENT_ENDING:
              if (c === "-") {
                parser.state = S.COMMENT_ENDED;
                parser.comment = textopts(parser.opt, parser.comment);
                if (parser.comment) {
                  emitNode(parser, "oncomment", parser.comment);
                }
                parser.comment = "";
              } else {
                parser.comment += "-" + c;
                parser.state = S.COMMENT;
              }
              continue;
            case S.COMMENT_ENDED:
              if (c !== ">") {
                strictFail(parser, "Malformed comment");
                parser.comment += "--" + c;
                parser.state = S.COMMENT;
              } else if (parser.doctype && parser.doctype !== true) {
                parser.state = S.DOCTYPE_DTD;
              } else {
                parser.state = S.TEXT;
              }
              continue;
            case S.CDATA:
              var starti = i - 1;
              while (c && c !== "]") {
                c = charAt(chunk, i++);
                if (c && parser.trackPosition) {
                  parser.position++;
                  if (c === "\n") {
                    parser.line++;
                    parser.column = 0;
                  } else {
                    parser.column++;
                  }
                }
              }
              parser.cdata += chunk.substring(starti, i - 1);
              if (c === "]") {
                parser.state = S.CDATA_ENDING;
              }
              continue;
            case S.CDATA_ENDING:
              if (c === "]") {
                parser.state = S.CDATA_ENDING_2;
              } else {
                parser.cdata += "]" + c;
                parser.state = S.CDATA;
              }
              continue;
            case S.CDATA_ENDING_2:
              if (c === ">") {
                if (parser.cdata) {
                  emitNode(parser, "oncdata", parser.cdata);
                }
                emitNode(parser, "onclosecdata");
                parser.cdata = "";
                parser.state = S.TEXT;
              } else if (c === "]") {
                parser.cdata += "]";
              } else {
                parser.cdata += "]]" + c;
                parser.state = S.CDATA;
              }
              continue;
            case S.PROC_INST:
              if (c === "?") {
                parser.state = S.PROC_INST_ENDING;
              } else if (isWhitespace(c)) {
                parser.state = S.PROC_INST_BODY;
              } else {
                parser.procInstName += c;
              }
              continue;
            case S.PROC_INST_BODY:
              if (!parser.procInstBody && isWhitespace(c)) {
                continue;
              } else if (c === "?") {
                parser.state = S.PROC_INST_ENDING;
              } else {
                parser.procInstBody += c;
              }
              continue;
            case S.PROC_INST_ENDING:
              if (c === ">") {
                emitNode(parser, "onprocessinginstruction", {
                  name: parser.procInstName,
                  body: parser.procInstBody
                });
                parser.procInstName = parser.procInstBody = "";
                parser.state = S.TEXT;
              } else {
                parser.procInstBody += "?" + c;
                parser.state = S.PROC_INST_BODY;
              }
              continue;
            case S.OPEN_TAG:
              if (isMatch(nameBody, c)) {
                parser.tagName += c;
              } else {
                newTag(parser);
                if (c === ">") {
                  openTag(parser);
                } else if (c === "/") {
                  parser.state = S.OPEN_TAG_SLASH;
                } else {
                  if (!isWhitespace(c)) {
                    strictFail(parser, "Invalid character in tag name");
                  }
                  parser.state = S.ATTRIB;
                }
              }
              continue;
            case S.OPEN_TAG_SLASH:
              if (c === ">") {
                openTag(parser, true);
                closeTag(parser);
              } else {
                strictFail(
                  parser,
                  "Forward-slash in opening tag not followed by >"
                );
                parser.state = S.ATTRIB;
              }
              continue;
            case S.ATTRIB:
              if (isWhitespace(c)) {
                continue;
              } else if (c === ">") {
                openTag(parser);
              } else if (c === "/") {
                parser.state = S.OPEN_TAG_SLASH;
              } else if (isMatch(nameStart, c)) {
                parser.attribName = c;
                parser.attribValue = "";
                parser.state = S.ATTRIB_NAME;
              } else {
                strictFail(parser, "Invalid attribute name");
              }
              continue;
            case S.ATTRIB_NAME:
              if (c === "=") {
                parser.state = S.ATTRIB_VALUE;
              } else if (c === ">") {
                strictFail(parser, "Attribute without value");
                parser.attribValue = parser.attribName;
                attrib(parser);
                openTag(parser);
              } else if (isWhitespace(c)) {
                parser.state = S.ATTRIB_NAME_SAW_WHITE;
              } else if (isMatch(nameBody, c)) {
                parser.attribName += c;
              } else {
                strictFail(parser, "Invalid attribute name");
              }
              continue;
            case S.ATTRIB_NAME_SAW_WHITE:
              if (c === "=") {
                parser.state = S.ATTRIB_VALUE;
              } else if (isWhitespace(c)) {
                continue;
              } else {
                strictFail(parser, "Attribute without value");
                parser.tag.attributes[parser.attribName] = "";
                parser.attribValue = "";
                emitNode(parser, "onattribute", {
                  name: parser.attribName,
                  value: ""
                });
                parser.attribName = "";
                if (c === ">") {
                  openTag(parser);
                } else if (isMatch(nameStart, c)) {
                  parser.attribName = c;
                  parser.state = S.ATTRIB_NAME;
                } else {
                  strictFail(parser, "Invalid attribute name");
                  parser.state = S.ATTRIB;
                }
              }
              continue;
            case S.ATTRIB_VALUE:
              if (isWhitespace(c)) {
                continue;
              } else if (isQuote(c)) {
                parser.q = c;
                parser.state = S.ATTRIB_VALUE_QUOTED;
              } else {
                if (!parser.opt.unquotedAttributeValues) {
                  error(parser, "Unquoted attribute value");
                }
                parser.state = S.ATTRIB_VALUE_UNQUOTED;
                parser.attribValue = c;
              }
              continue;
            case S.ATTRIB_VALUE_QUOTED:
              if (c !== parser.q) {
                if (c === "&") {
                  parser.state = S.ATTRIB_VALUE_ENTITY_Q;
                } else {
                  parser.attribValue += c;
                }
                continue;
              }
              attrib(parser);
              parser.q = "";
              parser.state = S.ATTRIB_VALUE_CLOSED;
              continue;
            case S.ATTRIB_VALUE_CLOSED:
              if (isWhitespace(c)) {
                parser.state = S.ATTRIB;
              } else if (c === ">") {
                openTag(parser);
              } else if (c === "/") {
                parser.state = S.OPEN_TAG_SLASH;
              } else if (isMatch(nameStart, c)) {
                strictFail(parser, "No whitespace between attributes");
                parser.attribName = c;
                parser.attribValue = "";
                parser.state = S.ATTRIB_NAME;
              } else {
                strictFail(parser, "Invalid attribute name");
              }
              continue;
            case S.ATTRIB_VALUE_UNQUOTED:
              if (!isAttribEnd(c)) {
                if (c === "&") {
                  parser.state = S.ATTRIB_VALUE_ENTITY_U;
                } else {
                  parser.attribValue += c;
                }
                continue;
              }
              attrib(parser);
              if (c === ">") {
                openTag(parser);
              } else {
                parser.state = S.ATTRIB;
              }
              continue;
            case S.CLOSE_TAG:
              if (!parser.tagName) {
                if (isWhitespace(c)) {
                  continue;
                } else if (notMatch(nameStart, c)) {
                  if (parser.script) {
                    parser.script += "</" + c;
                    parser.state = S.SCRIPT;
                  } else {
                    strictFail(parser, "Invalid tagname in closing tag.");
                  }
                } else {
                  parser.tagName = c;
                }
              } else if (c === ">") {
                closeTag(parser);
              } else if (isMatch(nameBody, c)) {
                parser.tagName += c;
              } else if (parser.script) {
                parser.script += "</" + parser.tagName;
                parser.tagName = "";
                parser.state = S.SCRIPT;
              } else {
                if (!isWhitespace(c)) {
                  strictFail(parser, "Invalid tagname in closing tag");
                }
                parser.state = S.CLOSE_TAG_SAW_WHITE;
              }
              continue;
            case S.CLOSE_TAG_SAW_WHITE:
              if (isWhitespace(c)) {
                continue;
              }
              if (c === ">") {
                closeTag(parser);
              } else {
                strictFail(parser, "Invalid characters in closing tag");
              }
              continue;
            case S.TEXT_ENTITY:
            case S.ATTRIB_VALUE_ENTITY_Q:
            case S.ATTRIB_VALUE_ENTITY_U:
              var returnState;
              var buffer;
              switch (parser.state) {
                case S.TEXT_ENTITY:
                  returnState = S.TEXT;
                  buffer = "textNode";
                  break;
                case S.ATTRIB_VALUE_ENTITY_Q:
                  returnState = S.ATTRIB_VALUE_QUOTED;
                  buffer = "attribValue";
                  break;
                case S.ATTRIB_VALUE_ENTITY_U:
                  returnState = S.ATTRIB_VALUE_UNQUOTED;
                  buffer = "attribValue";
                  break;
              }
              if (c === ";") {
                var parsedEntity = parseEntity(parser);
                if (parser.opt.unparsedEntities && !Object.values(sax.XML_ENTITIES).includes(parsedEntity)) {
                  parser.entity = "";
                  parser.state = returnState;
                  parser.write(parsedEntity);
                } else {
                  parser[buffer] += parsedEntity;
                  parser.entity = "";
                  parser.state = returnState;
                }
              } else if (isMatch(parser.entity.length ? entityBody : entityStart, c)) {
                parser.entity += c;
              } else {
                strictFail(parser, "Invalid character in entity name");
                parser[buffer] += "&" + parser.entity + c;
                parser.entity = "";
                parser.state = returnState;
              }
              continue;
            default: {
              throw new Error(parser, "Unknown state: " + parser.state);
            }
          }
        }
        if (parser.position >= parser.bufferCheckPosition) {
          checkBufferLength(parser);
        }
        return parser;
      }
      if (!String.fromCodePoint) {
        ;
        (function() {
          var stringFromCharCode = String.fromCharCode;
          var floor = Math.floor;
          var fromCodePoint = function() {
            var MAX_SIZE = 16384;
            var codeUnits = [];
            var highSurrogate;
            var lowSurrogate;
            var index = -1;
            var length = arguments.length;
            if (!length) {
              return "";
            }
            var result = "";
            while (++index < length) {
              var codePoint = Number(arguments[index]);
              if (!isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
              codePoint < 0 || // not a valid Unicode code point
              codePoint > 1114111 || // not a valid Unicode code point
              floor(codePoint) !== codePoint) {
                throw RangeError("Invalid code point: " + codePoint);
              }
              if (codePoint <= 65535) {
                codeUnits.push(codePoint);
              } else {
                codePoint -= 65536;
                highSurrogate = (codePoint >> 10) + 55296;
                lowSurrogate = codePoint % 1024 + 56320;
                codeUnits.push(highSurrogate, lowSurrogate);
              }
              if (index + 1 === length || codeUnits.length > MAX_SIZE) {
                result += stringFromCharCode.apply(null, codeUnits);
                codeUnits.length = 0;
              }
            }
            return result;
          };
          if (Object.defineProperty) {
            Object.defineProperty(String, "fromCodePoint", {
              value: fromCodePoint,
              configurable: true,
              writable: true
            });
          } else {
            String.fromCodePoint = fromCodePoint;
          }
        })();
      }
    })(typeof exports2 === "undefined" ? exports2.sax = {} : exports2);
  }
});

// node_modules/xml2js/lib/bom.js
var require_bom = __commonJS({
  "node_modules/xml2js/lib/bom.js"(exports2) {
    (function() {
      "use strict";
      exports2.stripBOM = function(str) {
        if (str[0] === "\uFEFF") {
          return str.substring(1);
        } else {
          return str;
        }
      };
    }).call(exports2);
  }
});

// node_modules/xml2js/lib/processors.js
var require_processors = __commonJS({
  "node_modules/xml2js/lib/processors.js"(exports2) {
    (function() {
      "use strict";
      var prefixMatch;
      prefixMatch = new RegExp(/(?!xmlns)^.*:/);
      exports2.normalize = function(str) {
        return str.toLowerCase();
      };
      exports2.firstCharLowerCase = function(str) {
        return str.charAt(0).toLowerCase() + str.slice(1);
      };
      exports2.stripPrefix = function(str) {
        return str.replace(prefixMatch, "");
      };
      exports2.parseNumbers = function(str) {
        if (!isNaN(str)) {
          str = str % 1 === 0 ? parseInt(str, 10) : parseFloat(str);
        }
        return str;
      };
      exports2.parseBooleans = function(str) {
        if (/^(?:true|false)$/i.test(str)) {
          str = str.toLowerCase() === "true";
        }
        return str;
      };
    }).call(exports2);
  }
});

// node_modules/xml2js/lib/parser.js
var require_parser = __commonJS({
  "node_modules/xml2js/lib/parser.js"(exports2) {
    (function() {
      "use strict";
      var bom, defaults2, defineProperty, events, isEmpty, processItem, processors, sax, setImmediate, bind = function(fn, me) {
        return function() {
          return fn.apply(me, arguments);
        };
      }, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      sax = require_sax();
      events = require("events");
      bom = require_bom();
      processors = require_processors();
      setImmediate = require("timers").setImmediate;
      defaults2 = require_defaults().defaults;
      isEmpty = function(thing) {
        return typeof thing === "object" && thing != null && Object.keys(thing).length === 0;
      };
      processItem = function(processors2, item, key) {
        var i, len, process2;
        for (i = 0, len = processors2.length; i < len; i++) {
          process2 = processors2[i];
          item = process2(item, key);
        }
        return item;
      };
      defineProperty = function(obj, key, value) {
        var descriptor;
        descriptor = /* @__PURE__ */ Object.create(null);
        descriptor.value = value;
        descriptor.writable = true;
        descriptor.enumerable = true;
        descriptor.configurable = true;
        return Object.defineProperty(obj, key, descriptor);
      };
      exports2.Parser = function(superClass) {
        extend(Parser, superClass);
        function Parser(opts) {
          this.parseStringPromise = bind(this.parseStringPromise, this);
          this.parseString = bind(this.parseString, this);
          this.reset = bind(this.reset, this);
          this.assignOrPush = bind(this.assignOrPush, this);
          this.processAsync = bind(this.processAsync, this);
          var key, ref, value;
          if (!(this instanceof exports2.Parser)) {
            return new exports2.Parser(opts);
          }
          this.options = {};
          ref = defaults2["0.2"];
          for (key in ref) {
            if (!hasProp.call(ref, key)) continue;
            value = ref[key];
            this.options[key] = value;
          }
          for (key in opts) {
            if (!hasProp.call(opts, key)) continue;
            value = opts[key];
            this.options[key] = value;
          }
          if (this.options.xmlns) {
            this.options.xmlnskey = this.options.attrkey + "ns";
          }
          if (this.options.normalizeTags) {
            if (!this.options.tagNameProcessors) {
              this.options.tagNameProcessors = [];
            }
            this.options.tagNameProcessors.unshift(processors.normalize);
          }
          this.reset();
        }
        Parser.prototype.processAsync = function() {
          var chunk, err;
          try {
            if (this.remaining.length <= this.options.chunkSize) {
              chunk = this.remaining;
              this.remaining = "";
              this.saxParser = this.saxParser.write(chunk);
              return this.saxParser.close();
            } else {
              chunk = this.remaining.substr(0, this.options.chunkSize);
              this.remaining = this.remaining.substr(this.options.chunkSize, this.remaining.length);
              this.saxParser = this.saxParser.write(chunk);
              return setImmediate(this.processAsync);
            }
          } catch (error1) {
            err = error1;
            if (!this.saxParser.errThrown) {
              this.saxParser.errThrown = true;
              return this.emit(err);
            }
          }
        };
        Parser.prototype.assignOrPush = function(obj, key, newValue) {
          if (!(key in obj)) {
            if (!this.options.explicitArray) {
              return defineProperty(obj, key, newValue);
            } else {
              return defineProperty(obj, key, [newValue]);
            }
          } else {
            if (!(obj[key] instanceof Array)) {
              defineProperty(obj, key, [obj[key]]);
            }
            return obj[key].push(newValue);
          }
        };
        Parser.prototype.reset = function() {
          var attrkey, charkey, ontext, stack;
          this.removeAllListeners();
          this.saxParser = sax.parser(this.options.strict, {
            trim: false,
            normalize: false,
            xmlns: this.options.xmlns
          });
          this.saxParser.errThrown = false;
          this.saxParser.onerror = /* @__PURE__ */ function(_this) {
            return function(error) {
              _this.saxParser.resume();
              if (!_this.saxParser.errThrown) {
                _this.saxParser.errThrown = true;
                return _this.emit("error", error);
              }
            };
          }(this);
          this.saxParser.onend = /* @__PURE__ */ function(_this) {
            return function() {
              if (!_this.saxParser.ended) {
                _this.saxParser.ended = true;
                return _this.emit("end", _this.resultObject);
              }
            };
          }(this);
          this.saxParser.ended = false;
          this.EXPLICIT_CHARKEY = this.options.explicitCharkey;
          this.resultObject = null;
          stack = [];
          attrkey = this.options.attrkey;
          charkey = this.options.charkey;
          this.saxParser.onopentag = /* @__PURE__ */ function(_this) {
            return function(node) {
              var key, newValue, obj, processedKey, ref;
              obj = {};
              obj[charkey] = "";
              if (!_this.options.ignoreAttrs) {
                ref = node.attributes;
                for (key in ref) {
                  if (!hasProp.call(ref, key)) continue;
                  if (!(attrkey in obj) && !_this.options.mergeAttrs) {
                    obj[attrkey] = {};
                  }
                  newValue = _this.options.attrValueProcessors ? processItem(_this.options.attrValueProcessors, node.attributes[key], key) : node.attributes[key];
                  processedKey = _this.options.attrNameProcessors ? processItem(_this.options.attrNameProcessors, key) : key;
                  if (_this.options.mergeAttrs) {
                    _this.assignOrPush(obj, processedKey, newValue);
                  } else {
                    defineProperty(obj[attrkey], processedKey, newValue);
                  }
                }
              }
              obj["#name"] = _this.options.tagNameProcessors ? processItem(_this.options.tagNameProcessors, node.name) : node.name;
              if (_this.options.xmlns) {
                obj[_this.options.xmlnskey] = {
                  uri: node.uri,
                  local: node.local
                };
              }
              return stack.push(obj);
            };
          }(this);
          this.saxParser.onclosetag = /* @__PURE__ */ function(_this) {
            return function() {
              var cdata, emptyStr, key, node, nodeName, obj, objClone, old, s, xpath;
              obj = stack.pop();
              nodeName = obj["#name"];
              if (!_this.options.explicitChildren || !_this.options.preserveChildrenOrder) {
                delete obj["#name"];
              }
              if (obj.cdata === true) {
                cdata = obj.cdata;
                delete obj.cdata;
              }
              s = stack[stack.length - 1];
              if (obj[charkey].match(/^\s*$/) && !cdata) {
                emptyStr = obj[charkey];
                delete obj[charkey];
              } else {
                if (_this.options.trim) {
                  obj[charkey] = obj[charkey].trim();
                }
                if (_this.options.normalize) {
                  obj[charkey] = obj[charkey].replace(/\s{2,}/g, " ").trim();
                }
                obj[charkey] = _this.options.valueProcessors ? processItem(_this.options.valueProcessors, obj[charkey], nodeName) : obj[charkey];
                if (Object.keys(obj).length === 1 && charkey in obj && !_this.EXPLICIT_CHARKEY) {
                  obj = obj[charkey];
                }
              }
              if (isEmpty(obj)) {
                if (typeof _this.options.emptyTag === "function") {
                  obj = _this.options.emptyTag();
                } else {
                  obj = _this.options.emptyTag !== "" ? _this.options.emptyTag : emptyStr;
                }
              }
              if (_this.options.validator != null) {
                xpath = "/" + function() {
                  var i, len, results;
                  results = [];
                  for (i = 0, len = stack.length; i < len; i++) {
                    node = stack[i];
                    results.push(node["#name"]);
                  }
                  return results;
                }().concat(nodeName).join("/");
                (function() {
                  var err;
                  try {
                    return obj = _this.options.validator(xpath, s && s[nodeName], obj);
                  } catch (error1) {
                    err = error1;
                    return _this.emit("error", err);
                  }
                })();
              }
              if (_this.options.explicitChildren && !_this.options.mergeAttrs && typeof obj === "object") {
                if (!_this.options.preserveChildrenOrder) {
                  node = {};
                  if (_this.options.attrkey in obj) {
                    node[_this.options.attrkey] = obj[_this.options.attrkey];
                    delete obj[_this.options.attrkey];
                  }
                  if (!_this.options.charsAsChildren && _this.options.charkey in obj) {
                    node[_this.options.charkey] = obj[_this.options.charkey];
                    delete obj[_this.options.charkey];
                  }
                  if (Object.getOwnPropertyNames(obj).length > 0) {
                    node[_this.options.childkey] = obj;
                  }
                  obj = node;
                } else if (s) {
                  s[_this.options.childkey] = s[_this.options.childkey] || [];
                  objClone = {};
                  for (key in obj) {
                    if (!hasProp.call(obj, key)) continue;
                    defineProperty(objClone, key, obj[key]);
                  }
                  s[_this.options.childkey].push(objClone);
                  delete obj["#name"];
                  if (Object.keys(obj).length === 1 && charkey in obj && !_this.EXPLICIT_CHARKEY) {
                    obj = obj[charkey];
                  }
                }
              }
              if (stack.length > 0) {
                return _this.assignOrPush(s, nodeName, obj);
              } else {
                if (_this.options.explicitRoot) {
                  old = obj;
                  obj = {};
                  defineProperty(obj, nodeName, old);
                }
                _this.resultObject = obj;
                _this.saxParser.ended = true;
                return _this.emit("end", _this.resultObject);
              }
            };
          }(this);
          ontext = /* @__PURE__ */ function(_this) {
            return function(text) {
              var charChild, s;
              s = stack[stack.length - 1];
              if (s) {
                s[charkey] += text;
                if (_this.options.explicitChildren && _this.options.preserveChildrenOrder && _this.options.charsAsChildren && (_this.options.includeWhiteChars || text.replace(/\\n/g, "").trim() !== "")) {
                  s[_this.options.childkey] = s[_this.options.childkey] || [];
                  charChild = {
                    "#name": "__text__"
                  };
                  charChild[charkey] = text;
                  if (_this.options.normalize) {
                    charChild[charkey] = charChild[charkey].replace(/\s{2,}/g, " ").trim();
                  }
                  s[_this.options.childkey].push(charChild);
                }
                return s;
              }
            };
          }(this);
          this.saxParser.ontext = ontext;
          return this.saxParser.oncdata = /* @__PURE__ */ function(_this) {
            return function(text) {
              var s;
              s = ontext(text);
              if (s) {
                return s.cdata = true;
              }
            };
          }(this);
        };
        Parser.prototype.parseString = function(str, cb) {
          var err;
          if (cb != null && typeof cb === "function") {
            this.on("end", function(result) {
              this.reset();
              return cb(null, result);
            });
            this.on("error", function(err2) {
              this.reset();
              return cb(err2);
            });
          }
          try {
            str = str.toString();
            if (str.trim() === "") {
              this.emit("end", null);
              return true;
            }
            str = bom.stripBOM(str);
            if (this.options.async) {
              this.remaining = str;
              setImmediate(this.processAsync);
              return this.saxParser;
            }
            return this.saxParser.write(str).close();
          } catch (error1) {
            err = error1;
            if (!(this.saxParser.errThrown || this.saxParser.ended)) {
              this.emit("error", err);
              return this.saxParser.errThrown = true;
            } else if (this.saxParser.ended) {
              throw err;
            }
          }
        };
        Parser.prototype.parseStringPromise = function(str) {
          return new Promise(/* @__PURE__ */ function(_this) {
            return function(resolve2, reject) {
              return _this.parseString(str, function(err, value) {
                if (err) {
                  return reject(err);
                } else {
                  return resolve2(value);
                }
              });
            };
          }(this));
        };
        return Parser;
      }(events);
      exports2.parseString = function(str, a, b) {
        var cb, options, parser;
        if (b != null) {
          if (typeof b === "function") {
            cb = b;
          }
          if (typeof a === "object") {
            options = a;
          }
        } else {
          if (typeof a === "function") {
            cb = a;
          }
          options = {};
        }
        parser = new exports2.Parser(options);
        return parser.parseString(str, cb);
      };
      exports2.parseStringPromise = function(str, a) {
        var options, parser;
        if (typeof a === "object") {
          options = a;
        }
        parser = new exports2.Parser(options);
        return parser.parseStringPromise(str);
      };
    }).call(exports2);
  }
});

// node_modules/xml2js/lib/xml2js.js
var require_xml2js = __commonJS({
  "node_modules/xml2js/lib/xml2js.js"(exports2) {
    (function() {
      "use strict";
      var builder, defaults2, parser, processors, extend = function(child, parent) {
        for (var key in parent) {
          if (hasProp.call(parent, key)) child[key] = parent[key];
        }
        function ctor() {
          this.constructor = child;
        }
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();
        child.__super__ = parent.prototype;
        return child;
      }, hasProp = {}.hasOwnProperty;
      defaults2 = require_defaults();
      builder = require_builder();
      parser = require_parser();
      processors = require_processors();
      exports2.defaults = defaults2.defaults;
      exports2.processors = processors;
      exports2.ValidationError = function(superClass) {
        extend(ValidationError, superClass);
        function ValidationError(message) {
          this.message = message;
        }
        return ValidationError;
      }(Error);
      exports2.Builder = builder.Builder;
      exports2.Parser = parser.Parser;
      exports2.parseString = parser.parseString;
      exports2.parseStringPromise = parser.parseStringPromise;
    }).call(exports2);
  }
});

// node_modules/tmp/lib/tmp.js
var require_tmp = __commonJS({
  "node_modules/tmp/lib/tmp.js"(exports2, module2) {
    var fs = require("fs");
    var os2 = require("os");
    var path30 = require("path");
    var crypto2 = require("crypto");
    var _c = { fs: fs.constants, os: os2.constants };
    var RANDOM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    var TEMPLATE_PATTERN = /XXXXXX/;
    var DEFAULT_TRIES = 3;
    var CREATE_FLAGS = (_c.O_CREAT || _c.fs.O_CREAT) | (_c.O_EXCL || _c.fs.O_EXCL) | (_c.O_RDWR || _c.fs.O_RDWR);
    var IS_WIN32 = os2.platform() === "win32";
    var EBADF = _c.EBADF || _c.os.errno.EBADF;
    var ENOENT = _c.ENOENT || _c.os.errno.ENOENT;
    var DIR_MODE = 448;
    var FILE_MODE = 384;
    var EXIT = "exit";
    var _removeObjects = [];
    var FN_RMDIR_SYNC = fs.rmdirSync.bind(fs);
    var _gracefulCleanup = false;
    function rimraf(dirPath, callback2) {
      return fs.rm(dirPath, { recursive: true }, callback2);
    }
    function FN_RIMRAF_SYNC(dirPath) {
      return fs.rmSync(dirPath, { recursive: true });
    }
    function tmpName(options, callback2) {
      const args = _parseArguments(options, callback2), opts = args[0], cb = args[1];
      _assertAndSanitizeOptions(opts, function(err, sanitizedOptions) {
        if (err) return cb(err);
        let tries = sanitizedOptions.tries;
        (function _getUniqueName() {
          try {
            const name = _generateTmpName(sanitizedOptions);
            fs.stat(name, function(err2) {
              if (!err2) {
                if (tries-- > 0) return _getUniqueName();
                return cb(new Error("Could not get a unique tmp filename, max tries reached " + name));
              }
              cb(null, name);
            });
          } catch (err2) {
            cb(err2);
          }
        })();
      });
    }
    function tmpNameSync(options) {
      const args = _parseArguments(options), opts = args[0];
      const sanitizedOptions = _assertAndSanitizeOptionsSync(opts);
      let tries = sanitizedOptions.tries;
      do {
        const name = _generateTmpName(sanitizedOptions);
        try {
          fs.statSync(name);
        } catch (e) {
          return name;
        }
      } while (tries-- > 0);
      throw new Error("Could not get a unique tmp filename, max tries reached");
    }
    function file(options, callback2) {
      const args = _parseArguments(options, callback2), opts = args[0], cb = args[1];
      tmpName(opts, function _tmpNameCreated(err, name) {
        if (err) return cb(err);
        fs.open(name, CREATE_FLAGS, opts.mode || FILE_MODE, function _fileCreated(err2, fd) {
          if (err2) return cb(err2);
          if (opts.discardDescriptor) {
            return fs.close(fd, function _discardCallback(possibleErr) {
              return cb(possibleErr, name, void 0, _prepareTmpFileRemoveCallback(name, -1, opts, false));
            });
          } else {
            const discardOrDetachDescriptor = opts.discardDescriptor || opts.detachDescriptor;
            cb(null, name, fd, _prepareTmpFileRemoveCallback(name, discardOrDetachDescriptor ? -1 : fd, opts, false));
          }
        });
      });
    }
    function fileSync2(options) {
      const args = _parseArguments(options), opts = args[0];
      const discardOrDetachDescriptor = opts.discardDescriptor || opts.detachDescriptor;
      const name = tmpNameSync(opts);
      let fd = fs.openSync(name, CREATE_FLAGS, opts.mode || FILE_MODE);
      if (opts.discardDescriptor) {
        fs.closeSync(fd);
        fd = void 0;
      }
      return {
        name,
        fd,
        removeCallback: _prepareTmpFileRemoveCallback(name, discardOrDetachDescriptor ? -1 : fd, opts, true)
      };
    }
    function dir(options, callback2) {
      const args = _parseArguments(options, callback2), opts = args[0], cb = args[1];
      tmpName(opts, function _tmpNameCreated(err, name) {
        if (err) return cb(err);
        fs.mkdir(name, opts.mode || DIR_MODE, function _dirCreated(err2) {
          if (err2) return cb(err2);
          cb(null, name, _prepareTmpDirRemoveCallback(name, opts, false));
        });
      });
    }
    function dirSync(options) {
      const args = _parseArguments(options), opts = args[0];
      const name = tmpNameSync(opts);
      fs.mkdirSync(name, opts.mode || DIR_MODE);
      return {
        name,
        removeCallback: _prepareTmpDirRemoveCallback(name, opts, true)
      };
    }
    function _removeFileAsync(fdPath, next) {
      const _handler = function(err) {
        if (err && !_isENOENT(err)) {
          return next(err);
        }
        next();
      };
      if (0 <= fdPath[0])
        fs.close(fdPath[0], function() {
          fs.unlink(fdPath[1], _handler);
        });
      else fs.unlink(fdPath[1], _handler);
    }
    function _removeFileSync(fdPath) {
      let rethrownException = null;
      try {
        if (0 <= fdPath[0]) fs.closeSync(fdPath[0]);
      } catch (e) {
        if (!_isEBADF(e) && !_isENOENT(e)) throw e;
      } finally {
        try {
          fs.unlinkSync(fdPath[1]);
        } catch (e) {
          if (!_isENOENT(e)) rethrownException = e;
        }
      }
      if (rethrownException !== null) {
        throw rethrownException;
      }
    }
    function _prepareTmpFileRemoveCallback(name, fd, opts, sync) {
      const removeCallbackSync = _prepareRemoveCallback(_removeFileSync, [fd, name], sync);
      const removeCallback = _prepareRemoveCallback(_removeFileAsync, [fd, name], sync, removeCallbackSync);
      if (!opts.keep) _removeObjects.unshift(removeCallbackSync);
      return sync ? removeCallbackSync : removeCallback;
    }
    function _prepareTmpDirRemoveCallback(name, opts, sync) {
      const removeFunction = opts.unsafeCleanup ? rimraf : fs.rmdir.bind(fs);
      const removeFunctionSync = opts.unsafeCleanup ? FN_RIMRAF_SYNC : FN_RMDIR_SYNC;
      const removeCallbackSync = _prepareRemoveCallback(removeFunctionSync, name, sync);
      const removeCallback = _prepareRemoveCallback(removeFunction, name, sync, removeCallbackSync);
      if (!opts.keep) _removeObjects.unshift(removeCallbackSync);
      return sync ? removeCallbackSync : removeCallback;
    }
    function _prepareRemoveCallback(removeFunction, fileOrDirName, sync, cleanupCallbackSync) {
      let called = false;
      return function _cleanupCallback(next) {
        if (!called) {
          const toRemove = cleanupCallbackSync || _cleanupCallback;
          const index = _removeObjects.indexOf(toRemove);
          if (index >= 0) _removeObjects.splice(index, 1);
          called = true;
          if (sync || removeFunction === FN_RMDIR_SYNC || removeFunction === FN_RIMRAF_SYNC) {
            return removeFunction(fileOrDirName);
          } else {
            return removeFunction(fileOrDirName, next || function() {
            });
          }
        }
      };
    }
    function _garbageCollector() {
      if (!_gracefulCleanup) return;
      while (_removeObjects.length) {
        try {
          _removeObjects[0]();
        } catch (e) {
        }
      }
    }
    function _randomChars(howMany) {
      let value = [], rnd = null;
      try {
        rnd = crypto2.randomBytes(howMany);
      } catch (e) {
        rnd = crypto2.pseudoRandomBytes(howMany);
      }
      for (let i = 0; i < howMany; i++) {
        value.push(RANDOM_CHARS[rnd[i] % RANDOM_CHARS.length]);
      }
      return value.join("");
    }
    function _isUndefined(obj) {
      return typeof obj === "undefined";
    }
    function _parseArguments(options, callback2) {
      if (typeof options === "function") {
        return [{}, options];
      }
      if (_isUndefined(options)) {
        return [{}, callback2];
      }
      const actualOptions = {};
      for (const key of Object.getOwnPropertyNames(options)) {
        actualOptions[key] = options[key];
      }
      return [actualOptions, callback2];
    }
    function _resolvePath(name, tmpDir, cb) {
      const pathToResolve = path30.isAbsolute(name) ? name : path30.join(tmpDir, name);
      fs.stat(pathToResolve, function(err) {
        if (err) {
          fs.realpath(path30.dirname(pathToResolve), function(err2, parentDir) {
            if (err2) return cb(err2);
            cb(null, path30.join(parentDir, path30.basename(pathToResolve)));
          });
        } else {
          fs.realpath(pathToResolve, cb);
        }
      });
    }
    function _resolvePathSync(name, tmpDir) {
      const pathToResolve = path30.isAbsolute(name) ? name : path30.join(tmpDir, name);
      try {
        fs.statSync(pathToResolve);
        return fs.realpathSync(pathToResolve);
      } catch (_err) {
        const parentDir = fs.realpathSync(path30.dirname(pathToResolve));
        return path30.join(parentDir, path30.basename(pathToResolve));
      }
    }
    function _generateTmpName(opts) {
      const tmpDir = opts.tmpdir;
      if (!_isUndefined(opts.name)) {
        return path30.join(tmpDir, opts.dir, opts.name);
      }
      if (!_isUndefined(opts.template)) {
        return path30.join(tmpDir, opts.dir, opts.template).replace(TEMPLATE_PATTERN, _randomChars(6));
      }
      const name = [
        opts.prefix ? opts.prefix : "tmp",
        "-",
        process.pid,
        "-",
        _randomChars(12),
        opts.postfix ? "-" + opts.postfix : ""
      ].join("");
      return path30.join(tmpDir, opts.dir, name);
    }
    function _assertOptionsBase(options) {
      if (!_isUndefined(options.name)) {
        const name = options.name;
        if (path30.isAbsolute(name)) throw new Error(`name option must not contain an absolute path, found "${name}".`);
        const basename12 = path30.basename(name);
        if (basename12 === ".." || basename12 === "." || basename12 !== name)
          throw new Error(`name option must not contain a path, found "${name}".`);
      }
      if (!_isUndefined(options.template) && !options.template.match(TEMPLATE_PATTERN)) {
        throw new Error(`Invalid template, found "${options.template}".`);
      }
      if (!_isUndefined(options.tries) && isNaN(options.tries) || options.tries < 0) {
        throw new Error(`Invalid tries, found "${options.tries}".`);
      }
      options.tries = _isUndefined(options.name) ? options.tries || DEFAULT_TRIES : 1;
      options.keep = !!options.keep;
      options.detachDescriptor = !!options.detachDescriptor;
      options.discardDescriptor = !!options.discardDescriptor;
      options.unsafeCleanup = !!options.unsafeCleanup;
      options.prefix = _isUndefined(options.prefix) ? "" : options.prefix;
      options.postfix = _isUndefined(options.postfix) ? "" : options.postfix;
    }
    function _getRelativePath(option, name, tmpDir, cb) {
      if (_isUndefined(name)) return cb(null);
      _resolvePath(name, tmpDir, function(err, resolvedPath) {
        if (err) return cb(err);
        const relativePath = path30.relative(tmpDir, resolvedPath);
        if (!resolvedPath.startsWith(tmpDir)) {
          return cb(new Error(`${option} option must be relative to "${tmpDir}", found "${relativePath}".`));
        }
        cb(null, relativePath);
      });
    }
    function _getRelativePathSync(option, name, tmpDir) {
      if (_isUndefined(name)) return;
      const resolvedPath = _resolvePathSync(name, tmpDir);
      const relativePath = path30.relative(tmpDir, resolvedPath);
      if (!resolvedPath.startsWith(tmpDir)) {
        throw new Error(`${option} option must be relative to "${tmpDir}", found "${relativePath}".`);
      }
      return relativePath;
    }
    function _assertAndSanitizeOptions(options, cb) {
      _getTmpDir(options, function(err, tmpDir) {
        if (err) return cb(err);
        options.tmpdir = tmpDir;
        try {
          _assertOptionsBase(options, tmpDir);
        } catch (err2) {
          return cb(err2);
        }
        _getRelativePath("dir", options.dir, tmpDir, function(err2, dir2) {
          if (err2) return cb(err2);
          options.dir = _isUndefined(dir2) ? "" : dir2;
          _getRelativePath("template", options.template, tmpDir, function(err3, template) {
            if (err3) return cb(err3);
            options.template = template;
            cb(null, options);
          });
        });
      });
    }
    function _assertAndSanitizeOptionsSync(options) {
      const tmpDir = options.tmpdir = _getTmpDirSync(options);
      _assertOptionsBase(options, tmpDir);
      const dir2 = _getRelativePathSync("dir", options.dir, tmpDir);
      options.dir = _isUndefined(dir2) ? "" : dir2;
      options.template = _getRelativePathSync("template", options.template, tmpDir);
      return options;
    }
    function _isEBADF(error) {
      return _isExpectedError(error, -EBADF, "EBADF");
    }
    function _isENOENT(error) {
      return _isExpectedError(error, -ENOENT, "ENOENT");
    }
    function _isExpectedError(error, errno, code) {
      return IS_WIN32 ? error.code === code : error.code === code && error.errno === errno;
    }
    function setGracefulCleanup2() {
      _gracefulCleanup = true;
    }
    function _getTmpDir(options, cb) {
      return fs.realpath(options && options.tmpdir || os2.tmpdir(), cb);
    }
    function _getTmpDirSync(options) {
      return fs.realpathSync(options && options.tmpdir || os2.tmpdir());
    }
    process.addListener(EXIT, _garbageCollector);
    Object.defineProperty(module2.exports, "tmpdir", {
      enumerable: true,
      configurable: false,
      get: function() {
        return _getTmpDirSync();
      }
    });
    module2.exports.dir = dir;
    module2.exports.dirSync = dirSync;
    module2.exports.file = file;
    module2.exports.fileSync = fileSync2;
    module2.exports.tmpName = tmpName;
    module2.exports.tmpNameSync = tmpNameSync;
    module2.exports.setGracefulCleanup = setGracefulCleanup2;
  }
});

// node_modules/semver/internal/constants.js
var require_constants = __commonJS({
  "node_modules/semver/internal/constants.js"(exports2, module2) {
    "use strict";
    var SEMVER_SPEC_VERSION = "2.0.0";
    var MAX_LENGTH = 256;
    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
    9007199254740991;
    var MAX_SAFE_COMPONENT_LENGTH = 16;
    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
    var RELEASE_TYPES = [
      "major",
      "premajor",
      "minor",
      "preminor",
      "patch",
      "prepatch",
      "prerelease"
    ];
    module2.exports = {
      MAX_LENGTH,
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_SAFE_INTEGER,
      RELEASE_TYPES,
      SEMVER_SPEC_VERSION,
      FLAG_INCLUDE_PRERELEASE: 1,
      FLAG_LOOSE: 2
    };
  }
});

// node_modules/semver/internal/debug.js
var require_debug = __commonJS({
  "node_modules/semver/internal/debug.js"(exports2, module2) {
    "use strict";
    var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module2.exports = debug;
  }
});

// node_modules/semver/internal/re.js
var require_re = __commonJS({
  "node_modules/semver/internal/re.js"(exports2, module2) {
    "use strict";
    var {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = require_constants();
    var debug = require_debug();
    exports2 = module2.exports = {};
    var re = exports2.re = [];
    var safeRe = exports2.safeRe = [];
    var src = exports2.src = [];
    var safeSrc = exports2.safeSrc = [];
    var t = exports2.t = {};
    var R = 0;
    var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    var safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    var makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    var createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index = R++;
      debug(name, index, value);
      t[name] = index;
      src[index] = value;
      safeSrc[index] = safe;
      re[index] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
    createToken("FULL", `^${src[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
    createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src[t.COERCE], true);
    createToken("COERCERTLFULL", src[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
    exports2.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports2.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports2.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  }
});

// node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS({
  "node_modules/semver/internal/parse-options.js"(exports2, module2) {
    "use strict";
    var looseOption = Object.freeze({ loose: true });
    var emptyOpts = Object.freeze({});
    var parseOptions = (options) => {
      if (!options) {
        return emptyOpts;
      }
      if (typeof options !== "object") {
        return looseOption;
      }
      return options;
    };
    module2.exports = parseOptions;
  }
});

// node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS({
  "node_modules/semver/internal/identifiers.js"(exports2, module2) {
    "use strict";
    var numeric2 = /^[0-9]+$/;
    var compareIdentifiers = (a, b) => {
      if (typeof a === "number" && typeof b === "number") {
        return a === b ? 0 : a < b ? -1 : 1;
      }
      const anum = numeric2.test(a);
      const bnum = numeric2.test(b);
      if (anum && bnum) {
        a = +a;
        b = +b;
      }
      return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
    };
    var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
    module2.exports = {
      compareIdentifiers,
      rcompareIdentifiers
    };
  }
});

// node_modules/semver/classes/semver.js
var require_semver = __commonJS({
  "node_modules/semver/classes/semver.js"(exports2, module2) {
    "use strict";
    var debug = require_debug();
    var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
    var { safeRe: re, t } = require_re();
    var parseOptions = require_parse_options();
    var { compareIdentifiers } = require_identifiers();
    var SemVer = class _SemVer {
      constructor(version, options) {
        options = parseOptions(options);
        if (version instanceof _SemVer) {
          if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
            return version;
          } else {
            version = version.version;
          }
        } else if (typeof version !== "string") {
          throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
        }
        if (version.length > MAX_LENGTH) {
          throw new TypeError(
            `version is longer than ${MAX_LENGTH} characters`
          );
        }
        debug("SemVer", version, options);
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
        if (!m) {
          throw new TypeError(`Invalid Version: ${version}`);
        }
        this.raw = version;
        this.major = +m[1];
        this.minor = +m[2];
        this.patch = +m[3];
        if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
          throw new TypeError("Invalid major version");
        }
        if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
          throw new TypeError("Invalid minor version");
        }
        if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
          throw new TypeError("Invalid patch version");
        }
        if (!m[4]) {
          this.prerelease = [];
        } else {
          this.prerelease = m[4].split(".").map((id) => {
            if (/^[0-9]+$/.test(id)) {
              const num = +id;
              if (num >= 0 && num < MAX_SAFE_INTEGER) {
                return num;
              }
            }
            return id;
          });
        }
        this.build = m[5] ? m[5].split(".") : [];
        this.format();
      }
      format() {
        this.version = `${this.major}.${this.minor}.${this.patch}`;
        if (this.prerelease.length) {
          this.version += `-${this.prerelease.join(".")}`;
        }
        return this.version;
      }
      toString() {
        return this.version;
      }
      compare(other) {
        debug("SemVer.compare", this.version, this.options, other);
        if (!(other instanceof _SemVer)) {
          if (typeof other === "string" && other === this.version) {
            return 0;
          }
          other = new _SemVer(other, this.options);
        }
        if (other.version === this.version) {
          return 0;
        }
        return this.compareMain(other) || this.comparePre(other);
      }
      compareMain(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.major < other.major) {
          return -1;
        }
        if (this.major > other.major) {
          return 1;
        }
        if (this.minor < other.minor) {
          return -1;
        }
        if (this.minor > other.minor) {
          return 1;
        }
        if (this.patch < other.patch) {
          return -1;
        }
        if (this.patch > other.patch) {
          return 1;
        }
        return 0;
      }
      comparePre(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.prerelease.length && !other.prerelease.length) {
          return -1;
        } else if (!this.prerelease.length && other.prerelease.length) {
          return 1;
        } else if (!this.prerelease.length && !other.prerelease.length) {
          return 0;
        }
        let i = 0;
        do {
          const a = this.prerelease[i];
          const b = other.prerelease[i];
          debug("prerelease compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      compareBuild(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        let i = 0;
        do {
          const a = this.build[i];
          const b = other.build[i];
          debug("build compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      // preminor will bump the version up to the next minor release, and immediately
      // down to pre-release. premajor and prepatch work the same way.
      inc(release, identifier, identifierBase) {
        if (release.startsWith("pre")) {
          if (!identifier && identifierBase === false) {
            throw new Error("invalid increment argument: identifier is empty");
          }
          if (identifier) {
            const match3 = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
            if (!match3 || match3[1] !== identifier) {
              throw new Error(`invalid identifier: ${identifier}`);
            }
          }
        }
        switch (release) {
          case "premajor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor = 0;
            this.major++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "preminor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "prepatch":
            this.prerelease.length = 0;
            this.inc("patch", identifier, identifierBase);
            this.inc("pre", identifier, identifierBase);
            break;
          // If the input is a non-prerelease version, this acts the same as
          // prepatch.
          case "prerelease":
            if (this.prerelease.length === 0) {
              this.inc("patch", identifier, identifierBase);
            }
            this.inc("pre", identifier, identifierBase);
            break;
          case "release":
            if (this.prerelease.length === 0) {
              throw new Error(`version ${this.raw} is not a prerelease`);
            }
            this.prerelease.length = 0;
            break;
          case "major":
            if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
              this.major++;
            }
            this.minor = 0;
            this.patch = 0;
            this.prerelease = [];
            break;
          case "minor":
            if (this.patch !== 0 || this.prerelease.length === 0) {
              this.minor++;
            }
            this.patch = 0;
            this.prerelease = [];
            break;
          case "patch":
            if (this.prerelease.length === 0) {
              this.patch++;
            }
            this.prerelease = [];
            break;
          // This probably shouldn't be used publicly.
          // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
          case "pre": {
            const base = Number(identifierBase) ? 1 : 0;
            if (this.prerelease.length === 0) {
              this.prerelease = [base];
            } else {
              let i = this.prerelease.length;
              while (--i >= 0) {
                if (typeof this.prerelease[i] === "number") {
                  this.prerelease[i]++;
                  i = -2;
                }
              }
              if (i === -1) {
                if (identifier === this.prerelease.join(".") && identifierBase === false) {
                  throw new Error("invalid increment argument: identifier already exists");
                }
                this.prerelease.push(base);
              }
            }
            if (identifier) {
              let prerelease = [identifier, base];
              if (identifierBase === false) {
                prerelease = [identifier];
              }
              if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
                if (isNaN(this.prerelease[1])) {
                  this.prerelease = prerelease;
                }
              } else {
                this.prerelease = prerelease;
              }
            }
            break;
          }
          default:
            throw new Error(`invalid increment argument: ${release}`);
        }
        this.raw = this.format();
        if (this.build.length) {
          this.raw += `+${this.build.join(".")}`;
        }
        return this;
      }
    };
    module2.exports = SemVer;
  }
});

// node_modules/semver/functions/parse.js
var require_parse = __commonJS({
  "node_modules/semver/functions/parse.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var parse = (version, options, throwErrors = false) => {
      if (version instanceof SemVer) {
        return version;
      }
      try {
        return new SemVer(version, options);
      } catch (er) {
        if (!throwErrors) {
          return null;
        }
        throw er;
      }
    };
    module2.exports = parse;
  }
});

// node_modules/semver/functions/valid.js
var require_valid = __commonJS({
  "node_modules/semver/functions/valid.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var valid2 = (version, options) => {
      const v = parse(version, options);
      return v ? v.version : null;
    };
    module2.exports = valid2;
  }
});

// node_modules/semver/functions/clean.js
var require_clean = __commonJS({
  "node_modules/semver/functions/clean.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var clean = (version, options) => {
      const s = parse(version.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    };
    module2.exports = clean;
  }
});

// node_modules/semver/functions/inc.js
var require_inc = __commonJS({
  "node_modules/semver/functions/inc.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var inc = (version, release, options, identifier, identifierBase) => {
      if (typeof options === "string") {
        identifierBase = identifier;
        identifier = options;
        options = void 0;
      }
      try {
        return new SemVer(
          version instanceof SemVer ? version.version : version,
          options
        ).inc(release, identifier, identifierBase).version;
      } catch (er) {
        return null;
      }
    };
    module2.exports = inc;
  }
});

// node_modules/semver/functions/diff.js
var require_diff = __commonJS({
  "node_modules/semver/functions/diff.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var diff = (version1, version2) => {
      const v1 = parse(version1, null, true);
      const v2 = parse(version2, null, true);
      const comparison = v1.compare(v2);
      if (comparison === 0) {
        return null;
      }
      const v1Higher = comparison > 0;
      const highVersion = v1Higher ? v1 : v2;
      const lowVersion = v1Higher ? v2 : v1;
      const highHasPre = !!highVersion.prerelease.length;
      const lowHasPre = !!lowVersion.prerelease.length;
      if (lowHasPre && !highHasPre) {
        if (!lowVersion.patch && !lowVersion.minor) {
          return "major";
        }
        if (lowVersion.compareMain(highVersion) === 0) {
          if (lowVersion.minor && !lowVersion.patch) {
            return "minor";
          }
          return "patch";
        }
      }
      const prefix = highHasPre ? "pre" : "";
      if (v1.major !== v2.major) {
        return prefix + "major";
      }
      if (v1.minor !== v2.minor) {
        return prefix + "minor";
      }
      if (v1.patch !== v2.patch) {
        return prefix + "patch";
      }
      return "prerelease";
    };
    module2.exports = diff;
  }
});

// node_modules/semver/functions/major.js
var require_major = __commonJS({
  "node_modules/semver/functions/major.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var major = (a, loose) => new SemVer(a, loose).major;
    module2.exports = major;
  }
});

// node_modules/semver/functions/minor.js
var require_minor = __commonJS({
  "node_modules/semver/functions/minor.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var minor = (a, loose) => new SemVer(a, loose).minor;
    module2.exports = minor;
  }
});

// node_modules/semver/functions/patch.js
var require_patch = __commonJS({
  "node_modules/semver/functions/patch.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var patch = (a, loose) => new SemVer(a, loose).patch;
    module2.exports = patch;
  }
});

// node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS({
  "node_modules/semver/functions/prerelease.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var prerelease = (version, options) => {
      const parsed = parse(version, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    };
    module2.exports = prerelease;
  }
});

// node_modules/semver/functions/compare.js
var require_compare = __commonJS({
  "node_modules/semver/functions/compare.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
    module2.exports = compare;
  }
});

// node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS({
  "node_modules/semver/functions/rcompare.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var rcompare = (a, b, loose) => compare(b, a, loose);
    module2.exports = rcompare;
  }
});

// node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS({
  "node_modules/semver/functions/compare-loose.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var compareLoose = (a, b) => compare(a, b, true);
    module2.exports = compareLoose;
  }
});

// node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS({
  "node_modules/semver/functions/compare-build.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var compareBuild = (a, b, loose) => {
      const versionA = new SemVer(a, loose);
      const versionB = new SemVer(b, loose);
      return versionA.compare(versionB) || versionA.compareBuild(versionB);
    };
    module2.exports = compareBuild;
  }
});

// node_modules/semver/functions/sort.js
var require_sort = __commonJS({
  "node_modules/semver/functions/sort.js"(exports2, module2) {
    "use strict";
    var compareBuild = require_compare_build();
    var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
    module2.exports = sort;
  }
});

// node_modules/semver/functions/rsort.js
var require_rsort = __commonJS({
  "node_modules/semver/functions/rsort.js"(exports2, module2) {
    "use strict";
    var compareBuild = require_compare_build();
    var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
    module2.exports = rsort;
  }
});

// node_modules/semver/functions/gt.js
var require_gt = __commonJS({
  "node_modules/semver/functions/gt.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var gt = (a, b, loose) => compare(a, b, loose) > 0;
    module2.exports = gt;
  }
});

// node_modules/semver/functions/lt.js
var require_lt = __commonJS({
  "node_modules/semver/functions/lt.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var lt = (a, b, loose) => compare(a, b, loose) < 0;
    module2.exports = lt;
  }
});

// node_modules/semver/functions/eq.js
var require_eq = __commonJS({
  "node_modules/semver/functions/eq.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var eq = (a, b, loose) => compare(a, b, loose) === 0;
    module2.exports = eq;
  }
});

// node_modules/semver/functions/neq.js
var require_neq = __commonJS({
  "node_modules/semver/functions/neq.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var neq = (a, b, loose) => compare(a, b, loose) !== 0;
    module2.exports = neq;
  }
});

// node_modules/semver/functions/gte.js
var require_gte = __commonJS({
  "node_modules/semver/functions/gte.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var gte3 = (a, b, loose) => compare(a, b, loose) >= 0;
    module2.exports = gte3;
  }
});

// node_modules/semver/functions/lte.js
var require_lte = __commonJS({
  "node_modules/semver/functions/lte.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var lte2 = (a, b, loose) => compare(a, b, loose) <= 0;
    module2.exports = lte2;
  }
});

// node_modules/semver/functions/cmp.js
var require_cmp = __commonJS({
  "node_modules/semver/functions/cmp.js"(exports2, module2) {
    "use strict";
    var eq = require_eq();
    var neq = require_neq();
    var gt = require_gt();
    var gte3 = require_gte();
    var lt = require_lt();
    var lte2 = require_lte();
    var cmp = (a, op, b, loose) => {
      switch (op) {
        case "===":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a === b;
        case "!==":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a !== b;
        case "":
        case "=":
        case "==":
          return eq(a, b, loose);
        case "!=":
          return neq(a, b, loose);
        case ">":
          return gt(a, b, loose);
        case ">=":
          return gte3(a, b, loose);
        case "<":
          return lt(a, b, loose);
        case "<=":
          return lte2(a, b, loose);
        default:
          throw new TypeError(`Invalid operator: ${op}`);
      }
    };
    module2.exports = cmp;
  }
});

// node_modules/semver/functions/coerce.js
var require_coerce = __commonJS({
  "node_modules/semver/functions/coerce.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var parse = require_parse();
    var { safeRe: re, t } = require_re();
    var coerce = (version, options) => {
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version === "number") {
        version = String(version);
      }
      if (typeof version !== "string") {
        return null;
      }
      options = options || {};
      let match3 = null;
      if (!options.rtl) {
        match3 = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
      } else {
        const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
        let next;
        while ((next = coerceRtlRegex.exec(version)) && (!match3 || match3.index + match3[0].length !== version.length)) {
          if (!match3 || next.index + next[0].length !== match3.index + match3[0].length) {
            match3 = next;
          }
          coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
        }
        coerceRtlRegex.lastIndex = -1;
      }
      if (match3 === null) {
        return null;
      }
      const major = match3[2];
      const minor = match3[3] || "0";
      const patch = match3[4] || "0";
      const prerelease = options.includePrerelease && match3[5] ? `-${match3[5]}` : "";
      const build = options.includePrerelease && match3[6] ? `+${match3[6]}` : "";
      return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
    };
    module2.exports = coerce;
  }
});

// node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS({
  "node_modules/semver/internal/lrucache.js"(exports2, module2) {
    "use strict";
    var LRUCache = class {
      constructor() {
        this.max = 1e3;
        this.map = /* @__PURE__ */ new Map();
      }
      get(key) {
        const value = this.map.get(key);
        if (value === void 0) {
          return void 0;
        } else {
          this.map.delete(key);
          this.map.set(key, value);
          return value;
        }
      }
      delete(key) {
        return this.map.delete(key);
      }
      set(key, value) {
        const deleted = this.delete(key);
        if (!deleted && value !== void 0) {
          if (this.map.size >= this.max) {
            const firstKey = this.map.keys().next().value;
            this.delete(firstKey);
          }
          this.map.set(key, value);
        }
        return this;
      }
    };
    module2.exports = LRUCache;
  }
});

// node_modules/semver/classes/range.js
var require_range = __commonJS({
  "node_modules/semver/classes/range.js"(exports2, module2) {
    "use strict";
    var SPACE_CHARACTERS = /\s+/g;
    var Range3 = class _Range {
      constructor(range2, options) {
        options = parseOptions(options);
        if (range2 instanceof _Range) {
          if (range2.loose === !!options.loose && range2.includePrerelease === !!options.includePrerelease) {
            return range2;
          } else {
            return new _Range(range2.raw, options);
          }
        }
        if (range2 instanceof Comparator) {
          this.raw = range2.value;
          this.set = [[range2]];
          this.formatted = void 0;
          return this;
        }
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        this.raw = range2.trim().replace(SPACE_CHARACTERS, " ");
        this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
        if (!this.set.length) {
          throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
        }
        if (this.set.length > 1) {
          const first = this.set[0];
          this.set = this.set.filter((c) => !isNullSet(c[0]));
          if (this.set.length === 0) {
            this.set = [first];
          } else if (this.set.length > 1) {
            for (const c of this.set) {
              if (c.length === 1 && isAny(c[0])) {
                this.set = [c];
                break;
              }
            }
          }
        }
        this.formatted = void 0;
      }
      get range() {
        if (this.formatted === void 0) {
          this.formatted = "";
          for (let i = 0; i < this.set.length; i++) {
            if (i > 0) {
              this.formatted += "||";
            }
            const comps = this.set[i];
            for (let k = 0; k < comps.length; k++) {
              if (k > 0) {
                this.formatted += " ";
              }
              this.formatted += comps[k].toString().trim();
            }
          }
        }
        return this.formatted;
      }
      format() {
        return this.range;
      }
      toString() {
        return this.range;
      }
      parseRange(range2) {
        const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
        const memoKey = memoOpts + ":" + range2;
        const cached = cache.get(memoKey);
        if (cached) {
          return cached;
        }
        const loose = this.options.loose;
        const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
        range2 = range2.replace(hr, hyphenReplace(this.options.includePrerelease));
        debug("hyphen replace", range2);
        range2 = range2.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        debug("comparator trim", range2);
        range2 = range2.replace(re[t.TILDETRIM], tildeTrimReplace);
        debug("tilde trim", range2);
        range2 = range2.replace(re[t.CARETTRIM], caretTrimReplace);
        debug("caret trim", range2);
        let rangeList = range2.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
        if (loose) {
          rangeList = rangeList.filter((comp) => {
            debug("loose invalid filter", comp, this.options);
            return !!comp.match(re[t.COMPARATORLOOSE]);
          });
        }
        debug("range list", rangeList);
        const rangeMap = /* @__PURE__ */ new Map();
        const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
        for (const comp of comparators) {
          if (isNullSet(comp)) {
            return [comp];
          }
          rangeMap.set(comp.value, comp);
        }
        if (rangeMap.size > 1 && rangeMap.has("")) {
          rangeMap.delete("");
        }
        const result = [...rangeMap.values()];
        cache.set(memoKey, result);
        return result;
      }
      intersects(range2, options) {
        if (!(range2 instanceof _Range)) {
          throw new TypeError("a Range is required");
        }
        return this.set.some((thisComparators) => {
          return isSatisfiable(thisComparators, options) && range2.set.some((rangeComparators) => {
            return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
              return rangeComparators.every((rangeComparator) => {
                return thisComparator.intersects(rangeComparator, options);
              });
            });
          });
        });
      }
      // if ANY of the sets match ALL of its comparators, then pass
      test(version) {
        if (!version) {
          return false;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        for (let i = 0; i < this.set.length; i++) {
          if (testSet(this.set[i], version, this.options)) {
            return true;
          }
        }
        return false;
      }
    };
    module2.exports = Range3;
    var LRU = require_lrucache();
    var cache = new LRU();
    var parseOptions = require_parse_options();
    var Comparator = require_comparator();
    var debug = require_debug();
    var SemVer = require_semver();
    var {
      safeRe: re,
      t,
      comparatorTrimReplace,
      tildeTrimReplace,
      caretTrimReplace
    } = require_re();
    var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
    var isNullSet = (c) => c.value === "<0.0.0-0";
    var isAny = (c) => c.value === "";
    var isSatisfiable = (comparators, options) => {
      let result = true;
      const remainingComparators = comparators.slice();
      let testComparator = remainingComparators.pop();
      while (result && remainingComparators.length) {
        result = remainingComparators.every((otherComparator) => {
          return testComparator.intersects(otherComparator, options);
        });
        testComparator = remainingComparators.pop();
      }
      return result;
    };
    var parseComparator = (comp, options) => {
      comp = comp.replace(re[t.BUILD], "");
      debug("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug("caret", comp);
      comp = replaceTildes(comp, options);
      debug("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug("xrange", comp);
      comp = replaceStars(comp, options);
      debug("stars", comp);
      return comp;
    };
    var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
    var replaceTildes = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
    };
    var replaceTilde = (comp, options) => {
      const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("tilde", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
        } else if (pr) {
          debug("replaceTilde pr", pr);
          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        debug("tilde return", ret);
        return ret;
      });
    };
    var replaceCarets = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
    };
    var replaceCaret = (comp, options) => {
      debug("caret", comp, options);
      const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("caret", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          if (M === "0") {
            ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
          } else {
            ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
          }
        } else if (pr) {
          debug("replaceCaret pr", pr);
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
          }
        } else {
          debug("no pr");
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
          }
        }
        debug("caret return", ret);
        return ret;
      });
    };
    var replaceXRanges = (comp, options) => {
      debug("replaceXRanges", comp, options);
      return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
    };
    var replaceXRange = (comp, options) => {
      comp = comp.trim();
      const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
      return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        debug("xRange", comp, ret, gtlt, M, m, p, pr);
        const xM = isX(M);
        const xm = xM || isX(m);
        const xp = xm || isX(p);
        const anyX = xp;
        if (gtlt === "=" && anyX) {
          gtlt = "";
        }
        pr = options.includePrerelease ? "-0" : "";
        if (xM) {
          if (gtlt === ">" || gtlt === "<") {
            ret = "<0.0.0-0";
          } else {
            ret = "*";
          }
        } else if (gtlt && anyX) {
          if (xm) {
            m = 0;
          }
          p = 0;
          if (gtlt === ">") {
            gtlt = ">=";
            if (xm) {
              M = +M + 1;
              m = 0;
              p = 0;
            } else {
              m = +m + 1;
              p = 0;
            }
          } else if (gtlt === "<=") {
            gtlt = "<";
            if (xm) {
              M = +M + 1;
            } else {
              m = +m + 1;
            }
          }
          if (gtlt === "<") {
            pr = "-0";
          }
          ret = `${gtlt + M}.${m}.${p}${pr}`;
        } else if (xm) {
          ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
        } else if (xp) {
          ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
        }
        debug("xRange return", ret);
        return ret;
      });
    };
    var replaceStars = (comp, options) => {
      debug("replaceStars", comp, options);
      return comp.trim().replace(re[t.STAR], "");
    };
    var replaceGTE0 = (comp, options) => {
      debug("replaceGTE0", comp, options);
      return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
    };
    var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
      if (isX(fM)) {
        from = "";
      } else if (isX(fm)) {
        from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
      } else if (isX(fp)) {
        from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
      } else if (fpr) {
        from = `>=${from}`;
      } else {
        from = `>=${from}${incPr ? "-0" : ""}`;
      }
      if (isX(tM)) {
        to = "";
      } else if (isX(tm)) {
        to = `<${+tM + 1}.0.0-0`;
      } else if (isX(tp)) {
        to = `<${tM}.${+tm + 1}.0-0`;
      } else if (tpr) {
        to = `<=${tM}.${tm}.${tp}-${tpr}`;
      } else if (incPr) {
        to = `<${tM}.${tm}.${+tp + 1}-0`;
      } else {
        to = `<=${to}`;
      }
      return `${from} ${to}`.trim();
    };
    var testSet = (set, version, options) => {
      for (let i = 0; i < set.length; i++) {
        if (!set[i].test(version)) {
          return false;
        }
      }
      if (version.prerelease.length && !options.includePrerelease) {
        for (let i = 0; i < set.length; i++) {
          debug(set[i].semver);
          if (set[i].semver === Comparator.ANY) {
            continue;
          }
          if (set[i].semver.prerelease.length > 0) {
            const allowed = set[i].semver;
            if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    };
  }
});

// node_modules/semver/classes/comparator.js
var require_comparator = __commonJS({
  "node_modules/semver/classes/comparator.js"(exports2, module2) {
    "use strict";
    var ANY = Symbol("SemVer ANY");
    var Comparator = class _Comparator {
      static get ANY() {
        return ANY;
      }
      constructor(comp, options) {
        options = parseOptions(options);
        if (comp instanceof _Comparator) {
          if (comp.loose === !!options.loose) {
            return comp;
          } else {
            comp = comp.value;
          }
        }
        comp = comp.trim().split(/\s+/).join(" ");
        debug("comparator", comp, options);
        this.options = options;
        this.loose = !!options.loose;
        this.parse(comp);
        if (this.semver === ANY) {
          this.value = "";
        } else {
          this.value = this.operator + this.semver.version;
        }
        debug("comp", this);
      }
      parse(comp) {
        const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
        const m = comp.match(r);
        if (!m) {
          throw new TypeError(`Invalid comparator: ${comp}`);
        }
        this.operator = m[1] !== void 0 ? m[1] : "";
        if (this.operator === "=") {
          this.operator = "";
        }
        if (!m[2]) {
          this.semver = ANY;
        } else {
          this.semver = new SemVer(m[2], this.options.loose);
        }
      }
      toString() {
        return this.value;
      }
      test(version) {
        debug("Comparator.test", version, this.options.loose);
        if (this.semver === ANY || version === ANY) {
          return true;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        return cmp(version, this.operator, this.semver, this.options);
      }
      intersects(comp, options) {
        if (!(comp instanceof _Comparator)) {
          throw new TypeError("a Comparator is required");
        }
        if (this.operator === "") {
          if (this.value === "") {
            return true;
          }
          return new Range3(comp.value, options).test(this.value);
        } else if (comp.operator === "") {
          if (comp.value === "") {
            return true;
          }
          return new Range3(this.value, options).test(comp.semver);
        }
        options = parseOptions(options);
        if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
          return false;
        }
        if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
          return false;
        }
        if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
          return true;
        }
        if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
          return true;
        }
        if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
          return true;
        }
        if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
          return true;
        }
        if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
          return true;
        }
        return false;
      }
    };
    module2.exports = Comparator;
    var parseOptions = require_parse_options();
    var { safeRe: re, t } = require_re();
    var cmp = require_cmp();
    var debug = require_debug();
    var SemVer = require_semver();
    var Range3 = require_range();
  }
});

// node_modules/semver/functions/satisfies.js
var require_satisfies = __commonJS({
  "node_modules/semver/functions/satisfies.js"(exports2, module2) {
    "use strict";
    var Range3 = require_range();
    var satisfies4 = (version, range2, options) => {
      try {
        range2 = new Range3(range2, options);
      } catch (er) {
        return false;
      }
      return range2.test(version);
    };
    module2.exports = satisfies4;
  }
});

// node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS({
  "node_modules/semver/ranges/to-comparators.js"(exports2, module2) {
    "use strict";
    var Range3 = require_range();
    var toComparators = (range2, options) => new Range3(range2, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
    module2.exports = toComparators;
  }
});

// node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS({
  "node_modules/semver/ranges/max-satisfying.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range3 = require_range();
    var maxSatisfying = (versions, range2, options) => {
      let max = null;
      let maxSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range3(range2, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!max || maxSV.compare(v) === -1) {
            max = v;
            maxSV = new SemVer(max, options);
          }
        }
      });
      return max;
    };
    module2.exports = maxSatisfying;
  }
});

// node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS({
  "node_modules/semver/ranges/min-satisfying.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range3 = require_range();
    var minSatisfying = (versions, range2, options) => {
      let min = null;
      let minSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range3(range2, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!min || minSV.compare(v) === 1) {
            min = v;
            minSV = new SemVer(min, options);
          }
        }
      });
      return min;
    };
    module2.exports = minSatisfying;
  }
});

// node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS({
  "node_modules/semver/ranges/min-version.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range3 = require_range();
    var gt = require_gt();
    var minVersion = (range2, loose) => {
      range2 = new Range3(range2, loose);
      let minver = new SemVer("0.0.0");
      if (range2.test(minver)) {
        return minver;
      }
      minver = new SemVer("0.0.0-0");
      if (range2.test(minver)) {
        return minver;
      }
      minver = null;
      for (let i = 0; i < range2.set.length; ++i) {
        const comparators = range2.set[i];
        let setMin = null;
        comparators.forEach((comparator) => {
          const compver = new SemVer(comparator.semver.version);
          switch (comparator.operator) {
            case ">":
              if (compver.prerelease.length === 0) {
                compver.patch++;
              } else {
                compver.prerelease.push(0);
              }
              compver.raw = compver.format();
            /* fallthrough */
            case "":
            case ">=":
              if (!setMin || gt(compver, setMin)) {
                setMin = compver;
              }
              break;
            case "<":
            case "<=":
              break;
            /* istanbul ignore next */
            default:
              throw new Error(`Unexpected operation: ${comparator.operator}`);
          }
        });
        if (setMin && (!minver || gt(minver, setMin))) {
          minver = setMin;
        }
      }
      if (minver && range2.test(minver)) {
        return minver;
      }
      return null;
    };
    module2.exports = minVersion;
  }
});

// node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS({
  "node_modules/semver/ranges/valid.js"(exports2, module2) {
    "use strict";
    var Range3 = require_range();
    var validRange = (range2, options) => {
      try {
        return new Range3(range2, options).range || "*";
      } catch (er) {
        return null;
      }
    };
    module2.exports = validRange;
  }
});

// node_modules/semver/ranges/outside.js
var require_outside = __commonJS({
  "node_modules/semver/ranges/outside.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var Range3 = require_range();
    var satisfies4 = require_satisfies();
    var gt = require_gt();
    var lt = require_lt();
    var lte2 = require_lte();
    var gte3 = require_gte();
    var outside = (version, range2, hilo, options) => {
      version = new SemVer(version, options);
      range2 = new Range3(range2, options);
      let gtfn, ltefn, ltfn, comp, ecomp;
      switch (hilo) {
        case ">":
          gtfn = gt;
          ltefn = lte2;
          ltfn = lt;
          comp = ">";
          ecomp = ">=";
          break;
        case "<":
          gtfn = lt;
          ltefn = gte3;
          ltfn = gt;
          comp = "<";
          ecomp = "<=";
          break;
        default:
          throw new TypeError('Must provide a hilo val of "<" or ">"');
      }
      if (satisfies4(version, range2, options)) {
        return false;
      }
      for (let i = 0; i < range2.set.length; ++i) {
        const comparators = range2.set[i];
        let high = null;
        let low = null;
        comparators.forEach((comparator) => {
          if (comparator.semver === ANY) {
            comparator = new Comparator(">=0.0.0");
          }
          high = high || comparator;
          low = low || comparator;
          if (gtfn(comparator.semver, high.semver, options)) {
            high = comparator;
          } else if (ltfn(comparator.semver, low.semver, options)) {
            low = comparator;
          }
        });
        if (high.operator === comp || high.operator === ecomp) {
          return false;
        }
        if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version, low.semver)) {
          return false;
        }
      }
      return true;
    };
    module2.exports = outside;
  }
});

// node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS({
  "node_modules/semver/ranges/gtr.js"(exports2, module2) {
    "use strict";
    var outside = require_outside();
    var gtr = (version, range2, options) => outside(version, range2, ">", options);
    module2.exports = gtr;
  }
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS({
  "node_modules/semver/ranges/ltr.js"(exports2, module2) {
    "use strict";
    var outside = require_outside();
    var ltr = (version, range2, options) => outside(version, range2, "<", options);
    module2.exports = ltr;
  }
});

// node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS({
  "node_modules/semver/ranges/intersects.js"(exports2, module2) {
    "use strict";
    var Range3 = require_range();
    var intersects = (r1, r2, options) => {
      r1 = new Range3(r1, options);
      r2 = new Range3(r2, options);
      return r1.intersects(r2, options);
    };
    module2.exports = intersects;
  }
});

// node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS({
  "node_modules/semver/ranges/simplify.js"(exports2, module2) {
    "use strict";
    var satisfies4 = require_satisfies();
    var compare = require_compare();
    module2.exports = (versions, range2, options) => {
      const set = [];
      let first = null;
      let prev = null;
      const v = versions.sort((a, b) => compare(a, b, options));
      for (const version of v) {
        const included = satisfies4(version, range2, options);
        if (included) {
          prev = version;
          if (!first) {
            first = version;
          }
        } else {
          if (prev) {
            set.push([first, prev]);
          }
          prev = null;
          first = null;
        }
      }
      if (first) {
        set.push([first, null]);
      }
      const ranges = [];
      for (const [min, max] of set) {
        if (min === max) {
          ranges.push(min);
        } else if (!max && min === v[0]) {
          ranges.push("*");
        } else if (!max) {
          ranges.push(`>=${min}`);
        } else if (min === v[0]) {
          ranges.push(`<=${max}`);
        } else {
          ranges.push(`${min} - ${max}`);
        }
      }
      const simplified = ranges.join(" || ");
      const original = typeof range2.raw === "string" ? range2.raw : String(range2);
      return simplified.length < original.length ? simplified : range2;
    };
  }
});

// node_modules/semver/ranges/subset.js
var require_subset = __commonJS({
  "node_modules/semver/ranges/subset.js"(exports2, module2) {
    "use strict";
    var Range3 = require_range();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var satisfies4 = require_satisfies();
    var compare = require_compare();
    var subset = (sub, dom, options = {}) => {
      if (sub === dom) {
        return true;
      }
      sub = new Range3(sub, options);
      dom = new Range3(dom, options);
      let sawNonNull = false;
      OUTER: for (const simpleSub of sub.set) {
        for (const simpleDom of dom.set) {
          const isSub = simpleSubset(simpleSub, simpleDom, options);
          sawNonNull = sawNonNull || isSub !== null;
          if (isSub) {
            continue OUTER;
          }
        }
        if (sawNonNull) {
          return false;
        }
      }
      return true;
    };
    var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
    var minimumVersion = [new Comparator(">=0.0.0")];
    var simpleSubset = (sub, dom, options) => {
      if (sub === dom) {
        return true;
      }
      if (sub.length === 1 && sub[0].semver === ANY) {
        if (dom.length === 1 && dom[0].semver === ANY) {
          return true;
        } else if (options.includePrerelease) {
          sub = minimumVersionWithPreRelease;
        } else {
          sub = minimumVersion;
        }
      }
      if (dom.length === 1 && dom[0].semver === ANY) {
        if (options.includePrerelease) {
          return true;
        } else {
          dom = minimumVersion;
        }
      }
      const eqSet = /* @__PURE__ */ new Set();
      let gt, lt;
      for (const c of sub) {
        if (c.operator === ">" || c.operator === ">=") {
          gt = higherGT(gt, c, options);
        } else if (c.operator === "<" || c.operator === "<=") {
          lt = lowerLT(lt, c, options);
        } else {
          eqSet.add(c.semver);
        }
      }
      if (eqSet.size > 1) {
        return null;
      }
      let gtltComp;
      if (gt && lt) {
        gtltComp = compare(gt.semver, lt.semver, options);
        if (gtltComp > 0) {
          return null;
        } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
          return null;
        }
      }
      for (const eq of eqSet) {
        if (gt && !satisfies4(eq, String(gt), options)) {
          return null;
        }
        if (lt && !satisfies4(eq, String(lt), options)) {
          return null;
        }
        for (const c of dom) {
          if (!satisfies4(eq, String(c), options)) {
            return false;
          }
        }
        return true;
      }
      let higher, lower;
      let hasDomLT, hasDomGT;
      let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
      let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
      if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
        needDomLTPre = false;
      }
      for (const c of dom) {
        hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
        hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
        if (gt) {
          if (needDomGTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
              needDomGTPre = false;
            }
          }
          if (c.operator === ">" || c.operator === ">=") {
            higher = higherGT(gt, c, options);
            if (higher === c && higher !== gt) {
              return false;
            }
          } else if (gt.operator === ">=" && !satisfies4(gt.semver, String(c), options)) {
            return false;
          }
        }
        if (lt) {
          if (needDomLTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
              needDomLTPre = false;
            }
          }
          if (c.operator === "<" || c.operator === "<=") {
            lower = lowerLT(lt, c, options);
            if (lower === c && lower !== lt) {
              return false;
            }
          } else if (lt.operator === "<=" && !satisfies4(lt.semver, String(c), options)) {
            return false;
          }
        }
        if (!c.operator && (lt || gt) && gtltComp !== 0) {
          return false;
        }
      }
      if (gt && hasDomLT && !lt && gtltComp !== 0) {
        return false;
      }
      if (lt && hasDomGT && !gt && gtltComp !== 0) {
        return false;
      }
      if (needDomGTPre || needDomLTPre) {
        return false;
      }
      return true;
    };
    var higherGT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
    };
    var lowerLT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
    };
    module2.exports = subset;
  }
});

// node_modules/semver/index.js
var require_semver2 = __commonJS({
  "node_modules/semver/index.js"(exports2, module2) {
    "use strict";
    var internalRe = require_re();
    var constants = require_constants();
    var SemVer = require_semver();
    var identifiers = require_identifiers();
    var parse = require_parse();
    var valid2 = require_valid();
    var clean = require_clean();
    var inc = require_inc();
    var diff = require_diff();
    var major = require_major();
    var minor = require_minor();
    var patch = require_patch();
    var prerelease = require_prerelease();
    var compare = require_compare();
    var rcompare = require_rcompare();
    var compareLoose = require_compare_loose();
    var compareBuild = require_compare_build();
    var sort = require_sort();
    var rsort = require_rsort();
    var gt = require_gt();
    var lt = require_lt();
    var eq = require_eq();
    var neq = require_neq();
    var gte3 = require_gte();
    var lte2 = require_lte();
    var cmp = require_cmp();
    var coerce = require_coerce();
    var Comparator = require_comparator();
    var Range3 = require_range();
    var satisfies4 = require_satisfies();
    var toComparators = require_to_comparators();
    var maxSatisfying = require_max_satisfying();
    var minSatisfying = require_min_satisfying();
    var minVersion = require_min_version();
    var validRange = require_valid2();
    var outside = require_outside();
    var gtr = require_gtr();
    var ltr = require_ltr();
    var intersects = require_intersects();
    var simplifyRange = require_simplify();
    var subset = require_subset();
    module2.exports = {
      parse,
      valid: valid2,
      clean,
      inc,
      diff,
      major,
      minor,
      patch,
      prerelease,
      compare,
      rcompare,
      compareLoose,
      compareBuild,
      sort,
      rsort,
      gt,
      lt,
      eq,
      neq,
      gte: gte3,
      lte: lte2,
      cmp,
      coerce,
      Comparator,
      Range: Range3,
      satisfies: satisfies4,
      toComparators,
      maxSatisfying,
      minSatisfying,
      minVersion,
      validRange,
      outside,
      gtr,
      ltr,
      intersects,
      simplifyRange,
      subset,
      SemVer,
      re: internalRe.re,
      src: internalRe.src,
      tokens: internalRe.t,
      SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
      RELEASE_TYPES: constants.RELEASE_TYPES,
      compareIdentifiers: identifiers.compareIdentifiers,
      rcompareIdentifiers: identifiers.rcompareIdentifiers
    };
  }
});

// node_modules/dayjs/dayjs.min.js
var require_dayjs_min = __commonJS({
  "node_modules/dayjs/dayjs.min.js"(exports2, module2) {
    !function(t, e) {
      "object" == typeof exports2 && "undefined" != typeof module2 ? module2.exports = e() : "function" == typeof define && define.amd ? define(e) : (t = "undefined" != typeof globalThis ? globalThis : t || self).dayjs = e();
    }(exports2, function() {
      "use strict";
      var t = 1e3, e = 6e4, n = 36e5, r = "millisecond", i = "second", s = "minute", u = "hour", a = "day", o = "week", c = "month", f = "quarter", h = "year", d = "date", l = "Invalid Date", $ = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, y = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, M = { name: "en", weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"), ordinal: function(t2) {
        var e2 = ["th", "st", "nd", "rd"], n2 = t2 % 100;
        return "[" + t2 + (e2[(n2 - 20) % 10] || e2[n2] || e2[0]) + "]";
      } }, m = function(t2, e2, n2) {
        var r2 = String(t2);
        return !r2 || r2.length >= e2 ? t2 : "" + Array(e2 + 1 - r2.length).join(n2) + t2;
      }, v = { s: m, z: function(t2) {
        var e2 = -t2.utcOffset(), n2 = Math.abs(e2), r2 = Math.floor(n2 / 60), i2 = n2 % 60;
        return (e2 <= 0 ? "+" : "-") + m(r2, 2, "0") + ":" + m(i2, 2, "0");
      }, m: function t2(e2, n2) {
        if (e2.date() < n2.date()) return -t2(n2, e2);
        var r2 = 12 * (n2.year() - e2.year()) + (n2.month() - e2.month()), i2 = e2.clone().add(r2, c), s2 = n2 - i2 < 0, u2 = e2.clone().add(r2 + (s2 ? -1 : 1), c);
        return +(-(r2 + (n2 - i2) / (s2 ? i2 - u2 : u2 - i2)) || 0);
      }, a: function(t2) {
        return t2 < 0 ? Math.ceil(t2) || 0 : Math.floor(t2);
      }, p: function(t2) {
        return { M: c, y: h, w: o, d: a, D: d, h: u, m: s, s: i, ms: r, Q: f }[t2] || String(t2 || "").toLowerCase().replace(/s$/, "");
      }, u: function(t2) {
        return void 0 === t2;
      } }, g = "en", D = {};
      D[g] = M;
      var p = "$isDayjsObject", S = function(t2) {
        return t2 instanceof _ || !(!t2 || !t2[p]);
      }, w = function t2(e2, n2, r2) {
        var i2;
        if (!e2) return g;
        if ("string" == typeof e2) {
          var s2 = e2.toLowerCase();
          D[s2] && (i2 = s2), n2 && (D[s2] = n2, i2 = s2);
          var u2 = e2.split("-");
          if (!i2 && u2.length > 1) return t2(u2[0]);
        } else {
          var a2 = e2.name;
          D[a2] = e2, i2 = a2;
        }
        return !r2 && i2 && (g = i2), i2 || !r2 && g;
      }, O = function(t2, e2) {
        if (S(t2)) return t2.clone();
        var n2 = "object" == typeof e2 ? e2 : {};
        return n2.date = t2, n2.args = arguments, new _(n2);
      }, b = v;
      b.l = w, b.i = S, b.w = function(t2, e2) {
        return O(t2, { locale: e2.$L, utc: e2.$u, x: e2.$x, $offset: e2.$offset });
      };
      var _ = function() {
        function M2(t2) {
          this.$L = w(t2.locale, null, true), this.parse(t2), this.$x = this.$x || t2.x || {}, this[p] = true;
        }
        var m2 = M2.prototype;
        return m2.parse = function(t2) {
          this.$d = function(t3) {
            var e2 = t3.date, n2 = t3.utc;
            if (null === e2) return /* @__PURE__ */ new Date(NaN);
            if (b.u(e2)) return /* @__PURE__ */ new Date();
            if (e2 instanceof Date) return new Date(e2);
            if ("string" == typeof e2 && !/Z$/i.test(e2)) {
              var r2 = e2.match($);
              if (r2) {
                var i2 = r2[2] - 1 || 0, s2 = (r2[7] || "0").substring(0, 3);
                return n2 ? new Date(Date.UTC(r2[1], i2, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, s2)) : new Date(r2[1], i2, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, s2);
              }
            }
            return new Date(e2);
          }(t2), this.init();
        }, m2.init = function() {
          var t2 = this.$d;
          this.$y = t2.getFullYear(), this.$M = t2.getMonth(), this.$D = t2.getDate(), this.$W = t2.getDay(), this.$H = t2.getHours(), this.$m = t2.getMinutes(), this.$s = t2.getSeconds(), this.$ms = t2.getMilliseconds();
        }, m2.$utils = function() {
          return b;
        }, m2.isValid = function() {
          return !(this.$d.toString() === l);
        }, m2.isSame = function(t2, e2) {
          var n2 = O(t2);
          return this.startOf(e2) <= n2 && n2 <= this.endOf(e2);
        }, m2.isAfter = function(t2, e2) {
          return O(t2) < this.startOf(e2);
        }, m2.isBefore = function(t2, e2) {
          return this.endOf(e2) < O(t2);
        }, m2.$g = function(t2, e2, n2) {
          return b.u(t2) ? this[e2] : this.set(n2, t2);
        }, m2.unix = function() {
          return Math.floor(this.valueOf() / 1e3);
        }, m2.valueOf = function() {
          return this.$d.getTime();
        }, m2.startOf = function(t2, e2) {
          var n2 = this, r2 = !!b.u(e2) || e2, f2 = b.p(t2), l2 = function(t3, e3) {
            var i2 = b.w(n2.$u ? Date.UTC(n2.$y, e3, t3) : new Date(n2.$y, e3, t3), n2);
            return r2 ? i2 : i2.endOf(a);
          }, $2 = function(t3, e3) {
            return b.w(n2.toDate()[t3].apply(n2.toDate("s"), (r2 ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(e3)), n2);
          }, y2 = this.$W, M3 = this.$M, m3 = this.$D, v2 = "set" + (this.$u ? "UTC" : "");
          switch (f2) {
            case h:
              return r2 ? l2(1, 0) : l2(31, 11);
            case c:
              return r2 ? l2(1, M3) : l2(0, M3 + 1);
            case o:
              var g2 = this.$locale().weekStart || 0, D2 = (y2 < g2 ? y2 + 7 : y2) - g2;
              return l2(r2 ? m3 - D2 : m3 + (6 - D2), M3);
            case a:
            case d:
              return $2(v2 + "Hours", 0);
            case u:
              return $2(v2 + "Minutes", 1);
            case s:
              return $2(v2 + "Seconds", 2);
            case i:
              return $2(v2 + "Milliseconds", 3);
            default:
              return this.clone();
          }
        }, m2.endOf = function(t2) {
          return this.startOf(t2, false);
        }, m2.$set = function(t2, e2) {
          var n2, o2 = b.p(t2), f2 = "set" + (this.$u ? "UTC" : ""), l2 = (n2 = {}, n2[a] = f2 + "Date", n2[d] = f2 + "Date", n2[c] = f2 + "Month", n2[h] = f2 + "FullYear", n2[u] = f2 + "Hours", n2[s] = f2 + "Minutes", n2[i] = f2 + "Seconds", n2[r] = f2 + "Milliseconds", n2)[o2], $2 = o2 === a ? this.$D + (e2 - this.$W) : e2;
          if (o2 === c || o2 === h) {
            var y2 = this.clone().set(d, 1);
            y2.$d[l2]($2), y2.init(), this.$d = y2.set(d, Math.min(this.$D, y2.daysInMonth())).$d;
          } else l2 && this.$d[l2]($2);
          return this.init(), this;
        }, m2.set = function(t2, e2) {
          return this.clone().$set(t2, e2);
        }, m2.get = function(t2) {
          return this[b.p(t2)]();
        }, m2.add = function(r2, f2) {
          var d2, l2 = this;
          r2 = Number(r2);
          var $2 = b.p(f2), y2 = function(t2) {
            var e2 = O(l2);
            return b.w(e2.date(e2.date() + Math.round(t2 * r2)), l2);
          };
          if ($2 === c) return this.set(c, this.$M + r2);
          if ($2 === h) return this.set(h, this.$y + r2);
          if ($2 === a) return y2(1);
          if ($2 === o) return y2(7);
          var M3 = (d2 = {}, d2[s] = e, d2[u] = n, d2[i] = t, d2)[$2] || 1, m3 = this.$d.getTime() + r2 * M3;
          return b.w(m3, this);
        }, m2.subtract = function(t2, e2) {
          return this.add(-1 * t2, e2);
        }, m2.format = function(t2) {
          var e2 = this, n2 = this.$locale();
          if (!this.isValid()) return n2.invalidDate || l;
          var r2 = t2 || "YYYY-MM-DDTHH:mm:ssZ", i2 = b.z(this), s2 = this.$H, u2 = this.$m, a2 = this.$M, o2 = n2.weekdays, c2 = n2.months, f2 = n2.meridiem, h2 = function(t3, n3, i3, s3) {
            return t3 && (t3[n3] || t3(e2, r2)) || i3[n3].slice(0, s3);
          }, d2 = function(t3) {
            return b.s(s2 % 12 || 12, t3, "0");
          }, $2 = f2 || function(t3, e3, n3) {
            var r3 = t3 < 12 ? "AM" : "PM";
            return n3 ? r3.toLowerCase() : r3;
          };
          return r2.replace(y, function(t3, r3) {
            return r3 || function(t4) {
              switch (t4) {
                case "YY":
                  return String(e2.$y).slice(-2);
                case "YYYY":
                  return b.s(e2.$y, 4, "0");
                case "M":
                  return a2 + 1;
                case "MM":
                  return b.s(a2 + 1, 2, "0");
                case "MMM":
                  return h2(n2.monthsShort, a2, c2, 3);
                case "MMMM":
                  return h2(c2, a2);
                case "D":
                  return e2.$D;
                case "DD":
                  return b.s(e2.$D, 2, "0");
                case "d":
                  return String(e2.$W);
                case "dd":
                  return h2(n2.weekdaysMin, e2.$W, o2, 2);
                case "ddd":
                  return h2(n2.weekdaysShort, e2.$W, o2, 3);
                case "dddd":
                  return o2[e2.$W];
                case "H":
                  return String(s2);
                case "HH":
                  return b.s(s2, 2, "0");
                case "h":
                  return d2(1);
                case "hh":
                  return d2(2);
                case "a":
                  return $2(s2, u2, true);
                case "A":
                  return $2(s2, u2, false);
                case "m":
                  return String(u2);
                case "mm":
                  return b.s(u2, 2, "0");
                case "s":
                  return String(e2.$s);
                case "ss":
                  return b.s(e2.$s, 2, "0");
                case "SSS":
                  return b.s(e2.$ms, 3, "0");
                case "Z":
                  return i2;
              }
              return null;
            }(t3) || i2.replace(":", "");
          });
        }, m2.utcOffset = function() {
          return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
        }, m2.diff = function(r2, d2, l2) {
          var $2, y2 = this, M3 = b.p(d2), m3 = O(r2), v2 = (m3.utcOffset() - this.utcOffset()) * e, g2 = this - m3, D2 = function() {
            return b.m(y2, m3);
          };
          switch (M3) {
            case h:
              $2 = D2() / 12;
              break;
            case c:
              $2 = D2();
              break;
            case f:
              $2 = D2() / 3;
              break;
            case o:
              $2 = (g2 - v2) / 6048e5;
              break;
            case a:
              $2 = (g2 - v2) / 864e5;
              break;
            case u:
              $2 = g2 / n;
              break;
            case s:
              $2 = g2 / e;
              break;
            case i:
              $2 = g2 / t;
              break;
            default:
              $2 = g2;
          }
          return l2 ? $2 : b.a($2);
        }, m2.daysInMonth = function() {
          return this.endOf(c).$D;
        }, m2.$locale = function() {
          return D[this.$L];
        }, m2.locale = function(t2, e2) {
          if (!t2) return this.$L;
          var n2 = this.clone(), r2 = w(t2, e2, true);
          return r2 && (n2.$L = r2), n2;
        }, m2.clone = function() {
          return b.w(this.$d, this);
        }, m2.toDate = function() {
          return new Date(this.valueOf());
        }, m2.toJSON = function() {
          return this.isValid() ? this.toISOString() : null;
        }, m2.toISOString = function() {
          return this.$d.toISOString();
        }, m2.toString = function() {
          return this.$d.toUTCString();
        }, M2;
      }(), k = _.prototype;
      return O.prototype = k, [["$ms", r], ["$s", i], ["$m", s], ["$H", u], ["$W", a], ["$M", c], ["$y", h], ["$D", d]].forEach(function(t2) {
        k[t2[1]] = function(e2) {
          return this.$g(e2, t2[0], t2[1]);
        };
      }), O.extend = function(t2, e2) {
        return t2.$i || (t2(e2, _, O), t2.$i = true), O;
      }, O.locale = w, O.isDayjs = S, O.unix = function(t2) {
        return O(1e3 * t2);
      }, O.en = D[g], O.Ls = D, O.p = {}, O;
    });
  }
});

// node_modules/dayjs/plugin/relativeTime.js
var require_relativeTime = __commonJS({
  "node_modules/dayjs/plugin/relativeTime.js"(exports2, module2) {
    !function(r, e) {
      "object" == typeof exports2 && "undefined" != typeof module2 ? module2.exports = e() : "function" == typeof define && define.amd ? define(e) : (r = "undefined" != typeof globalThis ? globalThis : r || self).dayjs_plugin_relativeTime = e();
    }(exports2, function() {
      "use strict";
      return function(r, e, t) {
        r = r || {};
        var n = e.prototype, o = { future: "in %s", past: "%s ago", s: "a few seconds", m: "a minute", mm: "%d minutes", h: "an hour", hh: "%d hours", d: "a day", dd: "%d days", M: "a month", MM: "%d months", y: "a year", yy: "%d years" };
        function i(r2, e2, t2, o2) {
          return n.fromToBase(r2, e2, t2, o2);
        }
        t.en.relativeTime = o, n.fromToBase = function(e2, n2, i2, d2, u) {
          for (var f, a, s, l = i2.$locale().relativeTime || o, h = r.thresholds || [{ l: "s", r: 44, d: "second" }, { l: "m", r: 89 }, { l: "mm", r: 44, d: "minute" }, { l: "h", r: 89 }, { l: "hh", r: 21, d: "hour" }, { l: "d", r: 35 }, { l: "dd", r: 25, d: "day" }, { l: "M", r: 45 }, { l: "MM", r: 10, d: "month" }, { l: "y", r: 17 }, { l: "yy", d: "year" }], m = h.length, c = 0; c < m; c += 1) {
            var y = h[c];
            y.d && (f = d2 ? t(e2).diff(i2, y.d, true) : i2.diff(e2, y.d, true));
            var p = (r.rounding || Math.round)(Math.abs(f));
            if (s = f > 0, p <= y.r || !y.r) {
              p <= 1 && c > 0 && (y = h[c - 1]);
              var v = l[y.l];
              u && (p = u("" + p)), a = "string" == typeof v ? v.replace("%d", p) : v(p, n2, y.l, s);
              break;
            }
          }
          if (n2) return a;
          var M = s ? l.future : l.past;
          return "function" == typeof M ? M(a) : M.replace("%s", a);
        }, n.to = function(r2, e2) {
          return i(r2, e2, this, true);
        }, n.from = function(r2, e2) {
          return i(r2, e2, this);
        };
        var d = function(r2) {
          return r2.$u ? t.utc() : t();
        };
        n.toNow = function(r2) {
          return this.to(d(this), r2);
        }, n.fromNow = function(r2) {
          return this.from(d(this), r2);
        };
      };
    });
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var path29 = __toESM(require("path"));
var import_vscode67 = require("vscode");

// src/commands/add.ts
var import_vscode9 = require("vscode");

// src/commands/command.ts
var path6 = __toESM(require("path"));
var import_vscode8 = require("vscode");

// src/common/types.ts
var SvnDepth = /* @__PURE__ */ ((SvnDepth2) => {
  SvnDepth2["empty"] = "only the target itself";
  SvnDepth2["files"] = "the target and any immediate file children thereof";
  SvnDepth2["immediates"] = "the target and any immediate children thereof";
  SvnDepth2["infinity"] = "the target and all of its descendants\u2014full recursion";
  return SvnDepth2;
})(SvnDepth || {});

// node_modules/original-fs/index.mjs
var original_fs_exports = {};
__export(original_fs_exports, {
  default: () => import_fs.default
});
__reExport(original_fs_exports, require("fs"));
var import_fs = __toESM(require("fs"), 1);

// src/fs/exists.ts
function exists(path30) {
  return new Promise((resolve2, _reject) => {
    (0, original_fs_exports.access)(path30, (err) => err ? resolve2(false) : resolve2(true));
  });
}

// src/fs/lstat.ts
var import_util = require("util");
var lstat = (0, import_util.promisify)(original_fs_exports.lstat);

// src/fs/read_file.ts
var import_util2 = require("util");
var readFile = (0, import_util2.promisify)(original_fs_exports.readFile);

// src/fs/readdir.ts
var import_util3 = require("util");
var readdir = (0, import_util3.promisify)(original_fs_exports.readdir);

// src/fs/rmdir.ts
var import_util4 = require("util");
var rmdir = (0, import_util4.promisify)(original_fs_exports.rmdir);

// src/fs/stat.ts
var import_util5 = require("util");
var stat = (0, import_util5.promisify)(original_fs_exports.stat);

// src/fs/unlink.ts
var import_util6 = require("util");
var unlink = (0, import_util6.promisify)(original_fs_exports.unlink);

// src/fs/write_file.ts
var import_util7 = require("util");
var writeFile = (0, import_util7.promisify)(original_fs_exports.writeFile);

// src/ignoreitems.ts
var path = __toESM(require("path"));
var import_vscode = require("vscode");
var IgnoreSingleItem = class {
  constructor(expression, recursive = false) {
    this.expression = expression;
    this.recursive = recursive;
  }
  get label() {
    const text = this.recursive ? " (Recursive)" : "";
    return `${this.expression}${text}`;
  }
  get description() {
    const text = this.recursive ? " (Recursive)" : "";
    return `Add '${this.expression}' to 'svn:ignore'${text}`;
  }
};
async function inputIgnoreList(repository, uris) {
  if (uris.length === 0) {
    return false;
  }
  const regexExtension = new RegExp("\\.[^\\.]+(\\.map)?$", "i");
  if (uris.length === 1) {
    const uri = uris[0];
    const matchExt = uri.fsPath.match(regexExtension);
    const ext2 = matchExt && matchExt[0] ? matchExt[0] : "";
    const fileName = path.basename(uri.fsPath);
    const dirName = path.dirname(uri.fsPath);
    const picks2 = [];
    picks2.push(new IgnoreSingleItem(fileName));
    if (ext2) {
      picks2.push(new IgnoreSingleItem("*" + ext2));
    }
    picks2.push(new IgnoreSingleItem(fileName, true));
    if (ext2) {
      picks2.push(new IgnoreSingleItem("*" + ext2, true));
    }
    const pick2 = await import_vscode.window.showQuickPick(picks2);
    if (!pick2) {
      return false;
    }
    return repository.addToIgnore([pick2.expression], dirName, pick2.recursive);
  }
  const count = uris.length;
  const recursive = "(Recursive)";
  const ignoreByFileName = `Ignore ${count} by filename`;
  const ignoreByExtension = `Ignore ${count} by extension`;
  const ignoreByFileNameRecursive = `Ignore ${count} by filename ${recursive}`;
  const ignoreByExtensionRecursive = `Ignore ${count} by extension ${recursive}`;
  const picks = [
    ignoreByFileName,
    ignoreByExtension,
    ignoreByFileNameRecursive,
    ignoreByExtensionRecursive
  ];
  const pick = await import_vscode.window.showQuickPick(picks);
  if (!pick) {
    return false;
  }
  const isByFile = pick.startsWith(ignoreByFileName);
  const isRecursive = pick.endsWith(recursive);
  const byDir = {};
  for (const uri of uris) {
    const dirname9 = path.dirname(uri.fsPath);
    const filename = path.basename(uri.fsPath);
    const matchExt = uri.fsPath.match(regexExtension);
    const ext2 = matchExt && matchExt[0] ? matchExt[0] : "";
    if (typeof byDir[dirname9] === "undefined") {
      byDir[dirname9] = [];
    }
    if (isByFile) {
      byDir[dirname9].push(filename);
    } else if (ext2) {
      byDir[dirname9].push("*" + ext2);
    }
  }
  for (const dir in byDir) {
    if (byDir.hasOwnProperty(dir)) {
      const files = [...new Set(byDir[dir])];
      await repository.addToIgnore(files, dir, isRecursive);
    }
  }
  return true;
}

// src/lineChanges.ts
var import_vscode2 = require("vscode");
function applyLineChanges(original, modified, diffs) {
  const result = [];
  let currentLine = 0;
  for (const diff of diffs) {
    const isInsertion = diff.originalEndLineNumber === 0;
    const isDeletion = diff.modifiedEndLineNumber === 0;
    result.push(
      original.getText(
        new import_vscode2.Range(
          currentLine,
          0,
          isInsertion ? diff.originalStartLineNumber : diff.originalStartLineNumber - 1,
          0
        )
      )
    );
    if (!isDeletion) {
      let fromLine = diff.modifiedStartLineNumber - 1;
      let fromCharacter = 0;
      if (isInsertion && diff.originalStartLineNumber === original.lineCount) {
        fromLine = original.lineCount - 1;
        fromCharacter = original.lineAt(fromLine).range.end.character;
      }
      result.push(
        modified.getText(
          new import_vscode2.Range(fromLine, fromCharacter, diff.modifiedEndLineNumber, 0)
        )
      );
    }
    currentLine = isInsertion ? diff.originalStartLineNumber : diff.originalEndLineNumber;
  }
  result.push(
    original.getText(new import_vscode2.Range(currentLine, 0, original.lineCount, 0))
  );
  return result.join("");
}

// src/resource.ts
var path3 = __toESM(require("path"));
var import_vscode5 = require("vscode");

// src/util.ts
var path2 = __toESM(require("path"));
var import_vscode3 = require("vscode");
function done(promise) {
  return promise.then(() => void 0);
}
function dispose(disposables) {
  disposables.forEach((disposable) => disposable.dispose());
  return [];
}
function toDisposable(dispose3) {
  return { dispose: dispose3 };
}
function combinedDisposable(disposables) {
  return toDisposable(() => dispose(disposables));
}
function anyEvent(...events) {
  return (listener, thisArgs = null, disposables) => {
    const result = combinedDisposable(
      events.map((event) => event((i) => listener.call(thisArgs, i)))
    );
    if (disposables) {
      disposables.push(result);
    }
    return result;
  };
}
function filterEvent(event, filter2) {
  return (listener, thisArgs = null, disposables) => event(
    (e) => filter2(e) && listener.call(thisArgs, e),
    null,
    disposables
  );
}
function onceEvent(event) {
  return (listener, thisArgs = null, disposables) => {
    const result = event(
      (e) => {
        result.dispose();
        return listener.call(thisArgs, e);
      },
      null,
      disposables
    );
    return result;
  };
}
function eventToPromise(event) {
  return new Promise((c) => onceEvent(event)(c));
}
var regexNormalizePath = new RegExp(path2.sep === "/" ? "\\\\" : "/", "g");
var regexNormalizeWindows = new RegExp("^\\\\(\\w:)", "g");
function fixPathSeparator(file) {
  file = file.replace(regexNormalizePath, path2.sep);
  file = file.replace(regexNormalizeWindows, "$1");
  if (path2.sep === "\\") {
    file = file.charAt(0).toLowerCase() + file.slice(1);
  }
  return file;
}
function normalizePath(file) {
  file = fixPathSeparator(file);
  if (path2.sep === "\\") {
    file = file.toLowerCase();
  }
  return file;
}
function isDescendant(parent, descendant) {
  if (parent.trim() === "" || descendant.trim() === "") {
    return false;
  }
  parent = parent.replace(/[\\\/]/g, path2.sep);
  descendant = descendant.replace(/[\\\/]/g, path2.sep);
  if (path2.sep === "\\") {
    parent = parent.replace(/^\\/, "").toLowerCase();
    descendant = descendant.replace(/^\\/, "").toLowerCase();
  }
  if (parent === descendant) {
    return true;
  }
  if (parent.charAt(parent.length - 1) !== path2.sep) {
    parent += path2.sep;
  }
  return descendant.startsWith(parent);
}
function camelcase(name) {
  return name.replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
    return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
  }).replace(/[\s\-]+/g, "");
}
function timeout(ms) {
  return new Promise((resolve2) => setTimeout(resolve2, ms));
}
function isReadOnly(operation) {
  switch (operation) {
    case "CurrentBranch" /* CurrentBranch */:
    case "Log" /* Log */:
    case "Show" /* Show */:
    case "Info" /* Info */:
    case "Changes" /* Changes */:
      return true;
    default:
      return false;
  }
}
async function deleteDirectory(dirPath) {
  if (await exists(dirPath) && (await lstat(dirPath)).isDirectory()) {
    await Promise.all(
      (await readdir(dirPath)).map(async (entry) => {
        const entryPath = path2.join(dirPath, entry);
        if ((await lstat(entryPath)).isDirectory()) {
          await deleteDirectory(entryPath);
        } else {
          await unlink(entryPath);
        }
      })
    );
    await rmdir(dirPath);
  }
}
function unwrap(maybeT) {
  if (maybeT === void 0) {
    throw new Error("undefined unwrap");
  }
  return maybeT;
}
function fixPegRevision(file) {
  if (/@/.test(file)) {
    file += "@";
  }
  return file;
}
function getSvnDir() {
  return process.env.SVN_ASP_DOT_NET_HACK ? "_svn" : ".svn";
}
async function isSvnFolder(dir, checkParent = true) {
  const svnDir = getSvnDir();
  const result = await exists(`${dir}/${svnDir}`);
  if (result || !checkParent) {
    return result;
  }
  const parent = path2.dirname(dir);
  if (parent === dir || parent === ".") {
    return false;
  }
  return isSvnFolder(parent, true);
}
function setVscodeContext(key, value) {
  import_vscode3.commands.executeCommand("setContext", key, value);
}
function isWindowsPath(path30) {
  return /^[a-zA-Z]:\\/.test(path30);
}
function pathEquals(a, b) {
  if (isWindowsPath(a)) {
    a = a.toLowerCase();
    b = b.toLowerCase();
  }
  return a === b;
}
var EmptyDisposable = toDisposable(() => null);

// src/decorators.ts
function decorate(decorator) {
  return (_target, key, descriptor) => {
    let fnKey = null;
    let fn = null;
    if (typeof descriptor.value === "function") {
      fnKey = "value";
      fn = descriptor.value;
    } else if (typeof descriptor.get === "function") {
      fnKey = "get";
      fn = descriptor.get;
    }
    if (!fn || !fnKey) {
      throw new Error("not supported");
    }
    descriptor[fnKey] = decorator(fn, key);
  };
}
function _memoize(fn, key) {
  const memoizeKey = `$memoize$${key}`;
  return function(...args) {
    if (!this.hasOwnProperty(memoizeKey)) {
      Object.defineProperty(this, memoizeKey, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: fn.apply(this, args)
      });
    }
    return this[memoizeKey];
  };
}
var memoize = decorate(_memoize);
function _throttle(fn, key) {
  const currentKey = `$throttle$current$${key}`;
  const nextKey = `$throttle$next$${key}`;
  const trigger = function(...args) {
    if (this[nextKey]) {
      return this[nextKey];
    }
    if (this[currentKey]) {
      this[nextKey] = done(this[currentKey]).then(() => {
        this[nextKey] = void 0;
        return trigger.apply(this, args);
      });
      return this[nextKey];
    }
    this[currentKey] = fn.apply(this, args);
    const clear = () => this[currentKey] = void 0;
    done(this[currentKey]).then(clear, clear);
    return this[currentKey];
  };
  return trigger;
}
var throttle = decorate(_throttle);
function _sequentialize(fn, key) {
  const currentKey = `__$sequence$${key}`;
  return function(...args) {
    const currentPromise = this[currentKey] || Promise.resolve(null);
    const run = async () => fn.apply(this, args);
    this[currentKey] = currentPromise.then(run, run);
    return this[currentKey];
  };
}
var sequentialize = decorate(_sequentialize);
function debounce(delay) {
  return decorate((fn, key) => {
    const timerKey = `$debounce$${key}`;
    return function(...args) {
      clearTimeout(this[timerKey]);
      this[timerKey] = setTimeout(() => fn.apply(this, args), delay);
    };
  });
}
var _seqList = {};
function globalSequentialize(name) {
  return decorate((fn, _key) => {
    return function(...args) {
      const currentPromise = _seqList[name] || Promise.resolve(null);
      const run = async () => fn.apply(this, args);
      _seqList[name] = currentPromise.then(run, run);
      return _seqList[name];
    };
  });
}

// src/helpers/configuration.ts
var import_vscode4 = require("vscode");
var SVN = "svn";
var Configuration = class {
  constructor() {
    this._onDidChange = new import_vscode4.EventEmitter();
    this.configuration = import_vscode4.workspace.getConfiguration(SVN);
    import_vscode4.workspace.onDidChangeConfiguration(this.onConfigurationChanged, this);
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  onConfigurationChanged(event) {
    if (!event.affectsConfiguration(SVN)) {
      return;
    }
    this.configuration = import_vscode4.workspace.getConfiguration(SVN);
    this._onDidChange.fire(event);
  }
  get(section, defaultValue) {
    return this.configuration.get(section, defaultValue);
  }
  update(section, value, configurationTarget) {
    return this.configuration.update(section, value, configurationTarget);
  }
  inspect(section) {
    return this.configuration.inspect(section);
  }
};
var configuration = new Configuration();

// src/resource.ts
var iconsRootPath = path3.join(__dirname, "..", "icons");
function getIconUri(iconName, theme) {
  return import_vscode5.Uri.file(path3.join(iconsRootPath, theme, `${iconName}.svg`));
}
var _Resource = class _Resource {
  constructor(_resourceUri, _type, _renameResourceUri, _props, _remote = false) {
    this._resourceUri = _resourceUri;
    this._type = _type;
    this._renameResourceUri = _renameResourceUri;
    this._props = _props;
    this._remote = _remote;
  }
  get resourceUri() {
    return this._resourceUri;
  }
  get type() {
    return this._type;
  }
  get renameResourceUri() {
    return this._renameResourceUri;
  }
  get props() {
    return this._props;
  }
  get remote() {
    return this._remote;
  }
  get decorations() {
    const light = { iconPath: this.getIconPath("light") };
    const dark = { iconPath: this.getIconPath("dark") };
    const tooltip = this.tooltip;
    const strikeThrough = this.strikeThrough;
    const faded = this.faded;
    return {
      strikeThrough,
      faded,
      tooltip,
      light,
      dark
    };
  }
  get command() {
    const diffHead = configuration.get("diff.withHead", true);
    const changesLeftClick = configuration.get(
      "sourceControl.changesLeftClick",
      "open diff"
    );
    if (!this.remote && changesLeftClick === "open") {
      return {
        command: "svn.openFile",
        title: "Open file",
        arguments: [this]
      };
    }
    if (this.remote || diffHead) {
      return {
        command: "svn.openResourceHead",
        title: "Open Diff With Head",
        arguments: [this]
      };
    }
    return {
      command: "svn.openResourceBase",
      title: "Open Diff With Base",
      arguments: [this]
    };
  }
  getIconPath(theme) {
    if (this.type === "added" /* ADDED */ && this.renameResourceUri) {
      return _Resource.icons[theme].Renamed;
    }
    const type = this.type.charAt(0).toUpperCase() + this.type.slice(1);
    if (typeof _Resource.icons[theme][type] !== "undefined") {
      return _Resource.icons[theme][type];
    }
    return void 0;
  }
  get tooltip() {
    if (this.type === "added" /* ADDED */ && this.renameResourceUri) {
      return "Renamed from " + this.renameResourceUri.fsPath;
    }
    if (this.type === "normal" /* NORMAL */ && this.props && this.props !== "none" /* NONE */) {
      return "Property " + this.props.charAt(0).toUpperCase() + this.props.slice(1);
    }
    return this.type.charAt(0).toUpperCase() + this.type.slice(1);
  }
  get strikeThrough() {
    if (this.type === "deleted" /* DELETED */) {
      return true;
    }
    return false;
  }
  get faded() {
    return false;
  }
  get letter() {
    switch (this.type) {
      case "added" /* ADDED */:
        if (this.renameResourceUri) {
          return "R";
        }
        return "A";
      case "conflicted" /* CONFLICTED */:
        return "C";
      case "deleted" /* DELETED */:
        return "D";
      case "external" /* EXTERNAL */:
        return "E";
      case "ignored" /* IGNORED */:
        return "I";
      case "modified" /* MODIFIED */:
        return "M";
      case "replaced" /* REPLACED */:
        return "R";
      case "unversioned" /* UNVERSIONED */:
        return "U";
      case "missing" /* MISSING */:
        return "!";
      default:
        return void 0;
    }
  }
  get color() {
    switch (this.type) {
      case "modified" /* MODIFIED */:
      case "replaced" /* REPLACED */:
        return new import_vscode5.ThemeColor("gitDecoration.modifiedResourceForeground");
      case "deleted" /* DELETED */:
      case "missing" /* MISSING */:
        return new import_vscode5.ThemeColor("gitDecoration.deletedResourceForeground");
      case "added" /* ADDED */:
      case "unversioned" /* UNVERSIONED */:
        return new import_vscode5.ThemeColor("gitDecoration.untrackedResourceForeground");
      case "external" /* EXTERNAL */:
      case "ignored" /* IGNORED */:
        return new import_vscode5.ThemeColor("gitDecoration.ignoredResourceForeground");
      case "conflicted" /* CONFLICTED */:
        return new import_vscode5.ThemeColor("gitDecoration.conflictingResourceForeground");
      default:
        return void 0;
    }
  }
  get priority() {
    switch (this.type) {
      case "modified" /* MODIFIED */:
        return 2;
      case "ignored" /* IGNORED */:
        return 3;
      case "deleted" /* DELETED */:
      case "added" /* ADDED */:
      case "replaced" /* REPLACED */:
      case "missing" /* MISSING */:
        return 4;
      default:
        return 1;
    }
  }
};
_Resource.icons = {
  light: {
    Added: getIconUri("status-added", "light"),
    Conflicted: getIconUri("status-conflicted", "light"),
    Deleted: getIconUri("status-deleted", "light"),
    Ignored: getIconUri("status-ignored", "light"),
    Missing: getIconUri("status-missing", "light"),
    Modified: getIconUri("status-modified", "light"),
    Renamed: getIconUri("status-renamed", "light"),
    Replaced: getIconUri("status-replaced", "light"),
    Unversioned: getIconUri("status-unversioned", "light")
  },
  dark: {
    Added: getIconUri("status-added", "dark"),
    Conflicted: getIconUri("status-conflicted", "dark"),
    Deleted: getIconUri("status-deleted", "dark"),
    Ignored: getIconUri("status-ignored", "dark"),
    Missing: getIconUri("status-missing", "dark"),
    Modified: getIconUri("status-modified", "dark"),
    Renamed: getIconUri("status-renamed", "dark"),
    Replaced: getIconUri("status-replaced", "dark"),
    Unversioned: getIconUri("status-unversioned", "dark")
  }
};
__decorateClass([
  memoize
], _Resource.prototype, "resourceUri", 1);
__decorateClass([
  memoize
], _Resource.prototype, "type", 1);
__decorateClass([
  memoize
], _Resource.prototype, "command", 1);
var Resource = _Resource;

// src/treeView/nodes/incomingChangeNode.ts
var path5 = __toESM(require("path"));
var import_vscode7 = require("vscode");

// src/uri.ts
var path4 = __toESM(require("path"));
var import_vscode6 = require("vscode");
function fromSvnUri(uri) {
  return JSON.parse(uri.query);
}
function toSvnUri(uri, action, extra = {}, replaceFileExtension = false) {
  const params = {
    action,
    fsPath: uri.fsPath,
    extra
  };
  return uri.with({
    scheme: "svn",
    path: replaceFileExtension ? uri.path + getSvnDir() : uri.path,
    query: JSON.stringify(params)
  });
}
function getIconUri2(iconName, theme) {
  const iconsRootPath2 = path4.join(__dirname, "..", "icons");
  return import_vscode6.Uri.file(path4.join(iconsRootPath2, theme, `${iconName}.svg`));
}

// src/treeView/nodes/incomingChangeNode.ts
var IncomingChangeNode = class {
  constructor(uri, type, repository) {
    this.uri = uri;
    this.type = type;
    this.repository = repository;
  }
  get props() {
    return void 0;
  }
  get label() {
    return path5.relative(this.repository.workspaceRoot, this.uri.fsPath);
  }
  get contextValue() {
    return `incomingChange:${this.type}`;
  }
  getTreeItem() {
    const item = new import_vscode7.TreeItem(this.label, import_vscode7.TreeItemCollapsibleState.None);
    item.iconPath = {
      dark: getIconUri2(`status-${this.type}`, "dark"),
      light: getIconUri2(`status-${this.type}`, "light")
    };
    item.contextValue = this.contextValue;
    item.command = this.getCommand();
    return item;
  }
  getChildren() {
    return Promise.resolve([]);
  }
  getCommand() {
    switch (this.type) {
      case "modified":
        return {
          command: "svn.openChangeHead",
          title: "Open Changes with HEAD",
          arguments: [
            new Resource(this.uri, this.type, void 0, "none", true)
          ]
        };
      case "deleted":
        return {
          command: "svn.openFile",
          title: "Open File",
          arguments: [this.uri]
        };
      case "added":
        return {
          command: "svn.openHEADFile",
          title: "Open File (HEAD)",
          arguments: [
            new Resource(this.uri, this.type, void 0, "none", true)
          ]
        };
      default:
        console.error(`No command returned for type ${this.type}`);
        return;
    }
  }
};

// src/commands/command.ts
var Command2 = class {
  constructor(commandName, options = {}) {
    if (options.repository) {
      const command = this.createRepositoryCommand(this.execute);
      this._disposable = import_vscode8.commands.registerCommand(commandName, command);
      return;
    }
    if (!options.repository) {
      this._disposable = import_vscode8.commands.registerCommand(
        commandName,
        (...args) => this.execute(...args)
      );
      return;
    }
  }
  dispose() {
    var _a;
    (_a = this._disposable) == null ? void 0 : _a.dispose();
  }
  createRepositoryCommand(method) {
    const result = async (...args) => {
      const sourceControlManager = await import_vscode8.commands.executeCommand(
        "svn.getSourceControlManager",
        ""
      );
      const repository = sourceControlManager.getRepository(args[0]);
      let repositoryPromise;
      if (repository) {
        repositoryPromise = Promise.resolve(repository);
      } else if (sourceControlManager.repositories.length === 1) {
        repositoryPromise = Promise.resolve(
          sourceControlManager.repositories[0]
        );
      } else {
        repositoryPromise = sourceControlManager.pickRepository();
      }
      const result2 = repositoryPromise.then((repository2) => {
        if (!repository2) {
          return Promise.resolve();
        }
        return Promise.resolve(method.apply(this, [repository2, ...args]));
      });
      return result2.catch((err) => {
        console.error(err);
      });
    };
    return result;
  }
  async getResourceStates(resourceStates) {
    if (resourceStates.length === 0 || !(resourceStates[0].resourceUri instanceof import_vscode8.Uri)) {
      const resource = await this.getSCMResource();
      if (!resource) {
        return [];
      }
      resourceStates = [resource];
    }
    return resourceStates.filter((s) => s instanceof Resource);
  }
  async runByRepository(arg, fn) {
    const resources = arg instanceof import_vscode8.Uri ? [arg] : arg;
    const isSingleResource = arg instanceof import_vscode8.Uri;
    const sourceControlManager = await import_vscode8.commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    );
    const groups = [];
    for (const resource of resources) {
      const repository = sourceControlManager.getRepository(resource);
      if (!repository) {
        console.warn("Could not find Svn repository for ", resource);
        continue;
      }
      const tuple = groups.filter((p) => p.repository === repository)[0];
      if (tuple) {
        tuple.resources.push(resource);
      } else {
        groups.push({ repository, resources: [resource] });
      }
    }
    const promises = groups.map(({ repository, resources: resources2 }) => {
      if (isSingleResource) {
        return fn(
          repository,
          resources2[0]
        );
      }
      return fn(
        repository,
        resources2
      );
    });
    return Promise.all(promises);
  }
  async getSCMResource(uri) {
    uri = uri ? uri : import_vscode8.window.activeTextEditor && import_vscode8.window.activeTextEditor.document.uri;
    if (!uri) {
      return void 0;
    }
    if (uri.scheme === "svn") {
      const { fsPath } = fromSvnUri(uri);
      uri = import_vscode8.Uri.file(fsPath);
    }
    if (uri.scheme === "file") {
      const sourceControlManager = await import_vscode8.commands.executeCommand(
        "svn.getSourceControlManager",
        ""
      );
      const repository = sourceControlManager.getRepository(uri);
      if (!repository) {
        return void 0;
      }
      return repository.getResourceFromFile(uri);
    }
    return;
  }
  async _openResource(resource, against, preview, preserveFocus, preserveSelection) {
    let left = await this.getLeftResource(resource, against);
    let right = this.getRightResource(resource, against);
    const title = this.getTitle(resource, against);
    if (resource.remote && left) {
      [left, right] = [right, left];
    }
    if (!right) {
      console.error("oh no");
      return;
    }
    if (await exists(right.fsPath) && (await stat(right.fsPath)).isDirectory()) {
      return;
    }
    const opts = {
      preserveFocus,
      preview,
      viewColumn: import_vscode8.ViewColumn.Active
    };
    const activeTextEditor = import_vscode8.window.activeTextEditor;
    if (preserveSelection && activeTextEditor && activeTextEditor.document.uri.toString() === right.toString()) {
      opts.selection = activeTextEditor.selection;
    }
    if (!left) {
      return import_vscode8.commands.executeCommand("vscode.open", right, opts);
    }
    return import_vscode8.commands.executeCommand(
      "vscode.diff",
      left,
      right,
      title,
      opts
    );
  }
  async getLeftResource(resource, against = "") {
    if (resource.remote) {
      if (resource.type !== "deleted" /* DELETED */) {
        return toSvnUri(resource.resourceUri, "SHOW" /* SHOW */, {
          ref: against
        });
      }
      return;
    }
    if (resource.type === "added" /* ADDED */ && resource.renameResourceUri) {
      return toSvnUri(resource.renameResourceUri, "SHOW" /* SHOW */, {
        ref: against
      });
    }
    if (resource.type === "conflicted" /* CONFLICTED */ && await exists(resource.resourceUri.fsPath)) {
      const text = await readFile(resource.resourceUri.fsPath, {
        encoding: "utf8"
      });
      if (/^<{7}[^]+^={7}[^]+^>{7}/m.test(text)) {
        return void 0;
      }
    }
    switch (resource.type) {
      case "conflicted" /* CONFLICTED */:
      case "modified" /* MODIFIED */:
      case "replaced" /* REPLACED */:
        return toSvnUri(resource.resourceUri, "SHOW" /* SHOW */, {
          ref: against
        });
    }
    return;
  }
  getRightResource(resource, against = "") {
    if (resource.remote) {
      if (resource.type !== "added" /* ADDED */) {
        return resource.resourceUri;
      }
      return;
    }
    switch (resource.type) {
      case "added" /* ADDED */:
      case "conflicted" /* CONFLICTED */:
      case "ignored" /* IGNORED */:
      case "modified" /* MODIFIED */:
      case "unversioned" /* UNVERSIONED */:
      case "replaced" /* REPLACED */:
        return resource.resourceUri;
      case "deleted" /* DELETED */:
      case "missing" /* MISSING */:
        return toSvnUri(resource.resourceUri, "SHOW" /* SHOW */, {
          ref: against
        });
    }
    return;
  }
  getTitle(resource, against) {
    if (resource.type === "added" /* ADDED */ && resource.renameResourceUri) {
      const basename13 = path6.basename(resource.renameResourceUri.fsPath);
      const newname = path6.relative(
        path6.dirname(resource.renameResourceUri.fsPath),
        resource.resourceUri.fsPath
      );
      if (against) {
        return `${basename13} -> ${newname} (${against})`;
      }
      return `${basename13} -> ${newname}`;
    }
    const basename12 = path6.basename(resource.resourceUri.fsPath);
    if (against) {
      return `${basename12} (${against})`;
    }
    return "";
  }
  async openChange(arg, against, resourceStates) {
    const preserveFocus = arg instanceof Resource;
    const preserveSelection = arg instanceof import_vscode8.Uri || !arg;
    let resources;
    if (arg instanceof import_vscode8.Uri) {
      const resource = await this.getSCMResource(arg);
      if (resource !== void 0) {
        resources = [resource];
      }
    } else if (arg instanceof IncomingChangeNode) {
      const resource = new Resource(
        arg.uri,
        arg.type,
        void 0,
        arg.props,
        true
      );
      resources = [resource];
    } else {
      let resource;
      if (arg instanceof Resource) {
        resource = arg;
      } else {
        resource = await this.getSCMResource();
      }
      if (resource) {
        resources = [...resourceStates, resource];
      }
    }
    if (!resources) {
      return;
    }
    const preview = resources.length === 1 ? void 0 : false;
    for (const resource of resources) {
      await this._openResource(
        resource,
        against,
        preview,
        preserveFocus,
        preserveSelection
      );
    }
  }
  async showDiffPath(repository, content) {
    try {
      const tempFile = path6.join(
        repository.root,
        getSvnDir(),
        "tmp",
        "svn.patch"
      );
      if (await exists(tempFile)) {
        try {
          await unlink(tempFile);
        } catch (err) {
        }
      }
      const uri = import_vscode8.Uri.file(tempFile).with({
        scheme: "untitled"
      });
      const document = await import_vscode8.workspace.openTextDocument(uri);
      const textEditor = await import_vscode8.window.showTextDocument(document);
      await textEditor.edit((e) => {
        e.delete(
          new import_vscode8.Range(
            new import_vscode8.Position(0, 0),
            new import_vscode8.Position(Number.MAX_SAFE_INTEGER, 0)
          )
        );
        e.insert(new import_vscode8.Position(0, 0), content);
      });
    } catch (error) {
      console.error(error);
      import_vscode8.window.showErrorMessage("Unable to patch");
    }
  }
  async _revertChanges(textEditor, changes) {
    const modifiedDocument = textEditor.document;
    const modifiedUri = modifiedDocument.uri;
    if (modifiedUri.scheme !== "file") {
      return;
    }
    const originalUri = toSvnUri(modifiedUri, "SHOW" /* SHOW */, {
      ref: "BASE"
    });
    const originalDocument = await import_vscode8.workspace.openTextDocument(originalUri);
    const result = applyLineChanges(
      originalDocument,
      modifiedDocument,
      changes
    );
    const edit = new import_vscode8.WorkspaceEdit();
    edit.replace(
      modifiedUri,
      new import_vscode8.Range(
        new import_vscode8.Position(0, 0),
        modifiedDocument.lineAt(modifiedDocument.lineCount - 1).range.end
      ),
      result
    );
    import_vscode8.workspace.applyEdit(edit);
    await modifiedDocument.save();
  }
  async addToIgnore(uris) {
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }
      try {
        const ignored = await inputIgnoreList(repository, resources);
        if (ignored) {
          import_vscode8.window.showInformationMessage(`File(s) is now being ignored`);
        }
      } catch (error) {
        console.log(error);
        import_vscode8.window.showErrorMessage("Unable to set property ignore");
      }
    });
  }
};

// src/commands/add.ts
var Add = class extends Command2 {
  constructor() {
    super("svn.add");
  }
  async execute(...resourceStates) {
    const selection = await this.getResourceStates(resourceStates);
    if (selection.length === 0) {
      return;
    }
    const uris = selection.map((resource) => resource.resourceUri);
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }
      const paths = resources.map((resource) => resource.fsPath);
      try {
        await repository.addFiles(paths);
      } catch (error) {
        console.log(error);
        import_vscode9.window.showErrorMessage("Unable to add file");
      }
    });
  }
};

// src/commands/addToIgnoreExplorer.ts
var AddToIgnoreExplorer = class extends Command2 {
  constructor() {
    super("svn.addToIgnoreExplorer");
  }
  async execute(_mainUri, allUris) {
    if (!allUris || allUris.length === 0) {
      return;
    }
    return this.addToIgnore(allUris);
  }
};

// src/commands/addToIgnoreSCM.ts
var AddToIgnoreSCM = class extends Command2 {
  constructor() {
    super("svn.addToIgnoreSCM");
  }
  async execute(...resourceStates) {
    const selection = await this.getResourceStates(resourceStates);
    if (selection.length === 0) {
      return;
    }
    const uris = selection.map((resource) => resource.resourceUri);
    return this.addToIgnore(uris);
  }
};

// src/commands/changeList.ts
var import_vscode11 = require("vscode");

// src/changelistItems.ts
var import_vscode10 = require("vscode");

// src/quickPickItems/changeListItem.ts
var ChangeListItem = class {
  constructor(group) {
    this.group = group;
  }
  get label() {
    return this.group.id.replace(/^changelist-/, "");
  }
  get id() {
    return this.group.id;
  }
  get description() {
    return this.group.label;
  }
  get resourceGroup() {
    return this.group;
  }
};

// src/quickPickItems/ignoredChangeListItem.ts
var IgnoredChangeListItem = class {
  constructor(_id) {
    this._id = _id;
  }
  get label() {
    return this._id;
  }
  get description() {
    return "Ignored on commit";
  }
};

// src/quickPickItems/newChangeListItem.ts
var NewChangeListItem = class {
  get label() {
    return "$(plus) New changelist";
  }
  get description() {
    return "Create a new change list";
  }
};

// src/quickPickItems/removeChangeListItem.ts
var RemoveChangeListItem = class {
  get label() {
    return "$(dash) Remove changelist";
  }
  get description() {
    return "Remove changelist of file(s)";
  }
};

// src/quickPickItems/fileItem.ts
var FileItem = class {
  constructor(_repository, _state, picked = false) {
    this._repository = _repository;
    this._state = _state;
    this.picked = picked;
  }
  get label() {
    return this._repository.repository.removeAbsolutePath(
      this._state.resourceUri.fsPath
    );
  }
  get description() {
    return this._state.resourceUri.fsPath;
  }
  get state() {
    return this._state;
  }
};

// src/changelistItems.ts
function getChangelistPickOptions(repository, canRemove = false) {
  const picks = [];
  picks.push(new NewChangeListItem());
  repository.changelists.forEach((group, _changelist) => {
    if (group.resourceStates.length) {
      picks.push(new ChangeListItem(group));
    }
  });
  const ignoreOnCommitList = configuration.get(
    "sourceControl.ignoreOnCommit"
  );
  for (const ignoreOnCommit of ignoreOnCommitList) {
    if (!picks.some((p) => p.label === ignoreOnCommit)) {
      picks.push(new IgnoredChangeListItem(ignoreOnCommit));
    }
  }
  if (canRemove) {
    picks.push(new RemoveChangeListItem());
  }
  return picks;
}
function getCommitChangelistPickOptions(repository) {
  const picks = [];
  if (repository.changes.resourceStates.length) {
    picks.push(new ChangeListItem(repository.changes));
  }
  const ignoreOnCommitList = configuration.get(
    "sourceControl.ignoreOnCommit"
  );
  repository.changelists.forEach((group, changelist) => {
    if (group.resourceStates.length && !ignoreOnCommitList.includes(changelist)) {
      picks.push(new ChangeListItem(group));
    }
  });
  return picks;
}
async function inputSwitchChangelist(repository, canRemove = false) {
  const picks = getChangelistPickOptions(
    repository,
    canRemove
  );
  const selectedChoice = await import_vscode10.window.showQuickPick(picks, {
    placeHolder: "Select an existing changelist or create a new"
  });
  if (!selectedChoice) {
    return;
  }
  let changelistName;
  if (selectedChoice instanceof RemoveChangeListItem) {
    return false;
  } else if (selectedChoice instanceof NewChangeListItem) {
    const newChangelistName = await import_vscode10.window.showInputBox({
      placeHolder: "Changelist name",
      prompt: "Please enter a changelist name"
    });
    if (!newChangelistName) {
      return;
    }
    changelistName = newChangelistName;
  } else {
    changelistName = selectedChoice.label;
  }
  return changelistName;
}
async function inputCommitChangelist(repository) {
  const picks = getCommitChangelistPickOptions(repository);
  if (picks.length === 0) {
    import_vscode10.window.showInformationMessage("There are no changes to commit.");
    return;
  }
  let choice;
  if (picks.length === 1 && repository.changes.resourceStates.length) {
    choice = picks[0];
  } else {
    choice = await import_vscode10.window.showQuickPick(picks, {
      placeHolder: "Select a changelist to commit"
    });
  }
  return choice;
}
async function inputCommitFiles(repository) {
  const choice = await inputCommitChangelist(repository);
  if (!choice) {
    return;
  }
  if (choice.id === "changes" && choice.resourceGroup.resourceStates.length > 1) {
    const selectedAll = configuration.get("commit.changes.selectedAll", true);
    const picks = choice.resourceGroup.resourceStates.map(
      (r) => new FileItem(repository, r, selectedAll)
    );
    const selected = await import_vscode10.window.showQuickPick(picks, {
      placeHolder: "Select files to commit",
      canPickMany: true
    });
    if (selected !== void 0 && selected.length > 0) {
      return selected.map((s) => s.state);
    }
    return;
  }
  return choice.resourceGroup.resourceStates;
}
function patchChangelistOptions(repository) {
  const picks = [];
  repository.changelists.forEach((group, _changelist) => {
    if (group.resourceStates.length) {
      picks.push(new ChangeListItem(group));
    }
  });
  return picks;
}
async function getPatchChangelist(repository) {
  const picks = patchChangelistOptions(repository);
  if (!picks.length) {
    import_vscode10.window.showErrorMessage("No changelists to pick from");
    return;
  }
  const selectedChoice = await import_vscode10.window.showQuickPick(picks, {
    placeHolder: "Select a changelist"
  });
  if (!selectedChoice) {
    return;
  }
  return selectedChoice.label;
}

// src/commands/changeList.ts
var ChangeList = class extends Command2 {
  constructor() {
    super("svn.changelist");
  }
  async execute(...args) {
    let uris;
    if (args[0] instanceof Resource) {
      uris = args.map((resource) => resource.resourceUri);
    } else if (args[0] instanceof import_vscode11.Uri) {
      uris = args[1];
    } else if (import_vscode11.window.activeTextEditor) {
      uris = [import_vscode11.window.activeTextEditor.document.uri];
    } else {
      console.error("Unhandled type for changelist command");
      return;
    }
    const sourceControlManager = await import_vscode11.commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    );
    const promiseArray = uris.map(
      async (uri) => sourceControlManager.getRepositoryFromUri(uri)
    );
    let repositories = await Promise.all(promiseArray);
    repositories = repositories.filter((repository2) => repository2);
    if (repositories.length === 0) {
      import_vscode11.window.showErrorMessage(
        "Files are not under version control and cannot be added to a change list"
      );
      return;
    }
    const uniqueRepositories = Array.from(new Set(repositories));
    if (uniqueRepositories.length !== 1) {
      import_vscode11.window.showErrorMessage(
        "Unable to add files from different repositories to change list"
      );
      return;
    }
    if (repositories.length !== uris.length) {
      import_vscode11.window.showErrorMessage(
        "Some Files are not under version control and cannot be added to a change list"
      );
      return;
    }
    const repository = repositories[0];
    if (!repository) {
      return;
    }
    const paths = uris.map((uri) => uri.fsPath);
    let canRemove = false;
    repository.changelists.forEach((group, _changelist) => {
      if (group.resourceStates.some((state) => {
        return paths.some((path30) => {
          return normalizePath(path30) === normalizePath(state.resourceUri.path);
        });
      })) {
        canRemove = true;
        return false;
      }
      return;
    });
    const changelistName = await inputSwitchChangelist(repository, canRemove);
    if (!changelistName && changelistName !== false) {
      return;
    }
    if (changelistName === false) {
      try {
        await repository.removeChangelist(paths);
      } catch (error) {
        console.log(error);
        import_vscode11.window.showErrorMessage(
          `Unable to remove file "${paths.join(",")}" from changelist`
        );
      }
    } else {
      try {
        await repository.addChangelist(paths, changelistName);
        import_vscode11.window.showInformationMessage(
          `Added files "${paths.join(",")}" to changelist "${changelistName}"`
        );
      } catch (error) {
        console.log(error);
        import_vscode11.window.showErrorMessage(
          `Unable to add file "${paths.join(
            ","
          )}" to changelist "${changelistName}"`
        );
      }
    }
  }
};

// src/commands/checkout.ts
var os = __toESM(require("os"));
var path9 = __toESM(require("path"));
var import_vscode15 = require("vscode");

// src/helpers/branch.ts
var import_vscode12 = require("vscode");

// src/quickPickItems/folderItem.ts
var FolderItem = class {
  constructor(dir, parent) {
    this.dir = dir;
    this.parent = parent;
  }
  get label() {
    if (this.branch) {
      return `$(git-branch) ${this.dir.name}`;
    }
    return `$(file-directory) ${this.dir.name}`;
  }
  get description() {
    return `r${this.dir.commit.revision} | ${this.dir.commit.author} | ${new Date(this.dir.commit.date).toLocaleString()}`;
  }
  get path() {
    if (this.parent) {
      return `${this.parent}/${this.dir.name}`;
    }
    return this.dir.name;
  }
  get branch() {
    return getBranchName(this.path);
  }
};
__decorateClass([
  memoize
], FolderItem.prototype, "branch", 1);

// src/quickPickItems/newFolderItem.ts
var NewFolderItem = class {
  constructor(_parent) {
    this._parent = _parent;
  }
  get label() {
    return `$(plus) Create new branch`;
  }
  get description() {
    return `Create new branch in "${this._parent}"`;
  }
};

// src/quickPickItems/parentFolderItem.ts
var ParentFolderItem = class {
  constructor(path30) {
    this.path = path30;
  }
  get label() {
    return `$(arrow-left) back to /${this.path}`;
  }
  get description() {
    return `Back to parent`;
  }
};

// src/helpers/branch.ts
function getBranchName(folder) {
  const confs = [
    "layout.trunkRegex",
    "layout.branchesRegex",
    "layout.tagsRegex"
  ];
  for (const conf of confs) {
    const layout = configuration.get(conf);
    if (!layout) {
      continue;
    }
    const group = configuration.get(`${conf}Name`, 1) + 2;
    const regex = new RegExp(`(^|/)(${layout})$`);
    const matches = folder.match(regex);
    if (matches && matches[2] && matches[group]) {
      return {
        name: matches[group],
        path: matches[2]
      };
    }
  }
  return;
}
async function selectBranch(repository, allowNew = false, folder) {
  const promise = repository.repository.list(folder);
  import_vscode12.window.withProgress(
    { location: import_vscode12.ProgressLocation.Window, title: "Checking remote branches" },
    () => promise
  );
  const list = await promise;
  const dirs = list.filter((item) => item.kind === "dir" /* DIR */);
  const picks = [];
  if (folder) {
    const parts = folder.split("/");
    parts.pop();
    const parent = parts.join("/");
    picks.push(new ParentFolderItem(parent));
  }
  if (allowNew && folder && !!getBranchName(`${folder}/test`)) {
    picks.push(new NewFolderItem(folder));
  }
  picks.push(...dirs.map((dir) => new FolderItem(dir, folder)));
  const choice = await import_vscode12.window.showQuickPick(picks);
  if (!choice) {
    return;
  }
  if (choice instanceof ParentFolderItem) {
    return selectBranch(repository, allowNew, choice.path);
  }
  if (choice instanceof FolderItem) {
    if (choice.branch) {
      return choice.branch;
    }
    return selectBranch(repository, allowNew, choice.path);
  }
  if (choice instanceof NewFolderItem) {
    const result = await import_vscode12.window.showInputBox({
      prompt: "Please provide a branch name",
      ignoreFocusOut: true
    });
    if (!result) {
      return;
    }
    const name = result.replace(
      /^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$/g,
      "-"
    );
    const newBranch = getBranchName(`${folder}/${name}`);
    if (newBranch) {
      newBranch.isNew = true;
    }
    return newBranch;
  }
  return;
}
function isTrunk(folder) {
  const conf = "layout.trunkRegex";
  const layout = configuration.get(conf);
  const regex = new RegExp(`(^|/)(${layout})$`);
  const matches = folder.match(regex);
  const group = configuration.get(`${conf}Name`, 1) + 2;
  if (matches && matches[2] && matches[group]) {
    return true;
  }
  return false;
}

// src/svn.ts
var cp = __toESM(require("child_process"));
var import_events = require("events");
var proc = __toESM(require("process"));

// src/encoding.ts
var import_chardet = __toESM(require_lib());
function detectEncodingByBOM(buffer) {
  if (!buffer || buffer.length < 2) {
    return null;
  }
  const b0 = buffer.readUInt8(0);
  const b1 = buffer.readUInt8(1);
  if (b0 === 254 && b1 === 255) {
    return "utf16be";
  }
  if (b0 === 255 && b1 === 254) {
    return "utf16le";
  }
  if (buffer.length < 3) {
    return null;
  }
  const b2 = buffer.readUInt8(2);
  if (b0 === 239 && b1 === 187 && b2 === 191) {
    return "utf8";
  }
  return null;
}
var IGNORE_ENCODINGS = ["ascii", "utf-8", "utf-16", "utf-32"];
var CHARDET_TO_ICONV_ENCODINGS = {
  ibm866: "cp866",
  big5: "cp950"
};
function normaliseEncodingName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}
function detectEncoding(buffer) {
  const bomEncoding = detectEncodingByBOM(buffer);
  if (bomEncoding) {
    return bomEncoding;
  }
  const detected = (0, import_chardet.analyse)(buffer);
  if (!detected || detected.length === 0) {
    return null;
  }
  const encodingPriorities = configuration.get(
    "experimental.encoding_priority",
    []
  );
  if (encodingPriorities.length > 0) {
    for (const pri of encodingPriorities) {
      const match3 = detected.find(
        (d) => normaliseEncodingName(pri) === normaliseEncodingName(d.name)
      );
      if (match3 && match3.confidence > 60) {
        const normalizedName = normaliseEncodingName(match3.name);
        const mapped2 = CHARDET_TO_ICONV_ENCODINGS[normalizedName];
        return mapped2 || normalizedName;
      }
    }
  }
  const best = detected[0];
  if (best.confidence < 80) {
    return null;
  }
  const encoding = best.name;
  if (0 <= IGNORE_ENCODINGS.indexOf(encoding.toLowerCase())) {
    return null;
  }
  const normalizedEncodingName = normaliseEncodingName(encoding);
  const mapped = CHARDET_TO_ICONV_ENCODINGS[normalizedEncodingName];
  return mapped || normalizedEncodingName;
}

// src/parser/infoParser.ts
var xml2js = __toESM(require_xml2js());

// src/common/constants.ts
var xml2jsParseSettings = {
  mergeAttrs: true,
  explicitRoot: false,
  explicitArray: false,
  attrNameProcessors: [camelcase],
  tagNameProcessors: [camelcase],
  // XXE Protection: Disable DOCTYPE processing and static entity parsing
  // to prevent XML External Entity attacks
  doctype: false
};

// src/parser/infoParser.ts
async function parseInfoXml(content) {
  return new Promise((resolve2, reject) => {
    xml2js.parseString(
      content,
      xml2jsParseSettings,
      (err, result) => {
        if (err || typeof result.entry === "undefined") {
          reject();
        }
        resolve2(result.entry);
      }
    );
  });
}

// src/security/errorSanitizer.ts
function sanitizeString(input) {
  if (!input) return input;
  let sanitized = input;
  sanitized = sanitized.replace(/[A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/gi, "[PATH]");
  sanitized = sanitized.replace(/\/(?:[a-zA-Z0-9._\-~]+\/)*[a-zA-Z0-9._\-~]*/g, "[PATH]");
  sanitized = sanitized.replace(
    /https?:\/\/(?:(?:[a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=])+)/gi,
    "[DOMAIN]"
  );
  sanitized = sanitized.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]");
  sanitized = sanitized.replace(/\b(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\b/g, "[IP]");
  sanitized = sanitized.replace(
    /(?:password|passwd|pwd|token|secret|api[_-]?key|auth|credential|apikey)\s*=\s*[^\s,;]+/gi,
    "$&=[REDACTED]"
  );
  sanitized = sanitized.replace(
    /[?&](?:password|passwd|pwd|token|secret|api[_-]?key|auth|credential|apikey)\s*=\s*[^\s&;]+/gi,
    (match3) => {
      const [key] = match3.split("=");
      return key + "=[REDACTED]";
    }
  );
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._\-~+/=]+/g, "Bearer [REDACTED]");
  sanitized = sanitized.replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic [REDACTED]");
  sanitized = sanitized.replace(/"([A-Za-z0-9+/=_\-]{32,})"/g, '"[REDACTED]"');
  sanitized = sanitized.replace(/'([A-Za-z0-9+/=_\-]{32,})'/g, "'[REDACTED]'");
  sanitized = sanitized.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "[UUID]"
  );
  sanitized = sanitized.replace(/AKIA[0-9A-Z]{16}/g, "[AWS_KEY]");
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
  return sanitized;
}
function createSanitizedErrorLog(error) {
  if (!error) return {};
  const log = {};
  if (error.message) log.message = sanitizeString(error.message);
  if (error.name) log.name = error.name;
  if (error.code) log.code = error.code;
  if (error.exitCode) log.exitCode = error.exitCode;
  if (error.svnErrorCode) log.svnErrorCode = error.svnErrorCode;
  if (error.svnCommand) log.svnCommand = sanitizeString(error.svnCommand);
  if (error.stdout) log.stdout = sanitizeString(error.stdout);
  if (error.stderr) log.stderr = sanitizeString(error.stderr);
  if (error.stderrFormated) log.stderrFormated = sanitizeString(error.stderrFormated);
  if (error.stack) log.stack = sanitizeString(error.stack);
  return log;
}

// src/svnError.ts
var SvnError = class {
  constructor(data) {
    if (data.error) {
      this.error = data.error;
      this.message = data.error.message;
    } else {
      this.error = void 0;
    }
    this.message = data.message || "SVN error";
    this.stdout = data.stdout;
    this.stderr = data.stderr;
    this.stderrFormated = data.stderrFormated;
    this.exitCode = data.exitCode;
    this.svnErrorCode = data.svnErrorCode;
    this.svnCommand = data.svnCommand;
  }
  toString() {
    const errorLog = createSanitizedErrorLog(this);
    let result = sanitizeString(this.message) + " " + JSON.stringify(errorLog, null, 2);
    if (this.error) {
      result += sanitizeString(this.error.stack || "");
    }
    return result;
  }
};

// src/svnRepository.ts
var path8 = __toESM(require("path"));
var tmp = __toESM(require_tmp());
var import_vscode13 = require("vscode");

// src/parser/listParser.ts
var xml2js2 = __toESM(require_xml2js());
async function parseSvnList(content) {
  return new Promise((resolve2, reject) => {
    xml2js2.parseString(content, xml2jsParseSettings, (err, result) => {
      if (err) {
        reject();
      }
      if (result.list && result.list.entry) {
        if (!Array.isArray(result.list.entry)) {
          result.list.entry = [result.list.entry];
        }
        resolve2(result.list.entry);
      } else {
        resolve2([]);
      }
    });
  });
}

// src/parser/logParser.ts
var xml2js3 = __toESM(require_xml2js());
async function parseSvnLog(content) {
  return new Promise((resolve2, reject) => {
    xml2js3.parseString(content, xml2jsParseSettings, (err, result) => {
      if (err) {
        reject();
      }
      let transformed = [];
      if (Array.isArray(result.logentry)) {
        transformed = result.logentry;
      } else if (typeof result.logentry === "object") {
        transformed = [result.logentry];
      }
      for (const logentry of transformed) {
        if (logentry.paths === void 0) {
          logentry.paths = [];
        } else if (Array.isArray(logentry.paths.path)) {
          logentry.paths = logentry.paths.path;
        } else {
          logentry.paths = [logentry.paths.path];
        }
      }
      resolve2(transformed);
    });
  });
}

// src/parser/statusParser.ts
var xml2js4 = __toESM(require_xml2js());
function processEntry(entry, changelist) {
  if (Array.isArray(entry)) {
    const list = [];
    entry.forEach((e) => {
      const r2 = processEntry(e, changelist);
      if (r2) {
        list.push(...r2);
      }
    });
    return list;
  }
  const wcStatus = {
    locked: !!entry.wcStatus.wcLocked && entry.wcStatus.wcLocked === "true" || !!(entry.reposStatus && entry.reposStatus.lock),
    switched: !!entry.wcStatus.switched && entry.wcStatus.switched === "true"
  };
  const r = {
    changelist,
    path: entry.path,
    status: entry.wcStatus.item,
    props: entry.wcStatus.props,
    wcStatus,
    reposStatus: entry.reposStatus
  };
  if (entry.wcStatus.movedTo && r.status === "deleted") {
    return [];
  }
  if (entry.wcStatus.movedFrom && r.status === "added") {
    r.rename = entry.wcStatus.movedFrom;
  }
  if (entry.wcStatus.commit) {
    r.commit = {
      revision: entry.wcStatus.commit.revision,
      author: entry.wcStatus.commit.author,
      date: entry.wcStatus.commit.date
    };
  }
  return [r];
}
function xmlToStatus(xml) {
  const statusList = [];
  if (xml.target && xml.target.entry) {
    statusList.push(...processEntry(xml.target.entry));
  }
  if (xml.changelist) {
    if (!Array.isArray(xml.changelist)) {
      xml.changelist = [xml.changelist];
    }
    xml.changelist.forEach((change) => {
      statusList.push(...processEntry(change.entry, change.name));
    });
  }
  return statusList;
}
async function parseStatusXml(content) {
  return new Promise((resolve2, reject) => {
    xml2js4.parseString(content, xml2jsParseSettings, (err, result) => {
      if (err) {
        reject();
      }
      const statusList = xmlToStatus(result);
      resolve2(statusList);
    });
  });
}

// node_modules/@isaacs/balanced-match/dist/esm/index.js
var balanced = (a, b, str) => {
  const ma = a instanceof RegExp ? maybeMatch(a, str) : a;
  const mb = b instanceof RegExp ? maybeMatch(b, str) : b;
  const r = ma !== null && mb != null && range(ma, mb, str);
  return r && {
    start: r[0],
    end: r[1],
    pre: str.slice(0, r[0]),
    body: str.slice(r[0] + ma.length, r[1]),
    post: str.slice(r[1] + mb.length)
  };
};
var maybeMatch = (reg, str) => {
  const m = str.match(reg);
  return m ? m[0] : null;
};
var range = (a, b, str) => {
  let begs, beg, left, right = void 0, result;
  let ai = str.indexOf(a);
  let bi = str.indexOf(b, ai + 1);
  let i = ai;
  if (ai >= 0 && bi > 0) {
    if (a === b) {
      return [ai, bi];
    }
    begs = [];
    left = str.length;
    while (i >= 0 && !result) {
      if (i === ai) {
        begs.push(i);
        ai = str.indexOf(a, i + 1);
      } else if (begs.length === 1) {
        const r = begs.pop();
        if (r !== void 0)
          result = [r, bi];
      } else {
        beg = begs.pop();
        if (beg !== void 0 && beg < left) {
          left = beg;
          right = bi;
        }
        bi = str.indexOf(b, i + 1);
      }
      i = ai < bi && ai >= 0 ? ai : bi;
    }
    if (begs.length && right !== void 0) {
      result = [left, right];
    }
  }
  return result;
};

// node_modules/@isaacs/brace-expansion/dist/esm/index.js
var escSlash = "\0SLASH" + Math.random() + "\0";
var escOpen = "\0OPEN" + Math.random() + "\0";
var escClose = "\0CLOSE" + Math.random() + "\0";
var escComma = "\0COMMA" + Math.random() + "\0";
var escPeriod = "\0PERIOD" + Math.random() + "\0";
var escSlashPattern = new RegExp(escSlash, "g");
var escOpenPattern = new RegExp(escOpen, "g");
var escClosePattern = new RegExp(escClose, "g");
var escCommaPattern = new RegExp(escComma, "g");
var escPeriodPattern = new RegExp(escPeriod, "g");
var slashPattern = /\\\\/g;
var openPattern = /\\{/g;
var closePattern = /\\}/g;
var commaPattern = /\\,/g;
var periodPattern = /\\./g;
function numeric(str) {
  return !isNaN(str) ? parseInt(str, 10) : str.charCodeAt(0);
}
function escapeBraces(str) {
  return str.replace(slashPattern, escSlash).replace(openPattern, escOpen).replace(closePattern, escClose).replace(commaPattern, escComma).replace(periodPattern, escPeriod);
}
function unescapeBraces(str) {
  return str.replace(escSlashPattern, "\\").replace(escOpenPattern, "{").replace(escClosePattern, "}").replace(escCommaPattern, ",").replace(escPeriodPattern, ".");
}
function parseCommaParts(str) {
  if (!str) {
    return [""];
  }
  const parts = [];
  const m = balanced("{", "}", str);
  if (!m) {
    return str.split(",");
  }
  const { pre, body, post } = m;
  const p = pre.split(",");
  p[p.length - 1] += "{" + body + "}";
  const postParts = parseCommaParts(post);
  if (post.length) {
    ;
    p[p.length - 1] += postParts.shift();
    p.push.apply(p, postParts);
  }
  parts.push.apply(parts, p);
  return parts;
}
function expand(str) {
  if (!str) {
    return [];
  }
  if (str.slice(0, 2) === "{}") {
    str = "\\{\\}" + str.slice(2);
  }
  return expand_(escapeBraces(str), true).map(unescapeBraces);
}
function embrace(str) {
  return "{" + str + "}";
}
function isPadded(el) {
  return /^-?0\d/.test(el);
}
function lte(i, y) {
  return i <= y;
}
function gte(i, y) {
  return i >= y;
}
function expand_(str, isTop) {
  const expansions = [];
  const m = balanced("{", "}", str);
  if (!m)
    return [str];
  const pre = m.pre;
  const post = m.post.length ? expand_(m.post, false) : [""];
  if (/\$$/.test(m.pre)) {
    for (let k = 0; k < post.length; k++) {
      const expansion = pre + "{" + m.body + "}" + post[k];
      expansions.push(expansion);
    }
  } else {
    const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
    const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
    const isSequence = isNumericSequence || isAlphaSequence;
    const isOptions = m.body.indexOf(",") >= 0;
    if (!isSequence && !isOptions) {
      if (m.post.match(/,(?!,).*\}/)) {
        str = m.pre + "{" + m.body + escClose + m.post;
        return expand_(str);
      }
      return [str];
    }
    let n;
    if (isSequence) {
      n = m.body.split(/\.\./);
    } else {
      n = parseCommaParts(m.body);
      if (n.length === 1 && n[0] !== void 0) {
        n = expand_(n[0], false).map(embrace);
        if (n.length === 1) {
          return post.map((p) => m.pre + n[0] + p);
        }
      }
    }
    let N;
    if (isSequence && n[0] !== void 0 && n[1] !== void 0) {
      const x = numeric(n[0]);
      const y = numeric(n[1]);
      const width = Math.max(n[0].length, n[1].length);
      let incr = n.length === 3 && n[2] !== void 0 ? Math.abs(numeric(n[2])) : 1;
      let test = lte;
      const reverse = y < x;
      if (reverse) {
        incr *= -1;
        test = gte;
      }
      const pad = n.some(isPadded);
      N = [];
      for (let i = x; test(i, y); i += incr) {
        let c;
        if (isAlphaSequence) {
          c = String.fromCharCode(i);
          if (c === "\\") {
            c = "";
          }
        } else {
          c = String(i);
          if (pad) {
            const need = width - c.length;
            if (need > 0) {
              const z = new Array(need + 1).join("0");
              if (i < 0) {
                c = "-" + z + c.slice(1);
              } else {
                c = z + c;
              }
            }
          }
        }
        N.push(c);
      }
    } else {
      N = [];
      for (let j = 0; j < n.length; j++) {
        N.push.apply(N, expand_(n[j], false));
      }
    }
    for (let j = 0; j < N.length; j++) {
      for (let k = 0; k < post.length; k++) {
        const expansion = pre + N[j] + post[k];
        if (!isTop || isSequence || expansion) {
          expansions.push(expansion);
        }
      }
    }
  }
  return expansions;
}

// node_modules/minimatch/dist/esm/assert-valid-pattern.js
var MAX_PATTERN_LENGTH = 1024 * 64;
var assertValidPattern = (pattern) => {
  if (typeof pattern !== "string") {
    throw new TypeError("invalid pattern");
  }
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new TypeError("pattern is too long");
  }
};

// node_modules/minimatch/dist/esm/brace-expressions.js
var posixClasses = {
  "[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true],
  "[:alpha:]": ["\\p{L}\\p{Nl}", true],
  "[:ascii:]": ["\\x00-\\x7f", false],
  "[:blank:]": ["\\p{Zs}\\t", true],
  "[:cntrl:]": ["\\p{Cc}", true],
  "[:digit:]": ["\\p{Nd}", true],
  "[:graph:]": ["\\p{Z}\\p{C}", true, true],
  "[:lower:]": ["\\p{Ll}", true],
  "[:print:]": ["\\p{C}", true],
  "[:punct:]": ["\\p{P}", true],
  "[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true],
  "[:upper:]": ["\\p{Lu}", true],
  "[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true],
  "[:xdigit:]": ["A-Fa-f0-9", false]
};
var braceEscape = (s) => s.replace(/[[\]\\-]/g, "\\$&");
var regexpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var rangesToString = (ranges) => ranges.join("");
var parseClass = (glob, position) => {
  const pos = position;
  if (glob.charAt(pos) !== "[") {
    throw new Error("not in a brace expression");
  }
  const ranges = [];
  const negs = [];
  let i = pos + 1;
  let sawStart = false;
  let uflag = false;
  let escaping = false;
  let negate = false;
  let endPos = pos;
  let rangeStart = "";
  WHILE: while (i < glob.length) {
    const c = glob.charAt(i);
    if ((c === "!" || c === "^") && i === pos + 1) {
      negate = true;
      i++;
      continue;
    }
    if (c === "]" && sawStart && !escaping) {
      endPos = i + 1;
      break;
    }
    sawStart = true;
    if (c === "\\") {
      if (!escaping) {
        escaping = true;
        i++;
        continue;
      }
    }
    if (c === "[" && !escaping) {
      for (const [cls, [unip, u, neg]] of Object.entries(posixClasses)) {
        if (glob.startsWith(cls, i)) {
          if (rangeStart) {
            return ["$.", false, glob.length - pos, true];
          }
          i += cls.length;
          if (neg)
            negs.push(unip);
          else
            ranges.push(unip);
          uflag = uflag || u;
          continue WHILE;
        }
      }
    }
    escaping = false;
    if (rangeStart) {
      if (c > rangeStart) {
        ranges.push(braceEscape(rangeStart) + "-" + braceEscape(c));
      } else if (c === rangeStart) {
        ranges.push(braceEscape(c));
      }
      rangeStart = "";
      i++;
      continue;
    }
    if (glob.startsWith("-]", i + 1)) {
      ranges.push(braceEscape(c + "-"));
      i += 2;
      continue;
    }
    if (glob.startsWith("-", i + 1)) {
      rangeStart = c;
      i += 2;
      continue;
    }
    ranges.push(braceEscape(c));
    i++;
  }
  if (endPos < i) {
    return ["", false, 0, false];
  }
  if (!ranges.length && !negs.length) {
    return ["$.", false, glob.length - pos, true];
  }
  if (negs.length === 0 && ranges.length === 1 && /^\\?.$/.test(ranges[0]) && !negate) {
    const r = ranges[0].length === 2 ? ranges[0].slice(-1) : ranges[0];
    return [regexpEscape(r), false, endPos - pos, false];
  }
  const sranges = "[" + (negate ? "^" : "") + rangesToString(ranges) + "]";
  const snegs = "[" + (negate ? "" : "^") + rangesToString(negs) + "]";
  const comb = ranges.length && negs.length ? "(" + sranges + "|" + snegs + ")" : ranges.length ? sranges : snegs;
  return [comb, uflag, endPos - pos, true];
};

// node_modules/minimatch/dist/esm/unescape.js
var unescape = (s, { windowsPathsNoEscape = false, magicalBraces = true } = {}) => {
  if (magicalBraces) {
    return windowsPathsNoEscape ? s.replace(/\[([^\/\\])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^\/\\])\]/g, "$1$2").replace(/\\([^\/])/g, "$1");
  }
  return windowsPathsNoEscape ? s.replace(/\[([^\/\\{}])\]/g, "$1") : s.replace(/((?!\\).|^)\[([^\/\\{}])\]/g, "$1$2").replace(/\\([^\/{}])/g, "$1");
};

// node_modules/minimatch/dist/esm/ast.js
var types = /* @__PURE__ */ new Set(["!", "?", "+", "*", "@"]);
var isExtglobType = (c) => types.has(c);
var startNoTraversal = "(?!(?:^|/)\\.\\.?(?:$|/))";
var startNoDot = "(?!\\.)";
var addPatternStart = /* @__PURE__ */ new Set(["[", "."]);
var justDots = /* @__PURE__ */ new Set(["..", "."]);
var reSpecials = new Set("().*{}+?[]^$\\!");
var regExpEscape = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var qmark = "[^/]";
var star = qmark + "*?";
var starNoEmpty = qmark + "+?";
var AST = class _AST {
  type;
  #root;
  #hasMagic;
  #uflag = false;
  #parts = [];
  #parent;
  #parentIndex;
  #negs;
  #filledNegs = false;
  #options;
  #toString;
  // set to true if it's an extglob with no children
  // (which really means one child of '')
  #emptyExt = false;
  constructor(type, parent, options = {}) {
    this.type = type;
    if (type)
      this.#hasMagic = true;
    this.#parent = parent;
    this.#root = this.#parent ? this.#parent.#root : this;
    this.#options = this.#root === this ? options : this.#root.#options;
    this.#negs = this.#root === this ? [] : this.#root.#negs;
    if (type === "!" && !this.#root.#filledNegs)
      this.#negs.push(this);
    this.#parentIndex = this.#parent ? this.#parent.#parts.length : 0;
  }
  get hasMagic() {
    if (this.#hasMagic !== void 0)
      return this.#hasMagic;
    for (const p of this.#parts) {
      if (typeof p === "string")
        continue;
      if (p.type || p.hasMagic)
        return this.#hasMagic = true;
    }
    return this.#hasMagic;
  }
  // reconstructs the pattern
  toString() {
    if (this.#toString !== void 0)
      return this.#toString;
    if (!this.type) {
      return this.#toString = this.#parts.map((p) => String(p)).join("");
    } else {
      return this.#toString = this.type + "(" + this.#parts.map((p) => String(p)).join("|") + ")";
    }
  }
  #fillNegs() {
    if (this !== this.#root)
      throw new Error("should only call on root");
    if (this.#filledNegs)
      return this;
    this.toString();
    this.#filledNegs = true;
    let n;
    while (n = this.#negs.pop()) {
      if (n.type !== "!")
        continue;
      let p = n;
      let pp = p.#parent;
      while (pp) {
        for (let i = p.#parentIndex + 1; !pp.type && i < pp.#parts.length; i++) {
          for (const part of n.#parts) {
            if (typeof part === "string") {
              throw new Error("string part in extglob AST??");
            }
            part.copyIn(pp.#parts[i]);
          }
        }
        p = pp;
        pp = p.#parent;
      }
    }
    return this;
  }
  push(...parts) {
    for (const p of parts) {
      if (p === "")
        continue;
      if (typeof p !== "string" && !(p instanceof _AST && p.#parent === this)) {
        throw new Error("invalid part: " + p);
      }
      this.#parts.push(p);
    }
  }
  toJSON() {
    var _a;
    const ret = this.type === null ? this.#parts.slice().map((p) => typeof p === "string" ? p : p.toJSON()) : [this.type, ...this.#parts.map((p) => p.toJSON())];
    if (this.isStart() && !this.type)
      ret.unshift([]);
    if (this.isEnd() && (this === this.#root || this.#root.#filledNegs && ((_a = this.#parent) == null ? void 0 : _a.type) === "!")) {
      ret.push({});
    }
    return ret;
  }
  isStart() {
    var _a;
    if (this.#root === this)
      return true;
    if (!((_a = this.#parent) == null ? void 0 : _a.isStart()))
      return false;
    if (this.#parentIndex === 0)
      return true;
    const p = this.#parent;
    for (let i = 0; i < this.#parentIndex; i++) {
      const pp = p.#parts[i];
      if (!(pp instanceof _AST && pp.type === "!")) {
        return false;
      }
    }
    return true;
  }
  isEnd() {
    var _a, _b, _c;
    if (this.#root === this)
      return true;
    if (((_a = this.#parent) == null ? void 0 : _a.type) === "!")
      return true;
    if (!((_b = this.#parent) == null ? void 0 : _b.isEnd()))
      return false;
    if (!this.type)
      return (_c = this.#parent) == null ? void 0 : _c.isEnd();
    const pl = this.#parent ? this.#parent.#parts.length : 0;
    return this.#parentIndex === pl - 1;
  }
  copyIn(part) {
    if (typeof part === "string")
      this.push(part);
    else
      this.push(part.clone(this));
  }
  clone(parent) {
    const c = new _AST(this.type, parent);
    for (const p of this.#parts) {
      c.copyIn(p);
    }
    return c;
  }
  static #parseAST(str, ast, pos, opt) {
    let escaping = false;
    let inBrace = false;
    let braceStart = -1;
    let braceNeg = false;
    if (ast.type === null) {
      let i2 = pos;
      let acc2 = "";
      while (i2 < str.length) {
        const c = str.charAt(i2++);
        if (escaping || c === "\\") {
          escaping = !escaping;
          acc2 += c;
          continue;
        }
        if (inBrace) {
          if (i2 === braceStart + 1) {
            if (c === "^" || c === "!") {
              braceNeg = true;
            }
          } else if (c === "]" && !(i2 === braceStart + 2 && braceNeg)) {
            inBrace = false;
          }
          acc2 += c;
          continue;
        } else if (c === "[") {
          inBrace = true;
          braceStart = i2;
          braceNeg = false;
          acc2 += c;
          continue;
        }
        if (!opt.noext && isExtglobType(c) && str.charAt(i2) === "(") {
          ast.push(acc2);
          acc2 = "";
          const ext2 = new _AST(c, ast);
          i2 = _AST.#parseAST(str, ext2, i2, opt);
          ast.push(ext2);
          continue;
        }
        acc2 += c;
      }
      ast.push(acc2);
      return i2;
    }
    let i = pos + 1;
    let part = new _AST(null, ast);
    const parts = [];
    let acc = "";
    while (i < str.length) {
      const c = str.charAt(i++);
      if (escaping || c === "\\") {
        escaping = !escaping;
        acc += c;
        continue;
      }
      if (inBrace) {
        if (i === braceStart + 1) {
          if (c === "^" || c === "!") {
            braceNeg = true;
          }
        } else if (c === "]" && !(i === braceStart + 2 && braceNeg)) {
          inBrace = false;
        }
        acc += c;
        continue;
      } else if (c === "[") {
        inBrace = true;
        braceStart = i;
        braceNeg = false;
        acc += c;
        continue;
      }
      if (isExtglobType(c) && str.charAt(i) === "(") {
        part.push(acc);
        acc = "";
        const ext2 = new _AST(c, part);
        part.push(ext2);
        i = _AST.#parseAST(str, ext2, i, opt);
        continue;
      }
      if (c === "|") {
        part.push(acc);
        acc = "";
        parts.push(part);
        part = new _AST(null, ast);
        continue;
      }
      if (c === ")") {
        if (acc === "" && ast.#parts.length === 0) {
          ast.#emptyExt = true;
        }
        part.push(acc);
        acc = "";
        ast.push(...parts, part);
        return i;
      }
      acc += c;
    }
    ast.type = null;
    ast.#hasMagic = void 0;
    ast.#parts = [str.substring(pos - 1)];
    return i;
  }
  static fromGlob(pattern, options = {}) {
    const ast = new _AST(null, void 0, options);
    _AST.#parseAST(pattern, ast, 0, options);
    return ast;
  }
  // returns the regular expression if there's magic, or the unescaped
  // string if not.
  toMMPattern() {
    if (this !== this.#root)
      return this.#root.toMMPattern();
    const glob = this.toString();
    const [re, body, hasMagic, uflag] = this.toRegExpSource();
    const anyMagic = hasMagic || this.#hasMagic || this.#options.nocase && !this.#options.nocaseMagicOnly && glob.toUpperCase() !== glob.toLowerCase();
    if (!anyMagic) {
      return body;
    }
    const flags = (this.#options.nocase ? "i" : "") + (uflag ? "u" : "");
    return Object.assign(new RegExp(`^${re}$`, flags), {
      _src: re,
      _glob: glob
    });
  }
  get options() {
    return this.#options;
  }
  // returns the string match, the regexp source, whether there's magic
  // in the regexp (so a regular expression is required) and whether or
  // not the uflag is needed for the regular expression (for posix classes)
  // TODO: instead of injecting the start/end at this point, just return
  // the BODY of the regexp, along with the start/end portions suitable
  // for binding the start/end in either a joined full-path makeRe context
  // (where we bind to (^|/), or a standalone matchPart context (where
  // we bind to ^, and not /).  Otherwise slashes get duped!
  //
  // In part-matching mode, the start is:
  // - if not isStart: nothing
  // - if traversal possible, but not allowed: ^(?!\.\.?$)
  // - if dots allowed or not possible: ^
  // - if dots possible and not allowed: ^(?!\.)
  // end is:
  // - if not isEnd(): nothing
  // - else: $
  //
  // In full-path matching mode, we put the slash at the START of the
  // pattern, so start is:
  // - if first pattern: same as part-matching mode
  // - if not isStart(): nothing
  // - if traversal possible, but not allowed: /(?!\.\.?(?:$|/))
  // - if dots allowed or not possible: /
  // - if dots possible and not allowed: /(?!\.)
  // end is:
  // - if last pattern, same as part-matching mode
  // - else nothing
  //
  // Always put the (?:$|/) on negated tails, though, because that has to be
  // there to bind the end of the negated pattern portion, and it's easier to
  // just stick it in now rather than try to inject it later in the middle of
  // the pattern.
  //
  // We can just always return the same end, and leave it up to the caller
  // to know whether it's going to be used joined or in parts.
  // And, if the start is adjusted slightly, can do the same there:
  // - if not isStart: nothing
  // - if traversal possible, but not allowed: (?:/|^)(?!\.\.?$)
  // - if dots allowed or not possible: (?:/|^)
  // - if dots possible and not allowed: (?:/|^)(?!\.)
  //
  // But it's better to have a simpler binding without a conditional, for
  // performance, so probably better to return both start options.
  //
  // Then the caller just ignores the end if it's not the first pattern,
  // and the start always gets applied.
  //
  // But that's always going to be $ if it's the ending pattern, or nothing,
  // so the caller can just attach $ at the end of the pattern when building.
  //
  // So the todo is:
  // - better detect what kind of start is needed
  // - return both flavors of starting pattern
  // - attach $ at the end of the pattern when creating the actual RegExp
  //
  // Ah, but wait, no, that all only applies to the root when the first pattern
  // is not an extglob. If the first pattern IS an extglob, then we need all
  // that dot prevention biz to live in the extglob portions, because eg
  // +(*|.x*) can match .xy but not .yx.
  //
  // So, return the two flavors if it's #root and the first child is not an
  // AST, otherwise leave it to the child AST to handle it, and there,
  // use the (?:^|/) style of start binding.
  //
  // Even simplified further:
  // - Since the start for a join is eg /(?!\.) and the start for a part
  // is ^(?!\.), we can just prepend (?!\.) to the pattern (either root
  // or start or whatever) and prepend ^ or / at the Regexp construction.
  toRegExpSource(allowDot) {
    var _a;
    const dot = allowDot ?? !!this.#options.dot;
    if (this.#root === this)
      this.#fillNegs();
    if (!this.type) {
      const noEmpty = this.isStart() && this.isEnd() && !this.#parts.some((s) => typeof s !== "string");
      const src = this.#parts.map((p) => {
        const [re, _, hasMagic, uflag] = typeof p === "string" ? _AST.#parseGlob(p, this.#hasMagic, noEmpty) : p.toRegExpSource(allowDot);
        this.#hasMagic = this.#hasMagic || hasMagic;
        this.#uflag = this.#uflag || uflag;
        return re;
      }).join("");
      let start2 = "";
      if (this.isStart()) {
        if (typeof this.#parts[0] === "string") {
          const dotTravAllowed = this.#parts.length === 1 && justDots.has(this.#parts[0]);
          if (!dotTravAllowed) {
            const aps = addPatternStart;
            const needNoTrav = (
              // dots are allowed, and the pattern starts with [ or .
              dot && aps.has(src.charAt(0)) || // the pattern starts with \., and then [ or .
              src.startsWith("\\.") && aps.has(src.charAt(2)) || // the pattern starts with \.\., and then [ or .
              src.startsWith("\\.\\.") && aps.has(src.charAt(4))
            );
            const needNoDot = !dot && !allowDot && aps.has(src.charAt(0));
            start2 = needNoTrav ? startNoTraversal : needNoDot ? startNoDot : "";
          }
        }
      }
      let end = "";
      if (this.isEnd() && this.#root.#filledNegs && ((_a = this.#parent) == null ? void 0 : _a.type) === "!") {
        end = "(?:$|\\/)";
      }
      const final2 = start2 + src + end;
      return [
        final2,
        unescape(src),
        this.#hasMagic = !!this.#hasMagic,
        this.#uflag
      ];
    }
    const repeated = this.type === "*" || this.type === "+";
    const start = this.type === "!" ? "(?:(?!(?:" : "(?:";
    let body = this.#partsToRegExp(dot);
    if (this.isStart() && this.isEnd() && !body && this.type !== "!") {
      const s = this.toString();
      this.#parts = [s];
      this.type = null;
      this.#hasMagic = void 0;
      return [s, unescape(this.toString()), false, false];
    }
    let bodyDotAllowed = !repeated || allowDot || dot || !startNoDot ? "" : this.#partsToRegExp(true);
    if (bodyDotAllowed === body) {
      bodyDotAllowed = "";
    }
    if (bodyDotAllowed) {
      body = `(?:${body})(?:${bodyDotAllowed})*?`;
    }
    let final = "";
    if (this.type === "!" && this.#emptyExt) {
      final = (this.isStart() && !dot ? startNoDot : "") + starNoEmpty;
    } else {
      const close = this.type === "!" ? (
        // !() must match something,but !(x) can match ''
        "))" + (this.isStart() && !dot && !allowDot ? startNoDot : "") + star + ")"
      ) : this.type === "@" ? ")" : this.type === "?" ? ")?" : this.type === "+" && bodyDotAllowed ? ")" : this.type === "*" && bodyDotAllowed ? `)?` : `)${this.type}`;
      final = start + body + close;
    }
    return [
      final,
      unescape(body),
      this.#hasMagic = !!this.#hasMagic,
      this.#uflag
    ];
  }
  #partsToRegExp(dot) {
    return this.#parts.map((p) => {
      if (typeof p === "string") {
        throw new Error("string type in extglob ast??");
      }
      const [re, _, _hasMagic, uflag] = p.toRegExpSource(dot);
      this.#uflag = this.#uflag || uflag;
      return re;
    }).filter((p) => !(this.isStart() && this.isEnd()) || !!p).join("|");
  }
  static #parseGlob(glob, hasMagic, noEmpty = false) {
    let escaping = false;
    let re = "";
    let uflag = false;
    for (let i = 0; i < glob.length; i++) {
      const c = glob.charAt(i);
      if (escaping) {
        escaping = false;
        re += (reSpecials.has(c) ? "\\" : "") + c;
        continue;
      }
      if (c === "\\") {
        if (i === glob.length - 1) {
          re += "\\\\";
        } else {
          escaping = true;
        }
        continue;
      }
      if (c === "[") {
        const [src, needUflag, consumed, magic] = parseClass(glob, i);
        if (consumed) {
          re += src;
          uflag = uflag || needUflag;
          i += consumed - 1;
          hasMagic = hasMagic || magic;
          continue;
        }
      }
      if (c === "*") {
        re += noEmpty && glob === "*" ? starNoEmpty : star;
        hasMagic = true;
        continue;
      }
      if (c === "?") {
        re += qmark;
        hasMagic = true;
        continue;
      }
      re += regExpEscape(c);
    }
    return [re, unescape(glob), !!hasMagic, uflag];
  }
};

// node_modules/minimatch/dist/esm/escape.js
var escape = (s, { windowsPathsNoEscape = false, magicalBraces = false } = {}) => {
  if (magicalBraces) {
    return windowsPathsNoEscape ? s.replace(/[?*()[\]{}]/g, "[$&]") : s.replace(/[?*()[\]\\{}]/g, "\\$&");
  }
  return windowsPathsNoEscape ? s.replace(/[?*()[\]]/g, "[$&]") : s.replace(/[?*()[\]\\]/g, "\\$&");
};

// node_modules/minimatch/dist/esm/index.js
var minimatch = (p, pattern, options = {}) => {
  assertValidPattern(pattern);
  if (!options.nocomment && pattern.charAt(0) === "#") {
    return false;
  }
  return new Minimatch(pattern, options).match(p);
};
var starDotExtRE = /^\*+([^+@!?\*\[\(]*)$/;
var starDotExtTest = (ext2) => (f) => !f.startsWith(".") && f.endsWith(ext2);
var starDotExtTestDot = (ext2) => (f) => f.endsWith(ext2);
var starDotExtTestNocase = (ext2) => {
  ext2 = ext2.toLowerCase();
  return (f) => !f.startsWith(".") && f.toLowerCase().endsWith(ext2);
};
var starDotExtTestNocaseDot = (ext2) => {
  ext2 = ext2.toLowerCase();
  return (f) => f.toLowerCase().endsWith(ext2);
};
var starDotStarRE = /^\*+\.\*+$/;
var starDotStarTest = (f) => !f.startsWith(".") && f.includes(".");
var starDotStarTestDot = (f) => f !== "." && f !== ".." && f.includes(".");
var dotStarRE = /^\.\*+$/;
var dotStarTest = (f) => f !== "." && f !== ".." && f.startsWith(".");
var starRE = /^\*+$/;
var starTest = (f) => f.length !== 0 && !f.startsWith(".");
var starTestDot = (f) => f.length !== 0 && f !== "." && f !== "..";
var qmarksRE = /^\?+([^+@!?\*\[\(]*)?$/;
var qmarksTestNocase = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExt([$0]);
  if (!ext2)
    return noext;
  ext2 = ext2.toLowerCase();
  return (f) => noext(f) && f.toLowerCase().endsWith(ext2);
};
var qmarksTestNocaseDot = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExtDot([$0]);
  if (!ext2)
    return noext;
  ext2 = ext2.toLowerCase();
  return (f) => noext(f) && f.toLowerCase().endsWith(ext2);
};
var qmarksTestDot = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExtDot([$0]);
  return !ext2 ? noext : (f) => noext(f) && f.endsWith(ext2);
};
var qmarksTest = ([$0, ext2 = ""]) => {
  const noext = qmarksTestNoExt([$0]);
  return !ext2 ? noext : (f) => noext(f) && f.endsWith(ext2);
};
var qmarksTestNoExt = ([$0]) => {
  const len = $0.length;
  return (f) => f.length === len && !f.startsWith(".");
};
var qmarksTestNoExtDot = ([$0]) => {
  const len = $0.length;
  return (f) => f.length === len && f !== "." && f !== "..";
};
var defaultPlatform = typeof process === "object" && process ? typeof process.env === "object" && process.env && process.env.__MINIMATCH_TESTING_PLATFORM__ || process.platform : "posix";
var path7 = {
  win32: { sep: "\\" },
  posix: { sep: "/" }
};
var sep2 = defaultPlatform === "win32" ? path7.win32.sep : path7.posix.sep;
minimatch.sep = sep2;
var GLOBSTAR = Symbol("globstar **");
minimatch.GLOBSTAR = GLOBSTAR;
var qmark2 = "[^/]";
var star2 = qmark2 + "*?";
var twoStarDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";
var twoStarNoDot = "(?:(?!(?:\\/|^)\\.).)*?";
var filter = (pattern, options = {}) => (p) => minimatch(p, pattern, options);
minimatch.filter = filter;
var ext = (a, b = {}) => Object.assign({}, a, b);
var defaults = (def) => {
  if (!def || typeof def !== "object" || !Object.keys(def).length) {
    return minimatch;
  }
  const orig = minimatch;
  const m = (p, pattern, options = {}) => orig(p, pattern, ext(def, options));
  return Object.assign(m, {
    Minimatch: class Minimatch extends orig.Minimatch {
      constructor(pattern, options = {}) {
        super(pattern, ext(def, options));
      }
      static defaults(options) {
        return orig.defaults(ext(def, options)).Minimatch;
      }
    },
    AST: class AST extends orig.AST {
      /* c8 ignore start */
      constructor(type, parent, options = {}) {
        super(type, parent, ext(def, options));
      }
      /* c8 ignore stop */
      static fromGlob(pattern, options = {}) {
        return orig.AST.fromGlob(pattern, ext(def, options));
      }
    },
    unescape: (s, options = {}) => orig.unescape(s, ext(def, options)),
    escape: (s, options = {}) => orig.escape(s, ext(def, options)),
    filter: (pattern, options = {}) => orig.filter(pattern, ext(def, options)),
    defaults: (options) => orig.defaults(ext(def, options)),
    makeRe: (pattern, options = {}) => orig.makeRe(pattern, ext(def, options)),
    braceExpand: (pattern, options = {}) => orig.braceExpand(pattern, ext(def, options)),
    match: (list, pattern, options = {}) => orig.match(list, pattern, ext(def, options)),
    sep: orig.sep,
    GLOBSTAR
  });
};
minimatch.defaults = defaults;
var braceExpand = (pattern, options = {}) => {
  assertValidPattern(pattern);
  if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
    return [pattern];
  }
  return expand(pattern);
};
minimatch.braceExpand = braceExpand;
var makeRe = (pattern, options = {}) => new Minimatch(pattern, options).makeRe();
minimatch.makeRe = makeRe;
var match = (list, pattern, options = {}) => {
  const mm = new Minimatch(pattern, options);
  list = list.filter((f) => mm.match(f));
  if (mm.options.nonull && !list.length) {
    list.push(pattern);
  }
  return list;
};
minimatch.match = match;
var globMagic = /[?*]|[+@!]\(.*?\)|\[|\]/;
var regExpEscape2 = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
var Minimatch = class {
  options;
  set;
  pattern;
  windowsPathsNoEscape;
  nonegate;
  negate;
  comment;
  empty;
  preserveMultipleSlashes;
  partial;
  globSet;
  globParts;
  nocase;
  isWindows;
  platform;
  windowsNoMagicRoot;
  regexp;
  constructor(pattern, options = {}) {
    assertValidPattern(pattern);
    options = options || {};
    this.options = options;
    this.pattern = pattern;
    this.platform = options.platform || defaultPlatform;
    this.isWindows = this.platform === "win32";
    this.windowsPathsNoEscape = !!options.windowsPathsNoEscape || options.allowWindowsEscape === false;
    if (this.windowsPathsNoEscape) {
      this.pattern = this.pattern.replace(/\\/g, "/");
    }
    this.preserveMultipleSlashes = !!options.preserveMultipleSlashes;
    this.regexp = null;
    this.negate = false;
    this.nonegate = !!options.nonegate;
    this.comment = false;
    this.empty = false;
    this.partial = !!options.partial;
    this.nocase = !!this.options.nocase;
    this.windowsNoMagicRoot = options.windowsNoMagicRoot !== void 0 ? options.windowsNoMagicRoot : !!(this.isWindows && this.nocase);
    this.globSet = [];
    this.globParts = [];
    this.set = [];
    this.make();
  }
  hasMagic() {
    if (this.options.magicalBraces && this.set.length > 1) {
      return true;
    }
    for (const pattern of this.set) {
      for (const part of pattern) {
        if (typeof part !== "string")
          return true;
      }
    }
    return false;
  }
  debug(..._) {
  }
  make() {
    const pattern = this.pattern;
    const options = this.options;
    if (!options.nocomment && pattern.charAt(0) === "#") {
      this.comment = true;
      return;
    }
    if (!pattern) {
      this.empty = true;
      return;
    }
    this.parseNegate();
    this.globSet = [...new Set(this.braceExpand())];
    if (options.debug) {
      this.debug = (...args) => console.error(...args);
    }
    this.debug(this.pattern, this.globSet);
    const rawGlobParts = this.globSet.map((s) => this.slashSplit(s));
    this.globParts = this.preprocess(rawGlobParts);
    this.debug(this.pattern, this.globParts);
    let set = this.globParts.map((s, _, __) => {
      if (this.isWindows && this.windowsNoMagicRoot) {
        const isUNC = s[0] === "" && s[1] === "" && (s[2] === "?" || !globMagic.test(s[2])) && !globMagic.test(s[3]);
        const isDrive = /^[a-z]:/i.test(s[0]);
        if (isUNC) {
          return [...s.slice(0, 4), ...s.slice(4).map((ss) => this.parse(ss))];
        } else if (isDrive) {
          return [s[0], ...s.slice(1).map((ss) => this.parse(ss))];
        }
      }
      return s.map((ss) => this.parse(ss));
    });
    this.debug(this.pattern, set);
    this.set = set.filter((s) => s.indexOf(false) === -1);
    if (this.isWindows) {
      for (let i = 0; i < this.set.length; i++) {
        const p = this.set[i];
        if (p[0] === "" && p[1] === "" && this.globParts[i][2] === "?" && typeof p[3] === "string" && /^[a-z]:$/i.test(p[3])) {
          p[2] = "?";
        }
      }
    }
    this.debug(this.pattern, this.set);
  }
  // various transforms to equivalent pattern sets that are
  // faster to process in a filesystem walk.  The goal is to
  // eliminate what we can, and push all ** patterns as far
  // to the right as possible, even if it increases the number
  // of patterns that we have to process.
  preprocess(globParts) {
    if (this.options.noglobstar) {
      for (let i = 0; i < globParts.length; i++) {
        for (let j = 0; j < globParts[i].length; j++) {
          if (globParts[i][j] === "**") {
            globParts[i][j] = "*";
          }
        }
      }
    }
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      globParts = this.firstPhasePreProcess(globParts);
      globParts = this.secondPhasePreProcess(globParts);
    } else if (optimizationLevel >= 1) {
      globParts = this.levelOneOptimize(globParts);
    } else {
      globParts = this.adjascentGlobstarOptimize(globParts);
    }
    return globParts;
  }
  // just get rid of adjascent ** portions
  adjascentGlobstarOptimize(globParts) {
    return globParts.map((parts) => {
      let gs = -1;
      while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
        let i = gs;
        while (parts[i + 1] === "**") {
          i++;
        }
        if (i !== gs) {
          parts.splice(gs, i - gs);
        }
      }
      return parts;
    });
  }
  // get rid of adjascent ** and resolve .. portions
  levelOneOptimize(globParts) {
    return globParts.map((parts) => {
      parts = parts.reduce((set, part) => {
        const prev = set[set.length - 1];
        if (part === "**" && prev === "**") {
          return set;
        }
        if (part === "..") {
          if (prev && prev !== ".." && prev !== "." && prev !== "**") {
            set.pop();
            return set;
          }
        }
        set.push(part);
        return set;
      }, []);
      return parts.length === 0 ? [""] : parts;
    });
  }
  levelTwoFileOptimize(parts) {
    if (!Array.isArray(parts)) {
      parts = this.slashSplit(parts);
    }
    let didSomething = false;
    do {
      didSomething = false;
      if (!this.preserveMultipleSlashes) {
        for (let i = 1; i < parts.length - 1; i++) {
          const p = parts[i];
          if (i === 1 && p === "" && parts[0] === "")
            continue;
          if (p === "." || p === "") {
            didSomething = true;
            parts.splice(i, 1);
            i--;
          }
        }
        if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
          didSomething = true;
          parts.pop();
        }
      }
      let dd = 0;
      while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
        const p = parts[dd - 1];
        if (p && p !== "." && p !== ".." && p !== "**") {
          didSomething = true;
          parts.splice(dd - 1, 2);
          dd -= 2;
        }
      }
    } while (didSomething);
    return parts.length === 0 ? [""] : parts;
  }
  // First phase: single-pattern processing
  // <pre> is 1 or more portions
  // <rest> is 1 or more portions
  // <p> is any portion other than ., .., '', or **
  // <e> is . or ''
  //
  // **/.. is *brutal* for filesystem walking performance, because
  // it effectively resets the recursive walk each time it occurs,
  // and ** cannot be reduced out by a .. pattern part like a regexp
  // or most strings (other than .., ., and '') can be.
  //
  // <pre>/**/../<p>/<p>/<rest> -> {<pre>/../<p>/<p>/<rest>,<pre>/**/<p>/<p>/<rest>}
  // <pre>/<e>/<rest> -> <pre>/<rest>
  // <pre>/<p>/../<rest> -> <pre>/<rest>
  // **/**/<rest> -> **/<rest>
  //
  // **/*/<rest> -> */**/<rest> <== not valid because ** doesn't follow
  // this WOULD be allowed if ** did follow symlinks, or * didn't
  firstPhasePreProcess(globParts) {
    let didSomething = false;
    do {
      didSomething = false;
      for (let parts of globParts) {
        let gs = -1;
        while (-1 !== (gs = parts.indexOf("**", gs + 1))) {
          let gss = gs;
          while (parts[gss + 1] === "**") {
            gss++;
          }
          if (gss > gs) {
            parts.splice(gs + 1, gss - gs);
          }
          let next = parts[gs + 1];
          const p = parts[gs + 2];
          const p2 = parts[gs + 3];
          if (next !== "..")
            continue;
          if (!p || p === "." || p === ".." || !p2 || p2 === "." || p2 === "..") {
            continue;
          }
          didSomething = true;
          parts.splice(gs, 1);
          const other = parts.slice(0);
          other[gs] = "**";
          globParts.push(other);
          gs--;
        }
        if (!this.preserveMultipleSlashes) {
          for (let i = 1; i < parts.length - 1; i++) {
            const p = parts[i];
            if (i === 1 && p === "" && parts[0] === "")
              continue;
            if (p === "." || p === "") {
              didSomething = true;
              parts.splice(i, 1);
              i--;
            }
          }
          if (parts[0] === "." && parts.length === 2 && (parts[1] === "." || parts[1] === "")) {
            didSomething = true;
            parts.pop();
          }
        }
        let dd = 0;
        while (-1 !== (dd = parts.indexOf("..", dd + 1))) {
          const p = parts[dd - 1];
          if (p && p !== "." && p !== ".." && p !== "**") {
            didSomething = true;
            const needDot = dd === 1 && parts[dd + 1] === "**";
            const splin = needDot ? ["."] : [];
            parts.splice(dd - 1, 2, ...splin);
            if (parts.length === 0)
              parts.push("");
            dd -= 2;
          }
        }
      }
    } while (didSomething);
    return globParts;
  }
  // second phase: multi-pattern dedupes
  // {<pre>/*/<rest>,<pre>/<p>/<rest>} -> <pre>/*/<rest>
  // {<pre>/<rest>,<pre>/<rest>} -> <pre>/<rest>
  // {<pre>/**/<rest>,<pre>/<rest>} -> <pre>/**/<rest>
  //
  // {<pre>/**/<rest>,<pre>/**/<p>/<rest>} -> <pre>/**/<rest>
  // ^-- not valid because ** doens't follow symlinks
  secondPhasePreProcess(globParts) {
    for (let i = 0; i < globParts.length - 1; i++) {
      for (let j = i + 1; j < globParts.length; j++) {
        const matched = this.partsMatch(globParts[i], globParts[j], !this.preserveMultipleSlashes);
        if (matched) {
          globParts[i] = [];
          globParts[j] = matched;
          break;
        }
      }
    }
    return globParts.filter((gs) => gs.length);
  }
  partsMatch(a, b, emptyGSMatch = false) {
    let ai = 0;
    let bi = 0;
    let result = [];
    let which = "";
    while (ai < a.length && bi < b.length) {
      if (a[ai] === b[bi]) {
        result.push(which === "b" ? b[bi] : a[ai]);
        ai++;
        bi++;
      } else if (emptyGSMatch && a[ai] === "**" && b[bi] === a[ai + 1]) {
        result.push(a[ai]);
        ai++;
      } else if (emptyGSMatch && b[bi] === "**" && a[ai] === b[bi + 1]) {
        result.push(b[bi]);
        bi++;
      } else if (a[ai] === "*" && b[bi] && (this.options.dot || !b[bi].startsWith(".")) && b[bi] !== "**") {
        if (which === "b")
          return false;
        which = "a";
        result.push(a[ai]);
        ai++;
        bi++;
      } else if (b[bi] === "*" && a[ai] && (this.options.dot || !a[ai].startsWith(".")) && a[ai] !== "**") {
        if (which === "a")
          return false;
        which = "b";
        result.push(b[bi]);
        ai++;
        bi++;
      } else {
        return false;
      }
    }
    return a.length === b.length && result;
  }
  parseNegate() {
    if (this.nonegate)
      return;
    const pattern = this.pattern;
    let negate = false;
    let negateOffset = 0;
    for (let i = 0; i < pattern.length && pattern.charAt(i) === "!"; i++) {
      negate = !negate;
      negateOffset++;
    }
    if (negateOffset)
      this.pattern = pattern.slice(negateOffset);
    this.negate = negate;
  }
  // set partial to true to test if, for example,
  // "/a/b" matches the start of "/*/b/*/d"
  // Partial means, if you run out of file before you run
  // out of pattern, then that's fine, as long as all
  // the parts match.
  matchOne(file, pattern, partial = false) {
    const options = this.options;
    if (this.isWindows) {
      const fileDrive = typeof file[0] === "string" && /^[a-z]:$/i.test(file[0]);
      const fileUNC = !fileDrive && file[0] === "" && file[1] === "" && file[2] === "?" && /^[a-z]:$/i.test(file[3]);
      const patternDrive = typeof pattern[0] === "string" && /^[a-z]:$/i.test(pattern[0]);
      const patternUNC = !patternDrive && pattern[0] === "" && pattern[1] === "" && pattern[2] === "?" && typeof pattern[3] === "string" && /^[a-z]:$/i.test(pattern[3]);
      const fdi = fileUNC ? 3 : fileDrive ? 0 : void 0;
      const pdi = patternUNC ? 3 : patternDrive ? 0 : void 0;
      if (typeof fdi === "number" && typeof pdi === "number") {
        const [fd, pd] = [file[fdi], pattern[pdi]];
        if (fd.toLowerCase() === pd.toLowerCase()) {
          pattern[pdi] = fd;
          if (pdi > fdi) {
            pattern = pattern.slice(pdi);
          } else if (fdi > pdi) {
            file = file.slice(fdi);
          }
        }
      }
    }
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      file = this.levelTwoFileOptimize(file);
    }
    this.debug("matchOne", this, { file, pattern });
    this.debug("matchOne", file.length, pattern.length);
    for (var fi = 0, pi = 0, fl = file.length, pl = pattern.length; fi < fl && pi < pl; fi++, pi++) {
      this.debug("matchOne loop");
      var p = pattern[pi];
      var f = file[fi];
      this.debug(pattern, p, f);
      if (p === false) {
        return false;
      }
      if (p === GLOBSTAR) {
        this.debug("GLOBSTAR", [pattern, p, f]);
        var fr = fi;
        var pr = pi + 1;
        if (pr === pl) {
          this.debug("** at the end");
          for (; fi < fl; fi++) {
            if (file[fi] === "." || file[fi] === ".." || !options.dot && file[fi].charAt(0) === ".")
              return false;
          }
          return true;
        }
        while (fr < fl) {
          var swallowee = file[fr];
          this.debug("\nglobstar while", file, fr, pattern, pr, swallowee);
          if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
            this.debug("globstar found match!", fr, fl, swallowee);
            return true;
          } else {
            if (swallowee === "." || swallowee === ".." || !options.dot && swallowee.charAt(0) === ".") {
              this.debug("dot detected!", file, fr, pattern, pr);
              break;
            }
            this.debug("globstar swallow a segment, and continue");
            fr++;
          }
        }
        if (partial) {
          this.debug("\n>>> no match, partial?", file, fr, pattern, pr);
          if (fr === fl) {
            return true;
          }
        }
        return false;
      }
      let hit;
      if (typeof p === "string") {
        hit = f === p;
        this.debug("string match", p, f, hit);
      } else {
        hit = p.test(f);
        this.debug("pattern match", p, f, hit);
      }
      if (!hit)
        return false;
    }
    if (fi === fl && pi === pl) {
      return true;
    } else if (fi === fl) {
      return partial;
    } else if (pi === pl) {
      return fi === fl - 1 && file[fi] === "";
    } else {
      throw new Error("wtf?");
    }
  }
  braceExpand() {
    return braceExpand(this.pattern, this.options);
  }
  parse(pattern) {
    assertValidPattern(pattern);
    const options = this.options;
    if (pattern === "**")
      return GLOBSTAR;
    if (pattern === "")
      return "";
    let m;
    let fastTest = null;
    if (m = pattern.match(starRE)) {
      fastTest = options.dot ? starTestDot : starTest;
    } else if (m = pattern.match(starDotExtRE)) {
      fastTest = (options.nocase ? options.dot ? starDotExtTestNocaseDot : starDotExtTestNocase : options.dot ? starDotExtTestDot : starDotExtTest)(m[1]);
    } else if (m = pattern.match(qmarksRE)) {
      fastTest = (options.nocase ? options.dot ? qmarksTestNocaseDot : qmarksTestNocase : options.dot ? qmarksTestDot : qmarksTest)(m);
    } else if (m = pattern.match(starDotStarRE)) {
      fastTest = options.dot ? starDotStarTestDot : starDotStarTest;
    } else if (m = pattern.match(dotStarRE)) {
      fastTest = dotStarTest;
    }
    const re = AST.fromGlob(pattern, this.options).toMMPattern();
    if (fastTest && typeof re === "object") {
      Reflect.defineProperty(re, "test", { value: fastTest });
    }
    return re;
  }
  makeRe() {
    if (this.regexp || this.regexp === false)
      return this.regexp;
    const set = this.set;
    if (!set.length) {
      this.regexp = false;
      return this.regexp;
    }
    const options = this.options;
    const twoStar = options.noglobstar ? star2 : options.dot ? twoStarDot : twoStarNoDot;
    const flags = new Set(options.nocase ? ["i"] : []);
    let re = set.map((pattern) => {
      const pp = pattern.map((p) => {
        if (p instanceof RegExp) {
          for (const f of p.flags.split(""))
            flags.add(f);
        }
        return typeof p === "string" ? regExpEscape2(p) : p === GLOBSTAR ? GLOBSTAR : p._src;
      });
      pp.forEach((p, i) => {
        const next = pp[i + 1];
        const prev = pp[i - 1];
        if (p !== GLOBSTAR || prev === GLOBSTAR) {
          return;
        }
        if (prev === void 0) {
          if (next !== void 0 && next !== GLOBSTAR) {
            pp[i + 1] = "(?:\\/|" + twoStar + "\\/)?" + next;
          } else {
            pp[i] = twoStar;
          }
        } else if (next === void 0) {
          pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + ")?";
        } else if (next !== GLOBSTAR) {
          pp[i - 1] = prev + "(?:\\/|\\/" + twoStar + "\\/)" + next;
          pp[i + 1] = GLOBSTAR;
        }
      });
      const filtered = pp.filter((p) => p !== GLOBSTAR);
      if (this.partial && filtered.length >= 1) {
        const prefixes = [];
        for (let i = 1; i <= filtered.length; i++) {
          prefixes.push(filtered.slice(0, i).join("/"));
        }
        return "(?:" + prefixes.join("|") + ")";
      }
      return filtered.join("/");
    }).join("|");
    const [open, close] = set.length > 1 ? ["(?:", ")"] : ["", ""];
    re = "^" + open + re + close + "$";
    if (this.partial) {
      re = "^(?:\\/|" + open + re.slice(1, -1) + close + ")$";
    }
    if (this.negate)
      re = "^(?!" + re + ").+$";
    try {
      this.regexp = new RegExp(re, [...flags].join(""));
    } catch (ex) {
      this.regexp = false;
    }
    return this.regexp;
  }
  slashSplit(p) {
    if (this.preserveMultipleSlashes) {
      return p.split("/");
    } else if (this.isWindows && /^\/\/[^\/]+/.test(p)) {
      return ["", ...p.split(/\/+/)];
    } else {
      return p.split(/\/+/);
    }
  }
  match(f, partial = this.partial) {
    this.debug("match", f, this.pattern);
    if (this.comment) {
      return false;
    }
    if (this.empty) {
      return f === "";
    }
    if (f === "/" && partial) {
      return true;
    }
    const options = this.options;
    if (this.isWindows) {
      f = f.split("\\").join("/");
    }
    const ff = this.slashSplit(f);
    this.debug(this.pattern, "split", ff);
    const set = this.set;
    this.debug(this.pattern, "set", set);
    let filename = ff[ff.length - 1];
    if (!filename) {
      for (let i = ff.length - 2; !filename && i >= 0; i--) {
        filename = ff[i];
      }
    }
    for (let i = 0; i < set.length; i++) {
      const pattern = set[i];
      let file = ff;
      if (options.matchBase && pattern.length === 1) {
        file = [filename];
      }
      const hit = this.matchOne(file, pattern, partial);
      if (hit) {
        if (options.flipNegate) {
          return true;
        }
        return !this.negate;
      }
    }
    if (options.flipNegate) {
      return false;
    }
    return this.negate;
  }
  static defaults(def) {
    return minimatch.defaults(def).Minimatch;
  }
};
minimatch.AST = AST;
minimatch.Minimatch = Minimatch;
minimatch.escape = escape;
minimatch.unescape = unescape;

// src/util/globMatch.ts
function matchAll(path30, patterns, opts = {}) {
  let match3 = false;
  patterns.forEach((pattern) => {
    const isExclusion = pattern[0] === "!";
    if (match3 !== isExclusion) {
      return;
    }
    match3 = minimatch(path30, pattern, opts);
  });
  return match3;
}
function match2(pattern) {
  return new Minimatch(pattern);
}

// src/parser/diffParser.ts
var xml2js5 = __toESM(require_xml2js());
async function parseDiffXml(content) {
  return new Promise((resolve2, reject) => {
    xml2js5.parseString(
      content,
      xml2jsParseSettings,
      (err, result) => {
        if (err || !result.paths || !result.paths.path) {
          reject();
        }
        if (!Array.isArray(result.paths.path)) {
          result.paths.path = [result.paths.path];
        }
        resolve2(result.paths.path);
      }
    );
  });
}

// src/validation/index.ts
function validateChangelist(name) {
  if (!name || typeof name !== "string") {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(name);
}
var VALID_ACCEPT_ACTIONS = [
  "postpone",
  "base",
  "mine-conflict",
  "theirs-conflict",
  "mine-full",
  "theirs-full",
  "edit",
  "launch",
  "working"
];
function validateAcceptAction(action) {
  if (!action || typeof action !== "string") {
    return false;
  }
  return VALID_ACCEPT_ACTIONS.includes(action);
}
function validateSearchPattern(pattern) {
  if (!pattern || typeof pattern !== "string") {
    return false;
  }
  return !/[|;$()[\]{}`\\]/.test(pattern);
}
var VALID_REVISION_KEYWORDS = ["HEAD", "PREV", "BASE", "COMMITTED"];
function validateRevision(revision) {
  if (!revision || typeof revision !== "string") {
    return false;
  }
  if (VALID_REVISION_KEYWORDS.includes(revision)) {
    return true;
  }
  return /^\+?(0|[1-9]\d*)$/.test(revision);
}
function validateRepositoryUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }
  const allowedProtocols = ["http:", "https:", "svn:", "svn+ssh:"];
  try {
    const parsed = new URL(url);
    if (!allowedProtocols.includes(parsed.protocol)) {
      return false;
    }
    if (/[;&|`$()]/.test(parsed.hostname) || /[;&|`$()]/.test(parsed.pathname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// src/svnRepository.ts
var Repository = class {
  constructor(svn, root, workspaceRoot, policy) {
    this.svn = svn;
    this.root = root;
    this.workspaceRoot = workspaceRoot;
    this._infoCache = {};
    if (policy === 1 /* LateInit */) {
      return (async () => {
        return this;
      })();
    }
    return (async () => {
      await this.updateInfo();
      return this;
    })();
  }
  async updateInfo() {
    const result = await this.exec([
      "info",
      "--xml",
      fixPegRevision(this.workspaceRoot ? this.workspaceRoot : this.root)
    ]);
    this._info = await parseInfoXml(result.stdout);
  }
  async exec(args, options = {}) {
    options.username = this.username;
    options.password = this.password;
    return this.svn.exec(this.workspaceRoot, args, options);
  }
  async execBuffer(args, options = {}) {
    options.username = this.username;
    options.password = this.password;
    return this.svn.execBuffer(this.workspaceRoot, args, options);
  }
  removeAbsolutePath(file) {
    file = fixPathSeparator(file);
    file = path8.relative(this.workspaceRoot, file);
    if (file === "") {
      file = ".";
    }
    return fixPegRevision(file);
  }
  async getStatus(params) {
    var _a;
    params = Object.assign(
      {},
      {
        includeIgnored: false,
        includeExternals: true,
        checkRemoteChanges: false
      },
      params
    );
    const args = ["stat", "--xml"];
    if (params.includeIgnored) {
      args.push("--no-ignore");
    }
    if (!params.includeExternals) {
      args.push("--ignore-externals");
    }
    if (params.checkRemoteChanges) {
      args.push("--show-updates");
    }
    const result = await this.exec(args);
    const status = await parseStatusXml(result.stdout);
    for (const s of status) {
      if (s.status === "external" /* EXTERNAL */) {
        try {
          const info = await this.getInfo(s.path);
          s.repositoryUuid = (_a = info.repository) == null ? void 0 : _a.uuid;
        } catch (error) {
          console.error(error);
        }
      }
    }
    return status;
  }
  get info() {
    return unwrap(this._info);
  }
  resetInfoCache(file = "") {
    delete this._infoCache[file];
  }
  async getInfo(file = "", revision, skipCache = false, isUrl = false) {
    if (!skipCache && this._infoCache[file]) {
      return this._infoCache[file];
    }
    const args = ["info", "--xml"];
    if (revision) {
      args.push("-r", revision);
    }
    if (file) {
      if (!isUrl) {
        file = fixPathSeparator(file);
      }
      args.push(file);
    }
    const result = await this.exec(args);
    this._infoCache[file] = await parseInfoXml(result.stdout);
    setTimeout(() => {
      this.resetInfoCache(file);
    }, 2 * 60 * 1e3);
    return this._infoCache[file];
  }
  async getChanges() {
    var _a;
    let args = [
      "log",
      "-r1:HEAD",
      "--limit=1",
      "--stop-on-copy",
      "--xml",
      "--with-all-revprops",
      "--verbose"
    ];
    let result = await this.exec(args);
    const entries = await parseSvnLog(result.stdout);
    if (entries.length === 0 || ((_a = entries[0]) == null ? void 0 : _a.paths.length) === 0) {
      return [];
    }
    const copyCommitPath = entries[0].paths[0];
    if (copyCommitPath.copyfromRev === void 0 || copyCommitPath.copyfromPath === void 0 || copyCommitPath._ === void 0 || copyCommitPath.copyfromRev.trim().length === 0 || copyCommitPath.copyfromPath.trim().length === 0 || copyCommitPath._.trim().length === 0) {
      return [];
    }
    const copyFromPath = copyCommitPath.copyfromPath;
    const copyFromRev = copyCommitPath.copyfromRev;
    const copyToPath = copyCommitPath._;
    const copyFromUrl = this.info.repository.root + copyFromPath;
    const copyToUrl = this.info.repository.root + copyToPath;
    args = ["mergeinfo", "--show-revs=merged", copyFromUrl, copyToUrl];
    result = await this.exec(args);
    const revisions = result.stdout.trim().split("\n");
    let latestMergedRevision = "";
    if (revisions.length) {
      latestMergedRevision = revisions[revisions.length - 1];
    }
    if (latestMergedRevision.trim().length === 0) {
      latestMergedRevision = copyFromRev;
    }
    const info = await this.getInfo(copyToUrl, void 0, true, true);
    args = [
      "diff",
      `${copyFromUrl}@${latestMergedRevision}`,
      copyToUrl,
      "--ignore-properties",
      "--xml",
      "--summarize"
    ];
    result = await this.exec(args);
    let paths;
    try {
      paths = await parseDiffXml(result.stdout);
    } catch (err) {
      return [];
    }
    const changes = [];
    for (const path30 of paths) {
      changes.push({
        oldPath: import_vscode13.Uri.parse(path30._),
        newPath: import_vscode13.Uri.parse(path30._.replace(copyFromUrl, copyToUrl)),
        oldRevision: latestMergedRevision.replace("r", ""),
        newRevision: info.revision,
        item: path30.item,
        props: path30.props,
        kind: path30.kind,
        repo: import_vscode13.Uri.parse(this.info.repository.root),
        localPath: import_vscode13.Uri.parse(path30._.replace(copyFromUrl, ""))
      });
    }
    return changes;
  }
  async show(file, revision) {
    const args = ["cat"];
    let uri;
    let filePath;
    if (file instanceof import_vscode13.Uri) {
      uri = file;
      filePath = file.toString(true);
    } else {
      uri = import_vscode13.Uri.file(file);
      filePath = file;
    }
    const isChild = uri.scheme === "file" && isDescendant(this.workspaceRoot, uri.fsPath);
    let target = filePath;
    if (isChild) {
      target = this.removeAbsolutePath(target);
    }
    if (revision) {
      args.push("-r", revision);
      if (isChild && !["BASE", "COMMITTED", "PREV"].includes(revision.toUpperCase())) {
        const info = await this.getInfo();
        target = info.url + "/" + target.replace(/\\/g, "/");
      }
    }
    args.push(target);
    const configs = import_vscode13.workspace.getConfiguration("files", uri);
    let encoding = configs.get("encoding");
    let autoGuessEncoding = configs.get(
      "autoGuessEncoding",
      false
    );
    const textDocument = import_vscode13.workspace.textDocuments.find(
      (doc) => normalizePath(doc.uri.fsPath) === normalizePath(filePath)
    );
    if (textDocument) {
      const languageConfigs = import_vscode13.workspace.getConfiguration(
        `[${textDocument.languageId}]`,
        uri
      );
      if (languageConfigs["files.encoding"] !== void 0) {
        encoding = languageConfigs["files.encoding"];
      }
      if (languageConfigs["files.autoGuessEncoding"] !== void 0) {
        autoGuessEncoding = languageConfigs["files.autoGuessEncoding"];
      }
      if (autoGuessEncoding) {
        const buffer = Buffer.from(textDocument.getText(), "utf-8");
        const detectedEncoding = detectEncoding(buffer);
        if (detectedEncoding) {
          encoding = detectedEncoding;
        }
      }
    } else {
      const svnEncoding = configuration.get("default.encoding");
      if (svnEncoding) {
        encoding = svnEncoding;
      }
    }
    const experimental = configuration.get(
      "experimental.detect_encoding",
      false
    );
    if (experimental) {
      encoding = null;
    }
    const result = await this.exec(args, { encoding });
    return result.stdout;
  }
  async showBuffer(file, revision) {
    const args = ["cat"];
    let uri;
    let filePath;
    if (file instanceof import_vscode13.Uri) {
      uri = file;
      filePath = file.toString(true);
    } else {
      uri = import_vscode13.Uri.file(file);
      filePath = file;
    }
    const isChild = uri.scheme === "file" && isDescendant(this.workspaceRoot, uri.fsPath);
    let target = filePath;
    if (isChild) {
      target = this.removeAbsolutePath(target);
    }
    if (revision) {
      args.push("-r", revision);
      if (isChild && !["BASE", "COMMITTED", "PREV"].includes(revision.toUpperCase())) {
        const info = await this.getInfo();
        target = info.url + "/" + target.replace(/\\/g, "/");
      }
    }
    args.push(target);
    const result = await this.execBuffer(args);
    return result.stdout;
  }
  async commitFiles(message, files) {
    files = files.map((file) => this.removeAbsolutePath(file));
    const args = ["commit", ...files];
    if (await exists(path8.join(this.workspaceRoot, message))) {
      args.push("--force-log");
    }
    let tmpFile;
    if (/\n|[^\x00-\x7F\x80-\xFF]/.test(message)) {
      tmp.setGracefulCleanup();
      tmpFile = tmp.fileSync({
        prefix: "svn-commit-message-"
      });
      await writeFile(tmpFile.name, message, { encoding: "utf-8" });
      args.push("-F", tmpFile.name);
      args.push("--encoding", "UTF-8");
    } else {
      args.push("-m", message);
    }
    args.push("--depth", "empty");
    const result = await this.exec(args);
    if (tmpFile) {
      tmpFile.removeCallback();
    }
    const matches = result.stdout.match(/Committed revision (.*)\./i);
    if (matches && matches[0]) {
      const sendedFiles = (result.stdout.match(/(Sending|Adding|Deleting)\s+/g) ?? []).length;
      const filesMessage = `${sendedFiles} ${sendedFiles === 1 ? "file" : "files"} commited`;
      return `${filesMessage}: revision ${matches[1]}.`;
    }
    return result.stdout;
  }
  async addFilesByIgnore(files, ignoreList) {
    const allFiles = async (file) => {
      if ((await stat(file)).isDirectory()) {
        return (await Promise.all(
          (await readdir(file)).map((subfile) => {
            const abspath = path8.resolve(file + path8.sep + subfile);
            const relpath = this.removeAbsolutePath(abspath);
            if (!matchAll(path8.sep + relpath, ignoreList, {
              dot: true,
              matchBase: true
            })) {
              return allFiles(abspath);
            }
            return [];
          })
        )).reduce((acc, cur) => acc.concat(cur), [file]);
      }
      return [file];
    };
    files = (await Promise.all(files.map((file) => allFiles(file)))).flat();
    files = files.map((file) => this.removeAbsolutePath(file));
    return this.exec(["add", "--depth=empty", ...files]);
  }
  addFiles(files) {
    const ignoreList = configuration.get("sourceControl.ignore");
    if (ignoreList.length > 0) {
      return this.addFilesByIgnore(files, ignoreList);
    }
    files = files.map((file) => this.removeAbsolutePath(file));
    return this.exec(["add", ...files]);
  }
  addChangelist(files, changelist) {
    if (!validateChangelist(changelist)) {
      throw new Error("Invalid changelist name");
    }
    files = files.map((file) => this.removeAbsolutePath(file));
    return this.exec(["changelist", changelist, ...files]);
  }
  removeChangelist(files) {
    files = files.map((file) => this.removeAbsolutePath(file));
    return this.exec(["changelist", "--remove", ...files]);
  }
  async getCurrentBranch() {
    const info = await this.getInfo();
    const branch = getBranchName(info.url);
    if (branch) {
      const showFullName = configuration.get("layout.showFullName");
      if (showFullName) {
        return branch.path;
      } else {
        return branch.name;
      }
    }
    return "";
  }
  async getRepositoryUuid() {
    const info = await this.getInfo();
    return info.repository.uuid;
  }
  async getRepoUrl() {
    const info = await this.getInfo();
    const branch = getBranchName(info.url);
    if (!branch) {
      return info.repository.root;
    }
    const regex = new RegExp(branch.path + "$");
    return info.url.replace(regex, "").replace(/\/$/, "");
  }
  async getBranches() {
    const trunkLayout = configuration.get("layout.trunk");
    const branchesLayout = configuration.get("layout.branches");
    const tagsLayout = configuration.get("layout.tags");
    const repoUrl = await this.getRepoUrl();
    const branches = [];
    const promises = [];
    if (trunkLayout) {
      promises.push(
        new Promise(async (resolve2) => {
          try {
            await this.exec([
              "ls",
              repoUrl + "/" + trunkLayout,
              "--depth",
              "empty"
            ]);
            resolve2([trunkLayout]);
          } catch (error) {
            resolve2([]);
          }
        })
      );
    }
    const trees = [];
    if (branchesLayout) {
      trees.push(branchesLayout);
    }
    if (tagsLayout) {
      trees.push(tagsLayout);
    }
    for (const tree of trees) {
      promises.push(
        new Promise(async (resolve2) => {
          const branchUrl = repoUrl + "/" + tree;
          try {
            const result = await this.exec(["ls", branchUrl]);
            const list = result.stdout.trim().replace(/\/|\\/g, "").split(/[\r\n]+/).filter((x) => !!x).map((i) => tree + "/" + i);
            resolve2(list);
          } catch (error) {
            resolve2([]);
          }
        })
      );
    }
    const all = await Promise.all(promises);
    all.forEach((list) => {
      branches.push(...list);
    });
    return branches;
  }
  async newBranch(name, commitMessage = "Created new branch") {
    const repoUrl = await this.getRepoUrl();
    const newBranch = repoUrl + "/" + name;
    const info = await this.getInfo();
    const currentBranch = info.url;
    await this.exec(["copy", currentBranch, newBranch, "-m", commitMessage]);
    await this.switchBranch(name);
    return true;
  }
  async switchBranch(ref, force = false) {
    const repoUrl = await this.getRepoUrl();
    const branchUrl = repoUrl + "/" + ref;
    await this.exec(
      ["switch", branchUrl].concat(force ? ["--ignore-ancestry"] : [])
    );
    this.resetInfoCache();
    return true;
  }
  async merge(ref, reintegrate = false, accept_action = "postpone") {
    if (!validateAcceptAction(accept_action)) {
      throw new Error("Invalid accept action");
    }
    const repoUrl = await this.getRepoUrl();
    const branchUrl = repoUrl + "/" + ref;
    let args = ["merge", "--accept", accept_action];
    args = args.concat(reintegrate ? ["--reintegrate"] : []);
    args = args.concat([branchUrl]);
    await this.exec(args);
    this.resetInfoCache();
    return true;
  }
  async revert(files, depth) {
    files = files.map((file) => this.removeAbsolutePath(file));
    const result = await this.exec(["revert", "--depth", depth, ...files]);
    return result.stdout;
  }
  async update(ignoreExternals = true) {
    const args = ["update"];
    if (ignoreExternals) {
      args.push("--ignore-externals");
    }
    const result = await this.exec(args);
    this.resetInfoCache();
    const message = result.stdout.trim().split(/\r?\n/).pop();
    if (message) {
      return message;
    }
    return result.stdout;
  }
  async pullIncomingChange(path30) {
    const args = ["update", path30];
    const result = await this.exec(args);
    this.resetInfoCache();
    const message = result.stdout.trim().split(/\r?\n/).pop();
    if (message) {
      return message;
    }
    return result.stdout;
  }
  async patch(files) {
    files = files.map((file) => this.removeAbsolutePath(file));
    const result = await this.exec(["diff", "--internal-diff", ...files]);
    const message = result.stdout;
    return message;
  }
  async patchBuffer(files) {
    files = files.map((file) => this.removeAbsolutePath(file));
    const result = await this.execBuffer(["diff", "--internal-diff", ...files]);
    const message = result.stdout;
    return message;
  }
  async patchChangelist(changelistName) {
    const result = await this.exec([
      "diff",
      "--internal-diff",
      "--changelist",
      changelistName
    ]);
    const message = result.stdout;
    return message;
  }
  async removeFiles(files, keepLocal) {
    files = files.map((file) => this.removeAbsolutePath(file));
    const args = ["remove"];
    if (keepLocal) {
      args.push("--keep-local");
    }
    args.push(...files);
    const result = await this.exec(args);
    return result.stdout;
  }
  async resolve(files, action) {
    files = files.map((file) => this.removeAbsolutePath(file));
    const result = await this.exec(["resolve", "--accept", action, ...files]);
    return result.stdout;
  }
  async plainLog() {
    const logLength = configuration.get("log.length") ?? "50";
    const result = await this.exec([
      "log",
      "-r",
      "HEAD:1",
      "--limit",
      logLength
    ]);
    return result.stdout;
  }
  async plainLogBuffer() {
    const logLength = configuration.get("log.length") ?? "50";
    const result = await this.execBuffer([
      "log",
      "-r",
      "HEAD:1",
      "--limit",
      logLength
    ]);
    return result.stdout;
  }
  async plainLogByRevision(revision) {
    const result = await this.exec(["log", "-r", revision.toString()]);
    return result.stdout;
  }
  async plainLogByRevisionBuffer(revision) {
    const result = await this.execBuffer(["log", "-r", revision.toString()]);
    return result.stdout;
  }
  async plainLogByText(search) {
    if (!validateSearchPattern(search)) {
      throw new Error("Invalid search pattern");
    }
    const result = await this.exec(["log", "--search", search]);
    return result.stdout;
  }
  async plainLogByTextBuffer(search) {
    if (!validateSearchPattern(search)) {
      throw new Error("Invalid search pattern");
    }
    const result = await this.execBuffer(["log", "--search", search]);
    return result.stdout;
  }
  async log(rfrom, rto, limit, target) {
    const args = [
      "log",
      "-r",
      `${rfrom}:${rto}`,
      `--limit=${limit}`,
      "--xml",
      "-v"
    ];
    if (target !== void 0) {
      args.push(
        fixPegRevision(target instanceof import_vscode13.Uri ? target.toString(true) : target)
      );
    }
    const result = await this.exec(args);
    return parseSvnLog(result.stdout);
  }
  async logByUser(user) {
    const result = await this.exec(["log", "--xml", "-v", "--search", user]);
    return parseSvnLog(result.stdout);
  }
  async countNewCommit(revision = "BASE:HEAD") {
    const result = await this.exec(["log", "-r", revision, "-q", "--xml"]);
    const matches = result.stdout.match(/<logentry/g);
    if (matches && matches.length > 0) {
      return matches.length - 1;
    }
    return 0;
  }
  async cleanup() {
    const result = await this.exec(["cleanup"]);
    return result.stdout;
  }
  async removeUnversioned() {
    const result = await this.exec(["cleanup", "--remove-unversioned"]);
    this.svn.logOutput(result.stdout);
    return result.stdout;
  }
  async finishCheckout() {
    const info = await this.getInfo();
    const result = await this.exec(["switch", info.url]);
    return result.stdout;
  }
  async list(folder) {
    let url = await this.getRepoUrl();
    if (folder) {
      url += "/" + folder;
    }
    const result = await this.exec(["list", url, "--xml"]);
    return parseSvnList(result.stdout);
  }
  async ls(file) {
    const result = await this.exec(["list", file, "--xml"]);
    return parseSvnList(result.stdout);
  }
  async getCurrentIgnore(directory) {
    directory = this.removeAbsolutePath(directory);
    let currentIgnore = "";
    try {
      const args = ["propget", "svn:ignore"];
      if (directory) {
        args.push(directory);
      }
      const currentIgnoreResult = await this.exec(args);
      currentIgnore = currentIgnoreResult.stdout.trim();
    } catch (error) {
      console.error(error);
    }
    const ignores = currentIgnore.split(/[\r\n]+/);
    return ignores;
  }
  async addToIgnore(expressions, directory, recursive = false) {
    const ignores = await this.getCurrentIgnore(directory);
    directory = this.removeAbsolutePath(directory);
    ignores.push(...expressions);
    const newIgnore = [...new Set(ignores)].filter((v) => !!v).sort().join("\n");
    const args = ["propset", "svn:ignore", newIgnore];
    if (directory) {
      args.push(directory);
    } else {
      args.push(".");
    }
    if (recursive) {
      args.push("--recursive");
    }
    const result = await this.exec(args);
    return result.stdout;
  }
  async rename(oldName, newName) {
    oldName = this.removeAbsolutePath(oldName);
    newName = this.removeAbsolutePath(newName);
    const args = ["rename", oldName, newName];
    const result = await this.exec(args);
    return result.stdout;
  }
};
__decorateClass([
  sequentialize
], Repository.prototype, "getInfo", 1);

// src/vscodeModules.ts
var import_vscode14 = require("vscode");
function getNodeModule(moduleName, showError = true) {
  const r = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  const paths = [
    `${import_vscode14.env.appRoot}/node_modules.asar/${moduleName}`,
    `${import_vscode14.env.appRoot}/node_modules/${moduleName}`,
    moduleName
  ];
  for (const p of paths) {
    try {
      return r(p);
    } catch (err) {
    }
  }
  if (showError) {
    import_vscode14.window.showErrorMessage(`Missing dependency: ${moduleName}`);
  }
  return void 0;
}
var iconv_lite = getNodeModule(
  "@vscode/iconv-lite-umd",
  false
);
if (!iconv_lite) {
  iconv_lite = getNodeModule("iconv-lite");
}
var iconv = iconv_lite;

// src/svn.ts
var svnErrorCodes = {
  AuthorizationFailed: "E170001",
  RepositoryIsLocked: "E155004",
  NotASvnRepository: "E155007",
  NotShareCommonAncestry: "E195012",
  WorkingCopyIsTooOld: "E155036"
};
function getSvnErrorCode(stderr) {
  for (const name in svnErrorCodes) {
    if (svnErrorCodes.hasOwnProperty(name)) {
      const code = svnErrorCodes[name];
      const regex = new RegExp(`svn: ${code}`);
      if (regex.test(stderr)) {
        return code;
      }
    }
  }
  if (/No more credentials or we tried too many times/.test(stderr)) {
    return svnErrorCodes.AuthorizationFailed;
  }
  return void 0;
}
function cpErrorHandler(cb) {
  return (err) => {
    if (/ENOENT/.test(err.message)) {
      err = new SvnError({
        error: err,
        message: "Failed to execute svn (ENOENT)",
        svnErrorCode: "NotASvnRepository"
      });
    }
    cb(err);
  };
}
var Svn = class {
  constructor(options) {
    this.lastCwd = "";
    this._onOutput = new import_events.EventEmitter();
    this.svnPath = options.svnPath;
    this.version = options.version;
  }
  get onOutput() {
    return this._onOutput;
  }
  logOutput(output) {
    this._onOutput.emit("log", output);
  }
  async exec(cwd, args, options = {}) {
    if (cwd) {
      this.lastCwd = cwd;
      options.cwd = cwd;
    }
    if (options.log !== false) {
      const argsOut = args.map((arg) => / |^$/.test(arg) ? `'${arg}'` : arg);
      this.logOutput(
        `[${this.lastCwd.split(/[\\\/]+/).pop()}]$ svn ${argsOut.join(" ")}
`
      );
    }
    if (options.username) {
      args.push("--username", options.username);
    }
    if (options.password) {
      args.push("--password", options.password);
    }
    if (options.username || options.password) {
      args.push("--config-option", "config:auth:password-stores=");
      args.push("--config-option", "servers:global:store-auth-creds=no");
    }
    args.push("--non-interactive");
    let encoding = options.encoding;
    delete options.encoding;
    if (args.includes("--xml")) {
      encoding = "utf8";
    }
    const defaults2 = {
      env: proc.env
    };
    if (cwd) {
      defaults2.cwd = cwd;
    }
    defaults2.env = Object.assign({}, proc.env, options.env || {}, {
      LC_ALL: "en_US.UTF-8",
      LANG: "en_US.UTF-8"
    });
    const process2 = cp.spawn(this.svnPath, args, defaults2);
    const disposables = [];
    const once = (ee, name, fn) => {
      ee.once(name, fn);
      disposables.push(toDisposable(() => ee.removeListener(name, fn)));
    };
    const on = (ee, name, fn) => {
      ee.on(name, fn);
      disposables.push(toDisposable(() => ee.removeListener(name, fn)));
    };
    const [exitCode, stdout, stderr] = await Promise.all([
      new Promise((resolve2, reject) => {
        once(process2, "error", reject);
        once(process2, "exit", resolve2);
      }),
      new Promise((resolve2) => {
        const buffers = [];
        on(process2.stdout, "data", (b) => buffers.push(b));
        once(
          process2.stdout,
          "close",
          () => resolve2(Buffer.concat(buffers))
        );
      }),
      new Promise((resolve2) => {
        const buffers = [];
        on(process2.stderr, "data", (b) => buffers.push(b));
        once(
          process2.stderr,
          "close",
          () => resolve2(Buffer.concat(buffers).toString())
        );
      })
    ]);
    dispose(disposables);
    if (!encoding) {
      encoding = detectEncoding(stdout);
    }
    if (!encoding) {
      encoding = configuration.get("default.encoding");
    }
    if (!iconv.encodingExists(encoding)) {
      if (encoding) {
        console.warn(`SVN: The encoding "${encoding}" is invalid`);
      }
      encoding = "utf8";
    }
    const decodedStdout = iconv.decode(stdout, encoding);
    if (options.log !== false && stderr.length > 0) {
      const name = this.lastCwd.split(/[\\\/]+/).pop();
      const err = stderr.split("\n").filter((line) => line).map((line) => `[${name}]$ ${line}`).join("\n");
      this.logOutput(err);
    }
    if (exitCode) {
      return Promise.reject(
        new SvnError({
          message: "Failed to execute svn",
          stdout: decodedStdout,
          stderr,
          stderrFormated: stderr.replace(/^svn: E\d+: +/gm, ""),
          exitCode,
          svnErrorCode: getSvnErrorCode(stderr),
          svnCommand: args[0]
        })
      );
    }
    return { exitCode, stdout: decodedStdout, stderr };
  }
  async execBuffer(cwd, args, options = {}) {
    if (cwd) {
      this.lastCwd = cwd;
      options.cwd = cwd;
    }
    if (options.log !== false) {
      const argsOut = args.map((arg) => / |^$/.test(arg) ? `'${arg}'` : arg);
      this.logOutput(
        `[${this.lastCwd.split(/[\\\/]+/).pop()}]$ svn ${argsOut.join(" ")}
`
      );
    }
    if (options.username) {
      args.push("--username", options.username);
    }
    if (options.password) {
      args.push("--password", options.password);
    }
    if (options.username || options.password) {
      args.push("--config-option", "config:auth:password-stores=");
      args.push("--config-option", "servers:global:store-auth-creds=no");
    }
    args.push("--non-interactive");
    const defaults2 = {
      env: proc.env
    };
    if (cwd) {
      defaults2.cwd = cwd;
    }
    defaults2.env = Object.assign({}, proc.env, options.env || {}, {
      LC_ALL: "en_US.UTF-8",
      LANG: "en_US.UTF-8"
    });
    const process2 = cp.spawn(this.svnPath, args, defaults2);
    const disposables = [];
    const once = (ee, name, fn) => {
      ee.once(name, fn);
      disposables.push(toDisposable(() => ee.removeListener(name, fn)));
    };
    const on = (ee, name, fn) => {
      ee.on(name, fn);
      disposables.push(toDisposable(() => ee.removeListener(name, fn)));
    };
    const [exitCode, stdout, stderr] = await Promise.all([
      new Promise((resolve2, reject) => {
        once(process2, "error", reject);
        once(process2, "exit", resolve2);
      }),
      new Promise((resolve2) => {
        const buffers = [];
        on(process2.stdout, "data", (b) => buffers.push(b));
        once(
          process2.stdout,
          "close",
          () => resolve2(Buffer.concat(buffers))
        );
      }),
      new Promise((resolve2) => {
        const buffers = [];
        on(process2.stderr, "data", (b) => buffers.push(b));
        once(
          process2.stderr,
          "close",
          () => resolve2(Buffer.concat(buffers).toString())
        );
      })
    ]);
    dispose(disposables);
    if (options.log !== false && stderr.length > 0) {
      const name = this.lastCwd.split(/[\\\/]+/).pop();
      const err = stderr.split("\n").filter((line) => line).map((line) => `[${name}]$ ${line}`).join("\n");
      this.logOutput(err);
    }
    return { exitCode, stdout, stderr };
  }
  async getRepositoryRoot(path30) {
    try {
      const result = await this.exec(path30, ["info", "--xml"]);
      const info = await parseInfoXml(result.stdout);
      if (info && info.wcInfo && info.wcInfo.wcrootAbspath) {
        return info.wcInfo.wcrootAbspath;
      }
      return path30;
    } catch (error) {
      if (error instanceof SvnError) {
        throw error;
      }
      console.error(error);
      throw new Error("Unable to find repository root path");
    }
  }
  async open(repositoryRoot, workspaceRoot) {
    return new Repository(
      this,
      repositoryRoot,
      workspaceRoot,
      0 /* Async */
    );
  }
};

// src/commands/checkout.ts
var Checkout = class extends Command2 {
  constructor() {
    super("svn.checkout");
  }
  async execute(url) {
    if (!url) {
      url = await import_vscode15.window.showInputBox({
        prompt: "Repository URL",
        ignoreFocusOut: true
      });
    }
    if (!url) {
      return;
    }
    if (!validateRepositoryUrl(url)) {
      import_vscode15.window.showErrorMessage(
        `Invalid repository URL. Only http://, https://, svn://, and svn+ssh:// protocols are allowed.`
      );
      return;
    }
    let defaultCheckoutDirectory = configuration.get("defaultCheckoutDirectory") || os.homedir();
    defaultCheckoutDirectory = defaultCheckoutDirectory.replace(
      /^~/,
      os.homedir()
    );
    const uris = await import_vscode15.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: import_vscode15.Uri.file(defaultCheckoutDirectory),
      openLabel: "Select Repository Location"
    });
    if (!uris || uris.length === 0) {
      return;
    }
    const uri = uris[0];
    const parentPath = uri.fsPath;
    let folderName;
    const branch = getBranchName(url);
    if (branch) {
      const baseUrl = url.replace(/\//g, "/").replace(branch.path, "");
      folderName = path9.basename(baseUrl);
    }
    folderName = await import_vscode15.window.showInputBox({
      prompt: "Folder name",
      value: folderName,
      ignoreFocusOut: true
    });
    if (!folderName) {
      return;
    }
    const repositoryPath = path9.join(parentPath, folderName);
    let location = import_vscode15.ProgressLocation.Window;
    if (import_vscode15.ProgressLocation.Notification) {
      location = import_vscode15.ProgressLocation.Notification;
    }
    const progressOptions = {
      location,
      title: `Checkout svn repository '${url}'...`,
      cancellable: true
    };
    let attempt = 0;
    const opt = {};
    while (true) {
      attempt++;
      try {
        await import_vscode15.window.withProgress(progressOptions, async () => {
          const sourceControlManager = await import_vscode15.commands.executeCommand(
            "svn.getSourceControlManager",
            ""
          );
          const args = ["checkout", url, repositoryPath];
          await sourceControlManager.svn.exec(parentPath, args, opt);
        });
        break;
      } catch (err) {
        const svnError = err;
        if (svnError.svnErrorCode === svnErrorCodes.AuthorizationFailed && attempt <= 3) {
          const auth = await import_vscode15.commands.executeCommand(
            "svn.promptAuth",
            opt.username
          );
          if (auth) {
            opt.username = auth.username;
            opt.password = auth.password;
            continue;
          }
        }
        throw err;
      }
    }
    const choices = [];
    let message = "Would you like to open the checked out repository?";
    const open = "Open Repository";
    choices.push(open);
    const addToWorkspace = "Add to Workspace";
    if (import_vscode15.workspace.workspaceFolders && import_vscode15.workspace.updateWorkspaceFolders) {
      message = "Would you like to open the checked out repository, or add it to the current workspace?";
      choices.push(addToWorkspace);
    }
    const result = await import_vscode15.window.showInformationMessage(message, ...choices);
    const openFolder = result === open;
    if (openFolder) {
      import_vscode15.commands.executeCommand("vscode.openFolder", import_vscode15.Uri.file(repositoryPath));
    } else if (result === addToWorkspace) {
      import_vscode15.workspace.updateWorkspaceFolders(
        import_vscode15.workspace.workspaceFolders.length,
        0,
        {
          uri: import_vscode15.Uri.file(repositoryPath)
        }
      );
    }
  }
};

// src/commands/cleanup.ts
var Cleanup = class extends Command2 {
  constructor() {
    super("svn.cleanup", { repository: true });
  }
  async execute(repository) {
    await repository.cleanup();
  }
};

// src/commands/close.ts
var import_vscode16 = require("vscode");
var Close = class extends Command2 {
  constructor() {
    super("svn.close", { repository: true });
  }
  async execute(repository) {
    const sourceControlManager = await import_vscode16.commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    );
    sourceControlManager.close(repository);
  }
};

// src/commands/commit.ts
var path11 = __toESM(require("path"));
var import_vscode18 = require("vscode");

// src/messages.ts
var path10 = __toESM(require("path"));
var import_vscode17 = require("vscode");
var panel;
var callback;
import_vscode17.commands.registerCommand("svn.forceCommitMessageTest", (message) => {
  if (callback) {
    return callback(message);
  }
});
function dispose2() {
  if (panel) {
    panel.dispose();
  }
}
async function showCommitInput(message, filePaths) {
  const promise = new Promise((resolve2) => {
    if (panel) {
      panel.dispose();
    }
    callback = (m) => {
      resolve2(m);
      panel.dispose();
    };
    panel = import_vscode17.window.createWebviewPanel(
      "svnCommitMessage",
      "Commit Message",
      {
        preserveFocus: false,
        viewColumn: import_vscode17.ViewColumn.Active
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    const stylePathOnDisk = import_vscode17.Uri.file(
      path10.join(__dirname, "..", "css", "commit-message.css")
    );
    const styleUri = panel.webview.asWebviewUri(stylePathOnDisk);
    let beforeForm = "";
    if (filePaths && filePaths.length) {
      const selectedFiles = filePaths.sort().map((f) => `<li>${f}</li>`);
      if (selectedFiles.length) {
        beforeForm = `
<div class="file-list">
  <h3 class="title">Files to commit</h3>
  <ul>
    ${selectedFiles.join("\n")}
  </ul>
</div>`;
      }
    }
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!--
  Use a content security policy to only allow loading images from https or from our extension directory,
  and only allow scripts that have a specific nonce.
  -->
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource} https:; script-src ${panel.webview.cspSource} 'unsafe-inline'; style-src ${panel.webview.cspSource};">

  <title>Commit Message</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <section class="container">
    ${beforeForm}
    <form>
      <fieldset>
        <div class="float-right">
          <a href="#" id="pickCommitMessage">Pick a previous commit message</a>
        </div>
        <label for="message">Commit message</label>
        <textarea id="message" rows="3" placeholder="Message (press Ctrl+Enter to commit)"></textarea>
        <button id="commit" class="button-primary">Commit</button>
        <div class="float-right">
          <button id="cancel" class="button button-outline">Cancel</button>
        </div>
      </fieldset>
    </form>
  </section>
  <script>
    const vscode = acquireVsCodeApi();

    const txtMessage = document.getElementById("message");
    const btnCommit = document.getElementById("commit");
    const btnCancel = document.getElementById("cancel");
    const linkPickCommitMessage = document.getElementById("pickCommitMessage");

    // load current message
    txtMessage.value = ${JSON.stringify(message)};

    btnCommit.addEventListener("click", function() {
      vscode.postMessage({
        command: "commit",
        message: txtMessage.value
      });
    });

    btnCancel.addEventListener("click", function() {
      vscode.postMessage({
        command: "cancel"
      });
    });

    // Allow CTRL + Enter
    txtMessage.addEventListener("keydown", function(e) {
      if (event.ctrlKey && event.keyCode === 13) {
        btnCommit.click();
      }
    });

    // Auto resize the height of message
    txtMessage.addEventListener("input", function(e) {
      txtMessage.style.height = "auto";
      txtMessage.style.height = (txtMessage.scrollHeight) + "px";
    });

    window.addEventListener("load", function() {
      setTimeout(() => {
        txtMessage.focus();
      }, 1000);
    });

    linkPickCommitMessage.addEventListener("click", function() {
      vscode.postMessage({
        command: "pickCommitMessage"
      });
    });

    // Message from VSCode
    window.addEventListener("message", function(event) {
      const message = event.data;
      switch (message.command) {
        case "setMessage":
          txtMessage.value = message.message;
          txtMessage.dispatchEvent(new Event("input"));
          break;
      }
    });
  </script>
</body>
</html>`;
    panel.webview.html = html;
    panel.onDidDispose(() => {
      resolve2(void 0);
    });
    const pickCommitMessage = async () => {
      let repository;
      if (filePaths && filePaths[0]) {
        const sourceControlManager = await import_vscode17.commands.executeCommand(
          "svn.getSourceControlManager",
          ""
        );
        repository = await sourceControlManager.getRepositoryFromUri(
          import_vscode17.Uri.file(filePaths[0])
        );
      }
      const message2 = await import_vscode17.commands.executeCommand(
        "svn.pickCommitMessage",
        repository
      );
      if (message2 !== void 0) {
        panel.webview.postMessage({
          command: "setMessage",
          message: message2
        });
      }
    };
    panel.webview.onDidReceiveMessage((message2) => {
      switch (message2.command) {
        case "commit":
          resolve2(message2.message);
          panel.dispose();
          break;
        case "pickCommitMessage":
          pickCommitMessage();
          break;
        default:
          resolve2(void 0);
          panel.dispose();
      }
    });
    panel.reveal(import_vscode17.ViewColumn.Active, false);
  });
  return promise;
}
async function inputCommitMessage(message, promptNew = true, filePaths) {
  if (promptNew) {
    message = await showCommitInput(message, filePaths);
  }
  const checkEmptyMessage = configuration.get(
    "commit.checkEmptyMessage",
    true
  );
  if (message === "" && checkEmptyMessage) {
    const allowEmpty = await import_vscode17.window.showWarningMessage(
      "Do you really want to commit an empty message?",
      { modal: true },
      "Yes"
    );
    if (allowEmpty === "Yes") {
      return "";
    } else {
      return void 0;
    }
  }
  return message;
}

// src/commands/commit.ts
var Commit = class extends Command2 {
  constructor() {
    super("svn.commit");
  }
  async execute(...resources) {
    if (resources.length === 0 || !(resources[0].resourceUri instanceof import_vscode18.Uri)) {
      const resource = await this.getSCMResource();
      if (!resource) {
        return;
      }
      resources = [resource];
    }
    const selection = resources.filter(
      (s) => s instanceof Resource
    );
    const uris = selection.map((resource) => resource.resourceUri);
    selection.forEach((resource) => {
      if (resource.type === "added" /* ADDED */ && resource.renameResourceUri) {
        uris.push(resource.renameResourceUri);
      }
    });
    await this.runByRepository(uris, async (repository, resources2) => {
      if (!repository) {
        return;
      }
      const paths = resources2.map((resource) => resource.fsPath);
      for (const resource of resources2) {
        let dir = path11.dirname(resource.fsPath);
        let parent = repository.getResourceFromFile(dir);
        while (parent) {
          if (parent.type === "added" /* ADDED */) {
            paths.push(dir);
          }
          dir = path11.dirname(dir);
          parent = repository.getResourceFromFile(dir);
        }
      }
      try {
        const message = await inputCommitMessage(
          repository.inputBox.value,
          true,
          paths
        );
        if (message === void 0) {
          return;
        }
        repository.inputBox.value = message;
        const result = await repository.commitFiles(message, paths);
        import_vscode18.window.showInformationMessage(result);
        repository.inputBox.value = "";
      } catch (error) {
        console.error(error);
        const svnError = error;
        import_vscode18.window.showErrorMessage(svnError.stderrFormated || String(error));
      }
    });
  }
};

// src/commands/commitWithMessage.ts
var path12 = __toESM(require("path"));
var import_vscode19 = require("vscode");
var CommitWithMessage = class extends Command2 {
  constructor() {
    super("svn.commitWithMessage", { repository: true });
  }
  async execute(repository) {
    const resourceStates = await inputCommitFiles(repository);
    if (!resourceStates || resourceStates.length === 0) {
      return;
    }
    const filePaths = resourceStates.map((state) => {
      return state.resourceUri.fsPath;
    });
    const message = await inputCommitMessage(
      repository.inputBox.value,
      false,
      filePaths
    );
    if (message === void 0) {
      return;
    }
    resourceStates.forEach((state) => {
      if (state instanceof Resource) {
        if (state.type === "added" /* ADDED */ && state.renameResourceUri) {
          filePaths.push(state.renameResourceUri.fsPath);
        }
        let dir = path12.dirname(state.resourceUri.fsPath);
        let parent = repository.getResourceFromFile(dir);
        while (parent) {
          if (parent.type === "added" /* ADDED */) {
            filePaths.push(dir);
          }
          dir = path12.dirname(dir);
          parent = repository.getResourceFromFile(dir);
        }
      }
    });
    try {
      const result = await repository.commitFiles(message, filePaths);
      import_vscode19.window.showInformationMessage(result);
      repository.inputBox.value = "";
    } catch (error) {
      console.error(error);
      const svnError = error;
      import_vscode19.window.showErrorMessage(svnError.stderrFormated || String(error));
    }
  }
};

// src/commands/deleteUnversioned.ts
var import_vscode20 = require("vscode");
var DeleteUnversioned = class extends Command2 {
  constructor() {
    super("svn.deleteUnversioned");
  }
  async execute(...resourceStates) {
    const selection = await this.getResourceStates(resourceStates);
    if (selection.length === 0) {
      return;
    }
    const uris = selection.map((resource) => resource.resourceUri);
    const answer = await import_vscode20.window.showWarningMessage(
      "Would you like to delete selected files?",
      { modal: true },
      "Yes",
      "No"
    );
    if (answer === "Yes") {
      for (const uri of uris) {
        const fsPath = uri.fsPath;
        try {
          if (!await exists(fsPath)) {
            continue;
          }
          const stat2 = await lstat(fsPath);
          if (stat2.isDirectory()) {
            deleteDirectory(fsPath);
          } else {
            await unlink(fsPath);
          }
        } catch (err) {
        }
      }
    }
  }
};

// src/commands/fileOpen.ts
var import_vscode21 = require("vscode");
var FileOpen = class extends Command2 {
  constructor() {
    super("svn.fileOpen");
  }
  async execute(resourceUri) {
    await import_vscode21.commands.executeCommand("vscode.open", resourceUri);
  }
};

// src/commands/finishCheckout.ts
var FinishCheckout = class extends Command2 {
  constructor() {
    super("svn.finishCheckout", { repository: true });
  }
  async execute(repository) {
    await repository.finishCheckout();
  }
};

// src/commands/get_source_control_manager.ts
var GetSourceControlManager = class extends Command2 {
  constructor(sourceControlManager) {
    super("svn.getSourceControlManager");
    this.sourceControlManager = sourceControlManager;
  }
  async execute() {
    return this.sourceControlManager;
  }
};

// src/commands/log.ts
var import_path = require("path");
var import_vscode22 = require("vscode");
var Log = class extends Command2 {
  constructor() {
    super("svn.log", { repository: true });
  }
  async execute(repository) {
    try {
      const resource = toSvnUri(
        import_vscode22.Uri.file(repository.workspaceRoot),
        "LOG" /* LOG */
      );
      const uri = resource.with({
        path: import_path.posix.join(resource.path, "svn.log")
        // change document title
      });
      await import_vscode22.commands.executeCommand("vscode.open", uri);
    } catch (error) {
      console.error(error);
      import_vscode22.window.showErrorMessage("Unable to log");
    }
  }
};

// src/commands/openChangeBase.ts
var OpenChangeBase = class extends Command2 {
  constructor() {
    super("svn.openChangeBase", {});
  }
  async execute(arg, ...resourceStates) {
    return this.openChange(arg, "BASE", resourceStates);
  }
};

// src/commands/openChangeHead.ts
var OpenChangeHead = class extends Command2 {
  constructor() {
    super("svn.openChangeHead");
  }
  async execute(arg, ...resourceStates) {
    return this.openChange(arg, "HEAD", resourceStates);
  }
};

// src/commands/openChangePrev.ts
var OpenChangePrev = class extends Command2 {
  constructor() {
    super("svn.openChangePrev", {});
  }
  async execute(arg, ...resourceStates) {
    return this.openChange(arg, "PREV", resourceStates);
  }
};

// src/commands/openFile.ts
var import_vscode23 = require("vscode");
var OpenFile = class extends Command2 {
  constructor() {
    super("svn.openFile");
  }
  async execute(arg, ...resourceStates) {
    const preserveFocus = arg instanceof Resource;
    let uris;
    if (arg instanceof import_vscode23.Uri) {
      if (arg.scheme === "svn") {
        uris = [import_vscode23.Uri.file(fromSvnUri(arg).fsPath)];
      } else if (arg.scheme === "file") {
        uris = [arg];
      }
    } else if (arg instanceof IncomingChangeNode) {
      const resource = new Resource(
        arg.uri,
        arg.type,
        void 0,
        arg.props,
        true
      );
      uris = [resource.resourceUri];
    } else {
      const resource = arg;
      if (!(resource instanceof Resource)) {
      }
      if (resource) {
        uris = [
          ...resourceStates.map((r) => r.resourceUri),
          resource.resourceUri
        ];
      }
    }
    if (!uris) {
      return;
    }
    const preview = uris.length === 1 ? true : false;
    const activeTextEditor = import_vscode23.window.activeTextEditor;
    for (const uri of uris) {
      if (!uri || await exists(uri.fsPath) && (await stat(uri.fsPath)).isDirectory()) {
        continue;
      }
      const opts = {
        preserveFocus,
        preview,
        viewColumn: import_vscode23.ViewColumn.Active
      };
      if (activeTextEditor && activeTextEditor.document.uri.toString() === uri.toString()) {
        opts.selection = activeTextEditor.selection;
      }
      const document = await import_vscode23.workspace.openTextDocument(uri);
      await import_vscode23.window.showTextDocument(document, opts);
    }
  }
};

// src/commands/openHeadFile.ts
var import_path2 = require("path");
var import_vscode24 = require("vscode");
var OpenHeadFile = class extends Command2 {
  constructor() {
    super("svn.openHEADFile");
  }
  async execute(arg) {
    let resource;
    if (arg instanceof Resource) {
      resource = arg;
    } else if (arg instanceof import_vscode24.Uri) {
      resource = await this.getSCMResource(arg);
    } else if (arg instanceof IncomingChangeNode) {
      resource = new Resource(arg.uri, arg.type, void 0, arg.props, true);
    } else {
      resource = await this.getSCMResource();
    }
    if (!resource) {
      return;
    }
    const HEAD = await this.getLeftResource(resource, "HEAD");
    const basename12 = import_path2.posix.basename(resource.resourceUri.path);
    if (!HEAD) {
      import_vscode24.window.showWarningMessage(
        `"HEAD version of '${basename12}' is not available."`
      );
      return;
    }
    const basedir = import_path2.posix.dirname(resource.resourceUri.path);
    const uri = HEAD.with({
      path: import_path2.posix.join(basedir, `(HEAD) ${basename12}`)
      // change document title
    });
    return import_vscode24.commands.executeCommand("vscode.open", uri, {
      preview: true
    });
  }
};

// src/commands/openResourceBase.ts
var OpenResourceBase = class extends Command2 {
  constructor() {
    super("svn.openResourceBase");
  }
  async execute(resource) {
    await this._openResource(resource, "BASE", void 0, true, false);
  }
};

// src/commands/openResourceHead.ts
var OpenResourceHead = class extends Command2 {
  constructor() {
    super("svn.openResourceHead");
  }
  async execute(resource) {
    await this._openResource(resource, "HEAD", void 0, true, false);
  }
};

// src/commands/patch.ts
var Patch = class extends Command2 {
  constructor() {
    super("svn.patch");
  }
  async execute(...resourceStates) {
    const selection = await this.getResourceStates(resourceStates);
    if (selection.length === 0) {
      return;
    }
    const uris = selection.map((resource) => resource.resourceUri);
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }
      const files = resources.map((resource) => resource.fsPath);
      const content = await repository.patch(files);
      await this.showDiffPath(repository, content);
    });
  }
};

// src/commands/patchAll.ts
var PatchAll = class extends Command2 {
  constructor() {
    super("svn.patchAll", { repository: true });
  }
  async execute(repository) {
    const content = await repository.patch([]);
    await this.showDiffPath(repository, content);
  }
};

// src/commands/patchChangeList.ts
var PatchChangeList = class extends Command2 {
  constructor() {
    super("svn.patchChangeList", { repository: true });
  }
  async execute(repository) {
    const changelistName = await getPatchChangelist(repository);
    if (!changelistName) {
      return;
    }
    const content = await repository.patchChangelist(changelistName);
    await this.showDiffPath(repository, content);
  }
};

// src/commands/pickCommitMessage.ts
var import_vscode25 = require("vscode");
var semver = __toESM(require_semver2());
var PickCommitMessage = class extends Command2 {
  constructor(svnVersion) {
    super("svn.pickCommitMessage", { repository: true });
    this.svnVersion = svnVersion;
  }
  async execute(repository) {
    const is18orGreater = semver.satisfies(this.svnVersion, ">= 1.8");
    let logs = [];
    const user = configuration.get("previousCommitsUser", null);
    if (user && is18orGreater) {
      logs = await repository.logByUser(user);
    } else {
      logs = await repository.log("HEAD", "0", 20);
    }
    if (!logs.length) {
      return;
    }
    const picks = logs.map((l) => {
      return {
        label: l.msg,
        description: `r${l.revision} | ${l.author} | ${new Date(
          l.date
        ).toLocaleString()}`
      };
    });
    const selected = await import_vscode25.window.showQuickPick(picks);
    if (selected === void 0) {
      return;
    }
    const msg = selected.label;
    repository.inputBox.value = msg;
    return msg;
  }
};

// src/commands/promptAuth.ts
var import_vscode26 = require("vscode");
var PromptAuth = class extends Command2 {
  constructor() {
    super("svn.promptAuth");
  }
  async execute(prevUsername, prevPassword) {
    const username = await import_vscode26.window.showInputBox({
      placeHolder: "Svn repository username",
      prompt: "Please enter your username",
      ignoreFocusOut: true,
      value: prevUsername
    });
    if (username === void 0) {
      return;
    }
    const password = await import_vscode26.window.showInputBox({
      placeHolder: "Svn repository password",
      prompt: "Please enter your password",
      value: prevPassword,
      ignoreFocusOut: true,
      password: true
    });
    if (password === void 0) {
      return;
    }
    const auth = {
      username,
      password
    };
    return auth;
  }
};

// src/commands/promptRemove.ts
var import_vscode27 = require("vscode");
var PromptRemove = class extends Command2 {
  constructor() {
    super("svn.promptRemove", { repository: true });
  }
  async execute(repository, ...uris) {
    const files = uris.map((uri) => uri.fsPath);
    const relativeList = files.map((file) => repository.repository.removeAbsolutePath(file)).sort();
    const ignoreText = "Add to ignored list";
    const resp = await import_vscode27.window.showInformationMessage(
      `The file(s) "${relativeList.join(
        ", "
      )}" are removed from disk.
Would you like remove from SVN?`,
      { modal: false },
      "Yes",
      ignoreText,
      "No"
    );
    if (resp === "Yes") {
      await repository.removeFiles(files, false);
    } else if (resp === ignoreText) {
      let ignoreList = configuration.get(
        "delete.ignoredRulesForDeletedFiles",
        []
      );
      ignoreList.push(...relativeList);
      ignoreList = [...new Set(ignoreList)];
      configuration.update("delete.ignoredRulesForDeletedFiles", ignoreList);
    }
  }
};

// src/commands/pullIncomingChange.ts
var import_vscode28 = require("vscode");
var PullIncommingChange = class extends Command2 {
  constructor() {
    super("svn.treeview.pullIncomingChange");
  }
  // TODO: clean this up
  async execute(...changes) {
    const showUpdateMessage = configuration.get(
      "showUpdateMessage",
      true
    );
    if (changes[0] instanceof IncomingChangeNode) {
      try {
        const incomingChange = changes[0];
        const result = await incomingChange.repository.pullIncomingChange(
          incomingChange.uri.fsPath
        );
        if (showUpdateMessage) {
          import_vscode28.window.showInformationMessage(result);
        }
      } catch (error) {
        console.error(error);
        import_vscode28.window.showErrorMessage("Unable to update");
      }
      return;
    }
    const uris = changes.map((change) => change.resourceUri);
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }
      const files = resources.map((resource) => resource.fsPath);
      files.forEach(async (path30) => {
        const result = await repository.pullIncomingChange(path30);
        if (showUpdateMessage) {
          import_vscode28.window.showInformationMessage(result);
        }
      });
    });
  }
};

// src/commands/refresh.ts
var Refresh = class extends Command2 {
  constructor() {
    super("svn.refresh", { repository: true });
  }
  async execute(repository) {
    const refreshRemoteChanges = configuration.get(
      "refresh.remoteChanges",
      false
    );
    await repository.status();
    if (refreshRemoteChanges) {
      await repository.updateRemoteChangedFiles();
    }
  }
};

// src/commands/refreshRemoteChanges.ts
var RefreshRemoteChanges = class extends Command2 {
  constructor() {
    super("svn.refreshRemoteChanges", { repository: true });
  }
  async execute(repository) {
    await repository.updateRemoteChangedFiles();
  }
};

// src/commands/remove.ts
var import_vscode29 = require("vscode");
var Remove = class extends Command2 {
  constructor() {
    super("svn.remove");
  }
  async execute(...resourceStates) {
    const selection = await this.getResourceStates(resourceStates);
    if (selection.length === 0) {
      return;
    }
    let keepLocal;
    const answer = await import_vscode29.window.showWarningMessage(
      "Would you like to keep a local copy of the files?",
      { modal: true },
      "Yes",
      "No"
    );
    if (!answer) {
      return;
    }
    if (answer === "Yes") {
      keepLocal = true;
    } else {
      keepLocal = false;
    }
    const uris = selection.map((resource) => resource.resourceUri);
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }
      const paths = resources.map((resource) => resource.fsPath);
      try {
        await repository.removeFiles(paths, keepLocal);
      } catch (error) {
        console.log(error);
        import_vscode29.window.showErrorMessage("Unable to remove files");
      }
    });
  }
};

// src/commands/removeUnversioned.ts
var import_vscode30 = require("vscode");
var RemoveUnversioned = class extends Command2 {
  constructor() {
    super("svn.removeUnversioned", { repository: true });
  }
  async execute(repository) {
    const answer = await import_vscode30.window.showWarningMessage(
      "Are you sure? This will remove all unversioned files except for ignored.",
      { modal: true },
      "Yes",
      "No"
    );
    if (answer !== "Yes") {
      return;
    }
    await repository.removeUnversioned();
  }
};

// src/commands/renameExplorer.ts
var path15 = __toESM(require("path"));
var import_vscode31 = require("vscode");
var RenameExplorer = class extends Command2 {
  constructor() {
    super("svn.renameExplorer", { repository: true });
  }
  async execute(repository, mainUri, _allUris) {
    if (!mainUri) {
      return;
    }
    const oldName = mainUri.fsPath;
    return this.rename(repository, oldName);
  }
  async rename(repository, oldFile, newName) {
    oldFile = fixPathSeparator(oldFile);
    if (!newName) {
      const root = fixPathSeparator(repository.workspaceRoot);
      const oldName = path15.relative(root, oldFile);
      newName = await import_vscode31.window.showInputBox({
        value: path15.basename(oldFile),
        prompt: `New name name for ${oldName}`
      });
    }
    if (!newName) {
      return;
    }
    const basepath = path15.dirname(oldFile);
    newName = path15.join(basepath, newName);
    await repository.rename(oldFile, newName);
  }
};

// src/commands/resolve.ts
var import_vscode32 = require("vscode");

// src/conflictItems.ts
var conflictOptions = [
  {
    label: "base",
    description: "Choose the file that was the (unmodified) BASE revision before you tried to integrate changes"
  },
  {
    label: "working",
    description: "Assuming that you've manually handled the conflict resolution, choose the version of the file as it currently stands in your working copy."
  },
  {
    label: "mine-full",
    description: "Preserve all local modifications and discarding all changes fetched"
  },
  {
    label: "theirs-full",
    description: "Discard all local modifications and integrating all changes fetched"
  },
  {
    label: "mine-conflict",
    description: "Resolve conflicted files by preferring local modifications over the changes fetched"
  },
  {
    label: "theirs-conflict",
    description: "Resolve conflicted files by preferring the changes fetched from the server over local modifications"
  }
];
var ConflictItem = class {
  constructor(option) {
    this.option = option;
  }
  get label() {
    return this.option.label;
  }
  get description() {
    return this.option.description;
  }
};
function getConflictPickOptions() {
  return conflictOptions.map((option) => new ConflictItem(option));
}

// src/commands/resolve.ts
var Resolve = class extends Command2 {
  constructor() {
    super("svn.resolve");
  }
  async execute(...resourceStates) {
    const selection = await this.getResourceStates(resourceStates);
    if (selection.length === 0) {
      return;
    }
    const picks = getConflictPickOptions();
    const choice = await import_vscode32.window.showQuickPick(picks, {
      placeHolder: "Select conflict option"
    });
    if (!choice) {
      return;
    }
    const uris = selection.map((resource) => resource.resourceUri);
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }
      const files = resources.map((resource) => resource.fsPath);
      await repository.resolve(files, choice.label);
    });
  }
};

// src/commands/resolveAll.ts
var import_vscode33 = require("vscode");
var ResolveAll = class extends Command2 {
  constructor() {
    super("svn.resolveAll", { repository: true });
  }
  async execute(repository) {
    const conflicts = repository.conflicts.resourceStates;
    if (!conflicts.length) {
      import_vscode33.window.showInformationMessage("No Conflicts");
    }
    for (const conflict of conflicts) {
      const placeHolder = `Select conflict option for ${conflict.resourceUri.path}`;
      const picks = getConflictPickOptions();
      const choice = await import_vscode33.window.showQuickPick(picks, { placeHolder });
      if (!choice) {
        return;
      }
      try {
        const response = await repository.resolve(
          [conflict.resourceUri.path],
          choice.label
        );
        import_vscode33.window.showInformationMessage(response);
      } catch (error) {
        const svnError = error;
        import_vscode33.window.showErrorMessage(svnError.stderr || String(error));
      }
    }
  }
};

// src/commands/resolved.ts
var path16 = __toESM(require("path"));
var import_vscode34 = require("vscode");
var Resolved = class extends Command2 {
  constructor() {
    super("svn.resolved");
  }
  async execute(uri) {
    if (!uri) {
      return;
    }
    const autoResolve = configuration.get("conflict.autoResolve");
    if (!autoResolve) {
      const basename12 = path16.basename(uri.fsPath);
      const pick = await import_vscode34.window.showWarningMessage(
        `Mark the conflict as resolved for "${basename12}"?`,
        { modal: true },
        "Yes",
        "No"
      );
      if (pick !== "Yes") {
        return;
      }
    }
    const uris = [uri];
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }
      const files = resources.map((resource) => resource.fsPath);
      await repository.resolve(files, "working");
    });
  }
};

// src/commands/revert.ts
var import_vscode36 = require("vscode");

// src/input/revert.ts
var import_vscode35 = require("vscode");
async function confirmRevert() {
  const yes = "Yes I'm sure";
  const answer = await import_vscode35.window.showWarningMessage(
    "Are you sure? This will wipe all local changes.",
    { modal: true },
    yes
  );
  if (answer !== yes) {
    return false;
  }
  return true;
}
async function promptDepth() {
  const picks = [];
  for (const depth in SvnDepth) {
    if (SvnDepth.hasOwnProperty(depth)) {
      picks.push({ label: depth, description: SvnDepth[depth] });
    }
  }
  const placeHolder = "Select revert depth";
  const pick = await import_vscode35.window.showQuickPick(picks, { placeHolder });
  if (!pick) {
    return void 0;
  }
  return pick.label;
}
async function checkAndPromptDepth(uris, defaultDepth = "empty") {
  let hasDirectory = uris.length === 0;
  for (const uri of uris) {
    if (uri.scheme !== "file") {
      continue;
    }
    try {
      const stat2 = await lstat(uri.fsPath);
      if (stat2.isDirectory()) {
        hasDirectory = true;
        break;
      }
    } catch (error) {
    }
  }
  if (hasDirectory) {
    return promptDepth();
  }
  return defaultDepth;
}

// src/commands/revert.ts
var Revert = class extends Command2 {
  constructor() {
    super("svn.revert");
  }
  async execute(...resourceStates) {
    const selection = await this.getResourceStates(resourceStates);
    if (selection.length === 0 || !await confirmRevert()) {
      return;
    }
    const uris = selection.map((resource) => resource.resourceUri);
    const depth = await checkAndPromptDepth(uris);
    if (!depth) {
      return;
    }
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }
      const paths = resources.map((resource) => resource.fsPath).reverse();
      try {
        await repository.revert(paths, depth);
      } catch (error) {
        console.log(error);
        import_vscode36.window.showErrorMessage("Unable to revert");
      }
    });
  }
};

// src/commands/revertAll.ts
var import_vscode37 = require("vscode");
var RevertAll = class extends Command2 {
  constructor() {
    super("svn.revertAll");
  }
  async execute(resourceGroup) {
    const resourceStates = resourceGroup.resourceStates;
    if (resourceStates.length === 0 || !await confirmRevert()) {
      return;
    }
    const uris = resourceStates.map((resource) => resource.resourceUri);
    const depth = await checkAndPromptDepth(uris);
    if (!depth) {
      return;
    }
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }
      const paths = resources.map((resource) => resource.fsPath).reverse();
      try {
        await repository.revert(paths, depth);
      } catch (error) {
        console.log(error);
        import_vscode37.window.showErrorMessage("Unable to revert");
      }
    });
  }
};

// src/commands/revertChange.ts
var import_vscode38 = require("vscode");
var RevertChange = class extends Command2 {
  constructor() {
    super("svn.revertChange");
  }
  async execute(uri, changes, index) {
    const textEditor = import_vscode38.window.visibleTextEditors.filter(
      (e) => e.document.uri.toString() === uri.toString()
    )[0];
    if (!textEditor) {
      return;
    }
    await this._revertChanges(textEditor, [
      ...changes.slice(0, index),
      ...changes.slice(index + 1)
    ]);
  }
};

// src/commands/revertExplorer.ts
var import_vscode39 = require("vscode");
var RevertExplorer = class extends Command2 {
  constructor() {
    super("svn.revertExplorer");
  }
  async execute(_mainUri, allUris) {
    if (!allUris) {
      return;
    }
    const uris = allUris;
    if (uris.length === 0 || !await confirmRevert()) {
      return;
    }
    const depth = await checkAndPromptDepth(uris);
    if (!depth) {
      return;
    }
    await this.runByRepository(uris, async (repository, resources) => {
      if (!repository) {
        return;
      }
      const paths = resources.map((resource) => resource.fsPath);
      try {
        await repository.revert(paths, depth);
      } catch (error) {
        console.log(error);
        import_vscode39.window.showErrorMessage("Unable to revert");
      }
    });
  }
};

// src/commands/switchBranch.ts
var import_vscode40 = require("vscode");
var SwitchBranch = class extends Command2 {
  constructor() {
    super("svn.switchBranch", { repository: true });
  }
  async execute(repository) {
    const branch = await selectBranch(repository, true);
    if (!branch) {
      return;
    }
    try {
      if (branch.isNew) {
        const commitMessage = await import_vscode40.window.showInputBox({
          value: `Created new branch ${branch.name}`,
          prompt: `Commit message for create branch ${branch.name}`
        });
        if (commitMessage === void 0) {
          return;
        }
        await repository.newBranch(branch.path, commitMessage);
      } else {
        try {
          await repository.switchBranch(branch.path);
        } catch (error) {
          const svnError = error;
          if (svnError.stderrFormated && svnError.stderrFormated.includes("ignore-ancestry")) {
            const answer = await import_vscode40.window.showErrorMessage(
              "Seems like these branches don't have a common ancestor.  Do you want to retry with '--ignore-ancestry' option?",
              "Yes",
              "No"
            );
            if (answer === "Yes") {
              await repository.switchBranch(branch.path, true);
            }
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.log(error);
      if (branch.isNew) {
        import_vscode40.window.showErrorMessage("Unable to create new branch");
      } else {
        import_vscode40.window.showErrorMessage("Unable to switch branch");
      }
    }
  }
};

// src/commands/update.ts
var import_vscode41 = require("vscode");
var Update = class extends Command2 {
  constructor() {
    super("svn.update", { repository: true });
  }
  async execute(repository) {
    try {
      const ignoreExternals = configuration.get(
        "update.ignoreExternals",
        false
      );
      const showUpdateMessage = configuration.get(
        "showUpdateMessage",
        true
      );
      const result = await repository.updateRevision(ignoreExternals);
      if (showUpdateMessage) {
        import_vscode41.window.showInformationMessage(result);
      }
    } catch (error) {
      console.error(error);
      import_vscode41.window.showErrorMessage("Unable to update");
    }
  }
};

// src/commands/upgrade.ts
var import_vscode42 = require("vscode");
var Upgrade = class extends Command2 {
  constructor() {
    super("svn.upgrade");
  }
  async execute(folderPath) {
    if (!folderPath) {
      return;
    }
    if (configuration.get("ignoreWorkingCopyIsTooOld", false)) {
      return;
    }
    folderPath = fixPathSeparator(folderPath);
    const yes = "Yes";
    const no = "No";
    const neverShowAgain = "Don't Show Again";
    const choice = await import_vscode42.window.showWarningMessage(
      "You want upgrade the working copy (svn upgrade)?",
      yes,
      no,
      neverShowAgain
    );
    const sourceControlManager = await import_vscode42.commands.executeCommand(
      "svn.getSourceControlManager",
      ""
    );
    if (choice === yes) {
      const upgraded = await sourceControlManager.upgradeWorkingCopy(
        folderPath
      );
      if (upgraded) {
        import_vscode42.window.showInformationMessage(`Working copy "${folderPath}" upgraded`);
        sourceControlManager.tryOpenRepository(folderPath);
      } else {
        import_vscode42.window.showErrorMessage(
          `Error on upgrading working copy "${folderPath}". See log for more detail`
        );
      }
    } else if (choice === neverShowAgain) {
      return configuration.update("ignoreWorkingCopyIsTooOld", true);
    }
    return;
  }
};

// src/commands/search_log_by_revision.ts
var import_path3 = require("path");
var import_vscode43 = require("vscode");
var SearchLogByRevision = class extends Command2 {
  constructor() {
    super("svn.searchLogByRevision", { repository: true });
  }
  async execute(repository) {
    const input = await import_vscode43.window.showInputBox({ prompt: "Revision?" });
    if (!input) {
      return;
    }
    if (!validateRevision(input)) {
      import_vscode43.window.showErrorMessage("Invalid revision. Please enter a number or keyword (HEAD, BASE, PREV, COMMITTED)");
      return;
    }
    const revision = parseInt(input, 10);
    try {
      const resource = toSvnUri(
        import_vscode43.Uri.file(repository.workspaceRoot),
        "LOG_REVISION" /* LOG_REVISION */,
        { revision }
      );
      const uri = resource.with({
        path: import_path3.posix.join(resource.path, "svn.log")
      });
      await import_vscode43.commands.executeCommand("vscode.open", uri);
    } catch (error) {
      console.error(error);
      import_vscode43.window.showErrorMessage("Unable to log");
    }
  }
};

// src/commands/search_log_by_text.ts
var import_vscode45 = require("vscode");

// src/temp_svn_fs.ts
var import_vscode44 = require("vscode");
var path18 = __toESM(require("path"));
var crypto = __toESM(require("crypto"));
var File = class {
  constructor(name) {
    this.type = import_vscode44.FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
  }
};
var Directory = class {
  constructor(name) {
    this.type = import_vscode44.FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
    this.entries = /* @__PURE__ */ new Map();
  }
};
var TempSvnFs = class {
  constructor() {
    this._emitter = new import_vscode44.EventEmitter();
    this._bufferedEvents = [];
    this._root = new Directory("");
    this._disposables = [];
    this.onDidChangeFile = this._emitter.event;
    this._disposables.push(
      import_vscode44.workspace.registerFileSystemProvider("tempsvnfs", this, {
        isCaseSensitive: true
      }),
      import_vscode44.workspace.onDidCloseTextDocument((event) => {
        if (event.uri.scheme === "tempsvnfs") {
          this.delete(event.uri);
        }
      })
    );
  }
  watch(_resource) {
    return new import_vscode44.Disposable(() => {
    });
  }
  stat(uri) {
    return this._lookup(uri, false);
  }
  readDirectory(uri) {
    const entry = this._lookupAsDirectory(uri, false);
    const result = [];
    for (const [name, child] of entry.entries) {
      result.push([name, child.type]);
    }
    return result;
  }
  createDirectory(uri) {
    const basename12 = path18.posix.basename(uri.path);
    const dirname9 = uri.with({ path: path18.posix.dirname(uri.path) });
    const parent = this._lookupAsDirectory(dirname9, false);
    const entry = new Directory(basename12);
    parent.entries.set(entry.name, entry);
    parent.mtime = Date.now();
    parent.size += 1;
    this._fireSoon(
      { type: import_vscode44.FileChangeType.Changed, uri: dirname9 },
      { type: import_vscode44.FileChangeType.Created, uri }
    );
  }
  readFile(uri) {
    const data = this._lookupAsFile(uri, false).data;
    if (data) {
      return data;
    }
    throw import_vscode44.FileSystemError.FileNotFound();
  }
  writeFile(uri, content, options) {
    const basename12 = path18.posix.basename(uri.path);
    const parent = this._lookupParentDirectory(uri);
    let entry = parent.entries.get(basename12);
    if (entry instanceof Directory) {
      throw import_vscode44.FileSystemError.FileIsADirectory(uri);
    }
    if (!entry && !options.create) {
      throw import_vscode44.FileSystemError.FileNotFound(uri);
    }
    if (entry && options.create && !options.overwrite) {
      throw import_vscode44.FileSystemError.FileExists(uri);
    }
    if (!entry) {
      entry = new File(basename12);
      parent.entries.set(basename12, entry);
      this._fireSoon({ type: import_vscode44.FileChangeType.Created, uri });
    }
    entry.mtime = Date.now();
    entry.size = content.byteLength;
    entry.data = content;
    this._fireSoon({ type: import_vscode44.FileChangeType.Changed, uri });
  }
  delete(uri) {
    const dirname9 = uri.with({ path: path18.posix.dirname(uri.path) });
    const basename12 = path18.posix.basename(uri.path);
    const parent = this._lookupAsDirectory(dirname9, false);
    if (!parent.entries.has(basename12)) {
      throw import_vscode44.FileSystemError.FileNotFound(uri);
    }
    parent.entries.delete(basename12);
    parent.mtime = Date.now();
    parent.size -= 1;
    this._fireSoon(
      { type: import_vscode44.FileChangeType.Changed, uri: dirname9 },
      { type: import_vscode44.FileChangeType.Deleted, uri }
    );
  }
  rename(oldUri, newUri, options) {
    if (!options.overwrite && this._lookup(newUri, true)) {
      throw import_vscode44.FileSystemError.FileExists(newUri);
    }
    const entry = this._lookup(oldUri, false);
    const oldParent = this._lookupParentDirectory(oldUri);
    const newParent = this._lookupParentDirectory(newUri);
    const newName = path18.posix.basename(newUri.path);
    oldParent.entries.delete(entry.name);
    entry.name = newName;
    newParent.entries.set(newName, entry);
    this._fireSoon(
      { type: import_vscode44.FileChangeType.Deleted, uri: oldUri },
      { type: import_vscode44.FileChangeType.Created, uri: newUri }
    );
  }
  async createTempSvnRevisionFile(svnUri, revision, content) {
    const fname = `r${revision}_${path18.basename(svnUri.fsPath)}`;
    const hash = crypto.createHash("md5");
    const filePathHash = hash.update(svnUri.path).digest("hex");
    const encoding = configuration.get("default.encoding");
    let contentBuffer;
    if (encoding) {
      contentBuffer = Buffer.from(iconv.encode(content, encoding));
    } else {
      contentBuffer = Buffer.from(content);
    }
    if (!this._root.entries.has(filePathHash)) {
      this.createDirectory(import_vscode44.Uri.parse(`tempsvnfs:/${filePathHash}`));
    }
    const uri = import_vscode44.Uri.parse(`tempsvnfs:/${filePathHash}/${fname}`, true);
    this.writeFile(uri, contentBuffer, {
      create: true,
      overwrite: true
    });
    return uri;
  }
  dispose() {
    this._disposables.forEach((disposable) => disposable.dispose());
    this._disposables = [];
    for (const [name] of this.readDirectory(import_vscode44.Uri.parse("tempsvnfs:/"))) {
      this.delete(import_vscode44.Uri.parse(`tempsvnfs:/${name}`));
    }
  }
  _lookup(uri, silent) {
    const parts = uri.path.split("/");
    let entry = this._root;
    for (const part of parts) {
      if (!part) {
        continue;
      }
      let child;
      if (entry instanceof Directory) {
        child = entry.entries.get(part);
      }
      if (!child) {
        if (!silent) {
          throw import_vscode44.FileSystemError.FileNotFound(uri);
        } else {
          return void 0;
        }
      }
      entry = child;
    }
    return entry;
  }
  _lookupAsDirectory(uri, silent) {
    const entry = this._lookup(uri, silent);
    if (entry instanceof Directory) {
      return entry;
    }
    throw import_vscode44.FileSystemError.FileNotADirectory(uri);
  }
  _lookupAsFile(uri, silent) {
    const entry = this._lookup(uri, silent);
    if (entry instanceof File) {
      return entry;
    }
    throw import_vscode44.FileSystemError.FileIsADirectory(uri);
  }
  _lookupParentDirectory(uri) {
    const dirname9 = uri.with({ path: path18.posix.dirname(uri.path) });
    return this._lookupAsDirectory(dirname9, false);
  }
  _fireSoon(...events) {
    this._bufferedEvents.push(...events);
    if (this._fireSoonHandler) {
      clearTimeout(this._fireSoonHandler);
    }
    this._fireSoonHandler = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents);
      this._bufferedEvents.length = 0;
    }, 1);
  }
};
var tempSvnFs = new TempSvnFs();

// src/commands/search_log_by_text.ts
var SearchLogByText = class extends Command2 {
  constructor() {
    super("svn.searchLogByText", { repository: true });
  }
  async execute(repository) {
    const input = await import_vscode45.window.showInputBox({ prompt: "Search query" });
    if (!input) {
      return;
    }
    if (!validateSearchPattern(input)) {
      import_vscode45.window.showErrorMessage("Invalid search pattern: contains forbidden characters");
      return;
    }
    const uri = import_vscode45.Uri.parse("tempsvnfs:/svn.log");
    tempSvnFs.writeFile(uri, Buffer.from(""), {
      create: true,
      overwrite: true
    });
    await import_vscode45.commands.executeCommand("vscode.open", uri);
    try {
      const result = await import_vscode45.window.withProgress(
        {
          cancellable: false,
          location: import_vscode45.ProgressLocation.Notification,
          title: "Searching Log"
        },
        async () => {
          return repository.plainLogByText(input);
        }
      );
      tempSvnFs.writeFile(uri, Buffer.from(result), {
        create: true,
        overwrite: true
      });
    } catch (error) {
      import_vscode45.window.showErrorMessage(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error(error);
    }
  }
};

// src/commands/merge.ts
var import_vscode46 = require("vscode");
var Merge = class extends Command2 {
  constructor() {
    super("svn.merge", { repository: true });
  }
  async execute(repository) {
    const branch = await selectBranch(repository);
    if (!branch) {
      return;
    }
    await this.merge(repository, branch);
  }
  async merge(repository, branch) {
    let reintegrate = false;
    if (isTrunk(repository.currentBranch)) {
      reintegrate = true;
    }
    try {
      await repository.merge(branch.path, reintegrate);
    } catch (error) {
      const svnError = error;
      if (svnError.stderrFormated) {
        if (svnError.stderrFormated.includes("try updating first")) {
          const answer = await import_vscode46.window.showErrorMessage(
            "Seems like you need to update first prior to merging. Would you like to update now and try merging again?",
            "Yes",
            "No"
          );
          if (answer === "Yes") {
            await import_vscode46.commands.executeCommand("svn.update");
            await this.merge(repository, branch);
          }
        } else {
          import_vscode46.window.showErrorMessage(
            "Unable to merge branch: " + svnError.stderrFormated
          );
        }
      } else {
        console.log(error);
        import_vscode46.window.showErrorMessage("Unable to merge branch");
      }
    }
  }
};

// src/commands.ts
function registerCommands(sourceControlManager, disposables) {
  disposables.push(new GetSourceControlManager(sourceControlManager));
  disposables.push(new FileOpen());
  disposables.push(new OpenFile());
  disposables.push(new PromptAuth());
  disposables.push(new CommitWithMessage());
  disposables.push(new Add());
  disposables.push(new ChangeList());
  disposables.push(new Refresh());
  disposables.push(new Commit());
  disposables.push(new OpenResourceBase());
  disposables.push(new OpenResourceHead());
  disposables.push(new OpenChangeBase());
  disposables.push(new SwitchBranch());
  disposables.push(new Merge());
  disposables.push(new Revert());
  disposables.push(new Update());
  disposables.push(new PullIncommingChange());
  disposables.push(new PatchAll());
  disposables.push(new Patch());
  disposables.push(new PatchChangeList());
  disposables.push(new Remove());
  disposables.push(new ResolveAll());
  disposables.push(new Resolve());
  disposables.push(new Resolved());
  disposables.push(new Log());
  disposables.push(new RevertChange());
  disposables.push(new Close());
  disposables.push(new Cleanup());
  disposables.push(new RemoveUnversioned());
  disposables.push(new FinishCheckout());
  disposables.push(new AddToIgnoreSCM());
  disposables.push(new AddToIgnoreExplorer());
  disposables.push(new RenameExplorer());
  disposables.push(new Upgrade());
  disposables.push(new OpenChangePrev());
  disposables.push(new PromptRemove());
  disposables.push(new Checkout());
  disposables.push(new RefreshRemoteChanges());
  disposables.push(new DeleteUnversioned());
  disposables.push(new OpenChangeHead());
  disposables.push(new OpenHeadFile());
  disposables.push(new RevertAll());
  disposables.push(new PickCommitMessage(sourceControlManager.svn.version));
  disposables.push(new RevertExplorer());
  disposables.push(new SearchLogByRevision());
  disposables.push(new SearchLogByText());
}

// src/contexts/checkActiveEditor.ts
var import_vscode47 = require("vscode");
var CheckActiveEditor = class {
  constructor(sourceControlManager) {
    this.sourceControlManager = sourceControlManager;
    this.disposables = [];
    sourceControlManager.onDidChangeStatusRepository(
      this.checkHasChangesOnActiveEditor,
      this,
      this.disposables
    );
    import_vscode47.window.onDidChangeActiveTextEditor(
      () => this.checkHasChangesOnActiveEditor(),
      this,
      this.disposables
    );
  }
  checkHasChangesOnActiveEditor() {
    setVscodeContext(
      "svnActiveEditorHasChanges",
      this.hasChangesOnActiveEditor()
    );
  }
  hasChangesOnActiveEditor() {
    if (!import_vscode47.window.activeTextEditor) {
      return false;
    }
    const uri = import_vscode47.window.activeTextEditor.document.uri;
    const repository = this.sourceControlManager.getRepository(uri);
    if (!repository) {
      return false;
    }
    const resource = repository.getResourceFromFile(uri);
    if (!resource) {
      return false;
    }
    switch (resource.type) {
      case "added" /* ADDED */:
      case "deleted" /* DELETED */:
      case "external" /* EXTERNAL */:
      case "ignored" /* IGNORED */:
      case "none" /* NONE */:
      case "normal" /* NORMAL */:
      case "unversioned" /* UNVERSIONED */:
        return false;
      case "conflicted" /* CONFLICTED */:
      case "incomplete" /* INCOMPLETE */:
      case "merged" /* MERGED */:
      case "missing" /* MISSING */:
      case "modified" /* MODIFIED */:
      case "obstructed" /* OBSTRUCTED */:
      case "replaced" /* REPLACED */:
        return true;
    }
    return true;
  }
  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
};
__decorateClass([
  debounce(100)
], CheckActiveEditor.prototype, "checkHasChangesOnActiveEditor", 1);

// src/contexts/openRepositoryCount.ts
var OpenRepositoryCount = class {
  constructor(sourceControlManager) {
    this.sourceControlManager = sourceControlManager;
    this.disposables = [];
    sourceControlManager.onDidOpenRepository(
      this.checkOpened,
      this,
      this.disposables
    );
    sourceControlManager.onDidCloseRepository(
      this.checkOpened,
      this,
      this.disposables
    );
    this.checkOpened();
  }
  checkOpened() {
    setVscodeContext(
      "svnOpenRepositoryCount",
      this.sourceControlManager.repositories.length
    );
  }
  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
};
__decorateClass([
  debounce(100)
], OpenRepositoryCount.prototype, "checkOpened", 1);

// src/historyView/itemLogProvider.ts
var path20 = __toESM(require("path"));
var import_vscode49 = require("vscode");

// src/historyView/common.ts
var import_crypto = require("crypto");
var path19 = __toESM(require("path"));
var import_dayjs = __toESM(require_dayjs_min());
var import_relativeTime = __toESM(require_relativeTime());
var import_vscode48 = require("vscode");
import_dayjs.default.extend(import_relativeTime.default);
var SvnPath = class {
  constructor(path30) {
    this.path = path30;
  }
  toString() {
    return this.path;
  }
};
function transform(array, kind, parent) {
  return array.map((data) => {
    return { kind, data, parent };
  });
}
function getIconObject(iconName) {
  const iconsRootPath2 = path19.join(__dirname, "..", "icons");
  const toUri = (theme) => import_vscode48.Uri.file(path19.join(iconsRootPath2, theme, `${iconName}.svg`));
  return {
    light: toUri("light"),
    dark: toUri("dark")
  };
}
async function copyCommitToClipboard(what, item) {
  const clipboard = import_vscode48.env.clipboard;
  if (clipboard === void 0) {
    import_vscode48.window.showErrorMessage("Clipboard is supported in VS Code 1.30 and newer");
    return;
  }
  if (item.kind === 2 /* Commit */) {
    const commit = item.data;
    switch (what) {
      case "msg":
      case "revision":
        await clipboard.writeText(commit[what]);
    }
  }
}
function needFetch(cached, fetched, limit) {
  if (cached.length && cached[cached.length - 1].revision === "1") {
    return false;
  }
  if (fetched.length === 0 || fetched[fetched.length - 1].revision === "1") {
    return false;
  }
  if (fetched.length < limit) {
    return false;
  }
  return true;
}
function insertBaseMarker(item, entries, out) {
  const baseRev = item.persisted.baseRevision;
  if (entries.length && baseRev && parseInt(entries[0].revision, 10) > baseRev) {
    let i = 1;
    while (entries.length > i && parseInt(entries[i].revision, 10) > baseRev) {
      i++;
    }
    const titem = new import_vscode48.TreeItem("BASE");
    titem.tooltip = "Log entries above do not exist in working copy";
    out.splice(i, 0, { kind: 4 /* TItem */, data: titem });
  }
  return void 0;
}
async function checkIfFile(e, local) {
  if (e.localFullPath === void 0) {
    if (local) {
      import_vscode48.window.showErrorMessage("No working copy for this path");
    }
    return void 0;
  }
  let stat2;
  try {
    stat2 = await lstat(e.localFullPath.fsPath);
  } catch {
    import_vscode48.window.showWarningMessage(
      "Not available from this working copy: " + e.localFullPath
    );
    return false;
  }
  if (!stat2.isFile()) {
    import_vscode48.window.showErrorMessage("This target is not a file");
    return false;
  }
  return true;
}
function getLimit() {
  const limit = Number.parseInt(
    configuration.get("log.length") || "50",
    10
  );
  if (isNaN(limit) || limit <= 0) {
    throw new Error("Invalid log.length setting value");
  }
  return limit;
}
async function fetchMore(cached) {
  let rfrom = cached.persisted.commitFrom;
  const entries = cached.entries;
  if (entries.length) {
    rfrom = entries[entries.length - 1].revision;
    rfrom = (Number.parseInt(rfrom, 10) - 1).toString();
  }
  let moreCommits = [];
  const limit = getLimit();
  try {
    moreCommits = await cached.repo.log(rfrom, "1", limit, cached.svnTarget);
  } catch {
  }
  if (!needFetch(entries, moreCommits, limit)) {
    cached.isComplete = true;
  }
  entries.push(...moreCommits);
}
var gravatarCache = /* @__PURE__ */ new Map();
function md5(s) {
  const data = (0, import_crypto.createHash)("md5");
  data.write(s);
  return data.digest().toString("hex");
}
function getCommitIcon(author, size = 16) {
  if (!configuration.get("gravatars.enabled", true) || author === void 0) {
    return new import_vscode48.ThemeIcon("git-commit");
  }
  let gravatar = gravatarCache.get(author);
  if (gravatar !== void 0) {
    return gravatar;
  }
  const gravitarUrl = configuration.get("gravatar.icon_url", "").replace("<AUTHOR>", author).replace("<AUTHOR_MD5>", md5(author)).replace("<SIZE>", size.toString());
  gravatar = import_vscode48.Uri.parse(gravitarUrl);
  gravatarCache.set(author, gravatar);
  return gravatar;
}
function getCommitDescription(commit) {
  const relativeDate = (0, import_dayjs.default)(commit.date).fromNow();
  return `r${commit.revision}, ${relativeDate} by ${commit.author}`;
}
function getCommitLabel(commit) {
  if (!commit.msg) {
    return "<blank>";
  }
  return commit.msg.split(/\r?\n/, 1)[0];
}
function getCommitToolTip(commit) {
  let date = commit.date;
  if (!isNaN(Date.parse(date))) {
    date = new Date(date).toString();
  }
  return `Author: ${commit.author}
${date}
Revision: ${commit.revision}
Message: ${commit.msg}`;
}
async function downloadFile(repo, arg, revision) {
  if (revision === "BASE") {
    const nm = repo.getPathNormalizer();
    const ri = nm.parse(arg.toString(true));
    const localPath = ri.localFullPath;
    if (localPath === void 0 || !await exists(localPath.path)) {
      const errorMsg = "BASE revision doesn't exist for " + (localPath ? localPath.path : "remote path");
      import_vscode48.window.showErrorMessage(errorMsg);
      throw new Error(errorMsg);
    }
    return localPath;
  }
  let out;
  try {
    out = await repo.show(arg, revision);
  } catch (e) {
    import_vscode48.window.showErrorMessage("Failed to open path");
    throw e;
  }
  return tempSvnFs.createTempSvnRevisionFile(arg, revision, out);
}
async function openDiff(repo, arg1, r1, r2, arg2) {
  const uri1 = await downloadFile(repo, arg1, r1);
  const uri2 = await downloadFile(repo, arg2 || arg1, r2);
  const opts = {
    preview: true
  };
  const title = `${path19.basename(arg1.path)} (${r1} : ${r2})`;
  return import_vscode48.commands.executeCommand("vscode.diff", uri1, uri2, title, opts);
}
async function openFileRemote(repo, arg, against) {
  let out;
  try {
    out = await repo.show(arg, against);
  } catch {
    import_vscode48.window.showErrorMessage("Failed to open path");
    return;
  }
  const localUri = await tempSvnFs.createTempSvnRevisionFile(arg, against, out);
  const opts = {
    preview: true
  };
  return import_vscode48.commands.executeCommand("vscode.open", localUri, opts);
}

// src/historyView/itemLogProvider.ts
var ItemLogProvider = class {
  constructor(sourceControlManager) {
    this.sourceControlManager = sourceControlManager;
    this._onDidChangeTreeData = new import_vscode49.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._dispose = [];
    this._dispose.push(
      import_vscode49.window.onDidChangeActiveTextEditor(this.editorChanged, this),
      import_vscode49.window.registerTreeDataProvider("itemlog", this),
      import_vscode49.commands.registerCommand(
        "svn.itemlog.copymsg",
        async (item) => copyCommitToClipboard("msg", item)
      ),
      import_vscode49.commands.registerCommand(
        "svn.itemlog.copyrevision",
        async (item) => copyCommitToClipboard("revision", item)
      ),
      import_vscode49.commands.registerCommand(
        "svn.itemlog.openFileRemote",
        this.openFileRemoteCmd,
        this
      ),
      import_vscode49.commands.registerCommand("svn.itemlog.openDiff", this.openDiffCmd, this),
      import_vscode49.commands.registerCommand(
        "svn.itemlog.openDiffBase",
        this.openDiffBaseCmd,
        this
      ),
      import_vscode49.commands.registerCommand("svn.itemlog.refresh", this.refresh, this)
    );
    this.refresh();
  }
  dispose() {
    dispose(this._dispose);
  }
  async openFileRemoteCmd(element) {
    const commit = element.data;
    const item = unwrap(this.currentItem);
    return openFileRemote(item.repo, item.svnTarget, commit.revision);
  }
  async openDiffBaseCmd(element) {
    const commit = element.data;
    const item = unwrap(this.currentItem);
    return openDiff(item.repo, item.svnTarget, commit.revision, "BASE");
  }
  async openDiffCmd(element) {
    const commit = element.data;
    const item = unwrap(this.currentItem);
    const pos = item.entries.findIndex((e) => e === commit);
    if (pos === item.entries.length - 1) {
      import_vscode49.window.showWarningMessage("Cannot diff last commit");
      return;
    }
    const prevRev = item.entries[pos + 1].revision;
    return openDiff(item.repo, item.svnTarget, prevRev, commit.revision);
  }
  async editorChanged(te) {
    return this.refresh(void 0, te);
  }
  async refresh(element, te, loadMore) {
    if (loadMore) {
      await fetchMore(unwrap(this.currentItem));
      this._onDidChangeTreeData.fire(element);
      return;
    }
    if (te === void 0) {
      te = import_vscode49.window.activeTextEditor;
    }
    if (te) {
      const uri = te.document.uri;
      if (uri.scheme === "file") {
        const repo = this.sourceControlManager.getRepository(uri);
        if (repo !== null) {
          try {
            const info = await repo.getInfo(uri.fsPath);
            this.currentItem = {
              isComplete: false,
              entries: [],
              repo,
              svnTarget: import_vscode49.Uri.parse(info.url),
              persisted: {
                commitFrom: "HEAD",
                baseRevision: parseInt(info.revision, 10)
              },
              order: 0
            };
          } catch (e) {
          }
        }
      }
      this._onDidChangeTreeData.fire(element);
    }
  }
  async getTreeItem(element) {
    let ti;
    if (element.kind === 2 /* Commit */) {
      const commit = element.data;
      ti = new import_vscode49.TreeItem(getCommitLabel(commit), import_vscode49.TreeItemCollapsibleState.None);
      ti.description = getCommitDescription(commit);
      ti.iconPath = getCommitIcon(commit.author);
      ti.tooltip = getCommitToolTip(commit);
      ti.contextValue = "diffable";
      ti.command = {
        command: "svn.itemlog.openDiff",
        title: "Open diff",
        arguments: [element]
      };
    } else if (element.kind === 4 /* TItem */) {
      ti = element.data;
    } else {
      throw new Error("Shouldn't happen");
    }
    return ti;
  }
  async getChildren(element) {
    if (this.currentItem === void 0) {
      return [];
    }
    if (element === void 0) {
      const fname = path20.basename(this.currentItem.svnTarget.fsPath);
      const ti = new import_vscode49.TreeItem(fname, import_vscode49.TreeItemCollapsibleState.Expanded);
      ti.tooltip = path20.dirname(this.currentItem.svnTarget.fsPath);
      ti.description = path20.dirname(this.currentItem.svnTarget.fsPath);
      ti.iconPath = new import_vscode49.ThemeIcon("history");
      const item = {
        kind: 4 /* TItem */,
        data: ti
      };
      return [item];
    } else {
      const entries = this.currentItem.entries;
      if (entries.length === 0) {
        await fetchMore(this.currentItem);
      }
      const result = transform(entries, 2 /* Commit */);
      insertBaseMarker(this.currentItem, entries, result);
      if (!this.currentItem.isComplete) {
        const ti = new import_vscode49.TreeItem(`Load another ${getLimit()} revisions`);
        const ltItem = {
          kind: 4 /* TItem */,
          data: ti
        };
        ti.tooltip = "Paging size may be adjusted using log.length setting";
        ti.command = {
          command: "svn.itemlog.refresh",
          arguments: [element, void 0, true],
          title: "refresh element"
        };
        ti.iconPath = new import_vscode49.ThemeIcon("unfold");
        result.push(ltItem);
      }
      return result;
    }
  }
};

// src/historyView/repoLogProvider.ts
var path25 = __toESM(require("path"));
var import_vscode58 = require("vscode");

// src/repository.ts
var path24 = __toESM(require("path"));
var import_vscode57 = require("vscode");

// src/services/StatusService.ts
var import_vscode50 = require("vscode");
var path21 = __toESM(require("path"));
var StatusService = class {
  constructor(repository, workspaceRoot, root) {
    this.repository = repository;
    this.workspaceRoot = workspaceRoot;
    this.root = root;
  }
  async updateStatus(options) {
    const config = this.getConfiguration();
    const statuses = await this.fetchStatuses(
      config.combineExternal,
      options.checkRemoteChanges
    );
    const excludeList = this.buildExcludeList(config.filesExclude);
    const { statusExternal, statusesRepository } = await this.separateExternals(
      statuses,
      config.combineExternal
    );
    const categorized = this.categorizeStatuses(
      statusesRepository,
      excludeList,
      config
    );
    return {
      changes: categorized.changes,
      conflicts: categorized.conflicts,
      unversioned: categorized.unversioned,
      changelists: categorized.changelists,
      remoteChanges: categorized.remoteChanges,
      statusExternal,
      statusIgnored: categorized.statusIgnored,
      isIncomplete: categorized.isIncomplete,
      needCleanUp: categorized.needCleanUp
    };
  }
  /**
   * Get configuration values needed for status processing
   */
  getConfiguration() {
    const fileConfig = import_vscode50.workspace.getConfiguration("files", import_vscode50.Uri.file(this.root));
    const filesExclude = fileConfig.get("exclude") ?? {};
    return {
      combineExternal: configuration.get(
        "sourceControl.combineExternalIfSameServer",
        false
      ),
      hideUnversioned: configuration.get(
        "sourceControl.hideUnversioned",
        false
      ),
      ignoreList: configuration.get("sourceControl.ignore", []),
      ignoreOnStatusCountList: configuration.get(
        "sourceControl.ignoreOnStatusCount",
        []
      ),
      countUnversioned: configuration.get(
        "sourceControl.countUnversioned",
        false
      ),
      filesExclude
    };
  }
  /**
   * Fetch statuses from SVN repository
   */
  async fetchStatuses(includeExternals, checkRemoteChanges) {
    return await this.repository.getStatus({
      includeIgnored: true,
      includeExternals,
      checkRemoteChanges
    });
  }
  /**
   * Build exclusion pattern list from files.exclude config
   */
  buildExcludeList(filesExclude) {
    const excludeList = [];
    for (const pattern in filesExclude) {
      if (filesExclude.hasOwnProperty(pattern)) {
        const negate = !filesExclude[pattern];
        excludeList.push((negate ? "!" : "") + pattern);
      }
    }
    return excludeList;
  }
  /**
   * Separate external statuses from repository statuses
   */
  async separateExternals(statuses, combineExternal) {
    let statusExternal = statuses.filter(
      (status) => status.status === "external" /* EXTERNAL */
    );
    if (combineExternal && statusExternal.length) {
      const repositoryUuid = await this.repository.getRepositoryUuid();
      statusExternal = statusExternal.filter(
        (status) => repositoryUuid !== status.repositoryUuid
      );
    }
    const statusesRepository = statuses.filter((status) => {
      if (status.status === "external" /* EXTERNAL */) {
        return false;
      }
      return !statusExternal.some(
        (external) => isDescendant(external.path, status.path)
      );
    });
    return { statusExternal, statusesRepository };
  }
  /**
   * Categorize statuses into resource groups
   */
  categorizeStatuses(statuses, excludeList, config) {
    const changes = [];
    const conflicts = [];
    const unversioned = [];
    const changelists = /* @__PURE__ */ new Map();
    const remoteChanges = [];
    const statusIgnored = [];
    let isIncomplete = false;
    let needCleanUp = false;
    for (const status of statuses) {
      if (status.path === ".") {
        isIncomplete = status.status === "incomplete" /* INCOMPLETE */;
        needCleanUp = status.wcStatus.locked;
      }
      if (status.wcStatus.switched) {
        isIncomplete = true;
      }
      if (status.wcStatus.locked || status.wcStatus.switched || status.status === "incomplete" /* INCOMPLETE */) {
        continue;
      }
      if (matchAll(status.path, excludeList, { dot: true })) {
        continue;
      }
      const uri = import_vscode50.Uri.file(path21.join(this.workspaceRoot, status.path));
      const renameUri = status.rename ? import_vscode50.Uri.file(path21.join(this.workspaceRoot, status.rename)) : void 0;
      if (status.reposStatus) {
        remoteChanges.push(
          new Resource(
            uri,
            status.reposStatus.item,
            void 0,
            status.reposStatus.props,
            true
          )
        );
      }
      const resource = new Resource(
        uri,
        status.status,
        renameUri,
        status.props
      );
      if ((status.status === "normal" /* NORMAL */ || status.status === "none" /* NONE */) && (status.props === "normal" /* NORMAL */ || status.props === "none" /* NONE */) && !status.changelist) {
        continue;
      } else if (status.status === "ignored" /* IGNORED */) {
        statusIgnored.push(status);
      } else if (status.status === "conflicted" /* CONFLICTED */) {
        conflicts.push(resource);
      } else if (status.status === "unversioned" /* UNVERSIONED */) {
        if (config.hideUnversioned) {
          continue;
        }
        const matches = status.path.match(
          /(.+?)\.(mine|working|merge-\w+\.r\d+|r\d+)$/
        );
        if (matches && matches[1] && statuses.some((s) => s.path === matches[1])) {
          continue;
        }
        if (config.ignoreList.length > 0 && matchAll(path21.sep + status.path, config.ignoreList, {
          dot: true,
          matchBase: true
        })) {
          continue;
        }
        unversioned.push(resource);
      } else if (status.changelist) {
        let changelist = changelists.get(status.changelist);
        if (!changelist) {
          changelist = [];
        }
        changelist.push(resource);
        changelists.set(status.changelist, changelist);
      } else {
        changes.push(resource);
      }
    }
    return {
      changes,
      conflicts,
      unversioned,
      changelists,
      remoteChanges,
      statusIgnored,
      isIncomplete,
      needCleanUp
    };
  }
};

// src/services/ResourceGroupManager.ts
var import_vscode51 = require("vscode");
var ResourceGroupManager = class {
  /**
   * @param sourceControl VS Code SourceControl instance
   * @param parentDisposables Parent's disposable array to register cleanup
   */
  constructor(sourceControl, parentDisposables) {
    this.sourceControl = sourceControl;
    this._changelists = /* @__PURE__ */ new Map();
    this._disposables = [];
    this._prevChangelistsSize = 0;
    this._changes = this.createGroup("changes", "Changes");
    this._changes.hideWhenEmpty = true;
    this._conflicts = this.createGroup("conflicts", "Conflicts");
    this._conflicts.hideWhenEmpty = true;
    this._unversioned = this.createGroup("unversioned", "Unversioned");
    this._unversioned.hideWhenEmpty = true;
    this._disposables.push(this._changes, this._conflicts);
    this._disposables.push(toDisposable(() => this._unversioned.dispose()));
    this._disposables.push(
      toDisposable(() => {
        if (this._remoteChanges) {
          this._remoteChanges.dispose();
        }
      })
    );
    parentDisposables.push(
      toDisposable(() => this.dispose())
    );
  }
  get changes() {
    return this._changes;
  }
  get conflicts() {
    return this._conflicts;
  }
  get unversioned() {
    return this._unversioned;
  }
  get changelists() {
    return this._changelists;
  }
  get remoteChanges() {
    return this._remoteChanges;
  }
  /**
   * Update all resource groups from status result.
   * Returns the total count for source control badge.
   */
  updateGroups(data) {
    var _a, _b;
    const { result, config } = data;
    this._changes.resourceStates = result.changes;
    this._conflicts.resourceStates = result.conflicts;
    this._changelists.forEach((group) => {
      group.resourceStates = [];
    });
    result.changelists.forEach((resources, changelist) => {
      let group = this._changelists.get(changelist);
      if (!group) {
        group = this.createGroup(
          `changelist-${changelist}`,
          `Changelist "${changelist}"`
        );
        group.hideWhenEmpty = true;
        this._disposables.push(group);
        this._changelists.set(changelist, group);
      }
      group.resourceStates = resources;
    });
    const currentChangelists = new Set(result.changelists.keys());
    this._changelists.forEach((group, changelist) => {
      if (!currentChangelists.has(changelist)) {
        group.dispose();
        this._changelists.delete(changelist);
      }
    });
    if (this._prevChangelistsSize !== this._changelists.size) {
      this._unversioned.dispose();
      this._unversioned = this.createGroup("unversioned", "Unversioned");
      this._unversioned.hideWhenEmpty = true;
    }
    this._unversioned.resourceStates = result.unversioned;
    if (!this._remoteChanges || this._prevChangelistsSize !== this._changelists.size) {
      const tempResourceStates = ((_a = this._remoteChanges) == null ? void 0 : _a.resourceStates) ?? [];
      (_b = this._remoteChanges) == null ? void 0 : _b.dispose();
      this._remoteChanges = this.createGroup("remotechanges", "Remote Changes");
      this._remoteChanges.hideWhenEmpty = true;
      this._remoteChanges.resourceStates = tempResourceStates;
    }
    this._remoteChanges.resourceStates = result.remoteChanges;
    this._prevChangelistsSize = this._changelists.size;
    return this.calculateCount(config);
  }
  /**
   * Find resource by URI across all groups
   */
  getResourceFromFile(uri) {
    if (typeof uri === "string") {
      uri = import_vscode51.Uri.file(uri);
    }
    const groups = [
      this._changes,
      this._conflicts,
      this._unversioned,
      ...this._changelists.values()
    ];
    const uriString = uri.toString();
    for (const group of groups) {
      for (const resource of group.resourceStates) {
        if (uriString === resource.resourceUri.toString() && resource instanceof Resource) {
          return resource;
        }
      }
    }
    return void 0;
  }
  /**
   * Calculate source control count based on configuration
   */
  calculateCount(config) {
    const counts = [this._changes, this._conflicts];
    this._changelists.forEach((group, changelist) => {
      if (!config.ignoreOnStatusCountList.includes(changelist)) {
        counts.push(group);
      }
    });
    if (config.countUnversioned) {
      counts.push(this._unversioned);
    }
    return counts.reduce((sum, group) => sum + group.resourceStates.length, 0);
  }
  /**
   * Create a resource group
   */
  createGroup(id, label) {
    return this.sourceControl.createResourceGroup(
      id,
      label
    );
  }
  /**
   * Clear all resource states and dispose remote changes
   */
  clearAll() {
    var _a;
    this._changes.resourceStates = [];
    this._unversioned.resourceStates = [];
    this._conflicts.resourceStates = [];
    this._changelists.forEach((group, _changelist) => {
      group.resourceStates = [];
    });
    (_a = this._remoteChanges) == null ? void 0 : _a.dispose();
    this._remoteChanges = void 0;
  }
  /**
   * Dispose all managed groups
   */
  dispose() {
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
    this._changelists.clear();
  }
};

// src/services/RemoteChangeService.ts
var RemoteChangeService = class {
  /**
   * @param onPoll Callback invoked at each poll interval
   * @param getConfig Function to retrieve current config (allows dynamic updates)
   */
  constructor(onPoll, getConfig) {
    this.onPoll = onPoll;
    this.getConfig = getConfig;
    this.disposed = false;
  }
  start() {
    if (this.disposed) {
      throw new Error("Cannot start disposed RemoteChangeService");
    }
    this.stop();
    const config = this.getConfig();
    const frequencyMs = config.checkFrequencySeconds * 1e3;
    if (frequencyMs === 0) {
      return;
    }
    this.interval = setInterval(() => {
      void this.onPoll();
    }, frequencyMs);
  }
  stop() {
    if (this.interval !== void 0) {
      clearInterval(this.interval);
      this.interval = void 0;
    }
  }
  restart() {
    this.start();
  }
  get isRunning() {
    return this.interval !== void 0;
  }
  dispose() {
    this.stop();
    this.disposed = true;
  }
};

// src/operationsImpl.ts
var OperationsImpl = class {
  constructor() {
    this.operations = /* @__PURE__ */ new Map();
  }
  start(operation) {
    this.operations.set(operation, (this.operations.get(operation) || 0) + 1);
  }
  end(operation) {
    const count = (this.operations.get(operation) || 0) - 1;
    if (count <= 0) {
      this.operations.delete(operation);
    } else {
      this.operations.set(operation, count);
    }
  }
  isRunning(operation) {
    return this.operations.has(operation);
  }
  isIdle() {
    const operations = this.operations.keys();
    for (const operation of operations) {
      if (!isReadOnly(operation)) {
        return false;
      }
    }
    return true;
  }
};

// src/pathNormalizer.ts
var import_path5 = require("path");
var nativepath = __toESM(require("path"));
var import_vscode53 = require("vscode");

// src/svnRI.ts
var import_path4 = require("path");
var import_vscode52 = require("vscode");
function pathOrRoot(uri) {
  return uri.path || "/";
}
var SvnRI = class {
  constructor(remoteRoot, branchRoot, checkoutRoot, _path, _revision) {
    this.remoteRoot = remoteRoot;
    this.branchRoot = branchRoot;
    this.checkoutRoot = checkoutRoot;
    this._path = _path;
    this._revision = _revision;
    if (_path.length === 0 || _path.charAt(0) === "/") {
      throw new Error("Invalid _path " + _path);
    }
  }
  get remoteFullPath() {
    return import_vscode52.Uri.parse(this.remoteRoot.toString() + "/" + this._path);
  }
  get localFullPath() {
    if (this.checkoutRoot === void 0) {
      return void 0;
    }
    return import_vscode52.Uri.file(
      import_path4.posix.join(
        this.checkoutRoot.path,
        import_path4.posix.relative(this.fromRepoToBranch, this._path)
      )
    );
  }
  get relativeFromBranch() {
    return import_path4.posix.relative(this.fromRepoToBranch, this._path);
  }
  get fromRepoToBranch() {
    return import_path4.posix.relative(
      pathOrRoot(this.remoteRoot),
      pathOrRoot(this.branchRoot)
    );
  }
  get revision() {
    return this._revision;
  }
  toString(withRevision) {
    return this.remoteFullPath + (withRevision ? this._revision || "" : "");
  }
};
__decorateClass([
  memoize
], SvnRI.prototype, "remoteFullPath", 1);
__decorateClass([
  memoize
], SvnRI.prototype, "localFullPath", 1);
__decorateClass([
  memoize
], SvnRI.prototype, "relativeFromBranch", 1);
__decorateClass([
  memoize
], SvnRI.prototype, "fromRepoToBranch", 1);
__decorateClass([
  memoize
], SvnRI.prototype, "revision", 1);
__decorateClass([
  memoize
], SvnRI.prototype, "toString", 1);

// src/pathNormalizer.ts
var PathNormalizer = class {
  constructor(repoInfo) {
    this.repoInfo = repoInfo;
    this.repoRoot = import_vscode53.Uri.parse(repoInfo.repository.root);
    this.branchRoot = import_vscode53.Uri.parse(repoInfo.url);
    if (repoInfo.wcInfo && repoInfo.wcInfo.wcrootAbspath) {
      this.checkoutRoot = import_vscode53.Uri.file(repoInfo.wcInfo.wcrootAbspath);
    }
  }
  /** svn://foo.org/domain/trunk/x -> trunk/x */
  getFullRepoPathFromUrl(fpath) {
    if (fpath.startsWith("/")) {
      return fpath.substr(1);
    } else if (fpath.startsWith("svn://") || fpath.startsWith("file://")) {
      const target = import_vscode53.Uri.parse(fpath).path;
      return import_path5.posix.relative(pathOrRoot(this.repoRoot), target);
    } else {
      throw new Error("unknown path");
    }
  }
  parse(fpath, kind = 2 /* RemoteFull */, rev) {
    let target;
    if (kind === 2 /* RemoteFull */) {
      target = this.getFullRepoPathFromUrl(fpath);
    } else if (kind === 1 /* LocalFull */) {
      if (!import_path5.posix.isAbsolute(fpath)) {
        throw new Error("Path isn't absolute");
      }
      if (this.checkoutRoot === void 0) {
        throw new Error("Local paths are not");
      }
      target = nativepath.relative(this.checkoutRoot.fsPath, fpath);
      target = import_path5.posix.join(this.fromRootToBranch(), target);
    } else if (kind === 0 /* LocalRelative */) {
      if (import_path5.posix.isAbsolute(fpath)) {
        throw new Error("Path is absolute");
      }
      if (this.checkoutRoot === void 0) {
        throw new Error("Local paths are not");
      }
      target = import_path5.posix.join(this.fromRootToBranch(), fpath);
    } else {
      throw new Error("unsupported kind");
    }
    return new SvnRI(
      this.repoRoot,
      this.branchRoot,
      this.checkoutRoot,
      target,
      rev
    );
  }
  fromRootToBranch() {
    return import_path5.posix.relative(
      pathOrRoot(this.repoRoot),
      pathOrRoot(this.branchRoot)
    );
  }
  fromBranchToRoot() {
    return import_path5.posix.relative(
      pathOrRoot(this.branchRoot),
      pathOrRoot(this.repoRoot)
    );
  }
};
__decorateClass([
  memoize
], PathNormalizer.prototype, "fromRootToBranch", 1);
__decorateClass([
  memoize
], PathNormalizer.prototype, "fromBranchToRoot", 1);

// src/statusbar/checkoutStatusBar.ts
var import_vscode54 = require("vscode");
var CheckoutStatusBar = class {
  constructor(repository) {
    this.repository = repository;
    this._onDidChange = new import_vscode54.EventEmitter();
    this.disposables = [];
    repository.onDidChangeStatus(
      this._onDidChange.fire,
      this._onDidChange,
      this.disposables
    );
    repository.onDidChangeOperations(
      this._onDidChange.fire,
      this._onDidChange,
      this.disposables
    );
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  get command() {
    if (!this.repository.currentBranch) {
      return;
    }
    const isSwitchRunning = this.repository.operations.isRunning("SwitchBranch" /* SwitchBranch */) || this.repository.operations.isRunning("NewBranch" /* NewBranch */);
    const title = `$(git-branch) ${this.repository.currentBranch}${isSwitchRunning ? ` (Switching)` : ""}`;
    return {
      command: "svn.switchBranch",
      tooltip: "Switch Branch...",
      title,
      arguments: [this.repository.sourceControl]
    };
  }
  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
};

// src/statusbar/syncStatusBar.ts
var import_vscode55 = require("vscode");
var _SyncStatusBar = class _SyncStatusBar {
  constructor(repository) {
    this.repository = repository;
    this._onDidChange = new import_vscode55.EventEmitter();
    this.disposables = [];
    this._state = _SyncStatusBar.startState;
    repository.onDidChangeStatus(this.onModelChange, this, this.disposables);
    repository.onDidChangeOperations(
      this.onOperationsChange,
      this,
      this.disposables
    );
    this._onDidChange.fire();
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  get state() {
    return this._state;
  }
  set state(state) {
    this._state = state;
    this._onDidChange.fire();
  }
  onOperationsChange() {
    const isSyncRunning = this.repository.operations.isRunning("SwitchBranch" /* SwitchBranch */) || this.repository.operations.isRunning("NewBranch" /* NewBranch */) || this.repository.operations.isRunning("Update" /* Update */) || this.repository.operations.isRunning("Merge" /* Merge */);
    const isStatusRemoteRunning = this.repository.operations.isRunning(
      "StatusRemote" /* StatusRemote */
    );
    const isOperationRunning = !this.repository.operations.isIdle();
    this.state = {
      ...this.state,
      isStatusRemoteRunning,
      isOperationRunning,
      isSyncRunning
    };
  }
  onModelChange() {
    this.state = {
      ...this.state,
      remoteChangedFiles: this.repository.remoteChangedFiles
    };
  }
  get command() {
    let icon = "$(sync)";
    let text = "";
    let command = "";
    let tooltip = "";
    if (this.state.isSyncRunning) {
      command = "";
      icon = "$(sync~spin)";
      text = "";
      tooltip = "Updating Revision...";
    } else if (this.state.isStatusRemoteRunning) {
      command = "";
      icon = "$(sync~spin)";
      text = "";
      tooltip = "Checking remote updates...";
    } else if (this.state.isOperationRunning) {
      command = "";
      icon = "$(sync~spin)";
      text = "Running";
      tooltip = "Running...";
    } else if (this.state.needCleanUp) {
      command = "svn.cleanup";
      icon = "$(alert)";
      text = "Need cleanup";
      tooltip = "Run cleanup command";
    } else if (this.state.isIncomplete) {
      command = "svn.finishCheckout";
      icon = "$(issue-reopened)";
      text = "Incomplete (Need finish checkout)";
      tooltip = "Run update to complete";
    } else if (this.state.remoteChangedFiles > 0) {
      icon = "$(cloud-download)";
      command = "svn.update";
      tooltip = "Update Revision";
      text = `${this.state.remoteChangedFiles}\u2193`;
    } else {
      command = "svn.update";
      tooltip = "Update Revision";
    }
    return {
      command,
      title: [icon, text].join(" ").trim(),
      tooltip,
      arguments: [this.repository]
    };
  }
  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
};
_SyncStatusBar.startState = {
  isIncomplete: false,
  isOperationRunning: false,
  isStatusRemoteRunning: false,
  isSyncRunning: false,
  needCleanUp: false,
  remoteChangedFiles: 0
};
var SyncStatusBar = _SyncStatusBar;

// src/statusbar/statusBarCommands.ts
var StatusBarCommands = class {
  constructor(repository) {
    this.disposables = [];
    this.checkoutStatusBar = new CheckoutStatusBar(repository);
    this.syncStatusBar = new SyncStatusBar(repository);
    this.disposables.push(this.checkoutStatusBar, this.syncStatusBar);
  }
  get onDidChange() {
    return anyEvent(
      this.syncStatusBar.onDidChange,
      this.checkoutStatusBar.onDidChange
    );
  }
  get commands() {
    const result = [];
    const checkout = this.checkoutStatusBar.command;
    if (checkout) {
      result.push(checkout);
    }
    const sync = this.syncStatusBar.command;
    if (sync) {
      result.push(sync);
    }
    return result;
  }
  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }
};

// src/watchers/repositoryFilesWatcher.ts
var import_vscode56 = require("vscode");
var import_fs9 = require("fs");
var import_path6 = require("path");
var RepositoryFilesWatcher = class {
  constructor(root) {
    this.root = root;
    this.disposables = [];
    const fsWatcher = import_vscode56.workspace.createFileSystemWatcher(
      new import_vscode56.RelativePattern(fixPathSeparator(root), "**")
    );
    this._onRepoChange = new import_vscode56.EventEmitter();
    this._onRepoCreate = new import_vscode56.EventEmitter();
    this._onRepoDelete = new import_vscode56.EventEmitter();
    let onRepoChange;
    let onRepoCreate;
    let onRepoDelete;
    if (typeof import_vscode56.workspace.workspaceFolders !== "undefined" && !import_vscode56.workspace.workspaceFolders.filter((w) => isDescendant(w.uri.fsPath, root)).length) {
      const repoWatcher = (0, import_fs9.watch)(
        (0, import_path6.join)(root, getSvnDir()),
        this.repoWatch.bind(this)
      );
      repoWatcher.on("error", (error) => {
        throw error;
      });
      onRepoChange = this._onRepoChange.event;
      onRepoCreate = this._onRepoCreate.event;
      onRepoDelete = this._onRepoDelete.event;
    }
    this.disposables.push(fsWatcher);
    const isTmp = (uri) => /[\\\/](\.svn|_svn)[\\\/]tmp/.test(uri.path);
    const isRelevant = (uri) => !isTmp(uri);
    this.onDidChange = filterEvent(fsWatcher.onDidChange, isRelevant);
    this.onDidCreate = filterEvent(fsWatcher.onDidCreate, isRelevant);
    this.onDidDelete = filterEvent(fsWatcher.onDidDelete, isRelevant);
    this.onDidAny = anyEvent(
      this.onDidChange,
      this.onDidCreate,
      this.onDidDelete
    );
    const svnPattern = /[\\\/](\.svn|_svn)[\\\/]/;
    const ignoreSvn = (uri) => !svnPattern.test(uri.path);
    this.onDidWorkspaceChange = filterEvent(this.onDidChange, ignoreSvn);
    this.onDidWorkspaceCreate = filterEvent(this.onDidCreate, ignoreSvn);
    this.onDidWorkspaceDelete = filterEvent(this.onDidDelete, ignoreSvn);
    this.onDidWorkspaceAny = anyEvent(
      this.onDidWorkspaceChange,
      this.onDidWorkspaceCreate,
      this.onDidWorkspaceDelete
    );
    const ignoreWorkspace = (uri) => svnPattern.test(uri.path);
    this.onDidSvnChange = filterEvent(this.onDidChange, ignoreWorkspace);
    this.onDidSvnCreate = filterEvent(this.onDidCreate, ignoreWorkspace);
    this.onDidSvnDelete = filterEvent(this.onDidDelete, ignoreWorkspace);
    if (onRepoChange && onRepoCreate && onRepoDelete) {
      this.onDidSvnChange = onRepoChange;
      this.onDidSvnCreate = onRepoCreate;
      this.onDidSvnDelete = onRepoDelete;
    }
    this.onDidSvnAny = anyEvent(
      this.onDidSvnChange,
      this.onDidSvnCreate,
      this.onDidSvnDelete
    );
  }
  repoWatch(event, filename) {
    if (!filename) {
      return;
    }
    if (event === "change") {
      this._onRepoChange.fire(import_vscode56.Uri.parse(filename));
    } else if (event === "rename") {
      exists(filename).then((doesExist) => {
        if (doesExist) {
          this._onRepoCreate.fire(import_vscode56.Uri.parse(filename));
        } else {
          this._onRepoDelete.fire(import_vscode56.Uri.parse(filename));
        }
      });
    }
  }
  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
};
__decorateClass([
  debounce(1e3)
], RepositoryFilesWatcher.prototype, "repoWatch", 1);

// src/repository.ts
function shouldShowProgress(operation) {
  switch (operation) {
    case "CurrentBranch" /* CurrentBranch */:
    case "Show" /* Show */:
    case "Info" /* Info */:
      return false;
    default:
      return true;
  }
}
var Repository2 = class {
  constructor(repository, secrets) {
    this.repository = repository;
    this.secrets = secrets;
    this.statusIgnored = [];
    this.statusExternal = [];
    this.disposables = [];
    this.currentBranch = "";
    this.remoteChangedFiles = 0;
    this.isIncomplete = false;
    this.needCleanUp = false;
    this.deletedUris = [];
    this.canSaveAuth = false;
    this._onDidChangeRepository = new import_vscode57.EventEmitter();
    this.onDidChangeRepository = this._onDidChangeRepository.event;
    this._onDidChangeState = new import_vscode57.EventEmitter();
    this.onDidChangeState = this._onDidChangeState.event;
    this._onDidChangeStatus = new import_vscode57.EventEmitter();
    this.onDidChangeStatus = this._onDidChangeStatus.event;
    this._onDidChangeRemoteChangedFiles = new import_vscode57.EventEmitter();
    this.onDidChangeRemoteChangedFile = this._onDidChangeRemoteChangedFiles.event;
    this._onRunOperation = new import_vscode57.EventEmitter();
    this.onRunOperation = this._onRunOperation.event;
    this._onDidRunOperation = new import_vscode57.EventEmitter();
    this.onDidRunOperation = this._onDidRunOperation.event;
    this._operations = new OperationsImpl();
    this._state = 0 /* Idle */;
    this.statusService = new StatusService(
      repository,
      repository.workspaceRoot,
      repository.root
    );
    this._fsWatcher = new RepositoryFilesWatcher(repository.root);
    this.disposables.push(this._fsWatcher);
    this._fsWatcher.onDidAny(this.onFSChange, this, this.disposables);
    this._fsWatcher.onDidSvnAny(
      async (e) => {
        await this.onDidAnyFileChanged(e);
      },
      this,
      this.disposables
    );
    this.sourceControl = import_vscode57.scm.createSourceControl(
      "svn",
      "SVN",
      import_vscode57.Uri.file(repository.workspaceRoot)
    );
    this.sourceControl.count = 0;
    this.sourceControl.inputBox.placeholder = "Message (press Ctrl+Enter to commit)";
    this.sourceControl.acceptInputCommand = {
      command: "svn.commitWithMessage",
      title: "commit",
      arguments: [this.sourceControl]
    };
    this.sourceControl.quickDiffProvider = this;
    this.disposables.push(this.sourceControl);
    this.statusBar = new StatusBarCommands(this);
    this.disposables.push(this.statusBar);
    this.statusBar.onDidChange(
      () => this.sourceControl.statusBarCommands = this.statusBar.commands,
      null,
      this.disposables
    );
    this.groupManager = new ResourceGroupManager(
      this.sourceControl,
      this.disposables
    );
    this.remoteChangeService = new RemoteChangeService(
      () => this.updateRemoteChangedFiles(),
      () => ({
        checkFrequencySeconds: configuration.get(
          "remoteChanges.checkFrequency",
          300
        )
      })
    );
    this._fsWatcher.onDidWorkspaceDelete(
      (uri) => this.deletedUris.push(uri),
      this,
      this.disposables
    );
    this.onDidChangeStatus(this.actionForDeletedFiles, this, this.disposables);
    this.remoteChangeService.start();
    this.updateRemoteChangedFiles();
    configuration.onDidChange((e) => {
      if (e.affectsConfiguration("svn.remoteChanges.checkFrequency")) {
        this.remoteChangeService.restart();
        this.updateRemoteChangedFiles();
      }
    });
    this.status();
    this.disposables.push(
      import_vscode57.workspace.onDidSaveTextDocument((document) => {
        this.onDidSaveTextDocument(document);
      })
    );
  }
  // Property accessors for backward compatibility
  get changes() {
    return this.groupManager.changes;
  }
  get conflicts() {
    return this.groupManager.conflicts;
  }
  get unversioned() {
    return this.groupManager.unversioned;
  }
  get changelists() {
    return this.groupManager.changelists;
  }
  get remoteChanges() {
    return this.groupManager.remoteChanges;
  }
  get fsWatcher() {
    return this._fsWatcher;
  }
  get onDidChangeOperations() {
    return anyEvent(
      this.onRunOperation,
      this.onDidRunOperation
    );
  }
  get operations() {
    return this._operations;
  }
  get state() {
    return this._state;
  }
  set state(state) {
    this._state = state;
    this._onDidChangeState.fire(state);
    this.groupManager.clearAll();
    this.isIncomplete = false;
    this.needCleanUp = false;
  }
  get root() {
    return this.repository.root;
  }
  get workspaceRoot() {
    return this.repository.workspaceRoot;
  }
  /** 'svn://repo.x/branches/b1' e.g. */
  get branchRoot() {
    return import_vscode57.Uri.parse(this.repository.info.url);
  }
  get inputBox() {
    return this.sourceControl.inputBox;
  }
  get username() {
    return this.repository.username;
  }
  set username(username) {
    this.repository.username = username;
  }
  get password() {
    return this.repository.password;
  }
  set password(password) {
    this.repository.password = password;
  }
  async onDidAnyFileChanged(e) {
    await this.repository.updateInfo();
    this._onDidChangeRepository.fire(e);
  }
  async actionForDeletedFiles() {
    if (!this.deletedUris.length) {
      return;
    }
    const allUris = this.deletedUris;
    this.deletedUris = [];
    const actionForDeletedFiles = configuration.get(
      "delete.actionForDeletedFiles",
      "prompt"
    );
    if (actionForDeletedFiles === "none") {
      return;
    }
    const resources = allUris.map((uri) => this.getResourceFromFile(uri)).filter(
      (resource) => resource && resource.type === "missing" /* MISSING */
    );
    let uris = resources.map((resource) => resource.resourceUri);
    if (!uris.length) {
      return;
    }
    const ignoredRulesForDeletedFiles = configuration.get(
      "delete.ignoredRulesForDeletedFiles",
      []
    );
    const rules = ignoredRulesForDeletedFiles.map((ignored) => match2(ignored));
    if (rules.length) {
      uris = uris.filter((uri) => {
        const relativePath = this.repository.removeAbsolutePath(uri.fsPath);
        return !rules.some(
          (rule) => rule.match(relativePath) || rule.match(uri.fsPath)
        );
      });
    }
    if (!uris.length) {
      return;
    }
    if (actionForDeletedFiles === "remove") {
      return this.removeFiles(
        uris.map((uri) => uri.fsPath),
        false
      );
    } else if (actionForDeletedFiles === "prompt") {
      return import_vscode57.commands.executeCommand("svn.promptRemove", ...uris);
    }
    return;
  }
  async updateRemoteChangedFiles() {
    const updateFreq = configuration.get(
      "remoteChanges.checkFrequency",
      300
    );
    if (updateFreq) {
      this.run("StatusRemote" /* StatusRemote */);
    } else {
      if (this.groupManager.remoteChanges) {
        this.groupManager.remoteChanges.resourceStates = [];
      }
    }
  }
  onFSChange(_uri) {
    const autorefresh = configuration.get("autorefresh");
    if (!autorefresh) {
      return;
    }
    if (!this.operations.isIdle()) {
      return;
    }
    this.eventuallyUpdateWhenIdleAndWait();
  }
  eventuallyUpdateWhenIdleAndWait() {
    this.updateWhenIdleAndWait();
  }
  async updateWhenIdleAndWait() {
    await this.whenIdleAndFocused();
    await this.status();
    await timeout(5e3);
  }
  async whenIdleAndFocused() {
    while (true) {
      if (!this.operations.isIdle()) {
        await eventToPromise(this.onDidRunOperation);
        continue;
      }
      if (!import_vscode57.window.state.focused) {
        const onDidFocusWindow = filterEvent(
          import_vscode57.window.onDidChangeWindowState,
          (e) => e.focused
        );
        await eventToPromise(onDidFocusWindow);
        continue;
      }
      return;
    }
  }
  async updateModelState(checkRemoteChanges = false) {
    const result = await this.retryRun(async () => {
      return this.statusService.updateStatus({ checkRemoteChanges });
    });
    this.statusExternal = [...result.statusExternal];
    this.statusIgnored = [...result.statusIgnored];
    this.isIncomplete = result.isIncomplete;
    this.needCleanUp = result.needCleanUp;
    const count = this.groupManager.updateGroups({
      result,
      config: {
        ignoreOnStatusCountList: configuration.get(
          "sourceControl.ignoreOnStatusCount",
          []
        ),
        countUnversioned: configuration.get(
          "sourceControl.countUnversioned",
          false
        )
      }
    });
    this.sourceControl.count = count;
    if (this.groupManager.remoteChanges) {
      this.groupManager.remoteChanges.repository = this;
    }
    if (checkRemoteChanges && result.remoteChanges.length !== this.remoteChangedFiles) {
      this.remoteChangedFiles = result.remoteChanges.length;
      this._onDidChangeRemoteChangedFiles.fire();
    }
    this._onDidChangeStatus.fire();
    this.currentBranch = await this.getCurrentBranch();
    return Promise.resolve();
  }
  getResourceFromFile(uri) {
    return this.groupManager.getResourceFromFile(uri);
  }
  provideOriginalResource(uri) {
    if (uri.scheme !== "file") {
      return;
    }
    if (isDescendant(path24.join(this.root, getSvnDir()), uri.fsPath)) {
      return;
    }
    return toSvnUri(uri, "SHOW" /* SHOW */, {}, true);
  }
  async getBranches() {
    try {
      return await this.repository.getBranches();
    } catch (error) {
      return [];
    }
  }
  async status() {
    return this.run("Status" /* Status */);
  }
  async show(filePath, revision) {
    return this.run("Show" /* Show */, () => {
      return this.repository.show(filePath, revision);
    });
  }
  async showBuffer(filePath, revision) {
    return this.run("Show" /* Show */, () => {
      return this.repository.showBuffer(filePath, revision);
    });
  }
  async addFiles(files) {
    return this.run("Add" /* Add */, () => this.repository.addFiles(files));
  }
  async addChangelist(files, changelist) {
    return this.run(
      "AddChangelist" /* AddChangelist */,
      () => this.repository.addChangelist(files, changelist)
    );
  }
  async removeChangelist(files) {
    return this.run(
      "RemoveChangelist" /* RemoveChangelist */,
      () => this.repository.removeChangelist(files)
    );
  }
  async getCurrentBranch() {
    return this.run("CurrentBranch" /* CurrentBranch */, async () => {
      return this.repository.getCurrentBranch();
    });
  }
  async newBranch(name, commitMessage = "Created new branch") {
    return this.run("NewBranch" /* NewBranch */, async () => {
      await this.repository.newBranch(name, commitMessage);
      this.updateRemoteChangedFiles();
    });
  }
  async switchBranch(name, force = false) {
    await this.run("SwitchBranch" /* SwitchBranch */, async () => {
      await this.repository.switchBranch(name, force);
      this.updateRemoteChangedFiles();
    });
  }
  async merge(name, reintegrate = false, accept_action = "postpone") {
    await this.run("Merge" /* Merge */, async () => {
      await this.repository.merge(name, reintegrate, accept_action);
      this.updateRemoteChangedFiles();
    });
  }
  async updateRevision(ignoreExternals = false) {
    return this.run("Update" /* Update */, async () => {
      const response = await this.repository.update(ignoreExternals);
      this.updateRemoteChangedFiles();
      return response;
    });
  }
  async pullIncomingChange(path30) {
    return this.run("Update" /* Update */, async () => {
      const response = await this.repository.pullIncomingChange(path30);
      this.updateRemoteChangedFiles();
      return response;
    });
  }
  async resolve(files, action) {
    return this.run(
      "Resolve" /* Resolve */,
      () => this.repository.resolve(files, action)
    );
  }
  async commitFiles(message, files) {
    return this.run(
      "Commit" /* Commit */,
      () => this.repository.commitFiles(message, files)
    );
  }
  async revert(files, depth) {
    return this.run(
      "Revert" /* Revert */,
      () => this.repository.revert(files, depth)
    );
  }
  async info(path30) {
    return this.run("Info" /* Info */, () => this.repository.getInfo(path30));
  }
  async patch(files) {
    return this.run("Patch" /* Patch */, () => this.repository.patch(files));
  }
  async patchBuffer(files) {
    return this.run("Patch" /* Patch */, () => this.repository.patchBuffer(files));
  }
  async patchChangelist(changelistName) {
    return this.run(
      "Patch" /* Patch */,
      () => this.repository.patchChangelist(changelistName)
    );
  }
  async removeFiles(files, keepLocal) {
    return this.run(
      "Remove" /* Remove */,
      () => this.repository.removeFiles(files, keepLocal)
    );
  }
  async plainLog() {
    return this.run("Log" /* Log */, () => this.repository.plainLog());
  }
  async plainLogBuffer() {
    return this.run("Log" /* Log */, () => this.repository.plainLogBuffer());
  }
  async plainLogByRevision(revision) {
    return this.run(
      "Log" /* Log */,
      () => this.repository.plainLogByRevision(revision)
    );
  }
  async plainLogByRevisionBuffer(revision) {
    return this.run(
      "Log" /* Log */,
      () => this.repository.plainLogByRevisionBuffer(revision)
    );
  }
  async plainLogByText(search) {
    return this.run(
      "Log" /* Log */,
      () => this.repository.plainLogByText(search)
    );
  }
  async plainLogByTextBuffer(search) {
    return this.run(
      "Log" /* Log */,
      () => this.repository.plainLogByTextBuffer(search)
    );
  }
  async log(rfrom, rto, limit, target) {
    return this.run(
      "Log" /* Log */,
      () => this.repository.log(rfrom, rto, limit, target)
    );
  }
  async logByUser(user) {
    return this.run("Log" /* Log */, () => this.repository.logByUser(user));
  }
  async cleanup() {
    return this.run("CleanUp" /* CleanUp */, () => this.repository.cleanup());
  }
  async removeUnversioned() {
    return this.run(
      "CleanUp" /* CleanUp */,
      () => this.repository.removeUnversioned()
    );
  }
  async getInfo(path30, revision) {
    return this.run(
      "Info" /* Info */,
      () => this.repository.getInfo(path30, revision, true)
    );
  }
  async getChanges() {
    return this.run("Changes" /* Changes */, () => this.repository.getChanges());
  }
  async finishCheckout() {
    return this.run(
      "SwitchBranch" /* SwitchBranch */,
      () => this.repository.finishCheckout()
    );
  }
  async addToIgnore(expressions, directory, recursive = false) {
    return this.run(
      "Ignore" /* Ignore */,
      () => this.repository.addToIgnore(expressions, directory, recursive)
    );
  }
  async rename(oldFile, newFile) {
    return this.run(
      "Rename" /* Rename */,
      () => this.repository.rename(oldFile, newFile)
    );
  }
  async list(filePath) {
    return this.run("List" /* List */, () => {
      return this.repository.ls(filePath);
    });
  }
  getPathNormalizer() {
    return new PathNormalizer(this.repository.info);
  }
  getCredentialServiceName() {
    var _a;
    let key = "vscode.positron-svn";
    const info = this.repository.info;
    if ((_a = info.repository) == null ? void 0 : _a.root) {
      key += ":" + info.repository.root;
    } else if (info.url) {
      key += ":" + info.url;
    }
    return key;
  }
  async loadStoredAuths() {
    if (this.lastPromptAuth) {
      await this.lastPromptAuth;
    }
    const secret = await this.secrets.get(this.getCredentialServiceName());
    if (secret === void 0) {
      return [];
    }
    const credentials = JSON.parse(secret);
    return credentials;
  }
  async saveAuth() {
    if (this.canSaveAuth && this.username && this.password) {
      const secret = await this.secrets.get(this.getCredentialServiceName());
      let credentials = [];
      if (typeof secret === "string") {
        credentials = JSON.parse(secret);
      }
      credentials.push({
        account: this.username,
        password: this.password
      });
      await this.secrets.store(
        this.getCredentialServiceName(),
        JSON.stringify(credentials)
      );
      this.canSaveAuth = false;
    }
  }
  async promptAuth() {
    if (this.lastPromptAuth) {
      return this.lastPromptAuth;
    }
    this.lastPromptAuth = import_vscode57.commands.executeCommand("svn.promptAuth");
    const result = await this.lastPromptAuth;
    if (result) {
      this.username = result.username;
      this.password = result.password;
      this.canSaveAuth = true;
    }
    this.lastPromptAuth = void 0;
    return result;
  }
  onDidSaveTextDocument(document) {
    const uriString = document.uri.toString();
    const conflict = this.conflicts.resourceStates.find(
      (resource) => resource.resourceUri.toString() === uriString
    );
    if (!conflict) {
      return;
    }
    const text = document.getText();
    if (!/^<{7}[^]+^={7}[^]+^>{7}/m.test(text)) {
      import_vscode57.commands.executeCommand("svn.resolved", conflict.resourceUri);
    }
  }
  async run(operation, runOperation = () => Promise.resolve(null)) {
    if (this.state !== 0 /* Idle */) {
      throw new Error("Repository not initialized");
    }
    const run = async () => {
      this._operations.start(operation);
      this._onRunOperation.fire(operation);
      try {
        const result = await this.retryRun(runOperation);
        const checkRemote = operation === "StatusRemote" /* StatusRemote */;
        if (!isReadOnly(operation)) {
          await this.updateModelState(checkRemote);
        }
        return result;
      } catch (err) {
        const svnError = err;
        if (svnError.svnErrorCode === svnErrorCodes.NotASvnRepository) {
          this.state = 1 /* Disposed */;
        }
        const rootExists = await exists(this.workspaceRoot);
        if (!rootExists) {
          await import_vscode57.commands.executeCommand("svn.close", this);
        }
        throw err;
      } finally {
        this._operations.end(operation);
        this._onDidRunOperation.fire(operation);
      }
    };
    return shouldShowProgress(operation) ? import_vscode57.window.withProgress({ location: import_vscode57.ProgressLocation.SourceControl }, run) : run();
  }
  async retryRun(runOperation = () => Promise.resolve(null)) {
    let attempt = 0;
    let accounts = [];
    while (true) {
      try {
        attempt++;
        const result = await runOperation();
        this.saveAuth();
        return result;
      } catch (err) {
        const svnError = err;
        if (svnError.svnErrorCode === svnErrorCodes.RepositoryIsLocked && attempt <= 10) {
          await timeout(Math.pow(attempt, 2) * 50);
        } else if (svnError.svnErrorCode === svnErrorCodes.AuthorizationFailed && attempt <= 1 + accounts.length) {
          if (attempt === 1) {
            accounts = await this.loadStoredAuths();
          }
          const index = accounts.length - 1;
          if (typeof accounts[index] !== "undefined") {
            this.username = accounts[index].account;
            this.password = accounts[index].password;
          }
        } else if (svnError.svnErrorCode === svnErrorCodes.AuthorizationFailed && attempt <= 3 + accounts.length) {
          const result = await this.promptAuth();
          if (!result) {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }
  }
  dispose() {
    this.disposables = dispose(this.disposables);
  }
};
__decorateClass([
  memoize
], Repository2.prototype, "onDidChangeOperations", 1);
__decorateClass([
  debounce(1e3)
], Repository2.prototype, "onDidAnyFileChanged", 1);
__decorateClass([
  debounce(1e3)
], Repository2.prototype, "actionForDeletedFiles", 1);
__decorateClass([
  debounce(1e3)
], Repository2.prototype, "updateRemoteChangedFiles", 1);
__decorateClass([
  debounce(1e3)
], Repository2.prototype, "eventuallyUpdateWhenIdleAndWait", 1);
__decorateClass([
  throttle
], Repository2.prototype, "updateWhenIdleAndWait", 1);
__decorateClass([
  throttle,
  globalSequentialize("updateModelState")
], Repository2.prototype, "updateModelState", 1);
__decorateClass([
  throttle
], Repository2.prototype, "status", 1);

// src/historyView/repoLogProvider.ts
function getActionIcon(action) {
  let name;
  switch (action) {
    case "A":
      name = "status-added";
      break;
    case "D":
      name = "status-deleted";
      break;
    case "M":
      name = "status-modified";
      break;
    case "R":
      name = "status-renamed";
      break;
  }
  if (name === void 0) {
    return void 0;
  }
  return getIconObject(name);
}
var RepoLogProvider = class {
  constructor(sourceControlManager) {
    this.sourceControlManager = sourceControlManager;
    this._onDidChangeTreeData = new import_vscode58.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    // TODO on-disk cache?
    this.logCache = /* @__PURE__ */ new Map();
    this._dispose = [];
    this.refresh();
    this._dispose.push(
      import_vscode58.window.registerTreeDataProvider("repolog", this),
      import_vscode58.commands.registerCommand(
        "svn.repolog.copymsg",
        async (item) => copyCommitToClipboard("msg", item)
      ),
      import_vscode58.commands.registerCommand(
        "svn.repolog.copyrevision",
        async (item) => copyCommitToClipboard("revision", item)
      ),
      import_vscode58.commands.registerCommand(
        "svn.repolog.addrepolike",
        this.addRepolikeGui,
        this
      ),
      import_vscode58.commands.registerCommand("svn.repolog.remove", this.removeRepo, this),
      import_vscode58.commands.registerCommand(
        "svn.repolog.openFileRemote",
        this.openFileRemoteCmd,
        this
      ),
      import_vscode58.commands.registerCommand("svn.repolog.openDiff", this.openDiffCmd, this),
      import_vscode58.commands.registerCommand(
        "svn.repolog.openFileLocal",
        this.openFileLocal,
        this
      ),
      import_vscode58.commands.registerCommand("svn.repolog.refresh", this.refresh, this),
      this.sourceControlManager.onDidChangeRepository(
        async (_e) => {
          return this.refresh();
        }
      )
    );
  }
  getCached(maybeItem) {
    const item = unwrap(maybeItem);
    if (item.data instanceof SvnPath) {
      return unwrap(this.logCache.get(item.data.toString()));
    }
    return this.getCached(item.parent);
  }
  dispose() {
    dispose(this._dispose);
  }
  removeRepo(element) {
    this.logCache.delete(element.data.toString());
    this.refresh();
  }
  async addRepolike(repoLike, rev) {
    const item = {
      entries: [],
      isComplete: false,
      svnTarget: {},
      // later
      repo: {},
      // later
      persisted: {
        commitFrom: rev,
        userAdded: true
      },
      order: this.logCache.size
    };
    if (this.logCache.has(repoLike)) {
      import_vscode58.window.showWarningMessage("This path is already added");
      return;
    }
    const repo = this.sourceControlManager.getRepository(repoLike);
    if (repo === null) {
      try {
        let uri;
        if (repoLike.startsWith("^")) {
          const wsrepo = this.sourceControlManager.getRepository(
            unwrap(import_vscode58.workspace.workspaceFolders)[0].uri
          );
          if (!wsrepo) {
            throw new Error("No repository in workspace root");
          }
          const info = await wsrepo.getInfo(repoLike);
          uri = import_vscode58.Uri.parse(info.url);
        } else {
          uri = import_vscode58.Uri.parse(repoLike);
        }
        if (rev !== "HEAD" && isNaN(parseInt(rev, 10))) {
          throw new Error("erroneous revision");
        }
        const remRepo = await this.sourceControlManager.getRemoteRepository(
          uri
        );
        item.repo = remRepo;
        item.svnTarget = uri;
      } catch (e) {
        import_vscode58.window.showWarningMessage(
          "Failed to add repo: " + (e instanceof Error ? e.message : "")
        );
        return;
      }
    } else {
      try {
        const svninfo = await repo.getInfo(repoLike, rev);
        item.repo = repo;
        item.svnTarget = import_vscode58.Uri.parse(svninfo.url);
        item.persisted.baseRevision = parseInt(svninfo.revision, 10);
      } catch (e) {
        import_vscode58.window.showErrorMessage("Failed to resolve svn path");
        return;
      }
    }
    const repoName = item.svnTarget.toString(true);
    if (this.logCache.has(repoName)) {
      import_vscode58.window.showWarningMessage("Repository with this name already exists");
      return;
    }
    this.logCache.set(repoName, item);
    this._onDidChangeTreeData.fire(void 0);
  }
  addRepolikeGui() {
    const box = import_vscode58.window.createInputBox();
    box.prompt = "Enter SVN URL or local path";
    box.onDidAccept(async () => {
      let repoLike = box.value;
      if (!path25.isAbsolute(repoLike) && import_vscode58.workspace.workspaceFolders && !repoLike.startsWith("^") && !/^[a-z]+?:\/\//.test(repoLike)) {
        for (const wsf of import_vscode58.workspace.workspaceFolders) {
          const joined = path25.join(wsf.uri.fsPath, repoLike);
          if (await exists(joined)) {
            repoLike = joined;
            break;
          }
        }
      }
      box.dispose();
      const box2 = import_vscode58.window.createInputBox();
      box2.prompt = "Enter starting revision (optional)";
      box2.onDidAccept(async () => {
        const rev = box2.value;
        box2.dispose();
        return this.addRepolike(repoLike, rev || "HEAD");
      }, void 0);
      box2.show();
    });
    box.show();
  }
  async openFileRemoteCmd(element) {
    const commit = element.data;
    const item = this.getCached(element);
    const ri = item.repo.getPathNormalizer().parse(commit._);
    if (await checkIfFile(ri, false) === false) {
      return;
    }
    const parent = element.parent.data;
    return openFileRemote(item.repo, ri.remoteFullPath, parent.revision);
  }
  openFileLocal(element) {
    const commit = element.data;
    const item = this.getCached(element);
    const ri = item.repo.getPathNormalizer().parse(commit._);
    if (!checkIfFile(ri, true)) {
      return;
    }
    import_vscode58.commands.executeCommand("vscode.open", unwrap(ri.localFullPath));
  }
  async openDiffCmd(element) {
    const commit = element.data;
    const item = this.getCached(element);
    const parent = element.parent.data;
    const remotePath = item.repo.getPathNormalizer().parse(commit._).remoteFullPath;
    let prevRev;
    const revs = await item.repo.log(parent.revision, "1", 2, remotePath);
    if (revs.length === 2) {
      prevRev = revs[1];
    } else {
      import_vscode58.window.showWarningMessage("Cannot find previous commit");
      return;
    }
    return openDiff(item.repo, remotePath, prevRev.revision, parent.revision);
  }
  async refresh(element, fetchMoreClick) {
    if (element === void 0) {
      for (const [k, v] of this.logCache) {
        if (!v.persisted.userAdded) {
          this.logCache.delete(k);
        }
      }
      for (const repo of this.sourceControlManager.repositories) {
        const remoteRoot = repo.branchRoot;
        const repoUrl = remoteRoot.toString(true);
        let persisted = {
          commitFrom: "HEAD",
          baseRevision: parseInt(repo.repository.info.revision, 10)
        };
        const prev = this.logCache.get(repoUrl);
        if (prev) {
          persisted = prev.persisted;
        }
        this.logCache.set(repoUrl, {
          entries: [],
          isComplete: false,
          repo,
          svnTarget: remoteRoot,
          persisted,
          order: this.logCache.size
        });
      }
    } else if (element.kind === 1 /* Repo */) {
      const cached = this.getCached(element);
      if (fetchMoreClick) {
        await fetchMore(cached);
      } else {
        cached.entries = [];
        cached.isComplete = false;
      }
    }
    this._onDidChangeTreeData.fire(element);
  }
  async getTreeItem(element) {
    let ti;
    if (element.kind === 1 /* Repo */) {
      const svnTarget = element.data;
      const cached = this.getCached(element);
      ti = new import_vscode58.TreeItem(
        svnTarget.toString(),
        import_vscode58.TreeItemCollapsibleState.Collapsed
      );
      if (cached.persisted.userAdded) {
        ti.label = "\u2218 " + ti.label;
        ti.contextValue = "userrepo";
      } else {
        ti.contextValue = "repo";
      }
      if (cached.repo instanceof Repository2) {
        ti.iconPath = new import_vscode58.ThemeIcon("folder-opened");
      } else {
        ti.iconPath = new import_vscode58.ThemeIcon("repo");
      }
      const from = cached.persisted.commitFrom || "HEAD";
      ti.tooltip = `${svnTarget} since ${from}`;
    } else if (element.kind === 2 /* Commit */) {
      const commit = element.data;
      ti = new import_vscode58.TreeItem(
        getCommitLabel(commit),
        import_vscode58.TreeItemCollapsibleState.Collapsed
      );
      ti.description = getCommitDescription(commit);
      ti.tooltip = getCommitToolTip(commit);
      ti.iconPath = getCommitIcon(commit.author);
      ti.contextValue = "commit";
    } else if (element.kind === 3 /* CommitDetail */) {
      const pathElem = element.data;
      const basename12 = path25.basename(pathElem._);
      ti = new import_vscode58.TreeItem(basename12, import_vscode58.TreeItemCollapsibleState.None);
      ti.description = path25.dirname(pathElem._);
      const cached = this.getCached(element);
      const nm = cached.repo.getPathNormalizer();
      ti.tooltip = nm.parse(pathElem._).relativeFromBranch;
      ti.iconPath = getActionIcon(pathElem.action);
      ti.contextValue = "diffable";
      ti.command = {
        command: "svn.repolog.openDiff",
        title: "Open diff",
        arguments: [element]
      };
    } else if (element.kind === 4 /* TItem */) {
      ti = element.data;
    } else {
      throw new Error("Unknown tree elem");
    }
    return ti;
  }
  async getChildren(element) {
    if (element === void 0) {
      return transform(
        Array.from(this.logCache.entries()).sort(([_lk, lv], [_rk, rv]) => {
          if (lv.persisted.userAdded !== rv.persisted.userAdded) {
            return lv.persisted.userAdded ? 1 : -1;
          }
          return lv.order - rv.order;
        }).map(([k, _v]) => new SvnPath(k)),
        1 /* Repo */
      );
    } else if (element.kind === 1 /* Repo */) {
      const limit = getLimit();
      const cached = this.getCached(element);
      const logentries = cached.entries;
      if (logentries.length === 0) {
        await fetchMore(cached);
      }
      const result = transform(logentries, 2 /* Commit */, element);
      insertBaseMarker(cached, logentries, result);
      if (!cached.isComplete) {
        const ti = new import_vscode58.TreeItem(`Load another ${limit} revisions`);
        ti.tooltip = "Paging size may be adjusted using log.length setting";
        ti.command = {
          command: "svn.repolog.refresh",
          arguments: [element, true],
          title: "refresh element"
        };
        ti.iconPath = new import_vscode58.ThemeIcon("unfold");
        result.push({ kind: 4 /* TItem */, data: ti });
      }
      return result;
    } else if (element.kind === 2 /* Commit */) {
      const commit = element.data;
      return transform(commit.paths, 3 /* CommitDetail */, element);
    }
    return [];
  }
};

// src/source_control_manager.ts
var path26 = __toESM(require("path"));
var import_vscode60 = require("vscode");

// src/remoteRepository.ts
var import_vscode59 = require("vscode");
var RemoteRepository = class _RemoteRepository {
  constructor(repo) {
    this.repo = repo;
    this.info = repo.info;
  }
  static async open(svn, uri) {
    const repo = await svn.open(uri.toString(true), "");
    return new _RemoteRepository(repo);
  }
  getPathNormalizer() {
    return new PathNormalizer(this.info);
  }
  get branchRoot() {
    return import_vscode59.Uri.parse(this.info.url);
  }
  async log(rfrom, rto, limit, target) {
    return this.repo.log(rfrom, rto, limit, target);
  }
  async show(filePath, revision) {
    return this.repo.show(filePath, revision);
  }
};

// src/source_control_manager.ts
var SourceControlManager = class {
  constructor(_svn, policy, extensionContact) {
    this._svn = _svn;
    this.extensionContact = extensionContact;
    this._onDidOpenRepository = new import_vscode60.EventEmitter();
    this.onDidOpenRepository = this._onDidOpenRepository.event;
    this._onDidCloseRepository = new import_vscode60.EventEmitter();
    this.onDidCloseRepository = this._onDidCloseRepository.event;
    this._onDidChangeRepository = new import_vscode60.EventEmitter();
    this.onDidChangeRepository = this._onDidChangeRepository.event;
    this._onDidChangeStatusRepository = new import_vscode60.EventEmitter();
    this.onDidChangeStatusRepository = this._onDidChangeStatusRepository.event;
    this.openRepositories = [];
    this.disposables = [];
    this.enabled = false;
    this.possibleSvnRepositoryPaths = /* @__PURE__ */ new Set();
    this.ignoreList = [];
    this.maxDepth = 0;
    this._onDidChangeState = new import_vscode60.EventEmitter();
    this.onDidchangeState = this._onDidChangeState.event;
    this._state = "uninitialized";
    if (policy !== 0 /* Async */) {
      throw new Error("Unsopported policy");
    }
    this.enabled = configuration.get("enabled") === true;
    this.configurationChangeDisposable = import_vscode60.workspace.onDidChangeConfiguration(
      this.onDidChangeConfiguration,
      this
    );
    return (async () => {
      if (this.enabled) {
        await this.enable();
      }
      return this;
    })();
  }
  get state() {
    return this._state;
  }
  setState(state) {
    this._state = state;
    this._onDidChangeState.fire(state);
  }
  get isInitialized() {
    if (this._state === "initialized") {
      return Promise.resolve();
    }
    return eventToPromise(
      filterEvent(this.onDidchangeState, (s) => s === "initialized")
    );
  }
  get repositories() {
    return this.openRepositories.map((r) => r.repository);
  }
  get svn() {
    return this._svn;
  }
  openRepositoriesSorted() {
    return this.openRepositories.sort(
      (a, b) => b.repository.workspaceRoot.length - a.repository.workspaceRoot.length
    );
  }
  onDidChangeConfiguration() {
    const enabled = configuration.get("enabled") === true;
    this.maxDepth = configuration.get("multipleFolders.depth", 0);
    if (enabled === this.enabled) {
      return;
    }
    this.enabled = enabled;
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }
  async enable() {
    const multipleFolders = configuration.get(
      "multipleFolders.enabled",
      false
    );
    if (multipleFolders) {
      this.maxDepth = configuration.get("multipleFolders.depth", 0);
      this.ignoreList = configuration.get("multipleFolders.ignore", []);
    }
    import_vscode60.workspace.onDidChangeWorkspaceFolders(
      this.onDidChangeWorkspaceFolders,
      this,
      this.disposables
    );
    const fsWatcher = import_vscode60.workspace.createFileSystemWatcher("**");
    this.disposables.push(fsWatcher);
    const onWorkspaceChange = anyEvent(
      fsWatcher.onDidChange,
      fsWatcher.onDidCreate,
      fsWatcher.onDidDelete
    );
    const onPossibleSvnRepositoryChange = filterEvent(
      onWorkspaceChange,
      (uri) => uri.scheme === "file" && !this.getRepository(uri)
    );
    onPossibleSvnRepositoryChange(
      this.onPossibleSvnRepositoryChange,
      this,
      this.disposables
    );
    this.setState("initialized");
    await this.scanWorkspaceFolders();
  }
  onPossibleSvnRepositoryChange(uri) {
    const possibleSvnRepositoryPath = uri.fsPath.replace(/\.svn.*$/, "");
    this.eventuallyScanPossibleSvnRepository(possibleSvnRepositoryPath);
  }
  eventuallyScanPossibleSvnRepository(path30) {
    this.possibleSvnRepositoryPaths.add(path30);
    this.eventuallyScanPossibleSvnRepositories();
  }
  eventuallyScanPossibleSvnRepositories() {
    for (const path30 of this.possibleSvnRepositoryPaths) {
      this.tryOpenRepository(path30, 1);
    }
    this.possibleSvnRepositoryPaths.clear();
  }
  scanExternals(repository) {
    const shouldScanExternals = configuration.get("detectExternals") === true;
    if (!shouldScanExternals) {
      return;
    }
    repository.statusExternal.map((r) => path26.join(repository.workspaceRoot, r.path)).forEach((p) => this.eventuallyScanPossibleSvnRepository(p));
  }
  scanIgnored(repository) {
    const shouldScan = configuration.get("detectIgnored") === true;
    if (!shouldScan) {
      return;
    }
    repository.statusIgnored.map((r) => path26.join(repository.workspaceRoot, r.path)).forEach((p) => this.eventuallyScanPossibleSvnRepository(p));
  }
  disable() {
    this.repositories.forEach((repository) => repository.dispose());
    this.openRepositories = [];
    this.possibleSvnRepositoryPaths.clear();
    this.disposables = dispose(this.disposables);
  }
  async onDidChangeWorkspaceFolders({
    added,
    removed
  }) {
    const possibleRepositoryFolders = added.filter(
      (folder) => !this.getOpenRepository(folder.uri)
    );
    const openRepositoriesToDispose = removed.map((folder) => this.getOpenRepository(folder.uri.fsPath)).filter((repository) => !!repository).filter(
      (repository) => !(import_vscode60.workspace.workspaceFolders || []).some(
        (f) => repository.repository.workspaceRoot.startsWith(f.uri.fsPath)
      )
    );
    possibleRepositoryFolders.forEach(
      (p) => this.tryOpenRepository(p.uri.fsPath)
    );
    openRepositoriesToDispose.forEach((r) => r.repository.dispose());
  }
  async scanWorkspaceFolders() {
    for (const folder of import_vscode60.workspace.workspaceFolders || []) {
      const root = folder.uri.fsPath;
      await this.tryOpenRepository(root);
    }
  }
  async tryOpenRepository(path30, level = 0) {
    if (this.getRepository(path30)) {
      return;
    }
    const checkParent = level === 0;
    if (await isSvnFolder(path30, checkParent)) {
      const resourceConfig = import_vscode60.workspace.getConfiguration("svn", import_vscode60.Uri.file(path30));
      const ignoredRepos = new Set(
        (resourceConfig.get("ignoreRepositories") || []).map(
          (p) => normalizePath(p)
        )
      );
      if (ignoredRepos.has(normalizePath(path30))) {
        return;
      }
      try {
        const repositoryRoot = await this.svn.getRepositoryRoot(path30);
        const repository = new Repository2(
          await this.svn.open(repositoryRoot, path30),
          this.extensionContact.secrets
        );
        this.open(repository);
      } catch (err) {
        if (err instanceof SvnError) {
          if (err.svnErrorCode === svnErrorCodes.WorkingCopyIsTooOld) {
            await import_vscode60.commands.executeCommand("svn.upgrade", path30);
            return;
          }
        }
        console.error(err);
      }
      return;
    }
    const newLevel = level + 1;
    if (newLevel <= this.maxDepth) {
      let files = [];
      try {
        files = await readdir(path30);
      } catch (error) {
        return;
      }
      for (const file of files) {
        const dir = path30 + "/" + file;
        let stats;
        try {
          stats = await stat(dir);
        } catch (error) {
          continue;
        }
        if (stats.isDirectory() && !matchAll(dir, this.ignoreList, { dot: true })) {
          await this.tryOpenRepository(dir, newLevel);
        }
      }
    }
  }
  async getRemoteRepository(uri) {
    return RemoteRepository.open(this.svn, uri);
  }
  getRepository(hint) {
    const liveRepository = this.getOpenRepository(hint);
    if (liveRepository && liveRepository.repository) {
      return liveRepository.repository;
    }
    return null;
  }
  getOpenRepository(hint) {
    if (!hint) {
      return void 0;
    }
    if (hint instanceof Repository2) {
      return this.openRepositories.find((r) => r.repository === hint);
    }
    if (hint.repository instanceof Repository2) {
      return this.openRepositories.find(
        (r) => r.repository === hint.repository
      );
    }
    if (typeof hint === "string") {
      hint = import_vscode60.Uri.file(hint);
    }
    if (hint instanceof import_vscode60.Uri) {
      return this.openRepositoriesSorted().find((liveRepository) => {
        if (!isDescendant(liveRepository.repository.workspaceRoot, hint.fsPath)) {
          return false;
        }
        for (const external of liveRepository.repository.statusExternal) {
          const externalPath = path26.join(
            liveRepository.repository.workspaceRoot,
            external.path
          );
          if (isDescendant(externalPath, hint.fsPath)) {
            return false;
          }
        }
        for (const ignored of liveRepository.repository.statusIgnored) {
          const ignoredPath = path26.join(
            liveRepository.repository.workspaceRoot,
            ignored.path
          );
          if (isDescendant(ignoredPath, hint.fsPath)) {
            return false;
          }
        }
        return true;
      });
    }
    for (const liveRepository of this.openRepositories) {
      const repository = liveRepository.repository;
      if (hint === repository.sourceControl) {
        return liveRepository;
      }
      if (hint === repository.changes) {
        return liveRepository;
      }
    }
    return void 0;
  }
  async getRepositoryFromUri(uri) {
    for (const liveRepository of this.openRepositoriesSorted()) {
      const repository = liveRepository.repository;
      if (!isDescendant(repository.workspaceRoot, uri.fsPath)) {
        continue;
      }
      try {
        const path30 = normalizePath(uri.fsPath);
        await repository.info(path30);
        return repository;
      } catch (error) {
      }
    }
    return null;
  }
  open(repository) {
    const onDidDisappearRepository = filterEvent(
      repository.onDidChangeState,
      (state) => state === 1 /* Disposed */
    );
    const disappearListener = onDidDisappearRepository(() => dispose3());
    const changeListener = repository.onDidChangeRepository(
      (uri) => this._onDidChangeRepository.fire({ repository, uri })
    );
    const changeStatus = repository.onDidChangeStatus(() => {
      this._onDidChangeStatusRepository.fire(repository);
    });
    const statusListener = repository.onDidChangeStatus(() => {
      this.scanExternals(repository);
      this.scanIgnored(repository);
    });
    this.scanExternals(repository);
    this.scanIgnored(repository);
    const dispose3 = () => {
      disappearListener.dispose();
      changeListener.dispose();
      changeStatus.dispose();
      statusListener.dispose();
      repository.dispose();
      this.openRepositories = this.openRepositories.filter(
        (e) => e !== openRepository
      );
      this._onDidCloseRepository.fire(repository);
    };
    const openRepository = { repository, dispose: dispose3 };
    this.openRepositories.push(openRepository);
    this._onDidOpenRepository.fire(repository);
  }
  close(repository) {
    const openRepository = this.getOpenRepository(repository);
    if (!openRepository) {
      return;
    }
    openRepository.dispose();
  }
  async pickRepository() {
    if (this.openRepositories.length === 0) {
      throw new Error("There are no available repositories");
    }
    const picks = this.repositories.map((repository) => {
      return {
        label: path26.basename(repository.root),
        repository
      };
    });
    const placeHolder = "Choose a repository";
    const pick = await import_vscode60.window.showQuickPick(picks, { placeHolder });
    return pick && pick.repository;
  }
  async upgradeWorkingCopy(folderPath) {
    try {
      const result = await this.svn.exec(folderPath, ["upgrade"]);
      return result.exitCode === 0;
    } catch (e) {
      console.log(e);
    }
    return false;
  }
  dispose() {
    this.disable();
    this.configurationChangeDisposable.dispose();
  }
};
__decorateClass([
  debounce(500)
], SourceControlManager.prototype, "eventuallyScanPossibleSvnRepositories", 1);

// src/svnFinder.ts
var cp2 = __toESM(require("child_process"));
var path27 = __toESM(require("path"));
var semver2 = __toESM(require_semver2());
var SvnFinder = class {
  findSvn(hint) {
    const first = hint ? this.findSpecificSvn(hint) : Promise.reject(null);
    return first.then(void 0, () => {
      switch (process.platform) {
        case "darwin":
          return this.findSvnDarwin();
        case "win32":
          return this.findSvnWin32();
        default:
          return this.findSpecificSvn("svn");
      }
    }).then((svn) => this.checkSvnVersion(svn)).then(
      null,
      () => Promise.reject(new Error("Svn installation not found."))
    );
  }
  findSvnWin32() {
    return this.findSystemSvnWin32(process.env.ProgramW6432).then(
      void 0,
      () => this.findSystemSvnWin32(process.env["ProgramFiles(x86)"])
    ).then(void 0, () => this.findSystemSvnWin32(process.env.ProgramFiles)).then(void 0, () => this.findSpecificSvn("svn"));
  }
  findSystemSvnWin32(base) {
    if (!base) {
      return Promise.reject("Not found");
    }
    return this.findSpecificSvn(
      path27.join(base, "TortoiseSVN", "bin", "svn.exe")
    );
  }
  findSvnDarwin() {
    return new Promise((c, e) => {
      cp2.exec("which svn", (err, svnPathBuffer) => {
        if (err) {
          return e("svn not found");
        }
        const path30 = svnPathBuffer.toString().replace(/^\s+|\s+$/g, "");
        function getVersion(path31) {
          cp2.exec("svn --version --quiet", (err2, stdout) => {
            if (err2) {
              return e("svn not found");
            }
            return c({ path: path31, version: stdout.trim() });
          });
        }
        if (path30 !== "/usr/bin/svn") {
          return getVersion(path30);
        }
        cp2.exec("xcode-select -p", (err2) => {
          if (err2 && err2.code === 2) {
            return e("svn not found");
          }
          getVersion(path30);
        });
      });
    });
  }
  findSpecificSvn(path30) {
    return new Promise((c, e) => {
      const buffers = [];
      const child = cp2.spawn(path30, ["--version", "--quiet"]);
      child.stdout.on("data", (b) => buffers.push(b));
      child.on("error", cpErrorHandler(e));
      child.on(
        "close",
        (code) => code ? e(new Error("Not found")) : c({
          path: path30,
          version: Buffer.concat(buffers).toString("utf8").trim()
        })
      );
    });
  }
  checkSvnVersion(svn) {
    return new Promise((c, e) => {
      const version = svn.version.replace(/^(\d+\.\d+\.\d+).*/, "$1");
      if (!semver2.valid(version)) {
        e(new Error("Invalid svn version"));
      } else if (!semver2.gte(version, "1.6.0")) {
        e(new Error("Required svn version must be >= 1.6"));
      } else {
        c(svn);
      }
    });
  }
};

// src/treeView/dataProviders/svnProvider.ts
var import_vscode64 = require("vscode");

// src/treeView/nodes/repositoryNode.ts
var path28 = __toESM(require("path"));
var import_vscode63 = require("vscode");

// src/treeView/nodes/incomingChangesNode.ts
var import_vscode62 = require("vscode");

// src/treeView/nodes/noIncomingChangesNode.ts
var import_vscode61 = require("vscode");
var NoIncomingChangesNode = class {
  getTreeItem() {
    const item = new import_vscode61.TreeItem(
      "No Incoming Changes",
      import_vscode61.TreeItemCollapsibleState.None
    );
    return item;
  }
  async getChildren() {
    return [];
  }
};

// src/treeView/nodes/incomingChangesNode.ts
var IncomingChangesNode = class {
  constructor(repository) {
    this.repository = repository;
  }
  getTreeItem() {
    const item = new import_vscode62.TreeItem(
      "Incoming Changes",
      import_vscode62.TreeItemCollapsibleState.Collapsed
    );
    item.iconPath = {
      dark: getIconUri2("download", "dark"),
      light: getIconUri2("download", "light")
    };
    return item;
  }
  async getChildren() {
    if (!this.repository.remoteChanges) {
      return [];
    }
    const changes = this.repository.remoteChanges.resourceStates.map(
      (remoteChange) => {
        return new IncomingChangeNode(
          remoteChange.resourceUri,
          remoteChange.type,
          this.repository
        );
      }
    );
    if (changes.length === 0) {
      return [new NoIncomingChangesNode()];
    }
    return changes;
  }
};

// src/treeView/nodes/repositoryNode.ts
var RepositoryNode = class {
  constructor(repository, svnProvider) {
    this.repository = repository;
    this.svnProvider = svnProvider;
    repository.onDidChangeStatus(() => {
      this.svnProvider.update(this);
    });
  }
  get label() {
    return path28.basename(this.repository.workspaceRoot);
  }
  getTreeItem() {
    const item = new import_vscode63.TreeItem(this.label, import_vscode63.TreeItemCollapsibleState.Collapsed);
    item.iconPath = {
      dark: getIconUri2("repo", "dark"),
      light: getIconUri2("repo", "light")
    };
    return item;
  }
  async getChildren() {
    return [new IncomingChangesNode(this.repository)];
  }
};

// src/treeView/dataProviders/svnProvider.ts
var SvnProvider = class {
  constructor(sourceControlManager) {
    this.sourceControlManager = sourceControlManager;
    this._onDidChangeTreeData = new import_vscode64.EventEmitter();
    this._dispose = [];
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._dispose.push(
      import_vscode64.window.registerTreeDataProvider("svn", this),
      import_vscode64.commands.registerCommand(
        "svn.treeview.refreshProvider",
        () => this.refresh()
      )
    );
  }
  refresh() {
    this._onDidChangeTreeData.fire(void 0);
  }
  getTreeItem(element) {
    return element.getTreeItem();
  }
  async getChildren(element) {
    if (!this.sourceControlManager || this.sourceControlManager.openRepositories.length === 0) {
      return Promise.resolve([]);
    }
    if (element) {
      return element.getChildren();
    }
    const repositories = this.sourceControlManager.openRepositories.map(
      (repository) => {
        return new RepositoryNode(repository.repository, this);
      }
    );
    return repositories;
  }
  update(node) {
    this._onDidChangeTreeData.fire(node);
  }
  dispose() {
    dispose(this._dispose);
  }
};

// src/historyView/branchChangesProvider.ts
var import_vscode65 = require("vscode");
var BranchChangesProvider = class {
  constructor(model) {
    this.model = model;
    this._dispose = [];
    this._onDidChangeTreeData = new import_vscode65.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._dispose.push(
      import_vscode65.window.registerTreeDataProvider("branchchanges", this),
      import_vscode65.commands.registerCommand(
        "svn.branchchanges.openDiff",
        this.openDiffCmd,
        this
      ),
      import_vscode65.commands.registerCommand(
        "svn.branchchanges.refresh",
        () => this._onDidChangeTreeData.fire(void 0),
        this
      ),
      this.model.onDidChangeRepository(
        () => this._onDidChangeTreeData.fire(void 0)
      )
    );
  }
  dispose() {
    dispose(this._dispose);
  }
  getTreeItem(element) {
    let iconName = "";
    if (element.item === "added" /* ADDED */) {
      iconName = "status-added";
    } else if (element.item === "deleted" /* DELETED */) {
      iconName = "status-deleted";
    } else if (element.item === "modified" /* MODIFIED */) {
      iconName = "status-modified";
    }
    const iconPath = getIconObject(iconName);
    return {
      label: element.localPath.fsPath,
      command: {
        command: "svn.branchchanges.openDiff",
        title: "Open diff",
        arguments: [element]
      },
      iconPath,
      tooltip: `${element.oldPath.fsPath.replace(element.repo.fsPath, "")}@r${element.oldRevision} \u2192 ${element.newPath.fsPath.replace(element.repo.fsPath, "")}@r${element.newRevision}`
    };
  }
  getChildren(element) {
    if (element !== void 0) {
      return Promise.resolve([]);
    }
    const changes = [];
    for (const repo of this.model.repositories) {
      changes.push(repo.getChanges());
    }
    return Promise.all(changes).then(
      (value) => value.reduce((prev, curr) => prev.concat(curr), [])
    );
  }
  async openDiffCmd(element) {
    const repo = await this.model.getRemoteRepository(element.repo);
    if (element.item === "modified" /* MODIFIED */) {
      return openDiff(
        repo,
        element.oldPath,
        element.oldRevision,
        element.newRevision,
        element.newPath
      );
    }
    if (element.item === "added" /* ADDED */) {
      return openFileRemote(repo, element.newPath, element.newRevision);
    }
  }
};

// src/contexts/isSvn19orGreater.ts
var semver3 = __toESM(require_semver2());
var IsSvn19orGreater = class {
  constructor(svnVersion) {
    const is19orGreater = semver3.satisfies(svnVersion, ">= 1.9");
    setVscodeContext("isSvn19orGreater", is19orGreater);
  }
  dispose() {
  }
};

// src/contexts/isSvn18orGreater.ts
var semver4 = __toESM(require_semver2());
var IsSvn18orGreater = class {
  constructor(svnVersion) {
    const is18orGreater = semver4.satisfies(svnVersion, ">= 1.8");
    setVscodeContext("isSvn18orGreater", is18orGreater);
  }
  dispose() {
  }
};

// src/svnFileSystemProvider.ts
var import_vscode66 = require("vscode");
var THREE_MINUTES = 1e3 * 60 * 3;
var FIVE_MINUTES = 1e3 * 60 * 5;
var SvnFileSystemProvider = class {
  constructor(sourceControlManager) {
    this.sourceControlManager = sourceControlManager;
    this.disposables = [];
    this.cache = /* @__PURE__ */ new Map();
    this._onDidChangeFile = new import_vscode66.EventEmitter();
    this.onDidChangeFile = this._onDidChangeFile.event;
    this.changedRepositoryRoots = /* @__PURE__ */ new Set();
    this.disposables.push(
      sourceControlManager.onDidChangeRepository(
        this.onDidChangeRepository,
        this
      ),
      import_vscode66.workspace.registerFileSystemProvider("svn", this, {
        isReadonly: true,
        isCaseSensitive: true
      })
    );
    setInterval(() => this.cleanup(), FIVE_MINUTES);
  }
  onDidChangeRepository({ repository }) {
    this.changedRepositoryRoots.add(repository.root);
    this.eventuallyFireChangeEvents();
  }
  eventuallyFireChangeEvents() {
    this.fireChangeEvents();
  }
  async fireChangeEvents() {
    if (!import_vscode66.window.state.focused) {
      const onDidFocusWindow = filterEvent(
        import_vscode66.window.onDidChangeWindowState,
        (e) => e.focused
      );
      await eventToPromise(onDidFocusWindow);
    }
    const events = [];
    for (const { uri } of this.cache.values()) {
      const fsPath = uri.fsPath;
      for (const root of this.changedRepositoryRoots) {
        if (isDescendant(root, fsPath)) {
          events.push({ type: import_vscode66.FileChangeType.Changed, uri });
          break;
        }
      }
    }
    if (events.length > 0) {
      this._onDidChangeFile.fire(events);
    }
    this.changedRepositoryRoots.clear();
  }
  watch() {
    return EmptyDisposable;
  }
  async stat(uri) {
    await this.sourceControlManager.isInitialized;
    const { fsPath } = fromSvnUri(uri);
    const repository = this.sourceControlManager.getRepository(fsPath);
    if (!repository) {
      throw import_vscode66.FileSystemError.FileNotFound;
    }
    let size = 0;
    let mtime = (/* @__PURE__ */ new Date()).getTime();
    try {
      const listResults = await repository.list(fsPath);
      if (listResults.length) {
        size = Number(listResults[0].size);
        mtime = Date.parse(listResults[0].commit.date);
      }
    } catch (error) {
      console.error("Failed to list SVN file:", error);
    }
    return { type: import_vscode66.FileType.File, size, mtime, ctime: 0 };
  }
  readDirectory() {
    throw new Error("readDirectory is not implemented");
  }
  createDirectory() {
    throw new Error("createDirectory is not implemented");
  }
  async readFile(uri) {
    await this.sourceControlManager.isInitialized;
    const { fsPath, extra, action } = fromSvnUri(uri);
    const repository = this.sourceControlManager.getRepository(fsPath);
    if (!repository) {
      throw import_vscode66.FileSystemError.FileNotFound();
    }
    const cacheKey = uri.toString();
    const timestamp = (/* @__PURE__ */ new Date()).getTime();
    const cacheValue = { uri, timestamp };
    this.cache.set(cacheKey, cacheValue);
    try {
      if (action === "SHOW" /* SHOW */) {
        return await repository.showBuffer(fsPath, extra.ref);
      }
      if (action === "LOG" /* LOG */) {
        return await repository.plainLogBuffer();
      }
      if (action === "LOG_REVISION" /* LOG_REVISION */ && extra.revision) {
        return await repository.plainLogByRevisionBuffer(extra.revision);
      }
      if (action === "LOG_SEARCH" /* LOG_SEARCH */ && extra.search) {
        return await repository.plainLogByTextBuffer(extra.search);
      }
      if (action === "PATCH" /* PATCH */) {
        console.log("here");
        return await repository.patchBuffer([fsPath]);
      }
    } catch (error) {
      console.error("Failed to read SVN file:", error);
    }
    return new Uint8Array(0);
  }
  writeFile() {
    throw new Error("writeFile is not implemented");
  }
  delete() {
    throw new Error("delete is not implemented");
  }
  rename() {
    throw new Error("rename is not implemented");
  }
  cleanup() {
    const now = (/* @__PURE__ */ new Date()).getTime();
    const cache = /* @__PURE__ */ new Map();
    for (const row of this.cache.values()) {
      const { fsPath } = fromSvnUri(row.uri);
      const isOpen = import_vscode66.workspace.textDocuments.filter((d) => d.uri.scheme === "file").some((d) => pathEquals(d.uri.fsPath, fsPath));
      if (isOpen || now - row.timestamp < THREE_MINUTES) {
        cache.set(row.uri.toString(), row);
      } else {
      }
    }
    this.cache = cache;
  }
  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
};
__decorateClass([
  debounce(1100)
], SvnFileSystemProvider.prototype, "eventuallyFireChangeEvents", 1);
__decorateClass([
  throttle
], SvnFileSystemProvider.prototype, "fireChangeEvents", 1);

// src/extension.ts
async function init(extensionContext, outputChannel, disposables) {
  console.log("SVN Extension: init() started");
  const pathHint = configuration.get("path");
  const svnFinder = new SvnFinder();
  console.log("SVN Extension: Finding SVN executable...");
  const info = await svnFinder.findSvn(pathHint);
  console.log(`SVN Extension: Found SVN ${info.version} at ${info.path}`);
  const svn = new Svn({ svnPath: info.path, version: info.version });
  const sourceControlManager = await new SourceControlManager(
    svn,
    0 /* Async */,
    extensionContext
  );
  console.log("SVN Extension: Registering commands...");
  registerCommands(sourceControlManager, disposables);
  console.log("SVN Extension: Creating providers...");
  disposables.push(
    sourceControlManager,
    tempSvnFs,
    new SvnFileSystemProvider(sourceControlManager),
    new SvnProvider(sourceControlManager),
    new RepoLogProvider(sourceControlManager),
    new ItemLogProvider(sourceControlManager),
    new BranchChangesProvider(sourceControlManager),
    new CheckActiveEditor(sourceControlManager),
    new OpenRepositoryCount(sourceControlManager),
    new IsSvn18orGreater(info.version),
    new IsSvn19orGreater(info.version)
  );
  outputChannel.appendLine(`Using svn "${info.version}" from "${info.path}"`);
  console.log("SVN Extension: Providers created successfully");
  const onOutput = (str) => outputChannel.append(str);
  svn.onOutput.addListener("log", onOutput);
  disposables.push(
    toDisposable(() => svn.onOutput.removeListener("log", onOutput))
  );
  disposables.push(toDisposable(dispose2));
  console.log("SVN Extension: init() complete");
}
async function _activate(context, disposables) {
  const outputChannel = import_vscode67.window.createOutputChannel("Svn");
  import_vscode67.commands.registerCommand("svn.showOutput", () => outputChannel.show());
  disposables.push(outputChannel);
  const showOutput = configuration.get("showOutput");
  if (showOutput) {
    outputChannel.show();
  }
  const tryInit = async () => {
    try {
      await init(context, outputChannel, disposables);
    } catch (err) {
      const error = err;
      if (!/Svn installation not found/.test(error.message || "")) {
        throw err;
      }
      const shouldIgnore = configuration.get("ignoreMissingSvnWarning") === true;
      if (shouldIgnore) {
        return;
      }
      console.warn(error.message);
      outputChannel.appendLine(error.message);
      outputChannel.show();
      const findSvnExecutable = "Find SVN executable";
      const download = "Download SVN";
      const neverShowAgain = "Don't Show Again";
      const choice = await import_vscode67.window.showWarningMessage(
        "SVN not found. Install it or configure it using the 'svn.path' setting.",
        findSvnExecutable,
        download,
        neverShowAgain
      );
      if (choice === findSvnExecutable) {
        let filters;
        if (path29.sep === "\\") {
          filters = {
            svn: ["exe", "bat"]
          };
        }
        const executable = await import_vscode67.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters
        });
        if (executable && executable[0]) {
          const file = executable[0].fsPath;
          outputChannel.appendLine(`Updated "svn.path" with "${file}"`);
          await configuration.update("path", file);
          await tryInit();
        }
      } else if (choice === download) {
        import_vscode67.commands.executeCommand(
          "vscode.open",
          import_vscode67.Uri.parse("https://subversion.apache.org/packages.html")
        );
      } else if (choice === neverShowAgain) {
        await configuration.update("ignoreMissingSvnWarning", true);
      }
    }
  };
  await tryInit();
}
async function activate(context) {
  console.log("SVN Extension: activate() called");
  const disposables = [];
  context.subscriptions.push(
    new import_vscode67.Disposable(() => import_vscode67.Disposable.from(...disposables).dispose())
  );
  await _activate(context, disposables).catch((err) => {
    console.error("SVN Extension: Activation failed", err);
    import_vscode67.window.showErrorMessage(`SVN Extension activation failed: ${err.message || err}`);
  });
  console.log("SVN Extension: activation complete");
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
/*! Bundled license information:

sax/lib/sax.js:
  (*! http://mths.be/fromcodepoint v0.1.0 by @mathias *)

tmp/lib/tmp.js:
  (*!
   * Tmp
   *
   * Copyright (c) 2011-2017 KARASZI Istvan <github@spam.raszi.hu>
   *
   * MIT Licensed
   *)
*/
//# sourceMappingURL=extension.js.map
