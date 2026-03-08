// Lazy-loaded to avoid blocking initial page load (~50MB library)
let pipelineInstance: any = null;

class EmbeddingService {
  static async getInstance() {
    if (!pipelineInstance) {
      console.log('Loading CLIP model...');
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      pipelineInstance = await pipeline('feature-extraction', 'Xenova/clip-vit-base-patch32');
      console.log('CLIP model loaded.');
    }
    return pipelineInstance;
  }

  static async generateImageEmbedding(imageUrl: string): Promise<number[]> {
    const extractor = await this.getInstance();
    const output = await extractor(imageUrl, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  static async generateTextEmbedding(text: string): Promise<number[]> {
    const extractor = await this.getInstance();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}

export default EmbeddingService;
