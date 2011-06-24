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
 * Portions created by the Initial Developer are Copyright (C) 2___
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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


var gListBox;

//
// "public" functions accessed by the active edit page
//

function mnueditSetupEdit(itemId) {
  mnueditInit();

  for (var index = 0; index < gMainDS[itemId].items.length; index++) {
    var entry = gMainDS[itemId].items[index];
    mnueditAddNewItem(entry[0], entry[1]);
  }

  if (gListBox.getRowCount() != 0)
    gListBox.selectedIndex = 0;
}

function mnueditSetupNew() {
  mnueditInit();

  for (var i = 0; i < 4; i++)
    mnueditAddNewItem("", "");

  gListBox.selectedIndex = 0;
}

function mnueditSaveData(itemId) {
  gMainDS[itemId].items = [];

  for (var index = 0; index < gListBox.getRowCount(); index++) {
    var dataArray = mnueditDataByItem(gListBox.getItemAtIndex(index));
    if (dataArray[0] == "") continue;
    gMainDS[itemId].items.push(dataArray);
  }
}

//
// handlers for the buttons
//

function itemNew() {
  mnueditAddNewItem("", "");
  var newItem = gListBox.getItemAtIndex(gListBox.getRowCount() - 1);
  gListBox.ensureElementIsVisible(newItem);
  gListBox.selectedItem = newItem;
  var labelbox = newItem.firstChild.firstChild;
  labelbox.focus();
}

function itemDelete() {
  var selIndex = gListBox.selectedIndex;
  if (selIndex >= 0)
    gListBox.removeChild(gListBox.selectedItem);
}

function itemMoveUp() {
  var newIndex = gListBox.selectedIndex - 1;
  if (newIndex < 0) return;
  var selItem = gListBox.selectedItem;

  var labelbox = selItem.firstChild.firstChild;
  var valuebox = selItem.lastChild.firstChild;
  labelbox.setAttribute("value", labelbox.value);
  valuebox.setAttribute("value", valuebox.value);

  gListBox.removeChild(selItem);
  var newPosRef = gListBox.getItemAtIndex(newIndex);
  gListBox.insertBefore(selItem, newPosRef);

  gListBox.ensureIndexIsVisible(newIndex);
  gListBox.selectedIndex = newIndex;
}

function itemMoveDown() {
  var newIndex = gListBox.selectedIndex + 1;
  if (newIndex >= gListBox.getRowCount()) return;
  var selItem = gListBox.selectedItem;

  var labelbox = selItem.firstChild.firstChild;
  var valuebox = selItem.lastChild.firstChild;
  labelbox.setAttribute("value", labelbox.value);
  valuebox.setAttribute("value", valuebox.value);

  gListBox.removeChild(selItem);
  if (newIndex < gListBox.getRowCount()) {
    var newPosRef = gListBox.getItemAtIndex(newIndex);
    gListBox.insertBefore(selItem, newPosRef);
  }
  else
    gListBox.appendChild(selItem);

  gListBox.ensureIndexIsVisible(newIndex);
  gListBox.selectedIndex = newIndex;
}

//
// additional code
//

function mnueditInit() {
  gListBox = document.getElementById("listEdit");
  if (!gListBox) return;

  // Workaround for Firefox...
  // The firefox skin is corrupted. The CSS located at
  // chrome://global/skin/spinbuttons.css gives the buttons an icon, but the
  // files don't exist...
  var btnup = document.getElementById("itemMoveUp");
  var btndn = document.getElementById("itemMoveDown");
  var styleup = window.getComputedStyle(btnup , "").getPropertyValue("list-style-image");
  var styledn = window.getComputedStyle(btndn , "").getPropertyValue("list-style-image");
  if (styleup == "none") btnup.setAttribute("label", "^");
  if (styledn == "none") btndn.setAttribute("label", "v");
}

function mnueditUpdateButtons() {
  var btnup = document.getElementById("itemMoveUp");
  var btndn = document.getElementById("itemMoveDown");
  var btnnew = document.getElementById("itemNew");
  var btndel = document.getElementById("itemDelete");

  var selection = gListBox.selectedIndex;

  // enable/disable buttons depending on the number of items selected
  var isNothingSelected = (selection == -1);
  btndel.disabled = isNothingSelected;
  btnup.disabled = (selection == 0 || isNothingSelected);
  btndn.disabled = (selection == gListBox.getRowCount() - 1 || isNothingSelected);
}

function mnueditAddNewItem(strLabel, strValue, optionalIndex) {
  var labelbox = document.createElement('textbox');
  var valuebox = document.createElement('textbox');
  labelbox.setAttribute("flex", "1");
  labelbox.setAttribute("value", strLabel);
  valuebox.setAttribute("flex", "1");
  valuebox.setAttribute("value", strValue);

  var labelcell = document.createElement('listcell');
  var valuecell = document.createElement('listcell');
  labelcell.appendChild(labelbox);
  valuecell.appendChild(valuebox);

  var listitem = document.createElement('listitem');
  listitem.setAttribute("allowevents", "true");
  listitem.appendChild(labelcell);
  listitem.appendChild(valuecell);

  if (optionalIndex);
    //Not supported so far
  else
    gListBox.appendChild(listitem);
}

function mnueditDataByItem(Item) {
  var retval = new Array();
  var labelbox = Item.firstChild.firstChild;
  var valuebox = Item.lastChild.firstChild;
  var label = labelbox.value;
  var value = valuebox.value;
  retval[0] = label;
  retval[1] = value;
  return retval;
}
