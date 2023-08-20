import {
  ControlledTreeEnvironment,
  UncontrolledTreeEnvironment,
  Tree,
  StaticTreeDataProvider
} from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Menu, Dropdown } from 'antd';
import { menuIndexeddbStorage } from '@renderer/store/menuIndexeddb';
import type { RevezoneFile, RevezoneFolder, OnFolderOrFileAddProps } from '@renderer/types/file';
import {
  getOpenKeysFromLocal,
  setCurrentFileIdToLocal,
  setOpenKeysToLocal
} from '@renderer/store/localstorage';
import { useAtom } from 'jotai';
import { currentFileAtom, currentFolderIdAtom, tabListAtom } from '@renderer/store/jotai';
import EditableText from '../EditableText';
import { blocksuiteStorage } from '@renderer/store/blocksuite';
// import useBlocksuitePageTitle from '@renderer/hooks/useBlocksuitePageTitle';
import OperationBar from '../OperationBar';
import moment from 'moment';
import RevezoneLogo from '../RevezoneLogo';

import './index.css';

import { Folder, HardDrive, UploadCloud } from 'lucide-react';
import useAddFile from '@renderer/hooks/useAddFile';
import useFileContextMenu from '@renderer/hooks/useFileContextMenu';
import useFolderContextMenu from '@renderer/hooks/useFolderContextMenu';
import { getCurrentFileIdFromLocal } from '@renderer/store/localstorage';
import useFileTree from '@renderer/hooks/useFileTree';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher/index';
import { boardIndexeddbStorage } from '@renderer/store/boardIndexeddb';
import { submitUserEvent } from '@renderer/utils/statistics';
import PublicBetaNotice from '@renderer/components/PublicBetaNotice';
import useTabList from '@renderer/hooks/useTabList';

interface Props {
  collapsed: boolean;
}

const items = {
  root: {
    index: 'root',
    isFolder: true,
    children: ['child1', 'child2', 'child4'],
    data: 'Root item'
  },
  child1: {
    index: 'child1',
    children: [],
    data: 'Child item 1'
  },
  child2: {
    index: 'child2',
    isFolder: true,
    children: ['child3'],
    data: 'Child item 2'
  },
  child3: {
    index: 'child3',
    children: [],
    data: 'Child item 3'
  },
  child4: {
    index: 'child4',
    isFolder: true,
    children: [],
    data: 'Child item 4'
  }
};

export default function DraggableMenuTree() {
  const [openKeys, setOpenKeys] = useState<string[]>(getOpenKeysFromLocal());
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useAtom(currentFileAtom);
  const [currentFolderId, setCurrentFolderId] = useAtom(currentFolderIdAtom);
  const [editableTextState, setEditableTextState] = useState<{ [key: string]: boolean }>({});
  const firstRenderRef = useRef(false);
  const { fileTree, getFileTree } = useFileTree();
  const { t } = useTranslation();

  const { updateTabList, tabList } = useTabList();

  const onFolderOrFileAdd = useCallback(
    ({ fileId, folderId, type }: OnFolderOrFileAddProps) => {
      setOpenKeys([...openKeys, folderId]);
      updateEditableTextState(fileId || folderId, false, editableTextState);
      if (type === 'file') {
        addSelectedKeys(fileId ? [fileId] : []);
      } else if (type === 'folder') {
        resetMenu();
        setCurrentFile(undefined);
        setSelectedKeys([folderId]);
      }
    },
    [openKeys, editableTextState]
  );

  const [addFile] = useAddFile({ onAdd: onFolderOrFileAdd });

  // const [pageTitle] = useBlocksuitePageTitle({ getFileTree });

  // useEffect(() => {
  //   !collapsed && getFileTree();
  // }, [menuIndexeddbStorage, collapsed]);

  useEffect(() => {
    getFileTree();
  }, []);

  //   useEffect(() => {
  //     if (firstRenderRef.current === true || !fileTree?.length) return;
  //     firstRenderRef.current = true;

  //     const currentFileIdFromLocal = getCurrentFileIdFromLocal();
  //     const file = currentFileIdFromLocal ? getFileById(currentFileIdFromLocal, fileTree) : undefined;

  //     setCurrentFile(file);
  //   }, [fileTree]);

  useEffect(() => {
    if (firstRenderRef.current === false) return;
    setCurrentFileIdToLocal(currentFile?.id);
    setSelectedKeys(currentFile?.id ? [currentFile.id] : []);
  }, [currentFile?.id]);

  //   useEffect(() => {
  //     if (!currentFile) {
  //       return;
  //     }
  //     const folderId = getFolderIdByFileId(currentFile.id, fileTree);
  //     setCurrentFolderId(folderId);
  //   }, [currentFile, fileTree]);

  const addSelectedKeys = useCallback(
    (keys: string[] | undefined) => {
      if (!keys) return;

      let newKeys = selectedKeys;

      keys.forEach((key: string) => {
        const type = key?.startsWith('folder_') ? 'folder' : 'file';

        newKeys = type ? newKeys.filter((_key) => !_key?.startsWith(type)) : newKeys;
      });

      newKeys = Array.from(new Set([...newKeys, ...keys])).filter((_key) => !!_key);

      setSelectedKeys(newKeys);
    },
    [selectedKeys]
  );

  const deleteFile = useCallback(
    async (file: RevezoneFile) => {
      await menuIndexeddbStorage.deleteFile(file);

      console.log('--- delete file ---', file);

      switch (file.type) {
        case 'board':
          await boardIndexeddbStorage.deleteBoard(file.id);
          break;
        case 'note':
          await blocksuiteStorage.deletePage(file.id);
          break;
      }

      setCurrentFile(undefined);

      await getFileTree();
    },
    [menuIndexeddbStorage, currentFile]
  );

  const updateEditableTextState = useCallback((id: string, value: boolean, editableTextState) => {
    const newEditableTextState = { ...editableTextState };
    newEditableTextState[id] = value;
    setEditableTextState(newEditableTextState);
  }, []);

  const deleteFolder = useCallback(
    async (folderId: string) => {
      await menuIndexeddbStorage.deleteFolder(folderId);
      await getFileTree();
    },
    [menuIndexeddbStorage]
  );

  const [getFileContextMenu] = useFileContextMenu({
    editableTextState,
    deleteFile,
    updateEditableTextState
  });

  const [getFolderContextMenu] = useFolderContextMenu({
    fileTree,
    editableTextState,
    updateEditableTextState,
    addFile,
    deleteFolder
  });

  const resetMenu = useCallback(() => {
    setCurrentFile(undefined);
    setCurrentFolderId(undefined);
    setSelectedKeys([]);
  }, []);

  const onExpandItem = useCallback((item) => {
    console.log('--- onExpandItem ---', item);
    const keys = [...openKeys, item.id];
    setOpenKeys(keys);
    setOpenKeysToLocal(keys);
  }, []);

  const onCollapseItem = useCallback((item) => {
    const keys = openKeys.filter((key) => key !== item.id);
    setOpenKeys(keys);
    setOpenKeysToLocal(keys);
  }, []);

  const onOpenChange = useCallback(
    (keys) => {
      const folderKeys = keys.filter((key) => key.startsWith('folder_'));
      const openFolderKeys = openKeys.filter((key) => key.startsWith('folder_'));

      const diffNum = folderKeys?.length - openFolderKeys.length;

      let changeType;

      switch (true) {
        case diffNum === 0:
          changeType = 'unchanged';
          break;
        case diffNum > 0:
          changeType = 'increase';
          break;
        default:
          changeType = 'decrease';
          break;
      }

      console.log('onOpenChange', changeType, folderKeys, openFolderKeys);

      setOpenKeys(keys);
      setOpenKeysToLocal(keys);

      // only while openKeys increase
      if (changeType === 'increase') {
        const folderId = keys?.length ? keys[keys.length - 1] : undefined;

        if (currentFolderId !== folderId) {
          resetMenu();

          setCurrentFolderId(folderId);
          setSelectedKeys([folderId]);
        }
      }
    },
    [openKeys, currentFolderId]
  );

  const onSelect = useCallback(
    async (keys) => {
      const key = keys?.[0];

      const fileId = key?.startsWith('file_') ? key : undefined;

      console.log('onSelect', fileId, key);

      if (!fileId) return;

      //   const folderId = getFolderIdByFileId(fileId, fileTree);

      //   resetMenu();

      const file = await menuIndexeddbStorage.getFile(fileId);

      setCurrentFile(file);
      //   setCurrentFolderId(folderId);
      //   addSelectedKeys([key, folderId]);

      updateTabList(file, tabList);

      submitUserEvent('select_menu', { key });
    },
    [fileTree, tabList]
  );

  const onFileNameChange = useCallback(
    async (text: string, file: RevezoneFile) => {
      await menuIndexeddbStorage.updateFileName(file, text);
      updateEditableTextState(file.id, true, editableTextState);

      setSelectedKeys([file.id]);

      setCurrentFile({ ...file, name: text });

      await getFileTree();
    },
    [editableTextState]
  );

  const onFolderNameChange = useCallback(
    (folder: RevezoneFolder, text: string) => {
      menuIndexeddbStorage.updateFolderName(folder, text);
      updateEditableTextState(folder.id, true, editableTextState);
    },
    [editableTextState]
  );

  const onEditableTextEdit = useCallback(
    (id: string) => {
      updateEditableTextState(id, false, editableTextState);
    },
    [editableTextState]
  );

  const storageTypeItems = [
    {
      key: 'local',
      icon: <HardDrive className="w-4 mr-1"></HardDrive>,
      label: t('storage.local')
    },
    {
      key: 'cloud',
      icon: <UploadCloud className="w-4 mr-1"></UploadCloud>,
      disabled: true,
      label: t('storage.cloud')
    }
  ];

  return (
    <div className="revezone-menu-container">
      <div className="flex flex-col mb-1 pl-5 pr-8 pt-0 justify-between">
        <div className="flex items-center">
          <RevezoneLogo size="small" onClick={() => resetMenu()} />
          <span>&nbsp;-&nbsp;{t('text.alpha')}</span>
          <PublicBetaNotice />
        </div>
        <div className="flex justify-start">
          <div className="mr-2 whitespace-nowrap">
            <Dropdown menu={{ items: storageTypeItems }}>
              <span className="text-slate-500 flex items-center cursor-pointer text-sm">
                <HardDrive className="w-4 mr-1"></HardDrive>
                {t('storage.local')}
              </span>
            </Dropdown>
          </div>
          <LanguageSwitcher></LanguageSwitcher>
        </div>
      </div>
      <OperationBar size="small" folderId={currentFolderId} onAdd={onFolderOrFileAdd} />
      <div className="menu-list border-t border-slate-100">
        <ControlledTreeEnvironment
          // dataProvider={new StaticTreeDataProvider(fileTree, (item, data) => ({ ...item, data }))}
          items={fileTree}
          getItemTitle={(item) => `${item.data.name}`}
          viewState={{
            tree: {
              selectedItems: selectedKeys,
              expandedItems: openKeys,
              focusedItem: selectedKeys?.[0]
            }
          }}
          canDragAndDrop={true}
          canDropOnFolder={true}
          canReorderItems={true}
          onSelectItems={onSelect}
          onExpandItem={onExpandItem}
          onCollapseItem={onCollapseItem}
        >
          <Tree treeId="tree" rootItem="root" treeLabel="Tree Example" />
        </ControlledTreeEnvironment>
      </div>
    </div>
  );
}
