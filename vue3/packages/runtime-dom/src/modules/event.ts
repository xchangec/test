function createInvoker(callback) {
    const invoker = (e) => { invoker.value(e) }
    invoker.value = callback
    return invoker
}
export function patchEvent(el, eventName, nextValue) {
    //_vei存储元素上的事件
    let invokers = el._vei || (el._vei = {})
    let exists = invokers[eventName]
    //该事件已绑定监听函数，且存在新事件
    if (exists && nextValue) {
        // exists存在，则exists为createInvoker创建的invoker
        exists.value = nextValue
    } else {
        const event = eventName.slice(2).toLowerCase()
        if (nextValue) {
            // 这里的invoker是箭头函数
            let invoker = invokers[eventName] = createInvoker(nextValue)
            el.addEventListener(event, invoker)
        } else {
            el.removeEventListener(event, exists)
            invokers[eventName] = undefined
        }
    }
}