import { isString, ShapeFlags } from "@vue/shared";
import { createVnode, isSameVnode, Text } from "./vnode";

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
    if (n1 && !isSameVnode(n1, n2)) {//节点不相同，卸载旧节点再重新渲染
      unmount(n1);
      n1 = null;
    }
    const { type, shapeFlag } = n2;
    switch (type) {
      case Text:
        //vnode为Text类型走Text类型的创建逻辑
        processText(n1, n2, container);
        break;
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          //普通dom元素节点
          processElement(n1, n2, container); //
        }
        break;
    }
  };

  //创建并插入Text类型的节点
  const processText = (n1, n2, container) => {
    if (n1 === null) {
      hostInsert((n2.el = hostCreateText(n2.children)), container);
    } else {
      let el = (n1.el = n2.el);
      if (n1.children !== n2.children) {
        hostSetText(el, n2.children);
      }
    }
  };

  //根据n1判断，创建或更新节点
  const processElement = (n1, n2, container) => {
    if (n1 === null) {//创建节点
      mountElement(n2, container);
    } else {
      //更新节点
      patchElement(n1, n2, container);
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

  //更新节点
  const patchElement = (n1, n2, container) => {
    const el = (n2.el = n1.el);
    const oldProps = n1.props || {};
    const newProps = n2.props || {};
    patchProps(oldProps, newProps, el);
    patchChildren(n1, n2, el);
  };

  //对比元素属性
  const patchProps = (oldProps, newProps, el) => {
    for (const key in newProps) {
      hostPatchProp(el, key, oldProps[key], newProps[key]);
    }
    for (const key in oldProps) {
      if (newProps[key] === null) {
        hostPatchProp(el, key, oldProps[key], null);
      }
    }
  };

  //对比元素子节点
  const patchChildren = (n1, n2, el) => {
    const c1 = n1 && n1.children;
    const c2 = n2 && n2.children;
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
