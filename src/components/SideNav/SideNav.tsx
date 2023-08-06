/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useContext, useEffect, useRef } from 'react';
import { Sidenav, initTE } from 'tw-elements';
import { useActor } from '@xstate/react';
import { useClickAway } from '@uidotdev/usehooks';
import { Link, useNavigate } from 'react-router-dom';
import { Workspace, handleCreateTab } from '../../state';
import { v4 as uuidv4 } from 'uuid';
import { GlobalStateContext, GlobalStateContextValue } from '../../context/GlobalStateContext';
import { ProjectLinks } from '../ProjectLinks/ProjectLinks';
interface SideNavProps {
  children?: React.ReactNode;
}

export const SideNav: React.FC<SideNavProps> = ({ children }) => {
  const navigate = useNavigate();
  const globalServices: GlobalStateContextValue = useContext(GlobalStateContext);
  const [state, send] = useActor(globalServices.uiStateService);
  const navOpen = state.context.sideNavOpen;

  const navOpenRef = useRef(navOpen);
  navOpenRef.current = navOpen;

  const ref = useClickAway(() => {
    if (!navOpenRef.current) return;
    send({ type: 'TOGGLE_SIDE_NAV' });
  });

  useEffect(() => {
    initTE({ Sidenav });
  }, []);

  const createWorkspace = () => {
    const id = uuidv4().split('-')[0];
    const tabId = uuidv4().split('-')[0];
    const name = prompt('Enter a name for your new workspace');
    if (!name) return;
    const newWorkspace: Workspace = {
      id,
      name,
      createdAt: new Date().toString(),
      lastUpdated: new Date().toString(),
      private: false,
      settings: {
        webSpeechRecognition: false,
        tts: false,
        whisper: false,
      },
      data: {
        tiptap: {
          tabs: [
            {
              id: tabId,
              title: `Welcome to ${name}!`,
              content: '',
              isContext: false,
              systemNote: '',
              workspaceId: id,
              createdAt: new Date().toString(),
              lastUpdated: new Date().toString(),
              filetype: 'markdown',
            },
          ],
        },
        chat: {},
        agentLogs: {
          thoughts: {},
          errors: {},
        },
        agentTools: {
          calculator: false,
          weather: false,
          googleSearch: false,
          webBrowser: false,
          createDocument: false,
        },
        notes: '',
      },
    };
    globalServices.appStateService.send({ type: 'ADD_WORKSPACE', workspace: newWorkspace });

    globalServices.agentStateService.send({ type: 'CREATE_AGENT', workspaceId: id });
    navigate(`/${id}/${tabId}`);
  };

  // Function to create a new tab
  const createTab = async (workspaceId: string) => {
    const title = prompt('Enter a name for your new tab');
    if (!title) return;
    const { id } = await handleCreateTab({ title, content: '' }, workspaceId);
    navigate(`/${workspaceId}/${id}`);
    globalServices.uiStateService.send({ type: 'TOGGLE_SIDE_NAV', workspaceId });
  };
  const workspaces = globalServices.appStateService.getSnapshot().context.workspaces as Record<string, Workspace>;
  return (
    <nav
      className="fixed left-0 top-0 z-[1035] h-screen w-60 -translate-x-full overflow-hidden bg-dark shadow-[0_4px_12px_0_rgba(0,0,0,0.07),_0_2px_4px_rgba(0,0,0,0.05)] data-[te-sidenav-hidden='false']:translate-x-0 dark:bg-zinc-800"
      data-te-sidenav-init
      data-te-sidenav-hidden={!navOpen}
      data-te-sidenav-mode="push"
      data-te-sidenav-content="#content"
      ref={ref}
    >
      <ul className="relative m-0 list-none px-[0.2rem]" data-te-sidenav-menu-ref>
        {Object.values(workspaces).map((workspace) => (
          <li className="relative pb-2 !important" key={workspace.id}>
            <Link
              className="flex h-12 cursor-pointer truncate m-auto flex-grow rounded-[5px] px-1 py-4 text-[0.875rem] text-light outline-none transition duration-300 ease-linear hover:bg-darker hover:text-inherit hover:outline-none focus:bg-darker focus:text-inherit focus:outline-none active:bg-darker active:text-inherit active:outline-none data-[te-sidenav-state-active]:text-inherit data-[te-sidenav-state-focus]:outline-none motion-reduce:transition-none "
              to={`/${workspace.id}`}
              data-te-sidenav-link-ref
              onClick={() => {
                globalServices.uiStateService.send({ type: 'TOGGLE_SIDE_NAV' });
              }}
            >
              <span className="font-bold self-center">{workspace.name}</span>
            </Link>

            <ul
              className="!visible border-b border-solid border-dark pb-8 relative m-0 hidden list-none p-0 data-[te-collapse-show]:block "
              data-te-sidenav-collapse-ref
              data-te-collapse-show
            >
              {workspace.data.tiptap.tabs.map((tab) => (
                <li className="relative text-ellipsis overflow-hidden px-2 mb-2 " key={tab.id}>
                  <Link
                    className="flex h-6 cursor-pointer items-center leading-4 text-ellipsis rounded-[5px] py-4 pl-1  text-[0.78rem] text-light outline-none transition duration-300 ease-linear hover:bg-darker hover:text-inherit hover:outline-none focus:bg-darker focus:text-inherit focus:outline-none active:bg-darker active:text-inherit active:outline-none data-[te-sidenav-state-active]:text-inherit data-[te-sidenav-state-focus]:outline-none motion-reduce:transition-none"
                    to={`/${workspace.id}/${tab.id}`}
                    data-te-sidenav-link-ref
                    onClick={() => {
                      globalServices.uiStateService.send({ type: 'TOGGLE_SIDE_NAV' });
                    }}
                  >
                    <span>{tab.title}</span>
                  </Link>
                </li>
              ))}
              <button
                className="px-4 mb-4 text-dark text-xs w-full text-left"
                onClick={() => {
                  createTab(workspace.id);
                }}
              >
                New Document +
              </button>
            </ul>
          </li>
        ))}
        <button className="w-full text-dark text-xs pl-2 text-left" onClick={createWorkspace}>
          New Workspace +
        </button>
      </ul>
      {children && (
        <div className="flex flex-col flex-1 overflow-hidden" id="content">
          {children}
        </div>
      )}
      <ProjectLinks />
    </nav>
  );
};
