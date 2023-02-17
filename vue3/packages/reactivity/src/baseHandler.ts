export const enum ReactiveFlags {
    IS_REACTIVE = '__v_isReactive'
}
export const mutableHandlers = {
    get(target, key, receiver) {
        if (key === ReactiveFlags.IS_REACTIVE) return true
        return Reflect.get(target, key, receiver) //将this指向代理对象？
    },
    set(target, key, value, receiver) {
        return Reflect.set(target, key, value, receiver)
    }
}