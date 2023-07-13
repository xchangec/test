"use strict";
function printName(obj) {
    var _a;
    console.log(`name:${obj.first}${(_a = obj === null || obj === void 0 ? void 0 : obj.last) === null || _a === void 0 ? void 0 : _a.toUpperCase()}`);
}
printName({
    first: 'x',
    last: 'c'
});
