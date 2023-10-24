import React, { useContext, useState } from 'react';
import SBSidebar from '../Sidebar/SBSidebar';
import { ExpansionPanel } from '@chatscope/chat-ui-kit-react';
import Chat from '../../components/Chat/Chat';
import { useSelector } from '@xstate/react';
import { useAva } from './use-ava';
import {
  GlobalStateContext,
  GlobalStateContextValue,
} from '../../context/GlobalStateContext';
import QuickSettings from '../QuickSettings/QuickSettings';
import { toastifyError } from '../Toast';

interface AvaProps {
  workspaceId: string;
  audioContext?: AudioContext;
  onVoiceActivation: (bool: boolean) => void;
}

export const Ava: React.FC<AvaProps> = ({
  workspaceId,
  onVoiceActivation,
  audioContext,
}) => {
  const { agentStateService }: GlobalStateContextValue =
    useContext(GlobalStateContext);

  const systemNotes =
    useSelector(
      agentStateService,
      (state) => state.context[workspaceId]?.customPrompt,
    ) || '';
  const { queryAva, streamingMessage, loading } = useAva();

  const currentAgentMode = useSelector(
    agentStateService,
    (state) => state.context[workspaceId]?.agentMode,
  );

  const formatAgentMode = (mode: string) => {
    if (!mode) return '';
    switch (mode) {
      case 'ava':
        return 'Chat - AVA';
      case 'chat':
        return 'Chat';
      default:
        return 'Chat - ' + mode.charAt(0).toUpperCase() + mode.slice(1);
    }
  };

  return (
    // @TODO: update to manage toggle via state
    <SBSidebar>
      <ExpansionPanel
        className="pt-12 md:pt-6 border-0"
        title={formatAgentMode(currentAgentMode)}
      >
        <QuickSettings
          onVoiceActivation={onVoiceActivation}
          audioContext={audioContext}
        />
      </ExpansionPanel>

      {workspaceId && (
        <span className="flex flex-col flex-grow">
          <div className="flex flex-col flex-grow p-2 pt-0 mb-2 md:mb-0">
            <Chat
              name="Ava"
              avatar=".."
              abortController={null}
              loading={loading}
              streamingMessage={streamingMessage}
              onSubmitHandler={async (message) => {
                try {
                  const { response } = await queryAva({
                    message,
                    systemMessage: systemNotes,
                  });
                  return response;
                } catch (e: any) {
                  toastifyError(e.message);
                  return 'Sorry, I had an issue processing your query.';
                }
              }}
            />
          </div>
        </span>
      )}
    </SBSidebar>
  );
};

export default Ava;
