/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/jsx-no-comment-textnodes */
import React, { useContext, useEffect, useRef } from 'react';
import { Sidenav, initTE } from 'tw-elements';
import { useSelector } from '@xstate/react';
import { useClickAway } from '@uidotdev/usehooks';
import { Link, useNavigate } from 'react-router-dom';
import { ACDoc, Workspace, handleCreateDoc } from '../../state';
import { v4 as uuidv4 } from 'uuid';
import {
  GlobalStateContext,
  GlobalStateContextValue,
} from '../../context/GlobalStateContext';
import { ProjectLinks } from '../ProjectLinks/ProjectLinks';
import { ExpansionPanel } from '@chatscope/chat-ui-kit-react';

export const SideNav: React.FC = () => {
  const navigate = useNavigate();
  const globalServices: GlobalStateContextValue =
    useContext(GlobalStateContext);
  const workspaces = useSelector(
    globalServices.appStateService,
    (state) => state.context.workspaces,
  );
  const docs = useSelector(
    globalServices.appStateService,
    (state) => state.context.docs,
  );
  const navOpen = useSelector(
    globalServices.uiStateService,
    (state) => state.context.sideNavOpen,
  );
  const [docsOpen, setDocsOpen] = React.useState(true);
  const navOpenRef = useRef(navOpen);
  navOpenRef.current = navOpen;

  const ref = useClickAway(() => {
    if (!navOpenRef.current) return;
    globalServices.uiStateService.send({ type: 'TOGGLE_SIDE_NAV' });
  });

  useEffect(() => {
    initTE({ Sidenav });
  }, []);

  // @TODO: use create workspace from state machine
  const createWorkspace = () => {
    const id = uuidv4();
    const tabId = uuidv4();
    const name = prompt('Enter a name for your new workspace');
    if (!name) return;
    const newWorkspace: Workspace = {
      id,
      name,
      createdAt: new Date().toString(),
      lastUpdated: new Date().toString(),
      private: false,
      docIds: [tabId],
    };
    const doc: ACDoc = {
      id: tabId,
      title: `Welcome to ${name}!`,
      content: '',
      createdAt: new Date().toString(),
      lastUpdated: new Date().toString(),
      workspaceId: id,
      filetype: 'md',
      canEdit: true,
      autoSave: true,
      isContext: false,
      systemNote: '',
    };
    globalServices.appStateService.send('ADD_WORKSPACE', {
      workspace: newWorkspace,
      doc,
    });

    globalServices.agentStateService.send('CREATE_AGENT', {
      workspaceId: id,
    });

    setTimeout(() => {
      navigate(`/${id}/documents/${tabId}`);
    }, 250);
  };

  const createTab = async (workspaceId: string) => {
    const title = prompt('Enter a name for your new tab');
    if (!title) return;
    const tab: ACDoc = await handleCreateDoc(
      { title, content: '' },
      workspaceId,
    );
    globalServices.appStateService.send({
      type: 'ADD_DOC',
      doc: tab,
    });
    setTimeout(() => {
      navigate(`/${workspaceId}/documents/${tab.id}`);
    }, 250);
    globalServices.uiStateService.send({
      type: 'TOGGLE_SIDE_NAV',
    });
  };

  return (
    <nav
      className="fixed flex flex-col left-0 top-0 z-[1035] max-h-full w-60 -translate-x-full overflow-hidden bg-dark shadow-[0_4px_12px_0_rgba(0,0,0,0.07),_0_2px_4px_rgba(0,0,0,0.05)] data-[te-sidenav-hidden='false']:translate-x-0 dark:bg-dark"
      data-te-sidenav-init
      data-te-sidenav-hidden={!navOpen}
      data-te-sidenav-mode="push"
      data-te-sidenav-content="#content"
      ref={ref}
    >
      {navOpen && (
        <>
          <ul
            className="relative m-0 list-none flex-grow max-height-[calc(100vh-4rem)] overflow-y-auto"
            data-te-sidenav-menu-ref
          >
            {workspaces &&
              Object.values(workspaces)
                .sort((workspace) => (workspace.id === 'docs' ? -1 : 1))
                .map((workspace) => (
                  <div className="relative pb-2" key={workspace.id}>
                    <ExpansionPanel
                      className="border-b border-darker border-b-solid border-l-0 border-r-0 border-t-0"
                      title={workspace.name}
                      onChange={() => {
                        if (workspace.id === 'docs') setDocsOpen(!docsOpen);
                      }}
                      isOpened={workspace.id === 'docs' ? docsOpen : undefined}
                    >
                      {docs &&
                        Object.values(docs)
                          .filter((tab) => tab.workspaceId === workspace.id)
                          .map((tab) => (
                            <li
                              className="relative text-ellipsis overflow-hidden mb-2 group transition duration-300 ease-linear "
                              key={tab.id}
                            >
                              <div className="flex items-center justify-between">
                                <Link
                                  className="w-full flex h-6 cursor-pointer items-center leading-4 text-ellipsis rounded-[5px] py-4 text-[0.78rem]  text-acai-white outline-none transition duration-300 ease-linear  hover:outline-none  hover:underline"
                                  to={`/${workspace.id}/documents/${tab.id}`}
                                  data-te-sidenav-link-ref
                                  onClick={() => {
                                    globalServices.uiStateService.send({
                                      type: 'TOGGLE_SIDE_NAV',
                                    });
                                  }}
                                >
                                  <span>{tab.title}</span>
                                </Link>
                                {workspace.id !== 'docs' && (
                                  <button
                                    className="p-0 px-1 flex-grow-0 text-red-900 rounded-full  opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                    onClick={async () => {
                                      const confirmDelete = window.prompt(
                                        'Type "delete" to confirm',
                                      );
                                      if (
                                        confirmDelete?.toLowerCase() !==
                                        'delete'
                                      ) {
                                        alert('Deletion cancelled.');
                                        return;
                                      }
                                      globalServices.appStateService.send({
                                        type: 'DELETE_DOC',
                                        id: tab.id,
                                        workspaceId: workspace.id,
                                      });
                                      setTimeout(() => {
                                        navigate(`/${workspace.id}`);
                                      }, 250);
                                      globalServices.uiStateService.send({
                                        type: 'TOGGLE_SIDE_NAV',
                                      });
                                    }}
                                  >
                                    x
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                      {workspace.id !== 'docs' && (
                        <button
                          className="rounded-none text-acai-white  text-xs w-full text-center transition duration-300 ease-linear"
                          onClick={() => {
                            createTab(workspace.id);
                          }}
                        >
                          +
                        </button>
                      )}
                    </ExpansionPanel>
                  </div>
                ))}
            <button
              className="w-full rounded-none text-acai-white text-xs  hover:text-acai-white pl-2 text-left transition duration-300 ease-linear"
              onClick={createWorkspace}
            >
              New Workspace +
            </button>
          </ul>
          <ProjectLinks />
        </>
      )}
    </nav>
  );
};
