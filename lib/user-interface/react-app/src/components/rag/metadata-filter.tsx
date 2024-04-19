import {
  Select,
  SpaceBetween,
  Input,
  Header,
  Button,
  SelectProps,
} from "@cloudscape-design/components";
import { useState } from "react";

/*
Equals 	= 	equals 	string, number, boolean 	Attribute matches the value you provide
Not equals 	!= 	notEquals 	string, number, boolean 	Attribute doesn't match the value you provide
Greater than 	> 	greaterThan 	number 	Attribute is greater than the value you provide
Greater than or equals 	>= 	greaterThanOrEquals 	number 	Attribute is greater than or equal to the value you provide
Less than 	< 	lessThan 	number 	Attribute is less than the value you provide
Less than or equals 	<= 	lessThanOrEquals 	number 	Attribute is less than or equal to the value you provide
In 	: 	in 	string list 	Attribute is in the list you provide
Not in 	!: 	notIn 	string list 	Attribute isn't in the list you provide
Starts with 	^ 	startsWith 	string 	Attribute starts with the string you provide (only supported for Amazon OpenSearch Serverless vector stores)
*/

const Operations = [
  { label: "=", value: "equals" },
  { label: "!=", value: "notEquals" },
  { label: ">", value: "greaterThan" },
  { label: ">=", value: "greaterThanOrEquals" },
  { label: "<", value: "lessThan" },
  { label: "<=", value: "lessThanOrEquals" },
  { label: "in", value: "in" },
  { label: "notIn", value: "notIn" },
  { label: "startsWith", value: "startsWith" },
];

export type Expression = {
  key: string;
  value: string;
  operator: string;
};

export type Filter = Expression | Record<"andAll" | "orAll", Expression[]>;

function FilterExpressionComponent(props: {
  readonly position: number;
  readonly value: Expression;
  readonly onChange: (expression: Expression) => void;
  readonly onAdd: () => void;
  readonly onRemove: (index: number) => void;
}) {
  return (
    <SpaceBetween direction="horizontal" size="xs">
      <Input
        placeholder="Key"
        value={props.value.key}
        onChange={({ detail }) =>
          props.onChange({ ...props.value, key: detail.value })
        }
      />
      <Select
        placeholder="Operator"
        options={Operations}
        selectedOption={
          Operations.find((v) => v.value === props.value.operator) ?? null
        }
        onChange={({ detail }) => {
          props.onChange({
            ...props.value,
            operator: detail.selectedOption.value ?? "",
          });
        }}
      />
      <Input
        placeholder="Value"
        value={props.value.value}
        onChange={({ detail }) =>
          props.onChange({ ...props.value, value: detail.value })
        }
      />
      <Button variant="icon" iconName="add-plus" onClick={props.onAdd} />
      {props.position > 0 && (
        <Button
          variant="icon"
          iconName="remove"
          onClick={() => props.onRemove(props.position)}
        />
      )}
    </SpaceBetween>
  );
}

export function MetadataFilter() {
  const [expressions, setExpressions] = useState<Expression[]>([
    { key: "", operator: "", value: "" },
  ]);
  const [logicOperator, setLogicOperator] = useState<SelectProps.Option | null>(
    null
  );

  return (
    <SpaceBetween direction="vertical" size="s">
      <Header variant="h3">Filter expression</Header>
      {expressions.length > 1 && (
        <SpaceBetween direction="horizontal" size="s">
          <Select
            placeholder="Logic"
            options={[
              { label: "and", value: "andAll" },
              { label: "or", value: "orAll" },
            ]}
            onChange={(v) => setLogicOperator(v.detail.selectedOption)}
            selectedOption={logicOperator}
          />{" "}
        </SpaceBetween>
      )}
      {expressions.map((e, i) => (
        <FilterExpressionComponent
          key={i}
          value={e}
          position={i}
          onChange={(v) => {
            expressions[i] = v;
            setExpressions([...expressions]);
          }}
          onAdd={() => {
            setExpressions([
              ...expressions,
              {
                key: "",
                operator: "",
                value: "",
              },
            ]);
          }}
          onRemove={(index) => {
            const newExpressions = [...expressions];

            newExpressions.splice(index, 1);
            console.log(expressions, newExpressions, index);
            setExpressions(newExpressions);
          }}
        />
      ))}
    </SpaceBetween>
  );
}
