# Using AppSync

Define or change the schema in `./lib/chatbot-api/schema`.

At the moment we only use the `schema-ws.graphql` to define the real-time API. The REST API might be replaced by AppSync in the future.

If you modified the definition for the schema, you can regenerate the client code using

```bash
cd lib/user-interface/react-app
npx @npx @aws-amplify/cli codegen add --apiId <api_id> --region <region>
```

Accept all the defaults.

If you use a None data source, you need to modify `src/API.ts` adding:

```ts
export type NoneQueryVariables = {
  none?: string | null;
};
```
