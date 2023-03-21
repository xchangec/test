import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";
import { createRenderer } from "@vue/runtime-core";

const renderOptions = Object.assign(nodeOps, { patchProp })
export function render(vnode, container) {
    createRenderer(renderOptions).render(vnode, container)
}

export * from '@vue/runtime-core' //用户可以拿到h等函数