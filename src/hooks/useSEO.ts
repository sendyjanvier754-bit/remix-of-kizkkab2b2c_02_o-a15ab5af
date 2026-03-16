import { useEffect } from "react";
import { useBranding } from "@/hooks/useBranding";

export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: "website" | "article" | "product";
  author?: string;
  publishedDate?: string;
  updatedDate?: string;
}

export const useSEO = (metadata: SEOMetadata) => {
  const { getValue } = useBranding();
  const platformName = getValue('platform_name');
  const defaultBrandImage = getValue('logo_url') || getValue('favicon_url');

  useEffect(() => {
    // Title
    document.title = `${metadata.title} | ${platformName}`;

    // Meta description
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      descriptionMeta.setAttribute("content", metadata.description);
    }

    // Keywords
    if (metadata.keywords) {
      const keywordsMeta = document.querySelector('meta[name="keywords"]');
      if (keywordsMeta) {
        keywordsMeta.setAttribute("content", metadata.keywords);
      }
    }

    // Open Graph
    setOrCreateMeta("og:title", metadata.title);
    setOrCreateMeta("og:description", metadata.description);
    setOrCreateMeta("og:type", metadata.type || "website");
    setOrCreateMeta("og:image", metadata.image || defaultBrandImage);
    if (metadata.url) setOrCreateMeta("og:url", metadata.url);

    // Twitter Card
    setOrCreateMeta("twitter:card", "summary_large_image");
    setOrCreateMeta("twitter:title", metadata.title);
    setOrCreateMeta("twitter:description", metadata.description);
    setOrCreateMeta("twitter:image", metadata.image || defaultBrandImage);

    // Schema.org structured data for products
    let schemaScript: HTMLScriptElement | null = null;
    
    if (metadata.type === "product") {
      schemaScript = document.createElement("script");
      schemaScript.type = "application/ld+json";
      schemaScript.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: metadata.title,
        description: metadata.description,
        image: metadata.image,
      });
      document.head.appendChild(schemaScript);
    }

    return () => {
      if (schemaScript && document.head.contains(schemaScript)) {
        document.head.removeChild(schemaScript);
      }
    };
  }, [metadata, platformName, defaultBrandImage]);
};

const setOrCreateMeta = (property: string, content: string) => {
  const isTwitter = property.startsWith("twitter:");
  const attr = isTwitter ? "name" : "property";
  let meta = document.querySelector(`meta[${attr}="${property}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, property);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
};
