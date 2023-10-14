const { memoryUsage } = require('node:process');

console.log(memoryUsage());





// // node --expose-gc


// global.gc()
// // 返回 Nodejs 的内存占用情况，单位是 bytes
// process.memoryUsage()
// // let map = new Map()
// let map = new WeakMap()
// let key = new Array(5 * 1024 * 1024)
// map.set(key, '123')

// global.gc();
// process.memoryUsage();

// key = null;
// global.gc();
// process.memoryUsage();

// map.delete(key);
// global.gc();
// process.memoryUsage();
