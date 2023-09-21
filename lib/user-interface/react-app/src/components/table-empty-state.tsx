import { Box, SpaceBetween } from "@cloudscape-design/components";
import RouterButton from "./wrappers/router-button";

export const TableEmptyState = (props: {
  resourceName: string;
  createHref?: string;
  createText?: string;
}) => (
  <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
    <SpaceBetween size="xxs">
      <div>
        <b>No {props.resourceName}s</b>
        <Box variant="p" color="inherit">
          No {props.resourceName}s associated with this resource.
        </Box>
      </div>
      {props.createHref && (
        <RouterButton href={props.createHref}>
          {props.createText ? (
            <>{props.createText}</>
          ) : (
            <>Create {props.resourceName}</>
          )}
        </RouterButton>
      )}
    </SpaceBetween>
  </Box>
);
