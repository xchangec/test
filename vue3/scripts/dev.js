//解析命令参数，命令行(进程)的参数
const args = require('minimist')(process.argv.slice(2))
const { resolve } = require('path')
const { build, context } = require('esbuild')

const target = args._[0] || 'reactivity'
const format = args.f || 'global'

const pkg = require(resolve(__dirname, `../packages/${target}/package.json`))
// iife 立即执行函数 (function(){})()
// cjs node中的模块 module.exports
// esm 浏览器中的esModule模块 import
const outputFormat = format.startsWith('global') ? 'iife' : format === 'cjs' ? 'cjs' : 'esm'
//输出目录
const outfile = resolve(__dirname, `../packages/${target}/dist/${target}.${format}.js`)

//天生支持ts
build({
    entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)],//入口
    outfile, //出口
    bundle: true,//把所有的包全部打包到一起
    sourcemap: true,
    format: outputFormat,//输出的格式
    globalName: pkg.buildOptions?.name,//打包的全局名字
    platform: format === 'cjs' ? 'node' : 'browser',//平台
    watch: {//监控文件变化,0.17不可用，降版本了
        onRebuild(error, result) {
            if (!error) console.log('rebuild~~~');
        }
    }
}).then((res) => {
    console.log('watching~~~');
}).catch(err => {
    console.log(err);
})
