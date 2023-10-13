export abstract class MetricsHelper {
  static magnitude(vector: number[]): number {
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );

    return magnitude;
  }

  static cosineSimilarity(vecA: number[], vecB: number[]) {
    if (vecA.length !== vecB.length) {
      throw new Error("Both vectors must have the same number of elements.");
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magnitudeA += vecA[i] * vecA[i];
      magnitudeB += vecB[i] * vecB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    const retValue = dotProduct / (magnitudeA * magnitudeB);

    return retValue;
  }

  static euclideanDistance(vecA: number[], vecB: number[]) {
    if (vecA.length !== vecB.length) {
      throw new Error("Both vectors must have the same number of elements.");
    }

    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
      const difference = vecA[i] - vecB[i];
      sum += difference * difference;
    }

    return Math.sqrt(sum);
  }

  static innerProduct(vecA: number[], vecB: number[]) {
    if (vecA.length !== vecB.length) {
      throw new Error("Both vectors must have the same number of elements.");
    }

    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
      sum += vecA[i] * vecB[i];
    }

    return sum;
  }

  static matrices(vectors: number[][]) {
    const cosineSimilarity = vectors.map((vecA) => {
      return vectors.map((vecB) => {
        return this.cosineSimilarity(vecA, vecB);
      });
    });

    const cosineDistance = vectors.map((vecA) => {
      return vectors.map((vecB) => {
        return 1 - this.cosineSimilarity(vecA, vecB);
      });
    });

    const innerProduct = vectors.map((vecA) => {
      return vectors.map((vecB) => {
        return this.innerProduct(vecA, vecB);
      });
    });

    const l2 = vectors.map((vecA) => {
      return vectors.map((vecB) => {
        return this.euclideanDistance(vecA, vecB);
      });
    });

    return {
      cosineSimilarity,
      cosineDistance,
      innerProduct,
      l2,
    };
  }
}
