import { isObject } from '@vue/shared'
import { activeEffect, track, trigger } from './effect'
import { reactive } from './reactive'
export const enum ReactiveFlags {
    IS_REACTIVE = '__v_isReactive'
}
export const mutableHandlers = {
    get(target, key, receiver) {
        if (key === ReactiveFlags.IS_REACTIVE) return true
        track(target, 'get', key)
        const res = Reflect.get(target, key, receiver) //将this指向代理对象？
        if (isObject(res)) {
            return reactive(res)
        }
        return res
    },
    set(target, key, value, receiver) {
        const oldValue = target[key]
        let result = Reflect.set(target, key, value, receiver)
        if (oldValue !== value) { //新旧值不一样再触发依赖
            trigger(target, 'set', key, value, oldValue)
        }
        return result
    }
}