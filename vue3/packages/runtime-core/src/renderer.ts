import { isString, ShapeFlags } from "@vue/shared";
import { createVnode, Text } from "./vnode";

export function createRenderer(renderOptions) {
  let {
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText,
    setText: hostSetText,
    querySelector: hostQuerySelector,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    createElement: hostCreateElement,
    createText: hostCreateText,
    patchProp: hostPatchProp,
  } = renderOptions;

  /**
   *
   * @param n1 旧
   * @param n2 新
   * @param container 挂载节点
   * @returns
   */
  const patch = (n1, n2, container) => {
    if (n1 === n2) return;
    const { type, shapeFlag } = n2;
    //初次渲染
    if (n1 === null) {
      switch (type) {
        case Text:
          //vnode为Text类型走Text类型的创建逻辑
          processText(n1, n2, container);
          break;
        default:
          if (shapeFlag & ShapeFlags.ELEMENT) {
            //普通dom元素节点
            mountElement(n2, container);
          }
          break;
      }
    } else {
      //更新
    }
  };

  //创建节点
  const mountElement = (vnode, container) => {
    const { type, props, children, shapeFlag } = vnode;
    const el = (vnode.el = hostCreateElement(type));
    if (props) {
      //遍历节点属性，添加到节点上
      for (const key in props) {
        hostPatchProp(el, key, null, props[key]);
      }
    }
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      //子节点为字符串
      hostSetElementText(el, children);
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      //子节点为数组
      mountChildren(children, el);
    }
    //挂载节点
    hostInsert(el, container);
  };

  //创建为数组的子节点
  const mountChildren = (children, container) => {
    for (let i = 0; i < children.length; i++) {
      const child = normalize(children[i]);
      patch(null, child, container);
    }
  };

  //处理子节点
  const normalize = (child) => {
    //当子节点为字符串，将其包装为Text类型的vnode
    if (isString(child)) {
      return createVnode(Text, null, child);
    }
    return child;
  };

  //创建并插入Text类型的节点
  const processText = (n1, n2, container) => {
    if (n1 === null) {
      hostInsert((n2.el = hostCreateText(n2.children)), container);
    }
  };

  //卸载节点
  const unmount = (vnode) => {
    hostRemove(vnode.el);
  };

  const render = (vnode, container) => {
    if (vnode === null) {
      //vnode不存在，走卸载
      if (container._vnode) {
        //之前确实有渲染，则卸载
        unmount(container._vnode);
      }
    } else {
      patch(container._vnode || null, vnode, container);
    }
    container._vnode = vnode;
  };

  return {
    render,
  };
}
