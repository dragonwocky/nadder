/** @jsx h */
import {
  type FunctionalComponent,
  h,
  isVNode,
  Teleport,
  type VNode,
} from "vue";
import { renderToString, ssrRenderComponent } from "vue/server-renderer";
import { deepMerge } from "std/collections/deep_merge.ts";

import { INTERNAL_PREFIX } from "../constants.ts";
import { type Manifest } from "./types.ts";

interface Template {
  lang: string;
  styles: string[];
  imports: { src: string; nonce: string }[];
  body: VNode;
}

const mergeVNodes = (a: VNode | undefined, b: VNode | undefined) => {
    if (a && !b) return a;
    if (!a && b) return b;
    return deepMerge(
      a as unknown as Record<string, unknown>,
      b as unknown as Record<string, unknown>,
    ) as unknown as VNode;
  },
  removeVNodeChild = (parent: VNode, child: VNode) => {
    if (Array.isArray(parent.children)) {
      const i = parent.children.indexOf(child);
      if (i > -1) child = parent.children.splice(i, 1)[0] as typeof child;
    }
    return child;
  },
  getVNodeChildren = (node: VNode) => {
    if (Array.isArray(node.children)) return [...node.children];
    if (typeof node.children == "string") return [node.children];
    return [];
  },
  // allows use of e.g. <head> and <body> w/in page components
  // every encountered instance of each will have its props + children
  // hoisted to the document's equiv. global vnode
  hoistElemsFromVNodes = (component: VNode, elemTypes: string[]) => {
    const hoistedElems = {} as { [k in typeof elemTypes[number]]?: VNode },
      hoist = (node: VNode, parent?: VNode) => {
        const nodeType = String(node.type);
        if (elemTypes.includes(nodeType)) {
          if (parent) node = removeVNodeChild(parent, node);
          hoistedElems[nodeType] = mergeVNodes(hoistedElems[nodeType], node);
        }
        recurse(node);
      },
      recurse = (node: VNode) => {
        for (const child of getVNodeChildren(node)) {
          if (isVNode(child)) hoist(child, node);
        }
      };
    hoist(component);
    return hoistedElems;
  };

const Head = (props: VNode["props"], ...args: unknown[]) => {
  return (
    <Teleport to="head">
      {props?.children ?? []}
    </Teleport>
  );
};

const template = async (tmpl: Template): Promise<string> => {
  return "<!DOCTYPE html>" + await renderToString(
    <html lang={tmpl.lang}>
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {tmpl.imports.map(({ src, nonce }) => (
          <script src={src} nonce={nonce} type="module"></script>
        ))}
        <style
          id={`${INTERNAL_PREFIX}_style`.toUpperCase()}
          innerHTML={tmpl.styles.join("\n")}
        />
      </head>
      <body {...tmpl.body.props}>
        {getVNodeChildren(tmpl.body)}
      </body>
    </html>,
  );
};

const render = async (manifest: Manifest, component: VNode) => {
  return await template({
    lang: manifest.htmlLang,
    styles: [],
    imports: [],
    body: component,
  });
};

export { Head, render };
