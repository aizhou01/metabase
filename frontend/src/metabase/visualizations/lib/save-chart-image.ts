import { isStorybookActive } from "metabase/env";
import { openImageBlobOnStorybook } from "metabase/lib/loki-utils";
import EmbedFrameS from "metabase/public/components/EmbedFrame/EmbedFrame.module.css";

import {
  createBrandingElement,
  getBrandingConfig,
  getBrandingSize,
} from "./exports-branding-utils";

export const SAVING_DOM_IMAGE_CLASS = "saving-dom-image";
export const SAVING_DOM_IMAGE_HIDDEN_CLASS = "saving-dom-image-hidden";

interface Opts {
  selector: string;
  fileName: string;
  includeBranding: boolean;
  userName?: string;
}

export const saveChartImage = async ({
  selector,
  fileName,
  includeBranding,
  userName,
}: Opts) => {
  const node = document.querySelector(selector);

  if (!node || !(node instanceof HTMLElement)) {
    console.warn("No node found for selector", selector);
    return;
  }

  const contentHeight = node.getBoundingClientRect().height;
  const contentWidth = node.getBoundingClientRect().width;

  const size = getBrandingSize(contentWidth);
  const brandingHeight = getBrandingConfig(size).h;
  const verticalOffset = includeBranding ? brandingHeight : 0;

  // Appending any element to the node does not automatically increase the canvas height.
  const canvasHeight = contentHeight + verticalOffset;

  // Ensure fonts are fully loaded before capturing, otherwise
  // html2canvas may render text with fallback fonts.
  await document.fonts.ready;

  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    cspNonce: window.MetabaseNonce,
    height: canvasHeight,
    onclone: (_doc: Document, node: HTMLElement) => {
      node.classList.add(SAVING_DOM_IMAGE_CLASS);
      node.classList.add(EmbedFrameS.WithThemeBackground);

      node.style.borderRadius = "0px";
      node.style.border = "none";

      if (includeBranding) {
        const branding = createBrandingElement(size);
        /**
         * The DOM node that encapsulates the dashboard card is absolutely positioned.
         * That node is the container for the chart, and for the branding element.
         * Unless we sanitize the container, we have to position the branding content
         * appropriately, or it will not be visible.
         */
        branding.style.position = "absolute";
        branding.style.left = "0";
        branding.style.bottom = `-${brandingHeight}px`;
        branding.style.zIndex = "1000";

        node.appendChild(branding);
      }

      if (userName) {
        const now = new Date();
        const dateTime = `${now.toLocaleDateString(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })} ${now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`;
        const watermarkText = `${userName} - ${dateTime}`;

        const watermark = document.createElement("div");
        watermark.style.cssText =
          "position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden;";

        const svgNs = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNs, "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");

        const defs = document.createElementNS(svgNs, "defs");
        const pattern = document.createElementNS(svgNs, "pattern");
        pattern.setAttribute("id", "chart-watermark");
        pattern.setAttribute("x", "0");
        pattern.setAttribute("y", "0");
        pattern.setAttribute("height", "200");
        pattern.setAttribute("width", "200");
        pattern.setAttribute("patternUnits", "userSpaceOnUse");

        const text = document.createElementNS(svgNs, "text");
        text.setAttribute("x", "0");
        text.setAttribute("y", "0");
        text.setAttribute("font-size", "24");
        text.setAttribute("font-weight", "600");
        text.setAttribute("fill", "currentColor");
        text.setAttribute("opacity", "0.12");
        text.setAttribute("transform", "translate(20, 180) rotate(-45)");
        text.textContent = watermarkText;

        pattern.appendChild(text);
        defs.appendChild(pattern);
        svg.appendChild(defs);

        const rect = document.createElementNS(svgNs, "rect");
        rect.setAttribute("width", "100%");
        rect.setAttribute("height", "100%");
        rect.setAttribute("fill", "url(#chart-watermark)");
        svg.appendChild(rect);

        watermark.appendChild(svg);
        node.appendChild(watermark);
      }
    },
  });

  if (isStorybookActive) {
    // In storybook/loki we must wait for the blob and image to be ready
    // before the play function returns, otherwise the async callback may
    // be garbage-collected ("Promise was collected").
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve),
    );
    if (blob) {
      openImageBlobOnStorybook({ canvas, blob });
    }
  } else {
    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.rel = "noopener";
        link.download = fileName;
        link.href = url;
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    });
  }
};
