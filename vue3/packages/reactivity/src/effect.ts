export let activeEffect = undefined

function cleanupEffect(effect) {
    const { deps } = effect
    deps.forEach(dep => {
        dep.delete(effect)
    });
    effect.deps.length = 0
}
export class ReactiveEffect {
    //ts语法，新增active属性
    public active = true //effect默认为激活状态
    public parent = null
    public deps = []
    constructor(public fn, public scheduler) {//ts语法，新增fn属性，this.fn = fn
    }
    run() {
        //非激活的情况，直接执行，不需要依赖收集
        if (!this.active) { this.fn() }
        try {
            this.parent = activeEffect
            //后续依赖收集，后续将当前effect和属性关联到一起
            activeEffect = this
            cleanupEffect(this)
            return this.fn()
        } finally {
            activeEffect = this.parent
        }
    }
    stop() {
        if (this.active) {
            this.active = false
            cleanupEffect(this)//清空当前effect的依赖
        }
    }
}

export function effect(fn, options: any = {}) {
    const _effect = new ReactiveEffect(fn, options.scheduler)
    _effect.run()
    const runner = _effect.run.bind(_effect)//绑定this,不绑的话runner执行时this为windows
    runner.effect = _effect
    return runner
}

//存储副作用函数
// weakMap(target:Map(key:set(activeEffect)))
const targetMap = new WeakMap()
//收集依赖
export function track(target, type, key) {
    if (!activeEffect) return
    let depsMap = targetMap.get(target)
    if (!depsMap) {
        targetMap.set(target, depsMap = new Map())
    }
    let dep = depsMap.get(key)
    if (!dep) {
        depsMap.set(key, dep = new Set())
    }
    trackEffects(dep)
}
//触发依赖
export function trigger(target, type, key, value, oldValue) {
    const depsMap = targetMap.get(target)
    if (!depsMap) return
    let effects = depsMap.get(key)
    if (effects) {
        triggerEffects(effects)
    }
}

export function trackEffects(dep) {
    let shouldTrack = dep.has(activeEffect)
    if (!shouldTrack) {
        dep.add(activeEffect)
        //收集当前activeEffect中属性的set集合，而set中存的是当前activeEffect，从而使 属性与activeEffect 建立双向的绑定
        activeEffect.deps.push(dep)
    }
}
export function triggerEffects(effects) {
    //建立一个新的set对象，解决因set循环时(删除+添加)导致的死循环
    // (删除指cleanupEffect,添加指副作用函数fn的执行，
    // 当属性值修改触发trigger，trigger找到属性对应的effects循环执行，从而触发cleanupEffect清空effects，当再次收集依赖时会再为effects添加数据，从而导致死循环)
    effects = new Set(effects)
    effects && effects.forEach(effect => {
        if (effect !== activeEffect) {
            if (effect.scheduler) {//如果传了调度函数则执行调度函数，否则执行副作用函数更新视图
                // effect.scheduler(effect)//直接传递effect好像就不需要runner了，直接通过参数.run就可以了
                effect.scheduler()
            } else {
                effect.run()
            }
        }
    });
}