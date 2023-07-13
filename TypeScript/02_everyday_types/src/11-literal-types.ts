let str: 'hello' = 'hello' //只能赋值字符串hello
let b1: true = true//只能赋值bool true
interface Options {
    first: string,
    last: string
}
//参数name可以为字符串或Options类型对象
//参数age只能为18或20，且返回值只能为0或1
function fn(name: string | Options, age: 18 | 28): 0 | 1 {
    return 0
}
fn('xx', 18)
fn({ first: 'c', last: 'c' }, 28)

function handleRequest(url: string, method: 'GET' | 'POST') {
    console.log(url);
    console.log(method);
}
//方式一
const req = {
    url: 'http://by.com',
    method: 'GET'
} as const
//方式二
// const req = {
//     url: 'http://by.com',
//     method: 'GET' as 'GET'
// }
//方式三
// handleRequest(req.url,req.method as 'GET')
//直接传值调用会报错，js自动将req.method转换为string类型
handleRequest(req.url, req.method)

export { }