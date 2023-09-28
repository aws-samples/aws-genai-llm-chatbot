import { StatusIndicatorProps } from "@cloudscape-design/components";

export const languageList = [
  { value: "simple", label: "Simple" },
  { value: "arabic", label: "Arabic" },
  { value: "armenian", label: "Armenian" },
  { value: "basque", label: "Basque" },
  { value: "catalan", label: "Catalan" },
  { value: "danish", label: "Danish" },
  { value: "dutch", label: "Dutch" },
  { value: "english", label: "English" },
  { value: "finnish", label: "Finnish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "greek", label: "Greek" },
  { value: "hindi", label: "Hindi" },
  { value: "hungarian", label: "Hungarian" },
  { value: "indonesian", label: "Indonesian" },
  { value: "irish", label: "Irish" },
  { value: "italian", label: "Italian" },
  { value: "lithuanian", label: "Lithuanian" },
  { value: "nepali", label: "Nepali" },
  { value: "norwegian", label: "Norwegian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "romanian", label: "Romanian" },
  { value: "russian", label: "Russian" },
  { value: "serbian", label: "Serbian" },
  { value: "spanish", label: "Spanish" },
  { value: "swedish", label: "Swedish" },
];

export abstract class Labels {
  static languageMap = new Map(languageList.map((l) => [l.value, l.label]));

  static engineMap: Record<string, string> = {
    aurora: "Aurora Serverless v2 (pgvector)",
    opensearch: "OpenSearch Serverless",
    kendra: "Kendra",
  };

  static statusTypeMap: Record<string, StatusIndicatorProps.Type> = {
    submitted: "pending",
    creating: "in-progress",
    ready: "success",
    created: "success",
    processing: "in-progress",
    processed: "success",
    error: "error",
  };

  static statusMap: Record<string, string> = {
    submitted: "Submitted",
    creating: "Creating",
    ready: "Ready",
    created: "Created",
    processing: "Processing",
    processed: "Processed",
    error: "Error",
  };

  static distainceFunctionMap: Record<string, string> = {
    inner: "Negative inner product",
    cosine: "Cosine distance",
    l2: "Euclidean distance / L2 norm",
  };

  static sourceTypeMap: Record<string, string> = {
    vector_search: "Vector search",
    keyword_search: "Keyword search",
    kendra: "Kendra",
  };

  static documentTypeMap: Record<string, string> = {
    file: "File",
    text: "Text",
    website: "Website",
    qna: "Q&A",
  };
}
