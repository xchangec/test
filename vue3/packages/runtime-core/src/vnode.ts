import { isArray, isString, ShapeFlags } from "@vue/shared";

export const Text = Symbol()
export const isVnode = (value) => {
  return !!(value && value.__v_isVnode);
};
export function createVnode(type, props, children = null) {
  let shapeFlag = isString(type) ? ShapeFlags.ELEMENT : 0;
  const vnode = {
    type,
    props,
    children,
    el: null,
    key: props?.["key"], //取props中的key属性
    __v_isVnode: true,
    shapeFlag,
  };
  if (children) {
    let type = 0;
    if (isArray(children)) {
      type = ShapeFlags.ARRAY_CHILDREN;
    } else {
      children = String(children);
      type = ShapeFlags.TEXT_CHILDREN;
    }
    vnode.shapeFlag |= type; //vnode.shapeFlag = vnode.shapeFlag | type ,这里是位运算'|'，是新增权限的
  }
  return vnode;
}
