import { ColumnLayout, FormField, Input } from "@cloudscape-design/components";

interface ChunkSelectorProps {
  errors: Record<string, string | string[]>;
  data: { chunkSize: number; chunkOverlap: number };
  submitting: boolean;
  onChange: (
    data: Partial<{ chunkSize: number; chunkOverlap: number }>
  ) => void;
}

export function ChunkSelectorField(props: ChunkSelectorProps) {
  return (
    <FormField
      label="Text Splitter"
      stretch={true}
      description="Chunk size is the character limit of each chunk, which is then vectorized."
    >
      <ColumnLayout columns={2}>
        <FormField label="Chunk Size" errorText={props.errors.chunkSize}>
          <Input
            type="number"
            disabled={props.submitting}
            value={props.data.chunkSize.toString()}
            onChange={({ detail: { value } }) =>
              props.onChange({ chunkSize: parseInt(value) })
            }
          />
        </FormField>
        <FormField label="Chunk Overlap" errorText={props.errors.chunkOverlap}>
          <Input
            type="number"
            disabled={props.submitting}
            value={props.data.chunkOverlap.toString()}
            onChange={({ detail: { value } }) =>
              props.onChange({ chunkOverlap: parseInt(value) })
            }
          />
        </FormField>
      </ColumnLayout>
    </FormField>
  );
}
