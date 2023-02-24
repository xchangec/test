import { isFunction, isObject } from "@vue/shared";
import { ReactiveEffect } from "./effect";
import { isReactive } from "./reactive";

// 通过set避免循环引用问题
function traversal(value, set = new Set()) {
    if (!isObject(value)) return
    if (set.has(value)) return value //已存在则表示循环引用
    set.add(value)
    for (const key in value) {
        traversal(value[key], set)
    }
    return value
}

export function watch(source, cb) {
    let getter
    // 创建effect对象时调用getter，getter中读取属性，从而收集依赖(等同于副作用函数)
    //如果是reactive对象则递归读取对象的属性，如果是函数则直接使用(函数中读取并返回了监听属性)
    if (isReactive(source)) {
        getter = () => traversal(source)
    } else if (isFunction(source)) {
        getter = source
    }
    //解决异步产生的竞态问题cb内调用onCleanup,修改cb内的变量
    let cleanup
    const onCleanup = (fn) => {
        cleanup = fn
    }
    let oldValue
    let job = () => {
        if (cleanup) cleanup()
        let newValue = effect.run()
        cb(newValue, oldValue, onCleanup)
        oldValue = newValue
    }
    const effect = new ReactiveEffect(getter, job)
    oldValue = effect.run()
}