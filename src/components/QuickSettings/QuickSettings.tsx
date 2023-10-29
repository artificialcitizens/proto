/* eslint-disable jsx-a11y/media-has-caption */
import React, { useContext, useEffect, useState } from 'react';
import { useAva } from '../Ava/use-ava';

import useSpeechRecognition from '../../hooks/use-speech-recognition';
import { useBark } from '../../hooks/use-bark';

import { useElevenlabs } from '../../hooks/use-elevenlabs';
import { useVoiceCommands } from '../../state/use-voice-command';
import { useWebSpeechSynthesis } from '../../hooks/use-web-tts';
import { getToken } from '../../utils/config';
import { toastifyError, toastifyInfo } from '../Toast';
import { useActor, useSelector } from '@xstate/react';
import {
  GlobalStateContextValue,
  GlobalStateContext,
} from '../../context/GlobalStateContext';
import { useParams } from 'react-router-dom';
import { ChatHistory } from '../../state';
import Dropdown from '../DropDown';
import { useLocalStorageKeyValue } from '../../hooks/use-local-storage';
import { simplifyResponseChain } from '../../lib/ac-langchain/chains/simplify-response-chain';
import { VoiceState } from '../../state/speech.xstate';
import ChatModelDropdown from '../ChatSettings';
import { ExpansionPanel } from '@chatscope/chat-ui-kit-react';
import { useSaveWorkspace } from '../../hooks/use-save-workspace';

interface VoiceRecognitionProps {
  audioContext?: AudioContext;
  onVoiceActivation: (bool: boolean) => void;
}

const QuickSettings: React.FC<VoiceRecognitionProps> = ({
  onVoiceActivation,
  audioContext,
}) => {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const { queryAva, loading } = useAva();
  const [ttsLoading, setTtsLoading] = useState<boolean>(false);
  const elevenlabsKey = getToken('ELEVENLABS_API_KEY');
  const { synthesizeElevenLabsSpeech, voices } = useElevenlabs();
  const [elevenLabsVoice] = useLocalStorageKeyValue(
    'ELEVENLABS_VOICE',
    voices?.[0]?.value,
  );

  const [manualTTS, setManualTTS] = useState<string>('');
  const synthesizeBarkSpeech = useBark();
  const synthesizeWebSpeech = useWebSpeechSynthesis();
  const {
    setUserTranscript,
    setVoiceRecognitionState,
    userTranscript,
    voiceRecognitionState,
    handleVoiceCommand,
  } = useVoiceCommands();
  const { agentStateService, speechStateService }: GlobalStateContextValue =
    useContext(GlobalStateContext);
  const micRecording = useSelector(
    speechStateService,
    (state) => state.context.micRecording,
  );
  const singleCommand = useSelector(
    speechStateService,
    (state) => state.context.singleCommand,
  );

  const ttsMode = useSelector(
    speechStateService,
    (state) => state.context.ttsMode,
  );

  const [state, send] = useActor(agentStateService);
  const { workspaceId: rawWorkspaceId } = useParams<{
    workspaceId: string;
    domain: string;
    id: string;
  }>();

  const workspaceId = rawWorkspaceId || 'docs';
  const recentChatHistory = state.context[workspaceId]?.recentChatHistory;
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const srcRef = React.useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = React.useRef<GainNode | null>(null);

  const { saveWorkspace } = useSaveWorkspace();

  const handleVoiceStateChange = (voiceState: VoiceState) => {
    setVoiceRecognitionState(voiceState);
  };

  const normalizedAudioElement = async (
    audioElem: HTMLAudioElement,
    audioBlob: Blob,
    audioContext: AudioContext,
  ) => {
    if (!srcRef.current) {
      srcRef.current = audioContext.createMediaElementSource(audioElem);
    }

    if (!gainNodeRef.current) {
      gainNodeRef.current = audioContext.createGain();
    }

    gainNodeRef.current.gain.value = 1.0;

    const arrayBuffer = await audioBlob.arrayBuffer();
    const decodedData = await audioContext.decodeAudioData(arrayBuffer);

    const decodedBuffer = decodedData.getChannelData(0);
    const sliceLen = Math.floor(decodedData.sampleRate * 0.05);
    const averages = [];
    let sum = 0.0;
    for (let i = 0; i < decodedBuffer.length; i++) {
      sum += decodedBuffer[i] ** 2;
      if (i % sliceLen === 0) {
        sum = Math.sqrt(sum / sliceLen);
        averages.push(sum);
        sum = 0;
      }
    }
    averages.sort((a, b) => a - b);
    const a = averages[Math.floor(averages.length * 0.95)];

    let gain = 1.0 / a;
    gain = gain / 10.0;
    gain = Math.max(gain, 0.02);
    gain = Math.min(gain, 1);

    gainNodeRef.current!.gain.value = gain;
  };

  useEffect(() => {
    const isOn = voiceRecognitionState !== 'idle';
    onVoiceActivation(isOn);
  }, [voiceRecognitionState, onVoiceActivation]);

  const handleVoiceRecognition = async (t: string) => {
    if (!t || t.split(' ').length < 2) return;
    if (ttsLoading) return;

    switch (voiceRecognitionState) {
      case 'voice': {
        synthesizeAndPlay(t);
        break;
      }
      case 'ava': {
        const userChatHistory: ChatHistory = {
          id: workspaceId,
          text: t.trim(),
          timestamp: Math.floor(Date.now() / 1000).toString(),
          type: 'user',
        };

        send({
          type: 'UPDATE_CHAT_HISTORY',
          workspaceId: workspaceId,
          recentChatHistory: [...recentChatHistory, userChatHistory],
        });
        toastifyInfo('Generating Text');
        const { response } = await queryAva({
          message: t,
          systemMessage: '',
        });
        const sentenceDelimiters = ['.', '?', '!'];
        const sentenceCount = sentenceDelimiters.reduce(
          (count, delimiter) => count + response.split(delimiter).length - 1,
          0,
        );

        let voiceResponse;
        // if response is longer than 3 sentences implify it
        if (sentenceCount > 3) {
          voiceResponse = await simplifyResponseChain(
            `User:${t}\n\nAssistant:${response}\n\nSingle Sentence Response:`,
          );
        } else {
          voiceResponse = response;
        }
        synthesizeAndPlay(voiceResponse).then(async () => {
          const res = await Promise.resolve(response);
          const assistantChatHistory: ChatHistory = {
            id: workspaceId,
            text: res,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: 'assistant',
          };
          send({
            type: 'UPDATE_CHAT_HISTORY',
            workspaceId: workspaceId,
            recentChatHistory: [
              ...recentChatHistory,
              userChatHistory,
              assistantChatHistory,
            ],
          });
        });

        break;
      }
      case 'notes':
      case 'idle':
        break;
    }
  };

  // @TODO: Configure to trigger via state
  const synthesizeAndPlay = async (response: string) => {
    if (ttsLoading) return;
    setTtsLoading(true);
    try {
      let audioData;
      toastifyInfo('Generating Audio');
      if (ttsMode === 'bark') {
        audioData = await synthesizeBarkSpeech({
          inputText: response,
          voicePreset: undefined,
        });
      } else if (ttsMode === 'elevenlabs') {
        if (!elevenlabsKey) {
          toastifyError('Missing Elevenlabs API Key');
          setTtsLoading(false);
          return;
        }
        audioData = await synthesizeElevenLabsSpeech(response, elevenLabsVoice);
      } else if (ttsMode === 'webSpeech') {
        synthesizeWebSpeech(response, () => {
          setUserTranscript('');
          setTtsLoading(false);
        });
        if (singleCommand) setVoiceRecognitionState('idle');
        return;
      } else {
        setTtsLoading(false);
        return;
      }

      if (audioData && audioContext && audioRef.current) {
        const audioBlob = new Blob([audioData], {
          type: ttsMode === 'bark' ? 'audio/wav' : 'audio/mpeg',
        });
        const audioUrl = URL.createObjectURL(audioBlob);
        normalizedAudioElement(audioRef.current, audioBlob, audioContext);
        setAudioSrc(audioUrl);
      }
      if (singleCommand) {
        setVoiceRecognitionState('idle');
      }
    } catch (error) {
      toastifyError('Error synthesizing speech');
      setTtsLoading(false);
    }
  };

  const onTranscriptionComplete = async (t: string) => {
    const updatedUserTranscript = userTranscript
      ? userTranscript + '\n' + t
      : t;
    setUserTranscript(updatedUserTranscript);
    handleVoiceCommand(t);
    handleVoiceRecognition(updatedUserTranscript);
  };

  useSpeechRecognition({
    onTranscriptionComplete,
    // @TODO: Fix hacky listening state
    active: !ttsLoading && micRecording ? true : false,
  });

  const handleManualTTS = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    synthesizeAndPlay(manualTTS);
    setManualTTS('');
  };

  const voiceStateOptions = Object.values(VoiceState).map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
  }));

  return (
    <div
      className={`rounded-lg mb-2 items-center justify-between flex-col flex-grow h-full`}
    >
      {workspaceId && <ChatModelDropdown workspaceId={workspaceId} />}
      <Dropdown
        label="Synthesis Mode"
        options={voiceStateOptions}
        value={voiceRecognitionState}
        onChange={(e) => handleVoiceStateChange(e as VoiceState)}
      />
      <button
        className="text-center w-full rounded-none text-acai-white text-xs  hover:text-acai-light pl-2 transition duration-150 ease-linear"
        onClick={() => {
          if (!workspaceId) return;
          saveWorkspace(workspaceId);
        }}
      >
        Export Workspace
      </button>
      {/* 
      <ExpansionPanel className="border-t-0" title="ManualTTS">
        <form
          className="text-acai-white w-full flex flex-col flex-grow my-2"
          onSubmit={handleManualTTS}
        >
          <label className="mb-2 ml-2 text-sm md:text-xs" htmlFor="manualTTS">
            Manual TTS
          </label>
          <textarea
            placeholder="Enter text to synthesize, press submit or enter to play"
            id="manualTTS"
            className="rounded bg-base text-acai-white text-base md:text-xs p-4 mb-2"
            value={manualTTS}
            onChange={(e) => setManualTTS(e.target.value)}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleManualTTS(e);
              }
            }}
          />
          <button
            className="bg-light text-sm md:text-xs text-acai-white px-4 py-2 rounded-md transition-colors duration-200 ease-in-out hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-gray-50 focus:ring-opacity-50 cursor-pointer"
            type="submit"
          >
            Submit
          </button>
        </form>
      </ExpansionPanel> */}

      {audioContext && (
        <audio
          ref={audioRef}
          className="rounded-full p-2 w-full absolute hidden"
          controls
          src={audioSrc ? audioSrc : undefined}
          autoPlay
          onPlay={() => {
            srcRef.current!.connect(gainNodeRef.current!);
            gainNodeRef.current!.connect(audioContext.destination);
          }}
          onEnded={() => {
            if (singleCommand) setVoiceRecognitionState('idle');
            setUserTranscript('');
            setTtsLoading(false);
            srcRef.current!.disconnect(gainNodeRef.current!);
            gainNodeRef.current!.disconnect(audioContext.destination);
          }}
          onError={() => {
            toastifyError('Error playing audio');
            setTtsLoading(false);
            srcRef.current!.disconnect(gainNodeRef.current!);
            gainNodeRef.current!.disconnect(audioContext.destination);
          }}
        />
      )}
    </div>
  );
};

export default QuickSettings;
