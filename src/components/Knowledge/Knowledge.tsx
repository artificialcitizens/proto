import React, { useContext } from 'react';
import { Tab } from '../../state';
import { pdfjs } from 'react-pdf';

import { VectorStoreContext } from '../../context/VectorStoreContext';
import {
  GlobalStateContext,
  GlobalStateContextValue,
} from '../../context/GlobalStateContext';
import { useNavigate, useParams } from 'react-router-dom';
import SBSearch from '../Search';
// import StorageMeter from '../StorageMeter/StorageMeter';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db';
import { toastifyError, toastifyInfo } from '../Toast';
import { readFileAsText, slugify } from '../../utils/data-utils';
import Dropzone from '../Dropzone/Dropzone';
import { getPdfText } from '../../utils/pdf-utils';

interface KnowledgeProps {
  workspaceId: string;
}

const removePageSuffix = (str: string) => {
  return str.replace(/-page-\d+$/, '');
};

const Knowledge: React.FC<KnowledgeProps> = ({ workspaceId }) => {
  const { appStateService }: GlobalStateContextValue =
    useContext(GlobalStateContext);
  const vectorContext = useContext(VectorStoreContext);
  const navigate = useNavigate();
  const { fileType } = useParams<{ fileType: string }>();

  const knowledgeItems = useLiveQuery(async () => {
    if (!vectorContext) return;
    return await db.knowledge
      .where('workspaceId')
      .equals(workspaceId)
      .toArray();
  }, [workspaceId]);

  const handleFileDrop = async (files: File[], name: string) => {
    if (!import.meta.env.DEV) return;

    for (const file of files) {
      if (!file) return;

      const fileExtension = file.name.split('.').pop();
      switch (fileExtension) {
        case 'txt':
        case 'md':
          {
            try {
              toastifyInfo(`📁 Processing ${file.name}`);
              const fileContent = await readFileAsText(file, '');
              const slugifiedFilename = slugify(file.name);

              const metadata = {
                id: slugifiedFilename,
                workspaceId,
                filetype: fileExtension,
                file,
                src: `/${workspaceId}/knowledge/${slugifiedFilename}`,
                originalFilename: file.name,
                uploadTimestamp: new Date().toISOString(),
              };
              if (vectorContext) {
                const memoryVectors = await vectorContext.addText(
                  fileContent,
                  [metadata],
                  `DOCUMENT NAME: ${file.name}\n\n---\n\n`,
                );
                const filteredMemoryVectors = memoryVectors?.filter(
                  (item) => item.metadata.id === slugifiedFilename,
                );
                // @TODO: Add options for generating summary on upload
                const id = db.knowledge.add({
                  id: slugifiedFilename,
                  workspaceId,
                  memoryVectors: filteredMemoryVectors || [],
                  file,
                  fileType: fileExtension,
                  fullText: fileContent,
                  createdAt: new Date().toISOString(),
                  lastModified: new Date().toISOString(),
                });
              } else {
                throw new Error('Context is null');
              }
              toastifyInfo(`File uploaded successfully: ${file.name}`);
            } catch (error) {
              toastifyError(`Error processing file: ${file.name}`);
            }
          }
          break;
        case 'pdf': {
          try {
            // some pdfs have prefaced pages with a cover page
            // this is the offset for returning the correct page number as src
            // @TODO: make this configurable as a knowledge setting
            const pageStartOffset = 0;
            toastifyInfo(`📁 Processing ${file.name}`);
            const fileURL = URL.createObjectURL(file);
            const pdfDocument = await pdfjs.getDocument(fileURL).promise;
            const pdfData = await getPdfText(pdfDocument, slugify(file.name));

            const slugifiedFilename = slugify(file.name);

            if (vectorContext) {
              for (const page of pdfData[slugifiedFilename]) {
                const metadata = {
                  id: `${slugifiedFilename}-page-${page.page}`,
                  workspaceId,
                  pageNumber: page.page,
                  offset: pageStartOffset,
                  file,
                  src: `/${workspaceId}/knowledge/${slugifiedFilename}?fileType=pdf&page=1`,
                  totalPages: pdfData[slugifiedFilename].length,
                  originalFilename: file.name,
                };

                const memoryVectors = await vectorContext.addText(
                  page.content,
                  [metadata],
                  `DOCUMENT NAME: ${file.name}\n\nPAGE NUMBER: ${
                    page.page + pageStartOffset
                  }\n\n---\n\n`,
                );

                const filteredMemoryVectors = memoryVectors?.filter(
                  (item) => item.metadata.id === metadata.id,
                );

                await db.knowledge.add({
                  id: metadata.id,
                  workspaceId,
                  memoryVectors: filteredMemoryVectors || [],
                  file,
                  fullText: page.content,
                  fileType: 'pdf',
                  createdAt: new Date().toISOString(),
                  lastModified: new Date().toISOString(),
                });
              }
            } else {
              throw new Error('Context is null');
            }
            toastifyInfo(`File uploaded successfully: ${file.name}`);
          } catch (error) {
            toastifyError(`Error processing file: ${file.name}`);
          }
          break;
        }
        default:
          toastifyError(`Please upload a .pdf .txt or .md file`);
          break;
      }
    }
  };

  const renderKnowledgeItems = () => {
    if (!knowledgeItems) return;

    const parsedIds = Array.from(
      new Set(knowledgeItems.map((item) => removePageSuffix(item.id))),
    );

    return parsedIds.map((parsedId) => {
      const item = knowledgeItems.find(
        (item) =>
          removePageSuffix(item.id) === parsedId &&
          item.memoryVectors.length > 0,
      );

      if (item) {
        return (
          <li
            key={item.id}
            className="text-acai-white text-xs font-semibold mb-3 flex justify-between"
          >
            {/* convert example-txt  to example.txt */}
            <button
              className="p-0 px-1 rounded-full font-medium text-acai-white hover:underline disabled:hover:no-underline"
              disabled={item.file.type !== 'application/pdf'}
              onClick={() => {
                navigate(
                  `/${workspaceId}/knowledge/${slugify(
                    parsedId,
                  )}?fileType=${fileType}&page=1`,
                );
              }}
            >
              {parsedId.replace(/-(\w+)$/, '.$1')}
            </button>
            <button
              className="p-0 px-1  rounded-full font-medium text-red-900"
              onClick={async () => {
                const confirmDelete = window.prompt(
                  `Please type the name of the piece knowledge to confirm deletion: ${removePageSuffix(
                    item.id,
                  )}`,
                );
                if (confirmDelete !== removePageSuffix(item.id)) {
                  alert('Name does not match. Deletion cancelled.');
                  return;
                }
                const itemsToDelete = knowledgeItems.filter((item) =>
                  item.id.startsWith(parsedId),
                );
                for (const item of itemsToDelete) {
                  await db.knowledge.delete(item.id);
                }
              }}
            >
              x
            </button>
          </li>
        );
      }
      return null;
    });
  };

  return (
    <div className="flex flex-col">
      <SBSearch
        onSubmit={async (val: string) => {
          if (!vectorContext) return;
          const response = await vectorContext.similaritySearchWithScore(val);
          const results = vectorContext.filterAndCombineContent(response, 0.6);
          const newTab: Tab = {
            id: Date.now().toString(),
            title: val,
            content: results,
            workspaceId,
            isContext: false,
            autoSave: false,
            createdAt: new Date().toString(),
            lastUpdated: new Date().toString(),
            filetype: 'md',
            systemNote: '',
          };
          appStateService.send({ type: 'ADD_TAB', tab: newTab });
          navigate(`/${workspaceId}/documents/${newTab.id}`);
        }}
      />
      <Dropzone onFilesDrop={handleFileDrop}>
        {knowledgeItems?.length === 0 && (
          <div className="w-full h-20 bg-base rounded-lg mb-4">
            <div
              className={`w-full h-full flex flex-col justify-center items-center`}
            >
              <div className="text-4xl text-acai-white">
                <i className="fas fa-file-upload"></i>
              </div>
              <div className="text-acai-white">Drop a file to upload</div>
            </div>
          </div>
        )}
        {knowledgeItems && knowledgeItems.length > 0 && (
          <ul className="bg-base rounded-lg p-3 max-h-[25vh] w-full overflow-scroll">
            {renderKnowledgeItems()}
          </ul>
        )}
      </Dropzone>
      {/* <StorageMeter /> */}
    </div>
  );
};

export default Knowledge;

// const handleFileDrop = async (files: File[], name: string) => {
//   const conversations: { [key: string]: any } = {};

//   // Save as JSON file
//   const jsonContent = JSON.stringify(conversations, null, 2);
//   const jsonFile = new Blob([jsonContent], { type: 'application/json' });
//   const jsonDownloadLink = document.createElement('a');
//   jsonDownloadLink.href = URL.createObjectURL(jsonFile);
//   jsonDownloadLink.download = `${name}.json`;
//   jsonDownloadLink.click();

//   // Convert JSON to YAML
//   const yamlContent = yaml.dump(conversations);

//   // Save as YAML file
//   const yamlFile = new Blob([yamlContent], { type: 'application/x-yaml' });
//   const yamlDownloadLink = document.createElement('a');
//   yamlDownloadLink.href = URL.createObjectURL(yamlFile);
//   yamlDownloadLink.download = `${name}.yml`;
//   yamlDownloadLink.click();
// };
