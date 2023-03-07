export const nodeOps = {
    // 节点插入
    insert(child, parent, anchor = null) {
        parent.insertBefore(child, anchor)
    },
    // 节点删除
    remove(child) {
        const parentNode = child.parentNode
        parentNode.removeChild(child)
    },
    // 文本插入
    setElementText(el, text) {
        el.textContent = text
    },
    setText(node,text){}
}