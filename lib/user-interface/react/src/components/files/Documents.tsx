import { useEffect, useState } from 'react';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import TextFilter from '@cloudscape-design/components/text-filter';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import Link from '@cloudscape-design/components/link';
import FileUpload from '@cloudscape-design/components/file-upload';
import FormField from '@cloudscape-design/components/form-field';
import Alert from '@cloudscape-design/components/alert';

import { Auth } from 'aws-amplify';

import { Storage } from 'aws-amplify';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';

import { DateTime } from 'luxon';

export function Documents() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [value, setValue] = useState([]);
  const [pagesCount, setPagesCount] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [filteringText, setFilteringText] = useState('');
  const [isRagEnabled, setIsRagEnabled] = useState(false);

  const accessLevel = 'private';

  useEffect(() => {
    const getUser = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        setUser(user);
      } catch (err) {
        console.log(err);
      }
    };

    getUser();
  }, []);

  useEffect(() => {
    if (user) {
      listFiles();
    }
  }, [user]);

  useEffect(() => {
    if (filteringText) {
      const filteredFiles = files.filter((file) => file.key.toLowerCase().includes(filteringText.toLowerCase()));
      setFilteredFiles(filteredFiles);
    } else {
      setFilteredFiles(files);
    }
  }, [filteringText, files]);

  useEffect(() => {
    setPagesCount(Math.ceil(files.length / pageSize));
  }, [files, pageSize]);

  const upload = async (files) => {
    setIsLoading(true);
    const promises = files.map((file) => Storage.put(file.name, file, { level: accessLevel }));
    await Promise.all(promises);
    setIsLoading(false);
    await listFiles();
  };

  const listFiles = async () => {
    setIsLoading(true);
    try {
      const files = await Storage.list('', { level: accessLevel });
      setFiles(files?.results || []);
      setIsRagEnabled(true);
    } catch (err) {
      console.log(err);
      setIsRagEnabled(false);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFile = async (file) => {
    setIsLoading(true);
    try {
      await Storage.remove(file.key, { level: accessLevel });
      await listFiles();
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteFiles = async () => {
    setIsLoading(true);
    try {
      const promises = selectedItems.map((file) => Storage.remove(file.key, { level: accessLevel }));
      await Promise.all(promises);
      await listFiles();
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    const clickHandler = () => {
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.removeEventListener('click', clickHandler);
      }, 150);
    };
    a.addEventListener('click', clickHandler, false);
    a.click();
    return a;
  };

  const downloadFile = async (file) => {
    const result = await Storage.get(file.key, {
      level: accessLevel,
      download: true,
    });
    downloadBlob(result.Body, file.key);
  };

  return (
    <Table
      onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
      selectedItems={selectedItems}
      ariaLabels={{
        selectionGroupLabel: 'Items selection',
        allItemsSelectionLabel: ({ selectedItems }) => `${selectedItems.length} ${selectedItems.length === 1 ? 'item' : 'items'} selected`,
        itemSelectionLabel: ({ selectedItems }, item) => item.name,
      }}
      columnDefinitions={[
        {
          id: 'key',
          header: 'Filename',
          cell: (item) => <Link href="#">{item.key}</Link>,
          sortingField: 'key',
          isRowHeader: true,
        },
        {
          id: 'lastModified',
          header: 'Last Modified',
          cell: (item) => DateTime.fromISO(new Date(item.lastModified).toISOString()).toLocaleString(DateTime.DATETIME_MED),
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: (item) => (
            <SpaceBetween direction="horizontal" size="m">
              <Button onClick={() => downloadFile(item)} variant="inline-link" ariaLabel={`Delete ${item.key}`}>
                Download
              </Button>
              <Button onClick={() => deleteFile(item)} variant="inline-link" ariaLabel={`Delete ${item.key}`}>
                Delete
              </Button>
            </SpaceBetween>
          ),
          minWidth: 170,
        },
      ]}
      items={filteredFiles}
      loading={isLoading}
      loadingText="Loading files"
      selectionType="multi"
      trackBy="key"
      empty={
        <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <b>No files found</b>
          </SpaceBetween>
        </Box>
      }
      filter={<TextFilter filteringText={filteringText} filteringPlaceholder="Find files" filteringAriaLabel="Filter files" onChange={({ detail }) => setFilteringText(detail.filteringText)} />}
      header={
        <Header
          counter={selectedItems.length ? `Files (${selectedItems.length}/${files.length})` : `Files (${files.length})`}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <ButtonDropdown
                onItemClick={async ({ detail }) => {
                  if (detail.id === 'delete') {
                    await deleteFiles();
                  }
                }}
                items={[
                  {
                    text: 'Delete',
                    id: 'delete',
                  },
                ]}
              >
                Actions
              </ButtonDropdown>
            </SpaceBetween>
          }
        >
          <div className="mb-5 w-full">
            {!isRagEnabled && (
              <Alert statusIconAriaLabel="Error" type="error" header="No RAG sources deployed yet">
                You need to deploy a RAG source in your environment to perform RAG on your documents. You can find CDK constructs to deploy RAG source(s) in the{' '}
                <Link external href="https://github.com/aws-samples/aws-genai-llm-chatbot">
                  Public repository
                </Link>
                .
              </Alert>
            )}

            {isRagEnabled && (
              <Alert statusIconAriaLabel="Info" header="Indexing Latency">
                Depending on the RAG source(s) deployed in your environment and the number of documents you have, it may take a few minutes for the documents to be indexed and available for RAG.
              </Alert>
            )}
          </div>

          <div className="mb-5">
            <FormField>
              {isRagEnabled && (
                <FileUpload
                  onChange={({ detail }) => upload(detail.value)}
                  value={value}
                  i18nStrings={{
                    uploadButtonText: (e) => (e ? 'Choose files' : 'Choose file'),
                    dropzoneText: (e) => (e ? 'Drop files to upload' : 'Drop file to upload'),
                    removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                    limitShowFewer: 'Show fewer files',
                    limitShowMore: 'Show more files',
                    errorIconAriaLabel: 'Error',
                  }}
                  showFileLastModified
                  multiple
                  showFileSize
                  showFileThumbnail
                  tokenLimit={3}
                  constraintText="Supported: .pdf, .txt, .docx"
                />
              )}
            </FormField>
          </div>
        </Header>
      }
      pagination={<Pagination currentPageIndex={1} pagesCount={pagesCount} />}
    />
  );
}
export default Documents;
