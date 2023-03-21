export function patchStyle(el, prevValue, nextValue) {
    for (const key in nextValue) {
        el.style[key] = nextValue[key]
    }
    if (prevValue) {
        //新值中不存在旧值，则表明该值需要删除
        for (const key in prevValue) {
            if (nextValue[key] === null) {
                el.style[key] = null
            }
        }
    }
}