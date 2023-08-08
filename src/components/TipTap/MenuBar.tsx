import { Editor } from '@tiptap/react';
import React, { useState, useEffect, useContext } from 'react';
import { useActor, useInterpret } from '@xstate/react';
import { Tab, appStateMachine } from '../../state';
import { FloatingButton } from '../FloatingButton/FloatingButton';
import {
  GlobalStateContext,
  GlobalStateContextValue,
} from '../../context/GlobalStateContext';
import { useNavigate } from 'react-router-dom';

interface MenuBarProps {
  editor: Editor | null;
  tipTapEditorId: string;
  systemNote: string;
}

export const MenuBar: React.FC<MenuBarProps> = ({ editor, tipTapEditorId }) => {
  const { appStateService }: GlobalStateContextValue =
    useContext(GlobalStateContext);
  const [isContext, setIsContext] = useState(false);
  const [systemNoteState, setSystemNoteState] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const workspaceId = location.pathname.split('/')[1];
  const tabId = location.pathname.split('/')[2];
  const [state, send] = useActor(appStateService);
  const navigate = useNavigate();

  useEffect(() => {
    const ws = state.context.workspaces[workspaceId];
    const tab = ws?.data.tiptap.tabs.find((tab: Tab) => tab.id === tabId);
    setSystemNoteState(tab.systemNote);
    if (tab) {
      console.log('Updating local state:', tab); // Add this line for debugging
      setIsContext(tab.isContext);
      setSystemNoteState(tab.systemNote);
    }
  }, [state.context.workspaces, tabId, workspaceId]);

  return (
    <div className=" bg-darker">
      <span className="absolute bottom-12">
        <FloatingButton handleClick={() => setShowMenu(!showMenu)} />
      </span>
      {showMenu && (
        <div className=" flex items-center justify-around left-12 bg-dark p-8">
          <button
            onClick={async () => {
              console.log('Sending TOGGLE_CONTEXT event'); // Add this line for debugging
              send({
                type: 'TOGGLE_CONTEXT',
                id: tipTapEditorId,
                workspaceId,
              });
              setIsContext(!isContext);
            }}
          >
            Context {isContext ? ' ✅' : ' ◻️'}
          </button>

          <textarea
            value={systemNoteState}
            className="w-96 rounded-md p-2 bg-base text-light"
            placeholder="System Note"
            onChange={(e) => {
              setSystemNoteState(e.target.value);
              send({
                type: 'UPDATE_TAB_SYSTEM_NOTE',
                id: tipTapEditorId,
                systemNote: e.target.value,
                workspaceId,
              });
            }}
          />
          <button
            className="p-2 bg-red-900 rounded-md text-light"
            onClick={async () => {
              setLoading(true);
              send({
                type: 'DELETE_TAB',
                id: tipTapEditorId,
                workspaceId,
              });
              setLoading(false);
              navigate(`/${workspaceId}`);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};
