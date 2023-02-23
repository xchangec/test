import { isFunction } from "@vue/shared";
import { ReactiveEffect, trackEffects, triggerEffects } from "./effect";

class ComputedRefImpl {
    public effect
    public _value
    public _dirty = true //是否脏数据，默认取值时计算
    public dep = new Set() //存储使用computed.value的activeEffect
    constructor(getter, public setter) {
        this.effect = new ReactiveEffect(getter, () => {
            //scheduler 数据变化的回调
            if (!this._dirty) {
                this._dirty = true
                triggerEffects(this.dep)
            }
        })
    }
    get value() {
        trackEffects(this.dep)
        if (this._dirty) {
            this._dirty = false
            this._value = this.effect.run()
        }
        return this._value

    }
    set value(newValue) {
        this.setter(newValue)
    }
}
export function computed(getterOrOpations) {
    let getter, setter
    if (isFunction(getterOrOpations)) {
        getter = getterOrOpations
        setter = () => console.warn('no set')
    } else {
        getter = getterOrOpations.get
        setter = getterOrOpations.set
    }
    return new ComputedRefImpl(getter, setter)
}