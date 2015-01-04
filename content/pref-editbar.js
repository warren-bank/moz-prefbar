/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Preferences Toolbar 3.
 *
 * The Initial Developer of the Original Code is
 * Manuel Reimer.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Aaron Andersen <aaron@xulplanet.com>
 *                 Kevin Teuscher
 *                 Manuel Reimer <Manuel.Reimer@gmx.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


// note: global vars in this file don't need "prefbar" prefix in their names

var gActiveTree = null;
var allTree = null;
var enabledTree = null;

var gMainDS = null;

function Startup() {
  window.addEventListener("unload", Shutdown, false);
  goPrefBar.ObserverService.addObserver(JSONObserver, "extensions-prefbar-json-changed", false);
  goPrefBar.Include("chrome://global/content/contentAreaUtils.js", this);
  setTimeout(DelayedStartup, 0);
}
function DelayedStartup() {
  allTree = document.getElementById("allTree");
  enabledTree = document.getElementById("enabledTree");

  allTree.addEventListener("click", TreeClick, true);
  enabledTree.addEventListener("click", TreeClick, true);

  gMainDS = goPrefBar.JSONUtils.mainDS;
  RenderBothTrees();

  // Set the preset for the selections.
  enabledTree.focus();
  if (allTree.view) allTree.view.selection.clearSelection();
  if (enabledTree.view) enabledTree.view.selection.select(0);
}

function Shutdown() {
  goPrefBar.ObserverService.removeObserver(JSONObserver, "extensions-prefbar-json-changed");
}

var JSONObserver = {
  observe: function(aSubject, aTopic, aData) {
    if (aData != "pref-editbar.js")
      RenderBothTrees();
    if (aData == "newItem")
      enabledTree.view.selection.select(0);
  }
};

function TreeClick(event) {
  if (event.detail != 2) return; // doubleclick
  if (event.originalTarget.tagName != "treechildren") return;
  if (gActiveTree.treeBoxObject.getRowAt(event.clientX, event.clientY) == -1)
    return;

  event.preventDefault();
  event.stopPropagation();
  prefbarItemEdit();
}

function TreeKeypress(event) {
  if (event.keyCode != 46) return;

  prefbarItemDelete();
}

function AllTreeFocus() {
  // Remove selection from other tree
  if (enabledTree.view) enabledTree.view.selection.clearSelection();
  gActiveTree = allTree;
}
function EnabledTreeFocus() {
  // Remove selection from other tree
  if(allTree.view) allTree.view.selection.clearSelection();
  gActiveTree = enabledTree;
}

function PopupShowing() {
  if (!gActiveTree) return false;

  var selections = prefbarGetTreeSelections(gActiveTree);

  var editButton = document.getElementById("itemEdit");
  var copyButton = document.getElementById("itemCopy");
  var deleteButton = document.getElementById("itemDelete");
  var exportButton = document.getElementById("itemExport");

  editButton.disabled = (selections.length != 1 ||
                         gMainDS[selections[0]].type == "spacer" ||
                         gMainDS[selections[0]].type == "separator");
  copyButton.disabled = (selections.length != 1);
  deleteButton.disabled = (selections.length <= 0);
  exportButton.disabled = (selections.length <= 0);

  return true;
}


function ItemNew(aType) {
  if (!aType) return;
  switch (aType) {
    case "spacer":
    case "separator":
      var id = goPrefBar.JSONUtils.GetAnonymousID();
      gMainDS[id] = {type: aType};
      gMainDS["prefbar:menu:enabled"].items.unshift(id);
      goPrefBar.JSONUtils.MainDSUpdated("newItem");
      break;
    default:
      goPrefBar.GoButtonEditor(window, aType);
  }
}

function prefbarItemEdit() {
  var selections = prefbarGetTreeSelections(gActiveTree);
  if (selections.length != 1) return;
  var type = gMainDS[selections[0]].type;
  if (type == "spacer" || type == "separator") return;
  goPrefBar.GoButtonEditor(window, selections[0]);
}


function prefbarItemDelete() {
	var ids_to_delete, helper, id, parent_menu_id, item, parent_item, i, submenu_item_id;

	ids_to_delete       = prefbarGetTreeSelections(gActiveTree);
	helper              = goPrefBar.ImpExp.helper;

	// sanity check
	if (
		(! helper.is_non_empty_array(ids_to_delete))
	){return;}

	// ask user to confirm the delete operation
	if(!goPrefBar.msgYesNo(window, goPrefBar.GetString("pref-editbar.properties", "questiondelete"))) return;

	while (ids_to_delete.length){
		id              = ids_to_delete.shift();
		item            = gMainDS[id];

		// sanity check
		if (
			(! helper.is_non_null_object(item))
		){continue;}

		parent_menu_id  = getCNameById(id);
		parent_item     = gMainDS[parent_menu_id];

		if (
			(item.type === "submenu") &&
			(helper.is_non_empty_array(item.items))
		){
			for (i=0; i<item.items.length; i++){
				submenu_item_id = item.items[i];
				ids_to_delete.push(submenu_item_id);
			}
		}

		if (
			(helper.is_non_null_object(parent_item)) &&
			(helper.is_non_empty_array(parent_item.items))
		){
			submenu_item_id = goPrefBar.ArraySearch(id, parent_item.items);

			if (submenu_item_id !== false){
				parent_item.items.splice(submenu_item_id, 1);
			}
		}

		delete gMainDS[id];
	}

	RenderTree(gActiveTree);
	goPrefBar.JSONUtils.MainDSUpdated("pref-editbar.js");
}

function ItemCopy() {
	var ids_to_copy, helper, id_whitelist, id_mapping, generate_new_id, generate_shallow_item_copy, get_item_copy, id, item_copy, new_id, new_item;

	ids_to_copy    = prefbarGetTreeSelections(gActiveTree);
	helper         = goPrefBar.ImpExp.helper;
	id_whitelist   = /^prefbar:(menu|button):/i;
	id_mapping     = {};

	// sanity check
	if (
		(! helper.is_non_empty_array(ids_to_copy))
	){return;}

	generate_new_id = function(id){
		var search_pattern, index, new_id_prefix, new_id;

		search_pattern = /-(\d+)$/;
		index          = search_pattern.exec(id);
		index          = (index === null)? 1 : (parseInt(index[1], 10));
		index          = (isNaN(index))?   1 : index;
		new_id_prefix  = id.replace(search_pattern, '') + '-';

		while(true){
			index++;
			new_id     = new_id_prefix + index;
			if (goPrefBar.JSONUtils.CheckNewID(window, new_id)) break;
		}
		return new_id;
	};

	generate_shallow_item_copy = function(item){
		var new_item;
		new_item = JSON.stringify(item);
		new_item = JSON.parse(new_item);
		return new_item;
	};

	get_item_copy = function(id){
		var item, new_id, new_item;
		var i, submenu_id, submenu_item_copy, submenu_new_id;

		// sanity check
		if (
			(! id_whitelist.test(id))
		){return [false,false];}

		// cache hit
		if (id_mapping[id]){
			new_id      = id_mapping[id];
			new_item    = gMainDS[new_id];

			return [new_id, new_item];
		}

		item            = gMainDS[id];

		// sanity check
		if (
			(! helper.is_non_null_object(item))
		){return [false,false];}

		new_id          = generate_new_id(id);
		new_item        = generate_shallow_item_copy(item);

		id_mapping[id]  = new_id;
		gMainDS[new_id] = new_item;

		// recursively copy all items in submenu
		if (
			(new_item.type === "submenu") &&
			(helper.is_non_empty_array(new_item.items))
		){
			for (i=0; i<new_item.items.length; i++){
				submenu_id             = new_item.items[i];
				submenu_item_copy      = get_item_copy(submenu_id);
				submenu_new_id         = submenu_item_copy[0];
				if (submenu_new_id){
					new_item.items[i]  = submenu_new_id;
				}
			}
		}

		return [new_id, new_item];
	};

	while (ids_to_copy.length){
		id              = ids_to_copy.shift();

		// sanity check
		if (
			(! id_whitelist.test(id))
		){continue;}

		item_copy       = get_item_copy(id);
		new_id          = item_copy[0];
		new_item        = item_copy[1];

		if (new_id){
			gMainDS[gActiveTree.ref].items.unshift(new_id);
		}
	}

	RenderTree(gActiveTree);
	gActiveTree.view.selection.select(0);
	goPrefBar.JSONUtils.MainDSUpdated("pref-editbar.js");
}

function prefbarItemExport() {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);

  fp.init(window, "Export Buttons to File:", nsIFilePicker.modeSave);
  fp.appendFilter("ButtonCollections", "*.btn");
  fp.defaultExtension = "btn";

  var res=fp.show();
  if (res==nsIFilePicker.returnOK || res == nsIFilePicker.returnReplace) {
    var selections = prefbarGetTreeSelections(gActiveTree);
    goPrefBar.ImpExp.Export(window, selections, fp.file);
  }
}


function prefbarItemImport() {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);

  fp.init(window, "Import Buttons from File:", nsIFilePicker.modeOpen);
  fp.appendFilter("ButtonCollections", "*.btn");
  fp.defaultExtension = "btn";

  var res=fp.show();
  if (res==nsIFilePicker.returnOK) {
    goPrefBar.ImpExp.Import(window, fp.file);
  }
}

function OnLinkClick(aEvent) {
  openURL(aEvent.target.href);
  aEvent.preventDefault();
}

const gDragFlavor = "text/x-moz-prefbar-button";
var gDragArray;

function BeginDragTree(event, tree) {
  goPrefBar.dump("BeginDragTree");

  if (event.originalTarget.localName != "treechildren")
    return false;

  var row = tree.treeBoxObject.getRowAt(event.clientX, event.clientY);
  goPrefBar.dump("BeginDragTree: row: " + row);
  if (row == -1)
    return false;

  gDragArray = new Array();

  var selection = prefbarGetTreeSelections(tree);
  for (var i = 0; i < selection.length; ++i ) {
    var curItem = selection[i];
    var ItemArray = new Array(curItem, getCNameById(curItem));
    gDragArray.push(ItemArray);
  }

  // We just drag the word "prefbar" the usual way.
  // The real data is in gDragArray.
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(gDragFlavor, "prefbar");

  return false;  // don't propagate the event if a drag has begun
}

function DragOverTree(event) {
  if (event.dataTransfer.types.contains(gDragFlavor)) {
    event.preventDefault();
    return false;
  }

  return true;
}

function DropOnTree(event, tree) {
  goPrefBar.dump("DropOnTree");

  // The drop procedure may take really long (depending on how much items
  // have to be moved)...
  window.setCursor("wait");

  var idPlaceBefore = null;
  var idPlaceInside = null;
  var PlaceAfter = false;

  var tbo = tree.treeBoxObject;
  if (tbo.treeBody && tbo.treeBody.childNodes.length > 0) {
    var row = tbo.getRowAt(event.clientX, event.clientY);
    goPrefBar.dump("DropOnTree: Dropped On Row: " + row);
    if (row != -1) {
      var rowHeight = tbo.rowHeight;
      var rowY = tbo.treeBody.boxObject.y;
      var firstRow = tbo.getFirstVisibleRow();

      var ItemPos = rowY + rowHeight * (row - firstRow);
      var pastePos = (event.clientY - ItemPos) / (rowHeight / 4);

      idPlaceBefore = tree.contentView.getItemAtIndex(row).getAttribute("id");

      var item = document.getElementById(idPlaceBefore);
      if (item.getAttribute("container") == "true") {
        if (item.lastChild.children.length == 0) {
          if (pastePos > 1 && pastePos < 3) {
            idPlaceInside = idPlaceBefore;
            idPlaceBefore = null;
          }
          else if (pastePos >= 3)
            PlaceAfter = true;
        }
        else if (item.getAttribute("open") == "true") {
          if (pastePos > 2) {
            idPlaceInside = idPlaceBefore;
            idPlaceBefore = null;
          }
        }
        else if (pastePos > 2)
          PlaceAfter = true;
      }
      else if (pastePos > 2)
        PlaceAfter = true;
    }
    else {
      goPrefBar.dump("DropOnTree: Dropped after last item");
      var lastRow = tbo.treeBody.childNodes.length - 1;
      idPlaceBefore = tbo.treeBody.childNodes[lastRow].getAttribute("id");
      PlaceAfter = true;
    }
  }
  else {
    goPrefBar.dump("DropOnTree: Dropped On Empty Tree");
  }

  // If we have a reference ID and the reference ID is within the dragged items,
  // then do not continue!
  if (idPlaceBefore) {
    for (var i = 0; i < gDragArray.length; i++) {
      if (gDragArray[i][0] == idPlaceBefore) {
        window.setCursor("auto");
        return true;
      }
    }
  }

  // Get target sequence and container
  var targetcontainer;
  if (idPlaceBefore)
    targetcontainer = getCNameById(idPlaceBefore);
  else if (idPlaceInside) {
    targetcontainer = idPlaceInside;
    document.getElementById(idPlaceInside).setAttribute("open", "true");
  }
  else
    targetcontainer = tree.ref;

  // first run: Kill all items from old menu
  var dragcnt = gDragArray.length;
  for (var i = 0; i < dragcnt; i++) {
    var curitem = gDragArray[i];
    var oldmnuitems = gMainDS[curitem[1]].items;
    oldmnuitems.splice(goPrefBar.ArraySearch(curitem[0], oldmnuitems), 1);
  }

  // Now get target position.
  var newpos;
  if (!idPlaceBefore)
    newpos = 0;
  else {
    newpos = goPrefBar.ArraySearch(idPlaceBefore, gMainDS[targetcontainer].items);
    if (newpos === false)
      newpos = 0;
    else
      if (PlaceAfter) newpos++;
  }

  // Second run: Add all items to new seq on their new position
  for (var i = 0; i < dragcnt; i++) {
    var curitem = gDragArray[i];
    gMainDS[targetcontainer].items.splice(newpos, 0, curitem[0]);
    newpos++;
  }

  // Focus target tree
  tree.focus();
  RenderBothTrees();
  goPrefBar.JSONUtils.MainDSUpdated("pref-editbar.js");

  // Add selection for newly added items
  if (dragcnt > 0) {
    for (var index = 0; index < tree.view.rowCount; index++) {
      if (tree.contentView.getItemAtIndex(index).id == gDragArray[0][0]) {
        tree.view.selection.rangedSelect(index, index + gDragArray.length - 1, false);
        tree.treeBoxObject.ensureRowIsVisible(index);
        break;
      }
    }
  }

  window.setCursor("auto");
  return true;
}


function getCNameById(id) {
  var item = document.getElementById(id);
  item = item.parentNode.parentNode;
  if (item.localName == "treeitem")
    return item.id;
  else
    return item.ref;
}

var savedOpenState;
function saveOpenStates() {
  savedOpenState = {};
  var tb = enabledTree.treeBoxObject.treeBody;
  if (!tb) return; // Empty tree
  for (var index = 0; index < tb.childNodes.length; index++) {
    var curnode = tb.childNodes[index];
    if (curnode.getAttribute("container") == "true")
      savedOpenState[curnode.id] = curnode.getAttribute("open");
  }
}
function restoreOpenStates() {
  for (var id in savedOpenState) {
    var element = document.getElementById(id);
    if (element) element.setAttribute("open", savedOpenState[id]);
  }
}

function prefbarGetTreeSelections(tree) {
  var selections = [];

  // TODO: Check if this is still needed on supported platforms
  if (!tree.view) return selections;

  // HACK! Backend returns an invalid selection range for empty trees
  if (tree.view.rowCount == 0) return selections;

  var select = tree.view.selection;
  if (select) {
    var count = select.getRangeCount();
    var min = new Object();
    var max = new Object();
    for (var i = 0; i < count; i++) {
      select.getRangeAt(i, min, max);
      for (var k=min.value; k<=max.value; k++) {
        if (k != -1) {
          selections[selections.length] = tree.contentView.getItemAtIndex(k).getAttribute("id");
        }
      }
    }
  }
  return selections;
}

function RenderTree(aTree, aIsSubmenu) {
  var menu = aTree.getAttribute("ref");
  if (!menu) return;

  var treechildren = aTree.lastChild;
  if (!treechildren.tagName == "treechildren") return;

  if (!aIsSubmenu) saveOpenStates();

  // Dump children
  while(treechildren.firstChild) treechildren.removeChild(treechildren.firstChild);

  // Recreate from datasource
  var ds = goPrefBar.JSONUtils.mainDS;
  for (var index = 0; index < ds[menu].items.length; index++) {
    var itemid = ds[menu].items[index];
    var item = ds[itemid];

    var treeitem = document.createElement("treeitem");
    var treerow = document.createElement("treerow");
    var treecell1 = document.createElement("treecell");
    var treecell2 = document.createElement("treecell");

    treerow.appendChild(treecell1);
    treerow.appendChild(treecell2);
    treeitem.appendChild(treerow);
    treechildren.appendChild(treeitem);

    treeitem.setAttribute("id", itemid);
    treecell2.setAttribute("label", item.type);

    switch (item.type) {
    case "separator":
      treecell1.setAttribute("label", "------------------");
      break;
    case "spacer":
      treecell1.setAttribute("label", goPrefBar.GetString("pref-editbar.properties", "spacer.label"));
      break;
    default:
      treecell1.setAttribute("label", item.label);
    }

    if (item.type == "submenu") {
      var subtreechildren = document.createElement("treechildren");
      treeitem.appendChild(subtreechildren);
      treeitem.setAttribute("ref", itemid);
      treeitem.setAttribute("container", "true");
      RenderTree(treeitem, true);
    }
  }

  if (!aIsSubmenu) restoreOpenStates();
}

function RenderBothTrees() {
  RenderTree(allTree);
  RenderTree(enabledTree);
}
