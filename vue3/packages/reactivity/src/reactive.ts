import { isObject } from '@vue/shared'
import { ReactiveFlags, mutableHandlers } from './baseHandler'

//对象与代理对象的映射 target -> proxy
// 1.当对象target已代理，则直接返回代理对象proxy
// 2.如果target为Proxy类型(即已代理过)，直接返回target
const reactiveMap = new WeakMap()

export function reactive(target) {
    //只能代理对象
    if (!isObject(target)) return
    //存在IS_REACTIVE属性，则表示该对象为代理对象(会走proxy的get，从而实现拦截)
    if (target[ReactiveFlags.IS_REACTIVE]) return target
    //通过target查到，则表示该对象已被代理过，直接返回代理对象
    const exisitingProxy = reactiveMap.get(target)
    if (exisitingProxy) return exisitingProxy
    //通过proxy实现代理
    const proxy = new Proxy(target, mutableHandlers)
    reactiveMap.set(target, proxy)
    return proxy
}
