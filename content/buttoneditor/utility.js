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
 * The Original Code is Preferences Toolbar 2.
 *
 * The Initial Developer of the Original Code is
 * Aaron Andersen.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Aaron Andersen <aaron@xulplanet.com>
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

var goPrefBar = Components.classes["@prefbar.mozdev.org/goprefbar;1"]
                          .getService().wrappedJSObject;

var gMainDS = goPrefBar.JSONUtils.mainDS;

function checkId(itemId) {
  return goPrefBar.JSONUtils.CheckNewID(window, "prefbar:button:" + itemId);
}

function attributeNotEmpty(label, edit) {
  if(fieldEmpty(edit)) {
    goPrefBar.msgAlert(window, goPrefBar.GetString("newItem.properties", "alertnovalue").replace("$label", label));
    return false;
  }

  return true;
}

function fieldEmpty(edit) {
  return document.getElementById(edit).value == "";
}

function setIdField(itemId) {
  var itemIdShow = itemId.replace(/prefbar:button:/g, "");

  var itemIdField = document.getElementById("itemId");

  itemIdField.value = itemIdShow;
  itemIdField.disabled = true;
}

function setField(itemId, attribute,  fieldId) {
  var value = gMainDS[itemId][attribute];
  if (value !== undefined)
    document.getElementById(fieldId).value = value;
}

function editField(itemId, attribute, fieldId) {
  var value = document.getElementById(fieldId).value;
  gMainDS[itemId][attribute] = value;
}

function createEntry(id, type) {
  if (id in gMainDS) return false;
  gMainDS[id] = {type: type};
  gMainDS["prefbar:menu:enabled"].items.unshift(id);
  return true;
}


function initMnuLineJump(id) {
  var item = document.getElementById(id);
  item.addEventListener("popupshowing", LineJumpOnPopup, true);
}
function LineJumpOnPopup(event) {
  // only edit context menu once
  event.target.removeEventListener("popupshowing", LineJumpOnPopup, true);

  var menupopup = event.originalTarget;
  if (menupopup.nodeName != "xul:menupopup") return;

  var mnusep = document.createElement('menuseparator');
  var mnuitem = document.createElement('menuitem');
  var lbljumpline = goPrefBar.GetString("newItem.properties", "lbljumpline");
  mnuitem.setAttribute("label", lbljumpline);
  mnuitem.setAttribute("oncommand", "LineJumpOnClick(event)");
  menupopup.appendChild(mnusep);
  menupopup.appendChild(mnuitem);
}
function LineJumpOnClick(event) {
  // Walk up the tree until we reach the textbox item
  var textbox = event.target;
  for (var tries = 0; tries < 5; tries++) {
    textbox = textbox.parentNode;
    if (textbox.nodeName == "textbox") break;
  }
  if (textbox.nodeName != "textbox") return;

  var msgenterline = goPrefBar.GetString("newItem.properties", "msgenterline");
  var line = prompt(msgenterline);
  if (parseInt(line) != line) return;

  var text = textbox.value;
  var lines = text.split("\n");
  if (line < 1 || line > lines.length) return;
  line--; // Convert line to zero based index

  var startpos = 0;
  for (var index = 0; index < line; index++) {
    startpos += lines[index].length + 1;
  }
  textbox.setSelectionRange(startpos, startpos + lines[line].length);

  // Try to scroll the textbox
  var realtb = textbox.boxObject.firstChild.firstChild;
  if (realtb.tagName != "html:textarea") return;
  if (realtb.scrollHeight <= realtb.clientHeigth) return;

  var pxperline = realtb.scrollHeight / lines.length;
  realtb.scrollTop = pxperline * line;
}
