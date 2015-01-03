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
 * Portions created by the Initial Developer are Copyright (C) 2___
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

function setupNew() {
  hkeditSetupNew();

  initMnuLineJump("itemOnclick");
  initMnuLineJump("itemInitfunction");
}

function setupEdit() {
  var itemId = window.parent.arguments[0];
  setIdField(itemId);

  setField(itemId, "label",  "itemLabel");
  setField(itemId, "onclick","itemOnclick");
  setField(itemId, "initfunction","itemInitfunction");

  hkeditSetupEdit(itemId);

  initMnuLineJump("itemOnclick");
  initMnuLineJump("itemInitfunction");
}


function verifyDataNew() {
  if(!checkId(document.getElementById("itemId").value)) return false;

  return verifyData();
}

function verifyData() {
  if(!attributeNotEmpty("Id", "itemId"))           return false;
  if(!attributeNotEmpty("Label", "itemLabel"))     return false;
  if(!attributeNotEmpty("onclick", "itemOnclick")) return false;

  return true;
}

function createNewItem() {
  var itemId = "prefbar:button:" + document.getElementById("itemId").value;
  createEntry(itemId, "button");

  editItem();
}

function editItem() {
  var itemId = "prefbar:button:" + document.getElementById("itemId").value;

  editField(itemId, "label",   "itemLabel");
  editField(itemId, "onclick", "itemOnclick");

  // initfunction
  var initfunction = document.getElementById("itemInitfunction").value;
  if (initfunction.match(/[^\n\t\r ]/))
    gMainDS[itemId].initfunction = initfunction;
  else
    delete(gMainDS[itemId].initfunction);

  hkeditSaveData(itemId);
}
