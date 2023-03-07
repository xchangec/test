import { isObject } from "@vue/shared"
import { trackEffects, triggerEffects } from "./effect"
import { reactive } from "./reactive"

function toReactive(value) {
    return isObject(value) ? reactive(value) : value
}
class RefImpl {
    public dep = new Set()
    public _value
    public __v_isRef = true //存在该属性即为ref
    constructor(public rawValue) {
        this._value = toReactive(rawValue)
    }
    get value() {
        trackEffects(this.dep)
        return this._value
    }
    set value(newValue) {
        if (this.rawValue !== newValue) {
            this.rawValue = newValue
            this._value = toReactive(newValue)
            triggerEffects(this.dep)
        }
    }
}
export function ref(value) {
    return new RefImpl(value)
}
class ObjectRefImpl {
    constructor(public object, public key) { }
    get value() {
        return this.object[this.key]
    }
    set value(newValue) {
        this.object[this.key] = newValue
    }
}
// 将reactive对象的指定属性转换为ref,本质仍是访问reactive的属性
export function toRef(object, key) {
    return new ObjectRefImpl(object, key)
}

export function toRefs(object) {
    const result = Array.isArray(object) ? new Array(object.length) : {}
    for (const key in object) {
        result[key] = toRef(object, key)
    }
    return result
}

export function proxyRefs(object) {
    return new Proxy(object, {
        get(target, key, recevier) {
            const res = Reflect.get(target, key, recevier)
            return res.__v_isRef ? res.value : res
        },
        set(target, key, value, recevier) {
            const oldValue = target[key]
            if (oldValue.__v_isRef) {
                oldValue.value = value
                return true
            } else {
                return Reflect.set(target, key, value, recevier)
            }
        }
    })

}