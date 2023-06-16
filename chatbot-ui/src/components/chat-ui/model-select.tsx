import { useContext, useEffect } from 'react';
import { ChatContext } from '../../common/chat-context/chat-context';
import { ChatActionKind } from '../../common/chat-context/chat-action';
import { AppContext } from '../../common/app-context';
import { ClientFactory } from '../../common/clients/client-factory';

function ModelSelect() {
  const appConfig = useContext(AppContext);
  const { state, dispatch } = useContext(ChatContext);

  useEffect(() => {
    (async () => {
      const client = ClientFactory.getClient(appConfig);
      const models = await client?.listModels();

      if (models) {
        dispatch({
          kind: ChatActionKind.SET_MODELS,
          payload: { models },
        });
      }
    })();
  }, [dispatch, appConfig]);

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({
      kind: ChatActionKind.SET_MODEL_ID,
      payload: { modelId: event.target.value },
    });
  };

  return (
    <div className="col-span-2 sm:col-span-1">
      <select
        onChange={onChange}
        className="border bg-gray-100 text-gray-900 text-sm rounded-lg focus:outline-none focus:ring-gray-400 focus:border-gray-400 block w-full p-1.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        disabled={state.models.length === 0}
        value={state.modelId || ''}
      >
        {state.models.map((modelId) => (
          <option key={modelId} value={modelId}>
            {modelId}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ModelSelect;
