"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    prefix: "",
    bedrock: {
        enabled: true,
    },
    llms: [],
    rag: {
        enabled: true,
        engines: {
            aurora: {
                enabled: true,
            },
            opensearch: {
                enabled: true,
            },
            kendra: {
                enabled: false,
            },
        },
        embeddingsModels: [
            {
                provider: "sagemaker",
                name: "intfloat/multilingual-e5-large",
                default: true,
                dimensions: 1024,
            },
            {
                provider: "sagemaker",
                name: "sentence-transformers/all-MiniLM-L6-v2",
                dimensions: 384,
            },
            {
                provider: "bedrock",
                name: "amazon.titan-e1t-medium",
                dimensions: 4096,
            },
            {
                provider: "openai",
                name: "text-embedding-ada-002",
                dimensions: 1536,
            },
        ],
        crossEncoderModels: [
            {
                provider: "sagemaker",
                name: "cross-encoder/ms-marco-MiniLM-L-12-v2",
                default: true,
            },
        ],
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVhLFFBQUEsTUFBTSxHQUFpQjtJQUNsQyxNQUFNLEVBQUUsRUFBRTtJQUNWLE9BQU8sRUFBRTtRQUNQLE9BQU8sRUFBRSxJQUFJO0tBQ2Q7SUFDRCxJQUFJLEVBQUUsRUFBRTtJQUNSLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxJQUFJO1FBQ2IsT0FBTyxFQUFFO1lBQ1AsTUFBTSxFQUFFO2dCQUNOLE9BQU8sRUFBRSxJQUFJO2FBQ2Q7WUFDRCxVQUFVLEVBQUU7Z0JBQ1YsT0FBTyxFQUFFLElBQUk7YUFDZDtZQUNELE1BQU0sRUFBRTtnQkFDTixPQUFPLEVBQUUsS0FBSzthQUNmO1NBQ0Y7UUFDRCxnQkFBZ0IsRUFBRTtZQUNoQjtnQkFDRSxRQUFRLEVBQUUsV0FBVztnQkFDckIsSUFBSSxFQUFFLGdDQUFnQztnQkFDdEMsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsVUFBVSxFQUFFLElBQUk7YUFDakI7WUFDRDtnQkFDRSxRQUFRLEVBQUUsV0FBVztnQkFDckIsSUFBSSxFQUFFLHdDQUF3QztnQkFDOUMsVUFBVSxFQUFFLEdBQUc7YUFDaEI7WUFDRDtnQkFDRSxRQUFRLEVBQUUsU0FBUztnQkFDbkIsSUFBSSxFQUFFLHlCQUF5QjtnQkFDL0IsVUFBVSxFQUFFLElBQUk7YUFDakI7WUFDRDtnQkFDRSxRQUFRLEVBQUUsUUFBUTtnQkFDbEIsSUFBSSxFQUFFLHdCQUF3QjtnQkFDOUIsVUFBVSxFQUFFLElBQUk7YUFDakI7U0FDRjtRQUNELGtCQUFrQixFQUFFO1lBQ2xCO2dCQUNFLFFBQVEsRUFBRSxXQUFXO2dCQUNyQixJQUFJLEVBQUUsdUNBQXVDO2dCQUM3QyxPQUFPLEVBQUUsSUFBSTthQUNkO1NBQ0Y7S0FDRjtDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdXBwb3J0ZWRSZWdpb24sIFN5c3RlbUNvbmZpZyB9IGZyb20gXCIuL2xpYi9zaGFyZWQvdHlwZXNcIjtcblxuZXhwb3J0IGNvbnN0IGNvbmZpZzogU3lzdGVtQ29uZmlnID0ge1xuICBwcmVmaXg6IFwiXCIsXG4gIGJlZHJvY2s6IHtcbiAgICBlbmFibGVkOiB0cnVlLFxuICB9LFxuICBsbG1zOiBbXSxcbiAgcmFnOiB7XG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBlbmdpbmVzOiB7XG4gICAgICBhdXJvcmE6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBvcGVuc2VhcmNoOiB7XG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgICAga2VuZHJhOiB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIGVtYmVkZGluZ3NNb2RlbHM6IFtcbiAgICAgIHtcbiAgICAgICAgcHJvdmlkZXI6IFwic2FnZW1ha2VyXCIsXG4gICAgICAgIG5hbWU6IFwiaW50ZmxvYXQvbXVsdGlsaW5ndWFsLWU1LWxhcmdlXCIsXG4gICAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICAgIGRpbWVuc2lvbnM6IDEwMjQsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBwcm92aWRlcjogXCJzYWdlbWFrZXJcIixcbiAgICAgICAgbmFtZTogXCJzZW50ZW5jZS10cmFuc2Zvcm1lcnMvYWxsLU1pbmlMTS1MNi12MlwiLFxuICAgICAgICBkaW1lbnNpb25zOiAzODQsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBwcm92aWRlcjogXCJiZWRyb2NrXCIsXG4gICAgICAgIG5hbWU6IFwiYW1hem9uLnRpdGFuLWUxdC1tZWRpdW1cIixcbiAgICAgICAgZGltZW5zaW9uczogNDA5NixcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHByb3ZpZGVyOiBcIm9wZW5haVwiLFxuICAgICAgICBuYW1lOiBcInRleHQtZW1iZWRkaW5nLWFkYS0wMDJcIixcbiAgICAgICAgZGltZW5zaW9uczogMTUzNixcbiAgICAgIH0sXG4gICAgXSxcbiAgICBjcm9zc0VuY29kZXJNb2RlbHM6IFtcbiAgICAgIHtcbiAgICAgICAgcHJvdmlkZXI6IFwic2FnZW1ha2VyXCIsXG4gICAgICAgIG5hbWU6IFwiY3Jvc3MtZW5jb2Rlci9tcy1tYXJjby1NaW5pTE0tTC0xMi12MlwiLFxuICAgICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgfSxcbiAgICBdLFxuICB9LFxufTtcbiJdfQ==