﻿declare var kaitaiFsFiles: string[];

interface IFileSystem {
    getRootNode(): Promise<any>;
    get(fn): Promise<string | ArrayBuffer>;
    put(fn, data): Promise<void>;
}

interface IFsItem {
    fsType: string;
    type: 'file' | 'folder';
    fn?: string;
    children?: { [key: string]: IFsItem; };
}

var fsHelper = {
    selectNode(root: IFsItem, fn: string) {
        var currNode = root;
        var fnParts = fn.split('/');
        var currPath = '';
        for (var i = 0; i < fnParts.length; i++) {
            var fnPart = fnParts[i];
            currPath += (currPath ? '/' : '') + fnPart;

            if (!('children' in currNode)) {
                currNode.children = { };
                currNode.type = 'folder';
            }
                
            if (!(fnPart in currNode.children))
                currNode.children[fnPart] = { fsType: root.fsType, type: 'file', fn: currPath };

            currNode = currNode.children[fnPart];
        }
        return currNode;    
    }
}

class LocalStorageFs implements IFileSystem {
    constructor(public prefix: string) { }

    private root: IFsItem;
    private rootPromise: Promise<IFsItem>;
    private filesKey() { return `${this.prefix}_files`; }
    private fileKey(fn) { return `${this.prefix}_file[${fn}]`; }

    private save() { return localforage.setItem(this.filesKey(), this.root); }

    getRootNode() {
        if (this.root)
            return Promise.resolve(this.root);
        this.rootPromise = localforage.getItem<IFsItem>(this.filesKey()).then(x => x || <IFsItem>{ fsType: 'local' }).then(r => this.root = r);
        return this.rootPromise;
    }

    setRootNode(newRoot) {
        this.root = newRoot;
        return this.save();
    }

    get(fn) { return localforage.getItem<string|ArrayBuffer>(this.fileKey(fn)); }

    put(fn, data) {
        return this.getRootNode().then(root => {
            var node = fsHelper.selectNode(root, fn);
            return Promise.all([localforage.setItem(this.fileKey(fn), data), this.save()]).then(x => node);
        });
    }
}

class KaitaiFs implements IFileSystem {
    constructor(public files: any){ }

    getRootNode() { return Promise.resolve(this.files); }

    get(fn) {
        if (fn.toLowerCase().endsWith('.ksy'))
            return Promise.resolve<string>($.ajax({ url: fn }));
        else
            return downloadFile(fn);
    }

    put(fn, data) { return Promise.reject('KaitaiFs.put is not implemented!'); }
}

class StaticFs implements IFileSystem {
    public files: { [fn: string]:string };
    constructor() { this.files = {}; }
    getRootNode() { return Promise.resolve(Object.keys(this.files).map(fn => <IFsItem>{ fsType: 'static', type: 'file', fn })); }
    get(fn) { return Promise.resolve(this.files[fn]); }
    put(fn, data) { this.files[fn] = data; return Promise.resolve(); }
}

var kaitaiRoot = <IFsItem>{ fsType: 'kaitai' };
kaitaiFsFiles.forEach(fn => fsHelper.selectNode(kaitaiRoot, fn));
var kaitaiFs = new KaitaiFs(kaitaiRoot);
var staticFs = new StaticFs();

var localFs = new LocalStorageFs("fs");
var fss = { local: localFs, kaitai: kaitaiFs, static: staticFs };

function genChildNode(obj: IFsItem, fn: string) {
    var isFolder = obj.type === 'folder';
    return {
        text: fn,
        icon: 'glyphicon glyphicon-' + (isFolder ? 'folder-open' : fn.endsWith('.ksy') ? 'list-alt' : 'file'),
        children: isFolder ? genChildNodes(obj) : null,
        data: obj
    };
}

function genChildNodes(obj) {
    return Object.keys(obj.children).map(k => genChildNode(obj.children[k], k));
}

function refreshFsNodes() {
    var localStorageNode = ui.fileTree.get_node('localStorage');
    localFs.getRootNode().then(root => {
        ui.fileTree.delete_node(localStorageNode.children);
        if (root)
            genChildNodes(root).forEach(node => ui.fileTree.create_node(localStorageNode, node));
    });
}

function addKsyFile(parent, name, fsItem) {
    ui.fileTree.create_node(ui.fileTree.get_node(parent), { text: name, data: fsItem, icon: 'glyphicon glyphicon-list-alt' }, "last", node => ui.fileTree.activate_node(node, null));
}

var fileTreeCont;

$(() => {
    if (!ui.fileTreeCont) return;

    fileTreeCont = ui.fileTreeCont.find('.fileTree');

    ui.fileTree = fileTreeCont.jstree({
        core: {
            check_callback: function (operation, node, node_parent, node_position, more) {
                var result = true;
                if (operation === "move_node")
                    result = !!node.data && node.data.fsType === "local" && !!node_parent.data && node_parent.data.fsType === "local" && node_parent.data.type === "folder";
                return result;
            },
            themes: { name: "default-dark", dots: false, icons: true, variant: 'small' },
            data: [
                {
                    text: 'kaitai.io',
                    icon: 'glyphicon glyphicon-cloud',
                    state: { opened: true },
                    children: [
                        { text: 'formats', icon: 'glyphicon glyphicon-book', children: genChildNodes(kaitaiRoot.children['formats']), state: { opened: true } },
                        { text: 'samples', icon: 'glyphicon glyphicon-cd', children: genChildNodes(kaitaiRoot.children['samples']), state: { opened: true } },
                    ]
                },
                { text: 'Local storage', id: 'localStorage', icon: 'glyphicon glyphicon-hdd', state: { opened: true }, children: [], data: { fsType: 'local', type: 'folder' } }
            ],
        },
        plugins: ["wholerow", "dnd"]
    }).bind('loaded.jstree', refreshFsNodes).jstree(true);

    var uiFiles = {
        fileTreeContextMenu: $("#fileTreeContextMenu"),
        openItem: $('#fileTreeContextMenu .openItem'),
        createFolder: $('#fileTreeContextMenu .createFolder'),
        createKsyFile: $('#fileTreeContextMenu .createKsyFile'),
        cloneKsyFile: $('#fileTreeContextMenu .cloneKsyFile'),
        generateParser: $('#fileTreeContextMenu .generateParser'),
        downloadItem: $('#fileTreeContextMenu .downloadItem'),
        deleteItem: $('#fileTreeContextMenu .deleteItem'),
        createLocalKsyFile: $('#createLocalKsyFile'),
        uploadFile: $('#uploadFile'),
        downloadFile: $('#downloadFile'),
    };

    function convertTreeNode(treeNode) {
        var data = treeNode.data;
        data.children = {};
        treeNode.children.forEach(child => data.children[child.text] = convertTreeNode(child));
        return data;
    }

    function saveTree() {
        localFs.setRootNode(convertTreeNode(ui.fileTree.get_json()[1]));
    }

    var contextMenuTarget = null;

    function getSelectedData() {
        var selected = ui.fileTree.get_selected();
        return selected.length >= 1 ? <IFsItem>ui.fileTree.get_node(selected[0]).data : null;
    }

    fileTreeCont.on('contextmenu', '.jstree-node', e => {
        contextMenuTarget = e.target;

        var clickNodeId = ui.fileTree.get_node(contextMenuTarget).id;
        var selectedNodeIds = ui.fileTree.get_selected();
        if ($.inArray(clickNodeId, selectedNodeIds) === -1)
            ui.fileTree.activate_node(contextMenuTarget, null);

        var data = getSelectedData();
        var isFolder = data && data.type === 'folder';
        var isLocal = data && data.fsType === 'local';
        var isKsy = data && data.fn && data.fn.endsWith('.ksy') && !isFolder;

        function setEnabled(item, isEnabled) { item.toggleClass('disabled', !isEnabled); }

        setEnabled(uiFiles.createFolder, isLocal && isFolder);
        setEnabled(uiFiles.createKsyFile, isLocal && isFolder);
        setEnabled(uiFiles.cloneKsyFile, isLocal && isKsy);
        setEnabled(uiFiles.deleteItem, isLocal);
        setEnabled(uiFiles.generateParser, isKsy);
        uiFiles.fileTreeContextMenu.css({ display: "block", left: e.pageX, top: e.pageY });
        return false;
    });

    function ctxAction(obj, callback) {
        obj.find('a').on('click', e => {
            if (!obj.hasClass('disabled')) {
                uiFiles.fileTreeContextMenu.hide();
                callback(e);
            }
        });
    }

    ctxAction(uiFiles.createFolder, e => {
        var parentData = getSelectedData();
        ui.fileTree.create_node(ui.fileTree.get_node(contextMenuTarget), { data: { fsType: parentData.fsType, type: 'folder' }, icon: 'glyphicon glyphicon-folder-open' }, "last", node => {
            ui.fileTree.activate_node(node, null);
            setTimeout(function () { ui.fileTree.edit(node); }, 0);
        });
    });

    ctxAction(uiFiles.deleteItem, e => ui.fileTree.delete_node(ui.fileTree.get_selected()));
    ctxAction(uiFiles.openItem, e => $(contextMenuTarget).trigger('dblclick'));

    ctxAction(uiFiles.generateParser, e => {
        var fsItem = getSelectedData();
        var linkData = $(e.target).data();
        //console.log(fsItem, linkData);

        fss[fsItem.fsType].get(fsItem.fn).then(content => {
            var compiled = compile(content, linkData.kslang, !!linkData.ksdebug);
            compiled.forEach((compItem, i) => {
                var title = fsItem.fn.split('/').last() + ' [' + $(e.target).text() + ']' + (compiled.length == 1 ? '' : ` ${i + 1}/${compiled.length}`);
                addEditorTab(title, compItem, linkData.acelang);
            });
        });
    });

    fileTreeCont.on('create_node.jstree rename_node.jstree delete_node.jstree move_node.jstree paste.jstree', saveTree);
    fileTreeCont.on('move_node.jstree', (e, data) => ui.fileTree.open_node(ui.fileTree.get_node(data.parent)));
    fileTreeCont.on('select_node.jstree', (e, selectNodeArgs) => {
        var fsItem = (<JSTreeNode<IFsItem>>selectNodeArgs.node).data;
        [uiFiles.downloadFile, uiFiles.downloadItem].forEach(i => i.toggleClass('disabled', !(fsItem && fsItem.type === 'file')));
    });

    var ksyParent;
    function showKsyModal(parent) {
        ksyParent = parent;
        $('#newKsyName').val('');
        (<any>$('#newKsyModal')).modal();
    }

    ctxAction(uiFiles.createKsyFile, () => showKsyModal(contextMenuTarget));
    uiFiles.createLocalKsyFile.on('click', () => showKsyModal('localStorage'));

    function downloadFiles() {
        ui.fileTree.get_selected().forEach(nodeId => {
            var fsItem = <IFsItem>ui.fileTree.get_node(nodeId).data;
            fss[fsItem.fsType].get(fsItem.fn).then(content => saveFile(content, fsItem.fn.split('/').last()));
        });
    }

    ctxAction(uiFiles.downloadItem, () => downloadFiles());
    uiFiles.downloadFile.on('click', () => downloadFiles());

    uiFiles.uploadFile.on('click', () => openFilesWithDialog(addNewFiles));

    $('#newKsyModal').on('shown.bs.modal', () => { $('#newKsyModal input').focus(); });
    $('#newKsyModal form').submit(function (event) {
        event.preventDefault();
        (<any>$('#newKsyModal')).modal('hide');

        var ksyName = $('#newKsyName').val();
        var parentData = ui.fileTree.get_node(ksyParent).data;

        fss[parentData.fsType].put((parentData.fn ? `${parentData.fn}/` : '') + `${ksyName}.ksy`, `meta:\n  id: ${ksyName}\n  file-extension: ${ksyName}\n`).then(fsItem => {
            addKsyFile(ksyParent, `${ksyName}.ksy`, fsItem);
            return loadFsItem(fsItem);
        });
    });

    fileTreeCont.bind("dblclick.jstree", function (event) {
        loadFsItem(<IFsItem>ui.fileTree.get_node(event.target).data);
    });

    ctxAction(uiFiles.cloneKsyFile, e => {
        var fsItem = getSelectedData();
        var newFn = fsItem.fn.replace('.ksy', '_' + new Date().format('Ymd_His') + '.ksy');
        console.log('newFn', newFn);

        fss[fsItem.fsType].get(fsItem.fn).then(content =>
            fss[fsItem.fsType].put(newFn, content).then(fsItem =>
                addKsyFile('localStorage', newFn.split('/').last(), fsItem)));
    });
})