import React, { useState, useCallback, ReactNode } from 'react';
import { slugify } from '../../utils/data-utils';

interface DropzoneProps {
  children: ReactNode;
  onFilesDrop: (files: File[], name: string) => void;
}

const Dropzone: React.FC<DropzoneProps> = ({ children, onFilesDrop }) => {
  const [highlight, setHighlight] = useState(false);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const items = event.dataTransfer.items;
      const droppedFiles: File[] = [];

      const processEntry = async (
        entry: any,
      ): Promise<File[] | File | undefined> => {
        if (entry.isFile) {
          return new Promise<File>((resolve) => {
            entry.file((file: File | PromiseLike<File>) => resolve(file));
          });
        } else if (entry.isDirectory) {
          return readDirectory(entry.createReader());
        }
        return undefined;
      };

      const readDirectory = async (
        reader: any,
      ): Promise<File[] | undefined> => {
        const entries = await readEntries(reader);
        const folderFiles: File[] = [];

        for (const entry of entries) {
          const fileOrFiles = await processEntry(entry);
          if (Array.isArray(fileOrFiles)) {
            folderFiles.push(...fileOrFiles);
          } else {
            if (fileOrFiles) folderFiles.push(fileOrFiles);
          }
        }

        return folderFiles.length > 0 ? folderFiles : undefined; // modify this line
      };

      const readEntries = (reader: any): Promise<any[]> => {
        return new Promise<any[]>((resolve) => {
          reader.readEntries((entries: any[] | PromiseLike<any[]>) =>
            resolve(entries),
          );
        });
      };

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const fileOrFiles = await processEntry(item.webkitGetAsEntry());
          if (Array.isArray(fileOrFiles)) {
            droppedFiles.push(...fileOrFiles);
          } else {
            if (fileOrFiles) droppedFiles.push(fileOrFiles);
          }
        }
      }

      if (droppedFiles.length > 0) {
        const name = slugify(droppedFiles[0].name.split('.')[0]);
        onFilesDrop(droppedFiles, name);
      }
      setHighlight(false);
    },
    [onFilesDrop],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setHighlight(true);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setHighlight(false);
  }, []);

  return (
    <div
      className="flex flex-grow"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {children}
    </div>
  );
};

export default Dropzone;
