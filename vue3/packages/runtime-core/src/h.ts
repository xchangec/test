import { isArray, isObject } from "@vue/shared";
import { createVnode, isVnode } from "./vnode";

// h('div',{style:{color:red}},[h('span'),h('i')])
// h('div',{style:{color:red}},h('span'))
// h('div',h('span'))
// h('div',[h('span'),h('span')])
// h('div',hello)
export function h(type, propsChildren, children) {
  const l = arguments.length;
  if (l === 2) {
    //只有两个参数
    if (isObject(propsChildren) && !isArray(propsChildren)) {
      if (isVnode(propsChildren)) {
        return createVnode(type, null, [propsChildren]);
      }
      //第二个参数为props
      return createVnode(type, propsChildren);
    } else {
      //为数组，内部为h函数
      return createVnode(type, null, propsChildren);
    }
  } else {
    if (l > 3) {
      children = Array.from(arguments).slice(2);
    } else if (l === 3 && isVnode(children)) {
      children = [children];
    }
    return createVnode(type, propsChildren, children);
  }
}
